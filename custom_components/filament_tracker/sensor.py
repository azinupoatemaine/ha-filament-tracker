"""The Filament Spools DB sensor: publishes all spools + computed aggregates."""
from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
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
    # Everything here is pushed via SIGNAL_SPOOLS_UPDATED; there is nothing to poll.
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry

    async def async_added_to_hass(self) -> None:
        self.async_on_remove(
            async_dispatcher_connect(self.hass, SIGNAL_SPOOLS_UPDATED, self._handle_update)
        )
        self._refresh()

    @callback
    def _handle_update(self) -> None:
        """Run inline on the event loop, not the executor pool.

        ``async_dispatcher_send`` routes through ``hass.async_run_hass_job``,
        which calls a ``HassJobType.Callback`` target directly and hands
        anything else off to be scheduled. An undecorated sync function is
        classified as ``HassJobType.Executor``, so without ``@callback`` this
        would be queued onto the executor thread pool and land some
        unpredictable time after the write it is meant to reflect — instead of
        running synchronously inside the service handler, before it returns.
        """
        self._refresh()
        self.async_write_ha_state()

    def _refresh(self) -> None:
        """Publish an immutable *snapshot* of the shared data, never the live objects.

        This is load-bearing, not defensive style. Home Assistant keeps the
        attributes mapping we hand it alive inside the ``State`` object
        (``State.__init__`` does ``ReadOnlyDict(attributes)``, which copies the
        top-level keys but keeps the *same* value objects), and it decides what
        changed by comparing the previous state's attributes against the new
        ones — by value, on those shared objects:

        * ``StateMachine.async_set_internal``:
          ``same_attr = old_state.attributes == attributes`` — and if both
          state and attributes look unchanged it returns early, firing no
          ``state_changed`` event at all.
        * ``websocket_api.messages._state_diff_event``, which is what feeds
          ``hass.states`` in every open browser tab:
          ``{key: value for key, value in new_attributes.items()
             if key not in old_attributes or old_attributes[key] != value}``.

        If we publish ``data["spools"]`` itself, both comparisons are made
        against the *same list object* the service handlers mutate in place.
        ``handle_add_spool`` appends to it, so by the time the comparison runs
        the previous state's attributes contain the new spool too, the lists
        compare equal, and the ``spools`` key is silently dropped from the
        WebSocket diff — the browser's copy keeps the old array while its
        ``last_updated`` still advances. That was exactly the long-standing
        "added spool only shows up after a full page reload" bug: the write was
        real, the REST read was correct, but the push that the frontend
        actually renders from never carried the new list.

        Delete looked fine only by accident — ``handle_delete_spool`` rebinds
        ``d["spools"]`` to a freshly built list instead of mutating, so the old
        and new objects genuinely differed and the diff carried the change.

        ``set_slot_mapping`` was worse still: it mutates ``mappings`` in place
        and no aggregate below depends on it, so *every* attribute compared
        equal and ``async_set_internal`` bailed out before firing anything.

        Copying here makes the previous state a real point-in-time record, so
        value comparison means what Home Assistant assumes it means.
        """
        data = self.hass.data[DOMAIN]["shared"]
        live_spools: list[dict] = data["spools"]
        live_mappings: dict = data.get("mappings", {})
        spools: list[dict] = [dict(s) for s in live_spools]
        mappings: dict = dict(live_mappings)
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
