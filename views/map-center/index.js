// views/map-center/index.js — Centro Mappe

const WAITING         = "IN ATTESA DI SERVIZIO";
const SERVIZI_FITTIZI = ["IN ATTESA DI SERVIZIO", "USCITA DEFINITIVA"];
const COLORI_SERVIZI  = ["rosso","blu","verde","arancione","viola","giallo","grigio","nero","bianco"];

const INCLUDE_MOV = [
  "id","data/ora","tipologia","articolo","quantita",
  "unita-di-misura","magazzino-origine","magazzino-destinazione","servizio","operatore","note"
];
const INCLUDE_SRV = ["id","nome","latitudine","longitudine","colore","lettera"];
const INCLUDE_MAG = ["nome","latitudine","longitudine","colore","lettera"];
const INCLUDE_V   = ["id","cognome","nome","codice-fiscale","organizzazione","provincia","squadra",
                     "servizio","data-inizio-attestato","data-fine-attestato"];
const INCLUDE_M   = ["id","targa","codice-inventario","categoria","marca","modello",
                     "organizzazione","provincia","squadra","servizio","data-inizio-attestato","data-fine-attestato"];
const INCLUDE_MAT = ["id","id-materiale","codice-inventario","categoria","tipologia",
                     "organizzazione","provincia","squadra","servizio","data-inizio-attestato","data-fine-attestato"];
const INCLUDE_ORG = ["id","denominazione","codice","sezione","tipologia-sezione",
                     "comune","provincia","indirizzo","latitudine","longitudine","colore","lettera"];

// ---- utils ------------------------------------------------------------------

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(v)          { return String(v ?? "").trim(); }
function normalizeError(e){ return String(e?.payload?.message || e?.message || e || "Errore"); }
function isActive(r)      { return !!norm(r["data-inizio-attestato"]) && !norm(r["data-fine-attestato"]); }

// ---- giacenze (tab consumabili) ---------------------------------------------

function buildGiacenze(movimentazioni) {
  const map = new Map();
  function add(art, key, delta) {
    if (!art || !key) return;
    if (!map.has(art)) map.set(art, new Map());
    map.get(art).set(key, (map.get(art).get(key) || 0) + delta);
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
  const map = new Map();
  function add(art, srv, delta) {
    if (!art || !srv) return;
    if (!map.has(art)) map.set(art, new Map());
    map.get(art).set(srv, (map.get(art).get(srv) || 0) + delta);
  }
  for (const m of movimentazioni) {
    const art = norm(m.articolo);  if (!art) continue;
    const srv = norm(m.servizio);  if (!srv) continue;
    const qty = parseFloat(m["quantita"]) || 0;
    const tipo = norm(m.tipologia);
    if (tipo === "SCARICO")            add(art, srv, +qty);
    else if (tipo === "CARICO")        add(art, srv, -qty);
  }
  return map;
}

function pivotByLocation(giacenze) {
  const out = new Map();
  for (const [art, inner] of giacenze) {
    for (const [loc, qty] of inner) {
      if (!out.has(loc)) out.set(loc, new Map());
      out.get(loc).set(art, (out.get(loc).get(art) || 0) + qty);
    }
  }
  return out;
}

// ---- cards (tab risorse) ----------------------------------------------------

function buildCards(volontari, mezzi, materiali, groupBy) {
  const map = new Map();
  function getGroup(r) {
    return groupBy === "squadra"
      ? (norm(r.squadra) || norm(r.organizzazione) || "—")
      : (norm(r.organizzazione) || "—");
  }
  function ensure(group, service) {
    const key = `${group}|||${service}`;
    if (!map.has(key)) map.set(key, { key, groupValue: group, service, volontari: [], mezzi: [], materiali: [] });
    return map.get(key);
  }
  for (const r of volontari) ensure(getGroup(r), norm(r.servizio) || WAITING).volontari.push(r);
  for (const r of mezzi)     ensure(getGroup(r), norm(r.servizio) || WAITING).mezzi.push(r);
  for (const r of materiali) ensure(getGroup(r), norm(r.servizio) || WAITING).materiali.push(r);
  return Array.from(map.values()).sort((a, b) => a.groupValue.localeCompare(b.groupValue, "it"));
}

// ---- map helpers ------------------------------------------------------------

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

// ---- popup html helpers -----------------------------------------------------

function popupGiacenze(nome, tipo, movimentazioni) {
  const byMag = pivotByLocation(buildGiacenze(movimentazioni));
  const bySrv = pivotByLocation(buildGiacenzeServizi(movimentazioni));
  const g = (tipo === "magazzino" ? byMag : bySrv).get(nome);
  if (!g) return `<p style="font-size:.8rem;color:#888">Nessuna giacenza</p>`;
  let rows = "";
  for (const [art, qty] of g) {
    const style = qty < 0 ? "color:#c0392b;font-weight:600" : "";
    rows += `<tr><td style="padding:1px 8px 1px 0">${art}</td><td style="text-align:right;${style}">${qty}</td></tr>`;
  }
  return `<table style="font-size:.78rem;border-collapse:collapse">${rows}</table>`;
}

function popupRisorse(servizio, cards) {
  const totV   = cards.reduce((s, c) => s + c.volontari.length, 0);
  const totM   = cards.reduce((s, c) => s + c.mezzi.length, 0);
  const totMat = cards.reduce((s, c) => s + c.materiali.length, 0);

  let h = `<div style="min-width:240px;max-height:400px;overflow-y:auto">
    <p style="font-weight:600;margin:0 0 4px">${servizio}</p>
    <p style="font-size:.75rem;color:#666;margin:0 0 8px">
      ${totV   > 0 ? `<i class="ri-user-line"></i> ${totV} &nbsp;` : ""}
      ${totM   > 0 ? `<i class="ri-truck-line"></i> ${totM} &nbsp;` : ""}
      ${totMat > 0 ? `<i class="ri-tools-line"></i> ${totMat}` : ""}
      ${totV + totM + totMat === 0 ? "Nessuna risorsa assegnata" : ""}
    </p>`;

  for (const card of cards) {
    const cv = card.volontari.length, cm = card.mezzi.length, cmat = card.materiali.length;
    if (!cv && !cm && !cmat) continue;
    h += `<details style="margin-bottom:4px;border:0.5px solid #ddd;border-radius:4px;padding:2px 6px">
      <summary style="font-size:.8rem;cursor:pointer;font-weight:500">${card.groupValue}
        <span style="color:#888;font-weight:400"> ${cv > 0 ? `· <i class="ri-user-line"></i> ${cv}` : ""} ${cm > 0 ? `<i class="ri-truck-line"></i> ${cm}` : ""} ${cmat > 0 ? `<i class="ri-tools-line"></i> ${cmat}` : ""}</span>
      </summary>`;
    if (cv > 0) {
      h += `<details style="margin:4px 0 2px 8px"><summary style="font-size:.75rem;cursor:pointer"><i class="ri-user-line"></i> Volontari (${cv})</summary>
        <ul style="margin:2px 0 4px 12px;padding:0;font-size:.73rem">
          ${card.volontari.map(v => `<li>${norm(v.cognome)} ${norm(v.nome)}</li>`).join("")}
        </ul></details>`;
    }
    if (cm > 0) {
      h += `<details style="margin:2px 0 2px 8px"><summary style="font-size:.75rem;cursor:pointer"><i class="ri-truck-line"></i> Mezzi (${cm})</summary>
        <ul style="margin:2px 0 4px 12px;padding:0;font-size:.73rem">
          ${card.mezzi.map(m => `<li>${norm(m.targa)}${norm(m.marca) ? ` (${norm(m.marca)} ${norm(m.modello)})` : ""}</li>`).join("")}
        </ul></details>`;
    }
    if (cmat > 0) {
      h += `<details style="margin:2px 0 2px 8px"><summary style="font-size:.75rem;cursor:pointer"><i class="ri-tools-line"></i> Materiali (${cmat})</summary>
        <ul style="margin:2px 0 4px 12px;padding:0;font-size:.73rem">
          ${card.materiali.map(m => `<li>${norm(m["id-materiale"]) || norm(m["codice-inventario"]) || norm(m.tipologia) || "—"}</li>`).join("")}
        </ul></details>`;
    }
    h += `</details>`;
  }

  return h + `</div>`;
}

function popupOrg(o) {
  const lines = [
    norm(o["tipologia-sezione"]) && `<em>${norm(o["tipologia-sezione"])}</em>`,
    norm(o.sezione)              && `Sezione: ${norm(o.sezione)}`,
    norm(o.codice)               && `Codice: ${norm(o.codice)}`,
    norm(o.indirizzo)            && norm(o.indirizzo),
    (norm(o.comune) || norm(o.provincia)) && `${norm(o.comune)} (${norm(o.provincia)})`,
  ].filter(Boolean).map(l => `<p style="font-size:.75rem;margin:1px 0">${l}</p>`).join("");
  return `<div style="min-width:200px"><p style="font-weight:600;margin:0 0 4px">${norm(o.denominazione)}</p>${lines}</div>`;
}

// ---- main export ------------------------------------------------------------

export async function MapCenter({ state, client, html, render, root }) {

  let loading = true, error = null;

  // tab
  let activeTab = "risorse";

  // consumabili
  let movimentazioni = [], magazzini = [], servizi = [];
  let magazziniNomi  = [], serviziNomi = [];

  // risorse
  let volontari = [], mezzi = [], materiali = [];
  let groupBy   = "organizzazione";

  // organizzazioni
  let organizzazioni = [];

  // mappa (shared)
  let leafletMap      = null;
  let markersByName   = new Map();
  let mapResizeHandler= null;
  let mapSidebarOpen  = true;
  let mapFullscreen   = false;
  let autoRefresh     = false;
  let autoRefreshTimer= null;
  let countdownSec    = 60;

  // posizioni (tab editor)
  let posEditMode  = false;
  let selectedSrv  = null;
  let pendingPlace = null;
  let posSaveBusy  = false;
  let posSaveError = null;

  function rerender() { render(view(), root); }

  // ---- load -----------------------------------------------------------------

  async function load(silent = false) {
    if (!silent) { loading = true; error = null; rerender(); }
    try {
      const [resMov, resMag, resSrv, resV, resM, resMat, resOrg] = await Promise.all([
        client.table("mov-consumabili").list({ include: INCLUDE_MOV, size: 5000 }),
        client.table("magazzini").list({ include: INCLUDE_MAG, size: 500 }),
        client.table("servizi").list({ include: INCLUDE_SRV, size: 500 }),
        client.table("volontari").list({ include: INCLUDE_V, size: 5000 }),
        client.table("mezzi").list({ include: INCLUDE_M, size: 5000 }),
        client.table("materiali").list({ include: INCLUDE_MAT, size: 5000 }),
        client.table("db-organizzazioni").list({ include: INCLUDE_ORG, size: 5000 }),
      ]);

      movimentazioni = getRecords(resMov)
        .sort((a, b) => norm(b["data/ora"]).localeCompare(norm(a["data/ora"])));

      magazzini = getRecords(resMag).filter(r => norm(r.nome))
        .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome), "it"));

      servizi = getRecords(resSrv).filter(r => norm(r.nome))
        .sort((a, b) => norm(a.nome).localeCompare(norm(b.nome), "it"));

      magazziniNomi = magazzini.map(r => norm(r.nome));
      serviziNomi   = servizi.map(r => norm(r.nome))
        .filter(n => !SERVIZI_FITTIZI.includes(n));

      const filterActive = r => isActive(r) && norm(r.servizio) !== "USCITA DEFINITIVA";
      volontari    = getRecords(resV).filter(filterActive);
      mezzi        = getRecords(resM).filter(filterActive);
      materiali    = getRecords(resMat).filter(filterActive);

      organizzazioni = getRecords(resOrg).filter(r => norm(r.denominazione))
        .sort((a, b) => norm(a.denominazione).localeCompare(norm(b.denominazione), "it"));

    } catch(e) { if (!silent) error = e; }

    loading = false; rerender();
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    setTimeout(initMap, 0);
  }

  // ---- autorefresh ----------------------------------------------------------

  function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      countdownSec = 60;
      autoRefreshTimer = setInterval(() => {
        countdownSec--;
        if (countdownSec <= 0) { countdownSec = 60; load(true); }
        else rerender();
      }, 1000);
    } else {
      clearInterval(autoRefreshTimer); autoRefreshTimer = null; countdownSec = 60;
    }
    rerender();
  }

  // ---- map ------------------------------------------------------------------

  async function loadLeaflet() {
    if (window.L) return;
    await new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.3/dist/leaflet.css";
      document.head.appendChild(link);
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.3/dist/leaflet.js";
      script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function fitMapHeight() {
    const el = document.getElementById("mc-map-container");
    if (!el) return;
    const h = Math.max(300, window.innerHeight - Math.round(el.getBoundingClientRect().top) - 8);
    el.style.height = h + "px";
    const sidebar = document.getElementById("mc-map-sidebar");
    if (sidebar) sidebar.style.height = h + "px";
    if (leafletMap) leafletMap.invalidateSize();
  }

  function makeBaseMap(L, container) {
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    const satLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      attribution: "Tiles &copy; Esri",
    });
    const map = L.map(container, { center: [41.87, 12.57], zoom: 6, layers: [osmLayer] });
    L.control.layers({ "OpenStreetMap": osmLayer, "Satellite": satLayer }).addTo(map);
    return map;
  }

  function makeIcon(L, colore, lettera) {
    return L.icon({
      iconUrl: markerIconUrl(norm(colore), norm(lettera)),
      iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
    });
  }

  function addMarkersConsumabili(L) {
    markersByName.clear();
    const bounds = new L.LatLngBounds();
    for (const r of magazzini) {
      const lat = parseFloat(r.latitudine), lon = parseFloat(r.longitudine);
      if (!lat || !lon) continue;
      const nome = norm(r.nome);
      const m = L.marker([lat, lon], { icon: makeIcon(L, r.colore, r.lettera) })
        .addTo(leafletMap)
        .bindPopup(`<div style="min-width:180px"><strong>${nome}</strong>
          <span style="background:#dbeafe;color:#1d4ed8;border-radius:4px;padding:0 5px;font-size:.7rem;margin-left:4px">Magazzino</span>
          ${popupGiacenze(nome, "magazzino", movimentazioni)}
        </div>`);
      markersByName.set(nome, { marker: m, lat, lon });
      bounds.extend([lat, lon]);
    }
    for (const r of servizi) {
      const lat = parseFloat(r.latitudine), lon = parseFloat(r.longitudine);
      if (!lat || !lon) continue;
      const nome = norm(r.nome);
      const m = L.marker([lat, lon], { icon: makeIcon(L, r.colore, r.lettera) })
        .addTo(leafletMap)
        .bindPopup(`<div style="min-width:180px"><strong>${nome}</strong>
          <span style="background:#dcfce7;color:#15803d;border-radius:4px;padding:0 5px;font-size:.7rem;margin-left:4px">Servizio</span>
          ${popupGiacenze(nome, "servizio", movimentazioni)}
        </div>`);
      markersByName.set(nome, { marker: m, lat, lon });
      bounds.extend([lat, lon]);
    }
    if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [40, 40] });
  }

  function addMarkersRisorse(L) {
    markersByName.clear();
    const cards = buildCards(volontari, mezzi, materiali, groupBy);
    const byService = new Map();
    for (const c of cards) {
      if (!byService.has(c.service)) byService.set(c.service, []);
      byService.get(c.service).push(c);
    }
    const bounds = new L.LatLngBounds();
    for (const r of servizi) {
      if (SERVIZI_FITTIZI.includes(norm(r.nome))) continue;
      const lat = parseFloat(r.latitudine), lon = parseFloat(r.longitudine);
      if (!lat || !lon) continue;
      const nome     = norm(r.nome);
      const srvCards = byService.get(nome) || [];
      const m = L.marker([lat, lon], { icon: makeIcon(L, r.colore, r.lettera) })
        .addTo(leafletMap)
        .bindPopup(popupRisorse(nome, srvCards), { maxWidth: 320 });
      markersByName.set(nome, { marker: m, lat, lon });
      bounds.extend([lat, lon]);
    }
    if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [40, 40] });
  }

  function addMarkersOrganizzazioni(L) {
    markersByName.clear();
    const bounds = new L.LatLngBounds();
    for (const o of organizzazioni) {
      const lat = parseFloat(o.latitudine), lon = parseFloat(o.longitudine);
      if (!lat || !lon) continue;
      const nome = norm(o.denominazione);
      const m = L.marker([lat, lon], { icon: makeIcon(L, norm(o.colore) || "grigio", norm(o.lettera)) })
        .addTo(leafletMap)
        .bindPopup(popupOrg(o), { maxWidth: 280 });
      markersByName.set(nome, { marker: m, lat, lon });
      bounds.extend([lat, lon]);
    }
    if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [40, 40] });
  }

  function addMarkersServizi(L) {
    markersByName.clear();
    const bounds = new L.LatLngBounds();

    if (posEditMode) {
      leafletMap.on('click', e => {
        if (!pendingPlace) return;
        const r = pendingPlace;
        savePosition(r, e.latlng.lat, e.latlng.lng);
      });
    }

    for (const r of servizi) {
      if (SERVIZI_FITTIZI.includes(norm(r.nome))) continue;
      const lat = parseFloat(r.latitudine), lon = parseFloat(r.longitudine);
      if (!lat || !lon) continue;
      const nome = norm(r.nome);
      const m = L.marker([lat, lon], {
        icon: makeIcon(L, r.colore, r.lettera),
        draggable: posEditMode
      }).addTo(leafletMap);

      if (posEditMode) {
        m.on('click', () => {
          selectedSrv = { ...r };
          pendingPlace = null;
          posSaveError = null;
          rerender();
        });
        m.on('dragend', e => {
          const latlng = e.target.getLatLng();
          savePosition(r, latlng.lat, latlng.lng);
        });
      } else {
        m.bindPopup(`<strong>${nome}</strong>`);
      }

      markersByName.set(nome, { marker: m, lat, lon });
      bounds.extend([lat, lon]);
    }
    if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [40, 40] });
  }

  function flyToLocation(nome) {
    const entry = markersByName.get(nome);
    if (!entry || !leafletMap) return;
    leafletMap.flyTo([entry.lat, entry.lon], 14);
    entry.marker.openPopup();
  }

  function togglePosEditMode() {
    posEditMode = !posEditMode;
    selectedSrv = null;
    pendingPlace = null;
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    rerender();
    setTimeout(initMap, 0);
  }

  async function savePosition(r, lat, lon) {
    try {
      await client.table("servizi").update(r.id, {
        latitudine: String(lat), longitudine: String(lon)
      });
      r.latitudine = String(lat); r.longitudine = String(lon);
    } catch(e) {
      posSaveError = normalizeError(e);
    }
    pendingPlace = null;
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    rerender();
    setTimeout(initMap, 0);
  }

  async function saveProp() {
    if (!selectedSrv) return;
    posSaveBusy = true; posSaveError = null; rerender();
    try {
      await client.table("servizi").update(selectedSrv.id, {
        colore: selectedSrv.colore, lettera: selectedSrv.lettera
      });
      const r = servizi.find(s => s.id === selectedSrv.id);
      if (r) { r.colore = selectedSrv.colore; r.lettera = selectedSrv.lettera; }
      selectedSrv = null;
      if (leafletMap) { leafletMap.remove(); leafletMap = null; }
      setTimeout(initMap, 0);
    } catch(e) {
      posSaveError = normalizeError(e);
    }
    posSaveBusy = false; rerender();
  }

  async function initMap() {
    const container = document.getElementById("mc-map-container");
    if (!container) return;
    await loadLeaflet();
    const L = window.L;
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    leafletMap = makeBaseMap(L, container);
    if (activeTab === "consumabili")    addMarkersConsumabili(L);
    else if (activeTab === "risorse")   addMarkersRisorse(L);
    else if (activeTab === "posizioni") addMarkersServizi(L);
    else                                addMarkersOrganizzazioni(L);
    setTimeout(fitMapHeight, 0);
    if (!mapResizeHandler) {
      mapResizeHandler = () => fitMapHeight();
      window.addEventListener("resize", mapResizeHandler);
    }
  }

  function switchTab(tab) {
    if (tab === activeTab) return;
    activeTab = tab;
    selectedSrv = null; pendingPlace = null; posSaveError = null;
    if (leafletMap) { leafletMap.remove(); leafletMap = null; }
    rerender();
    setTimeout(initMap, 0);
  }

  function toggleFullscreen() {
    const wrapper = document.getElementById("mc-map-wrapper");
    if (!wrapper) return;
    if (!document.fullscreenElement) wrapper.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  }

  function onFullscreenChange() {
    mapFullscreen = !!document.fullscreenElement;
    rerender();
    setTimeout(fitMapHeight, 50);
  }

  // ---- sidebar renderers ----------------------------------------------------

  function renderSidebarConsumabili() {
    const byMag = pivotByLocation(buildGiacenze(movimentazioni));
    const bySrv = pivotByLocation(buildGiacenzeServizi(movimentazioni));
    const magBadge = html`<span style="background:#dbeafe;color:#1d4ed8;border-radius:3px;padding:0 4px;font-size:.68rem">MAG</span>`;
    const srvBadge = html`<span style="background:#dcfce7;color:#15803d;border-radius:3px;padding:0 4px;font-size:.68rem">SRV</span>`;

    function block(nome, byLoc, badge) {
      const g = byLoc.get(nome); if (!g) return "";
      const rows = Array.from(g.entries()).filter(([, q]) => q !== 0);
      if (!rows.length) return "";
      return html`<div style="margin-bottom:.6rem;cursor:pointer" title="Centra sulla mappa"
        @click=${() => flyToLocation(nome)}>
        <div style="font-size:.78rem;font-weight:600;margin-bottom:1px">
          ${badge} ${nome}
        </div>
        ${rows.map(([art, qty]) => html`
          <div style="display:flex;justify-content:space-between;font-size:.73rem;padding:0 0 0 8px;
                      color:${qty < 0 ? '#c0392b' : 'inherit'}">
            <span>${art}</span><span style="font-weight:600;margin-left:6px">${qty}</span>
          </div>`)}
      </div>`;
    }

    const magBlocks = magazzini.map(r => block(norm(r.nome), byMag, magBadge));
    const srvBlocks = servizi.map(r => block(norm(r.nome), bySrv, srvBadge));
    const empty = magBlocks.every(b => !b) && srvBlocks.every(b => !b);

    return html`
      <div id="mc-map-sidebar" style="width:250px;flex-shrink:0;overflow-y:auto;
           border-right:1px solid #e8e8e8;padding:.75rem;background:#fafafa">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.05em;color:#888;margin-bottom:.5rem">Giacenze</div>
        ${empty ? html`<p class="has-text-grey is-size-7">Nessuna giacenza.</p>` : ""}
        ${magBlocks}${srvBlocks}
      </div>`;
  }

  function renderSidebarRisorse() {
    const cards = buildCards(volontari, mezzi, materiali, groupBy);
    const byService = new Map();
    for (const c of cards) {
      if (!byService.has(c.service)) byService.set(c.service, []);
      byService.get(c.service).push(c);
    }

    return html`
      <div id="mc-map-sidebar" style="width:250px;flex-shrink:0;overflow-y:auto;
           border-right:1px solid #e8e8e8;padding:.75rem;background:#fafafa">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.05em;color:#888;margin-bottom:.4rem">Raggruppamento</div>
        <div class="buttons has-addons mb-3" style="margin-bottom:.75rem">
          <button class="button is-small ${groupBy === 'organizzazione' ? 'is-link is-selected' : ''}"
            @click=${() => { groupBy = "organizzazione"; rerender(); setTimeout(initMap, 0); }}>
            Organizzazione
          </button>
          <button class="button is-small ${groupBy === 'squadra' ? 'is-link is-selected' : ''}"
            @click=${() => { groupBy = "squadra"; rerender(); setTimeout(initMap, 0); }}>
            Squadra
          </button>
        </div>
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.05em;color:#888;margin-bottom:.4rem">Risorse per servizio</div>
        ${servizi.filter(r => !SERVIZI_FITTIZI.includes(norm(r.nome))).map(r => {
          const nome = norm(r.nome);
          const srvCards = byService.get(nome) || [];
          const totV   = srvCards.reduce((s, c) => s + c.volontari.length, 0);
          const totM   = srvCards.reduce((s, c) => s + c.mezzi.length, 0);
          const totMat = srvCards.reduce((s, c) => s + c.materiali.length, 0);
          if (!totV && !totM && !totMat) return "";
          return html`<div style="margin-bottom:.5rem;cursor:pointer" title="Centra sulla mappa"
            @click=${() => flyToLocation(nome)}>
            <div style="font-size:.78rem;font-weight:600">${nome}</div>
            <div style="font-size:.73rem;color:#555;padding-left:8px">
              ${totV   > 0 ? html`<span><i class="ri-user-line"></i> ${totV} &nbsp;</span>` : ""}
              ${totM   > 0 ? html`<span><i class="ri-truck-line"></i> ${totM} &nbsp;</span>` : ""}
              ${totMat > 0 ? html`<span><i class="ri-tools-line"></i> ${totMat}</span>` : ""}
            </div>
          </div>`;
        })}
      </div>`;
  }

  function renderSidebarOrganizzazioni() {
    const conCoord = organizzazioni.filter(o => parseFloat(o.latitudine) && parseFloat(o.longitudine));
    const senzaCoord = organizzazioni.length - conCoord.length;

    return html`
      <div id="mc-map-sidebar" style="width:250px;flex-shrink:0;overflow-y:auto;
           border-right:1px solid #e8e8e8;padding:.75rem;background:#fafafa">
        <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;
                    letter-spacing:.05em;color:#888;margin-bottom:.4rem">Organizzazioni</div>
        <div style="font-size:.75rem;color:#555;margin-bottom:.6rem">
          ${conCoord.length} su mappa
          ${senzaCoord > 0 ? html`· <span class="has-text-warning-dark">${senzaCoord} senza coordinate</span>` : ""}
        </div>
        ${conCoord.map(o => html`
          <div style="margin-bottom:.5rem;cursor:pointer" title="Centra sulla mappa"
            @click=${() => flyToLocation(norm(o.denominazione))}>
            <div style="font-size:.78rem;font-weight:600">${norm(o.denominazione)}</div>
            <div style="font-size:.72rem;color:#888">${norm(o.comune)} (${norm(o.provincia)})</div>
          </div>`)}
      </div>`;
  }

  function renderSidebarServizi() {
    const visibili = servizi.filter(r => !SERVIZI_FITTIZI.includes(norm(r.nome)));
    const conPos   = visibili.filter(r => parseFloat(r.latitudine) && parseFloat(r.longitudine));
    const senzaPos = visibili.filter(r => !parseFloat(r.latitudine) || !parseFloat(r.longitudine));

    return html`
      <div id="mc-map-sidebar" style="width:260px;flex-shrink:0;overflow-y:auto;
           border-right:1px solid #e8e8e8;padding:.75rem;background:#fafafa">

        <div style="display:flex;gap:6px;margin-bottom:.75rem">
          <button class="button is-small is-fullwidth ${posEditMode ? 'is-warning' : 'is-light'}"
            @click=${togglePosEditMode}>
            <span class="icon is-small"><i class="${posEditMode ? 'ri-pencil-fill' : 'ri-pencil-line'}"></i></span>
            <span>${posEditMode ? 'Modifica attiva' : 'Modifica'}</span>
          </button>
          <a class="button is-small is-light" href="?dashboard=service-manager" title="Vai a Gestione servizi">
            <span class="icon is-small"><i class="ri-settings-3-line"></i></span>
          </a>
        </div>

        ${posEditMode ? html`
          <p style="font-size:.72rem;color:#6b7280;margin-bottom:.75rem">
            <i class="ri-drag-move-line"></i> Trascina i marker per spostare la posizione.
          </p>
        ` : ""}

        ${posSaveError ? html`
          <div class="notification is-danger is-light py-2 px-3 mb-3" style="font-size:.75rem">
            ${posSaveError}
            <button class="delete is-small" @click=${() => { posSaveError = null; rerender(); }}></button>
          </div>
        ` : ""}

        ${selectedSrv ? html`
          <div style="background:#eff6ff;border:1px solid #93c5fd;border-radius:6px;
                      padding:.6rem;margin-bottom:.75rem">
            <div style="font-weight:600;font-size:.82rem;margin-bottom:.5rem;
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              <i class="ri-pencil-line"></i> ${norm(selectedSrv.nome)}
            </div>

            <label style="font-size:.75rem;display:block;margin-bottom:.2rem">Colore</label>
            <div class="select is-small is-fullwidth" style="margin-bottom:.5rem">
              <select @change=${e => { selectedSrv = { ...selectedSrv, colore: e.target.value }; rerender(); }}>
                ${COLORI_SERVIZI.map(c => html`
                  <option value=${c} ?selected=${norm(selectedSrv.colore) === c}>${c}</option>`)}
              </select>
            </div>

            <label style="font-size:.75rem;display:block;margin-bottom:.2rem">Lettera</label>
            <input class="input is-small" type="text" maxlength="1"
              style="margin-bottom:.5rem;text-transform:uppercase;width:60px"
              .value=${norm(selectedSrv.lettera)}
              @input=${e => { selectedSrv = { ...selectedSrv, lettera: e.target.value.toUpperCase().slice(0,1) }; rerender(); }}
            />

            <div style="display:flex;gap:6px">
              <button class="button is-small is-primary ${posSaveBusy ? 'is-loading' : ''}"
                ?disabled=${posSaveBusy} @click=${saveProp}>Salva</button>
              <button class="button is-small is-light" ?disabled=${posSaveBusy}
                @click=${() => { selectedSrv = null; rerender(); }}>Annulla</button>
            </div>
          </div>
        ` : ""}

        ${senzaPos.length > 0 ? html`
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;
                      letter-spacing:.05em;color:#888;margin-bottom:.4rem">
            Senza posizione (${senzaPos.length})
          </div>
          ${senzaPos.map(r => {
            const nome = norm(r.nome);
            const isPending = pendingPlace && norm(pendingPlace.nome) === nome;
            return html`
              <div style="margin-bottom:.4rem;padding:.3rem .5rem;border-radius:4px;cursor:pointer;
                          background:${isPending ? '#fef3c7' : '#f3f4f6'};
                          border:1px solid ${isPending ? '#f59e0b' : '#e5e7eb'}"
                @click=${() => { pendingPlace = isPending ? null : r; rerender(); }}>
                <div style="font-size:.78rem;font-weight:500">${nome}</div>
                <div style="font-size:.7rem;color:${isPending ? '#92400e' : '#9ca3af'}">
                  ${isPending
                    ? html`<i class="ri-crosshair-line"></i> Clicca sulla mappa per posizionare`
                    : 'Clicca per posizionare'}
                </div>
              </div>`;
          })}
        ` : ""}

        ${conPos.length > 0 ? html`
          <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;
                      letter-spacing:.05em;color:#888;
                      margin:${senzaPos.length > 0 ? '.75rem' : '0'} 0 .4rem">
            Posizionati (${conPos.length})
          </div>
          ${conPos.map(r => html`
            <div style="margin-bottom:.35rem;cursor:pointer" title="Centra sulla mappa"
              @click=${() => flyToLocation(norm(r.nome))}>
              <div style="font-size:.78rem;font-weight:500">${norm(r.nome)}</div>
            </div>`)}
        ` : ""}
      </div>`;
  }

  // ---- map tab layout -------------------------------------------------------

  function renderMapTab() {
    const sidebar =
      activeTab === "consumabili"    ? renderSidebarConsumabili()  :
      activeTab === "risorse"        ? renderSidebarRisorse()       :
      activeTab === "posizioni"      ? renderSidebarServizi()       :
                                       renderSidebarOrganizzazioni();

    const toggleSidebar = () => {
      mapSidebarOpen = !mapSidebarOpen;
      rerender();
      setTimeout(fitMapHeight, 50);
    };

    return html`
      <div id="mc-map-wrapper" style="display:flex;flex-direction:column;background:#fff"
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
              <span>${autoRefresh
                ? html`Live <span style="opacity:.7;font-size:.85em">${countdownSec}s</span>`
                : 'Auto-refresh'}</span>
            </button>
            <button class="button is-small is-light" @click=${toggleFullscreen}
              title="Esci da schermo intero">
              <span class="icon is-small"><i class="ri-fullscreen-exit-line"></i></span>
            </button>
          </div>
        ` : ""}

        <!-- corpo: sidebar + linguetta + mappa -->
        <div style="display:flex;position:relative">
          ${mapSidebarOpen ? sidebar : ""}

          <!-- linguetta toggle -->
          <div @click=${toggleSidebar} style="
            position:absolute; top:50%;
            left:${mapSidebarOpen ? "250px" : "0"};
            transform:translateY(-50%); z-index:1000; cursor:pointer;
            background:#fff; border:1px solid #ccc;
            border-left:${mapSidebarOpen ? "none" : "1px solid #ccc"};
            border-radius:0 4px 4px 0; padding:6px 3px;
            box-shadow:2px 0 4px #0001; color:#555; user-select:none;"
            title="${mapSidebarOpen ? 'Chiudi pannello' : 'Apri pannello'}">
            <i class="${mapSidebarOpen ? 'ri-arrow-left-s-line' : 'ri-arrow-right-s-line'}"></i>
          </div>

          <div id="mc-map-container" style="flex:1;min-width:0;min-height:300px${activeTab === 'posizioni' && pendingPlace ? ';cursor:crosshair' : ''}"></div>
        </div>
      </div>`;
  }

  // ---- view principale ------------------------------------------------------

  function view() {
    if (loading) return html`
      <section class="section">
        <div class="container has-text-centered">
          <p class="has-text-grey mb-2">Caricamento dati…</p>
          <progress class="progress is-primary" style="max-width:400px;margin:0 auto"></progress>
        </div>
      </section>`;

    if (error) return html`
      <section class="section"><div class="container">
        <article class="message is-danger">
          <div class="message-header"><p>Errore caricamento</p></div>
          <div class="message-body">
            <p>${normalizeError(error)}</p>
            <button class="button is-light mt-3" @click=${() => load()}>🔄 Riprova</button>
          </div>
        </article>
      </div></section>`;

    return html`
      <div class="box" style="padding:0;overflow:hidden;margin:.75rem">

        <div class="tabs is-boxed is-small mb-0"
          style="padding:0 1.25rem;border-bottom:1px solid #dbdbdb;position:relative">
          <ul>
            <li class="${activeTab === "risorse" ? "is-active" : ""}">
              <a @click=${() => switchTab("risorse")}>
                <span class="icon is-small"><i class="ri-team-line"></i></span>
                <span>Risorse</span>
              </a>
            </li>
            <li class="${activeTab === "consumabili" ? "is-active" : ""}">
              <a @click=${() => switchTab("consumabili")}>
                <span class="icon is-small"><i class="ri-exchange-box-line"></i></span>
                <span>Consumabili</span>
              </a>
            </li>
            <li class="${activeTab === "posizioni" ? "is-active" : ""}">
              <a @click=${() => switchTab("posizioni")}>
                <span class="icon is-small"><i class="ri-pushpin-line"></i></span>
                <span>Servizi</span>
              </a>
            </li>
            <li class="${activeTab === "organizzazioni" ? "is-active" : ""}">
              <a @click=${() => switchTab("organizzazioni")}>
                <span class="icon is-small"><i class="ri-building-2-line"></i></span>
                <span>Organizzazioni</span>
              </a>
            </li>
          </ul>
          <div style="position:absolute;right:.75rem;top:50%;transform:translateY(-50%);display:flex;gap:6px;align-items:center">
            ${activeTab !== 'posizioni' ? html`
              <button class="button is-small ${autoRefresh ? 'is-success' : 'is-light'}"
                @click=${toggleAutoRefresh}
                title="${autoRefresh ? 'Auto-refresh attivo — click per disattivare' : 'Attiva auto-refresh ogni minuto'}">
                <span class="icon is-small"><i class="ri-refresh-line ${autoRefresh ? 'ri-spin' : ''}"></i></span>
                <span>${autoRefresh
                  ? html`Live <span style="opacity:.7;font-size:.85em">${countdownSec}s</span>`
                  : 'Auto-refresh'}</span>
              </button>
            ` : ""}
            <button class="button is-small is-light" @click=${toggleFullscreen}
              title="${mapFullscreen ? 'Esci da schermo intero' : 'Schermo intero'}">
              <span class="icon is-small">
                <i class="${mapFullscreen ? 'ri-fullscreen-exit-line' : 'ri-fullscreen-line'}"></i>
              </span>
            </button>
          </div>
        </div>

        ${renderMapTab()}
      </div>`;
  }

  // ---- avvio ----------------------------------------------------------------

  await load();
  return view();
}
