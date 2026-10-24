// views/shared/map-picker.js
//
// Selettore di posizione su mappa: Leaflet per la cartografia, Nominatim per la
// ricerca dell'indirizzo e il reverse geocoding.
//
// Usato da service-manager e intervention-manager, che scrivono entrambe
// latitudine/longitudine/comune/provincia/indirizzo sulla tabella `servizi`.
//
// Uso:
//   import { createMapPicker, MAP_PICKER_CSS } from "../shared/map-picker.js";
//
//   const picker = createMapPicker({
//     html,
//     rerender,
//     onConfirm: pos => { /* pos = { lat, lon, comune, provincia, indirizzo } */ }
//   });
//
//   // nel template: ${MAP_PICKER_CSS} dentro <style>, e ${picker.template()}
//   // in rerender(): picker.afterRender()  <- indispensabile, monta la mappa
//   // per aprire:    picker.open({ lat, lon, query })

export const MAP_PICKER_CSS = `
  .mp-overlay { position:fixed; inset:0; background:rgba(0,0,0,.5); z-index:9000; display:flex; align-items:center; justify-content:center; }
  .mp-modal { background:#fff; border-radius:8px; width:90vw; max-width:860px; height:80vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,.25); }
  .mp-header { padding:.75rem 1rem; border-bottom:1px solid #dbdbdb; display:flex; align-items:center; gap:.5rem; }
  .mp-body { display:flex; flex:1; overflow:hidden; }
  .mp-sidebar { width:280px; flex-shrink:0; border-right:1px solid #dbdbdb; display:flex; flex-direction:column; padding:.75rem; gap:.5rem; overflow-y:auto; }
  .mp-results { list-style:none; margin:0; padding:0; }
  .mp-results li { padding:.4rem .5rem; font-size:.8rem; cursor:pointer; border-radius:4px; border-bottom:1px solid #f0f0f0; }
  .mp-results li:hover { background:#f0f5ff; }
  .mp-canvas { flex:1; }
  #mp-leaflet-container { width:100%; height:100%; }
  .mp-footer { padding:.6rem 1rem; border-top:1px solid #dbdbdb; display:flex; align-items:center; gap:.5rem; font-size:.82rem; }
  .mp-coords { color:#555; flex:1; }
`;

const CONTAINER_ID = "mp-leaflet-container";

let _leafletReady = false;

export async function loadLeaflet() {
  if (_leafletReady || window.L) { _leafletReady = true; return; }
  await new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
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

export async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&accept-language=it`;
  const res = await fetch(url, { headers: { "Accept-Language": "it" } });
  return res.json();
}

export async function nominatimReverse(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&accept-language=it`;
  const res = await fetch(url);
  return res.json();
}

export function extractAddress(data) {
  const a = data?.address || {};
  // comune: dal piu' specifico al piu' generico
  const comune = a.city || a.town || a.village || a.municipality ||
                 a.city_district || a.suburb || a.hamlet || a.quarter || "";
  // provincia: ISO3166-2-lvl6 ("IT-CR" -> "CR"), fallback lvl5 e state_code
  const iso = a["ISO3166-2-lvl6"] || a["ISO3166-2-lvl5"] || "";
  let provincia = iso ? iso.replace(/^[A-Z]{2}-/, "").slice(0, 2).toUpperCase() : "";
  if (!provincia && a.state_code) provincia = a.state_code.slice(0, 2).toUpperCase();
  return {
    comune,
    provincia,
    indirizzo: [a.road, a.house_number].filter(Boolean).join(" ")
  };
}

/**
 * @param {Object}   opts
 * @param {Function} opts.html      tag template di lit-html
 * @param {Function} opts.rerender  ridisegna la vista ospite
 * @param {Function} opts.onConfirm riceve { lat, lon, comune, provincia, indirizzo }
 */
export function createMapPicker({ html, rerender, onConfirm }) {
  let open = false;
  let search = "";
  let results = [];
  let searching = false;
  let reversing = false;
  let lat = null;
  let lon = null;
  let address = {};

  let _map = null;
  let _marker = null;
  let _inited = false;

  const hasCoords = () => lat !== null && lon !== null;

  // Va chiamata dopo ogni render della vista ospite: il contenitore esiste solo
  // quando la modale e' nel DOM, quindi la mappa si monta qui e non all'apertura.
  function afterRender() {
    if (open) initMap();
  }

  function initMap() {
    const el = document.getElementById(CONTAINER_ID);
    if (!el || _inited) return;
    _inited = true;

    const startLat = lat ?? 42.0;
    const startLon = lon ?? 12.5;
    const startZoom = lat ? 14 : 6;

    _map = window.L.map(el).setView([startLat, startLon], startZoom);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 19
    }).addTo(_map);

    if (lat !== null) placeMarker(lat, lon);
    _map.on("click", e => onMapClick(e.latlng.lat, e.latlng.lng));
  }

  function placeMarker(la, lo) {
    if (_marker) { _marker.setLatLng([la, lo]); return; }
    _marker = window.L.marker([la, lo], { draggable: true }).addTo(_map);
    _marker.on("dragend", () => {
      const p = _marker.getLatLng();
      lat = p.lat; lon = p.lng;
      reverseAndUpdate(p.lat, p.lng);
    });
  }

  async function onMapClick(la, lo) {
    lat = la; lon = lo;
    placeMarker(la, lo);
    await reverseAndUpdate(la, lo);
  }

  async function reverseAndUpdate(la, lo) {
    reversing = true; rerender();
    try {
      address = extractAddress(await nominatimReverse(la, lo));
    } catch {
      address = {};
    }
    reversing = false; rerender();
  }

  async function doSearch() {
    if (!search.trim()) return;
    searching = true; results = []; rerender();
    try {
      results = await nominatimSearch(search);
    } catch {
      results = [];
    }
    searching = false; rerender();
  }

  function selectResult(r) {
    lat = parseFloat(r.lat);
    lon = parseFloat(r.lon);
    address = extractAddress(r);
    results = [];
    if (_map) {
      _map.setView([lat, lon], 15);
      placeMarker(lat, lon);
    }
    rerender();
  }

  async function openPicker({ lat: la = null, lon: lo = null, query = "" } = {}) {
    lat = Number.isFinite(la) ? la : null;
    lon = Number.isFinite(lo) ? lo : null;
    search = query;
    results = [];
    searching = false;
    reversing = false;
    address = {};
    open = true;
    _inited = false;
    _map = null;
    _marker = null;
    await loadLeaflet();
    rerender();
  }

  function close() {
    open = false;
    _map?.remove();
    _map = null;
    _marker = null;
    _inited = false;
    rerender();
  }

  function confirm() {
    if (!hasCoords()) { close(); return; }
    onConfirm({
      lat: Number(lat.toFixed(6)),
      lon: Number(lon.toFixed(6)),
      comune: address.comune || "",
      provincia: address.provincia || "",
      indirizzo: address.indirizzo || ""
    });
    close();
  }

  function template() {
    if (!open) return "";
    return html`
      <div class="mp-overlay" @click=${e => { if (e.target === e.currentTarget) close(); }}>
        <div class="mp-modal">

          <div class="mp-header">
            <span class="icon"><i class="ri-map-pin-2-line"></i></span>
            <strong style="flex:1">Seleziona posizione</strong>
            <button class="delete" @click=${close}></button>
          </div>

          <div class="mp-body">

            <div class="mp-sidebar">
              <div class="field">
                <label class="label is-small">Cerca indirizzo</label>
                <div class="field has-addons mb-1">
                  <div class="control is-expanded">
                    <input class="input is-small" type="text"
                      placeholder="Es. Via Roma 1, Cremona"
                      .value=${search}
                      @input=${e => { search = e.target.value; }}
                      @keydown=${e => { if (e.key === "Enter") doSearch(); }} />
                  </div>
                  <div class="control">
                    <button class="button is-small is-info ${searching ? "is-loading" : ""}"
                      ?disabled=${searching} @click=${doSearch}>
                      <span class="icon"><i class="ri-search-line"></i></span>
                    </button>
                  </div>
                </div>
                ${results.length > 0 ? html`
                  <ul class="mp-results">
                    ${results.map(r => html`
                      <li @click=${() => selectResult(r)} title=${r.display_name}>
                        ${r.display_name.length > 60 ? r.display_name.slice(0, 60) + "…" : r.display_name}
                      </li>
                    `)}
                  </ul>
                ` : ""}
              </div>

              <hr style="margin:.25rem 0">

              <p class="is-size-7 has-text-grey">
                Clicca sulla mappa o trascina il marker per selezionare il punto esatto.
              </p>

              ${hasCoords() ? html`
                <div style="font-size:.8rem;margin-top:.25rem">
                  <div><strong>Lat:</strong> ${lat?.toFixed(6)}</div>
                  <div><strong>Lon:</strong> ${lon?.toFixed(6)}</div>
                  ${reversing
                    ? html`<div class="has-text-grey"><i class="ri-loader-4-line"></i> Ricerca indirizzo…</div>`
                    : html`
                      ${address.comune ? html`<div><strong>Comune:</strong> ${address.comune}</div>` : ""}
                      ${address.provincia ? html`<div><strong>Prov.:</strong> ${address.provincia}</div>` : ""}
                      ${address.indirizzo ? html`<div><strong>Indirizzo:</strong> ${address.indirizzo}</div>` : ""}
                    `}
                </div>
              ` : html`
                <p class="is-size-7 has-text-grey-light">Nessuna posizione selezionata</p>
              `}
            </div>

            <div class="mp-canvas">
              <div id=${CONTAINER_ID}></div>
            </div>

          </div>

          <div class="mp-footer">
            <span class="mp-coords">
              ${hasCoords()
                ? `📍 ${lat?.toFixed(5)}, ${lon?.toFixed(5)}${address.comune ? " — " + address.comune : ""}`
                : "Nessuna posizione selezionata"}
            </span>
            <button class="button is-small" @click=${close}>Annulla</button>
            <button class="button is-small is-primary"
              ?disabled=${!hasCoords() || reversing} @click=${confirm}>
              <span class="icon"><i class="ri-check-line"></i></span>
              <span>Conferma posizione</span>
            </button>
          </div>

        </div>
      </div>
    `;
  }

  return { open: openPicker, close, confirm, afterRender, template, isOpen: () => open };
}
