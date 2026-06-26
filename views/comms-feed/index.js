// views/comms-feed/index.js

// ---- map helpers (from map-center, tab risorse) -----------------------------

const SERVIZI_FITTIZI = ["IN ATTESA DI SERVIZIO", "USCITA DEFINITIVA"];
const INCLUDE_SRV = ["id", "nome", "latitudine", "longitudine", "colore", "lettera"];
const INCLUDE_V   = ["id", "cognome", "nome", "organizzazione", "squadra",
                     "servizio", "data-inizio-attestato", "data-fine-attestato"];
const INCLUDE_M   = ["id", "targa", "marca", "modello", "organizzazione", "squadra",
                     "servizio", "data-inizio-attestato", "data-fine-attestato"];
const INCLUDE_MAT = ["id", "id-materiale", "codice-inventario", "tipologia",
                     "organizzazione", "squadra", "servizio",
                     "data-inizio-attestato", "data-fine-attestato"];

function norm(v)     { return String(v ?? "").trim(); }
function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}
function isActive(r) { return !!norm(r["data-inizio-attestato"]) && !norm(r["data-fine-attestato"]); }

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

function buildCards(volontari, mezzi, materiali, groupBy = "organizzazione") {
  const map = new Map();
  const getGroup = r => (groupBy === "squadra" ? norm(r.squadra) : norm(r.organizzazione)) || "—";
  function ensure(group, service) {
    const key = `${group}|||${service}`;
    if (!map.has(key)) map.set(key, { key, groupValue: group, service, volontari: [], mezzi: [], materiali: [] });
    return map.get(key);
  }
  for (const r of volontari) ensure(getGroup(r), norm(r.servizio) || "IN ATTESA DI SERVIZIO").volontari.push(r);
  for (const r of mezzi)     ensure(getGroup(r), norm(r.servizio) || "IN ATTESA DI SERVIZIO").mezzi.push(r);
  for (const r of materiali) ensure(getGroup(r), norm(r.servizio) || "IN ATTESA DI SERVIZIO").materiali.push(r);
  return Array.from(map.values()).sort((a, b) => a.groupValue.localeCompare(b.groupValue, "it"));
}

function popupRisorse(servizio, cards) {
  const totV = cards.reduce((s, c) => s + c.volontari.length, 0);
  const totM = cards.reduce((s, c) => s + c.mezzi.length, 0);
  const totA = cards.reduce((s, c) => s + c.materiali.length, 0);
  let h = `<div style="min-width:240px;max-height:380px;overflow-y:auto">
    <p style="font-weight:600;margin:0 0 4px">${servizio}</p>
    <p style="font-size:.75rem;color:#666;margin:0 0 8px">
      ${totV > 0 ? `<i class="ri-user-line"></i> ${totV}&nbsp;` : ""}
      ${totM > 0 ? `<i class="ri-truck-line"></i> ${totM}&nbsp;` : ""}
      ${totA > 0 ? `<i class="ri-tools-line"></i> ${totA}` : ""}
      ${totV + totM + totA === 0 ? "Nessuna risorsa assegnata" : ""}
    </p>`;
  for (const card of cards) {
    const cv = card.volontari.length, cm = card.mezzi.length, cmat = card.materiali.length;
    if (!cv && !cm && !cmat) continue;
    h += `<details style="margin-bottom:4px;border:.5px solid #ddd;border-radius:4px;padding:2px 6px">
      <summary style="font-size:.8rem;cursor:pointer;font-weight:500">${card.groupValue}
        <span style="color:#888;font-weight:400">
          ${cv > 0 ? ` · <i class="ri-user-line"></i> ${cv}` : ""}
          ${cm > 0 ? ` <i class="ri-truck-line"></i> ${cm}` : ""}
          ${cmat > 0 ? ` <i class="ri-tools-line"></i> ${cmat}` : ""}
        </span>
      </summary>
      ${cv > 0 ? `<ul style="margin:2px 0 4px 12px;padding:0;font-size:.73rem">${card.volontari.map(v => `<li>${norm(v.cognome)} ${norm(v.nome)}</li>`).join("")}</ul>` : ""}
      ${cm > 0 ? `<ul style="margin:2px 0 4px 12px;padding:0;font-size:.73rem">${card.mezzi.map(m => `<li>${norm(m.targa)}${norm(m.marca) ? ` (${norm(m.marca)} ${norm(m.modello)})` : ""}</li>`).join("")}</ul>` : ""}
      ${cmat > 0 ? `<ul style="margin:2px 0 4px 12px;padding:0;font-size:.73rem">${card.materiali.map(m => `<li>${norm(m["id-materiale"]) || norm(m["codice-inventario"]) || norm(m.tipologia) || "—"}</li>`).join("")}</ul>` : ""}
    </details>`;
  }
  return h + `</div>`;
}

// ---- priority detection -----------------------------------------------------

const HIGH_KW = ["EMERGENZA", "SOS", "URGENTE", "URGENZA", "INCENDIO", "FERITO", "FERITI", "PERICOLO", "MAYDAY"];
const MED_KW  = ["ATTENZIONE", "ALLERTA", "PROBLEMA"];

function detectPriority(r) {
  const p = norm(r.priorita).toUpperCase();
  if (p === "ALTA" || p === "EMERGENZA") return "high";
  if (p === "MEDIA" || p === "ATTENZIONE") return "medium";
  const text = norm(r.messaggio).toUpperCase();
  if (HIGH_KW.some(k => text.includes(k))) return "high";
  if (MED_KW.some(k => text.includes(k))) return "medium";
  return "normal";
}

// ---- audio ------------------------------------------------------------------

function playBeep(priority) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const play = (freq, vol, dur, delay = 0) => {
      setTimeout(() => {
        try {
          const c = new (window.AudioContext || window.webkitAudioContext)();
          const o = c.createOscillator(), g = c.createGain();
          o.connect(g); g.connect(c.destination);
          o.frequency.value = freq;
          g.gain.setValueAtTime(vol, c.currentTime);
          g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + dur);
          o.start(); o.stop(c.currentTime + dur);
        } catch(_) {}
      }, delay);
    };
    ctx.close();
    if (priority === "high") {
      play(1000, 0.4, 0.35, 0);
      play(1200, 0.4, 0.35, 400);
    } else {
      play(660, 0.2, 0.2, 0);
    }
  } catch(_) {}
}

// ---- CSS injection (once) ---------------------------------------------------

function injectStyles() {
  if (document.getElementById("cf-styles")) return;
  const s = document.createElement("style");
  s.id = "cf-styles";
  s.textContent = `
    @keyframes cf-flash {
      0%   { box-shadow: inset 0 0 0 2px #3b82f6, inset 0 0 16px rgba(59,130,246,.25); }
      80%  { box-shadow: inset 0 0 0 2px rgba(59,130,246,.3); }
      100% { box-shadow: none; }
    }
    .cf-new { animation: cf-flash 4s ease-out forwards; }
    #cf-feed-panel::-webkit-scrollbar { width: 5px; }
    #cf-feed-panel::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
  `;
  document.head.appendChild(s);
}

// ---- main export ------------------------------------------------------------

export async function CommsFeed({ client, html, render, root }) {
  injectStyles();

  // comms state
  let comms = [];
  let commsLoading = false;
  let commsError = null;
  let lastCommsDate = "";
  let newIds = new Set();
  let channelFilter = "";
  let commsInterval = 10;
  let commsCountdown = 10;
  let commsTimer = null;
  let newCount = 0;

  // audio
  let audioEnabled = false;

  // map state
  let servizi = [];
  let volontari = [], mezzi = [], materiali = [];
  let mapLoading = false;
  let mapCountdown = 60;
  let mapTimer = null;
  let leafletMap = null;
  let markersByName = new Map();
  let groupBy = "organizzazione";
  let sidebarOpen = true;
  let expandedGroups = new Set();

  function rerender() {
    const feed = document.getElementById("cf-feed-panel");
    const st = feed ? feed.scrollTop : 0;
    render(view(), root);
    if (st > 0) {
      const f = document.getElementById("cf-feed-panel");
      if (f) f.scrollTop = st;
    }
  }

  // ---- comms ------------------------------------------------------------------

  async function loadComms() {
    commsLoading = true;
    commsError = null;
    rerender();
    try {
      const res = await client.table("com-digitali").list({
        include: ["id", "received-date", "data/ora", "canale-origine",
                  "chiamante", "chiamato", "username", "messaggio", "priorita",
                  "tipo-contenuto", "stato-elaborazione",
                  "latitudine", "longitudine"],
        size: 100,
        order: [["data/ora", "desc"]]
      });
      const records = getRecords(res);

      const dateOf = r => norm(r["data/ora"]) || norm(r["received-date"]);

      const prevDate = lastCommsDate;
      const incoming = prevDate
        ? records.filter(r => dateOf(r) > prevDate)
        : [];

      if (incoming.length > 0) {
        newCount += incoming.length;
        incoming.forEach(r => newIds.add(r.id));
        if (audioEnabled) {
          const top = incoming.reduce((max, r) => {
            const p = detectPriority(r);
            return p === "high" ? "high" : (p === "medium" && max !== "high" ? "medium" : max);
          }, "normal");
          playBeep(top);
        }
        setTimeout(() => { incoming.forEach(r => newIds.delete(r.id)); rerender(); }, 4000);
      }

      if (records.length > 0) {
        lastCommsDate = records.reduce((max, r) => {
          const d = dateOf(r); return d > max ? d : max;
        }, "");
      }

      comms = records;
    } catch(e) {
      commsError = e;
    } finally {
      commsLoading = false;
      rerender();
    }
  }

  function startCommsTimer() {
    if (commsTimer) clearInterval(commsTimer);
    commsCountdown = commsInterval;
    commsTimer = setInterval(() => {
      commsCountdown--;
      if (commsCountdown <= 0) { commsCountdown = commsInterval; loadComms(); }
      else rerender();
    }, 1000);
  }

  // ---- map data ---------------------------------------------------------------

  async function loadMap() {
    mapLoading = true;
    rerender();
    try {
      const [resSrv, resV, resM, resMat] = await Promise.all([
        client.table("servizi").list({ include: INCLUDE_SRV, size: 500 }),
        client.table("volontari").list({ include: INCLUDE_V, size: 5000 }),
        client.table("mezzi").list({ include: INCLUDE_M, size: 5000 }),
        client.table("materiali").list({ include: INCLUDE_MAT, size: 5000 }),
      ]);
      servizi   = getRecords(resSrv).filter(r => norm(r.nome));
      const fa  = r => isActive(r) && norm(r.servizio) !== "USCITA DEFINITIVA";
      volontari = getRecords(resV).filter(fa);
      mezzi     = getRecords(resM).filter(fa);
      materiali = getRecords(resMat).filter(fa);
    } catch(_) {}
    mapLoading = false;
    rerender();
    if (leafletMap) refreshMarkers();
  }

  function startMapTimer() {
    if (mapTimer) clearInterval(mapTimer);
    mapCountdown = 60;
    mapTimer = setInterval(() => {
      mapCountdown--;
      if (mapCountdown <= 0) { mapCountdown = 60; loadMap(); }
      else rerender();
    }, 1000);
  }

  // ---- leaflet ----------------------------------------------------------------

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

  function refreshMarkers() {
    if (!leafletMap || !window.L) return;
    const L = window.L;
    for (const { marker } of markersByName.values()) leafletMap.removeLayer(marker);
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
      const nome = norm(r.nome);
      const icon = L.icon({
        iconUrl: markerIconUrl(norm(r.colore), norm(r.lettera)),
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
      });
      const m = L.marker([lat, lon], { icon })
        .addTo(leafletMap)
        .bindPopup(popupRisorse(nome, byService.get(nome) || []), { maxWidth: 320 });
      markersByName.set(nome, { marker: m, lat, lon });
      bounds.extend([lat, lon]);
    }
    if (bounds.isValid()) leafletMap.fitBounds(bounds, { padding: [20, 20] });
  }

  let _tempMarker = null;

  function flyToCoords(lat, lon, label) {
    if (!leafletMap || !window.L) return;
    const L = window.L;
    leafletMap.flyTo([lat, lon], 16);
    if (_tempMarker) { leafletMap.removeLayer(_tempMarker); _tempMarker = null; }
    _tempMarker = L.circleMarker([lat, lon], {
      radius: 10, color: "#ef4444", fillColor: "#ef4444",
      fillOpacity: 0.35, weight: 2
    }).addTo(leafletMap);
    if (label) _tempMarker.bindPopup(`<strong>${label}</strong>`).openPopup();
    setTimeout(() => {
      if (_tempMarker) { leafletMap.removeLayer(_tempMarker); _tempMarker = null; }
    }, 8000);
  }

  function flyToLocation(nome) {
    const entry = markersByName.get(nome);
    if (!entry || !leafletMap) return;
    leafletMap.flyTo([entry.lat, entry.lon], 14);
    entry.marker.openPopup();
  }

  async function initMap() {
    const container = document.getElementById("cf-map-container");
    if (!container || leafletMap) return;
    try {
      await loadLeaflet();
      const L = window.L;
      const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      });
      const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri"
      });
      leafletMap = L.map(container, { center: [41.87, 12.57], zoom: 6, layers: [osm] });
      L.control.layers({ "OpenStreetMap": osm, "Satellite": sat }).addTo(leafletMap);
      refreshMarkers();
    } catch(_) {}
  }

  function fitPanelHeight() {
    const feed    = document.getElementById("cf-feed-panel");
    const map     = document.getElementById("cf-map-panel");
    const sidebar = document.getElementById("cf-sidebar");
    if (!feed || !map) return;
    const top = feed.getBoundingClientRect().top;
    const h = Math.max(400, window.innerHeight - Math.round(top) - 4);
    feed.style.height = h + "px";
    map.style.height  = h + "px";
    if (sidebar) sidebar.style.height = h + "px";
    if (leafletMap) leafletMap.invalidateSize();
  }

  window.addEventListener("resize", fitPanelHeight);

  // ---- sidebar risorse --------------------------------------------------------

  function renderSidebarRisorse() {
    const cards = buildCards(volontari, mezzi, materiali, groupBy);
    const byService = new Map();
    for (const c of cards) {
      if (!byService.has(c.service)) byService.set(c.service, []);
      byService.get(c.service).push(c);
    }

    const righe = servizi
      .filter(r => !SERVIZI_FITTIZI.includes(norm(r.nome)))
      .map(r => {
        const nome = norm(r.nome);
        const srvCards = byService.get(nome) || [];
        const totV   = srvCards.reduce((s, c) => s + c.volontari.length, 0);
        const totM   = srvCards.reduce((s, c) => s + c.mezzi.length, 0);
        const totMat = srvCards.reduce((s, c) => s + c.materiali.length, 0);
        if (!totV && !totM && !totMat) return "";
        const nGruppi = srvCards.length;
        const gruppoIcon = groupBy === "squadra" ? "ri-group-line" : "ri-building-line";
        return html`
          <div style="margin-bottom:.5rem;cursor:pointer;padding:4px 6px;border-radius:4px"
            title="Centra sulla mappa"
            @click=${() => flyToLocation(nome)}
            @mouseover=${e => e.currentTarget.style.background = "#f0f4ff"}
            @mouseout=${e => e.currentTarget.style.background = ""}>
            <div style="font-size:.78rem;font-weight:600;display:flex;align-items:center;gap:4px">
              <img src="${markerIconUrl(norm(r.colore), norm(r.lettera))}"
                style="width:auto;height:18px;flex-shrink:0" alt="">
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${nome}</span>
            </div>
            <div style="font-size:.73rem;color:#555;padding-left:6px;margin-bottom:3px">
              ${nGruppi > 0 ? html`<span style="color:#6366f1"><i class="${gruppoIcon}"></i> ${nGruppi}&nbsp;</span>` : ""}
              ${totV   > 0 ? html`<span><i class="ri-user-line"></i> ${totV}&nbsp;</span>` : ""}
              ${totM   > 0 ? html`<span><i class="ri-truck-line"></i> ${totM}&nbsp;</span>` : ""}
              ${totMat > 0 ? html`<span><i class="ri-tools-line"></i> ${totMat}</span>` : ""}
            </div>
            ${srvCards.map(c => {
              const gKey = `${nome}|${c.groupValue}`;
              const isExp = expandedGroups.has(gKey);
              return html`
                <div>
                  <div style="display:flex;align-items:baseline;justify-content:space-between;
                    padding:1px 6px;font-size:.69rem;color:#6b7280;gap:6px;
                    cursor:pointer;border-radius:3px"
                    @mouseover=${e => e.currentTarget.style.background = "#f3f4f6"}
                    @mouseout=${e => e.currentTarget.style.background = ""}
                    @click=${e => {
                      e.stopPropagation();
                      if (expandedGroups.has(gKey)) expandedGroups.delete(gKey);
                      else expandedGroups.add(gKey);
                      rerender();
                    }}>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0">
                      <i class="${isExp ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"}"
                        style="font-size:.7rem"></i>
                      ${c.groupValue}
                    </span>
                    <span style="flex-shrink:0;white-space:nowrap;color:#888">
                      ${c.volontari.length > 0 ? html`<i class="ri-user-line"></i>${c.volontari.length}&nbsp;` : ""}
                      ${c.mezzi.length     > 0 ? html`<i class="ri-truck-line"></i>${c.mezzi.length}&nbsp;` : ""}
                      ${c.materiali.length > 0 ? html`<i class="ri-tools-line"></i>${c.materiali.length}` : ""}
                    </span>
                  </div>
                  ${isExp ? html`
                    <div style="padding-left:1.1rem;font-size:.67rem;color:#4b5563;line-height:1.7">
                      ${c.volontari.map(v => html`
                        <div style="display:flex;gap:4px;align-items:center">
                          <i class="ri-user-line" style="flex-shrink:0;color:#6366f1"></i>
                          <span>${norm(v.cognome)} ${norm(v.nome)}</span>
                        </div>
                      `)}
                      ${c.mezzi.map(m => html`
                        <div style="display:flex;gap:4px;align-items:center">
                          <i class="ri-truck-line" style="flex-shrink:0;color:#f59e0b"></i>
                          <span>${norm(m.targa)}${norm(m.marca) ? " · " + norm(m.marca) : ""}</span>
                        </div>
                      `)}
                      ${c.materiali.map(a => html`
                        <div style="display:flex;gap:4px;align-items:center">
                          <i class="ri-tools-line" style="flex-shrink:0;color:#10b981"></i>
                          <span>${norm(a["id-materiale"]) || norm(a["codice-inventario"])}${norm(a.tipologia) ? " · " + norm(a.tipologia) : ""}</span>
                        </div>
                      `)}
                    </div>
                  ` : ""}
                </div>
              `;
            })}
          </div>
        `;
      });

    const empty = righe.every(r => !r);

    return html`
      <div id="cf-sidebar"
        style="flex:1;overflow-y:auto;border-left:1px solid #e5e7eb;
          padding:.65rem .6rem;background:#fafafa;box-sizing:border-box">

        <div style="font-size:.68rem;font-weight:700;text-transform:uppercase;
          letter-spacing:.06em;color:#9ca3af;margin-bottom:.5rem">Risorse per servizio</div>

        <div class="buttons has-addons mb-3" style="margin-bottom:.65rem">
          <button class="button is-small ${groupBy === 'organizzazione' ? 'is-link is-selected' : ''}"
            @click=${() => { groupBy = "organizzazione"; refreshMarkers(); rerender(); }}>
            Organizzazione
          </button>
          <button class="button is-small ${groupBy === 'squadra' ? 'is-link is-selected' : ''}"
            @click=${() => { groupBy = "squadra"; refreshMarkers(); rerender(); }}>
            Squadra
          </button>
        </div>

        ${empty ? html`<p style="font-size:.75rem;color:#9ca3af">Nessuna risorsa attiva.</p>` : righe}
      </div>
    `;
  }

  // ---- view helpers -----------------------------------------------------------

  function formatTime(r) {
    const s = norm(r["data/ora"]);
    const m = /(\d{2}:\d{2})/.exec(s);
    return m ? m[1] : "";
  }

  function channelIcon(canale) {
    const c = norm(canale).toLowerCase();
    if (c === "telegram") return "ri-telegram-line";
    if (c.includes("radio")) return "ri-radio-line";
    return "ri-message-line";
  }

  function channelColor(canale) {
    const c = norm(canale).toLowerCase();
    if (c === "telegram") return "#0088cc";
    if (c.includes("radio")) return "#e67e22";
    return "#888";
  }

  function isRecent(r, nowMs) {
    const s = norm(r["data/ora"]);
    if (!s) return false;
    try { return (nowMs - new Date(s).getTime()) < 4 * 60 * 1000; }
    catch(_) { return false; }
  }

  function cardBg(priority, recent) {
    if (priority === "high")   return recent ? "#ffe4e4" : "#fff5f5";
    if (priority === "medium") return recent ? "#fff3d0" : "#fffbf0";
    return recent ? "#eff6ff" : "#fff";
  }

  function priorityBorder(p) {
    if (p === "high")   return "border-left:4px solid #ef4444";
    if (p === "medium") return "border-left:4px solid #f59e0b";
    return "border-left:4px solid #e5e7eb";
  }

  // ---- feed item --------------------------------------------------------------

  function feedItem(r, nowMs) {
    const priority  = detectPriority(r);
    const isNew     = newIds.has(r.id);
    const recent    = isRecent(r, nowMs);
    const canale    = norm(r["canale-origine"]);
    const mittente  = norm(r.chiamante) || norm(r.username) || "—";
    const chiamato  = norm(r.chiamato);
    const username  = norm(r.username);
    const lat       = parseFloat(r.latitudine);
    const lon       = parseFloat(r.longitudine);
    const hasCoords = lat && lon;

    return html`
      <div class="${isNew ? "cf-new" : ""}"
        style="${priorityBorder(priority)};background:${cardBg(priority, recent)};
          border-radius:6px;margin-bottom:8px;padding:10px 12px;position:relative">

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap">
          <i class="${channelIcon(canale)}"
            style="color:${channelColor(canale)};font-size:15px;flex-shrink:0"></i>
          <span style="font-size:11px;font-weight:700;color:${channelColor(canale)}">
            ${canale || "—"}
          </span>

          ${priority === "high" ? html`
            <span style="background:#ef4444;color:#fff;font-size:10px;font-weight:700;
              padding:1px 7px;border-radius:10px;letter-spacing:.04em">EMERGENZA</span>
          ` : ""}
          ${priority === "medium" ? html`
            <span style="background:#f59e0b;color:#fff;font-size:10px;font-weight:700;
              padding:1px 7px;border-radius:10px">ATTENZIONE</span>
          ` : ""}

          <span style="font-size:11px;color:#9ca3af;margin-left:auto;flex-shrink:0;
            display:flex;align-items:center;gap:6px">
            ${hasCoords ? html`
              <button title="Mostra su mappa"
                style="background:none;border:none;cursor:pointer;padding:0;line-height:1;
                  color:#3b82f6;font-size:14px"
                @click=${e => { e.stopPropagation(); flyToCoords(lat, lon, mittente); }}>
                <i class="ri-map-pin-line"></i>
              </button>
            ` : ""}
            ${formatTime(r)}
          </span>
        </div>

        <div style="font-size:12px;color:#6b7280;margin-bottom:5px">
          <strong style="color:#374151">${mittente}</strong>
          ${chiamato ? html`
            <span style="color:#9ca3af;margin:0 3px">→</span>
            <strong style="color:#374151">${chiamato}</strong>
          ` : ""}
          ${username && username !== mittente
            ? html`<span style="color:#9ca3af;margin-left:4px">@${username}</span>`
            : ""}
        </div>

        <div style="font-size:14px;line-height:1.5;word-break:break-word;color:#111">
          ${norm(r.messaggio) || html`<em style="color:#ccc">—</em>`}
        </div>
      </div>
    `;
  }

  // ---- main view --------------------------------------------------------------

  function view() {
    const channels = [...new Set(comms.map(r => norm(r["canale-origine"])).filter(Boolean))];
    const filtered = channelFilter
      ? comms.filter(r => norm(r["canale-origine"]).toLowerCase() === channelFilter.toLowerCase())
      : comms;

    const nowMs = Date.now();
    const nV   = volontari.length;
    const nM   = mezzi.length;
    const nA   = materiali.length;
    const nOrg = new Set([
      ...volontari.map(r => norm(r.organizzazione)),
      ...mezzi.map(r => norm(r.organizzazione)),
      ...materiali.map(r => norm(r.organizzazione))
    ].filter(Boolean)).size;

    return html`
      <!-- toolbar -->
      <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;
        background:#1e293b;color:#e2e8f0;flex-wrap:wrap">

        <strong style="font-size:13px;color:#f8fafc;white-space:nowrap;display:flex;align-items:center;gap:6px">
          <i class="ri-broadcast-line" style="color:#ef4444;font-size:16px"></i>
          Comunicazioni live
        </strong>

        <button
          style="background:${audioEnabled ? "#16a34a" : "#475569"};border:none;color:#fff;
            border-radius:20px;padding:4px 12px;cursor:pointer;font-size:12px;
            display:flex;align-items:center;gap:5px;white-space:nowrap"
          @click=${() => { audioEnabled = !audioEnabled; rerender(); }}>
          <i class="${audioEnabled ? "ri-volume-up-line" : "ri-volume-mute-line"}"></i>
          ${audioEnabled ? "Audio ON" : "Audio OFF"}
        </button>

        <div style="display:flex;gap:4px;flex-wrap:wrap">
          ${["", ...channels].map(ch => html`
            <span
              style="cursor:pointer;padding:3px 10px;border-radius:12px;font-size:12px;
                background:${channelFilter === ch ? "#3b82f6" : "#334155"};color:#e2e8f0;
                user-select:none;display:flex;align-items:center;gap:4px;white-space:nowrap"
              @click=${() => { channelFilter = ch; rerender(); }}>
              ${ch ? html`<i class="${channelIcon(ch)}"></i>${ch}` : "Tutti"}
            </span>
          `)}
        </div>

        ${nV + nM + nA > 0 ? html`
          <div style="display:flex;align-items:center;gap:10px;padding:3px 10px;
            background:#0f172a;border-radius:20px;font-size:12px;color:#94a3b8;
            white-space:nowrap;flex-shrink:0">
            ${nOrg > 0 ? html`<span title="Organizzazioni"><i class="ri-building-line"></i> ${nOrg}</span>` : ""}
            ${nV > 0   ? html`<span title="Volontari"><i class="ri-user-line"></i> ${nV}</span>` : ""}
            ${nM > 0   ? html`<span title="Mezzi"><i class="ri-truck-line"></i> ${nM}</span>` : ""}
            ${nA > 0   ? html`<span title="Materiali"><i class="ri-tools-line"></i> ${nA}</span>` : ""}
          </div>
        ` : ""}

        <div style="margin-left:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <span style="font-size:11px;color:#94a3b8;white-space:nowrap">
            Feed
            <select style="background:#334155;color:#e2e8f0;border:none;border-radius:4px;
              font-size:11px;padding:2px 5px;margin:0 3px;cursor:pointer"
              @change=${e => {
                commsInterval = parseInt(e.target.value);
                startCommsTimer();
              }}>
              <option value="10" ?selected=${commsInterval === 10}>10s</option>
              <option value="30" ?selected=${commsInterval === 30}>30s</option>
              <option value="60" ?selected=${commsInterval === 60}>60s</option>
            </select>
            <span style="color:${commsCountdown <= 3 ? "#fbbf24" : "#94a3b8"}">
              ${commsCountdown}s
            </span>
            ${commsLoading ? html`<i class="ri-loader-4-line" style="margin-left:3px"></i>` : ""}
          </span>

          <span style="font-size:11px;color:#94a3b8;white-space:nowrap">
            Mappa ${mapCountdown}s
            ${mapLoading ? html`<i class="ri-loader-4-line" style="margin-left:3px"></i>` : ""}
          </span>

          <button
            title="${sidebarOpen ? "Nascondi risorse" : "Mostra risorse"}"
            style="background:${sidebarOpen ? "#3b82f6" : "#475569"};border:none;color:#fff;
              border-radius:4px;padding:4px 8px;cursor:pointer;font-size:13px;
              display:flex;align-items:center;gap:4px;flex-shrink:0"
            @click=${() => { sidebarOpen = !sidebarOpen; rerender(); setTimeout(fitPanelHeight, 0); }}>
            <i class="ri-layout-right-line"></i>
          </button>
        </div>
      </div>

      <!-- two panels -->
      <div style="display:flex;overflow:hidden">

        <!-- left: feed -->
        <div id="cf-feed-panel"
          style="flex:1;overflow-y:auto;padding:10px;
            border-right:1px solid #e5e7eb;box-sizing:border-box">

          ${commsError ? html`
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;
              padding:10px;margin-bottom:8px;font-size:13px;color:#b91c1c;
              display:flex;align-items:center;gap:8px">
              <i class="ri-error-warning-line"></i>
              Errore caricamento.
              <button style="font-size:12px;cursor:pointer;margin-left:6px"
                @click=${loadComms}>Riprova</button>
            </div>
          ` : ""}

          ${newCount > 0 ? html`
            <div
              style="position:sticky;top:0;z-index:10;margin:-10px -10px 8px;
                background:#3b82f6;color:#fff;font-size:12px;font-weight:500;
                padding:6px 12px;cursor:pointer;
                display:flex;align-items:center;justify-content:center;gap:6px"
              @click=${() => {
                const feed = document.getElementById("cf-feed-panel");
                if (feed) feed.scrollTop = 0;
                newCount = 0;
                rerender();
              }}>
              <i class="ri-arrow-up-line"></i>
              ${newCount} nuovi — vai in cima
            </div>
          ` : ""}

          ${!commsLoading && filtered.length === 0 ? html`
            <div style="text-align:center;color:#9ca3af;padding:3rem 1rem;font-size:13px">
              <i class="ri-inbox-line" style="font-size:2rem;display:block;margin-bottom:.5rem"></i>
              Nessuna comunicazione
            </div>
          ` : filtered.map(r => feedItem(r, nowMs))}
        </div>

        <!-- centre: map -->
        <div id="cf-map-panel" style="flex:1;overflow:hidden;isolation:isolate">
          <div id="cf-map-container" style="width:100%;height:100%"></div>
        </div>

        <!-- right: sidebar -->
        ${sidebarOpen ? renderSidebarRisorse() : ""}
      </div>
    `;
  }

  // ---- init -------------------------------------------------------------------

  loadComms();
  loadMap();
  startCommsTimer();
  startMapTimer();

  const initial = view();
  setTimeout(() => { initMap(); setTimeout(fitPanelHeight, 150); }, 0);
  return initial;
}
