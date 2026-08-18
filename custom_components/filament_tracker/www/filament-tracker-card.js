/* Filament Tracker Card — a single self-contained Lovelace card:
 * live AMS trays, manual AMS-slot mapping, add/delete spools, and the
 * material shelf, all in one widget. No build step: plain Web Component. */

const ESC_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function esc(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

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
  }

  setConfig(config) {
    this._config = config || {};
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._buildSkeleton();
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
    const root = this.shadowRoot;
    root.innerHTML = `<style>${CARD_CSS}</style><ha-card></ha-card>`;
    this._card = root.querySelector("ha-card");
    this._card.innerHTML = `
      <div class="header">
        <div class="title-wrap">
          <div class="title"><ha-icon icon="mdi:printer-3d-nozzle"></ha-icon>Filament Stock</div>
          <div class="subtitle" id="ft-subtitle"></div>
        </div>
        <div class="stats" id="ft-stats"></div>
      </div>

      <div>
        <div class="section-label"><ha-icon icon="mdi:printer-3d" style="--mdc-icon-size:14px;"></ha-icon>Încărcat acum</div>
        <div class="tray-rack" id="ft-loaded"></div>
      </div>

      <div>
        <div class="section-label"><ha-icon icon="mdi:swap-horizontal" style="--mdc-icon-size:14px;"></ha-icon>Mapare manuală AMS</div>
        <div class="mapping-grid" id="ft-mapping"></div>
      </div>

      <div>
        <button class="add-toggle" id="ft-add-toggle"><ha-icon icon="mdi:plus-circle"></ha-icon>Adaugă bobină</button>
        <div class="add-form" id="ft-add-form" hidden style="margin-top:10px;">
          <div class="grid">
            <div class="field"><label>Etichetă</label><input type="text" id="ft-in-label" placeholder="Esun PLA+ Cool Grey"></div>
            <div class="field"><label>Material</label><input type="text" id="ft-in-material" placeholder="PLA"></div>
            <div class="field"><label>Culoare (hex)</label><input type="text" id="ft-in-color" placeholder="#1E88E5" value="#888888"></div>
            <div class="field"><label>Greutate totală (g)</label><input type="number" id="ft-in-full" value="1000" min="0"></div>
            <div class="field"><label>Greutate rămasă (g)</label><input type="number" id="ft-in-remaining" value="1000" min="0"></div>
            <div class="field"><label>Stare</label>
              <select id="ft-in-status">
                <option>Sealed</option><option>Opened</option><option>Empty</option>
              </select>
            </div>
          </div>
          <div class="actions">
            <button class="btn ghost" id="ft-add-cancel">Anulează</button>
            <button class="btn primary" id="ft-add-submit">Adaugă</button>
          </div>
        </div>
      </div>

      <div class="editor-panel" id="ft-editor" hidden>
        <div class="who" id="ft-editor-who"></div>
        <div class="fields">
          <div class="field"><label>Greutate rămasă (g)</label><input type="number" id="ft-editor-remaining" min="0"></div>
          <div class="field"><label>Stare</label>
            <select id="ft-editor-status"><option>Sealed</option><option>Opened</option><option>Empty</option></select>
          </div>
        </div>
        <div class="actions">
          <button class="btn ghost" id="ft-editor-cancel">Anulează</button>
          <button class="btn danger" id="ft-editor-delete">Șterge</button>
          <button class="btn primary" id="ft-editor-save">Salvează</button>
        </div>
      </div>

      <div>
        <div class="toolbar">
          <input type="text" id="ft-search" placeholder="Caută după nume sau culoare…">
          <select id="ft-sort">
            <option value="material">Sortează: Material</option>
            <option value="name">Sortează: Nume</option>
            <option value="amount">Sortează: Cantitate</option>
          </select>
        </div>
        <div class="chip-row" id="ft-chips" style="margin-top:8px;"></div>
        <div id="ft-shelf" style="display:flex;flex-direction:column;gap:12px;margin-top:12px;"></div>
      </div>
    `;

    // Elements that persist and must never be innerHTML-replaced.
    this.$ = {
      subtitle: this._card.querySelector("#ft-subtitle"),
      stats: this._card.querySelector("#ft-stats"),
      loaded: this._card.querySelector("#ft-loaded"),
      mapping: this._card.querySelector("#ft-mapping"),
      addToggle: this._card.querySelector("#ft-add-toggle"),
      addForm: this._card.querySelector("#ft-add-form"),
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

    this.$.addToggle.addEventListener("click", () => {
      const hidden = this.$.addForm.hasAttribute("hidden");
      if (hidden) this.$.addForm.removeAttribute("hidden");
      else this.$.addForm.setAttribute("hidden", "");
    });
    this.$.addCancel.addEventListener("click", () => this.$.addForm.setAttribute("hidden", ""));
    this.$.addSubmit.addEventListener("click", () => this._submitAdd());

    this.$.editorCancel.addEventListener("click", () => this._closeEditor());
    this.$.editorSave.addEventListener("click", () => this._saveEditor());
    this.$.editorDelete.addEventListener("click", () => this._deleteFromEditor());

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
      this._hass.callService("filament_tracker", "set_slot_mapping", data);
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
        if (confirm("Ștergi această bobină?")) {
          this._hass.callService("filament_tracker", "delete_spool", { id: parseInt(del.dataset.id, 10) });
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
      if (tile) {
        this._openEditor(parseInt(tile.dataset.id, 10));
      }
    });
  }

  // ---------- per-hass-update rendering ----------
  _updateAll() {
    this._updateStats();
    this._updateLoaded();
    this._updateMapping();
    this._renderShelf();
    this._updateEditorLive();
  }

  _spoolsAttr() {
    const ent = this._hass.states["sensor.filament_spools_db"];
    return ent && ent.attributes ? ent.attributes : null;
  }

  _threshold() {
    if (this._config && this._config.low_stock_threshold != null) {
      return parseFloat(this._config.low_stock_threshold);
    }
    const attrs = this._spoolsAttr();
    return attrs && attrs.threshold != null ? attrs.threshold : 100;
  }

  _updateStats() {
    const attrs = this._spoolsAttr();
    const total = attrs ? attrs.total_remaining : null;
    const low = attrs ? attrs.low_stock_count : null;
    this.$.subtitle.textContent = attrs
      ? `${(attrs.spools || []).length} bobine urmărite`
      : "Filament Tracker neconfigurat încă";
    this.$.stats.innerHTML = `
      <div class="stat-pill"><span class="n">${total != null ? total.toLocaleString() : "—"}</span><span class="l">g total</span></div>
      <div class="stat-pill${low > 0 ? " warn" : ""}"><span class="n">${low != null ? low : "—"}</span><span class="l">stoc redus</span></div>
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
    return { empty, type, color: color || "#888888", pct };
  }

  _trayTile(label, info) {
    return `<div class="tray-tile">
      <div class="slot-label">${esc(label)}</div>
      <div class="square" style="width:44px;height:44px;background:${info.empty ? "var(--ft-track)" : esc(info.color)};"></div>
      <div class="bar" style="width:44px;">${info.empty ? "" : `<i style="width:${info.pct != null ? info.pct : 0}%;background:var(--ft-accent);"></i>`}</div>
      <div class="mat">${info.empty ? "Gol" : esc(info.type)}</div>
    </div>`;
  }

  _updateLoaded() {
    const { trays, externals } = this._discoverAms();
    if (trays.length === 0 && externals.length === 0) {
      this.$.loaded.innerHTML = `<div class="empty-msg" style="padding:8px;">Niciun senzor AMS găsit — instalează ha-bambulab dacă ai o imprimantă Bambu conectată.</div>`;
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
      this.$.mapping.innerHTML = `<div class="empty-msg" style="padding:8px;">Filament Tracker neconfigurat încă.</div>`;
      return;
    }
    const mappings = attrs.mappings || {};
    const spools = attrs.spools || [];
    const slots =
      this._discoveredSlots && this._discoveredSlots.length > 0
        ? this._discoveredSlots
        : [1, 2, 3, 4].map((i) => ({ entityId: null, label: `Slot ${i}` }));

    const optionsHtml =
      `<option value="">— Niciuna / RFID auto —</option>` +
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

  _renderShelf() {
    const attrs = this._spoolsAttr();
    const spools = attrs && attrs.spools ? attrs.spools.filter((s) => s.status !== "Archived") : null;

    if (spools === null) {
      this.$.chips.innerHTML = "";
      this.$.shelf.innerHTML = `<div class="empty-msg">Filament Tracker nu este configurat — adaugă integrarea și restart HA.</div>`;
      return;
    }
    if (spools.length === 0) {
      this.$.chips.innerHTML = "";
      this.$.shelf.innerHTML = `<div class="empty-msg">Nicio bobină încă — adaugă una mai sus.</div>`;
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
          <span class="meta">${list.length} bobine · ${Math.round(matTotal)}g</span>
        </div>`;
      for (let i = 0; i < list.length; i += 10) {
        const row = list.slice(i, i + 10);
        h += `<div class="shelf-row">${row.map((s) => this._spoolTile(s, threshold)).join("")}</div>`;
      }
      h += `</div>`;
    });

    this.$.shelf.innerHTML = h || `<div class="empty-msg">Nicio bobină nu corespunde filtrului.</div>`;
  }

  _spoolTile(s, threshold) {
    const rem = parseFloat(s.weight_remaining) || 0;
    const full = parseFloat(s.weight_full) || 0;
    const pct = full > 0 ? Math.round((rem / full) * 100) : 0;
    const isEmpty = s.status === "Empty";
    const low = !isEmpty && rem <= threshold;
    const bg = isEmpty ? "var(--ft-track)" : esc(s.color_hex || "#888888");
    const barColor = low ? "var(--ft-warn)" : "var(--ft-accent)";
    return `<div class="spool-slot" data-id="${s.id}" title="${esc(s.label)} — ${esc(s.status)} — ${rem}g / ${full}g (${pct}%)">
      <div class="del" data-id="${s.id}">✕</div>
      <div class="square" style="width:52px;height:52px;background:${bg};"></div>
      <div class="bar" style="width:52px;"><i style="width:${isEmpty ? 0 : pct}%;background:${barColor};"></i></div>
      <div class="cap">${esc(s.label)}</div>
    </div>`;
  }

  // ---------- add form ----------
  _submitAdd() {
    const data = {
      label: this.$.inLabel.value,
      material: this.$.inMaterial.value,
      color_hex: this.$.inColor.value || "#888888",
      weight_full: parseFloat(this.$.inFull.value) || 0,
      weight_remaining: parseFloat(this.$.inRemaining.value) || 0,
      status: this.$.inStatus.value,
    };
    this._hass.callService("filament_tracker", "add_spool", data);
    this.$.inLabel.value = "";
    this.$.inMaterial.value = "";
    this.$.inColor.value = "#888888";
    this.$.inFull.value = "1000";
    this.$.inRemaining.value = "1000";
    this.$.inStatus.value = "Sealed";
    this.$.addForm.setAttribute("hidden", "");
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
    this._hass.callService("filament_tracker", "update_spool", {
      id: this._editingId,
      weight_remaining: parseFloat(this.$.editorRemaining.value) || 0,
      status: this.$.editorStatus.value,
    });
    this._closeEditor();
  }

  _deleteFromEditor() {
    if (this._editingId == null) return;
    if (confirm("Ștergi această bobină?")) {
      this._hass.callService("filament_tracker", "delete_spool", { id: this._editingId });
    }
    this._closeEditor();
  }
}

customElements.define("filament-tracker-card", FilamentTrackerCard);

// Visual config editor — shown in the card's "Edit" GUI, no YAML needed to customize.
class FilamentTrackerCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const current = this._config.low_stock_threshold != null ? this._config.low_stock_threshold : "";
    this.shadowRoot.innerHTML = `
      <style>
        .row { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; }
        label { font-size: 13px; font-weight: 500; color: var(--primary-text-color); }
        input {
          font: inherit; padding: 8px 10px; border-radius: 8px;
          border: 1px solid var(--divider-color); background: var(--card-background-color);
          color: var(--primary-text-color);
        }
        .hint { font-size: 11px; color: var(--secondary-text-color); }
      </style>
      <div class="row">
        <label>Prag stoc redus (g) — opțional</label>
        <input type="number" id="threshold" min="0" value="${esc(current)}" placeholder="folosește pragul din integrare">
        <div class="hint">Lasă gol ca să folosești pragul din Settings → Devices &amp; Services → Filament Tracker → Configure.</div>
      </div>
    `;
    this.shadowRoot.querySelector("#threshold").addEventListener("change", (e) => {
      const v = e.target.value;
      const newConfig = { ...this._config };
      if (v === "") delete newConfig.low_stock_threshold;
      else newConfig.low_stock_threshold = parseFloat(v);
      this._config = newConfig;
      this.dispatchEvent(
        new CustomEvent("config-changed", { detail: { config: newConfig }, bubbles: true, composed: true })
      );
    });
  }
}

customElements.define("filament-tracker-card-editor", FilamentTrackerCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "filament-tracker-card",
  name: "Filament Tracker",
  description: "Live AMS trays, manual mapping, and a searchable/sortable spool shelf with add/delete — all in one card.",
});
