/* Filament Tracker Card — a single self-contained Lovelace card:
 * live AMS trays, manual AMS-slot mapping, add/delete spools, and the
 * material shelf, all in one widget. No build step: plain Web Component. */

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

// ---------------------------------------------------------------------------
// Translations. English is the fallback for any key a language is missing, so
// an incomplete translation degrades one string at a time instead of breaking
// the card. Spool status values ("Sealed"/"Opened"/"Empty") and material names
// are *data*, not UI text — they stay exactly as the backend stores them, and
// only their on-screen labels get translated.
// ---------------------------------------------------------------------------
const I18N = {
  en: {
    title: "Filament Stock",
    subtitle_tracked: "{n} spools tracked",
    not_configured: "Filament Tracker not set up yet",
    stat_total: "g total",
    stat_low: "low stock",
    stat_ams: "g in AMS",
    tip_breakdown: "{stock} g in stock + {ams} g in AMS (estimated from remaining percentage)",
    tip_stock_only: "Filament in stock",
    tip_ams: "Estimated from the remaining percentage the AMS reports",
    tip_low: "Stock spools below the threshold — AMS not included",
    sec_loaded_now: "Loaded now",
    sec_loaded_manual: "Loaded manually (from stock)",
    sec_mapping: "Manual AMS mapping",
    no_ams: "No AMS sensor found — install ha-bambulab if you have a Bambu printer connected.",
    tray_empty: "Empty",
    map_none: "— None / RFID auto —",
    slot_n: "Slot {n}",
    manual_tile_tip: "Click to edit or unmap",
    add_spool: "Add spool",
    bambu_color: "Bambu color (optional)",
    choose_line: "— choose line —",
    type_or_choose: "type or choose…",
    f_label: "Label",
    f_material: "Material",
    f_color: "Color (hex)",
    f_full: "Total weight (g)",
    f_remaining: "Remaining weight (g)",
    f_status: "Status",
    st_sealed: "Sealed",
    st_opened: "Opened",
    st_empty: "Empty",
    cancel: "Cancel",
    add: "Add",
    adding: "Adding…",
    save: "Save",
    delete: "Delete",
    confirm_delete: "Delete this spool?",
    confirm_discard_pending: "This spool hasn't been confirmed yet. Discard it?",
    unconfirmed_suffix: " (unconfirmed)",
    saving_suffix: "saving…",
    search_ph: "Search by name or color…",
    sort_material: "Sort: Material",
    sort_name: "Sort: Name",
    sort_amount: "Sort: Amount",
    empty_not_configured: "Filament Tracker isn't set up — add the integration and restart HA.",
    empty_all_loaded: 'All spools are loaded right now — see "Loaded manually" above.',
    empty_none: "No spools yet — add one above.",
    empty_filter: "No spool matches the filter.",
    group_meta: "{n} spools · {g}g",
    ed_what: "What to show",
    ed_hint_sections:
      "Uncheck whatever you don't need — the AMS trays, for instance, if you already have them on another card.",
    ed_settings: "Settings",
    ed_language: "Language",
    ed_lang_auto: "Automatic (Home Assistant language)",
    ed_threshold: "Low-stock threshold (g) — optional",
    ed_threshold_ph: "use the integration's threshold",
    ed_threshold_hint:
      "Leave empty to use the threshold from Settings → Devices & Services → Filament Tracker → Configure.",
    ed_ams_size: "AMS spool weight (g) — optional",
    ed_ams_hint:
      "Used to estimate how many grams are in the AMS, starting from the remaining percentage. Bambu RFID spools report their own weight; this applies only to the rest.",
    sec_opt_title: "Title and subtitle",
    sec_opt_stats: "Stats (g total, low stock)",
    sec_opt_ams: "Loaded now (AMS trays)",
    sec_opt_manual: "Loaded manually (from stock)",
    sec_opt_mapping: "Manual AMS mapping",
    sec_opt_add: '"Add spool" button and form',
    sec_opt_search: "Search, sort, and material filters",
    sec_opt_shelf: "The spool shelf",
  },
  ro: {
    title: "Filament Stock",
    subtitle_tracked: "{n} bobine urmărite",
    not_configured: "Filament Tracker neconfigurat încă",
    stat_total: "g total",
    stat_low: "stoc redus",
    stat_ams: "g în AMS",
    tip_breakdown: "{stock} g în rezervă + {ams} g în AMS (estimat din procentul rămas)",
    tip_stock_only: "Filament în rezervă",
    tip_ams: "Estimat din procentul rămas raportat de AMS",
    tip_low: "Bobine din rezervă sub prag — nu include AMS",
    sec_loaded_now: "Încărcat acum",
    sec_loaded_manual: "Încărcat manual (din rezervă)",
    sec_mapping: "Mapare manuală AMS",
    no_ams: "Niciun senzor AMS găsit — instalează ha-bambulab dacă ai o imprimantă Bambu conectată.",
    tray_empty: "Gol",
    map_none: "— Niciuna / RFID auto —",
    slot_n: "Slot {n}",
    manual_tile_tip: "Apasă pentru a edita sau demapa",
    add_spool: "Adaugă bobină",
    bambu_color: "Culoare Bambu (opțional)",
    choose_line: "— alege linia —",
    type_or_choose: "tastează sau alege...",
    f_label: "Etichetă",
    f_material: "Material",
    f_color: "Culoare (hex)",
    f_full: "Greutate totală (g)",
    f_remaining: "Greutate rămasă (g)",
    f_status: "Stare",
    st_sealed: "Sigilată",
    st_opened: "Deschisă",
    st_empty: "Goală",
    cancel: "Anulează",
    add: "Adaugă",
    adding: "Se adaugă…",
    save: "Salvează",
    delete: "Șterge",
    confirm_delete: "Ștergi această bobină?",
    confirm_discard_pending: "Nu s-a confirmat încă adăugarea. Renunți la această bobină?",
    unconfirmed_suffix: " (neconfirmat)",
    saving_suffix: "se salvează…",
    search_ph: "Caută după nume sau culoare…",
    sort_material: "Sortează: Material",
    sort_name: "Sortează: Nume",
    sort_amount: "Sortează: Cantitate",
    empty_not_configured: "Filament Tracker nu este configurat — adaugă integrarea și restart HA.",
    empty_all_loaded: "Toate bobinele sunt încărcate acum — vezi „Încărcat manual” mai sus.",
    empty_none: "Nicio bobină încă — adaugă una mai sus.",
    empty_filter: "Nicio bobină nu corespunde filtrului.",
    group_meta: "{n} bobine · {g}g",
    ed_what: "Ce se afișează",
    ed_hint_sections:
      "Debifează ce nu-ți trebuie — de exemplu tăvile AMS, dacă le ai deja pe alt card.",
    ed_settings: "Setări",
    ed_language: "Limbă",
    ed_lang_auto: "Automat (limba Home Assistant)",
    ed_threshold: "Prag stoc redus (g) — opțional",
    ed_threshold_ph: "folosește pragul din integrare",
    ed_threshold_hint:
      "Lasă gol ca să folosești pragul din Settings → Devices & Services → Filament Tracker → Configure.",
    ed_ams_size: "Greutate bobină AMS (g) — opțional",
    ed_ams_hint:
      "Folosită ca să estimezi câte grame sunt în AMS, pornind de la procentul rămas. Bobinele Bambu cu RFID își raportează singure greutatea; asta se aplică doar celorlalte.",
    sec_opt_title: "Titlu și subtitlu",
    sec_opt_stats: "Statistici (g total, stoc redus)",
    sec_opt_ams: "Încărcat acum (tăvile AMS)",
    sec_opt_manual: "Încărcat manual (din rezervă)",
    sec_opt_mapping: "Mapare manuală AMS",
    sec_opt_add: "Buton și formular „Adaugă bobină”",
    sec_opt_search: "Căutare, sortare și filtre pe material",
    sec_opt_shelf: "Raftul cu bobine",
  },
};

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ro", label: "Română" },
];

// Status values are stored verbatim by the backend; these are display labels
// only. Anything unrecognised (older data, a hand-edited store) shows as-is.
const STATUS_KEYS = { Sealed: "st_sealed", Opened: "st_opened", Empty: "st_empty" };

// The option *values* stay English because that's what gets written to the
// backend and compared against; only the visible labels are translated.
function statusOptions(card) {
  return Object.keys(STATUS_KEYS)
    .map((v) => `<option value="${v}">${esc(card._statusLabel(v))}</option>`)
    .join("");
}

// "auto" (the default) follows Home Assistant's own language, so the card
// matches the rest of the UI without anyone having to configure it.
function ftLang(config, hass) {
  const chosen = config && config.language;
  if (chosen && chosen !== "auto" && I18N[chosen]) return chosen;
  const haLang = (hass && (hass.language || (hass.locale && hass.locale.language))) || "en";
  const short = String(haLang).slice(0, 2).toLowerCase();
  return I18N[short] ? short : "en";
}

function ftT(config, hass, key, vars) {
  const dict = I18N[ftLang(config, hass)] || I18N.en;
  let out = dict[key] != null ? dict[key] : I18N.en[key];
  if (out == null) return key;
  if (vars) {
    for (const name of Object.keys(vars)) out = out.split(`{${name}}`).join(vars[name]);
  }
  return out;
}

// Official Bambu Lab hex codes, pulled from their own filament hex-code-table
// PDFs (store.bblcdn.com). Not exhaustive forever — Bambu adds colors over
// time — but covers the common lines. Only used to pre-fill the Material/
// Culoare fields in the add form; both stay freely editable either way, and
// this has no effect on non-Bambu spools.
const BAMBU_COLORS = {
  "PLA Basic": {
    "Jade White": "#FFFFFF", "Black": "#000000", "Red": "#C12E1F", "Blue": "#0A2989",
    "Gray": "#8E9089", "Bambu Green": "#00AE42", "Mistletoe Green": "#3F8E43", "Cyan": "#0086D6",
    "Sunflower Yellow": "#FEC600", "Indigo Purple": "#482960", "Cocoa Brown": "#6F5034",
    "Hot Pink": "#F5547C", "Pumpkin Orange": "#FF9016", "Magenta": "#EC008C", "Gold": "#E4BD68",
    "Purple": "#5E43B7", "Beige": "#F7E6DE", "Pink": "#F55A74", "Bronze": "#847D48",
    "Turquoise": "#00B1B7", "Light Gray": "#D1D3D5", "Yellow": "#F4EE2A", "Blue Grey": "#5B6579",
    "Silver": "#A6A9AA", "Orange": "#FF6A13", "Bright Green": "#BECF00", "Brown": "#9D432C",
    "Dark Gray": "#545454", "Maroon Red": "#9D2235", "Cobalt Blue": "#0056B8",
  },
  "PLA Matte": {
    "Ivory White": "#FFFFFF", "Desert Tan": "#E8DBB7", "Lilac Purple": "#AE96D4",
    "Mandarin Orange": "#F99963", "Scarlet Red": "#DE4343", "Grass Green": "#61C680",
    "Marine Blue": "#0078BF", "Lemon Yellow": "#F7D959", "Charcoal": "#000000", "Ash Gray": "#9B9EA0",
  },
  "PETG Basic": {
    "Red": "#D6001C", "Yellow": "#FCE300", "Reflex Blue": "#001489", "Black": "#000000",
    "Gray": "#7F7E83", "Dark Brown": "#4F2C1D", "White": "#FFFFFF", "Orange": "#FF671F",
    "Navy Blue": "#0086D6", "Misty Blue": "#688197", "Green": "#009639", "Pine Green": "#034638",
    "Dark Beige": "#DBC8B6",
  },
  "PETG-CF": {
    "Brick Red": "#9F332A", "Violet Purple": "#583061", "Indigo Blue": "#324585",
    "Malachite Green": "#16B08E", "Black": "#000000", "Titan Gray": "#565656",
  },
  "ABS": {
    "White": "#FFFFFF", "Bambu Green": "#00AE42", "Olive": "#789D4A", "Azure": "#489FDF",
    "Navy Blue": "#0C2340", "Blue": "#0A2CA5", "Tangerine Yellow": "#FFC72C", "Orange": "#FF6A13",
    "Red": "#D32941", "Purple": "#AF1685", "Silver": "#87909A", "Black": "#000000",
    "Desert Tan": "#E8DBB7",
  },
  "ASA": {
    "White": "#FFFAF2", "Gray": "#8A949E", "Red": "#E02928", "Green": "#00A6A0",
    "Blue": "#2140B4", "Black": "#000000",
  },
};

// Every togglable section of the card, in the order they appear. Drives both
// the visual editor's checkbox list and nothing else — the card itself reads
// the keys directly — so adding a section here is all it takes to expose it.
const CARD_SECTIONS = [
  { key: "show_title", label: "sec_opt_title" },
  { key: "show_stats", label: "sec_opt_stats" },
  { key: "show_ams", label: "sec_opt_ams" },
  { key: "show_loaded_manual", label: "sec_opt_manual" },
  { key: "show_mapping", label: "sec_opt_mapping" },
  { key: "show_add", label: "sec_opt_add" },
  { key: "show_search", label: "sec_opt_search" },
  { key: "show_shelf", label: "sec_opt_shelf" },
];

const CARD_CSS = `
  :host {
    --ft-accent: #1F7A4D;
    --ft-accent-ink: #EAF6EE;
    --ft-warn: #C97A15;
    --ft-warn-ink: #FCEEDB;
    --ft-wood: #8A6A45;
    --ft-track: var(--secondary-background-color, #e7e4d8);
    --ft-border: var(--divider-color, #dedacb);
    --ft-ink: var(--primary-text-color, #1b1f1c);
    --ft-ink-2: var(--secondary-text-color, #6b6f68);
    --ft-ink-3: var(--disabled-text-color, #9a9d97);
    --ft-surface: var(--ha-card-background, var(--card-background-color, #fff));
    --ft-radius: 16px;
    display: block;
  }
  ha-card {
    padding: 18px 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    overflow: visible;
  }
  * { box-sizing: border-box; }
  .row { display: flex; align-items: center; }
  .grow { flex: 1 1 auto; min-width: 0; }

  /* Header */
  .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .title-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .title { font-size: 19px; font-weight: 700; letter-spacing: -0.01em; color: var(--ft-ink); display: flex; align-items: center; gap: 8px; }
  .title ha-icon { color: var(--ft-accent); --mdc-icon-size: 22px; }
  .subtitle { font-size: 12.5px; color: var(--ft-ink-2); }
  .stats { display: flex; gap: 8px; flex-wrap: wrap; }
  .stat-pill {
    display: flex; align-items: baseline; gap: 6px;
    background: var(--ft-track); border-radius: 999px; padding: 6px 12px;
    font-variant-numeric: tabular-nums;
  }
  .stat-pill .n { font-size: 15px; font-weight: 700; color: var(--ft-ink); }
  .stat-pill .l { font-size: 11px; color: var(--ft-ink-2); }
  .stat-pill.warn { background: var(--ft-warn-ink); }
  .stat-pill.warn .n { color: var(--ft-warn); }

  /* Section labels */
  .section-label {
    font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--ft-ink-3); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;
  }

  /* Loaded now */
  .tray-rack { display: flex; gap: 12px; flex-wrap: wrap; }
  .tray-tile { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 62px; }
  .tray-tile .slot-label { font-size: 9px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ft-ink-3); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .tray-tile .mat { font-size: 10.5px; color: var(--ft-ink-2); text-align: center; max-width: 62px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .square { border-radius: 26%; border: 1.5px solid var(--ft-border); box-shadow: 0 1px 2px rgba(0,0,0,0.12); flex: none; }
  .bar { height: 5px; border-radius: 3px; background: var(--ft-track); overflow: hidden; flex: none; }
  .bar > i { display: block; height: 100%; border-radius: 3px; }

  /* Mapping */
  .mapping-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .mapping-item { display: flex; flex-direction: column; gap: 3px; }
  .mapping-item label { font-size: 10px; color: var(--ft-ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  select, input[type="text"], input[type="number"] {
    font: inherit; color: var(--ft-ink); background: var(--ft-track);
    border: 1px solid var(--ft-border); border-radius: 9px; padding: 7px 9px; font-size: 13px;
  }
  select { cursor: pointer; }

  /* Add form */
  .add-toggle {
    display: inline-flex; align-items: center; gap: 6px; align-self: flex-start;
    background: var(--ft-accent); color: white; border: none; border-radius: 999px;
    padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .add-toggle ha-icon { --mdc-icon-size: 17px; }
  .add-form {
    border: 1px solid var(--ft-border); border-radius: var(--ft-radius); padding: 14px;
    display: flex; flex-direction: column; gap: 10px; background: var(--ft-track);
  }
  .add-form .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
  .add-form .field { display: flex; flex-direction: column; gap: 3px; }
  .add-form .field label { font-size: 10px; color: var(--ft-ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  .add-form .actions { display: flex; justify-content: flex-end; gap: 8px; }
  .btn {
    border: none; border-radius: 9px; padding: 8px 14px; font-size: 13px; font-weight: 600; cursor: pointer;
  }
  .btn.primary { background: var(--ft-accent); color: white; }
  .btn.ghost { background: transparent; color: var(--ft-ink-2); }
  .btn.danger { background: transparent; color: #c0392b; }

  /* Toolbar */
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .toolbar input[type="text"] { flex: 1 1 160px; }
  .chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    font-size: 11.5px; padding: 5px 11px; border-radius: 999px; border: 1px solid var(--ft-border);
    background: var(--ft-surface); color: var(--ft-ink-2); cursor: pointer;
  }
  .chip.active { background: var(--ft-accent); color: white; border-color: var(--ft-accent); }

  /* Shelf */
  .empty-msg { color: var(--ft-ink-2); font-size: 13px; padding: 20px; text-align: center; }
  .material-group { border: 1px solid var(--ft-border); border-radius: var(--ft-radius); overflow: hidden; }
  .material-header {
    display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;
    cursor: pointer; user-select: none; background: var(--ft-surface);
  }
  .material-header .name { font-size: 14px; font-weight: 700; display: flex; align-items: center; gap: 6px; }
  .material-header .meta { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; color: var(--ft-ink-2); }
  .material-header ha-icon { --mdc-icon-size: 18px; color: var(--ft-ink-3); transition: transform 0.15s ease; }
  .material-group.collapsed .material-header ha-icon { transform: rotate(-90deg); }
  .material-group.collapsed .shelf-row { display: none; }
  .shelf-row {
    display: flex; flex-wrap: wrap; align-items: flex-end; gap: 14px;
    padding: 12px 14px 18px; border-top: 3px solid var(--ft-wood);
    box-shadow: 0 6px 8px -7px rgba(20,14,4,0.35);
  }
  .spool-slot { display: flex; flex-direction: column; align-items: center; gap: 5px; width: 68px; position: relative; cursor: pointer; }
  .spool-slot .del {
    position: absolute; top: -6px; right: 4px; width: 16px; height: 16px; border-radius: 50%;
    background: var(--ft-surface); border: 1px solid var(--ft-border); display: flex; align-items: center;
    justify-content: center; font-size: 9px; color: var(--ft-ink-2); z-index: 2;
  }
  .spool-slot .cap { font-size: 10.5px; color: var(--ft-ink-2); text-align: center; line-height: 1.2; max-width: 68px; height: 2.4em; overflow: hidden; }
  .spool-slot.pending { opacity: .55; cursor: pointer; animation: ft-pending-pulse 1.1s ease-in-out infinite; }
  .spool-slot.pending .del { display: none; }
  @keyframes ft-pending-pulse { 0%, 100% { opacity: .4; } 50% { opacity: .75; } }

  /* Editor panel */
  .editor-panel {
    border: 1px solid var(--ft-accent); border-radius: var(--ft-radius); padding: 14px;
    display: flex; flex-direction: column; gap: 10px; background: var(--ft-accent-ink);
  }
  .editor-panel .who { font-size: 13.5px; font-weight: 700; color: var(--ft-ink); }
  .editor-panel .fields { display: flex; gap: 10px; flex-wrap: wrap; align-items: flex-end; }
  .editor-panel .field { display: flex; flex-direction: column; gap: 3px; }
  .editor-panel .field label { font-size: 10px; color: var(--ft-ink-3); text-transform: uppercase; }
  .editor-panel .actions { display: flex; gap: 8px; flex-wrap: wrap; }

  [hidden] { display: none !important; }
`;

class FilamentTrackerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._built = false;
    this._collapsed = new Set();
    this._activeMaterial = null;
    this._sort = "material";
    this._editingId = null;
    this._pendingSpool = null;
    this._pendingBaseline = 0;
    this._pendingTimer = null;
  }

  _t(key, vars) {
    return ftT(this._config, this._hass, key, vars);
  }

  _lang() {
    return ftLang(this._config, this._hass);
  }

  // Status is stored in English by the backend; translate for display only.
  _statusLabel(status) {
    const key = STATUS_KEYS[status];
    return key ? this._t(key) : status;
  }

  setConfig(config) {
    this._config = config || {};
    // Lovelace calls this again on every keystroke in the edit dialog's
    // preview, so the visible sections have to follow immediately — not wait
    // for the next hass push, which may be seconds away on a quiet system.
    if (this._built) {
      // The skeleton's labels are baked in at build time, so a language change
      // means rebuilding it. Everything that survives a rebuild lives on the
      // instance (sort, collapsed groups, active filter), not in the DOM.
      if (this._lang() !== this._builtLang && this._hass) this._buildSkeleton();
      this._applyVisibility();
      if (this._hass) this._updateAll();
    }
  }

  // Every section defaults to visible: a config written before these options
  // existed, or one that simply omits them, must keep the full card.
  _showOpt(key) {
    return !this._config || this._config[key] !== false;
  }

  _applyVisibility() {
    if (!this.$) return;
    const set = (el, visible) => {
      if (!el) return;
      if (visible) el.removeAttribute("hidden");
      else el.setAttribute("hidden", "");
    };
    const title = this._showOpt("show_title");
    const stats = this._showOpt("show_stats");
    set(this.$.titleWrap, title);
    set(this.$.stats, stats);
    // Don't leave an empty flex row (and its gap) behind when both halves of
    // the header are switched off.
    set(this.$.secHeader, title || stats);
    set(this.$.secLoaded, this._showOpt("show_ams"));
    set(this.$.secMapping, this._showOpt("show_mapping"));
    set(this.$.secAdd, this._showOpt("show_add"));
    set(this.$.secSearch, this._showOpt("show_search"));
    set(this.$.shelf, this._showOpt("show_shelf"));
    // "Încărcat manual" is also data-dependent, so _updateLoadedManual owns it.
  }

  set hass(hass) {
    this._hass = hass;
    // With language: auto, the first hass is also what tells us which language
    // to use — so a skeleton built before it may need rebuilding once.
    if (!this._built || this._lang() !== this._builtLang) this._buildSkeleton();
    this._updateAll();
  }

  getCardSize() {
    return 8;
  }

  static getStubConfig() {
    return {};
  }

  static getConfigElement() {
    return document.createElement("filament-tracker-card-editor");
  }

  // ---------- one-time DOM build ----------
  _buildSkeleton() {
    this._built = true;
    this._builtLang = this._lang();
    const t = (k, v) => esc(this._t(k, v));
    // A language switch rebuilds the DOM, so carry over the two bits of state
    // that live in it rather than on the instance.
    const prevSearch = this.$ && this.$.search ? this.$.search.value : "";
    const root = this.shadowRoot;
    root.innerHTML = `<style>${CARD_CSS}</style><ha-card></ha-card>`;
    this._card = root.querySelector("ha-card");
    this._card.innerHTML = `
      <div class="header" id="ft-sec-header">
        <div class="title-wrap" id="ft-title-wrap">
          <div class="title"><ha-icon icon="mdi:printer-3d-nozzle"></ha-icon>${t("title")}</div>
          <div class="subtitle" id="ft-subtitle"></div>
        </div>
        <div class="stats" id="ft-stats"></div>
      </div>

      <div id="ft-sec-loaded">
        <div class="section-label"><ha-icon icon="mdi:printer-3d" style="--mdc-icon-size:14px;"></ha-icon>${t("sec_loaded_now")}</div>
        <div class="tray-rack" id="ft-loaded"></div>
      </div>

      <div id="ft-loaded-manual-wrap" hidden>
        <div class="section-label"><ha-icon icon="mdi:swap-horizontal-bold" style="--mdc-icon-size:14px;"></ha-icon>${t("sec_loaded_manual")}</div>
        <div class="tray-rack" id="ft-loaded-manual"></div>
      </div>

      <div id="ft-sec-mapping">
        <div class="section-label"><ha-icon icon="mdi:swap-horizontal" style="--mdc-icon-size:14px;"></ha-icon>${t("sec_mapping")}</div>
        <div class="mapping-grid" id="ft-mapping"></div>
      </div>

      <div id="ft-sec-add">
        <button class="add-toggle" id="ft-add-toggle"><ha-icon icon="mdi:plus-circle"></ha-icon>${t("add_spool")}</button>
        <div class="add-form" id="ft-add-form" hidden style="margin-top:10px;">
          <div class="grid">
            <div class="field"><label>${t("bambu_color")}</label>
              <select id="ft-bambu-line">
                <option value="">${t("choose_line")}</option>
              </select>
            </div>
            <div class="field"><label>&nbsp;</label>
              <input type="text" id="ft-bambu-color" list="ft-bambu-color-list" placeholder="${t("type_or_choose")}" disabled>
              <datalist id="ft-bambu-color-list"></datalist>
            </div>
          </div>
          <div class="grid" style="margin-top:8px;">
            <div class="field"><label>${t("f_label")}</label><input type="text" id="ft-in-label" placeholder="Esun PLA+ Cool Grey"></div>
            <div class="field"><label>${t("f_material")}</label><input type="text" id="ft-in-material" placeholder="PLA"></div>
            <div class="field"><label>${t("f_color")}</label><input type="text" id="ft-in-color" placeholder="#1E88E5" value="#888888"></div>
            <div class="field"><label>${t("f_full")}</label><input type="number" id="ft-in-full" value="1000" min="0"></div>
            <div class="field"><label>${t("f_remaining")}</label><input type="number" id="ft-in-remaining" value="1000" min="0"></div>
            <div class="field"><label>${t("f_status")}</label>
              <select id="ft-in-status">${statusOptions(this)}</select>
            </div>
          </div>
          <div class="actions">
            <button class="btn ghost" id="ft-add-cancel">${t("cancel")}</button>
            <button class="btn primary" id="ft-add-submit">${t("add")}</button>
          </div>
        </div>
      </div>

      <div class="editor-panel" id="ft-editor" hidden>
        <div class="who" id="ft-editor-who"></div>
        <div class="fields">
          <div class="field"><label>${t("f_remaining")}</label><input type="number" id="ft-editor-remaining" min="0"></div>
          <div class="field"><label>${t("f_status")}</label>
            <select id="ft-editor-status">${statusOptions(this)}</select>
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost" id="ft-editor-cancel">${t("cancel")}</button>
          <button class="btn danger" id="ft-editor-delete">${t("delete")}</button>
          <button class="btn primary" id="ft-editor-save">${t("save")}</button>
        </div>
      </div>

      <div>
        <div id="ft-sec-search">
          <div class="toolbar">
            <input type="text" id="ft-search" placeholder="${t("search_ph")}">
            <select id="ft-sort">
              <option value="material">${t("sort_material")}</option>
              <option value="name">${t("sort_name")}</option>
              <option value="amount">${t("sort_amount")}</option>
            </select>
          </div>
          <div class="chip-row" id="ft-chips" style="margin-top:8px;"></div>
        </div>
        <div id="ft-shelf" style="display:flex;flex-direction:column;gap:12px;margin-top:12px;"></div>
      </div>
    `;

    // Elements that persist and must never be innerHTML-replaced.
    this.$ = {
      secHeader: this._card.querySelector("#ft-sec-header"),
      titleWrap: this._card.querySelector("#ft-title-wrap"),
      secLoaded: this._card.querySelector("#ft-sec-loaded"),
      secMapping: this._card.querySelector("#ft-sec-mapping"),
      secAdd: this._card.querySelector("#ft-sec-add"),
      secSearch: this._card.querySelector("#ft-sec-search"),
      subtitle: this._card.querySelector("#ft-subtitle"),
      stats: this._card.querySelector("#ft-stats"),
      loaded: this._card.querySelector("#ft-loaded"),
      loadedManualWrap: this._card.querySelector("#ft-loaded-manual-wrap"),
      loadedManual: this._card.querySelector("#ft-loaded-manual"),
      mapping: this._card.querySelector("#ft-mapping"),
      addToggle: this._card.querySelector("#ft-add-toggle"),
      addForm: this._card.querySelector("#ft-add-form"),
      bambuLine: this._card.querySelector("#ft-bambu-line"),
      bambuColor: this._card.querySelector("#ft-bambu-color"),
      bambuColorList: this._card.querySelector("#ft-bambu-color-list"),
      inLabel: this._card.querySelector("#ft-in-label"),
      inMaterial: this._card.querySelector("#ft-in-material"),
      inColor: this._card.querySelector("#ft-in-color"),
      inFull: this._card.querySelector("#ft-in-full"),
      inRemaining: this._card.querySelector("#ft-in-remaining"),
      inStatus: this._card.querySelector("#ft-in-status"),
      addCancel: this._card.querySelector("#ft-add-cancel"),
      addSubmit: this._card.querySelector("#ft-add-submit"),
      editor: this._card.querySelector("#ft-editor"),
      editorWho: this._card.querySelector("#ft-editor-who"),
      editorRemaining: this._card.querySelector("#ft-editor-remaining"),
      editorStatus: this._card.querySelector("#ft-editor-status"),
      editorCancel: this._card.querySelector("#ft-editor-cancel"),
      editorDelete: this._card.querySelector("#ft-editor-delete"),
      editorSave: this._card.querySelector("#ft-editor-save"),
      search: this._card.querySelector("#ft-search"),
      sort: this._card.querySelector("#ft-sort"),
      chips: this._card.querySelector("#ft-chips"),
      shelf: this._card.querySelector("#ft-shelf"),
    };

    this.$.search.value = prevSearch;
    this.$.sort.value = this._sort;

    this.$.addToggle.addEventListener("click", () => {
      const hidden = this.$.addForm.hasAttribute("hidden");
      if (hidden) this.$.addForm.removeAttribute("hidden");
      else this.$.addForm.setAttribute("hidden", "");
    });
    this.$.addCancel.addEventListener("click", () => this.$.addForm.setAttribute("hidden", ""));
    this.$.addSubmit.addEventListener("click", () => this._submitAdd());

    Object.keys(BAMBU_COLORS).forEach((line) => {
      const opt = document.createElement("option");
      opt.value = line;
      opt.textContent = line;
      this.$.bambuLine.appendChild(opt);
    });
    this.$.bambuLine.addEventListener("change", () => {
      const line = this.$.bambuLine.value;
      this.$.bambuColor.value = "";
      this.$.bambuColorList.innerHTML = "";
      if (!line) {
        this.$.bambuColor.setAttribute("disabled", "");
        return;
      }
      this.$.bambuColor.removeAttribute("disabled");
      Object.keys(BAMBU_COLORS[line]).forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        this.$.bambuColorList.appendChild(opt);
      });
    });
    this.$.bambuColor.addEventListener("input", () => {
      const line = this.$.bambuLine.value;
      const hex = line && BAMBU_COLORS[line][this.$.bambuColor.value];
      if (hex) {
        this.$.inMaterial.value = line;
        this.$.inColor.value = hex;
        if (!this.$.inLabel.value) this.$.inLabel.value = `Bambu ${line} — ${this.$.bambuColor.value}`;
      }
    });

    this.$.editorCancel.addEventListener("click", () => this._closeEditor());
    this.$.editorSave.addEventListener("click", () => this._saveEditor());
    this.$.editorDelete.addEventListener("click", () => this._deleteFromEditor());

    this.$.loadedManual.addEventListener("click", (e) => {
      const tile = e.target.closest(".tray-tile");
      if (tile && tile.dataset.id) this._openEditor(parseInt(tile.dataset.id, 10));
    });

    this.$.search.addEventListener("input", () => this._renderShelf());
    this.$.sort.addEventListener("change", () => {
      this._sort = this.$.sort.value;
      this._renderShelf();
    });

    // Event delegation for dynamically-rebuilt sections.
    this.$.mapping.addEventListener("change", (e) => {
      const sel = e.target.closest("select[data-slot]");
      if (!sel) return;
      const data = { slot: parseInt(sel.dataset.slot, 10) };
      if (sel.value !== "") data.spool_id = parseInt(sel.value, 10);
      this._callService("set_slot_mapping", data);
    });
    this.$.chips.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      this._activeMaterial = chip.dataset.material === this._activeMaterial ? null : chip.dataset.material;
      this._renderShelf();
    });
    this.$.shelf.addEventListener("click", (e) => {
      const del = e.target.closest(".del");
      if (del) {
        e.stopPropagation();
        if (confirm(this._t("confirm_delete"))) {
          this._callService("delete_spool", { id: parseInt(del.dataset.id, 10) });
        }
        return;
      }
      const header = e.target.closest(".material-header");
      if (header) {
        const group = header.closest(".material-group");
        const mat = group.dataset.material;
        if (this._collapsed.has(mat)) this._collapsed.delete(mat);
        else this._collapsed.add(mat);
        group.classList.toggle("collapsed");
        return;
      }
      const tile = e.target.closest(".spool-slot");
      if (!tile) return;
      if (tile.classList.contains("pending")) {
        // A placeholder that never got confirmed shouldn't be a dead end —
        // give it a way out instead of pulsing forever. Dismissing it only
        // clears the local placeholder; if the write did land server-side
        // after all, it'll show up normally on the next state push.
        if (confirm(this._t("confirm_discard_pending"))) {
          this._clearPending();
          this._renderShelf();
        }
        return;
      }
      this._openEditor(parseInt(tile.dataset.id, 10));
    });
  }

  // ---------- per-hass-update rendering ----------
  _updateAll() {
    this._applyVisibility();
    this._resolvePending();
    // _updateLoaded populates _discoveredSlots, which _updateStats needs in
    // order to total up what's loaded in the AMS — so it has to run first.
    // It keeps running even when the tray strip is hidden: the AMS total and
    // the mapping dropdowns' slot labels both depend on that discovery.
    this._updateLoaded();
    this._updateStats();
    this._updateMapping();
    this._updateLoadedManual();
    this._renderShelf();
    this._updateEditorLive();
  }

  // The real entity data, no optimistic entries mixed in — used whenever
  // code needs to check what the backend has actually confirmed.
  //
  // hass.states is the single source of truth, exactly as it is for every
  // other Lovelace card. Earlier versions of this card also fetched the
  // entity over REST after each write and kept whichever copy carried the
  // newer last_updated, on the theory that the push was unreliable. It was
  // not: the integration was publishing its live spool list by reference as
  // the entity's attributes, so Home Assistant's attribute diffing compared
  // that list against itself and dropped it from the push (see the long
  // comment on FilamentSpoolsSensor._refresh). The two copies then always
  // shared a last_updated, the tie went to the push, and the correct REST
  // copy was discarded on every single attempt — which is what made a new
  // spool never appear no matter how long the card polled for it. With the
  // backend publishing snapshots, the push carries the change and there is
  // nothing left to reconcile.
  _rawSpoolsAttr() {
    const live = this._hass.states["sensor.filament_spools_db"];
    return live && live.attributes ? live.attributes : null;
  }

  _spoolsAttr() {
    const attrs = this._rawSpoolsAttr();
    if (!attrs) return attrs;

    // Show a just-submitted spool immediately, before the round trip through
    // Home Assistant's service call (which can take anywhere from instant to
    // several seconds depending on server load) has confirmed it. _submitAdd
    // clears this the moment the real write is confirmed, so the temporary
    // copy is only ever visible during that gap.
    if (this._pendingSpool) {
      return { ...attrs, spools: [...(attrs.spools || []), this._pendingSpool] };
    }
    return attrs;
  }

  // Call a filament_tracker service. Nothing to re-fetch afterwards: the
  // service handler writes the entity's new state before it returns, and Home
  // Assistant pushes that straight into this card's `hass` setter.
  async _callService(service, data) {
    try {
      await this._hass.callService("filament_tracker", service, data);
    } catch (e) {
      console.error("filament-tracker-card: service call failed", service, e);
    }
  }

  // Drop the optimistic placeholder as soon as the entity actually shows the
  // new spool. Runs on every hass push, so whichever update carries the write
  // clears it — no polling, no timers in the happy path.
  _resolvePending() {
    if (!this._pendingSpool) return;
    if ((this._rawSpoolsAttr()?.spools || []).length > this._pendingBaseline) {
      this._clearPending();
    }
  }

  _clearPending() {
    if (this._pendingTimer) {
      clearTimeout(this._pendingTimer);
      this._pendingTimer = null;
    }
    this._pendingSpool = null;
  }

  _threshold() {
    if (this._config && this._config.low_stock_threshold != null) {
      return parseFloat(this._config.low_stock_threshold);
    }
    const attrs = this._spoolsAttr();
    return attrs && attrs.threshold != null ? attrs.threshold : 100;
  }

  // Nominal spool size to assume for an AMS tray that doesn't report one.
  // Bambu's RFID tags carry tray_weight, but third-party spools on a reusable
  // tag usually don't, and 250g/750g spools exist — hence the config option.
  _amsSpoolSize() {
    const v =
      this._config && this._config.ams_spool_size != null
        ? parseFloat(this._config.ams_spool_size)
        : NaN;
    return Number.isFinite(v) && v > 0 ? v : 1000;
  }

  // Grams currently sitting in the printer, estimated per tray as
  // (remaining % × spool size). The AMS only reports a percentage, so this is
  // an estimate by nature — exact only for RFID spools that report tray_weight.
  _amsLoadedGrams() {
    const slots = this._discoveredSlots || [];
    if (slots.length === 0) return 0;
    const attrs = this._spoolsAttr();
    const mappings = (attrs && attrs.mappings) || {};
    let grams = 0;
    slots.forEach((slot, idx) => {
      // A slot mapped by hand is already represented by a real spool in the
      // database, whose exact remaining weight total_remaining counts. Adding
      // the tray estimate on top of that would double-count it.
      if (mappings[String(idx + 1)] != null) return;
      if (!slot.entityId) return;
      const info = this._readRawTray(slot.entityId);
      if (info.empty || info.pct == null) return;
      grams += (info.pct / 100) * (info.weight || this._amsSpoolSize());
    });
    return grams;
  }

  _updateStats() {
    const t = (k, v) => esc(this._t(k, v));
    const attrs = this._spoolsAttr();
    const stock = attrs && attrs.total_remaining != null ? attrs.total_remaining : null;
    const ams = Math.round(this._amsLoadedGrams());
    // "Total" means all the filament you own, wherever it physically is:
    // the backstock shelf plus whatever is loaded in the printer right now.
    const total = stock != null ? stock + ams : ams > 0 ? ams : null;
    const low = attrs ? attrs.low_stock_count : null;
    this.$.subtitle.textContent = attrs
      ? this._t("subtitle_tracked", { n: (attrs.spools || []).length })
      : this._t("not_configured");
    const breakdown =
      ams > 0
        ? this._t("tip_breakdown", {
            stock: (stock || 0).toLocaleString(),
            ams: ams.toLocaleString(),
          })
        : this._t("tip_stock_only");
    this.$.stats.innerHTML = `
      <div class="stat-pill" title="${esc(breakdown)}"><span class="n">${total != null ? total.toLocaleString() : "—"}</span><span class="l">${t("stat_total")}</span></div>
      ${ams > 0 ? `<div class="stat-pill" title="${t("tip_ams")}"><span class="n">${ams.toLocaleString()}</span><span class="l">${t("stat_ams")}</span></div>` : ""}
      <div class="stat-pill${low > 0 ? " warn" : ""}" title="${t("tip_low")}"><span class="n">${low != null ? low : "—"}</span><span class="l">${t("stat_low")}</span></div>
    `;
  }

  // Auto-discovery: any ha-bambulab printer exposes sensor.<prefix>_ams_<unit>_tray_<slot>
  // and sensor.<prefix>_external_spool. No configuration, no template-sensor package —
  // just pattern-match whatever's already in the state machine.
  _discoverAms() {
    const trayRe = /^sensor\.(.+)_ams_(\d+)_tray_(\d+)$/;
    const extRe = /^sensor\.(.+)_external_spool$/;
    const trays = [];
    const externals = [];
    for (const entityId of Object.keys(this._hass.states)) {
      const tm = entityId.match(trayRe);
      if (tm) {
        trays.push({ entityId, prefix: tm[1], unit: parseInt(tm[2], 10), tray: parseInt(tm[3], 10) });
        continue;
      }
      const em = entityId.match(extRe);
      if (em) externals.push({ entityId, prefix: em[1] });
    }
    trays.sort((a, b) => a.prefix.localeCompare(b.prefix) || a.unit - b.unit || a.tray - b.tray);
    return { trays, externals };
  }

  _readRawTray(entityId) {
    const st = this._hass.states[entityId];
    if (!st) return { empty: true };
    const stateVal = st.state;
    const empty = !stateVal || ["unknown", "unavailable", "Empty"].includes(stateVal);
    const attrs = st.attributes || {};
    const type = attrs.tray_type || attrs.type || stateVal;
    let color = attrs.tray_color || attrs.color || null;
    if (color && !String(color).startsWith("#")) color = "#" + color;
    const remainRaw = attrs.remain;
    const pct = remainRaw != null && parseInt(remainRaw, 10) >= 0 ? parseInt(remainRaw, 10) : null;
    // ha-bambulab reports tray_weight (nominal spool grams) off the RFID tag,
    // and 0 when it doesn't know. Only trust a positive number.
    const weightRaw = parseFloat(attrs.tray_weight);
    const weight = Number.isFinite(weightRaw) && weightRaw > 0 ? weightRaw : null;
    return { empty, type, color: color || "#888888", pct, weight };
  }

  _trayTile(label, info) {
    return `<div class="tray-tile">
      <div class="slot-label">${esc(label)}</div>
      <div class="square" style="width:44px;height:44px;background:${info.empty ? "var(--ft-track)" : esc(info.color)};"></div>
      <div class="bar" style="width:44px;">${info.empty ? "" : `<i style="width:${info.pct != null ? info.pct : 0}%;background:var(--ft-accent);"></i>`}</div>
      <div class="mat">${info.empty ? esc(this._t("tray_empty")) : esc(info.type)}</div>
    </div>`;
  }

  _updateLoaded() {
    const { trays, externals } = this._discoverAms();
    if (trays.length === 0 && externals.length === 0) {
      this.$.loaded.innerHTML = `<div class="empty-msg" style="padding:8px;">${esc(this._t("no_ams"))}</div>`;
      this._discoveredSlots = [];
      return;
    }
    let h = "";
    const discovered = [];
    const multiUnit = new Set(trays.map((t) => t.unit)).size > 1;
    trays.forEach((t) => {
      const label = multiUnit ? `AMS${t.unit}·T${t.tray}` : `T${t.tray}`;
      discovered.push({ entityId: t.entityId, label });
      h += this._trayTile(label, this._readRawTray(t.entityId));
    });
    externals.forEach((e, idx) => {
      const label = externals.length > 1 ? `Extern ${idx + 1}` : "Extern";
      discovered.push({ entityId: e.entityId, label });
      h += this._trayTile(label, this._readRawTray(e.entityId));
    });
    this.$.loaded.innerHTML = h;
    this._discoveredSlots = discovered;
  }

  _updateMapping() {
    const attrs = this._spoolsAttr();
    if (!attrs) {
      this.$.mapping.innerHTML = `<div class="empty-msg" style="padding:8px;">${esc(this._t("not_configured"))}</div>`;
      return;
    }
    const mappings = attrs.mappings || {};
    const spools = attrs.spools || [];
    const slots =
      this._discoveredSlots && this._discoveredSlots.length > 0
        ? this._discoveredSlots
        : [1, 2, 3, 4].map((i) => ({ entityId: null, label: this._t("slot_n", { n: i }) }));

    const optionsHtml =
      `<option value="">${esc(this._t("map_none"))}</option>` +
      spools.map((s) => `<option value="${s.id}">${esc(s.label)}</option>`).join("");

    this.$.mapping.innerHTML = slots
      .map((slot, idx) => {
        const slotNum = idx + 1;
        return `<div class="mapping-item">
          <label>${esc(slot.label)}</label>
          <select data-slot="${slotNum}">${optionsHtml}</select>
        </div>`;
      })
      .join("");

    slots.forEach((slot, idx) => {
      const slotNum = idx + 1;
      const sel = this.$.mapping.querySelector(`select[data-slot="${slotNum}"]`);
      const current = mappings[String(slotNum)];
      if (sel) sel.value = current != null ? String(current) : "";
    });
  }

  // A spool currently mapped to a slot is "in the printer", not "in reserve" —
  // pull it off the shelf and show it here instead, next to the real AMS trays.
  _updateLoadedManual() {
    if (!this._showOpt("show_loaded_manual")) {
      this.$.loadedManualWrap.setAttribute("hidden", "");
      return;
    }
    const attrs = this._spoolsAttr();
    const mappings = attrs && attrs.mappings ? attrs.mappings : {};
    const spools = attrs && attrs.spools ? attrs.spools : [];
    const entries = Object.entries(mappings).filter(([, sid]) => sid != null);

    if (entries.length === 0) {
      this.$.loadedManualWrap.setAttribute("hidden", "");
      this.$.loadedManual.innerHTML = "";
      return;
    }

    let h = "";
    entries.forEach(([slotStr, sid]) => {
      const spool = spools.find((s) => s.id === sid);
      if (!spool) return;
      const slotNum = parseInt(slotStr, 10);
      const slotInfo = this._discoveredSlots && this._discoveredSlots[slotNum - 1];
      const slotLabel = slotInfo ? slotInfo.label : this._t("slot_n", { n: slotNum });
      const rem = parseFloat(spool.weight_remaining) || 0;
      const full = parseFloat(spool.weight_full) || 0;
      const pct = full > 0 ? Math.round((rem / full) * 100) : 0;
      h += `<div class="tray-tile" data-id="${spool.id}" style="cursor:pointer;" title="${esc(this._t("manual_tile_tip"))}">
        <div class="slot-label">${esc(slotLabel)}</div>
        <div class="square" style="width:44px;height:44px;background:${esc(spool.color_hex || "#888888")};"></div>
        <div class="bar" style="width:44px;"><i style="width:${pct}%;background:var(--ft-accent);"></i></div>
        <div class="mat">${esc(spool.label)}</div>
      </div>`;
    });

    if (h === "") {
      this.$.loadedManualWrap.setAttribute("hidden", "");
      this.$.loadedManual.innerHTML = "";
      return;
    }

    this.$.loadedManualWrap.removeAttribute("hidden");
    this.$.loadedManual.innerHTML = h;
  }

  _renderShelf() {
    const attrs = this._spoolsAttr();
    const mappedIds = new Set(
      attrs && attrs.mappings ? Object.values(attrs.mappings).filter((v) => v != null) : []
    );
    const spools = attrs && attrs.spools
      ? attrs.spools.filter((s) => s.status !== "Archived" && !mappedIds.has(s.id))
      : null;

    if (spools === null) {
      this.$.chips.innerHTML = "";
      this.$.shelf.innerHTML = `<div class="empty-msg">${esc(this._t("empty_not_configured"))}</div>`;
      return;
    }
    if (spools.length === 0 && mappedIds.size > 0 && (attrs.spools || []).length > 0) {
      this.$.chips.innerHTML = "";
      this.$.shelf.innerHTML = `<div class="empty-msg">${esc(this._t("empty_all_loaded"))}</div>`;
      return;
    }
    if (spools.length === 0) {
      this.$.chips.innerHTML = "";
      this.$.shelf.innerHTML = `<div class="empty-msg">${esc(this._t("empty_none"))}</div>`;
      return;
    }

    const query = (this.$.search.value || "").trim().toLowerCase();
    let filtered = spools.filter((s) => {
      if (!query) return true;
      return `${s.label} ${s.material} ${s.color_hex}`.toLowerCase().includes(query);
    });
    if (this._activeMaterial) {
      filtered = filtered.filter((s) => (s.material || "Altele") === this._activeMaterial);
    }

    // Material chips (always reflect the full set, not the filtered one).
    const allMaterials = Array.from(new Set(spools.map((s) => s.material || "Altele"))).sort();
    this.$.chips.innerHTML = allMaterials
      .map(
        (m) =>
          `<div class="chip${m === this._activeMaterial ? " active" : ""}" data-material="${esc(m)}">${esc(m)}</div>`
      )
      .join("");

    const threshold = this._threshold();
    const groups = {};
    filtered.forEach((s) => {
      const mat = s.material || "Altele";
      (groups[mat] = groups[mat] || []).push(s);
    });

    let materialNames = Object.keys(groups);
    if (this._sort === "material") materialNames.sort();

    let h = "";
    materialNames.forEach((material) => {
      let list = groups[material];
      if (this._sort === "name") list = [...list].sort((a, b) => (a.label || "").localeCompare(b.label || ""));
      if (this._sort === "amount")
        list = [...list].sort((a, b) => (parseFloat(b.weight_remaining) || 0) - (parseFloat(a.weight_remaining) || 0));

      const matTotal = list.filter((s) => s.status !== "Empty").reduce((a, s) => a + (parseFloat(s.weight_remaining) || 0), 0);
      const collapsedClass = this._collapsed.has(material) ? " collapsed" : "";
      h += `<div class="material-group${collapsedClass}" data-material="${esc(material)}">
        <div class="material-header">
          <span class="name"><ha-icon icon="mdi:chevron-down"></ha-icon>${esc(material)}</span>
          <span class="meta">${esc(this._t("group_meta", { n: list.length, g: Math.round(matTotal) }))}</span>
        </div>`;
      for (let i = 0; i < list.length; i += 10) {
        const row = list.slice(i, i + 10);
        h += `<div class="shelf-row">${row.map((s) => this._spoolTile(s, threshold)).join("")}</div>`;
      }
      h += `</div>`;
    });

    this.$.shelf.innerHTML = h || `<div class="empty-msg">${esc(this._t("empty_filter"))}</div>`;
  }

  _spoolTile(s, threshold) {
    const rem = parseFloat(s.weight_remaining) || 0;
    const full = parseFloat(s.weight_full) || 0;
    const pct = full > 0 ? Math.round((rem / full) * 100) : 0;
    const isEmpty = s.status === "Empty";
    const low = !isEmpty && rem <= threshold;
    const bg = isEmpty ? "var(--ft-track)" : esc(s.color_hex || "#888888");
    const barColor = low ? "var(--ft-warn)" : "var(--ft-accent)";
    const pendingClass = s._pending ? " pending" : "";
    const title = s._pending
      ? `${esc(s.label)} — ${esc(this._t("saving_suffix"))}`
      : `${esc(s.label)} — ${esc(this._statusLabel(s.status))} — ${rem}g / ${full}g (${pct}%)`;
    return `<div class="spool-slot${pendingClass}" data-id="${s.id}" title="${title}">
      <div class="del" data-id="${s.id}">✕</div>
      <div class="square" style="width:52px;height:52px;background:${bg};"></div>
      <div class="bar" style="width:52px;"><i style="width:${isEmpty ? 0 : pct}%;background:${barColor};"></i></div>
      <div class="cap">${esc(s.label)}</div>
    </div>`;
  }

  // ---------- add form ----------
  async _submitAdd() {
    const data = {
      label: this.$.inLabel.value,
      material: this.$.inMaterial.value,
      color_hex: this.$.inColor.value || "#888888",
      weight_full: parseFloat(this.$.inFull.value) || 0,
      weight_remaining: parseFloat(this.$.inRemaining.value) || 0,
      status: this.$.inStatus.value,
    };
    this.$.inLabel.value = "";
    this.$.inMaterial.value = "";
    this.$.inColor.value = "#888888";
    this.$.inFull.value = "1000";
    this.$.inRemaining.value = "1000";
    this.$.inStatus.value = "Sealed";
    this.$.bambuLine.value = "";
    this.$.bambuColor.value = "";
    this.$.bambuColor.setAttribute("disabled", "");
    this.$.bambuColorList.innerHTML = "";
    this.$.addForm.setAttribute("hidden", "");

    // Show it on the shelf right now, dimmed, instead of making the click wait
    // on the round trip through Home Assistant's service call. _spoolsAttr()
    // splices this in everywhere until _resolvePending() sees the real entity
    // state carry the write, which normally happens within the same tick that
    // the service call resolves.
    this._clearPending();
    this._pendingBaseline = (this._rawSpoolsAttr()?.spools || []).length;
    this._activeMaterial = null;
    this.$.search.value = "";
    this._collapsed.clear();
    this._pendingSpool = { ...data, id: -Date.now(), label: data.label || "Spool", material: data.material || "Altele", _pending: true };

    // Safety net only, for the case where no state push ever arrives at all
    // (dropped connection, entity missing because the integration isn't set
    // up). Never leave a placeholder pulsing with no explanation — say so, and
    // let a click dismiss it.
    this._pendingTimer = setTimeout(() => {
      this._pendingTimer = null;
      if (!this._pendingSpool) return;
      console.warn("filament-tracker-card: add_spool never showed up in sensor.filament_spools_db");
      this._pendingSpool.label += this._t("unconfirmed_suffix");
      this._renderShelf();
    }, 10000);
    this._renderShelf();

    this.$.addSubmit.disabled = true;
    this.$.addSubmit.textContent = this._t("adding");
    try {
      await this._hass.callService("filament_tracker", "add_spool", data);
    } catch (e) {
      console.error("filament-tracker-card: add_spool failed", e);
      this._clearPending();
    }
    this.$.addSubmit.disabled = false;
    this.$.addSubmit.textContent = this._t("add");
    this._resolvePending();
    this._renderShelf();
  }

  // ---------- editor panel ----------
  _openEditor(id) {
    const attrs = this._spoolsAttr();
    const spool = attrs && attrs.spools ? attrs.spools.find((s) => s.id === id) : null;
    if (!spool) return;
    this._editingId = id;
    this.$.editorWho.textContent = `${spool.label} · ${spool.material}`;
    this.$.editorRemaining.value = spool.weight_remaining;
    this.$.editorStatus.value = spool.status;
    this.$.editor.removeAttribute("hidden");
    this.$.editor.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  _closeEditor() {
    this._editingId = null;
    this.$.editor.setAttribute("hidden", "");
  }

  _updateEditorLive() {
    // Keep the "who" label fresh (e.g. material renamed elsewhere) without
    // touching the remaining-weight input the user may be actively typing in.
    if (this._editingId == null) return;
    const attrs = this._spoolsAttr();
    const spool = attrs && attrs.spools ? attrs.spools.find((s) => s.id === this._editingId) : null;
    if (!spool) {
      this._closeEditor();
      return;
    }
    this.$.editorWho.textContent = `${spool.label} · ${spool.material}`;
  }

  _saveEditor() {
    if (this._editingId == null) return;
    this._callService("update_spool", {
      id: this._editingId,
      weight_remaining: parseFloat(this.$.editorRemaining.value) || 0,
      status: this.$.editorStatus.value,
    });
    this._closeEditor();
  }

  _deleteFromEditor() {
    if (this._editingId == null) return;
    if (confirm(this._t("confirm_delete"))) {
      this._callService("delete_spool", { id: this._editingId });
    }
    this._closeEditor();
  }
}

// Guarded: the card is registered both as an extra frontend module and as a
// dashboard resource. Identical URLs are deduped by the browser's module map,
// but a stale resource entry pointing at an older ?v= would evaluate this file
// a second time — and an unguarded define() throws, taking the whole module
// down before the editor below ever gets registered.
if (!customElements.get("filament-tracker-card")) {
  customElements.define("filament-tracker-card", FilamentTrackerCard);
}

// Visual config editor — shown in the card's "Edit" GUI, no YAML needed to customize.
class FilamentTrackerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // Only re-render when the resolved language actually changed. This setter
    // fires on every state change in Home Assistant, and a blanket re-render
    // would blow away focus while someone is typing in the number fields.
    if (this._config && this._renderedLang !== ftLang(this._config, hass)) this._render();
  }

  _t(key, vars) {
    return ftT(this._config, this._hass, key, vars);
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._renderedLang = ftLang(this._config, this._hass);
    const t = (k, v) => esc(this._t(k, v));
    const current = this._config.low_stock_threshold != null ? this._config.low_stock_threshold : "";
    const amsSize = this._config.ams_spool_size != null ? this._config.ams_spool_size : "";
    const lang = this._config.language || "auto";
    this.shadowRoot.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; }
        label { font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
        input, select {
          font: inherit; padding: 8px 10px; border-radius: 8px;
          border: 1px solid var(--divider-color); background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        select { cursor: pointer; }
        .hint { font-size: 11px; color: var(--secondary-text-color); }
        .group-title {
          font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase;
          color: var(--secondary-text-color); margin-top: 4px;
        }
        .toggles { display: flex; flex-direction: column; gap: 2px; padding: 8px 0 4px; }
        .toggle {
          display: flex; align-items: center; gap: 10px; padding: 7px 8px;
          border-radius: 8px; cursor: pointer; font-size: 13.5px;
          color: var(--primary-text-color);
        }
        .toggle:hover { background: var(--secondary-background-color); }
        .toggle input { width: 17px; height: 17px; margin: 0; padding: 0; accent-color: var(--primary-color); cursor: pointer; }
        .divider { height: 1px; background: var(--divider-color); margin: 12px 0 4px; }
      </style>
      <div class="group-title">${t("ed_what")}</div>
      <div class="toggles">
        ${CARD_SECTIONS.map(
          (s) => `<label class="toggle">
            <input type="checkbox" data-key="${esc(s.key)}"${this._config[s.key] !== false ? " checked" : ""}>
            <span>${t(s.label)}</span>
          </label>`
        ).join("")}
      </div>
      <div class="hint">${t("ed_hint_sections")}</div>

      <div class="divider"></div>
      <div class="group-title">${t("ed_settings")}</div>
      <div class="row">
        <label>${t("ed_language")}</label>
        <select id="language">
          <option value="auto"${lang === "auto" ? " selected" : ""}>${t("ed_lang_auto")}</option>
          ${LANGUAGES.map(
            (l) =>
              `<option value="${esc(l.value)}"${lang === l.value ? " selected" : ""}>${esc(l.label)}</option>`
          ).join("")}
        </select>
      </div>
      <div class="row">
        <label>${t("ed_threshold")}</label>
        <input type="number" id="threshold" min="0" value="${esc(current)}" placeholder="${t("ed_threshold_ph")}">
        <div class="hint">${t("ed_threshold_hint")}</div>
      </div>
      <div class="row">
        <label>${t("ed_ams_size")}</label>
        <input type="number" id="ams-size" min="1" value="${esc(amsSize)}" placeholder="1000">
        <div class="hint">${t("ed_ams_hint")}</div>
      </div>
    `;

    this.shadowRoot.querySelector("#language").addEventListener("change", (e) => {
      const newConfig = { ...this._config };
      if (e.target.value === "auto") delete newConfig.language;
      else newConfig.language = e.target.value;
      this._emit(newConfig);
    });

    this.shadowRoot.querySelectorAll(".toggle input[data-key]").forEach((box) => {
      box.addEventListener("change", (e) => {
        const newConfig = { ...this._config };
        // Only ever store the non-default. Keeping the config free of
        // `show_x: true` noise means a card that was never customised stays a
        // clean `{}`, and future sections default on without a migration.
        if (e.target.checked) delete newConfig[e.target.dataset.key];
        else newConfig[e.target.dataset.key] = false;
        this._emit(newConfig);
      });
    });
    this.shadowRoot.querySelector("#threshold").addEventListener("change", (e) => {
      const v = e.target.value;
      const newConfig = { ...this._config };
      if (v === "") delete newConfig.low_stock_threshold;
      else newConfig.low_stock_threshold = parseFloat(v);
      this._emit(newConfig);
    });
    this.shadowRoot.querySelector("#ams-size").addEventListener("change", (e) => {
      const v = e.target.value;
      const newConfig = { ...this._config };
      if (v === "") delete newConfig.ams_spool_size;
      else newConfig.ams_spool_size = parseFloat(v);
      this._emit(newConfig);
    });
  }

  _emit(newConfig) {
    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true })
    );
  }
}

if (!customElements.get("filament-tracker-card-editor")) {
  customElements.define("filament-tracker-card-editor", FilamentTrackerCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((c) => c && c.type === "filament-tracker-card")) {
  window.customCards.push({
    type: "filament-tracker-card",
    name: "Filament Tracker",
    description: "Live AMS trays, manual mapping, and a searchable/sortable spool shelf with add/delete — all in one card.",
  });
}
