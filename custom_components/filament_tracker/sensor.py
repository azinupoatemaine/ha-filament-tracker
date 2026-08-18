"""The Filament Spools DB sensor: publishes all spools + computed aggregates."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DEFAULT_LOW_STOCK_THRESHOLD, DOMAIN, OPT_LOW_STOCK_THRESHOLD, SIGNAL_SPOOLS_UPDATED


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback
) -> None:
    async_add_entities([FilamentSpoolsSensor(hass, entry)])


class FilamentSpoolsSensor(SensorEntity):
    """Aggregate view of every tracked spool, plus AMS-slot mappings."""

    _attr_name = "Filament Spools DB"
    _attr_icon = "mdi:database"
    _attr_unique_id = "filament_tracker_spools_db"

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_SPOOLS_UPDATED, self._handle_update)
        )
        self._refresh()

    def _handle_update(self) -> None:
        self._refresh()
        self.async_write_ha_state()

    def _refresh(self) -> None:
        data = self.hass.data[DOMAIN][self._entry.entry_id]
        spools: list[dict] = data["spools"]
        mappings: dict = data.get("mappings", {})
        threshold = self._threshold()

        total = 0.0
        low: list[str] = []
        by_material: dict[str, float] = {}
        for s in spools:
            if s.get("status") == "Empty":
                continue
            rem = float(s.get("weight_remaining", 0) or 0)
            total += rem
            mat = s.get("material") or "Altele"
            by_material[mat] = by_material.get(mat, 0) + rem
            if rem <= threshold:
                low.append(f"{s.get('label', 'Spool')} ({round(rem)}g)")

        self._attr_native_value = "ok"
        self._attr_extra_state_attributes = {
            "spools": spools,
            "mappings": mappings,
            "threshold": threshold,
            "total_remaining": round(total),
            "low_stock_count": len(low),
            "low_stock_labels": low,
            "totals_by_material": by_material,
        }

    def _threshold(self) -> float:
        return float(self._entry.options.get(OPT_LOW_STOCK_THRESHOLD, DEFAULT_LOW_STOCK_THRESHOLD))
