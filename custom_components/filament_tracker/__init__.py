"""Filament Tracker: a small native database of backstock/refill filament spools."""
from __future__ import annotations

import asyncio
import logging
import pathlib
import re

import voluptuous as vol
from aiohttp import web

from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_call_later, async_track_state_change_event
from homeassistant.helpers.storage import Store

from .const import (
    AMS_TRAY_RE,
    CARD_FILENAME,
    CARD_URL_PATH,
    CARD_VERSION,
    CURRENT_STAGE_SUFFIX,
    DEFAULT_LOW_STOCK_THRESHOLD,
    DOMAIN,
    OPT_LOW_STOCK_THRESHOLD,
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
                "Content-Type": "application/javascript; charset=utf-8",
                # Deliberately not a long-lived cache: the ?v= cache buster
                # handles versioning, and a stale month-long cached copy is
                # impossible to clear from the user's side.
                "Cache-Control": "public, max-age=0, must-revalidate",
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
            "Filament Tracker: serving %s from %s as application/javascript",
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
    """One spools/mappings/store per Home Assistant instance, never per entry.

    Every service handler and the sensor entity used to reach into
    ``hass.data[DOMAIN][entry.entry_id]`` — fine with exactly one config
    entry, but if a second one was ever created (e.g. during earlier setup
    trouble before this integration enforced single-instance), each entry
    got its own separate in-memory spools list. Whichever entry's
    ``async_setup_entry`` ran last "won" the global service registration, so
    writes could land in an entry's data that the sensor entity — still
    bound to a *different* entry — never read from. The write would succeed,
    disk would even get the new data, and the card would still show nothing
    until an HA restart happened to reload storage into the entry that
    "won" that time. Keying this off the domain instead of the entry makes
    that whole class of bug impossible regardless of how many entries exist.

    Guarded by a lock: two entries' async_setup_entry calls can genuinely
    interleave at the ``await store.async_load()`` below (this is a coroutine,
    not an atomic block), and without the lock both could independently
    decide "shared" doesn't exist yet and each build their own copy — the
    second one to finish would silently orphan the first, which is exactly
    the class of bug this function exists to rule out.
    """
    domain_data = hass.data.setdefault(DOMAIN, {})
    lock: asyncio.Lock = domain_data.setdefault("_setup_lock", asyncio.Lock())
    async with lock:
        if "shared" not in domain_data:
            store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
            loaded = _migrate_storage(await store.async_load())
            domain_data["shared"] = {
                "store": store,
                "spools": loaded["spools"],
                "mappings": loaded["mappings"],
            }
        return domain_data["shared"]


async def _claim_ownership(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Atomically decide whether this entry is the one that wires everything up.

    Uses the same lock as ``_get_shared_data`` so the whole "does an owner
    exist yet" check-and-set is one atomic step — without it, two entries
    could both read ``_owner_entry_id`` as unset before either writes it
    (the check and the eventual forward-to-platforms in between both
    involve an ``await``, so they can genuinely interleave).
    """
    domain_data = hass.data.setdefault(DOMAIN, {})
    lock: asyncio.Lock = domain_data.setdefault("_setup_lock", asyncio.Lock())
    async with lock:
        owner = domain_data.get("_owner_entry_id")
        if owner in (None, entry.entry_id):
            domain_data["_owner_entry_id"] = entry.entry_id
            return True
        return False


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Filament Tracker from a config entry."""
    await _async_register_frontend(hass)

    shared = await _get_shared_data(hass)
    domain_data = hass.data[DOMAIN]

    if not await _claim_ownership(hass, entry):
        # A second config entry (a stray leftover from before single-instance
        # was enforced, most likely) is setting up too. Don't forward it to
        # the sensor platform — a second FilamentSpoolsSensor with the same
        # unique_id would fight the first one over sensor.filament_spools_db,
        # and whichever one Home Assistant decided "owns" that entity_id
        # could silently flip across restarts. Data itself is still safe
        # (both entries share the same `shared` dict above either way).
        _LOGGER.warning(
            "Filament Tracker: a second config entry is set up — skipping it. This "
            "integration only needs one; go to Settings > Devices & Services and "
            "remove the duplicate Filament Tracker entry to keep things tidy."
        )
        return True

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    domain_data["unsub_listeners"] = []

    def _threshold() -> float:
        return float(entry.options.get(OPT_LOW_STOCK_THRESHOLD, DEFAULT_LOW_STOCK_THRESHOLD))

    async def _save_and_refresh(label: str) -> None:
        d = shared
        await d["store"].async_save({"spools": d["spools"], "mappings": d["mappings"]})
        # Runs the sensor's @callback handler synchronously, so the new entity
        # state is written (and its state_changed event queued to every open
        # browser) before the service call returns to the caller.
        async_dispatcher_send(hass, SIGNAL_SPOOLS_UPDATED)
        _LOGGER.debug("Filament Tracker: %s saved and dispatched", label)

    async def handle_add_spool(call: ServiceCall) -> None:
        d = shared
        spools = d["spools"]
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
        await _save_and_refresh("add_spool")

    async def handle_delete_spool(call: ServiceCall) -> None:
        d = shared
        d["spools"] = [s for s in d["spools"] if s["id"] != call.data["id"]]
        d["mappings"] = {
            slot: sid for slot, sid in d["mappings"].items() if sid != call.data["id"]
        }
        await _save_and_refresh("delete_spool")

    async def handle_update_spool(call: ServiceCall) -> None:
        d = shared
        for s in d["spools"]:
            if s["id"] == call.data["id"]:
                if "weight_remaining" in call.data:
                    s["weight_remaining"] = max(0.0, call.data["weight_remaining"])
                if "status" in call.data:
                    s["status"] = call.data["status"]
        await _save_and_refresh("update_spool")

    async def handle_set_slot_mapping(call: ServiceCall) -> None:
        d = shared
        slot = str(call.data["slot"])
        spool_id = call.data.get("spool_id")
        if spool_id is None:
            d["mappings"].pop(slot, None)
        else:
            d["mappings"][slot] = spool_id
        await _save_and_refresh("set_slot_mapping")

    hass.services.async_register(DOMAIN, SERVICE_ADD_SPOOL, handle_add_spool, schema=ADD_SPOOL_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DELETE_SPOOL, handle_delete_spool, schema=DELETE_SPOOL_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE_SPOOL, handle_update_spool, schema=UPDATE_SPOOL_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_SET_SLOT_MAPPING, handle_set_slot_mapping, schema=SET_SLOT_MAPPING_SCHEMA
    )

    # ---- Auto-deduct: watches every discovered printer's current_stage, no YAML. ----
    async def _apply_consumption(prefix: str) -> None:
        d = shared
        mapped = {slot: sid for slot, sid in d["mappings"].items() if sid is not None}
        if len(mapped) != 1:
            return  # ambiguous (0 or >1 manual spool loaded) — update by hand
        spool_id = next(iter(mapped.values()))
        spool = next((s for s in d["spools"] if s["id"] == spool_id), None)
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
        await _save_and_refresh("auto_deduct")
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

    for prefix in discover_printer_prefixes(hass):
        entity_id = f"sensor.{prefix}{CURRENT_STAGE_SUFFIX}"
        unsub = async_track_state_change_event(hass, [entity_id], _make_stage_listener(prefix))
        domain_data["unsub_listeners"].append(unsub)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Options changed (e.g. low-stock threshold) — push a refresh."""
    async_dispatcher_send(hass, SIGNAL_SPOOLS_UPDATED)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if not unload_ok:
        return False

    domain_data = hass.data.get(DOMAIN, {})
    if domain_data.get("_owner_entry_id") != entry.entry_id:
        # A non-owner duplicate entry being removed — services and listeners
        # belong to whichever entry registered them, not to this one.
        return True

    for unsub in domain_data.get("unsub_listeners", []):
        unsub()
    for service in (
        SERVICE_ADD_SPOOL,
        SERVICE_DELETE_SPOOL,
        SERVICE_UPDATE_SPOOL,
        SERVICE_SET_SLOT_MAPPING,
    ):
        hass.services.async_remove(DOMAIN, service)
    domain_data.pop("_owner_entry_id", None)
    domain_data.pop("unsub_listeners", None)
    return True
