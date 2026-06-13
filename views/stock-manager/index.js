// views/stock-manager/index.js — Movimentazioni Consumabili

// ---- costanti ---------------------------------------------------------------

const TIPI = ["CARICO", "SCARICO", "TRASFERIMENTO"];
const UDM      = ["pezzo", "bancale", "bottiglia", "Kg", "l", "confezione"];
const ARTICOLI = ["Sacco sabbia vuoto", "Sacco sabbia pieno", "Pasto", "Acqua"];
const PAGE_SIZE = 50;

const INCLUDE_MOV = [
  "id", "data/ora", "tipologia", "articolo", "quantita",
  "unita-di-misura", "magazzino-origine", "magazzino-destinazione",
  "servizio", "operatore", "note"
];

// ---- utils ------------------------------------------------------------------

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(v) { return String(v ?? "").trim(); }

function nowDateTime() {
  return new Date().toLocaleString("sv-SE", { hour12: false }).replace(",", "");
}

function normalizeError(e) {
  return String(e?.payload?.message || e?.message || e || "Errore sconosciuto");
}

function emptyModal(record) {
  if (record) {
    return {
      mode:                    "edit",
      editId:                  record.id,
      busy:                    false,
      error:                   null,
      tipo:                    norm(record.tipologia),
      articolo:                norm(record.articolo),
      "quantita":             norm(record["quantita"]),
      "unita-di-misura":      norm(record["unita-di-misura"]),
      "magazzino-origine":     norm(record["magazzino-origine"]),
      "magazzino-destinazione":norm(record["magazzino-destinazione"]),
      servizio:                norm(record.servizio),
      operatore:               norm(record.operatore),
      note:                    norm(record.note),
      "data/ora":              norm(record["data/ora"]),
    };
  }
  return {
    mode:                    "new",
    editId:                  null,
    busy:                    false,
    error:                   null,
    tipo:                    "",
    articolo:                "",
    "quantita":             "",
    "unita-di-misura":      "pezzo",
    "magazzino-origine":     "",
    "magazzino-destinazione":"",
    servizio:                "",
    operatore:               "",
    note:                    "",
    "data/ora":              nowDateTime(),
  };
}

// ---- giacenze ---------------------------------------------------------------

function buildGiacenze(movimentazioni) {
  const map = new Map(); // articolo → Map<magazzino, qty>

  function add(art, key, delta) {
    if (!art || !key) return;
    if (!map.has(art)) map.set(art, new Map());
    const inner = map.get(art);
    inner.set(key, (inner.get(key) || 0) + delta);
  }

  for (const m of movimentazioni) {
    const art  = norm(m.articolo);     if (!art) continue;
    const qty  = parseFloat(m["quantita"]) || 0;
    const dest = norm(m["magazzino-destinazione"]);
    const orig = norm(m["magazzino-origine"]);
    const tipo = norm(m.tipologia);

    if (tipo === "CARICO"        && dest) add(art, dest, +qty);
    if (tipo === "SCARICO"       && orig) add(art, orig, -qty);
    if (tipo === "TRASFERIMENTO" && dest) add(art, dest, +qty);
    if (tipo === "TRASFERIMENTO" && orig) add(art, orig, -qty);
  }

  return map;
}

function buildGiacenzeServizi(movimentazioni) {
  const map = new Map(); // articolo → Map<servizio, qty>

  function add(art, srv, delta) {
    if (!art || !srv) return;
    if (!map.has(art)) map.set(art, new Map());
    const inner = map.get(art);
    inner.set(srv, (inner.get(srv) || 0) + delta);
  }

  for (const m of movimentazioni) {
    const art = norm(m.articolo);  if (!art) continue;
    const srv = norm(m.servizio);  if (!srv) continue;
    const qty = parseFloat(m["quantita"]) || 0;
    const tipo = norm(m.tipologia);

    if (tipo === "SCARICO")        add(art, srv, +qty);  // magazzino scarica → servizio riceve
    else if (tipo === "CARICO")    add(art, srv, -qty);  // merce rientra al magazzino → servizio cede
  }

  return map;
}

// ---- main export ------------------------------------------------------------

export async function StockManager({ state, client, html, render, root }) {

  // --- local state ---
  let loading         = true;
  let error           = null;

  let movimentazioni  = [];
  let magazzini       = [];   // array di { nome, latitudine, longitudine }
  let servizi         = [];   // array di { nome, latitudine, longitudine }
  let magazziniNomi   = [];   // solo nomi, per le select
  let serviziNomi     = [];

  let activeTab       = "movimentazioni";

  // mappa
  let leafletMap      = null;
  let mapMarkers      = [];
  let markersByName   = new Map();
  let mapSidebarOpen  = true;
  let mapFullscreen   = false;
  let autoRefresh     = false;
  let autoRefreshTimer= null;
  let countdownSec    = 60;
  let mapResizeHandler= null;

  // filtri + paginazione
  let search          = "";
  let filterTipo      = "";
  let filterMagazzino = "";
  let filterArticolo  = "";
  let page            = 1;

  // modale new/edit
  let modal           = null;

  // delete confirm
  let deleteId        = null;
  let deleteBusy      = false;
  let deleteError     = null;

  // ---

  function rerender() { render(view(), root); }

  // ---- caricamento dati -----------------------------------------------------

  async function load(silent = false) {
    const wasFullscreen = mapFullscreen;
    if (!silent) { loading = true; error = null; rerender(); }
    try {
      const [resMov, resMag, resSrv] = await Promise.all([
        client.table("mov-consumabili").list({ include: INCLUDE_MOV, size: 5000 }),
        client.table("magazzini").list({ include: ["nome", "latitudine", "longitudine", "colore", "lettera"], size: 500 }),
        client.table("servizi").list({ include: ["nome", "latitudine", "longitudine", "colore", "lettera"], size: 500 }),
      ]);

      movimentazioni = getRecords(resMov)
        .sort((a, b) => norm(b["data/ora"]).localeCompare(norm(a["data/ora"])));

      magazzini = getRecords(resMag)
        .filter(r => norm(r.nome))
        .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome), "it"));

      servizi = getRecords(resSrv)
        .filter(r => norm(r.nome))
        .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome), "it"));

      magazziniNomi = magazzini.map(r => norm(r.nome));
      serviziNomi   = servizi.map(r => norm(r.nome));

    } catch (e) { if (!silent) error = e; }
    loading = false; rerender();
  }

  // ---- filtri ---------------------------------------------------------------

  function applyFilters(m) {
    if (filterTipo      && norm(m.tipologia) !== filterTipo) return false;
    if (filterMagazzino) {
      const o = norm(m["magazzino-origine"]);
      const d = norm(m["magazzino-destinazione"]);
      if (o !== filterMagazzino && d !== filterMagazzino) return false;
    }
    if (filterArticolo  && norm(m.articolo) !== filterArticolo) return false;
    if (search) {
      const q = search.toLocaleLowerCase("it");
      const hay = [
        m["data/ora"], m.tipologia, m.articolo, m["quantita"],
        m["unita-di-misura"], m["magazzino-origine"], m["magazzino-destinazione"],
        m.servizio, m.operatore, m.note
      ].map(v => norm(v)).join(" ").toLocaleLowerCase("it");
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function setFilter(key, val) {
    if (key === "search")          search          = val;
    else if (key === "tipo")       filterTipo      = val;
    else if (key === "magazzino")  filterMagazzino = val;
    else if (key === "articolo")   filterArticolo  = val;
    page = 1;
    rerender();
  }

  function distinctArticoli() {
    return Array.from(new Set(movimentazioni.map(m => norm(m.articolo)).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, "it"));
  }

  // ---- modale new/edit ------------------------------------------------------

  function openModal(record) {
    modal = emptyModal(record || null);
    rerender();
  }

  function closeModal() {
    if (modal?.busy) return;
    modal = null;
    rerender();
  }

  function setModalField(key, val) {
    if (!modal) return;
    modal = { ...modal, [key]: val, error: null };
    if (key === "tipo") {
      if (val === "CARICO")  modal["magazzino-origine"]      = "";
      if (val === "SCARICO") modal["magazzino-destinazione"] = "";
    }
    rerender();
  }

  function validateModal() {
    if (!modal.tipo)     return "Seleziona il tipo di movimentazione.";
    if (!modal.articolo) return "Il campo Articolo è obbligatorio.";
    const qty = parseFloat(modal["quantita"]);
    if (!qty || qty <= 0) return "La quantità deve essere un numero positivo.";
    if (modal.tipo !== "SCARICO" && !modal["magazzino-destinazione"])
      return "Seleziona il magazzino di destinazione.";
    if (modal.tipo !== "CARICO" && !modal["magazzino-origine"])
      return "Seleziona il magazzino di origine.";
    return null;
  }

  async function confirmModal() {
    if (!modal || modal.busy) return;

    const err = validateModal();
    if (err) { modal = { ...modal, error: err }; rerender(); return; }

    modal = { ...modal, busy: true, error: null };
    rerender();

    try {
      const payload = { "data/ora": modal["data/ora"] };
      payload.tipologia            = modal.tipo;
      payload.articolo             = modal.articolo;
      payload["quantita"]         = parseFloat(modal["quantita"]);
      if (modal["unita-di-misura"])        payload["unita-di-misura"]        = modal["unita-di-misura"];
      if (modal["magazzino-origine"])       payload["magazzino-origine"]        = modal["magazzino-origine"];
      if (modal["magazzino-destinazione"])  payload["magazzino-destinazione"]   = modal["magazzino-destinazione"];
      if (modal.servizio)                   payload.servizio                    = modal.servizio;
      if (modal.operatore)                  payload.operatore                   = modal.operatore;
      if (modal.note)                       payload.note                        = modal.note;

      if (modal.mode === "edit") {
        await client.table("mov-consumabili").update(modal.editId, payload);
      } else {
        await client.table("mov-consumabili").create(payload);
      }
      modal = null;
      await load();
    } catch (e) {
      modal = { ...modal, busy: false, error: normalizeError(e) };
      rerender();
    }
  }

  // ---- delete ---------------------------------------------------------------

  function askDelete(id) {
    deleteId    = id;
    deleteError = null;
    rerender();
  }

  function cancelDelete() {
    deleteId    = null;
    deleteError = null;
    rerender();
  }

  async function confirmDelete() {
    if (!deleteId || deleteBusy) return;
    deleteBusy = true; deleteError = null; rerender();
    try {
      await client.table("mov-consumabili").remove(deleteId);
      deleteId = null;
      await load();
    } catch (e) {
      deleteError = normalizeError(e);
      deleteBusy  = false;
      rerender();
    }
    deleteBusy = false;
  }

  // ---- rendering ------------------------------------------------------------

  function renderToolbar(articoli) {
    return html`
      <div style="
        display:flex; align-items:center; flex-wrap:wrap; gap:10px;
        padding:12px 1.25rem; background:#f8f9fa; border-bottom:1px solid #e8e8e8;
      ">
        <div class="field has-addons mb-0" style="flex:1;min-width:180px;max-width:300px">
          <div class="control is-expanded">
            <input class="input is-small" type="text" placeholder="Cerca…"
              .value=${search}
              @input=${e => setFilter("search", e.target.value)}
            />
          </div>
          ${search ? html`
            <div class="control">
              <button class="button is-small" @click=${() => setFilter("search", "")}>✕</button>
            </div>
          ` : ""}
        </div>

        <div class="select is-small">
          <select @change=${e => setFilter("tipo", e.target.value)}>
            <option value="" ?selected=${filterTipo === ""}>Tutti i tipi</option>
            ${TIPI.map(t => html`<option value=${t} ?selected=${filterTipo === t}>${t}</option>`)}
          </select>
        </div>

        ${magazziniNomi.length > 0 ? html`
          <div class="select is-small">
            <select @change=${e => setFilter("magazzino", e.target.value)}>
              <option value="" ?selected=${filterMagazzino === ""}>Tutti i magazzini</option>
              ${magazziniNomi.map(m => html`<option value=${m} ?selected=${filterMagazzino === m}>${m}</option>`)}
            </select>
          </div>
        ` : ""}

        ${articoli.length > 0 ? html`
          <div class="select is-small">
            <select @change=${e => setFilter("articolo", e.target.value)}>
              <option value="" ?selected=${filterArticolo === ""}>Tutti gli articoli</option>
              ${articoli.map(a => html`<option value=${a} ?selected=${filterArticolo === a}>${a}</option>`)}
            </select>
          </div>
        ` : ""}

        <div style="flex:1"></div>

        <button class="button is-primary is-small" @click=${() => openModal()}>
          <span class="icon"><i class="ri-add-line"></i></span>
          <span>Nuova movimentazione</span>
        </button>
        <button class="button is-small is-light" @click=${load}>
          <span class="icon"><i class="ri-refresh-line"></i></span>
        </button>
      </div>
    `;
  }

  function tipoTag(tipo) {
    const t = norm(tipo);
    if (t === "CARICO")        return html`<span class="tag is-success is-light">CARICO</span>`;
    if (t === "SCARICO")       return html`<span class="tag is-danger is-light">SCARICO</span>`;
    if (t === "TRASFERIMENTO") return html`<span class="tag is-info is-light">TRASF.</span>`;
    return html`<span class="tag is-light">${t || "—"}</span>`;
  }

  function renderTabMovimentazioni(articoli) {
    const filtered   = movimentazioni.filter(applyFilters);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const pageItems  = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return html`
      ${renderToolbar(articoli)}

      <!-- delete confirm banner -->
      ${deleteId ? html`
        <div class="notification is-warning is-light m-3 py-2 px-3" style="display:flex;align-items:center;gap:10px;font-size:.85rem">
          <span><i class="ri-error-warning-line"></i> Eliminare questa movimentazione?</span>
          ${deleteError ? html`<span class="has-text-danger">${deleteError}</span>` : ""}
          <div style="margin-left:auto;display:flex;gap:6px">
            <button class="button is-danger is-small ${deleteBusy ? 'is-loading' : ''}"
              ?disabled=${deleteBusy} @click=${confirmDelete}>
              Sì, elimina
            </button>
            <button class="button is-small" ?disabled=${deleteBusy} @click=${cancelDelete}>
              Annulla
            </button>
          </div>
        </div>
      ` : ""}

      <div class="table-container" style="padding:0 1.25rem 1rem">
        <table class="table is-striped is-hoverable is-fullwidth is-size-7 mt-3">
          <thead>
            <tr>
              <th>Data/Ora</th>
              <th>Tipo</th>
              <th>Articolo</th>
              <th style="text-align:right">Qtà</th>
              <th>U.M.</th>
              <th>Da</th>
              <th>A</th>
              <th>Servizio</th>
              <th>Operatore</th>
              <th>Note</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${pageItems.length === 0 ? html`
              <tr><td colspan="11" class="has-text-grey has-text-centered py-4">
                ${search || filterTipo || filterMagazzino || filterArticolo
                  ? "Nessun risultato per i filtri selezionati."
                  : "Nessuna movimentazione registrata."}
              </td></tr>
            ` : pageItems.map(m => html`
              <tr style="${deleteId === m.id ? 'background:#fff8e1' : ''}">
                <td style="white-space:nowrap">${norm(m["data/ora"]) || "—"}</td>
                <td>${tipoTag(m.tipologia)}</td>
                <td><strong>${norm(m.articolo) || "—"}</strong></td>
                <td style="text-align:right">${norm(m["quantita"]) || "—"}</td>
                <td>${norm(m["unita-di-misura"]) || "—"}</td>
                <td>${norm(m["magazzino-origine"]) || html`<span class="has-text-grey">—</span>`}</td>
                <td>${norm(m["magazzino-destinazione"]) || html`<span class="has-text-grey">—</span>`}</td>
                <td>${norm(m.servizio) || html`<span class="has-text-grey">—</span>`}</td>
                <td>${norm(m.operatore) || html`<span class="has-text-grey">—</span>`}</td>
                <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"
                    title="${norm(m.note)}">${norm(m.note) || ""}</td>
                <td style="white-space:nowrap;text-align:right">
                  <button class="button is-ghost is-small px-1" title="Modifica"
                    @click=${() => openModal(m)}>
                    <span class="icon is-small"><i class="ri-pencil-line"></i></span>
                  </button>
                  <button class="button is-ghost is-small px-1 has-text-danger" title="Elimina"
                    @click=${() => askDelete(m.id)}>
                    <span class="icon is-small"><i class="ri-delete-bin-line"></i></span>
                  </button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>

      ${totalPages > 1 ? html`
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding-bottom:1rem">
          <button class="button is-small" ?disabled=${safePage === 1}
            @click=${() => { page = safePage - 1; rerender(); }}>
            <span class="icon"><i class="ri-arrow-left-s-line"></i></span>
          </button>
          <span class="is-size-7 has-text-grey">
            Pagina <strong>${safePage}</strong> di <strong>${totalPages}</strong>
            &nbsp;·&nbsp; ${filtered.length} risultati
          </span>
          <button class="button is-small" ?disabled=${safePage === totalPages}
            @click=${() => { page = safePage + 1; rerender(); }}>
            <span class="icon"><i class="ri-arrow-right-s-line"></i></span>
          </button>
        </div>
      ` : html`
        <div style="padding-bottom:1rem;text-align:center">
          <span class="is-size-7 has-text-grey">${filtered.length} movimentazion${filtered.length === 1 ? "e" : "i"}</span>
        </div>
      `}
    `;
  }

  function renderGiacenzeTable(giacenze, emptyMsg) {
    if (giacenze.size === 0) {
      return html`<p class="has-text-grey is-size-7 py-3">${emptyMsg}</p>`;
    }
    const colSet = new Set();
    for (const inner of giacenze.values()) for (const k of inner.keys()) colSet.add(k);
    const cols     = Array.from(colSet).sort((a, b) => a.localeCompare(b, "it"));
    const articoli = Array.from(giacenze.keys()).sort((a, b) => a.localeCompare(b, "it"));

    return html`
      <div class="table-container">
        <table class="table is-bordered is-striped is-hoverable is-fullwidth is-size-7">
          <thead>
            <tr>
              <th>Articolo</th>
              ${cols.map(c => html`<th style="text-align:right">${c}</th>`)}
              <th style="text-align:right;background:#f0f4ff"><strong>Totale</strong></th>
            </tr>
          </thead>
          <tbody>
            ${articoli.map(art => {
              const inner = giacenze.get(art);
              const vals  = cols.map(c => inner.get(c) || 0);
              const tot   = vals.reduce((s, v) => s + v, 0);
              return html`
                <tr>
                  <td><strong>${art}</strong></td>
                  ${vals.map(v => html`
                    <td style="text-align:right;${v < 0 ? 'color:#c0392b;font-weight:600' : ''}">
                      ${v === 0 ? html`<span class="has-text-grey">—</span>` : v}
                    </td>
                  `)}
                  <td style="text-align:right;background:#f0f4ff;font-weight:600;${tot < 0 ? 'color:#c0392b' : ''}">
                    ${tot}
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTabGiacenze() {
    const giacenzeMag = buildGiacenze(movimentazioni);
    const giacenzeSrv = buildGiacenzeServizi(movimentazioni);
    const totMov      = movimentazioni.length;

    return html`
      <div style="padding:1rem 1.25rem">

        <p class="is-size-6 has-text-weight-semibold mb-2">
          <i class="ri-home-gear-line"></i> Per magazzino
        </p>
        ${renderGiacenzeTable(giacenzeMag, "Nessuna movimentazione con magazzino registrata.")}

        <p class="is-size-6 has-text-weight-semibold mb-2 mt-4">
          <i class="ri-list-check-2"></i> Per servizio
        </p>
        ${renderGiacenzeTable(giacenzeSrv, "Nessuna movimentazione con servizio associato.")}

        <p class="is-size-7 has-text-grey mt-3">
          <i class="ri-information-line"></i>
          Giacenze calcolate da ${totMov} movimentazion${totMov === 1 ? "e" : "i"}.
          Valori negativi in rosso indicano possibili errori di inserimento.
        </p>
      </div>
    `;
  }

  // ---- mappa ----------------------------------------------------------------

  async function loadLeaflet() {
    if (window.L) return;
    await new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel  = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.3/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src   = "https://unpkg.com/leaflet@1.9.3/dist/leaflet.js";
      script.onload  = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function traduciColore(c) {
    return ({ rosso:"red", nero:"black", blu:"blue", verde:"green",
              grigio:"grey", arancione:"orange", viola:"purple",
              bianco:"white", giallo:"yellow" })[String(c).toLowerCase()] || "red";
  }

  function markerIconUrl(colore, lettera) {
    const base = "plugins/segreteria-campo/templates/images";
    if (lettera) return `${base}/en/marker_${traduciColore(colore)}${String(lettera).toUpperCase()}.png`;
    if (colore)  return `${base}/it/marker_${colore}.png`;
    return `${base}/it/marker_rosso.png`;
  }

  function giacenzePerLocation(nome, tipo) {
    const lines = [];
    for (const mov of movimentazioni) {
      const art = norm(mov.articolo); if (!art) continue;
      const qty = parseFloat(mov["quantita"]) || 0;
      if (tipo === "magazzino") {
        const dest = norm(mov["magazzino-destinazione"]);
        const orig = norm(mov["magazzino-origine"]);
        const t    = norm(mov.tipologia);
        if (t === "CARICO"        && dest === nome) lines.push([art, +qty]);
        if (t === "SCARICO"       && orig === nome) lines.push([art, -qty]);
        if (t === "TRASFERIMENTO" && dest === nome) lines.push([art, +qty]);
        if (t === "TRASFERIMENTO" && orig === nome) lines.push([art, -qty]);
      } else {
        if (norm(mov.servizio) !== nome) continue;
        const t = norm(mov.tipologia);
        if (t === "SCARICO")         lines.push([art, +qty]);
        else if (t === "CARICO")     lines.push([art, -qty]);
      }
    }
    const agg = new Map();
    for (const [art, qty] of lines) agg.set(art, (agg.get(art) || 0) + qty);
    return agg;
  }

  function fitMapHeight() {
    const el = document.getElementById("sm-map-container");
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - window.scrollY;
    const h   = Math.max(300, window.innerHeight - Math.round(el.getBoundingClientRect().top) - 8);
    el.style.height = h + "px";
    const sidebar = el.previousElementSibling?.previousElementSibling;
    if (sidebar && sidebar.style.width === "260px") sidebar.style.height = h + "px";
    if (leafletMap) leafletMap.invalidateSize();
  }

  async function initMap() {
    const container = document.getElementById("sm-map-container");
    if (!container) return;

    await loadLeaflet();
    const L = window.L;

    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    markersByName.clear();

    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    const satLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
    });

    leafletMap = L.map(container, { center: [41.87, 12.57], zoom: 6, layers: [osmLayer] });
    L.control.layers({ "OpenStreetMap": osmLayer, "Satellite": satLayer }).addTo(leafletMap);

    const bounds = new L.LatLngBounds();

    function popupHtml(nome, tipo) {
      const g = giacenzePerLocation(nome, tipo);
      let rows = "";
      for (const [art, qty] of g) {
        const style = qty < 0 ? "color:#c0392b;font-weight:600" : "";
        rows += `<tr><td>${art}</td><td style="text-align:right;${style}">${qty}</td></tr>`;
      }
      const table = rows
        ? `<table style="font-size:.8rem;border-collapse:collapse;margin-top:6px"><thead><tr><th>Articolo</th><th style="text-align:right;padding-left:12px">Qtà</th></tr></thead><tbody>${rows}</tbody></table>`
        : `<p style="font-size:.8rem;color:#888;margin-top:4px">Nessuna giacenza</p>`;
      const badge = tipo === "magazzino"
        ? `<span style="background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:1px 6px;font-size:.7rem;margin-left:4px">Magazzino</span>`
        : `<span style="background:#dcfce7;color:#15803d;border-radius:4px;padding:1px 6px;font-size:.7rem;margin-left:4px">Servizio</span>`;
      return `<div style="min-width:180px"><strong>${nome}</strong>${badge}${table}</div>`;
    }

    for (const r of magazzini) {
      const lat = parseFloat(r.latitudine), lon = parseFloat(r.longitudine);
      if (!lat || !lon) continue;
      const nome = norm(r.nome);
      const icon = L.icon({ iconUrl: markerIconUrl(norm(r.colore), norm(r.lettera)), iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34] });
      const mMag = L.marker([lat, lon], { icon }).addTo(leafletMap).bindPopup(popupHtml(nome, "magazzino"));
      markersByName.set(nome, { marker: mMag, lat, lon });
      bounds.extend([lat, lon]);
    }

    for (const r of servizi) {
      const lat = parseFloat(r.latitudine), lon = parseFloat(r.longitudine);
      if (!lat || !lon) continue;
      const nome = norm(r.nome);
      const icon = L.icon({ iconUrl: markerIconUrl(norm(r.colore), norm(r.lettera)), iconSize: [25,41], iconAnchor: [12,41], popupAnchor: [1,-34] });
      const mSrv = L.marker([lat, lon], { icon }).addTo(leafletMap).bindPopup(popupHtml(nome, "servizio"));
      markersByName.set(nome, { marker: mSrv, lat, lon });
      bounds.extend([lat, lon]);
    }

    if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [40, 40] });

    // adatta altezza al viewport reale e resta aggiornato sul resize
    setTimeout(fitMapHeight, 0);
    if (!mapResizeHandler) {
      mapResizeHandler = () => fitMapHeight();
      window.addEventListener("resize", mapResizeHandler);
    }
  }

  function flyToLocation(nome) {
    const entry = markersByName.get(nome);
    if (!entry || !leafletMap) return;
    leafletMap.flyTo([entry.lat, entry.lon], 14);
    entry.marker.openPopup();
  }

  function pivotByLocation(giacenze) {
    // giacenze: Map<articolo, Map<location, qty>>
    // → Map<location, Map<articolo, qty>>
    const out = new Map();
    for (const [art, inner] of giacenze) {
      for (const [loc, qty] of inner) {
        if (!out.has(loc)) out.set(loc, new Map());
        out.get(loc).set(art, (out.get(loc).get(art) || 0) + qty);
      }
    }
    return out;
  }

  function renderMapSidebar() {
    const byMag = pivotByLocation(buildGiacenze(movimentazioni));
    const bySrv = pivotByLocation(buildGiacenzeServizi(movimentazioni));

    function locationBlock(nome, byLocation, badge) {
      const g = byLocation.get(nome);
      if (!g) return "";
      const rows = Array.from(g.entries()).filter(([, q]) => q !== 0);
      if (!rows.length) return "";
      return html`
        <div style="margin-bottom:.75rem;cursor:pointer" title="Centra sulla mappa"
          @click=${() => flyToLocation(nome)}>
          <div style="font-size:.8rem;font-weight:600;margin-bottom:2px">
            ${badge} ${nome}
          </div>
          ${rows.map(([art, qty]) => html`
            <div style="display:flex;justify-content:space-between;font-size:.78rem;padding:1px 0 1px 8px;
                        ${qty < 0 ? 'color:#c0392b' : 'color:#333'}">
              <span>${art}</span>
              <span style="font-weight:600;margin-left:8px">${qty}</span>
            </div>
          `)}
        </div>
      `;
    }

    const magBadge = html`<span style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:0 4px;font-size:.7rem">MAG</span>`;
    const srvBadge = html`<span style="background:#dcfce7;color:#15803d;border-radius:3px;padding:0 4px;font-size:.7rem">SRV</span>`;

    const magBlocks = magazzini.map(r => locationBlock(norm(r.nome), byMag, magBadge)).filter(Boolean);
    const srvBlocks = servizi.map(r => locationBlock(norm(r.nome), bySrv, srvBadge)).filter(Boolean);
    const empty     = magBlocks.length === 0 && srvBlocks.length === 0;

    return html`
      <div style="width:260px;flex-shrink:0;overflow-y:auto;height:100%;
                  border-right:1px solid #e8e8e8;padding:.75rem;background:#fafafa">
        <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.05em;color:#888;margin-bottom:.5rem">
          Giacenze per location
        </div>
        ${empty ? html`<p class="has-text-grey is-size-7">Nessuna giacenza.</p>` : ""}
        ${magBlocks}
        ${srvBlocks}
      </div>
    `;
  }

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      countdownSec = 60;
      autoRefreshTimer = setInterval(() => {
        countdownSec--;
        if (countdownSec <= 0) {
          countdownSec = 60;
          load(true);
        } else {
          rerender();
        }
      }, 1000);
    } else {
      clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
      countdownSec = 60;
    }
    rerender();
  }

  function toggleFullscreen() {
    const wrapper = document.getElementById("sm-map-wrapper");
    if (!wrapper) return;
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  function onFullscreenChange() {
    mapFullscreen = !!document.fullscreenElement;
    rerender();
    setTimeout(fitMapHeight, 50);
  }

  function renderTabMappa() {
    if (!leafletMap) setTimeout(initMap, 0);

    const toggleSidebar = () => {
      mapSidebarOpen = !mapSidebarOpen;
      rerender();
      setTimeout(fitMapHeight, 50);
    };

    const mapHeight = mapFullscreen ? "100vh" : "70vh";

    return html`
      <div id="sm-map-wrapper"
        style="display:flex;flex-direction:column;background:#fff"
        @fullscreenchange=${onFullscreenChange}>

        <!-- toolbar visibile solo in fullscreen -->
        ${mapFullscreen ? html`
          <div style="display:flex;align-items:center;gap:6px;padding:4px 10px;
                      background:#f8f9fa;border-bottom:1px solid #e8e8e8;flex-shrink:0">
            <div style="flex:1"></div>
            <button class="button is-small ${autoRefresh ? 'is-success' : 'is-light'}"
              @click=${toggleAutoRefresh}
              title="${autoRefresh ? 'Auto-refresh attivo — click per disattivare' : 'Attiva auto-refresh ogni minuto'}">
              <span class="icon is-small"><i class="ri-refresh-line ${autoRefresh ? 'ri-spin' : ''}"></i></span>
              <span>${autoRefresh ? html`Live <span style="opacity:.7;font-size:.85em">${countdownSec}s</span>` : 'Auto-refresh'}</span>
            </button>
            <button class="button is-small is-light" @click=${toggleFullscreen}
              title="Esci da schermo intero">
              <span class="icon is-small"><i class="ri-fullscreen-exit-line"></i></span>
            </button>
          </div>
        ` : ""}

        <!-- corpo: sidebar + mappa -->
        <div style="display:flex;position:relative">

          <!-- sidebar -->
          ${mapSidebarOpen ? renderMapSidebar() : ""}

          <!-- linguetta toggle -->
          <div @click=${toggleSidebar} style="
            position:absolute;
            top:50%;
            left:${mapSidebarOpen ? "260px" : "0"};
            transform:translateY(-50%);
            z-index:1000;
            cursor:pointer;
            background:#fff;
            border:1px solid #ccc;
            border-left:${mapSidebarOpen ? "none" : "1px solid #ccc"};
            border-radius:0 4px 4px 0;
            padding:6px 3px;
            box-shadow:2px 0 4px #0001;
            color:#555;
            user-select:none;
          " title="${mapSidebarOpen ? 'Chiudi pannello' : 'Apri pannello giacenze'}">
            <i class="${mapSidebarOpen ? 'ri-arrow-left-s-line' : 'ri-arrow-right-s-line'}"></i>
          </div>

          <!-- mappa: l'altezza viene impostata da fitMapHeight() -->
          <div id="sm-map-container" style="flex:1;min-width:0;min-height:300px"></div>
        </div>
      </div>
    `;
  }

  function renderModal() {
    if (!modal) return "";

    const isCarico     = modal.tipo === "CARICO";
    const isScarico    = modal.tipo === "SCARICO";
    const origDisabled = isCarico  || !modal.tipo;
    const destDisabled = isScarico || !modal.tipo;
    const isEdit       = modal.mode === "edit";
    const articoli     = distinctArticoli();

    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${closeModal}></div>
        <div class="modal-card" style="max-width:560px;width:95vw">
          <header class="modal-card-head">
            <p class="modal-card-title">
              <i class="ri-exchange-box-line"></i>
              ${isEdit ? "Modifica movimentazione" : "Nuova movimentazione"}
            </p>
            <button class="delete" ?disabled=${modal.busy} @click=${closeModal}></button>
          </header>

          <section class="modal-card-body">

            ${modal.error ? html`
              <div class="notification is-danger is-light py-2 px-3 mb-3" style="font-size:.85rem">
                ${modal.error}
              </div>
            ` : ""}

            <!-- data/ora -->
            <div class="field mb-3">
              <label class="label is-small">Data/Ora
                ${!isEdit ? html`<span class="tag is-light is-small ml-1">automatica</span>` : ""}
              </label>
              <div class="control">
                <input class="input is-small" type="text"
                  .value=${modal["data/ora"]}
                  ?disabled=${!isEdit || modal.busy}
                  @input=${e => setModalField("data/ora", e.target.value)}
                />
              </div>
            </div>

            <!-- tipo -->
            <div class="field mb-3">
              <label class="label is-small">Tipo <span class="has-text-danger">*</span></label>
              <div class="control">
                <div class="select is-small is-fullwidth">
                  <select ?disabled=${modal.busy}
                    @change=${e => setModalField("tipo", e.target.value)}>
                    <option value="" ?selected=${!modal.tipo}>— seleziona —</option>
                    ${TIPI.map(t => html`<option value=${t} ?selected=${modal.tipo === t}>${t}</option>`)}
                  </select>
                </div>
              </div>
            </div>

            <!-- articolo + quantita + udm -->
            <div style="display:grid;grid-template-columns:1fr auto auto;gap:.5rem;margin-bottom:.75rem">
              <div class="field mb-0">
                <label class="label is-small">Articolo <span class="has-text-danger">*</span></label>
                <div class="control">
                  <input class="input is-small" type="text"
                    list="sm-articoli-list"
                    placeholder="Es. Sacco sabbia"
                    .value=${modal.articolo}
                    ?disabled=${modal.busy}
                    @input=${e => setModalField("articolo", e.target.value)}
                  />
                  <datalist id="sm-articoli-list">
                    ${Array.from(new Set([...ARTICOLI, ...articoli])).map(a => html`<option value="${a}"></option>`)}
                  </datalist>
                </div>
              </div>
              <div class="field mb-0" style="width:90px">
                <label class="label is-small">Quantità <span class="has-text-danger">*</span></label>
                <div class="control">
                  <input class="input is-small" type="number" min="0" step="1"
                    placeholder="0"
                    .value=${modal["quantita"]}
                    ?disabled=${modal.busy}
                    @input=${e => setModalField("quantita", e.target.value)}
                  />
                </div>
              </div>
              <div class="field mb-0" style="width:120px">
                <label class="label is-small">U.M.</label>
                <div class="control">
                  <div class="select is-small is-fullwidth">
                    <select ?disabled=${modal.busy}
                      @change=${e => setModalField("unita-di-misura", e.target.value)}>
                      <option value="" ?selected=${!modal["unita-di-misura"]}>—</option>
                      ${UDM.map(u => html`<option value=${u} ?selected=${modal["unita-di-misura"] === u}>${u}</option>`)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- magazzino origine + destinazione -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.75rem">
              <div class="field mb-0">
                <label class="label is-small" style="${origDisabled ? 'color:#aaa' : ''}">
                  Magazzino origine
                  ${!isCarico && modal.tipo ? html`<span class="has-text-danger">*</span>` : ""}
                </label>
                <div class="control">
                  <div class="select is-small is-fullwidth">
                    <select ?disabled=${origDisabled || modal.busy}
                      @change=${e => setModalField("magazzino-origine", e.target.value)}>
                      <option value="" ?selected=${!modal["magazzino-origine"]}>—</option>
                      ${magazziniNomi.map(m => html`
                        <option value=${m} ?selected=${modal["magazzino-origine"] === m}>${m}</option>
                      `)}
                    </select>
                  </div>
                </div>
              </div>
              <div class="field mb-0">
                <label class="label is-small" style="${destDisabled ? 'color:#aaa' : ''}">
                  Magazzino destinazione
                  ${!isScarico && modal.tipo ? html`<span class="has-text-danger">*</span>` : ""}
                </label>
                <div class="control">
                  <div class="select is-small is-fullwidth">
                    <select ?disabled=${destDisabled || modal.busy}
                      @change=${e => setModalField("magazzino-destinazione", e.target.value)}>
                      <option value="" ?selected=${!modal["magazzino-destinazione"]}>—</option>
                      ${magazziniNomi.map(m => html`
                        <option value=${m} ?selected=${modal["magazzino-destinazione"] === m}>${m}</option>
                      `)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <!-- servizio -->
            <div class="field mb-3">
              <label class="label is-small">Servizio <span class="has-text-grey">(opzionale)</span></label>
              <div class="control">
                <div class="select is-small is-fullwidth">
                  <select ?disabled=${modal.busy}
                    @change=${e => setModalField("servizio", e.target.value)}>
                    <option value="" ?selected=${!modal.servizio}>—</option>
                    ${serviziNomi
                      .filter(s => s !== "IN ATTESA DI SERVIZIO" && s !== "USCITA DEFINITIVA")
                      .map(s => html`
                        <option value=${s} ?selected=${modal.servizio === s}>${s}</option>
                      `)}
                  </select>
                </div>
              </div>
            </div>

            <!-- operatore + note -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
              <div class="field mb-0">
                <label class="label is-small">Operatore</label>
                <div class="control">
                  <input class="input is-small" type="text"
                    placeholder="Nome operatore"
                    .value=${modal.operatore}
                    ?disabled=${modal.busy}
                    @input=${e => setModalField("operatore", e.target.value)}
                  />
                </div>
              </div>
              <div class="field mb-0">
                <label class="label is-small">Note</label>
                <div class="control">
                  <input class="input is-small" type="text"
                    placeholder="Note libere"
                    .value=${modal.note}
                    ?disabled=${modal.busy}
                    @input=${e => setModalField("note", e.target.value)}
                  />
                </div>
              </div>
            </div>

          </section>

          <footer class="modal-card-foot" style="gap:8px">
            <button class="button is-primary ${modal.busy ? 'is-loading' : ''}"
              ?disabled=${modal.busy} @click=${confirmModal}>
              ${isEdit ? "Salva modifiche" : "Conferma"}
            </button>
            <button class="button" ?disabled=${modal.busy} @click=${closeModal}>Annulla</button>
          </footer>
        </div>
      </div>
    `;
  }

  // ---- view principale ------------------------------------------------------

  function view() {
    if (loading) {
      return html`
        <section class="section">
          <div class="container has-text-centered">
            <p class="has-text-grey mb-2">Caricamento dati…</p>
            <progress class="progress is-primary" style="max-width:400px;margin:0 auto"></progress>
          </div>
        </section>
      `;
    }

    if (error) {
      return html`
        <section class="section">
          <div class="container">
            <article class="message is-danger">
              <div class="message-header"><p>Errore caricamento</p></div>
              <div class="message-body">
                <p>${normalizeError(error)}</p>
                <button class="button is-light mt-3" @click=${load}>🔄 Riprova</button>
              </div>
            </article>
          </div>
        </section>
      `;
    }

    const articoli = distinctArticoli();

    return html`
      <div class="box" style="padding:0;overflow:hidden;margin:.75rem">

        <!-- Tab bar -->
        <div class="tabs is-boxed is-small mb-0"
          style="padding:0 1.25rem;border-bottom:1px solid #dbdbdb;position:relative">
          <ul>
            <li class="${activeTab === "movimentazioni" ? "is-active" : ""}">
              <a @click=${() => { activeTab = "movimentazioni"; rerender(); }}>
                <span class="icon is-small"><i class="ri-exchange-box-line"></i></span>
                <span>Movimentazioni</span>
              </a>
            </li>
            <li class="${activeTab === "giacenze" ? "is-active" : ""}">
              <a @click=${() => { activeTab = "giacenze"; rerender(); }}>
                <span class="icon is-small"><i class="ri-home-gear-line"></i></span>
                <span>Giacenze</span>
              </a>
            </li>
            <li class="${activeTab === "mappa" ? "is-active" : ""}">
              <a @click=${() => { activeTab = "mappa"; rerender(); }}>
                <span class="icon is-small"><i class="ri-map-2-line"></i></span>
                <span>Mappa</span>
              </a>
            </li>
          </ul>
          ${activeTab === "mappa" ? html`
            <div style="position:absolute;right:.75rem;top:50%;transform:translateY(-50%);display:flex;gap:6px;align-items:center">
              <button class="button is-small ${autoRefresh ? 'is-success' : 'is-light'}"
                @click=${toggleAutoRefresh}
                title="${autoRefresh ? 'Auto-refresh attivo — click per disattivare' : 'Attiva auto-refresh ogni minuto'}">
                <span class="icon is-small"><i class="ri-refresh-line ${autoRefresh ? 'ri-spin' : ''}"></i></span>
                <span>${autoRefresh ? html`Live <span style="opacity:.7;font-size:.85em">${countdownSec}s</span>` : 'Auto-refresh'}</span>
              </button>
              <button class="button is-small is-light" @click=${toggleFullscreen}
                title="${mapFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}">
                <span class="icon is-small">
                  <i class="${mapFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'}"></i>
                </span>
              </button>
            </div>
          ` : ""}
        </div>

        ${activeTab === "movimentazioni"
          ? renderTabMovimentazioni(articoli)
          : activeTab === "giacenze"
          ? renderTabGiacenze()
          : renderTabMappa()
        }

      </div>

      ${renderModal()}
    `;
  }

  // ---- avvio ----------------------------------------------------------------

  await load();
  return view();
}
