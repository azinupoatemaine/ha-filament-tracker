"""Filament Tracker: a small native database of backstock/refill filament spools."""
from __future__ import annotations

import logging
import pathlib
import re

import voluptuous as vol

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


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and register it as a Lovelace resource, once."""
    if hass.data.get(DOMAIN, {}).get("_frontend_registered"):
        return

    www_dir = pathlib.Path(__file__).parent / "www"

    try:
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL_PATH, str(www_dir), True)]
        )
    except ImportError:
        hass.http.register_static_path(CARD_URL_PATH, str(www_dir), cache_headers=True)

    from homeassistant.components.frontend import add_extra_js_url

    add_extra_js_url(hass, f"{CARD_URL_PATH}/{CARD_FILENAME}?v={CARD_VERSION}")

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["_frontend_registered"] = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Filament Tracker from a config entry."""
    await _async_register_frontend(hass)

    store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    data = _migrate_storage(await store.async_load())

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {
        "store": store,
        "spools": data["spools"],
        "mappings": data["mappings"],
        "unsub_listeners": [],
    }

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    def _threshold() -> float:
        return float(entry.options.get(OPT_LOW_STOCK_THRESHOLD, DEFAULT_LOW_STOCK_THRESHOLD))

    async def _save_and_refresh() -> None:
        d = hass.data[DOMAIN][entry.entry_id]
        await d["store"].async_save({"spools": d["spools"], "mappings": d["mappings"]})
        async_dispatcher_send(hass, SIGNAL_SPOOLS_UPDATED)

    async def handle_add_spool(call: ServiceCall) -> None:
        d = hass.data[DOMAIN][entry.entry_id]
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
        await _save_and_refresh()

    async def handle_delete_spool(call: ServiceCall) -> None:
        d = hass.data[DOMAIN][entry.entry_id]
        d["spools"] = [s for s in d["spools"] if s["id"] != call.data["id"]]
        d["mappings"] = {
            slot: sid for slot, sid in d["mappings"].items() if sid != call.data["id"]
        }
        await _save_and_refresh()

    async def handle_update_spool(call: ServiceCall) -> None:
        d = hass.data[DOMAIN][entry.entry_id]
        for s in d["spools"]:
            if s["id"] == call.data["id"]:
                if "weight_remaining" in call.data:
                    s["weight_remaining"] = max(0.0, call.data["weight_remaining"])
                if "status" in call.data:
                    s["status"] = call.data["status"]
        await _save_and_refresh()

    async def handle_set_slot_mapping(call: ServiceCall) -> None:
        d = hass.data[DOMAIN][entry.entry_id]
        slot = str(call.data["slot"])
        spool_id = call.data.get("spool_id")
        if spool_id is None:
            d["mappings"].pop(slot, None)
        else:
            d["mappings"][slot] = spool_id
        await _save_and_refresh()

    hass.services.async_register(DOMAIN, SERVICE_ADD_SPOOL, handle_add_spool, schema=ADD_SPOOL_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_DELETE_SPOOL, handle_delete_spool, schema=DELETE_SPOOL_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_UPDATE_SPOOL, handle_update_spool, schema=UPDATE_SPOOL_SCHEMA)
    hass.services.async_register(
        DOMAIN, SERVICE_SET_SLOT_MAPPING, handle_set_slot_mapping, schema=SET_SLOT_MAPPING_SCHEMA
    )

    # ---- Auto-deduct: watches every discovered printer's current_stage, no YAML. ----
    async def _apply_consumption(prefix: str) -> None:
        d = hass.data[DOMAIN][entry.entry_id]
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
        await _save_and_refresh()
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
        hass.data[DOMAIN][entry.entry_id]["unsub_listeners"].append(unsub)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Options changed (e.g. low-stock threshold) — push a refresh."""
    async_dispatcher_send(hass, SIGNAL_SPOOLS_UPDATED)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        for unsub in hass.data[DOMAIN][entry.entry_id].get("unsub_listeners", []):
            unsub()
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
