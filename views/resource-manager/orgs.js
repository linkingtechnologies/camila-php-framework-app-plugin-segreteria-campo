// ./views/resource-manager/orgs.js
//
// The "Organizzazioni" tab of the Database risorse: the registry `db-organizzazioni` as a list,
// with how many volunteers, mezzi and materiali each organisation has, and - only if the user has
// the permission on that table - a form to add an organisation or change one.
//
// Shared-module contract (AGENTS.md): this file does not render by itself. It exports a factory
// that receives `html` and a `rerender` of the host and returns `template()`, plus `afterRender()`
// for the map picker, which mounts its map after the render. It is imported dynamically, with the
// version, by step1.js.
//
// What a change here means for the rest of the page is told to the operator in the form: the
// resources copy the organisation's name and code as TEXT, so renaming does not reach them.

const VERSION = window.APP_CONFIG?.version || Date.now();

const TABLE = "db-organizzazioni";
const COUNT_TABLES = { volontari: "db-volontari", mezzi: "db-mezzi", materiali: "db-materiali" };
const PAGE = 1000;        // rows per read, like the export
const MAX_PAGES = 200;
const SHOWN_MAX = 300;    // rows drawn at once: a longer result asks to narrow the search

// The columns of the registry, by their public name. The labels and the existence are checked against
// the table's describe() when it answers (the worktable is edited from Camila: a column can be renamed or
// removed after this was written); the key fields are the ones the other views already read by name.
const FIELDS = [
  { key: "denominazione", label: "Denominazione", required: true, full: true },
  { key: "codice", label: "Codice", required: true },
  { key: "denominazione-dbvol", label: "Denominazione DBVOL" },
  { key: "sezione", label: "Sezione" },
  { key: "tipologia-sezione", label: "Tipologia sezione" },
  { key: "codice-fiscale", label: "Codice fiscale" },
  { key: "partita-iva", label: "Partita IVA" },
  { key: "indirizzo", label: "Indirizzo", full: true },
  { key: "comune", label: "Comune" },
  { key: "provincia", label: "Provincia" },
  { key: "latitudine", label: "Latitudine", coord: true },
  { key: "longitudine", label: "Longitudine", coord: true },
  { key: "note", label: "Note", full: true, area: true },
];

const safe = (v) => (v == null ? "" : String(v));
const norm = (v) => safe(v).trim();
const records = (res) =>
  Array.isArray(res) ? res : Array.isArray(res?.records) ? res.records : Array.isArray(res?.data?.records) ? res.data.records : [];
const fold = (s) => safe(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// "45,52" and "45.52" are both what an operator types; anything that is not a number is not a coordinate
function parseNum(v) {
  const t = norm(v).replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

// A usable position: both numbers, in range, and not 0/0 (an empty cell read as zero is not a place).
function parseCoord(lat, lon) {
  const la = parseNum(lat), lo = parseNum(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  if (la === 0 && lo === 0) return null;
  return { lat: la, lon: lo };
}

export function createOrgsPanel(initialDeps) {
  // The host calls bind() on every render of its own: the panel outlives one invocation of the host,
  // so the callbacks it holds must follow the latest one.
  let deps = initialDeps;
  const bind = (d) => { deps = { ...deps, ...d }; };

  const st = {
    loaded: false,
    loading: false,
    error: null,                 // text of the first failed read
    perms: { create: false, update: false },
    permsNote: null,             // why the user is read only, when it is not a plain "no"
    columns: null,               // describe() columns by name, or {} when it did not answer
    fields: FIELDS,              // the form fields that exist in the table
    orgs: [],                    // [{ id, code, name, ..., pos|null }]
    counts: { volontari: new Map(), mezzi: new Map(), materiali: new Map() },
    countsError: null,
    q: "",
    prov: "",
    onlyNoCoords: false,
    form: null,                  // null, or { mode, id, base, draft, errors, busy, error }
  };

  let loadPromise = null;
  let picker = null;
  let pickerCss = "";

  // ---- data -------------------------------------------------------------------------
  async function readCodes(table) {
    const t = deps.client.table(table);
    const counts = new Map();
    let total = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await t.list({ include: ["codice-organizzazione"], order: [["id", "asc"]], page: [page, PAGE] });
      const batch = records(res);
      for (const r of batch) {
        const c = norm(r["codice-organizzazione"]);
        if (c) counts.set(c.toLowerCase(), (counts.get(c.toLowerCase()) || 0) + 1);
      }
      total += batch.length;
      const all = Number(res?.results ?? total);
      if (!batch.length || total >= all) break;
    }
    return counts;
  }

  function rowToOrg(r) {
    const o = { id: r.id, code: norm(r.codice), name: norm(r.denominazione) };
    for (const f of FIELDS) o[f.key] = safe(r[f.key]);
    o.provincia = norm(r.provincia).toUpperCase();
    o.pos = parseCoord(r.latitudine, r.longitudine);
    return o;
  }

  async function doLoad() {
    st.loading = true;
    st.error = null;
    const [orgs, perms, cols, vol, mez, mat] = await Promise.allSettled([
      deps.client.table(TABLE).list({ size: 5000 }),
      deps.client.table(TABLE).permissions(),
      (async () => {
        const { loadColumns } = await import(`../shared/vocabularies.js?v=${VERSION}`);
        return (await loadColumns(deps.client, TABLE)).columns;
      })(),
      readCodes(COUNT_TABLES.volontari),
      readCodes(COUNT_TABLES.mezzi),
      readCodes(COUNT_TABLES.materiali),
    ]);

    st.orgs = orgs.status === "fulfilled" ? records(orgs.value).map(rowToOrg).filter((o) => o.code || o.name) : [];

    // The permissions of the table decide whether there is a form at all. If they cannot be read the
    // page is read only (AGENTS.md): never the other way round.
    if (perms.status === "fulfilled") {
      const can = perms.value?.can || {};
      st.perms = { create: can.create === true, update: can.update === true };
      st.permsNote = null;
    } else {
      st.perms = { create: false, update: false };
      st.permsNote = "Permessi non verificati su questa scheda: solo consultazione.";
    }

    // fields: only those the table has, with its own labels, when it told us
    st.columns = cols.status === "fulfilled" ? cols.value || {} : {};
    const known = Object.keys(st.columns).length > 0;
    st.fields = FIELDS
      .filter((f) => !known || st.columns[f.key])
      .map((f) => ({ ...f, label: st.columns[f.key]?.label ? labelCase(st.columns[f.key].label, f.label) : f.label }));

    st.counts = {
      volontari: vol.status === "fulfilled" ? vol.value : new Map(),
      mezzi: mez.status === "fulfilled" ? mez.value : new Map(),
      materiali: mat.status === "fulfilled" ? mat.value : new Map(),
    };
    const badCount = [vol, mez, mat].find((r) => r.status === "rejected");
    st.countsError = badCount ? deps.errorText(badCount.reason) : null;
    st.error = orgs.status === "rejected" ? deps.errorText(orgs.reason) : null;
    st.loaded = true;
    st.loading = false;
  }

  // The worktable writes its labels in capitals ("TIPOLOGIA SEZIONE"): ours read better; the label of the
  // table is used only if it says something different from the default.
  function labelCase(fromTable, fallback) {
    const a = fromTable.trim();
    return a.toUpperCase() === a ? (fold(a) === fold(fallback) ? fallback : a.charAt(0) + a.slice(1).toLowerCase()) : a;
  }

  // One read at a time; two renders asking together share it.
  async function load() {
    if (!picker) {
      const m = await import(`../shared/map-picker.js?v=${VERSION}`);
      pickerCss = m.MAP_PICKER_CSS;
      picker = m.createMapPicker({
        html: deps.html,
        rerender: () => deps.rerender(),
        onConfirm: applyPosition,
      });
    }
    if (st.loaded) return;
    if (!loadPromise) loadPromise = doLoad().finally(() => { loadPromise = null; });
    await loadPromise;
  }

  // Called when the tab is opened: the data may have changed since.
  function reset() {
    st.loaded = false;
    st.form = null;
  }

  // ---- list -------------------------------------------------------------------------
  function visibleOrgs() {
    const q = fold(st.q).trim();
    return st.orgs
      .filter((o) => (!st.prov || o.provincia === st.prov) && (!st.onlyNoCoords || !o.pos))
      .filter((o) => !q || fold(o.name).includes(q) || fold(o.code).includes(q) || fold(o.comune).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, "it", { sensitivity: "base" }) || a.code.localeCompare(b.code));
  }

  const countOf = (tab, o) => st.counts[tab].get(o.code.toLowerCase()) || 0;

  function setQuery(v) { st.q = v || ""; deps.rerender(); }
  function setProv(v) { st.prov = v || ""; deps.rerender(); }
  function setNoCoords(on) { st.onlyNoCoords = !!on; deps.rerender(); }

  // ---- form -------------------------------------------------------------------------
  const FIELD_KEYS = () => st.fields.map((f) => f.key);

  function emptyDraft() {
    const d = {};
    for (const k of FIELD_KEYS()) d[k] = "";
    return d;
  }

  function draftOf(o) {
    const d = emptyDraft();
    for (const k of FIELD_KEYS()) d[k] = safe(o[k] ?? "");
    d.denominazione = o.name;
    d.codice = o.code;
    d.provincia = o.provincia;
    return d;
  }

  function openNew() {
    if (!st.perms.create) return;
    const d = emptyDraft();
    st.form = { mode: "create", id: null, base: { ...d }, draft: d, errors: {}, busy: false, error: null };
    deps.rerender();
  }

  function openEdit(o) {
    if (!st.perms.update) return;
    const d = draftOf(o);
    st.form = { mode: "edit", id: o.id, code: o.code, name: o.name, base: { ...d }, draft: d, errors: {}, busy: false, error: null };
    deps.rerender();
  }

  function closeForm() {
    if (st.form?.busy) return;
    st.form = null;
    deps.rerender();
  }

  function setField(key, v) {
    if (!st.form) return;
    st.form.draft = { ...st.form.draft, [key]: v };
    if (st.form.errors[key]) st.form.errors = { ...st.form.errors, [key]: undefined };
    st.form.error = null;
    deps.rerender();
  }

  const isDirty = (f) => FIELD_KEYS().some((k) => norm(f.draft[k]) !== norm(f.base[k]));

  // The position picker writes the position, and the address if it found one: an empty answer never
  // overwrites what the operator typed.
  function applyPosition(pos) {
    if (!st.form) return;
    const d = { ...st.form.draft };
    d.latitudine = String(pos.lat);
    d.longitudine = String(pos.lon);
    if (pos.comune) d.comune = pos.comune;
    if (pos.provincia) d.provincia = pos.provincia;
    if (pos.indirizzo) d.indirizzo = pos.indirizzo;
    st.form.draft = d;
    st.form.errors = { ...st.form.errors, latitudine: undefined, longitudine: undefined };
    deps.rerender();
  }

  function openPicker() {
    const f = st.form;
    if (!f || !picker) return;
    const c = parseCoord(f.draft.latitudine, f.draft.longitudine);
    picker.open({
      lat: c ? c.lat : null,
      lon: c ? c.lon : null,
      query: [norm(f.draft.indirizzo), norm(f.draft.comune), norm(f.draft.provincia)].filter(Boolean).join(", "),
    });
  }

  // Returns { field: message }; empty = valid.
  function validate(f) {
    const e = {};
    const d = f.draft;
    if (!norm(d.denominazione)) e.denominazione = "La denominazione è obbligatoria.";
    if (f.mode === "create") {
      const code = norm(d.codice);
      if (!code) e.codice = "Il codice è obbligatorio.";
      else if (st.orgs.some((o) => o.code.toLowerCase() === code.toLowerCase())) e.codice = "Esiste già un'organizzazione con questo codice.";
    }
    const la = parseNum(d.latitudine), lo = parseNum(d.longitudine);
    const hasLa = norm(d.latitudine) !== "", hasLo = norm(d.longitudine) !== "";
    if (hasLa !== hasLo) {
      e[hasLa ? "longitudine" : "latitudine"] = "Latitudine e longitudine vanno insieme.";
    } else if (hasLa) {
      if (Number.isNaN(la) || Math.abs(la) > 90) e.latitudine = "Latitudine non valida (da -90 a 90).";
      if (Number.isNaN(lo) || Math.abs(lo) > 180) e.longitudine = "Longitudine non valida (da -180 a 180).";
      if (!e.latitudine && !e.longitudine && la === 0 && lo === 0) e.latitudine = "0, 0 non è un luogo.";
    }
    return e;
  }

  // A field that is empty goes as null (AGENTS.md): omitting it would leave the old value in the table.
  function payloadOf(f) {
    const d = f.draft;
    const p = {};
    for (const k of FIELD_KEYS()) {
      if (k === "codice" && f.mode === "edit") continue;       // the key is not changed
      if (k === "latitudine" || k === "longitudine") {
        const n = parseNum(d[k]);
        p[k] = n === null ? null : Number(n.toFixed(6));
      } else if (k === "provincia") {
        p[k] = norm(d[k]).toUpperCase() || null;
      } else {
        p[k] = norm(d[k]) || null;
      }
    }
    if (f.mode === "create") p.codice = norm(d.codice);
    p.denominazione = norm(d.denominazione);
    return p;
  }

  async function save() {
    const f = st.form;
    if (!f || f.busy) return;                                  // a second click is not a second write
    if (f.mode === "create" ? !st.perms.create : !st.perms.update) return;   // second guard: the button is UX
    if (f.mode === "edit" && !isDirty(f)) return;
    f.errors = validate(f);
    if (Object.values(f.errors).some(Boolean)) { deps.rerender(); return; }

    f.busy = true;
    f.error = null;
    deps.rerender();
    try {
      const payload = payloadOf(f);
      const table = deps.client.table(TABLE);
      if (f.mode === "create") await table.create(payload);
      else await table.update(f.id, payload);
      const name = payload.denominazione;
      const code = f.mode === "create" ? payload.codice : f.code;
      st.form = null;
      st.loaded = false;                                       // read again: the list, the counts
      deps.onSaved({ text: `Organizzazione salvata: ${name} (${code}).` });
    } catch (e) {
      f.busy = false;
      f.error = deps.errorText(e);
      deps.rerender();
    }
  }

  // ---- template ---------------------------------------------------------------------
  function afterRender() {
    picker?.afterRender();
  }

  function formTemplate() {
    const { html } = deps;
    const f = st.form;
    if (!f) return "";
    const sessionDown = f.error === deps.sessionMessage;
    const used = f.mode === "edit"
      ? ["volontari", "mezzi", "materiali"].reduce((n, t) => n + (st.counts[t].get(f.code.toLowerCase()) || 0), 0)
      : 0;
    const renamed = f.mode === "edit" && norm(f.draft.denominazione) !== norm(f.base.denominazione);

    const input = (fd) => {
      const v = f.draft[fd.key] ?? "";
      const ro = fd.key === "codice" && f.mode === "edit";
      const err = f.errors[fd.key];
      return html`
        <div class="column ${fd.full ? "is-12" : "is-6"} py-1">
          <label class="label is-small mb-1">${fd.label}${fd.required ? " *" : ""}</label>
          ${fd.area
            ? html`<textarea class="textarea is-small" rows="2" data-f=${fd.key} .value=${v}
                      @input=${(e) => setField(fd.key, e.target.value)}></textarea>`
            : html`<input class="input is-small ${err ? "is-danger" : ""}" type="text" data-f=${fd.key} .value=${v}
                      ?readonly=${ro} title=${ro ? "Il codice non si modifica: lo usano le risorse e il gruppo degli utenti" : ""}
                      @input=${(e) => setField(fd.key, e.target.value)} />`}
          ${err ? html`<p class="help is-danger">${err}</p>` : ""}
        </div>`;
    };

    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${closeForm}></div>
        <div class="modal-card" style="max-width:46rem;width:calc(100% - 2rem)">
          <header class="modal-card-head">
            <p class="modal-card-title is-size-6">${f.mode === "create" ? "Nuova organizzazione" : "Modifica organizzazione"}</p>
            <button class="delete" aria-label="Chiudi" @click=${closeForm}></button>
          </header>
          <section class="modal-card-body">
            ${renamed
              ? html`<div class="notification is-warning is-light py-2 mb-3 is-size-7" data-org-rename-note>
                       Stai cambiando la denominazione. Le risorse già registrate${used ? ` (${used} con questo codice)` : ""} conservano il nome
                       che avevano: il nome si copia come testo, non si aggiorna da solo.
                     </div>`
              : ""}
            <div class="columns is-multiline is-variable is-1">
              ${st.fields.map(input)}
            </div>
            <div class="mt-2">
              <button class="button is-small is-info is-light" @click=${openPicker}>
                <span class="icon is-small"><i class="ri-map-pin-2-line"></i></span>
                <span>Scegli sulla mappa</span>
              </button>
            </div>
            ${f.error
              ? html`<div class="notification ${sessionDown ? "is-warning" : "is-danger"} is-light py-2 mt-3 mb-0">
                       ${sessionDown ? deps.sessionMessage : "Salvataggio non riuscito: " + f.error}
                       ${sessionDown ? html` <a href="cf_logout.php">Esci e rientra</a>` : ""}
                     </div>`
              : ""}
          </section>
          <footer class="modal-card-foot">
            <button class="button is-small is-primary ${f.busy ? "is-loading" : ""}"
              ?disabled=${f.busy || (f.mode === "edit" && !isDirty(f))} @click=${save}>
              <span class="icon is-small"><i class="ri-save-line"></i></span>
              <span>Salva</span>
            </button>
            <button class="button is-small" ?disabled=${f.busy} @click=${closeForm}>Annulla</button>
          </footer>
        </div>
      </div>`;
  }

  function template() {
    const { html } = deps;
    if (!st.loaded) return html`<progress class="progress is-small m-3" style="width:auto"></progress>`;
    const rows = visibleOrgs();
    const shown = rows.slice(0, SHOWN_MAX);
    const noCoords = st.orgs.filter((o) => !o.pos).length;
    const provs = [...new Set(st.orgs.map((o) => o.provincia).filter(Boolean))].sort();
    const mine = (deps.groupOrgCode?.() || "").toLowerCase();
    const sessionDown = st.error === deps.sessionMessage;

    return html`
      <style>${pickerCss}</style>
      <div class="box spa-title-box p-3">
        <div class="is-flex" style="gap:1rem;flex-wrap:wrap;align-items:flex-end">
          <div style="flex:1 1 260px;min-width:200px;max-width:420px">
            <label class="label is-small mb-1">Cerca</label>
            <div class="control has-icons-left">
              <input class="input is-small" type="search" placeholder="Denominazione, codice o comune…"
                data-orgs-search .value=${st.q} @input=${(e) => setQuery(e.target.value)} />
              <span class="icon is-left is-small"><i class="ri-search-line"></i></span>
            </div>
          </div>
          <div style="flex:0 0 150px">
            <label class="label is-small mb-1">Provincia</label>
            <div class="select is-small is-fullwidth">
              <select @change=${(e) => setProv(e.target.value)}>
                <option value="" ?selected=${!st.prov}>Tutte</option>
                ${provs.map((p) => html`<option value=${p} ?selected=${p === st.prov}>${p}</option>`)}
              </select>
            </div>
          </div>
          <label class="checkbox is-size-7" style="padding-bottom:.4rem">
            <input type="checkbox" ?checked=${st.onlyNoCoords} @change=${(e) => setNoCoords(e.target.checked)} />
            Solo senza coordinate (${noCoords})
          </label>
          <div style="margin-left:auto">
            ${st.perms.create
              ? html`<button class="button is-small is-primary" @click=${openNew}>
                       <span class="icon is-small"><i class="ri-add-line"></i></span>
                       <span>Nuova organizzazione</span>
                     </button>`
              : html`<button class="button is-small" disabled title=${st.permsNote || "Sola lettura"}>
                       <span class="icon is-small"><i class="ri-lock-line"></i></span>
                       <span>Sola lettura</span>
                     </button>`}
          </div>
        </div>
        ${st.permsNote ? html`<p class="help is-warning mt-2" data-org-perms-note>${st.permsNote}</p>` : ""}
      </div>

      ${st.error
        ? html`<div class="notification ${sessionDown ? "is-warning" : "is-danger"} is-light py-2 mb-3">
                 ${sessionDown ? deps.sessionMessage : "Elenco non disponibile: " + st.error}
                 ${sessionDown ? html` <a href="cf_logout.php">Esci e rientra</a>` : ""}
                 <button class="button is-small ml-2" @click=${() => { reset(); deps.rerender(); }}>Riprova</button>
               </div>`
        : ""}
      ${st.countsError
        ? html`<p class="help is-warning mb-2" data-org-counts-error>Numeri delle risorse non disponibili: ${st.countsError}</p>`
        : ""}

      <p class="is-size-7 mb-2" data-orgs-total>
        <strong>${rows.length}</strong> ${rows.length === 1 ? "organizzazione" : "organizzazioni"}${rows.length !== st.orgs.length ? ` su ${st.orgs.length}` : ""}.
        ${rows.length > SHOWN_MAX ? html`<span class="has-text-grey">Mostrate le prime ${SHOWN_MAX}: restringi la ricerca.</span>` : ""}
      </p>

      <div class="rm-dim table-container">
        <table class="table is-small is-narrow is-fullwidth is-hoverable is-striped">
          <thead>
            <tr>
              <th style="width:1%"></th>
              <th>Codice</th><th>Denominazione</th><th>Comune</th><th>Prov.</th>
              <th class="has-text-centered" title="Coordinate per la mappa">Coord.</th>
              <th class="has-text-right">Volontari</th><th class="has-text-right">Mezzi</th><th class="has-text-right">Materiali</th>
            </tr>
          </thead>
          <tbody>
            ${shown.length === 0
              ? html`<tr><td colspan="9" class="has-text-grey has-text-centered">Nessuna organizzazione.</td></tr>`
              : shown.map((o) => html`
                <tr class=${mine && o.code.toLowerCase() === mine ? "has-background-link-light" : ""}>
                  <td>
                    <button class="button is-small is-info is-light" ?disabled=${!st.perms.update}
                      title=${st.perms.update ? "Modifica" : "Sola lettura"} data-edit=${o.code}
                      @click=${() => openEdit(o)}>
                      <span class="icon is-small"><i class="ri-pencil-line"></i></span>
                    </button>
                  </td>
                  <td>${o.code}</td>
                  <td>${o.name}${mine && o.code.toLowerCase() === mine ? html` <span class="tag is-link is-light is-small">La tua</span>` : ""}</td>
                  <td>${o.comune}</td>
                  <td>${o.provincia}</td>
                  <td class="has-text-centered">
                    ${o.pos
                      ? html`<span class="icon is-small has-text-success" title="Coordinate presenti"><i class="ri-map-pin-2-line"></i></span>`
                      : html`<span class="icon is-small has-text-warning" title="Senza coordinate: le sue risorse non sono sulla mappa"><i class="ri-error-warning-line"></i></span>`}
                  </td>
                  ${["volontari", "mezzi", "materiali"].map((t) => {
                    const n = countOf(t, o);
                    return html`<td class="has-text-right">${n
                      ? html`<a class="rm-classlink" href="#" title="Apri l'elenco" data-open=${t + ":" + o.code}
                               @click=${(e) => { e.preventDefault(); deps.onOpen(t, { org: o.code }); }}>${n}</a>`
                      : n}</td>`;
                  })}
                </tr>`)}
          </tbody>
        </table>
      </div>

      ${formTemplate()}
      ${picker ? picker.template() : ""}
    `;
  }

  return { template, load, reset, afterRender, bind, state: st };
}
