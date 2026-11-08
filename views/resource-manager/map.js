// ./views/resource-manager/map.js
//
// The "Mappa" tab of the Database risorse: how many mezzi and materiali there are in the
// territory, as numbers on a map.
//
// Resources have no position of their own: the one they have is that of their organisation
// (`db-organizzazioni.latitudine/longitudine`). A marker per resource would pile hundreds of
// them on the same few points, so the map draws ONE bubble per place with the NUMBER of
// resources that match the filters - the place being an organisation, a comune or a provincia
// (the operator picks). A group of organisations sits at the mean of their coordinates.
//
// Shared-module contract (AGENTS.md): this file does not render by itself. It exports a
// factory that receives `html` and a `rerender` of the host and returns `template()`, plus
// `afterRender(root)` for what must happen after the render (mounting Leaflet in the node the
// template left). It is imported dynamically, with the version, by step1.js.

const VERSION = window.APP_CONFIG?.version || Date.now();

const ORG_TABLE = "db-organizzazioni";
const TABLE = { mezzi: "db-mezzi", materiali: "db-materiali" };
const LABEL = { mezzi: "Mezzi", materiali: "Materiali" };
const PAGE = 1000;        // rows per read, as the export and the classifications
const MAX_PAGES = 200;

// bubble colours: by what the filters ask for, so the legend is one line
const COLOR = { mezzi: "#3273dc", materiali: "#e8590c", both: "#7048e8" };

const safe = (v) => (v == null ? "" : String(v));
const records = (res) =>
  Array.isArray(res) ? res : Array.isArray(res?.records) ? res.records : Array.isArray(res?.data?.records) ? res.data.records : [];

function parseCoord(lat, lon) {
  const la = parseFloat(lat), lo = parseFloat(lon);
  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (Math.abs(la) > 90 || Math.abs(lo) > 180) return null;
  if (la === 0 && lo === 0) return null;   // an empty cell read as 0,0 is not a place
  return { lat: la, lon: lo };
}

export function createResourceMap(initialDeps) {
  // The host calls bind() on every render of its own: the factory outlives a host invocation,
  // so the callbacks it holds must follow the latest one.
  let deps = initialDeps;
  const bind = (d) => { deps = { ...deps, ...d }; };

  const st = {
    loaded: false,
    loading: false,
    error: null,                       // text of the first failed read
    orgs: [],                          // [{ code, name, comune, provincia, pos|null }]
    rows: { mezzi: [], materiali: [] },// [{ org, cat, tip }]
    types: { mezzi: true, materiali: true },
    cat: "",
    tip: "",
    by: "org",                         // "org" | "comune" | "provincia"
    leaflet: "idle",                   // "idle" | "ready" | "error"
    leafletError: null,
    tilesError: false,                 // the background tiles (internet) did not load
  };

  let loadPromise = null;
  let map = null, layer = null, mapEl = null, drawToken = 0;

  // ---- data -------------------------------------------------------------------------
  async function readRows(tab) {
    const table = deps.client.table(TABLE[tab]);
    const out = [];
    let total = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await table.list({
        include: ["codice-organizzazione", "categoria", "tipologia"],
        order: [["id", "asc"]],
        page: [page, PAGE],
      });
      const batch = records(res);
      for (const r of batch) {
        out.push({
          org: safe(r["codice-organizzazione"]).trim(),
          cat: safe(r.categoria).trim(),
          tip: safe(r.tipologia).trim(),
        });
      }
      total += batch.length;
      const all = Number(res?.results ?? total);
      if (!batch.length || total >= all) break;
    }
    return out;
  }

  async function doLoad() {
    st.loading = true;
    st.error = null;
    const [orgs, mezzi, materiali] = await Promise.allSettled([
      deps.client.table(ORG_TABLE).list({
        include: ["codice", "denominazione", "comune", "provincia", "latitudine", "longitudine"],
        size: 5000,
      }),
      readRows("mezzi"),
      readRows("materiali"),
    ]);
    st.orgs = orgs.status === "fulfilled"
      ? records(orgs.value).map((o) => ({
          code: safe(o.codice).trim(),
          name: safe(o.denominazione).trim(),
          comune: safe(o.comune).trim(),
          provincia: safe(o.provincia).trim().toUpperCase(),
          pos: parseCoord(o.latitudine, o.longitudine),
        })).filter((o) => o.code)
      : [];
    st.rows = {
      mezzi: mezzi.status === "fulfilled" ? mezzi.value : [],
      materiali: materiali.status === "fulfilled" ? materiali.value : [],
    };
    const bad = [orgs, mezzi, materiali].find((r) => r.status === "rejected");
    st.error = bad ? deps.errorText(bad.reason) : null;
    st.loaded = true;
    st.loading = false;
  }

  // One read at a time; two renders asking together share it.
  async function load() {
    if (st.loaded) return;
    if (!loadPromise) loadPromise = doLoad().finally(() => { loadPromise = null; });
    await loadPromise;
  }

  // Called when the tab is opened: the data may have changed since.
  function reset() {
    st.loaded = false;
  }

  // ---- filters ----------------------------------------------------------------------
  const vocab = () => deps.vocab();
  const activeTabs = () => Object.keys(LABEL).filter((t) => st.types[t]);

  function catOptions() {
    const seen = new Set();
    for (const t of activeTabs()) for (const c of vocab()[t].cats) seen.add(c);
    return [...seen];
  }

  function tipOptions() {
    const seen = new Set();
    for (const t of activeTabs()) {
      const v = vocab()[t];
      const lists = st.cat ? [v.byCat[st.cat] || []] : Object.values(v.byCat);
      for (const l of lists) for (const tip of l) seen.add(tip);
    }
    return [...seen].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  // a choice that the options no longer offer (a type was switched off) is dropped
  function sanitize() {
    if (st.cat && !catOptions().includes(st.cat)) { st.cat = ""; st.tip = ""; }
    if (st.tip && !tipOptions().includes(st.tip)) st.tip = "";
  }

  function toggleType(t, on) {
    st.types[t] = !!on;
    sanitize();
    deps.rerender();
  }
  function setCat(v) { st.cat = v || ""; st.tip = ""; deps.rerender(); }
  function setTip(v) { st.tip = v || ""; deps.rerender(); }
  function setBy(v) { st.by = ["org", "comune", "provincia"].includes(v) ? v : "org"; deps.rerender(); }

  // ---- numbers ----------------------------------------------------------------------
  // Pure: what is visible, grouped by place. Resources whose organisation is unknown or has
  // no usable coordinates cannot be placed: they are counted apart, never dropped silently.
  function compute() {
    const orgByCode = new Map(st.orgs.map((o) => [o.code, o]));
    const match = (r) => (!st.cat || r.cat === st.cat) && (!st.tip || r.tip === st.tip);
    const groups = new Map();
    const unplaced = new Map();   // organisation (or "") -> resources
    let visible = 0, placed = 0;
    const byType = { mezzi: 0, materiali: 0 };

    for (const t of activeTabs()) {
      for (const r of st.rows[t]) {
        if (!match(r)) continue;
        visible++;
        byType[t]++;
        const o = orgByCode.get(r.org);
        if (!o || !o.pos) {
          const k = r.org || "";
          unplaced.set(k, (unplaced.get(k) || 0) + 1);
          continue;
        }
        placed++;
        const key = st.by === "org" ? o.code : st.by === "comune" ? (o.comune || "(comune non indicato)") : (o.provincia || "(provincia non indicata)");
        let g = groups.get(key);
        if (!g) {
          g = { key, label: st.by === "org" ? (o.name || o.code) : key, n: 0, mezzi: 0, materiali: 0, classes: new Map(), orgs: new Set() };
          groups.set(key, g);
        }
        g.n++;
        g[t]++;
        g.orgs.add(o.code);
        const ck = JSON.stringify([r.cat, r.tip]);
        g.classes.set(ck, (g.classes.get(ck) || 0) + 1);
      }
    }

    const list = [...groups.values()].map((g) => {
      // a group of organisations sits at the mean of their coordinates
      const ps = [...g.orgs].map((c) => orgByCode.get(c).pos);
      return {
        ...g,
        lat: ps.reduce((a, p) => a + p.lat, 0) / ps.length,
        lon: ps.reduce((a, p) => a + p.lon, 0) / ps.length,
      };
    }).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));

    const unplacedList = [...unplaced.entries()]
      .map(([code, n]) => ({ name: code ? (orgByCode.get(code)?.name || code) : "(senza organizzazione)", code, n,
                             known: !!orgByCode.get(code) }))
      .sort((a, b) => b.n - a.n);
    return { list, visible, placed, unplaced: visible - placed, unplacedList, byType };
  }

  // ---- Leaflet ----------------------------------------------------------------------
  async function ensureLeaflet() {
    if (window.L) { st.leaflet = "ready"; return true; }
    if (st.leaflet === "error") return false;
    try {
      const { loadLeaflet } = await import(`../shared/map-picker.js?v=${VERSION}`);
      await loadLeaflet();
      st.leaflet = window.L ? "ready" : "error";
    } catch (e) {
      st.leaflet = "error";
      st.leafletError = e?.message || String(e || "");
    }
    return st.leaflet === "ready";
  }

  function bubbleColor() {
    const a = activeTabs();
    return a.length === 2 ? COLOR.both : a[0] ? COLOR[a[0]] : COLOR.both;
  }

  function size(n, max) {
    return Math.round(Math.min(64, Math.max(26, 26 + 38 * Math.sqrt(n / (max || 1)))));
  }

  // The popup is built with DOM nodes and textContent: organisation names are data.
  function popupNode(g) {
    const el = (tag, text, style) => {
      const e = document.createElement(tag);
      if (text != null) e.textContent = text;
      if (style) e.setAttribute("style", style);
      return e;
    };
    const root = el("div", null, "min-width:220px;max-width:300px");
    root.appendChild(el("strong", g.label));
    root.appendChild(el("div", `${g.n} ${g.n === 1 ? "risorsa" : "risorse"}: ${g.mezzi} mezzi, ${g.materiali} materiali`, "margin:.15rem 0 .4rem"));
    if (st.by !== "org") {
      root.appendChild(el("div", `${g.orgs.size} ${g.orgs.size === 1 ? "organizzazione" : "organizzazioni"}`, "font-size:.8rem;color:#666"));
    }
    const box = el("div", null, "max-height:180px;overflow:auto;font-size:.8rem");
    const rows = [...g.classes.entries()].map(([k, n]) => ({ k: JSON.parse(k), n }))
      .sort((a, b) => b.n - a.n || (a.k[0] + a.k[1]).localeCompare(b.k[0] + b.k[1]));
    for (const { k: [cat, tip], n } of rows) {
      box.appendChild(el("div", `${cat || "(categoria vuota)"}${tip ? " / " + tip : ""}: ${n}`));
    }
    root.appendChild(box);

    // Only for an organisation, the one place that is a single filter of the list. The
    // categoria and tipologia travel along only where that tab's menus can show them.
    if (st.by === "org") {
      const v = vocab();
      for (const t of Object.keys(LABEL)) {
        if (!g[t]) continue;
        const cat = v[t].cats.includes(st.cat) ? st.cat : "";
        const tip = cat && (v[t].byCat[cat] || []).includes(st.tip) ? st.tip : "";
        const a = el("a", `Apri l'elenco ${LABEL[t].toLowerCase()}`, "display:block;margin-top:.4rem");
        a.setAttribute("href", "#");
        a.addEventListener("click", (e) => {
          e.preventDefault();
          deps.onOpen(t, { org: g.key, cat, tip });
        });
        root.appendChild(a);
      }
    }
    return root;
  }

  async function draw(root) {
    const token = ++drawToken;
    const el = root?.querySelector?.("#rm-map");
    if (!el || !st.loaded) return;
    const before = st.leaflet;
    if (!(await ensureLeaflet())) {
      // redraw once, when it turns out there is no map, so the template says why; asking again
      // on every later render would loop
      if (token === drawToken && before !== "error") deps.rerender();
      return;
    }
    if (token !== drawToken) return;   // a newer render took over while Leaflet loaded
    const L = window.L;

    let fresh = false;
    if (!map || mapEl !== el) {
      if (map) map.remove();
      map = L.map(el);
      const tiles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
        maxZoom: 19,
      });
      // Leaflet is local, the tiles are not: without internet the bubbles stay on an empty
      // background, and the page says why, once
      tiles.on?.("tileerror", () => {
        if (!st.tilesError) { st.tilesError = true; deps.rerender(); }
      });
      tiles.addTo(map);
      layer = L.layerGroup().addTo(map);
      map.setView([42.0, 12.5], 6);
      mapEl = el;
      fresh = true;
    }

    layer.clearLayers();
    const { list } = compute();
    const max = list.reduce((m, g) => Math.max(m, g.n), 0);
    const color = bubbleColor();
    const pts = [];
    for (const g of list) {
      const s = size(g.n, max);
      const icon = L.divIcon({
        className: "rm-bubble-wrap",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:${s}px;height:${s}px;border-radius:50%;background:${color};color:#fff;font-weight:700;font-size:${s > 40 ? 14 : 12}px;border:2px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.45)">${g.n}</div>`,
        iconSize: [s, s],
        iconAnchor: [s / 2, s / 2],
      });
      L.marker([g.lat, g.lon], { icon, title: `${g.label}: ${g.n}` })
        .bindPopup(popupNode(g), { maxWidth: 320 })
        .addTo(layer);
      pts.push([g.lat, g.lon]);
    }
    // fit once per map; filtering must not make the view jump
    if (fresh && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 12 });
  }

  function afterRender(root) {
    return draw(root).catch(() => {});
  }

  // ---- template ---------------------------------------------------------------------
  function template() {
    const { html } = deps;
    if (!st.loaded) {
      return html`<progress class="progress is-small m-3" style="width:auto"></progress>`;
    }
    sanitize();
    const c = compute();
    const cats = catOptions();
    const tips = tipOptions();
    const sessionDown = st.error === deps.sessionMessage;

    return html`
      <div class="box spa-title-box p-3">
        <div class="is-flex" style="gap:1rem;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label class="label is-small mb-1">Mostra</label>
            <div style="min-height:2rem;display:flex;align-items:center;gap:.9rem">
              ${Object.keys(LABEL).map((t) => html`
                <label class="checkbox is-size-7">
                  <input type="checkbox" ?checked=${st.types[t]} @change=${(e) => toggleType(t, e.target.checked)} />
                  <span style="color:${COLOR[t]};font-weight:600">${LABEL[t]}</span>
                </label>`)}
            </div>
          </div>
          <div style="flex:1 1 230px;min-width:200px;max-width:340px">
            <label class="label is-small mb-1">Categoria</label>
            <div class="select is-small is-fullwidth">
              <select @change=${(e) => setCat(e.target.value)} title=${st.cat}>
                <option value="" ?selected=${!st.cat}>Tutte</option>
                ${cats.map((x) => html`<option value=${x} ?selected=${x === st.cat}>${x}</option>`)}
              </select>
            </div>
          </div>
          <div style="flex:1 1 260px;min-width:220px;max-width:460px">
            <label class="label is-small mb-1">Tipologia</label>
            <div class="select is-small is-fullwidth">
              <select @change=${(e) => setTip(e.target.value)} title=${st.tip}>
                <option value="" ?selected=${!st.tip}>Tutte</option>
                ${tips.map((x) => html`<option value=${x} ?selected=${x === st.tip}>${x}</option>`)}
              </select>
            </div>
          </div>
          <div style="flex:0 0 190px">
            <label class="label is-small mb-1">Raggruppa per</label>
            <div class="select is-small is-fullwidth">
              <select @change=${(e) => setBy(e.target.value)}>
                <option value="org" ?selected=${st.by === "org"}>Organizzazione</option>
                <option value="comune" ?selected=${st.by === "comune"}>Comune</option>
                <option value="provincia" ?selected=${st.by === "provincia"}>Provincia</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      ${st.error
        ? html`<div class="notification ${sessionDown ? "is-warning" : "is-danger"} is-light py-2 mb-3">
                 ${sessionDown ? deps.sessionMessage : "Non tutti i dati si sono caricati: " + st.error}
                 ${sessionDown ? html` <a href="cf_logout.php">Esci e rientra</a>` : ""}
                 <button class="button is-small ml-2" @click=${() => { reset(); deps.rerender(); }}>Riprova</button>
               </div>`
        : ""}

      <p class="is-size-7 mb-2" data-map-total>
        Sulla mappa <strong>${c.placed}</strong> ${c.placed === 1 ? "risorsa" : "risorse"}
        (${c.byType.mezzi} mezzi, ${c.byType.materiali} materiali${c.unplaced ? `, di cui ${c.unplaced} non posizionabili` : ""})
        in ${c.list.length} ${c.list.length === 1 ? "punto" : "punti"}.
        <span class="has-text-grey">
          Il punto è la sede dell'organizzazione, non dove si trova il mezzo in questo momento.
        </span>
      </p>

      ${st.leaflet === "error"
        ? html`<div class="notification is-warning is-light py-2 mb-3">
                 La mappa non è disponibile: la libreria (camila/js/leaflet) non si è caricata. I numeri restano
                 nell'elenco qui sotto.
               </div>`
        : ""}

      ${st.tilesError && st.leaflet !== "error"
        ? html`<div class="notification is-light py-2 mb-2 is-size-7" data-map-tiles>
                 Lo sfondo della mappa (OpenStreetMap) non si carica: serve internet. I cerchi con i numeri restano al loro posto.
               </div>`
        : ""}

      ${st.leaflet === "error"
        ? ""
        : html`<div id="rm-map" style="height:62vh;min-height:320px;border-radius:6px;border:1px solid #dbdbdb"></div>`}

      <details class="mt-3" ?open=${st.leaflet === "error"}>
        <summary class="is-size-7" style="cursor:pointer">Elenco numerico</summary>
        <table class="table is-small is-narrow is-fullwidth is-striped mt-2">
          <thead><tr>
            <th>${st.by === "org" ? "Organizzazione" : st.by === "comune" ? "Comune" : "Provincia"}</th>
            <th class="has-text-right">Mezzi</th><th class="has-text-right">Materiali</th><th class="has-text-right">Totale</th>
          </tr></thead>
          <tbody>
            ${c.list.length === 0
              ? html`<tr><td colspan="4" class="has-text-grey">Nessuna risorsa con questi filtri.</td></tr>`
              : c.list.map((g) => html`<tr>
                  <td>${g.label}</td><td class="has-text-right">${g.mezzi}</td>
                  <td class="has-text-right">${g.materiali}</td><td class="has-text-right"><strong>${g.n}</strong></td>
                </tr>`)}
          </tbody>
        </table>
      </details>

      ${c.unplaced
        ? html`<details class="mt-2" data-map-unplaced>
                 <summary class="is-size-7" style="cursor:pointer">
                   ${c.unplaced} ${c.unplaced === 1 ? "risorsa non posizionabile" : "risorse non posizionabili"}
                   (organizzazione senza coordinate o non in anagrafica)
                 </summary>
                 <ul class="is-size-7 mt-1" style="list-style:none;margin-left:.25rem">
                   ${c.unplacedList.map((u) => html`<li>${u.name}${u.known ? "" : u.code ? html` <span class="has-text-grey">(${u.code}, non in anagrafica)</span>` : ""}: ${u.n}</li>`)}
                 </ul>
               </details>`
        : ""}
    `;
  }

  return { template, load, reset, afterRender, bind, state: st };
}
