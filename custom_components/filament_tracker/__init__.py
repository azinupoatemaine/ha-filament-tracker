"""Filament Tracker: a small native database of backstock/refill filament spools."""
from __future__ import annotations

import logging
import mimetypes
import pathlib
import re

import voluptuous as vol
from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.exceptions import ServiceValidationError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import (
    async_call_later,
    async_track_state_added_domain,
    async_track_state_change_event,
)
from homeassistant.helpers.storage import Store
from homeassistant.helpers.typing import ConfigType

from .const import (
    AMS_TRAY_RE,
    CARD_FILENAME,
    CARD_URL_PATH,
    CARD_VERSION,
    CURRENT_STAGE_SUFFIX,
    DOMAIN,
    PRINT_WEIGHT_SUFFIX,
    SERVICE_ADD_SPOOL,
    SERVICE_DELETE_SPOOL,
    SERVICE_SET_SLOT_MAPPING,
    SERVICE_UPDATE_SPOOL,
    SIGNAL_SPOOLS_UPDATED,
    STORAGE_KEY,
    STORAGE_VERSION,
)

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]

# Some hosts' mimetypes database maps ".js" to "text/plain" (or omits it), and
# browsers refuse an ES module served with a non-JavaScript type. Registering it
# here fixes it process-wide for any static handler that consults mimetypes;
# FilamentTrackerCardView also sets the header explicitly as a second guarantee.
mimetypes.add_type("text/javascript", ".js")

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

ADD_SPOOL_SCHEMA = vol.Schema(
    {
        vol.Optional("label", default=""): cv.string,
        vol.Optional("material", default=""): cv.string,
        vol.Optional("color_hex", default="#888888"): cv.string,
        vol.Optional("weight_full", default=0): vol.Coerce(float),
        vol.Optional("weight_remaining", default=0): vol.Coerce(float),
        vol.Optional("status", default="Sealed"): cv.string,
    }
)

DELETE_SPOOL_SCHEMA = vol.Schema({vol.Required("id"): vol.Coerce(int)})

UPDATE_SPOOL_SCHEMA = vol.Schema(
    {
        vol.Required("id"): vol.Coerce(int),
        vol.Optional("weight_remaining"): vol.Coerce(float),
        vol.Optional("status"): cv.string,
    }
)

SET_SLOT_MAPPING_SCHEMA = vol.Schema(
    {
        vol.Required("slot"): vol.Coerce(int),
        vol.Optional("spool_id"): vol.Any(vol.Coerce(int), None),
    }
)


def _migrate_storage(raw) -> dict:
    """Old versions stored a bare list of spools; normalize to {spools, mappings}."""
    if isinstance(raw, list):
        return {"spools": raw, "mappings": {}}
    if isinstance(raw, dict):
        raw.setdefault("spools", [])
        raw.setdefault("mappings", {})
        return raw
    return {"spools": [], "mappings": {}}


def discover_printer_prefixes(hass: HomeAssistant) -> set[str]:
    """Find ha-bambulab printer entity prefixes by pattern, no config needed."""
    prefixes: set[str] = set()
    pattern = re.compile(AMS_TRAY_RE)
    for state in hass.states.async_all("sensor"):
        m = pattern.match(state.entity_id)
        if m:
            prefixes.add(m.group(1))
    return prefixes


class FilamentTrackerCardView(HomeAssistantView):
    """Serve the card JS ourselves, with an explicit JavaScript content type.

    Home Assistant's static-path handler derives Content-Type from Python's
    ``mimetypes`` database (``CachingStaticResource`` does
    ``content_type = guess_file_type(path)[0] or "application/octet-stream"``).
    Browsers enforce strict MIME checking for ES modules: the frontend loads
    extra modules with a dynamic ``import()``, and if the response isn't served
    as a JavaScript type the import is rejected *silently* — an unhandled
    promise rejection in the console, while the network request itself is a
    perfectly ordinary 200. The card then never defines its custom element and
    the dashboard sits on "Loading card..." forever.

    Serving the file from our own view with a hardcoded Content-Type removes
    that failure mode entirely, regardless of the host OS mimetypes config.

    Caching: the file is served ``immutable`` with a one-year max-age. This is
    not a workaround, it is how every reliably-loading card is served. The
    frontend fires the module's ``import()`` un-awaited and only shows a card
    for ``customElements.whenDefined`` up to a 2000 ms ``TIMEOUT``; miss that
    window and the dashboard paints the red "Configuration error" placeholder,
    which then only recovers on its own if the ``ll-rebuild`` retry reaches the
    card (it does not, inside some stack/grid cards). Other plugins clear the
    2 s bar because the browser has them cached and the ``import()`` resolves in
    milliseconds. The previous ``max-age=0, must-revalidate`` here forced a
    conditional request to HA on *every* dashboard open — the one card on the
    system paying a network round-trip before it could execute, and the one that
    lost the race on a cold cache or a hard refresh. The ``?v=CARD_VERSION``
    query string is the cache-buster: a bump is a URL the browser has never
    seen, so an update still lands immediately.
    """

    requires_auth = False
    url = f"{CARD_URL_PATH}/{CARD_FILENAME}"
    name = f"{DOMAIN}:card"

    def __init__(self, js_path: pathlib.Path) -> None:
        """Store the path to the card file on disk."""
        self._js_path = js_path

    async def get(self, request: web.Request) -> web.FileResponse:
        """Return the card JS with a guaranteed-correct module MIME type."""
        return web.FileResponse(
            self._js_path,
            headers={
                "Content-Type": "text/javascript; charset=utf-8",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        )


def _lovelace_attr(lovelace: object, *names: str):
    """Read an attribute off the Lovelace data (a dataclass now, a dict on old HA)."""
    for name in names:
        if isinstance(lovelace, dict):
            if name in lovelace:
                return lovelace[name]
        elif hasattr(lovelace, name):
            return getattr(lovelace, name)
    return None


async def _async_register_lovelace_resource(hass: HomeAssistant, module_url: str) -> None:
    """Also register the card as a real dashboard resource, in storage mode.

    ``add_extra_js_url`` on its own has proven unreliable for cards bundled
    inside an integration, while cards loaded as ordinary Lovelace resources
    keep working. Registering both costs nothing: the browser's module map
    dedupes the identical URL, so the file is still only evaluated once.
    """
    lovelace = hass.data.get("lovelace")
    if lovelace is None:
        _LOGGER.debug("Filament Tracker: Lovelace not set up, skipping resource registration")
        return

    resources = _lovelace_attr(lovelace, "resources")
    mode = _lovelace_attr(lovelace, "resource_mode", "mode")
    if resources is None:
        return
    if mode != "storage":
        _LOGGER.debug(
            "Filament Tracker: Lovelace resources are in YAML mode — add the card "
            "yourself with: resources: [{url: %s, type: module}]",
            module_url,
        )
        return

    # async_items() doesn't lazy-load the collection; async_get_info() does.
    if hasattr(resources, "async_get_info"):
        await resources.async_get_info()

    base_url = f"{CARD_URL_PATH}/{CARD_FILENAME}"
    existing = next(
        (
            item
            for item in (resources.async_items() or [])
            if str(item.get("url", "")).split("?")[0] == base_url
        ),
        None,
    )

    if existing is None:
        await resources.async_create_item({"res_type": "module", "url": module_url})
        _LOGGER.info("Filament Tracker: added dashboard resource %s", module_url)
    elif existing.get("url") != module_url:
        await resources.async_update_item(
            existing["id"], {"res_type": "module", "url": module_url}
        )
        _LOGGER.info("Filament Tracker: updated dashboard resource to %s", module_url)


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and register it as a Lovelace resource, once."""
    if hass.data.get(DOMAIN, {}).get("_frontend_registered"):
        _LOGGER.debug("Filament Tracker: frontend already registered, skipping")
        return

    www_dir = pathlib.Path(__file__).parent / "www"
    js_path = www_dir / CARD_FILENAME
    if not await hass.async_add_executor_job(js_path.exists):
        _LOGGER.error(
            "Filament Tracker: card file missing at %s — the www/ folder didn't get "
            "installed correctly. Reinstalling via HACS (Remove, then re-add) usually fixes this.",
            js_path,
        )
        return

    module_url = f"{CARD_URL_PATH}/{CARD_FILENAME}?v={CARD_VERSION}"

    try:
        hass.http.register_view(FilamentTrackerCardView(js_path))
        _LOGGER.info(
            "Filament Tracker: serving %s from %s as text/javascript (immutable)",
            FilamentTrackerCardView.url,
            js_path,
        )

        from homeassistant.components.frontend import add_extra_js_url

        add_extra_js_url(hass, module_url)
        await _async_register_lovelace_resource(hass, module_url)
        _LOGGER.info("Filament Tracker: registered frontend module %s", module_url)
    except Exception:
        _LOGGER.exception(
            "Filament Tracker: failed to register the card as a frontend resource. "
            "You can add it manually instead: Settings > Dashboards > Resources > "
            "Add Resource, URL %s, type JavaScript module.",
            module_url,
        )
        return

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["_frontend_registered"] = True


async def _get_shared_data(hass: HomeAssistant) -> dict:
    """Build, once, the single spools/mappings/store dict for this HA instance.

    Keyed off the domain, never off the config entry. The sensor entity and
    every service handler read and write this one dict, so there is exactly one
    in-memory spools list no matter how the entry is set up, unloaded and
    reloaded. ``single_config_entry`` in the manifest guarantees there is only
    ever one entry to begin with, and ``async_unload_entry`` pops ``shared`` so
    the next setup re-reads the file from disk.
    """
    domain_data = hass.data.setdefault(DOMAIN, {})
    if "shared" not in domain_data:
        store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        loaded = _migrate_storage(await store.async_load())
        domain_data["shared"] = {
            "store": store,
            "spools": loaded["spools"],
            "mappings": loaded["mappings"],
        }
    return domain_data["shared"]


def _require_shared(hass: HomeAssistant) -> dict:
    """Return the one shared spools/mappings/store dict, or say setup is needed.

    The service handlers and the post-print auto-deduct timer resolve the shared
    data through this on every call rather than closing over a dict captured at
    setup time: ``async_unload_entry`` pops ``shared``, so a captured reference
    could outlive its data and a reload would leave a handler writing into an
    orphaned copy. A missing dict means the integration was removed (or never
    added) — a user-facing condition — so raise ``ServiceValidationError`` with a
    plain sentence instead of letting a ``KeyError`` traceback surface.
    """
    shared = hass.data.get(DOMAIN, {}).get("shared")
    if shared is None:
        raise ServiceValidationError(
            "Filament Tracker isn't set up yet — add it from Settings → Devices & Services first."
        )
    return shared


async def _save_and_refresh(hass: HomeAssistant, label: str) -> None:
    """Persist the shared spools/mappings and push the sensor a refresh.

    ``async_dispatcher_send`` runs the sensor's ``@callback`` handler
    synchronously, so the new entity state is written (and its state_changed
    event queued to every open browser) before the caller — a service handler or
    the post-print auto-deduct timer — returns.
    """
    shared = _require_shared(hass)
    await shared["store"].async_save(
        {"spools": shared["spools"], "mappings": shared["mappings"]}
    )
    async_dispatcher_send(hass, SIGNAL_SPOOLS_UPDATED)
    _LOGGER.debug("Filament Tracker: %s saved and dispatched", label)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the four services once, against the domain rather than the entry.

    Services belong to the domain, not to a config entry, and
    ``single_config_entry`` means there is only ever one entry anyway. Doing this
    here instead of in ``async_setup_entry`` keeps ``filament_tracker.add_spool``
    and friends registered across an entry reload, so automations that reference
    them never see them briefly disappear. The handlers are closures so they
    capture ``hass`` (min supported HA is 2024.1, before ``ServiceCall.hass``);
    each resolves the shared data lazily through ``_require_shared`` on every
    call rather than closing over a dict that a reload could orphan.
    """
    hass.data.setdefault(DOMAIN, {})

    async def handle_add_spool(call: ServiceCall) -> None:
        shared = _require_shared(hass)
        spools = shared["spools"]
        next_id = max([s["id"] for s in spools], default=0) + 1
        spools.append(
            {
                "id": next_id,
                "label": call.data.get("label") or f"Spool {next_id}",
                "material": call.data.get("material") or "Altele",
                "color_hex": call.data.get("color_hex") or "#888888",
                "weight_full": call.data.get("weight_full", 0),
                "weight_remaining": call.data.get("weight_remaining", 0),
                "status": call.data.get("status") or "Sealed",
            }
        )
        await _save_and_refresh(hass, "add_spool")

    async def handle_delete_spool(call: ServiceCall) -> None:
        shared = _require_shared(hass)
        spool_id = call.data["id"]
        shared["spools"] = [s for s in shared["spools"] if s["id"] != spool_id]
        shared["mappings"] = {
            slot: sid for slot, sid in shared["mappings"].items() if sid != spool_id
        }
        await _save_and_refresh(hass, "delete_spool")

    async def handle_update_spool(call: ServiceCall) -> None:
        shared = _require_shared(hass)
        for s in shared["spools"]:
            if s["id"] == call.data["id"]:
                if "weight_remaining" in call.data:
                    s["weight_remaining"] = max(0.0, call.data["weight_remaining"])
                if "status" in call.data:
                    s["status"] = call.data["status"]
        await _save_and_refresh(hass, "update_spool")

    async def handle_set_slot_mapping(call: ServiceCall) -> None:
        shared = _require_shared(hass)
        slot = str(call.data["slot"])
        spool_id = call.data.get("spool_id")
        if spool_id is None:
            shared["mappings"].pop(slot, None)
        else:
            shared["mappings"][slot] = spool_id
        await _save_and_refresh(hass, "set_slot_mapping")

    hass.services.async_register(
        DOMAIN, SERVICE_ADD_SPOOL, handle_add_spool, schema=ADD_SPOOL_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_DELETE_SPOOL, handle_delete_spool, schema=DELETE_SPOOL_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_UPDATE_SPOOL, handle_update_spool, schema=UPDATE_SPOOL_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_SET_SLOT_MAPPING, handle_set_slot_mapping, schema=SET_SLOT_MAPPING_SCHEMA
    )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Filament Tracker from its (single) config entry."""
    await _async_register_frontend(hass)

    await _get_shared_data(hass)
    domain_data = hass.data[DOMAIN]

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    domain_data["unsub_listeners"] = []

    # ---- Auto-deduct: watches every discovered printer's current_stage, no YAML. ----
    async def _apply_consumption(prefix: str) -> None:
        shared = hass.data.get(DOMAIN, {}).get("shared")
        if shared is None:
            return  # entry unloaded while a post-print timer was still pending
        mapped = {slot: sid for slot, sid in shared["mappings"].items() if sid is not None}
        if len(mapped) != 1:
            return  # ambiguous (0 or >1 manual spool loaded) — update by hand
        spool_id = next(iter(mapped.values()))
        spool = next((s for s in shared["spools"] if s["id"] == spool_id), None)
        if spool is None:
            return

        weight_state = hass.states.get(f"sensor.{prefix}{PRINT_WEIGHT_SUFFIX}")
        try:
            grams_used = float(weight_state.state) if weight_state else 0.0
        except (TypeError, ValueError):
            grams_used = 0.0
        if grams_used <= 0:
            return

        new_remaining = max(0.0, float(spool.get("weight_remaining", 0)) - grams_used)
        spool["weight_remaining"] = round(new_remaining, 1)
        await _save_and_refresh(hass, "auto_deduct")
        _LOGGER.info(
            "Filament Tracker: deducted %sg from %s (now %sg remaining)",
            grams_used,
            spool["label"],
            spool["weight_remaining"],
        )

    def _make_stage_listener(prefix: str):
        async def _on_stage_change(event) -> None:
            old = event.data["old_state"]
            new = event.data["new_state"]
            if new is None or new.state != "idle":
                return
            if old is None or old.state in ("idle", "unavailable", "unknown"):
                return

            async def _after_delay(_now) -> None:
                await _apply_consumption(prefix)

            async_call_later(hass, 60, _after_delay)

        return _on_stage_change

    wired_prefixes: set[str] = set()

    def _ensure_stage_listener(prefix: str) -> None:
        """Wire prefix's current_stage -> auto-deduct listener, exactly once.

        Called from both the initial scan and the state-added callback below, so
        a Bambu printer that only shows up in Home Assistant *after* this
        integration was set up still gets its listener without a restart.
        """
        if prefix in wired_prefixes:
            return
        wired_prefixes.add(prefix)
        entity_id = f"sensor.{prefix}{CURRENT_STAGE_SUFFIX}"
        unsub = async_track_state_change_event(
            hass, [entity_id], _make_stage_listener(prefix)
        )
        domain_data["unsub_listeners"].append(unsub)

    for prefix in discover_printer_prefixes(hass):
        _ensure_stage_listener(prefix)

    tray_pattern = re.compile(AMS_TRAY_RE)

    @callback
    def _on_sensor_added(event) -> None:
        """A new sensor entity appeared — wire its printer if it's an AMS tray."""
        match = tray_pattern.match(event.data["entity_id"])
        if match:
            _ensure_stage_listener(match.group(1))

    domain_data["unsub_listeners"].append(
        async_track_state_added_domain(hass, "sensor", _on_sensor_added)
    )

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Options changed (e.g. low-stock threshold) — push a refresh."""
    async_dispatcher_send(hass, SIGNAL_SPOOLS_UPDATED)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the config entry.

    The four services are registered against the domain in ``async_setup`` and
    are deliberately left in place here — a reload shouldn't make them briefly
    vanish from the service registry. Everything this tears down is per-setup:
    the sensor platform, the printer state listeners, and the in-memory
    ``shared`` dict, which is popped so the next setup re-reads spools from disk.
    """
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if not unload_ok:
        return False

    domain_data = hass.data.get(DOMAIN, {})
    for unsub in domain_data.pop("unsub_listeners", []):
        unsub()
    domain_data.pop("shared", None)
    return True
