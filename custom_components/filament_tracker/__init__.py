"""Filament Tracker: a small native database of backstock/refill filament spools."""
from __future__ import annotations

import logging
import pathlib

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import Store

from .const import (
    AMS_MAPPING_ENTITIES,
    CARD_FILENAME,
    CARD_URL_PATH,
    CARD_VERSION,
    DOMAIN,
    NONE_OPTION,
    SERVICE_ADD_SPOOL,
    SERVICE_DELETE_SPOOL,
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


async def _async_register_frontend(hass: HomeAssistant) -> None:
    """Serve the card JS and register it as a Lovelace resource, once."""
    if hass.data.get(DOMAIN, {}).get("_frontend_registered"):
        return

    www_dir = pathlib.Path(__file__).parent / "www"

    try:
        # HA 2024.7+
        from homeassistant.components.http import StaticPathConfig

        await hass.http.async_register_static_paths(
            [StaticPathConfig(CARD_URL_PATH, str(www_dir), True)]
        )
    except ImportError:
        # Older HA versions.
        hass.http.register_static_path(CARD_URL_PATH, str(www_dir), cache_headers=True)

    from homeassistant.components.frontend import add_extra_js_url

    add_extra_js_url(hass, f"{CARD_URL_PATH}/{CARD_FILENAME}?v={CARD_VERSION}")

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN]["_frontend_registered"] = True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Filament Tracker from a config entry."""
    await _async_register_frontend(hass)

    store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    spools = await store.async_load() or []

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {"store": store, "spools": spools}

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    async def _save_and_refresh() -> None:
        data = hass.data[DOMAIN][entry.entry_id]
        await data["store"].async_save(data["spools"])
        async_dispatcher_send(hass, SIGNAL_SPOOLS_UPDATED)
        await _sync_mapping_options(data["spools"])

    async def _sync_mapping_options(spools: list[dict]) -> None:
        options = [NONE_OPTION] + [
            s.get("label") or f"Spool {s.get('id')}" for s in spools
        ]
        for entity_id in AMS_MAPPING_ENTITIES:
            current_state = hass.states.get(entity_id)
            if current_state is None:
                continue
            current = current_state.state
            await hass.services.async_call(
                "input_select",
                "set_options",
                {"entity_id": entity_id, "options": options},
                blocking=True,
            )
            if current in options:
                await hass.services.async_call(
                    "input_select",
                    "select_option",
                    {"entity_id": entity_id, "option": current},
                    blocking=True,
                )

    async def handle_add_spool(call: ServiceCall) -> None:
        data = hass.data[DOMAIN][entry.entry_id]
        spools = data["spools"]
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
        data = hass.data[DOMAIN][entry.entry_id]
        data["spools"] = [s for s in data["spools"] if s["id"] != call.data["id"]]
        await _save_and_refresh()

    async def handle_update_spool(call: ServiceCall) -> None:
        data = hass.data[DOMAIN][entry.entry_id]
        for s in data["spools"]:
            if s["id"] == call.data["id"]:
                if "weight_remaining" in call.data:
                    s["weight_remaining"] = max(0.0, call.data["weight_remaining"])
                if "status" in call.data:
                    s["status"] = call.data["status"]
        await _save_and_refresh()

    hass.services.async_register(
        DOMAIN, SERVICE_ADD_SPOOL, handle_add_spool, schema=ADD_SPOOL_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_DELETE_SPOOL, handle_delete_spool, schema=DELETE_SPOOL_SCHEMA
    )
    hass.services.async_register(
        DOMAIN, SERVICE_UPDATE_SPOOL, handle_update_spool, schema=UPDATE_SPOOL_SCHEMA
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
