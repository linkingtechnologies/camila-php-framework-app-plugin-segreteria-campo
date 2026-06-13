// views/warehouse-manager/index.js — Gestione Magazzini

// ---- costanti ---------------------------------------------------------------

const COLORI = ["rosso","nero","blu","verde","grigio","arancione","viola","bianco","giallo"];

const COLOR_MAP = {
  rosso:    "#e53e3e",
  nero:     "#1a202c",
  blu:      "#3182ce",
  verde:    "#38a169",
  grigio:   "#718096",
  arancione:"#dd6b20",
  viola:    "#805ad5",
  bianco:   "#edf2f7",
  giallo:   "#d69e2e",
};

const LETTERE = [
  "",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."123456789",
  ...["!", "#", "$", "%", "&", "+", "-", "=", "@"],
];

const INCLUDE = [
  "id","nome","ordine","lettera","colore","descrizione",
  "latitudine","longitudine","comune","provincia","indirizzo",
  "operatori-a-supporto","note"
];

// ---- utils ------------------------------------------------------------------

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(v) { return String(v ?? "").trim(); }

function colorDot(colore) {
  const c = norm(colore).toLowerCase();
  const bg = COLOR_MAP[c] || "#cccccc";
  const border = c === "bianco" ? "1px solid #ccc" : "none";
  return `<span style="
    display:inline-block;
    width:12px;height:12px;border-radius:50%;
    background:${bg};border:${border};
    flex-shrink:0;
  "></span>`;
}

function emptyForm() {
  return {
    nome:"", ordine:"", lettera:"", colore:"", descrizione:"",
    latitudine:"", longitudine:"", comune:"", provincia:"", indirizzo:"",
    "operatori-a-supporto":"", note:""
  };
}

function magToForm(s) {
  return {
    nome:                  norm(s.nome),
    ordine:                norm(s.ordine),
    lettera:               norm(s.lettera),
    colore:                norm(s.colore).toLowerCase(),
    descrizione:           norm(s.descrizione),
    latitudine:            norm(s.latitudine),
    longitudine:           norm(s.longitudine),
    comune:                norm(s.comune),
    provincia:             norm(s.provincia),
    indirizzo:             norm(s.indirizzo),
    "operatori-a-supporto":norm(s["operatori-a-supporto"]),
    note:                  norm(s.note),
  };
}

function formToPayload(f) {
  const p = {};
  for (const [k, v] of Object.entries(f)) {
    p[k] = norm(v) || null;
  }
  if (p.ordine !== null) p.ordine = parseInt(p.ordine) || null;
  return p;
}

// ---- Leaflet lazy load ------------------------------------------------------

let _leafletReady = false;

async function loadLeaflet() {
  if (_leafletReady || window.L) { _leafletReady = true; return; }
  await new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel  = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  _leafletReady = true;
}

// ---- Nominatim geocoding ----------------------------------------------------

async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&accept-language=it`;
  const res = await fetch(url, { headers: { "Accept-Language": "it" } });
  return res.json();
}

async function nominatimReverse(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=it`;
  const res = await fetch(url);
  return res.json();
}

function extractAddress(data) {
  const a = data?.address || {};
  const comune = a.city || a.town || a.village || a.municipality ||
                 a.city_district || a.suburb || a.hamlet || a.quarter || "";
  const isoLvl6 = a["ISO3166-2-lvl6"] || a["ISO3166-2-lvl5"] || "";
  let provincia = isoLvl6 ? isoLvl6.replace(/^[A-Z]{2}-/, "").slice(0, 2).toUpperCase() : "";
  if (!provincia && a.state_code) provincia = a.state_code.slice(0, 2).toUpperCase();
  return {
    comune,
    provincia,
    indirizzo: [a.road, a.house_number].filter(Boolean).join(" "),
  };
}

// ---- main export ------------------------------------------------------------

export async function WarehouseManager({ state, client, html, render, root }) {

  // --- local state ---
  let loading      = true;
  let error        = null;
  let magazzini    = [];
  let search       = "";

  let selected     = null;
  let form         = emptyForm();
  let formMode     = null;
  let formBusy     = false;
  let formError    = null;
  let formSuccess  = null;

  let deleteConfirm = false;
  let deleteBusy    = false;

  // drag & drop
  let dragId       = null;
  let dragOverId   = null;

  // copia coordinate
  let coordClipboard = null;

  // check uso prima di eliminare
  let deleteUsage    = null;
  let deleteBlocked  = false;

  // custom color dropdown
  let colorDropOpen  = false;

  // dirty form / conferma cambio selezione
  let formDirty      = false;
  let pendingSelect  = null;

  // mappa
  let showMap      = false;
  let mapSearch    = "";
  let mapResults   = [];
  let mapSearching = false;
  let mapReversing = false;
  let mapLat       = null;
  let mapLon       = null;
  let mapAddress   = {};
  let _map         = null;
  let _marker      = null;
  let _mapInited   = false;

  // ---

  function rerender() {
    render(view(), root);
    if (showMap) initMap();
  }

  // ---- Leaflet map init -----------------------------------------------------

  function initMap() {
    const el = document.getElementById("wm-leaflet-container");
    if (!el || _mapInited) return;
    _mapInited = true;

    const startLat = mapLat ?? 42.0;
    const startLon = mapLon ?? 12.5;
    const startZoom = mapLat ? 14 : 6;

    _map = window.L.map(el).setView([startLat, startLon], startZoom);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(_map);

    if (mapLat !== null) {
      _marker = window.L.marker([mapLat, mapLon], { draggable: true }).addTo(_map);
      _marker.on("dragend", () => onMarkerMove(_marker.getLatLng().lat, _marker.getLatLng().lng));
    }

    _map.on("click", e => onMapClick(e.latlng.lat, e.latlng.lng));
  }

  async function onMapClick(lat, lon) {
    mapLat = lat; mapLon = lon;
    if (_marker) { _marker.setLatLng([lat, lon]); }
    else {
      _marker = window.L.marker([lat, lon], { draggable: true }).addTo(_map);
      _marker.on("dragend", () => onMarkerMove(_marker.getLatLng().lat, _marker.getLatLng().lng));
    }
    await reverseAndUpdate(lat, lon);
  }

  async function onMarkerMove(lat, lon) {
    mapLat = lat; mapLon = lon;
    await reverseAndUpdate(lat, lon);
  }

  async function reverseAndUpdate(lat, lon) {
    mapReversing = true; rerender();
    try {
      const data = await nominatimReverse(lat, lon);
      mapAddress = extractAddress(data);
    } catch (_) { mapAddress = {}; }
    mapReversing = false; rerender();
  }

  async function openMap() {
    mapLat = parseFloat(form.latitudine) || null;
    mapLon = parseFloat(form.longitudine) || null;
    mapSearch   = [norm(form.indirizzo), norm(form.comune), norm(form.provincia)].filter(Boolean).join(", ");
    mapResults  = [];
    mapSearching= false;
    mapAddress  = {};
    showMap     = true;
    _mapInited  = false;
    _map        = null;
    _marker     = null;
    await loadLeaflet();
    rerender();
  }

  function closeMap() {
    showMap = false;
    _map?.remove();
    _map = null; _marker = null; _mapInited = false;
    rerender();
  }

  function confirmMap() {
    if (mapLat === null) { closeMap(); return; }
    form = {
      ...form,
      latitudine:  String(mapLat.toFixed(6)),
      longitudine: String(mapLon.toFixed(6)),
      comune:    mapAddress.comune    !== undefined ? (mapAddress.comune    || form.comune)    : form.comune,
      provincia: mapAddress.provincia !== undefined ? (mapAddress.provincia || form.provincia) : form.provincia,
      indirizzo: mapAddress.indirizzo !== undefined ? (mapAddress.indirizzo || form.indirizzo) : form.indirizzo,
    };
    closeMap();
  }

  async function doGeoSearch() {
    if (!mapSearch.trim()) return;
    mapSearching = true; mapResults = []; rerender();
    try {
      mapResults = await nominatimSearch(mapSearch);
    } catch (_) { mapResults = []; }
    mapSearching = false; rerender();
  }

  function selectGeoResult(r) {
    mapLat = parseFloat(r.lat);
    mapLon = parseFloat(r.lon);
    mapAddress = extractAddress(r);
    mapResults = [];
    if (_map) {
      _map.setView([mapLat, mapLon], 15);
      if (_marker) { _marker.setLatLng([mapLat, mapLon]); }
      else {
        _marker = window.L.marker([mapLat, mapLon], { draggable: true }).addTo(_map);
        _marker.on("dragend", () => onMarkerMove(_marker.getLatLng().lat, _marker.getLatLng().lng));
      }
    }
    rerender();
  }

  // ---- data loading --------------------------------------------------------

  async function load() {
    loading = true; error = null; rerender();
    try {
      const res = await client.table("magazzini").list({ include: INCLUDE, size: 2000 });
      magazzini = getRecords(res).sort((a, b) => {
        const oa = parseInt(a.ordine) || 0;
        const ob = parseInt(b.ordine) || 0;
        return oa - ob || norm(a.nome).localeCompare(norm(b.nome), "it");
      });
    } catch (e) { error = e; }
    loading = false; rerender();
  }

  // ---- form helpers ---------------------------------------------------------

  function _doSelect(s) {
    selected = s; form = magToForm(s); formMode = "edit";
    formError = null; formSuccess = null; deleteConfirm = false;
    deleteUsage = null; deleteBlocked = false;
    formDirty = false; pendingSelect = null; colorDropOpen = false;
    rerender();
  }

  function selectMagazzino(s) {
    if (formDirty && selected?.id !== s.id) {
      pendingSelect = s; rerender();
      document.querySelector(".wm-detail")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    _doSelect(s);
  }

  function startNew() {
    if (formDirty) {
      pendingSelect = "new"; rerender();
      document.querySelector(".wm-detail")?.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    _doStartNew();
  }

  function _doStartNew() {
    selected = null; form = emptyForm(); formMode = "new";
    formError = null; formSuccess = null; deleteConfirm = false;
    deleteUsage = null; deleteBlocked = false;
    formDirty = false; pendingSelect = null; colorDropOpen = false;
    const maxOrd = magazzini.reduce((m, s) => Math.max(m, parseInt(s.ordine) || 0), 0);
    form.ordine = String(maxOrd + 1);
    rerender();
  }

  function confirmDiscard() {
    const target = pendingSelect;
    pendingSelect = null; formDirty = false;
    if (target === "new") _doStartNew();
    else _doSelect(target);
  }

  function cancelDiscard() {
    pendingSelect = null; rerender();
  }

  function setField(key, val) {
    form = { ...form, [key]: val };
    formError = null; formSuccess = null; formDirty = true;
    rerender();
  }

  // ---- save / delete -------------------------------------------------------

  async function save() {
    if (!norm(form.nome)) { formError = "Il campo Nome è obbligatorio."; rerender(); return; }
    formBusy = true; formError = null; formSuccess = null; rerender();
    try {
      const nomeLower = norm(form.nome).toLowerCase();
      const duplicate = magazzini.find(s =>
        norm(s.nome).toLowerCase() === nomeLower && s.id !== (selected?.id)
      );
      const payload = formToPayload(form);
      if (formMode === "new") {
        await client.table("magazzini").create(payload);
        formSuccess = "Magazzino creato." + (duplicate ? " ⚠️ Attenzione: esiste già un altro magazzino con lo stesso nome." : "");
      } else {
        await client.table("magazzini").update(selected.id, payload);
        formSuccess = "Magazzino aggiornato." + (duplicate ? " ⚠️ Attenzione: esiste già un altro magazzino con lo stesso nome." : "");
      }
      await load();
      formDirty = false;
      if (formMode === "edit" && selected) {
        const updated = magazzini.find(s => s.id === selected.id);
        if (updated) { selected = updated; form = magToForm(updated); }
      } else {
        const created = magazzini.find(s => norm(s.nome) === norm(form.nome));
        if (created) { selected = created; form = magToForm(created); formMode = "edit"; }
      }
    } catch (e) {
      formError = String(e?.payload?.message || e?.message || e || "Errore salvataggio");
    }
    formBusy = false; rerender();
  }

  async function checkDeleteUsage() {
    if (!selected) return;
    deleteUsage = { checking: true }; rerender();
    const nome = norm(selected.nome);
    try {
      const f = campo => [client.filter(campo, "eq", nome)];
      const [ro, rd] = await Promise.all([
        client.table("mov-consumabili").list({ filters: f("magazzino-origine"),      include: ["id"], size: 1 }),
        client.table("mov-consumabili").list({ filters: f("magazzino-destinazione"), include: ["id"], size: 1 }),
      ]);
      const tot = getRecords(ro).length + getRecords(rd).length;
      deleteUsage   = { tot };
      deleteBlocked = tot > 0;
    } catch (_) {
      deleteUsage   = { tot: 0 };
      deleteBlocked = false;
      formError = "Impossibile verificare l'utilizzo del magazzino — procedi con cautela.";
    }
    rerender();
  }

  async function deleteMagazzino() {
    if (!selected) return;
    deleteBusy = true; rerender();
    try {
      await client.table("magazzini").remove(selected.id);
      selected = null; form = emptyForm(); formMode = "new";
      deleteConfirm = false; deleteUsage = null; deleteBlocked = false;
      await load();
    } catch (e) {
      formError = String(e?.payload?.message || e?.message || e || "Errore eliminazione");
    }
    deleteBusy = false; rerender();
  }

  // ---- copia coordinate -----------------------------------------------------

  function copyCoords(withAddress = false) {
    if (!norm(form.latitudine) || !norm(form.longitudine)) return;
    coordClipboard = withAddress
      ? { latitudine: form.latitudine, longitudine: form.longitudine,
          comune: form.comune, provincia: form.provincia, indirizzo: form.indirizzo }
      : { latitudine: form.latitudine, longitudine: form.longitudine };
    rerender();
  }

  function pasteCoords() {
    if (!coordClipboard) return;
    form = { ...form, ...coordClipboard };
    formError = null; formSuccess = null; formDirty = true;
    rerender();
  }

  // ---- clona magazzino -------------------------------------------------------

  async function cloneMagazzino() {
    if (!selected) return;
    formBusy = true; formError = null; formSuccess = null; rerender();
    try {
      const maxOrd = magazzini.reduce((m, s) => Math.max(m, parseInt(s.ordine) || 0), 0);
      const payload = formToPayload({
        ...magToForm(selected),
        nome:   norm(selected.nome) + " (copia)",
        ordine: String(maxOrd + 1),
      });
      await client.table("magazzini").create(payload);
      await load();
      const clone = magazzini.find(s => norm(s.nome) === norm(selected.nome) + " (copia)");
      if (clone) { selected = clone; form = magToForm(clone); formMode = "edit"; }
      formSuccess = "Magazzino clonato — modifica il nome e salva.";
    } catch (e) {
      formError = String(e?.payload?.message || e?.message || e || "Errore clonazione");
    }
    formBusy = false; rerender();
  }

  // ---- drag & drop reorder -------------------------------------------------

  async function applyReorder(fromId, toId) {
    if (fromId === toId) return;
    const arr   = [...magazzini];
    const fromI = arr.findIndex(s => s.id === fromId);
    const toI   = arr.findIndex(s => s.id === toId);
    if (fromI === -1 || toI === -1) return;
    const [moved] = arr.splice(fromI, 1);
    arr.splice(toI, 0, moved);
    try {
      for (let i = 0; i < arr.length; i++) {
        const newOrd = i + 1;
        if (parseInt(arr[i].ordine) !== newOrd)
          await client.table("magazzini").update(arr[i].id, { ordine: newOrd });
      }
    } catch (e) {
      formError = "Errore durante il riordino: " + String(e?.payload?.message || e?.message || e);
    }
    await load();
    if (selected) {
      const s = magazzini.find(x => x.id === selected.id);
      if (s) { selected = s; form = { ...form, ordine: norm(s.ordine) }; }
    }
  }

  // ---- view ----------------------------------------------------------------

  function view() {
    const q = search.toLocaleLowerCase("it");
    const visible = q
      ? magazzini.filter(s =>
          norm(s.nome).toLocaleLowerCase("it").includes(q) ||
          norm(s.comune).toLocaleLowerCase("it").includes(q) ||
          norm(s.descrizione).toLocaleLowerCase("it").includes(q)
        )
      : magazzini;

    const hasCoords = mapLat !== null;

    return html`
      <style>
        .wm-layout { display:flex; gap:0; height:calc(100vh - 52px); overflow:hidden; }
        .wm-list { width:320px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid #dbdbdb; overflow:hidden; }
        .wm-list-toolbar { padding:.75rem; border-bottom:1px solid #dbdbdb; display:flex; gap:.5rem; align-items:center; flex-wrap:wrap; }
        .wm-list-body { overflow-y:auto; flex:1; }
        .wm-item { display:flex; align-items:center; gap:.5rem; padding:.55rem .75rem; cursor:pointer; border-bottom:1px solid #f0f0f0; user-select:none; }
        .wm-item:hover { background:#f5f5f5; }
        .wm-item.is-selected { background:#eff5fb; border-left:3px solid #3273dc; }
        .wm-item.is-drag-over { background:#e8f4fd; outline:2px dashed #3273dc; }
        .wm-drag-handle { cursor:grab; color:#aaa; font-size:1rem; flex-shrink:0; }
        .wm-item-name { flex:1; font-size:.88rem; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .wm-item-ord { font-size:.75rem; color:#999; flex-shrink:0; width:24px; text-align:right; }
        .wm-detail { flex:1; overflow-y:auto; padding:1rem 1.25rem; }
        .wm-field-row { display:grid; grid-template-columns:1fr 1fr; gap:.5rem; }
        .wm-field-row-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:.5rem; }
        .wm-lettera-grid { display:flex; flex-wrap:wrap; gap:3px; margin-top:.25rem; }
        .wm-lettera-btn { width:26px; height:26px; border:1px solid #dbdbdb; border-radius:3px; background:#fff; cursor:pointer; font-size:.72rem; font-weight:600; display:flex; align-items:center; justify-content:center; color:#363636; padding:0; }
        .wm-lettera-btn:hover { border-color:#3273dc; color:#3273dc; }
        .wm-lettera-btn.is-selected { background:#3273dc; color:#fff; border-color:#3273dc; }
        .wm-lettera-btn.is-empty { color:#aaa; font-size:.65rem; }
        .wm-color-drop { position:relative; flex:1; }
        .wm-color-trigger { display:flex; align-items:center; gap:.4rem; padding:.3rem .6rem; border:1px solid #dbdbdb; border-radius:4px; cursor:pointer; background:#fff; font-size:.85rem; user-select:none; }
        .wm-color-trigger:hover { border-color:#b5b5b5; }
        .wm-color-menu { position:absolute; top:calc(100% + 2px); left:0; right:0; background:#fff; border:1px solid #dbdbdb; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,.1); z-index:100; max-height:220px; overflow-y:auto; }
        .wm-color-opt { display:flex; align-items:center; gap:.5rem; padding:.35rem .6rem; cursor:pointer; font-size:.85rem; }
        .wm-color-opt:hover { background:#f5f5f5; }
        .wm-color-opt.is-selected { background:#eff5fb; font-weight:600; }
        .wm-dirty-banner { background:#fff8e1; border:1px solid #ffe082; border-radius:6px; padding:.5rem .75rem; font-size:.82rem; display:flex; align-items:center; gap:.5rem; margin-bottom:.75rem; }
        .wm-map-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9000; display:flex; align-items:center; justify-content:center; }
        .wm-map-modal { background:#fff; border-radius:8px; width:90vw; max-width:860px; height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.25); }
        .wm-map-header { padding:.75rem 1rem; border-bottom:1px solid #dbdbdb; display:flex; align-items:center; gap:.5rem; }
        .wm-map-body { display:flex; flex:1; overflow:hidden; }
        .wm-map-sidebar { width:280px; flex-shrink:0; border-right:1px solid #dbdbdb; display:flex; flex-direction:column; padding:.75rem; gap:.5rem; overflow-y:auto; }
        .wm-map-results { list-style:none; margin:0; padding:0; }
        .wm-map-results li { padding:.4rem .5rem; font-size:.8rem; cursor:pointer; border-radius:4px; border-bottom:1px solid #f0f0f0; }
        .wm-map-results li:hover { background:#f0f5ff; }
        .wm-map-canvas { flex:1; }
        #wm-leaflet-container { width:100%; height:100%; }
        .wm-map-footer { padding:.6rem 1rem; border-top:1px solid #dbdbdb; display:flex; align-items:center; gap:.5rem; font-size:.82rem; }
        .wm-coords-preview { color:#555; flex:1; }
      </style>

      <div class="box" style="padding:0;overflow:hidden;margin:.75rem">

        ${loading ? html`
          <section class="section">
            <div class="container has-text-centered">
              <p class="has-text-grey mb-2">Caricamento magazzini…</p>
              <progress class="progress is-primary" style="max-width:400px;margin:0 auto"></progress>
            </div>
          </section>
        ` : error ? html`
          <section class="section">
            <div class="container">
              <article class="message is-danger">
                <div class="message-header"><p>Errore caricamento</p></div>
                <div class="message-body">${String(error?.message || error)}</div>
              </article>
              <button class="button is-primary mt-3" @click=${load}>Riprova</button>
            </div>
          </section>
        ` : html`

          <div class="wm-layout">

            <!-- LISTA -->
            <div class="wm-list">
              <div class="wm-list-toolbar">
                <input class="input is-small" type="text" placeholder="Cerca…"
                  .value=${search}
                  @input=${e => { search = e.target.value; rerender(); }}
                  style="flex:1"
                />
                <button class="button is-small is-primary" title="Nuovo magazzino" @click=${startNew}>
                  <span class="icon"><i class="ri-add-line"></i></span>
                </button>
                <button class="button is-small is-light" title="Aggiorna" @click=${load}>
                  <span class="icon"><i class="ri-refresh-line"></i></span>
                </button>
              </div>
              <div class="wm-list-body">
                ${visible.length === 0 ? html`
                  <p class="has-text-grey has-text-centered p-4" style="font-size:.85rem">
                    ${search ? "Nessun risultato" : "Nessun magazzino"}
                  </p>
                ` : visible.map(s => html`
                  <div
                    class="wm-item ${selected?.id === s.id ? 'is-selected' : ''} ${dragOverId === s.id && dragId !== s.id ? 'is-drag-over' : ''}"
                    draggable="true"
                    @click=${() => selectMagazzino(s)}
                    @dragstart=${e => { dragId = s.id; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", s.id); }}
                    @dragover=${e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragOverId !== s.id) { dragOverId = s.id; rerender(); } }}
                    @dragleave=${() => { if (dragOverId === s.id) { dragOverId = null; rerender(); } }}
                    @drop=${e => { e.preventDefault(); const fid = dragId; dragId = null; dragOverId = null; if (fid && fid !== s.id) applyReorder(fid, s.id); else rerender(); }}
                    @dragend=${() => { dragId = null; dragOverId = null; rerender(); }}
                  >
                    <span class="wm-drag-handle" title="Trascina per riordinare">⠿</span>
                    <span .innerHTML=${colorDot(s.colore)}></span>
                    <span class="wm-item-name" title="${norm(s.nome)}">
                      ${norm(s.nome)}${selected?.id === s.id && formDirty ? html` <span style="color:#f59e0b" title="Modifiche non salvate">●</span>` : ""}
                    </span>
                    ${!norm(s.latitudine) || !norm(s.longitudine) ? html`
                      <span title="Coordinate non impostate" style="color:#ccc;font-size:.8rem;flex-shrink:0">
                        <i class="ri-map-pin-line"></i>
                      </span>
                    ` : ""}
                    <span class="wm-item-ord">${norm(s.ordine) || "—"}</span>
                  </div>
                `)}
              </div>
            </div>

            <!-- DETTAGLIO / FORM -->
            <div class="wm-detail">
              ${!formMode ? html`
                <div class="has-text-grey has-text-centered p-6" style="margin-top:3rem">
                  <p style="font-size:2rem"><i class="ri-home-gear-line"></i></p>
                  <p>Seleziona un magazzino dalla lista<br>oppure crea un nuovo magazzino.</p>
                </div>
              ` : html`

                <div class="is-flex is-align-items-center mb-2" style="gap:.5rem">
                  <h2 class="title is-5 mb-0" style="flex:1">
                    ${formMode === "new" ? "Nuovo magazzino" : norm(form.nome) || "—"}
                  </h2>
                </div>

                <!-- AZIONI -->
                <div class="is-flex is-align-items-center mb-3" style="gap:.5rem;flex-wrap:wrap;border-bottom:1px solid #f0f0f0;padding-bottom:.75rem">
                  <button class="button is-primary is-small ${formBusy ? 'is-loading' : ''}"
                    ?disabled=${formBusy || deleteBusy} @click=${save}>
                    <span class="icon"><i class="ri-save-line"></i></span>
                    <span>${formMode === "new" ? "Crea magazzino" : "Salva modifiche"}</span>
                  </button>
                  ${formMode === "edit" ? html`
                    ${!deleteConfirm ? html`
                      <button class="button is-danger is-light is-small"
                        ?disabled=${formBusy || deleteBusy}
                        @click=${() => { deleteConfirm = true; deleteUsage = null; deleteBlocked = false; checkDeleteUsage(); }}>
                        <span class="icon"><i class="ri-delete-bin-line"></i></span>
                        <span>Elimina</span>
                      </button>
                    ` : deleteUsage?.checking ? html`
                      <span class="button is-small is-loading is-danger is-light">Verifica…</span>
                    ` : deleteBlocked ? html`
                      <div class="notification is-warning is-light py-2 px-3" style="font-size:.82rem;margin:0">
                        <strong>Non eliminabile</strong> — il magazzino è usato in
                        <strong>${deleteUsage.tot} movimentazion${deleteUsage.tot === 1 ? "e" : "i"}</strong>.
                        <button class="delete is-small ml-2" @click=${() => { deleteConfirm = false; deleteUsage = null; rerender(); }}></button>
                      </div>
                    ` : html`
                      <span style="font-size:.82rem;color:#c0392b">Nessuna movimentazione associata. Confermi l'eliminazione?</span>
                      <button class="button is-danger is-small ${deleteBusy ? 'is-loading' : ''}"
                        ?disabled=${deleteBusy} @click=${deleteMagazzino}>Sì, elimina</button>
                      <button class="button is-small" ?disabled=${deleteBusy}
                        @click=${() => { deleteConfirm = false; deleteUsage = null; rerender(); }}>Annulla</button>
                    `}
                    <button class="button is-light is-small"
                      ?disabled=${formBusy || deleteBusy} @click=${cloneMagazzino}
                      title="Crea una copia di questo magazzino">
                      <span class="icon"><i class="ri-file-copy-line"></i></span>
                      <span>Clona</span>
                    </button>
                    <button class="button is-light is-small ml-auto"
                      ?disabled=${formBusy || deleteBusy} @click=${startNew}>
                      <span class="icon"><i class="ri-add-line"></i></span>
                      <span>Nuovo</span>
                    </button>
                  ` : ""}
                </div>

                ${formError ? html`<div class="notification is-danger is-light py-2 px-3 mb-3" style="font-size:.85rem">${formError}</div>` : ""}
                ${formSuccess ? html`<div class="notification is-success is-light py-2 px-3 mb-3" style="font-size:.85rem">${formSuccess}</div>` : ""}

                ${pendingSelect ? html`
                  <div class="wm-dirty-banner">
                    <span class="icon" style="color:#f59e0b"><i class="ri-alert-line"></i></span>
                    <span style="flex:1">Hai modifiche non salvate. Vuoi scartarle e continuare?</span>
                    <button class="button is-warning is-small" @click=${confirmDiscard}>Scarta e continua</button>
                    <button class="button is-small" @click=${cancelDiscard}>Rimani qui</button>
                  </div>
                ` : ""}

                <!-- NOME + ORDINE + LETTERA -->
                <div class="wm-field-row-3 mb-3">
                  <div class="field" style="grid-column:1/3">
                    <label class="label is-small">Nome <span class="has-text-danger">*</span></label>
                    <div class="control">
                      <input class="input is-small" type="text" .value=${form.nome}
                        @input=${e => setField("nome", e.target.value)} />
                    </div>
                  </div>
                  <div class="field">
                    <label class="label is-small">Ordine</label>
                    <div class="control">
                      <input class="input is-small" type="number" min="1" .value=${form.ordine}
                        @input=${e => setField("ordine", e.target.value)} />
                    </div>
                  </div>
                </div>

                <!-- COLORE + LETTERA -->
                <div class="wm-field-row mb-3">
                  <div class="field">
                    <label class="label is-small">Colore</label>
                    <div class="control">
                      <div class="wm-color-drop">
                        <div class="wm-color-trigger"
                          @click=${() => { colorDropOpen = !colorDropOpen; rerender(); }}>
                          <span .innerHTML=${colorDot(form.colore)}></span>
                          <span style="flex:1">${form.colore || "— nessuno —"}</span>
                          <span style="font-size:.7rem;color:#aaa">▼</span>
                        </div>
                        ${colorDropOpen ? html`
                          <div class="wm-color-menu">
                            <div class="wm-color-opt ${!form.colore ? 'is-selected' : ''}"
                              @click=${() => { setField("colore",""); colorDropOpen=false; }}>
                              <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#e0e0e0;flex-shrink:0"></span>
                              <span>— nessuno —</span>
                            </div>
                            ${COLORI.map(c => html`
                              <div class="wm-color-opt ${form.colore === c ? 'is-selected' : ''}"
                                @click=${() => { setField("colore", c); colorDropOpen=false; }}>
                                <span .innerHTML=${colorDot(c)}></span>
                                <span>${c}</span>
                              </div>
                            `)}
                          </div>
                        ` : ""}
                      </div>
                    </div>
                  </div>
                  <div class="field">
                    <label class="label is-small">Lettera</label>
                    <div class="wm-lettera-grid">
                      ${LETTERE.map(l => html`
                        <button type="button"
                          class="wm-lettera-btn ${form.lettera === l ? 'is-selected' : ''} ${l === '' ? 'is-empty' : ''}"
                          title="${l === '' ? 'Nessuna lettera' : l}"
                          @click=${() => setField("lettera", l)}>
                          ${l === '' ? '∅' : l}
                        </button>
                      `)}
                    </div>
                  </div>
                </div>

                <!-- DESCRIZIONE -->
                <div class="field mb-3">
                  <label class="label is-small">Descrizione</label>
                  <div class="control">
                    <textarea class="textarea is-small" rows="2"
                      .value=${form.descrizione}
                      @input=${e => setField("descrizione", e.target.value)}></textarea>
                  </div>
                </div>

                <!-- POSIZIONE -->
                <div class="is-flex is-align-items-center mb-2" style="gap:.5rem">
                  <span class="label is-small mb-0" style="flex:1">Posizione</span>
                  <button class="button is-small is-info is-light" @click=${openMap}>
                    <span class="icon is-small"><i class="ri-map-pin-2-line"></i></span>
                    <span>Scegli sulla mappa</span>
                  </button>
                </div>

                <div class="field mb-2">
                  <label class="label is-small">Indirizzo</label>
                  <div class="control">
                    <input class="input is-small" type="text" .value=${form.indirizzo}
                      @input=${e => setField("indirizzo", e.target.value)} />
                  </div>
                </div>
                <div class="wm-field-row mb-3">
                  <div class="field">
                    <label class="label is-small">Comune</label>
                    <div class="control">
                      <input class="input is-small" type="text" .value=${form.comune}
                        @input=${e => setField("comune", e.target.value)} />
                    </div>
                  </div>
                  <div class="field">
                    <label class="label is-small">Provincia</label>
                    <div class="control">
                      <input class="input is-small" type="text" maxlength="2"
                        .value=${form.provincia}
                        @input=${e => setField("provincia", e.target.value.toUpperCase().slice(0,2))} />
                    </div>
                  </div>
                </div>
                <div class="wm-field-row mb-1">
                  <div class="field">
                    <label class="label is-small">Latitudine</label>
                    <div class="control">
                      <input class="input is-small" type="text" .value=${form.latitudine}
                        @input=${e => setField("latitudine", e.target.value)} />
                    </div>
                  </div>
                  <div class="field">
                    <label class="label is-small">Longitudine</label>
                    <div class="control">
                      <input class="input is-small" type="text" .value=${form.longitudine}
                        @input=${e => setField("longitudine", e.target.value)} />
                    </div>
                  </div>
                </div>
                <div class="is-flex mb-3" style="gap:.4rem;flex-wrap:wrap">
                  <div class="dropdown ${!norm(form.latitudine) || !norm(form.longitudine) ? '' : 'is-hoverable'}">
                    <div class="dropdown-trigger">
                      <button class="button is-small is-light"
                        ?disabled=${!norm(form.latitudine) || !norm(form.longitudine)}
                        aria-haspopup="true">
                        <span class="icon is-small"><i class="ri-map-pin-copy-line"></i></span>
                        <span>Copia coordinate</span>
                        <span class="icon is-small"><i class="ri-arrow-down-s-line"></i></span>
                      </button>
                    </div>
                    <div class="dropdown-menu" style="min-width:220px">
                      <div class="dropdown-content">
                        <a class="dropdown-item" @click=${() => copyCoords(false)}>
                          <span class="icon is-small"><i class="ri-map-pin-line"></i></span>
                          Solo coordinate
                        </a>
                        <a class="dropdown-item" @click=${() => copyCoords(true)}>
                          <span class="icon is-small"><i class="ri-map-pin-2-line"></i></span>
                          Coordinate + indirizzo
                        </a>
                      </div>
                    </div>
                  </div>
                  <button class="button is-small is-light"
                    title="${coordClipboard ? `Incolla: ${coordClipboard.latitudine}, ${coordClipboard.longitudine}${coordClipboard.comune ? ' — ' + coordClipboard.comune : ''}` : 'Nessuna coordinata copiata'}"
                    ?disabled=${!coordClipboard}
                    @click=${pasteCoords}>
                    <span class="icon is-small"><i class="ri-clipboard-line"></i></span>
                    <span>Incolla${coordClipboard ? html` <span class="has-text-grey" style="font-size:.75em">(${coordClipboard.latitudine}, ${coordClipboard.longitudine}${coordClipboard.comune ? ', ' + coordClipboard.comune : ''})</span>` : ""}</span>
                  </button>
                </div>

                <!-- OPERATORI A SUPPORTO -->
                <div class="field mb-3">
                  <label class="label is-small">Operatori a supporto</label>
                  <div class="control">
                    <textarea class="textarea is-small" rows="2"
                      .value=${form["operatori-a-supporto"]}
                      @input=${e => setField("operatori-a-supporto", e.target.value)}></textarea>
                  </div>
                </div>

                <!-- NOTE -->
                <div class="field mb-4">
                  <label class="label is-small">Note</label>
                  <div class="control">
                    <input class="input is-small" type="text" .value=${form.note}
                      @input=${e => setField("note", e.target.value)} />
                  </div>
                </div>

              `}
            </div>

          </div>
        `}
      </div>

      <!-- MODALE MAPPA -->
      ${showMap ? html`
        <div class="wm-map-overlay" @click=${e => { if (e.target === e.currentTarget) closeMap(); }}>
          <div class="wm-map-modal">
            <div class="wm-map-header">
              <span class="icon"><i class="ri-map-pin-2-line"></i></span>
              <strong style="flex:1">Seleziona posizione</strong>
              <button class="delete" @click=${closeMap}></button>
            </div>
            <div class="wm-map-body">
              <div class="wm-map-sidebar">
                <div class="field">
                  <label class="label is-small">Cerca indirizzo</label>
                  <div class="field has-addons mb-1">
                    <div class="control is-expanded">
                      <input class="input is-small" type="text"
                        placeholder="Es. Via Roma 1, Milano"
                        .value=${mapSearch}
                        @input=${e => { mapSearch = e.target.value; }}
                        @keydown=${e => { if (e.key === "Enter") doGeoSearch(); }}
                      />
                    </div>
                    <div class="control">
                      <button class="button is-small is-info ${mapSearching ? 'is-loading' : ''}"
                        ?disabled=${mapSearching} @click=${doGeoSearch}>
                        <span class="icon"><i class="ri-search-line"></i></span>
                      </button>
                    </div>
                  </div>
                  ${mapResults.length > 0 ? html`
                    <ul class="wm-map-results">
                      ${mapResults.map(r => html`
                        <li @click=${() => selectGeoResult(r)} title="${r.display_name}">
                          ${r.display_name.length > 60 ? r.display_name.slice(0,60) + "…" : r.display_name}
                        </li>
                      `)}
                    </ul>
                  ` : ""}
                </div>
                <hr style="margin:.25rem 0">
                <p class="is-size-7 has-text-grey">
                  Clicca sulla mappa o trascina il marker per selezionare il punto esatto.
                </p>
                ${hasCoords ? html`
                  <div style="font-size:.8rem;margin-top:.25rem">
                    <div><strong>Lat:</strong> ${mapLat?.toFixed(6)}</div>
                    <div><strong>Lon:</strong> ${mapLon?.toFixed(6)}</div>
                    ${mapReversing ? html`<div class="has-text-grey"><i class="ri-loader-4-line"></i> Ricerca indirizzo…</div>` : html`
                      ${mapAddress.comune ? html`<div><strong>Comune:</strong> ${mapAddress.comune}</div>` : ""}
                      ${mapAddress.provincia ? html`<div><strong>Prov.:</strong> ${mapAddress.provincia}</div>` : ""}
                      ${mapAddress.indirizzo ? html`<div><strong>Indirizzo:</strong> ${mapAddress.indirizzo}</div>` : ""}
                    `}
                  </div>
                ` : html`
                  <p class="is-size-7 has-text-grey-light">Nessuna posizione selezionata</p>
                `}
              </div>
              <div class="wm-map-canvas">
                <div id="wm-leaflet-container"></div>
              </div>
            </div>
            <div class="wm-map-footer">
              <span class="wm-coords-preview">
                ${hasCoords
                  ? `📍 ${mapLat?.toFixed(5)}, ${mapLon?.toFixed(5)}${mapAddress.comune ? " — " + mapAddress.comune : ""}`
                  : "Nessuna posizione selezionata"}
              </span>
              <button class="button is-small" @click=${closeMap}>Annulla</button>
              <button class="button is-small is-primary" ?disabled=${!hasCoords || mapReversing} @click=${confirmMap}>
                <span class="icon"><i class="ri-check-line"></i></span>
                <span>Conferma posizione</span>
              </button>
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }

  // ---- avvio ---------------------------------------------------------------

  document.addEventListener("click", e => {
    if (colorDropOpen && !e.target.closest(".wm-color-drop")) {
      colorDropOpen = false; rerender();
    }
  });

  await load();
  return view();
}
