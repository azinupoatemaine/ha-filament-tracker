"""Config + options flow for Filament Tracker — single instance, all-visual setup."""
from __future__ import annotations

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import DEFAULT_LOW_STOCK_THRESHOLD, DOMAIN, OPT_LOW_STOCK_THRESHOLD


class FilamentTrackerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Filament Tracker."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None) -> FlowResult:
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title="Filament Tracker", data={})

        return self.async_show_form(step_id="user")

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> FilamentTrackerOptionsFlow:
        return FilamentTrackerOptionsFlow(config_entry)


class FilamentTrackerOptionsFlow(config_entries.OptionsFlow):
    """Visual settings — currently just the low-stock threshold."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self._config_entry = config_entry

    async def async_step_init(self, user_input: dict | None = None) -> FlowResult:
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current = self._config_entry.options.get(OPT_LOW_STOCK_THRESHOLD, DEFAULT_LOW_STOCK_THRESHOLD)
        schema = vol.Schema(
            {vol.Optional(OPT_LOW_STOCK_THRESHOLD, default=current): vol.Coerce(float)}
        )
        return self.async_show_form(step_id="init", data_schema=schema)
