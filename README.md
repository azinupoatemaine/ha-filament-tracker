# Filament Tracker

A native Home Assistant integration for tracking backstock/refill 3D-printer filament
spools — a real, growable/deletable database (via HA's own `Store` helper, same as
built-in helpers use, under `.storage/`), plus a single bundled Lovelace card. **No
YAML, anywhere, ever** — install through HACS, add the integration through the normal
"Add Integration" UI, add the card by clicking it in the card picker. That's the whole
setup.

## Install (via HACS)

1. HACS → the ⋮ menu (top right) → **Custom repositories**.
2. Add this repo's URL, category **Integration**.
3. Search "Filament Tracker" in HACS → Install.
4. Restart Home Assistant.
5. Settings → Devices & Services → **Add Integration** → search "Filament Tracker" → Add.
   Nothing to fill in — it also registers the card as a Lovelace resource automatically.
6. Edit any dashboard → **Add Card** → search "Filament Tracker" → Add. Done.

If the card doesn't show up in the picker on your HA version, add it manually once:
Settings → Dashboards → ⋮ → Resources → Add Resource → URL
`/filament_tracker_frontend/filament-tracker-card.js`, type **JavaScript module**.

## Zero-config by design

Everything that would normally need a helper entity, a template sensor, or a
hand-written automation lives inside the integration or the card instead:

- **AMS trays / external spool** ("Loaded now" row) — the card scans your entity list
  for anything shaped like `sensor.<prefix>_ams_<unit>_tray_<slot>` (what
  [`ha-bambulab`](https://github.com/greghesp/ha-bambulab) creates) and reads it
  directly. No printer prefix to configure, no template sensors to install — if
  ha-bambulab isn't installed, this row just says nothing was found; everything else
  still works.
- **Manual AMS-slot mapping** ("this refill spool is physically loaded in slot N") —
  stored by the integration itself, edited via dropdowns right in the card. No
  `input_select` helpers.
- **Low-stock threshold** — a real settings screen: Settings → Devices & Services →
  Filament Tracker → **Configure**. Can also be overridden per-card from the card's own
  visual editor (Edit Card → no code needed).
- **Auto-deduct on print finish** — the integration watches every discovered printer's
  `current_stage` sensor itself and subtracts the finished print's `print_weight` from
  whichever spool is mapped, waiting 60s first to dodge the known race condition where
  Bambu sensors report stale values right at print-end. No automation YAML.

## What it gives you

- **`sensor.filament_spools_db`** — state is always `ok`; attributes:
  - `spools` — `{id, label, material, color_hex, weight_full, weight_remaining, status}[]`
  - `mappings` — `{"<slot>": spool_id}` — which spool is in which manually-mapped slot
  - `threshold` — the active low-stock threshold in grams
  - `total_remaining`, `low_stock_count`, `low_stock_labels`, `totals_by_material`
- **Services**: `filament_tracker.add_spool`, `delete_spool`, `update_spool`,
  `set_slot_mapping`
- **`custom:filament-tracker-card`** — the widget. Everything below is optional and
  also settable from the card's visual editor, so YAML is never required:

  | Option | Default | Meaning |
  | --- | --- | --- |
  | `language` | `auto` | `auto` follows Home Assistant's own language; `en` or `ro` pins it |
  | `low_stock_threshold` | from the integration | Amber-bar threshold, in grams |
  | `ams_spool_size` | `1000` | Assumed spool weight when a tray has no RFID `tray_weight`, used to turn the AMS's remaining-percentage into grams |
  | `show_title` | `true` | Title and subtitle |
  | `show_stats` | `true` | The "g total" / "low stock" pills |
  | `show_ams` | `true` | "Loaded now" AMS tray strip |
  | `show_loaded_manual` | `true` | "Loaded manually" strip |
  | `show_mapping` | `true` | Manual AMS mapping dropdowns |
  | `show_add` | `true` | Add-spool button and form |
  | `show_search` | `true` | Search, sort, and material filter chips |
  | `show_shelf` | `true` | The spool shelf itself |

  Every `show_*` option defaults to on, so an existing card keeps working untouched.
  Turn off what you already have elsewhere — the AMS tray strip in particular, if
  you're using the cards that come with the Bambu integration.

  The card ships in **English and Romanian** and follows your Home Assistant
  language by default. Adding a language means adding one block to `I18N` in the
  card JS and one entry to `LANGUAGES`; anything a translation is missing falls
  back to English string by string. Spool statuses and material names are data,
  not UI text — they're stored exactly as entered and only their labels translate.

## Card features

- Live AMS tray tiles, auto-discovered — adapts to however many units/trays you
  actually have, including multiple printers
- Manual mapping dropdowns for feeding non-RFID refill spools
- **Mapping a spool to a slot moves it off the shelf** into a small "Loaded manually"
  strip next to the real AMS trays — the shelf stays "what's in reserve," not "what
  exists." Unmap it (set the dropdown back to "None") and it returns to the shelf.
- Add-spool form (collapsed behind a button so the default view stays compact),
  with an optional "Bambu line + color" pair of dropdowns that auto-fills Material
  and the exact hex — 78 official colors across PLA Basic/Matte, PETG Basic/CF, ABS,
  and ASA, sourced from Bambu's own hex-code-table PDFs. Skip it and type your own
  for anything else (refills, third-party, discontinued colors).
- Click any spool tile — on the shelf or in the loaded strip — to open an inline
  editor: update remaining weight/status, or delete
- Search box, sort by material/name/amount, click a material chip to filter
- Collapsible material groups, ≤10 spools per shelf row with a wood-tone divider
- Low-stock spools get an amber bar automatically
- The `g total` pill counts the shelf **plus** what's loaded in the AMS, estimated
  per tray from its remaining percentage (exact for RFID spools, which report their
  own nominal weight). A hand-mapped slot is counted from its real database entry
  instead, never twice.
- Every section can be switched off individually from the visual editor, so the card
  can be trimmed down to just the parts you don't already have on the dashboard

## Data

Spools and mappings are stored via Home Assistant's storage helper, landing in
`.storage/filament_tracker_spools` inside your config directory. Plain JSON — back it
up like any other `.storage` file (Settings → System → Backups covers it as long as
the backup includes your full config directory).
