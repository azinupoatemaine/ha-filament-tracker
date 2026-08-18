# Filament Tracker

A native Home Assistant integration for tracking backstock/refill 3D-printer filament
spools — a real, growable/deletable database (via HA's own `Store` helper, same as
built-in helpers use, under `.storage/`), plus a single bundled Lovelace card that
renders the whole thing: live AMS trays, manual AMS-slot mapping, an add/delete spool
form, and a searchable, sortable, collapsible-by-material shelf. One card, no
hand-written dashboard YAML required.

## Install (via HACS)

1. HACS → the ⋮ menu (top right) → **Custom repositories**.
2. Add this repo's URL, category **Integration**.
3. Search "Filament Tracker" in HACS → Install.
4. Restart Home Assistant.
5. Settings → Devices & Services → **Add Integration** → search "Filament Tracker" → Add.
   (No configuration needed — it's a single-instance integration. This step also
   registers the card as a Lovelace resource automatically.)
6. Edit any dashboard → Add Card → search "Filament Tracker", or add directly in YAML:
   ```yaml
   - type: custom:filament-tracker-card
   ```

If the card doesn't show up in the picker on your HA version, add it manually once:
Settings → Dashboards → ⋮ → Resources → Add Resource → URL
`/filament_tracker_frontend/filament-tracker-card.js`, type **JavaScript module**.

## What it depends on

The integration and card work standalone with **zero dependencies** — add/delete/edit
spools, browse the shelf, nothing else required.

The **"Loaded now" row** (live AMS tray view) is optional and depends on
[`ha-bambulab`](https://github.com/greghesp/ha-bambulab) being installed and a small
set of template sensors (`sensor.ams_1_tray_1_live` … `sensor.external_spool_live`)
that normalize its raw per-tray entities — those sensors, plus an auto-deduct
automation for refill spools, live in the companion dashboard project, not in this
repo, since they're specific to your printer's exact entity IDs. Without them, that
row just says there's nothing loaded yet — everything else keeps working.

## What it gives you

- **`sensor.filament_spools_db`** — state is always `ok`; the real data lives in its
  attributes:
  - `spools` — the full list, each `{id, label, material, color_hex, weight_full, weight_remaining, status}`
  - `total_remaining` — sum of remaining weight across non-Empty spools
  - `low_stock_count` / `low_stock_labels` — spools at or under
    `input_number.filament_low_stock_threshold` (if that helper exists; defaults to 100g)
  - `totals_by_material` — `{material: grams}` dict
- **`filament_tracker.add_spool`** — fields: `label`, `material`, `color_hex`,
  `weight_full`, `weight_remaining`, `status`
- **`filament_tracker.delete_spool`** — field: `id`
- **`filament_tracker.update_spool`** — fields: `id`, `weight_remaining`, `status`
- **`custom:filament-tracker-card`** — the Lovelace card. Optional config:
  `low_stock_threshold: <number>` to override the threshold without an
  `input_number` helper.

It also keeps `input_select.ams_manual_slot_1_mapping` .. `_4_mapping` (if those
entities exist) in sync with your current spool labels every time the list changes —
that's the dropdown used to say "this refill spool is the one physically loaded in
AMS slot N" for auto-deduct automations.

## Card features

- Live AMS tray tiles + manual mapping dropdowns, right in the card
- Add-spool form (collapsed behind a button so the default view stays compact)
- Click any spool tile to open an inline editor — update remaining weight/status, or
  delete — no Developer Tools digging
- Search box, sort by material/name/amount, click a material chip to filter
- Collapsible material groups, ≤10 spools per shelf row with a wood-tone divider
- Low-stock spools get an amber bar automatically

## Data

Spools are stored via Home Assistant's storage helper, which lands in
`.storage/filament_tracker_spools` inside your config directory. It's plain JSON —
back it up like any other `.storage` file (Settings → System → Backups covers it as
long as the backup includes your full config directory).
