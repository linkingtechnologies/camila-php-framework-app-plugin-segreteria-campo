// ./views/resource-manager/step1.js

// Cache-busting dell'import dinamico: la query dell'entry point non si
// propaga ai moduli importati dalla view (AGENTS.md §L'import deve essere dinamico).
const VERSION = window.APP_CONFIG?.version || Date.now();
// Session lost, as opposed to a permission refusal. Both are HTTP 403, so the
// status alone cannot tell them apart: php-crud-api code 1011 is "Authentication
// required" and 1012 "Authentication failed", while 1014 is "Operation
// forbidden". See AGENTS.md §La sessione decaduta.
const SESSIONE_NON_VALIDA =
  "Sessione non più valida: probabilmente lo stesso utente è entrato da un altro browser o dispositivo. Esci e rifai l'accesso per riprendere da qui.";
function isSessionError(e) {
  const c = e?.payload?.code;
  return c === 1011 || c === 1012;
}
// Errors in this view travel as plain strings, so the session case is
// recognised again at render time by comparing with the sentence itself.
function errorText(e) {
  if (isSessionError(e)) return SESSIONE_NON_VALIDA;
  return String(e?.payload?.message || e?.message || e || "Errore sconosciuto");
}

export async function Step1(props) {
  const { state, client, goTo, html, render, root } = props;

  // -------------------- STATE INIT --------------------
  state.step1 ||= {};

  state.step1.orgCatalog ||= null;
  state.step1.orgCatalogLoaded ||= false;
  state.step1.orgCatalogError ||= null;

  state.step1.provinceCatalog ||= null;
  state.step1.provinceCatalogLoaded ||= false;
  state.step1.provinceCatalogError ||= null;

  // codice-organizzazione -> provincia (per inline edit organizzazione)
  state.step1.orgProvinceByCode ||= null;

  const _urlTab = new URLSearchParams(window.location.search).get("tab");
  const _validTabs = ["volontari", "mezzi", "materiali"];
  state.step1.activeTab ||= (_validTabs.includes(_urlTab) ? _urlTab : null) || state.activeTab || "volontari";
  state.activeTab = state.step1.activeTab;

  state.step1.sortByTab ||= {
    volontari: { key: "cognome", dir: "asc" },
    mezzi: { key: "targa", dir: "asc" },
    materiali: { key: "id-materiale", dir: "asc" },
  };

  state.selectedOrgByTab ||= {
    volontari: "all",
    mezzi: "all",
    materiali: "all",
  };

  state.step1.paginationByTab ||= {
    volontari: { page: 1, size: 50, total: 0, totalPages: 1, hasNext: false },
    mezzi: { page: 1, size: 50, total: 0, totalPages: 1, hasNext: false },
    materiali: { page: 1, size: 50, total: 0, totalPages: 1, hasNext: false },
  };

  // Organisation picker shown before the create form: a new resource always
  // belongs to one, and provincia plus codice-organizzazione are derived from
  // it, so asking first avoids a form where three fields are already wrong.
  // Same idea as massive check-in, which opens on the organisation too.
  state.step1.createPicker ||= null;   // null = chiuso, altrimenti { tab, q }

  // The magnifier next to the organisation filter opens a searchable list of the
  // same organisations: null, or { tab, q, focus }. `focus` asks refresh() to put
  // the cursor in the search box once, right after the popup is drawn.
  state.step1.orgFilterPicker ||= null;

  // The picker reads the registry `db-organizzazioni` (state.step1.orgCatalog), like
  // every other organisation list in this view. It used to read the distinct
  // organisations of `db-volontari`, which left out any organisation with no
  // volunteers yet.

  // Table font size, a display preference like the column order: same storage,
  // but one key for the whole SPA - it is about the operator's eyes, not about
  // which tab is open.
  state.step1.fontSize ||= null;

  // Column metadata from the extended describe: `sequence` is the order set on
  // the worktable in Camila, so the default order is configuration, not code.
  state.step1.colMetaByTab ||= { volontari: null, mezzi: null, materiali: null };

  // Per-user override, kept in localStorage: order and hidden columns, per tab.
  // Not in a worktable - it is a per-browser preference, not shared data.
  state.step1.colPrefByTab ||= { volontari: null, mezzi: null, materiali: null };
  state.step1.colPanelOpen ||= false;

  // The transfer popup (a mezzo or materiale passes to another organisation):
  // null, or { tab, row, query, dest: { code, name, province } | null, motivo,
  //            busy, error, done }.
  // `transferLog` remembers whether the register `trasferimenti-risorse` can be
  // written: { checked, ok, error }. A transfer that cannot be traced is refused.
  state.step1.transfer ||= null;
  state.step1.transferLog ||= { checked: false, ok: false, error: null };

  // The classifications popup (categoria / tipologia of mezzi and materiali):
  // { open, loading, error, counts: { mezzi, materiali } | null }, where each entry is
  // { total, pairs: Map<JSON [categoria, tipologia], number of resources> }.
  state.step1.classPopup ||= { open: false, loading: false, error: null, counts: null };

  // Spreadsheet export, per tab: { busy, format ("xlsx" | "ods", the one being made), error }.
  // Not persisted, a download is not a state to come back to.
  state.step1.exportByTab ||= {
    volontari: { busy: false, format: null, error: null },
    mezzi: { busy: false, format: null, error: null },
    materiali: { busy: false, format: null, error: null },
  };

  // Quick search state. Lives in `state` so it survives the trip to the record
  // editor and back: returning from a record keeps the result list.
  state.step1.quickSearch ||= {
    q: "",
    loading: false,
    loaded: false,
    error: null,
    rows: { volontari: [], mezzi: [], materiali: [] },
  };

  state.step1.columnFilterByTab ||= {
    volontari: { col: "cognome", op: "cs", val: "" },
    mezzi: { col: "targa", op: "cs", val: "" },
    materiali: { col: "id-materiale", op: "cs", val: "" },
  };

  state.step1.catFilterByTab ||= { volontari: "", mezzi: "", materiali: "" };
  state.step1.tipFilterByTab ||= { volontari: "", mezzi: "", materiali: "" };

  state.master ||= { volontari: null, mezzi: null, materiali: null };

  state.step1.permissionsErrorByTab ||= { volontari: null, mezzi: null, materiali: null };

  state.step1.permissionsByTab ||= {
    volontari: null,
    mezzi: null,
    materiali: null,
  };
  if (state.step1.readOnlyGlobal === undefined) state.step1.readOnlyGlobal = false;

  state.step1.inlineEdit ||= null;
  state.step1.skipFetch ||= false;

  // -------------------- CONFIG --------------------
  const TAB_LABELS = {
    volontari: "Volontari",
    mezzi: "Mezzi",
    materiali: "Materiali",
  };

  const TAB_TABLE = {
    volontari: "db-volontari",
    mezzi: "db-mezzi",
    materiali: "db-materiali",
  };

  // ---- quick search across the three catalogues ----------------------------
  // Fields each tab is searched on. Explicit, not "every column": the list has
  // to stay in step with what the tables actually have. `db-volontari` has no
  // categoria / tipologia / note at all, so those appear only under mezzi and
  // materiali. `note-ulteriori` exists on both but is left out - add it here if
  // it turns out to be wanted.
  const SEARCH_FIELDS = {
    volontari: ["cognome", "nome", "codice-fiscale", "organizzazione"],
    mezzi: ["targa", "codice-inventario", "marca", "modello", "organizzazione",
            "categoria", "tipologia", "note"],
    materiali: ["id-materiale", "codice-inventario", "targa", "marca", "modello",
                "organizzazione", "categoria", "tipologia", "note"],
  };

  const SEARCH_MIN = 2;      // below this the result list would be the whole table
  const SEARCH_SHOWN = 12;   // rows rendered; the rest is reported as a count

  // Case- and accent-insensitive: operators are not involved here, the match
  // happens in memory, so "rossi" finds "ROSSI" and "Nicolò" finds "NICOLO".
  function searchNorm(v) {
    return String(v ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  // One line per hit: what identifies the record at a glance.
  function searchTitle(tab, r) {
    if (tab === "volontari") {
      return [safe(r.cognome), safe(r.nome)].filter(Boolean).join(" ") || safe(r["codice-fiscale"]) || "(senza nome)";
    }
    if (tab === "mezzi") {
      return safe(r.targa) || safe(r["codice-inventario"]) || "(senza targa)";
    }
    return safe(r["id-materiale"]) || safe(r["codice-inventario"]) || "(senza id)";
  }

  function searchSubtitle(tab, r) {
    if (tab === "volontari") {
      return [safe(r["codice-fiscale"]), safe(r.organizzazione)].filter(Boolean).join(" · ");
    }
    if (tab === "mezzi") {
      return [[safe(r.marca), safe(r.modello)].filter(Boolean).join(" "), safe(r.organizzazione)]
        .filter(Boolean).join(" · ");
    }
    // `tipologia` moved to a badge, so it is no longer repeated here
    return [[safe(r.marca), safe(r.modello)].filter(Boolean).join(" "), safe(r.organizzazione)]
      .filter(Boolean).join(" · ");
  }

  // Categoria and tipologia as badges: they are the two fields that tell apart
  // records sharing a plate-less inventory code. `db-volontari` has neither, so
  // volunteer rows get none.
  function searchBadges(tab, r) {
    if (tab === "volontari") return [];
    return [
      { label: "Categoria", value: safe(r.categoria) },
      { label: "Tipologia", value: safe(r.tipologia) },
    ].filter((b) => b.value);
  }

  const PREFERRED_COLS = {
    volontari: [
      "codice-fiscale",
      "cognome",
      "nome",
      "data-di-nascita",
      "luogo-di-nascita",
      "cellulare",
      "organizzazione",
      "codice-organizzazione",
      "provincia",
    ],
    mezzi: [
      "targa",
      "codice-inventario",
      "codice-inventario-regionale",
      "codice-inventario-provinciale",
      "categoria",
      "tipologia",
      "note",
      "marca",
      "modello",
      "note-ulteriori",
      "organizzazione",
      "codice-organizzazione",
      "provincia",
      "proprietario",
    ],
    materiali: [
      "id-materiale",
      "codice-inventario",
      "codice-inventario-regionale",
      "codice-inventario-provinciale",
      "targa",
      "categoria",
      "tipologia",
      "note",
      "marca",
      "modello",
      "note-ulteriori",
      "organizzazione",
      "codice-organizzazione",
      "provincia",
      "proprietario",
    ],
  };

  const COL_LABELS = {
    "codice-fiscale": "Codice fiscale",
    cognome: "Cognome",
    nome: "Nome",
    cellulare: "Cellulare",
    provincia: "Provincia",
    organizzazione: "Organizzazione",
    "data-di-nascita": "Data di nascita",
    "luogo-di-nascita": "Luogo di nascita",
    "codice-organizzazione": "Cod. Org.",
    "codice-inventario": "Cod. inv.",
    targa: "Targa",
    categoria: "Categoria",
    tipologia: "Tipologia",
    marca: "Marca",
    modello: "Modello",
    "id-materiale": "Id mat.",
    "nome-referente": "Nome ref.",
    "numero-telefono-referente": "Num. tel. ref.",
    proprietario: "Proprietario",
    "codice-inventario-regionale": "Cod. inv. reg.",
    "codice-inventario-provinciale": "Cod. inv. prov.",
    provenienza: "Provenienza",
    note: "Note",
    "note-ulteriori": "Note ulteriori",
  };

  // Columns not editable inline. `provincia` is derived; the organisation pair
  // is read only by decision of the UI, not of the worktable: the column is
  // writable in Camila, so the same two fields are shown disabled in step 2 and
  // the organisation is chosen once, in the picker, before a record is created.
  const INLINE_SKIP = new Set([
    "provincia",
    "organizzazione",
    "codice-organizzazione",
    "id-materiale", // assigned by the sequence at creation, never retyped
  ]);

  // A column the worktable declares read only is not editable inline either.
  // Step 2 already honours the flag, so without this the list would be the way
  // around it.
  function inlineBlocked(tab, col) {
    if (INLINE_SKIP.has(col)) return true;
    return state.step1.colMetaByTab?.[tab]?.columns?.[col]?.readonly === true;
  }
  // -------------------- VOCABOLARI --------------------
  // categoria e tipologia arrivano dalle listbox_options delle colonne:
  // vedi views/shared/vocabularies.js.
  //
  // Dalle colonne di TAB_TABLE, cioe' db-mezzi e db-materiali: sono quelle che
  // questa SPA scrive. Le tabelle di evento `mezzi` e `materiali` hanno oggi
  // gli stessi elenchi, ma sono colonne diverse e possono divergere - offrire
  // un valore che la colonna di destinazione non ammette sarebbe sbagliato.
  const { loadCatalog } = await import(`../shared/vocabularies.js?v=${VERSION}`);

  const [mezziCat, materialiCat] = await Promise.all([
    loadCatalog(client, TAB_TABLE.mezzi),
    loadCatalog(client, TAB_TABLE.materiali)
  ]);

  const MEZZI_CAT_OPT = mezziCat.categories;
  const MEZZI_TIP_OPT = mezziCat.byCat;

  const MAT_CAT_OPT = materialiCat.categories;
  const MAT_TIP_OPT = materialiCat.byCat;


  // -------------------- HELPERS --------------------
  const safe = (v) => (v ?? "").toString();

  function normalizeListResponse(res) {
    const candidates = [
      res?.records,
      res?.data?.records,
      res?.data?.items,
      res?.data?.rows,
      res?.items,
      res?.rows,
      res?.data,
      res,
    ];
    for (const c of candidates) if (Array.isArray(c)) return c;
    return [];
  }

  async function ensureOrgCatalog() {
    if (state.step1.orgCatalogLoaded && state.step1.provinceCatalogLoaded) return;

    try {
      // Organisations come from `db-organizzazioni`, the registry, not from the
      // distinct values of `db-volontari.codice-organizzazione`. Reading them
      // off the volunteers meant an organisation with no volunteers yet was
      // not selectable at all, and a typo in a single record became a valid
      // looking option that then spread to mezzi and materiali.
      // Columns here: `codice`, `denominazione`, `provincia`.
      const res = await client.table("db-organizzazioni").list({
        include: ["codice", "denominazione", "provincia"],
        size: 5000,
      });

      const rows = normalizeListResponse(res);

      const orgMap = new Map();
      const orgProvMap = {};
      const provSet = new Set();

      for (const r of rows) {
        const code = (r?.["codice"] ?? "").toString().trim();
        const name = (r?.["denominazione"] ?? "").toString().trim();
        const prov = (r?.["provincia"] ?? "").toString().trim().toUpperCase();

        if (code && !orgMap.has(code)) {
          orgMap.set(code, name);
          orgProvMap[code] = prov;
        }
        if (prov) provSet.add(prov);
      }

      const orgList = [...orgMap.entries()]
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: "base" }));

      const provList = [...provSet].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );

      state.step1.orgCatalog = orgList;
      state.step1.orgCatalogLoaded = true;
      state.step1.orgCatalogError = null;

      state.step1.provinceCatalog = provList;
      state.step1.provinceCatalogLoaded = true;
      state.step1.provinceCatalogError = null;

      state.step1.orgProvinceByCode = orgProvMap;
    } catch (e) {
      state.step1.orgCatalog = [];
      state.step1.orgCatalogLoaded = true;
      state.step1.orgCatalogError = e?.message || String(e);

      state.step1.provinceCatalog = [];
      state.step1.provinceCatalogLoaded = true;
      state.step1.provinceCatalogError = e?.message || String(e);

      state.step1.orgProvinceByCode = {};
    }
  }

  function resetPage(tab) {
    const pag = state.step1.paginationByTab[tab];
    pag.page = 1;
    pag.hasNext = false;
    pag.total = 0;
    pag.totalPages = 1;
  }

  function getOrder(tab) {
    const spec = state.step1.sortByTab?.[tab];
    if (!spec?.key) return null;
    return [[spec.key, spec.dir || "asc"]];
  }

  // Loaded once, lazily, on the first query long enough to search. Doing it at
  // mount would slow a page that is often opened just to browse one tab.
  async function loadSearchData() {
    const qs = state.step1.quickSearch;
    if (qs.loaded || qs.loading) return;
    qs.loading = true;
    qs.error = null;
    refresh();

    const tabs = Object.keys(TAB_TABLE);
    const results = await Promise.allSettled(
      tabs.map((t) =>
        client.table(TAB_TABLE[t]).list({
          include: ["id", ...SEARCH_FIELDS[t]],
          size: 9999,
        })
      )
    );

    tabs.forEach((t, i) => {
      qs.rows[t] =
        results[i].status === "fulfilled" ? normalizeListResponse(results[i].value) : [];
    });

    // Partial failure is reported but does not empty what did load: searching
    // two catalogues out of three beats searching none.
    const ko = results.filter((r) => r.status === "rejected");
    if (ko.length) qs.error = ko.length === tabs.length ? "load" : "partial";

    qs.loading = false;
    qs.loaded = true;
    refresh();
  }

  function searchHits() {
    const qs = state.step1.quickSearch;
    const q = searchNorm(qs.q);
    if (q.length < SEARCH_MIN) return null;

    const out = [];
    for (const t of Object.keys(TAB_TABLE)) {
      for (const r of qs.rows[t]) {
        const hit = SEARCH_FIELDS[t].some((f) => searchNorm(r[f]).includes(q));
        if (hit) out.push({ tab: t, row: r });
      }
    }
    // Rows whose identifier starts with the query come first: typing a plate or
    // a surname should put the exact one on top, not the twentieth match.
    return out.sort((a, b) => {
      const sa = searchNorm(searchTitle(a.tab, a.row)).startsWith(q) ? 0 : 1;
      const sb = searchNorm(searchTitle(b.tab, b.row)).startsWith(q) ? 0 : 1;
      if (sa !== sb) return sa - sb;
      return searchTitle(a.tab, a.row).localeCompare(searchTitle(b.tab, b.row), "it");
    });
  }

  function setQuickSearch(v) {
    state.step1.quickSearch.q = v || "";
    if (searchNorm(v).length >= SEARCH_MIN) loadSearchData();
    refresh();
  }

  const COL_PREF_KEY = (tab) => `rm-cols-${tab}`;

  const FONT_KEY = "rm-font-size";
  const FONT_SIZES = [
    { id: "s", label: "S", css: "0.70rem", title: "Carattere piccolo" },
    { id: "m", label: "M", css: "0.80rem", title: "Carattere medio" },
    { id: "l", label: "L", css: "0.95rem", title: "Carattere grande" },
  ];
  const FONT_DEFAULT = "s";

  function readFontSize() {
    if (state.step1.fontSize) return state.step1.fontSize;
    let v = FONT_DEFAULT;
    try {
      const raw = localStorage.getItem(FONT_KEY);
      if (FONT_SIZES.some((f) => f.id === raw)) v = raw;
    } catch (_) {
      // private window or blocked storage: the default is fine
    }
    state.step1.fontSize = v;
    return v;
  }

  function setFontSize(id) {
    if (!FONT_SIZES.some((f) => f.id === id)) return;
    state.step1.fontSize = id;
    try {
      localStorage.setItem(FONT_KEY, id);
    } catch (_) {
      // keeps working for this session only
    }
    refresh();
  }

  function fontSizeCss() {
    const id = readFontSize();
    return (
      FONT_SIZES.find((f) => f.id === id) ||
      FONT_SIZES.find((f) => f.id === FONT_DEFAULT)
    ).css;
  }

  function readColPref(tab) {
    if (state.step1.colPrefByTab[tab]) return state.step1.colPrefByTab[tab];
    let pref = { order: [], hidden: [] };
    try {
      const raw = localStorage.getItem(COL_PREF_KEY(tab));
      if (raw) {
        const parsed = JSON.parse(raw);
        pref = {
          order: Array.isArray(parsed?.order) ? parsed.order.map(String) : [],
          hidden: Array.isArray(parsed?.hidden) ? parsed.hidden.map(String) : [],
        };
      }
    } catch (_) {
      // private window, blocked storage, corrupted value: fall back to default
    }
    state.step1.colPrefByTab[tab] = pref;
    return pref;
  }

  function writeColPref(tab, pref) {
    state.step1.colPrefByTab[tab] = pref;
    try {
      localStorage.setItem(COL_PREF_KEY(tab), JSON.stringify(pref));
    } catch (_) {
      // the preference stays for this session only
    }
    refresh();
  }

  async function ensureColumnsMeta(tab) {
    if (state.step1.colMetaByTab[tab]) return;
    const { loadColumns } = await import(`../shared/vocabularies.js?v=${VERSION}`);
    const { columns, extended } = await loadColumns(client, TAB_TABLE[tab]);
    state.step1.colMetaByTab[tab] = { columns, extended };
  }

  // Default order: `sequence` from the worktable configuration. Columns without
  // one - and every column, when the describe is not the extended one - fall
  // back to PREFERRED_COLS, then to alphabetical.
  function defaultColOrder(tab, present) {
    const meta = state.step1.colMetaByTab[tab];
    const preferred = PREFERRED_COLS[tab] || [];

    if (meta?.extended) {
      const seq = (k) => {
        const n = meta.columns[k]?.sequence;
        return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
      };
      return [...present].sort((a, b) => {
        const d = seq(a) - seq(b);
        if (d !== 0) return d;
        const pa = preferred.indexOf(a), pb = preferred.indexOf(b);
        if (pa !== pb) return (pa < 0 ? 1e9 : pa) - (pb < 0 ? 1e9 : pb);
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
      });
    }

    const extra = [...present].filter((k) => !preferred.includes(k));
    extra.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return [...preferred.filter((k) => present.has(k)), ...extra];
  }

  // Effective order: the user's one first, then any column they have never seen
  // appended in default order, so a new column shows up instead of vanishing.
  function orderedCols(tab, present) {
    const base = defaultColOrder(tab, present);
    const pref = readColPref(tab);
    const known = pref.order.filter((k) => present.has(k));
    const nuove = base.filter((k) => !known.includes(k));
    return [...known, ...nuove];
  }

  // The table header uses COL_LABELS, which are deliberate abbreviations
  // ("Cod. inv."). The panel lists columns, so it can afford the full label the
  // worktable declares, falling back to the abbreviation and then to the key.
  function colLabel(tab, k) {
    return state.step1.colMetaByTab[tab]?.columns?.[k]?.label || COL_LABELS[k] || k;
  }

  function moveCol(tab, k, delta, present) {
    const order = orderedCols(tab, present);
    const i = order.indexOf(k);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    writeColPref(tab, { ...readColPref(tab), order });
  }

  function toggleColHidden(tab, k, present) {
    const pref = readColPref(tab);
    const hidden = pref.hidden.includes(k)
      ? pref.hidden.filter((x) => x !== k)
      : [...pref.hidden, k];
    writeColPref(tab, { order: orderedCols(tab, present), hidden });
  }

  function resetColPref(tab) {
    try { localStorage.removeItem(COL_PREF_KEY(tab)); } catch (_) {}
    state.step1.colPrefByTab[tab] = { order: [], hidden: [] };
    refresh();
  }

  // Spreadsheet export of what the operator is looking at: the same table, search
  // and filters, the same sort, and the columns the table shows, in their order.
  // It is not limited to the page on screen - the point of exporting is the whole
  // list - so it reads the rows again, in pages of EXPORT_PAGE, through the same
  // client (and so with the same permissions) as the table itself. Nothing is
  // sent anywhere: the file is built in the browser (views/shared/spreadsheet.js),
  // as .xlsx (Excel) or .ods (LibreOffice), from the same rows.
  const EXPORT_PAGE = 1000;
  const EXPORT_MAX_PAGES = 200;

  async function exportSheet(tab, cols, format) {
    const ex = state.step1.exportByTab[tab];
    if (ex.busy) return;
    ex.busy = true;
    ex.format = format;
    ex.error = null;
    state.step1.skipFetch = true;   // redraw the button only, not the table
    refresh();

    try {
      // `id` as the last sort key: pages of a list sorted on a column with ties
      // would otherwise be free to repeat or skip rows between two requests.
      const order = getOrder(tab) || [];
      if (!order.some(([k]) => k === "id")) order.push(["id", "asc"]);

      const table = client.table(TAB_TABLE[tab]);
      const rows = [];
      for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
        const res = await table.list({ filters: buildFilters(tab), order, page: [page, EXPORT_PAGE] });
        const batch = normalizeListResponse(res);
        rows.push(...batch);
        const total = Number(res?.results ?? rows.length);
        if (!batch.length || rows.length >= total) break;
      }

      await ensureColumnsMeta(tab);
      const meta = state.step1.colMetaByTab[tab]?.columns || {};
      // numbers only where the worktable says the column is numeric: a phone
      // number or a code must reach the spreadsheet as typed
      const numeric = cols.map((k) => /^(integer|decimal|number|float)/i.test(String(meta[k]?.type || "")));
      // dates likewise: only where the worktable says the column is a date. Without a
      // describe (no type at all) the one date column of these tables is known by name.
      const dates = cols.map((k) => /^(date|datetime|timestamp)/i.test(String(meta[k]?.type || "")) || (!meta[k] && k === "data-di-nascita"));

      const sheet = await import(`../shared/spreadsheet.js?v=${VERSION}`);
      const headers = cols.map((k) => colLabel(tab, k));
      const tableRows = rows.map((r) => cols.map((k) => r?.[k] ?? ""));
      const spec = { headers, rows: tableRows, numeric, dates };
      const ods = format === "ods";
      const bytes = (ods ? sheet.buildOds : sheet.buildXlsx)({ sheetName: TAB_LABELS[tab], ...spec });

      // Re-read the file against the data it was made from. This catches a mistake of
      // the writer (damaged zip, XML not well formed, lost row); it cannot say whether
      // Excel or LibreOffice will accept the file. A file that fails is not offered
      // for download.
      const check = (ods ? sheet.verifyOds : sheet.verifyXlsx)(bytes, spec);
      if (!check.ok) {
        console.warn(`${format} check failed:`, check.problems);
        throw new Error(`Il file generato non ha superato il controllo e non è stato salvato (${check.problems[0]}).`);
      }
      const today = new Date().toLocaleDateString("sv-SE");   // YYYY-MM-DD
      sheet.saveBytes(bytes, `database-${tab}_${today}.${format}`, ods ? sheet.ODS_MIME : sheet.XLSX_MIME);
    } catch (e) {
      ex.error = errorText(e);
    } finally {
      ex.busy = false;
      state.step1.skipFetch = true;
      refresh();
    }
  }

  // ---- transfer to another organisation ----------------------------------------
  // The organisation of a mezzo or materiale is chosen when it is created and then
  // read-only in the table (INLINE_SKIP). Moving it to another organisation is a
  // different act - it changes who the resource belongs to - so it has its own
  // action: the destination, a reason (required) and a line in `trasferimenti-risorse`.
  // The three fields that follow the organisation change together: organizzazione,
  // codice-organizzazione and provincia (the province of the destination).
  const TRANSFER_TABLE = "trasferimenti-risorse";
  const TRANSFER_REASON_MIN = 3;
  const TRANSFER_REASON_MAX = 255;   // the size of the column in the register

  const nowDateTime = () => new Date().toLocaleString("sv-SE", { hour12: false }).replace(",", "");

  const resourceLabel = (tab, r) => safe(tab === "mezzi" ? r?.targa : r?.["id-materiale"]).trim() || safe(r?.id);

  // Is the register there, and can this user insert into it? Asked once, when a
  // Mezzi/Materiali tab is first shown, and remembered.
  async function ensureTransferLog() {
    const tl = state.step1.transferLog;
    if (tl.checked) return tl.ok;
    try {
      const res = await client.table(TRANSFER_TABLE).permissions();
      const can = res?.can || {};
      tl.ok = can.create === true;
      tl.error = tl.ok ? null : "Non hai il permesso di scrivere nel registro dei trasferimenti.";
    } catch (e) {
      tl.ok = false;
      // a missing table answers with an error too: say what is missing, not a code
      tl.error = isSessionError(e)
        ? SESSIONE_NON_VALIDA
        : "Il registro dei trasferimenti (" + TRANSFER_TABLE + ") non è disponibile su questa installazione.";
    }
    tl.checked = true;
    return tl.ok;
  }

  // A transfer changes the resource AND inserts a row in the register: both permissions are needed.
  function canTransfer(perms) {
    const tl = state.step1.transferLog;
    return !!perms.canUpdate && tl.checked && tl.ok;
  }

  function transferTitle(perms) {
    if (!perms.canUpdate) return "Sola lettura";
    const tl = state.step1.transferLog;
    if (tl.checked && !tl.ok) return tl.error || "Registro dei trasferimenti non disponibile";
    return "Trasferisci a un'altra organizzazione";
  }

  async function openTransfer(tab, row) {
    if (!getEffectivePermissions(tab).canUpdate) return;
    // the icon is already disabled without create permission on the register;
    // this is the same guard for any other way in
    if (!(await ensureTransferLog())) return;
    state.step1.transfer = { tab, row, query: "", dest: null, motivo: "", busy: false, error: null, done: null };
    await ensureOrgCatalog();
    state.step1.skipFetch = true;
    refresh();
  }

  function closeTransfer() {
    const tr = state.step1.transfer;
    if (tr?.busy) return;
    state.step1.transfer = null;
    state.step1.skipFetch = true;
    refresh();
  }

  function setTransferField(field, value) {
    const tr = state.step1.transfer;
    if (!tr) return;
    tr[field] = value;
    state.step1.skipFetch = true;
    refresh();
  }

  function pickTransferDest(org) {
    const tr = state.step1.transfer;
    if (!tr) return;
    tr.dest = { code: org.code, name: org.name, province: (state.step1.orgProvinceByCode || {})[org.code] || "" };
    tr.query = "";
    state.step1.skipFetch = true;
    refresh();
  }

  // Organisations that match what was typed, without the one the resource is in.
  function transferMatches(tr) {
    const q = searchNorm(tr.query);
    if (q.length < 2) return [];
    const from = safe(tr.row?.["codice-organizzazione"]).trim();
    return (state.step1.orgCatalog || [])
      .filter((o) => o.code !== from && searchNorm(`${o.name} ${o.code}`).includes(q))
      .slice(0, 8);
  }

  function transferProblem(tr) {
    if (!tr.dest) return "Scegli l'organizzazione di destinazione.";
    if (safe(tr.motivo).trim().length < TRANSFER_REASON_MIN) return "Scrivi la motivazione.";
    return "";
  }

  // What the register keeps about the resource itself, as text (history, not a
  // reference): empty values go as null, like any empty field. `targa` is kept
  // for mezzi and `id-materiale` / `note` for materiali only; the other side stays null.
  function transferSnapshot(tab, row) {
    const v = (x) => safe(x).trim() || null;
    const isMezzo = tab === "mezzi";
    return {
      targa: isMezzo ? v(row.targa) : null,
      "id-materiale": isMezzo ? null : v(row["id-materiale"]),
      categoria: v(row.categoria),
      tipologia: v(row.tipologia),
      "marca/modello": [row.marca, row.modello].map(safe).map((s) => s.trim()).filter(Boolean).join(" ") || null,
      "codice-inventario": v(row["codice-inventario"]),
      proprietario: v(row.proprietario),
      note: isMezzo ? null : v(row.note),
    };
  }

  async function confirmTransfer() {
    const tr = state.step1.transfer;
    if (!tr || tr.busy || transferProblem(tr) || !state.step1.transferLog.ok) return;
    if (!getEffectivePermissions(tr.tab).canUpdate) return;

    const { tab, row, dest } = tr;
    const table = client.table(TAB_TABLE[tab]);
    const motivo = safe(tr.motivo).trim().slice(0, TRANSFER_REASON_MAX);
    const before = {
      organizzazione: safe(row.organizzazione),
      codiceOrganizzazione: safe(row["codice-organizzazione"]),
      provincia: safe(row.provincia),
    };

    tr.busy = true;
    tr.error = null;
    state.step1.skipFetch = true;
    refresh();

    let updated = false;
    try {
      // 1. the resource changes organisation. An empty province is sent as null, like any empty field.
      await table.update(row.id, {
        organizzazione: dest.name,
        "codice-organizzazione": dest.code,
        provincia: dest.province || null,
      });
      updated = true;

      // 2. the register keeps the names as text, not as references: it is history,
      // and must still read the same when an organisation is renamed later
      await client.table(TRANSFER_TABLE).create({
        "data/ora": nowDateTime(),
        "tipo-risorsa": tab === "mezzi" ? "MEZZO" : "MATERIALE",
        // text, not a number: with UUID mode on the API exposes the GUID as `id`
        // (the numeric key becomes `id2`), so Number() would give NaN
        "id-risorsa": safe(row.id).trim() || null,
        ...transferSnapshot(tab, row),
        "organizzazione-origine": before.organizzazione,
        "codice-organizzazione-origine": before.codiceOrganizzazione,
        "provincia-origine": before.provincia || null,
        "organizzazione-destinazione": dest.name,
        "codice-organizzazione-destinazione": dest.code,
        "provincia-destinazione": dest.province || null,
        motivazione: motivo,
      });

      tr.done = { from: before.organizzazione, to: dest.name, label: resourceLabel(tab, row) };
      tr.busy = false;
      state.step1.skipFetch = false;   // the list changes: reload it
      await refresh();
    } catch (e) {
      tr.busy = false;
      if (updated) {
        // The resource has moved but the register did not take the line. A transfer
        // that is not traced must not stand: put the resource back.
        try {
          await table.update(row.id, {
            organizzazione: before.organizzazione || null,
            "codice-organizzazione": before.codiceOrganizzazione || null,
            provincia: before.provincia || null,
          });
          tr.error = `Il trasferimento non è stato registrato, quindi è stato annullato: la risorsa è rimasta dov'era. ${errorText(e)}`;
        } catch (e2) {
          tr.error = `ATTENZIONE: la risorsa è stata trasferita a "${dest.name}" ma il trasferimento non è stato registrato, e non è stato possibile annullarlo. `
            + `Riportala a "${before.organizzazione}" a mano e avvisa chi gestisce il sistema. ${errorText(e2)}`;
        }
        state.step1.skipFetch = false;
        await refresh();
      } else {
        tr.error = errorText(e);
        state.step1.skipFetch = true;
        refresh();
      }
    }
  }

  // ---- classifications popup -------------------------------------------------
  // The popup lists the classification of mezzi and materiali: every categoria with
  // its tipologie, as the worktable defines them (MEZZI_CAT_OPT, MEZZI_TIP_OPT, ...),
  // and how many resources of the registry carry each one. The definition is already
  // in memory; the counts are read when the popup opens, so they are never stale.
  // Only the two columns are asked for, in pages like the export, so the request
  // stays small however many resources there are.
  async function countClasses(tab) {
    const table = client.table(TAB_TABLE[tab]);
    const pairs = new Map();
    let total = 0;
    for (let page = 1; page <= EXPORT_MAX_PAGES; page++) {
      const res = await table.list({ include: ["categoria", "tipologia"], order: [["id", "asc"]], page: [page, EXPORT_PAGE] });
      const batch = normalizeListResponse(res);
      for (const r of batch) {
        const key = JSON.stringify([safe(r?.categoria).trim(), safe(r?.tipologia).trim()]);
        pairs.set(key, (pairs.get(key) || 0) + 1);
      }
      total += batch.length;
      const all = Number(res?.results ?? total);
      if (!batch.length || total >= all) break;
    }
    return { total, pairs };
  }

  async function openClassPopup() {
    const cp = state.step1.classPopup;
    if (cp.loading) return;
    cp.open = true;
    cp.loading = true;
    cp.error = null;
    cp.counts = null;
    state.step1.skipFetch = true;   // redraw the popup only, not the table
    refresh();

    try {
      const [mezzi, materiali] = await Promise.all([countClasses("mezzi"), countClasses("materiali")]);
      cp.counts = { mezzi, materiali };
    } catch (e) {
      // the definition is still worth showing: only the numbers are missing
      cp.error = errorText(e);
    } finally {
      cp.loading = false;
      state.step1.skipFetch = true;
      refresh();
    }
  }

  function closeClassPopup() {
    state.step1.classPopup.open = false;
    state.step1.skipFetch = true;
    refresh();
  }

  function buildFilters(tab) {
    const out = [];

    const orgSel = state.selectedOrgByTab?.[tab] || "all";
    if (orgSel && orgSel !== "all") {
      out.push(client.filter("codice-organizzazione", "eq", orgSel));
    }

    const catSel = state.step1.catFilterByTab?.[tab] || "";
    if (catSel) out.push(client.filter("categoria", "eq", catSel));

    const tipSel = state.step1.tipFilterByTab?.[tab] || "";
    if (tipSel) out.push(client.filter("tipologia", "eq", tipSel));

    const f = state.step1.columnFilterByTab?.[tab];
    const col = f?.col;
    const op = f?.op || "cs";
    const val = (f?.val || "").trim();

    if (col && val) {
      out.push(client.filter(col, op, val));
    }

    return out;
  }

  function normalizePermissionsPayload(payload) {
    const can = payload?.can;
    if (can && typeof can === "object") {
      return {
        canCreate: !!can.create,
        canUpdate: !!can.update,
        canDelete: !!can.delete,
        canRead: can.read !== undefined ? !!can.read : true,
        _raw: payload,
      };
    }

    const p = payload || {};
    const pickBool = (...keys) => {
      for (const k of keys) {
        const v = p?.[k];
        if (typeof v === "boolean") return v;
      }
      return undefined;
    };

    const canCreate =
      pickBool("create", "canCreate", "insert", "canInsert", "write", "canWrite") ?? false;
    const canUpdate =
      pickBool("update", "canUpdate", "edit", "canEdit", "write", "canWrite") ?? false;
    const canDelete =
      pickBool("delete", "canDelete", "remove", "canRemove", "write", "canWrite") ?? false;
    const canRead = pickBool("read", "canRead") ?? true;

    return { canCreate, canUpdate, canDelete, canRead, _raw: payload };
  }

  function getEffectivePermissions(tab) {
    if (state.step1.readOnlyGlobal) {
      return { canCreate: false, canUpdate: false, canDelete: false, canRead: true, readOnly: true };
    }
    const p = state.step1.permissionsByTab?.[tab];
    if (!p) {
      return { canCreate: false, canUpdate: false, canDelete: false, canRead: true, readOnly: true };
    }
    return { ...p, readOnly: false };
  }

  // -------------------- RENDER LOOP --------------------
  let renderSeq = 0;

  async function refresh() {
    const seq = ++renderSeq;
    const tpl = await view();
    if (seq !== renderSeq) return;
    render(tpl, root);
    // the organisation search box takes the cursor once, when its popup opens
    const ofp = state.step1.orgFilterPicker;
    if (ofp?.focus) {
      ofp.focus = false;
      root.querySelector("[data-orgfilter-focus]")?.focus();
    }
    // focus inline edit input/select after render
    if (state.step1.inlineEdit && !state.step1.inlineEdit.saving) {
      const el = root.querySelector("[data-inline-focus]");
      if (el) el.focus();
    }
  }

  // -------------------- PERMISSIONS LOAD --------------------
  async function ensurePermissions(tab) {
    if (state.step1.readOnlyGlobal) return;
    if (state.step1.permissionsByTab?.[tab]) return;
    // One failed call used to latch readOnlyGlobal for the whole session and
    // every tab, with no retry: a single network hiccup made the actions column
    // disappear until the page was reloaded, and said nothing about why. The
    // failure now stays on its own tab and can be retried.
    if (state.step1.permissionsErrorByTab?.[tab]) return;

    const tableName = TAB_TABLE[tab];

    try {
      const table = client.table(tableName);

      if (typeof table.permissions === "function") {
        const res = await table.permissions();
        state.step1.permissionsByTab[tab] = normalizePermissionsPayload(res);
        return;
      }

      if (typeof client.permissions === "function") {
        const res = await client.permissions(tableName);
        state.step1.permissionsByTab[tab] = normalizePermissionsPayload(res);
        return;
      }

      // The client exposes no permissions call at all: that is a property of
      // the build, not of one table, so it does apply to everything.
      state.step1.readOnlyGlobal = true;
    } catch (err) {
      state.step1.permissionsErrorByTab[tab] = err?.message || String(err);
    }
  }

  function retryPermissions(tab) {
    state.step1.permissionsErrorByTab[tab] = null;
    refresh();
  }

  // -------------------- LOAD PAGE (server-side) --------------------
  async function ensureLoaded(tab) {
    if (state.step1.skipFetch) {
      state.step1.skipFetch = false;
      return;
    }

    const pag = state.step1.paginationByTab[tab];
    const size = Number(pag.size) || 50;
    let page = Number(pag.page) || 1;

    const table = client.table(TAB_TABLE[tab]);

    const res = await table.list({
      filters: buildFilters(tab),
      order: getOrder(tab),
      page: [page, size],
    });

    const rows = normalizeListResponse(res);

    const total = Number(res?.results ?? rows.length ?? 0);
    const totalPages = Math.max(1, Math.ceil(total / size));

    page = Math.min(page, totalPages);
    pag.page = page;

    pag.total = total;
    pag.totalPages = totalPages;
    pag.hasNext = page < totalPages;

    state.master[tab] = rows;
  }

  // -------------------- SORT HANDLERS --------------------
  function setSort(tab, key) {
    const cur = state.step1.sortByTab?.[tab] || { key: null, dir: "asc" };
    const nextDir = cur.key === key ? (cur.dir === "asc" ? "desc" : "asc") : "asc";
    state.step1.sortByTab[tab] = { key, dir: nextDir };
    resetPage(tab);
    refresh();
  }

  // -------------------- UI HANDLERS --------------------
  function setTab(tab, e) {
    if (e?.preventDefault) e.preventDefault();
    state.step1.activeTab = tab;
    state.activeTab = tab;
    refresh();
  }

  function onOrgChange(tab, v) {
    state.selectedOrgByTab[tab] = v || "all";
    resetPage(tab);
    refresh();
  }

  function onFilterColChange(tab, col) {
    state.step1.columnFilterByTab[tab].col = col;
    resetPage(tab);
    refresh();
  }

  function onFilterValChange(tab, val) {
    state.step1.columnFilterByTab[tab].val = val || "";
    resetPage(tab);
    refresh();
  }

  function onCatFilterChange(tab, val) {
    state.step1.catFilterByTab[tab] = val;
    state.step1.tipFilterByTab[tab] = "";
    resetPage(tab);
    refresh();
  }

  function onTipFilterChange(tab, val) {
    state.step1.tipFilterByTab[tab] = val;
    resetPage(tab);
    refresh();
  }

  function onPageSizeChange(tab, size) {
    const pag = state.step1.paginationByTab[tab];
    pag.size = Number(size) || 50;
    resetPage(tab);
    refresh();
  }

  function prevPage(tab) {
    const pag = state.step1.paginationByTab[tab];
    pag.page = Math.max(1, (Number(pag.page) || 1) - 1);
    refresh();
  }

  function nextPage(tab) {
    const pag = state.step1.paginationByTab[tab];
    if (!pag.hasNext) return;
    pag.page = (Number(pag.page) || 1) + 1;
    refresh();
  }

  function startCreate(tab) {
    const perms = getEffectivePermissions(tab);
    if (!perms.canCreate) return;
    state.step1.createPicker = { tab, q: "" };
    refresh();
  }

  function chiudiCreatePicker() {
    state.step1.createPicker = null;
    refresh();
  }

  function setCreatePickerQuery(v) {
    if (!state.step1.createPicker) return;
    state.step1.createPicker.q = v || "";
    refresh();
  }

  // Organisation chosen: only now does the data form open.
  function startCreateConOrg(tab, org) {
    state.createOrg = {
      code: org.code,
      name: org.name,
      province: org.province || (state.step1.orgProvinceByCode || {})[org.code] || "",
    };
    state.step1.createPicker = null;
    state.step1.activeTab = tab;
    state.activeTab = tab;
    state.editTab = tab;
    state.editId = null;
    state.editMode = "create";
    goTo(2);
  }

  // Organisations matching a search text, by name or code, sorted by name (what the
  // operator types; the catalog itself is ordered by code). Empty text = all of them.
  function searchOrgs(text) {
    const q = searchNorm(text);
    const list = [...(state.step1.orgCatalog || [])].sort((a, b) =>
      a.name.localeCompare(b.name, "it", { sensitivity: "base" })
    );
    if (!q) return list;
    return list.filter(
      (o) => searchNorm(o.name).includes(q) || searchNorm(o.code).includes(q)
    );
  }

  function createPickerRisultati() {
    const pk = state.step1.createPicker;
    return pk ? searchOrgs(pk.q) : [];
  }

  // ---- organisation filter popup (magnifier) -------------------------------
  // Only the list is redrawn while typing (skipFetch): the table behind does not change
  // until an organisation is chosen.
  function openOrgFilter(tab) {
    state.step1.orgFilterPicker = { tab, q: "", focus: true };
    state.step1.skipFetch = true;
    refresh();
  }

  function closeOrgFilter() {
    state.step1.orgFilterPicker = null;
    state.step1.skipFetch = true;
    refresh();
  }

  function setOrgFilterQuery(v) {
    if (!state.step1.orgFilterPicker) return;
    state.step1.orgFilterPicker.q = v || "";
    state.step1.skipFetch = true;
    refresh();
  }

  // "all" (or an organisation code) goes through the same handler as the dropdown
  function pickOrgFilter(tab, code) {
    state.step1.orgFilterPicker = null;
    onOrgChange(tab, code);
  }

  function startEdit(tab, id) {
    // No permission gate here: step 2 opens read only when the tab does not
    // allow writing, which beats a click that silently does nothing. The
    // actual write is stopped there, by doSave and by every disabled control.
    // Follow the record's own tab. A quick-search hit can belong to a tab other
    // than the active one, and step 2 goes back with goTo(1) without touching
    // it: without this, saving a mezzo found while on Volontari would drop you
    // back on the volunteers list.
    state.step1.activeTab = tab;
    state.activeTab = tab;
    state.editTab = tab;
    state.editId = id;
    state.editMode = "edit";
    goTo(2);
  }

  async function doDelete(tab, row) {
    const perms = getEffectivePermissions(tab);
    if (!perms.canDelete) return;

    const id = row?.id;
    if (!id) return;

    const labelKey = tab === "volontari" ? "codice-fiscale" : tab === "mezzi" ? "targa" : "id-materiale";
    const label = safe(row?.[labelKey] || row?.id);

    const ok = window.confirm(`Eliminare definitivamente "${label}"?`);
    if (!ok) return;

    try {
      await client.table(TAB_TABLE[tab]).remove(id);

      const pag = state.step1.paginationByTab[tab];
      if ((state.master?.[tab]?.length || 0) <= 1 && (pag.page || 1) > 1) {
        pag.page = Math.max(1, pag.page - 1);
      }

      await refresh();
    } catch (e) {
      alert(`Errore eliminazione: ${e?.message || e}`);
    }
  }

  // -------------------- INLINE EDIT --------------------
  let cancellingEdit = false;

  function startInlineEdit(r, col, event) {
    const tab = state.step1.activeTab;
    const perms = getEffectivePermissions(tab);
    if (inlineBlocked(tab, col)) return;
    if (!perms.canUpdate) return;

    // categoria o tipologia: overlay unico con le due tendine dipendenti
    if ((col === "categoria" || col === "tipologia") && (tab === "mezzi" || tab === "materiali")) {
      const rect = event?.target?.closest("td")?.getBoundingClientRect() || { left: 100, bottom: 100 };
      const anchorX = Math.min(rect.left, window.innerWidth - 320);
      const anchorY = Math.min(rect.bottom + 4, window.innerHeight - 230);
      state.step1.inlineEdit = {
        rowId: r.id,
        col: "cat-tip",
        tab,
        categoria: safe(r["categoria"] ?? "Non assegnata"),
        tipologia: safe(r["tipologia"] ?? ""),
        saving: false,
        error: null,
        anchorX,
        anchorY,
      };
      state.step1.skipFetch = true;
      refresh();
      return;
    }

    state.step1.inlineEdit = { rowId: r.id, col, val: safe(r[col] ?? ""), saving: false, error: null };
    state.step1.skipFetch = true;
    refresh();
  }

  function cancelInlineEdit() {
    cancellingEdit = true;
    state.step1.inlineEdit = null;
    state.step1.skipFetch = true;
    refresh();
    setTimeout(() => { cancellingEdit = false; }, 100);
  }

  async function commitInlineEdit(r, col, val, extra = {}) {
    const ie = state.step1.inlineEdit;
    if (!ie || ie.saving) return;
    const tab = state.step1.activeTab;
    ie.saving = true;
    ie.error = null;
    state.step1.skipFetch = true;
    await refresh();
    try {
      const payload = { [col]: val, ...extra };
      await client.table(TAB_TABLE[tab]).update(ie.rowId, payload);
      const rows = state.master[tab] || [];
      const idx = rows.findIndex((x) => x.id === ie.rowId);
      if (idx >= 0) Object.assign(rows[idx], payload);
      state.step1.inlineEdit = null;
    } catch (e) {
      ie.saving = false;
      ie.error = errorText(e);
      state.step1.skipFetch = true;
    }
    await refresh();
  }

  async function commitCatTipEdit() {
    const ie = state.step1.inlineEdit;
    if (!ie || ie.col !== "cat-tip" || ie.saving) return;
    const tab = state.step1.activeTab;
    ie.saving = true;
    ie.error = null;
    state.step1.skipFetch = true;
    await refresh();
    try {
      const payload = { "categoria": ie.categoria, "tipologia": ie.tipologia };
      await client.table(TAB_TABLE[tab]).update(ie.rowId, payload);
      const rows = state.master[tab] || [];
      const idx = rows.findIndex((x) => x.id === ie.rowId);
      if (idx >= 0) Object.assign(rows[idx], payload);
      state.step1.inlineEdit = null;
    } catch (e) {
      ie.saving = false;
      ie.error = errorText(e);
      state.step1.skipFetch = true;
    }
    await refresh();
  }

  // -------------------- PAGINATION CONTROLS --------------------
  function PaginationControls(tab, pag) {
    return html`
      <div class="buttons are-small has-addons">
        <button class="button is-small" ?disabled=${(pag.page || 1) <= 1} @click=${() => prevPage(tab)}>
          <span class="icon is-small"><i class="ri-arrow-left-s-line"></i></span>
        </button>
        <button class="button is-small is-static">
          ${String(pag.page || 1)} / ${String(pag.totalPages || 1)}
        </button>
        <button class="button is-small" ?disabled=${!pag.hasNext} @click=${() => nextPage(tab)}>
          <span class="icon is-small"><i class="ri-arrow-right-s-line"></i></span>
        </button>
      </div>
    `;
  }

  // -------------------- VIEW --------------------
  async function view() {
    const tab = state.step1.activeTab;

    await ensureOrgCatalog();
    await ensurePermissions(tab);
    await ensureLoaded(tab);
    await ensureColumnsMeta(tab);
    // transfers need create permission on the register: known before the row icon is drawn
    if (tab !== "volontari") await ensureTransferLog();

    const rows = state.master?.[tab] || [];
    const pag = state.step1.paginationByTab[tab];
    const f = state.step1.columnFilterByTab[tab];

    const hasCatTip = tab === "mezzi" || tab === "materiali";
    const catOptsForFilter = tab === "mezzi" ? MEZZI_CAT_OPT : (tab === "materiali" ? MAT_CAT_OPT : []);
    const tipByCatForFilter = tab === "mezzi" ? MEZZI_TIP_OPT : (tab === "materiali" ? MAT_TIP_OPT : {});
    const catFilter = state.step1.catFilterByTab?.[tab] || "";
    const tipFilter = state.step1.tipFilterByTab?.[tab] || "";
    const tipOptsForFilter = catFilter
      ? (tipByCatForFilter[catFilter] || [])
      : [...new Set(Object.values(tipByCatForFilter).flat())].sort((a, b) =>
          a.localeCompare(b, undefined, { sensitivity: "base" })
        );

    const perms = getEffectivePermissions(tab);
    const showActionsCol = perms.canUpdate || perms.canDelete;

    const page = Number(pag.page) || 1;
    const size = Number(pag.size) || 50;
    const total = Number(pag.total) || 0;
    const from = total === 0 ? 0 : (page - 1) * size + 1;
    const to = total === 0 ? 0 : (from + Math.max(0, rows.length) - 1);

    // Columns present in the data, minus the technical ones.
    const colsPresenti = (() => {
      const set = new Set();
      for (const r of rows) Object.keys(r || {}).forEach((k) => set.add(k));
      set.delete("id");
      set.delete("uuid");
      set.delete("id2");
      return set;
    })();

    // Full order, used by the panel; `cols` is what the table renders, so it
    // drops the hidden ones. The column filter keeps offering all of them.
    const colsOrdinate = orderedCols(tab, colsPresenti);
    const colsNascoste = readColPref(tab).hidden.filter((k) => colsPresenti.has(k));
    const cols = colsOrdinate.filter((k) => !colsNascoste.includes(k));

    // ---- inline cell renderer ----
    function renderInlineCell(r, col, ie) {
      if (ie.saving) {
        return html`<span class="icon is-small rm-spin"><i class="ri-loader-4-line"></i></span>`;
      }

      // shared keyboard handler for text inputs
      const onKeydown = (e) => {
        if (e.key === "Enter") { e.preventDefault(); commitInlineEdit(r, col, ie.val); }
        if (e.key === "Escape") { e.preventDefault(); cancelInlineEdit(); }
      };
      const onBlur = () => {
        if (cancellingEdit) return;
        commitInlineEdit(r, col, ie.val);
      };
      // selects: Escape cancels; clicking away is ignored (no blur handler)
      const onSelectKeydown = (e) => {
        if (e.key === "Escape") { e.preventDefault(); cancelInlineEdit(); }
      };

      // organizzazione → select from catalog; auto-fills codice-organizzazione + provincia.
      // Unreachable while `organizzazione` is in INLINE_SKIP: kept because it is
      // the only code that knows how to move a record between organisations,
      // should that become an admin-only action.
      if (col === "organizzazione") {
        const catalog = state.step1.orgCatalog || [];
        const provMap = state.step1.orgProvinceByCode || {};
        const currentEntry = catalog.find((o) => o.name === ie.val) || null;
        const currentCode = currentEntry?.code || "";
        return html`
          <div class="select is-small">
            <select
              data-inline-focus
              .value=${currentCode}
              @keydown=${onSelectKeydown}
              @change=${(e) => {
                const selCode = e.target.value;
                const selOrg = catalog.find((o) => o.code === selCode);
                const orgName = selOrg ? selOrg.name : "";
                const prov = provMap[selCode] || "";
                commitInlineEdit(r, "organizzazione", orgName, {
                  "codice-organizzazione": selCode,
                  "provincia": prov,
                });
              }}
            >
              <option value="">—</option>
              ${catalog.map((o) => html`<option value=${o.code} ?selected=${o.code === currentCode}>${o.name} (${o.code})</option>`)}
            </select>
          </div>
        `;
      }

      // data-di-nascita → date input
      if (col === "data-di-nascita") {
        return html`
          <input
            class="input is-small"
            type="date"
            data-inline-focus
            .value=${ie.val}
            @input=${(e) => { ie.val = e.target.value; }}
            @keydown=${onKeydown}
            @blur=${onBlur}
          />
        `;
      }

      // default → text input (note, marca, modello, tipologia materiali, ecc.)
      return html`
        <span>
          <input
            class="input is-small"
            type="text"
            data-inline-focus
            .value=${ie.val}
            @input=${(e) => { ie.val = e.target.value; }}
            @keydown=${onKeydown}
            @blur=${onBlur}
          />
          ${ie.error ? html`<p class="help ${ie.error === SESSIONE_NON_VALIDA ? "is-warning" : "is-danger"}">${ie.error}${
            ie.error === SESSIONE_NON_VALIDA
              ? html` <a href="cf_logout.php">Esci e rientra</a>`
              : ""}</p>` : null}
        </span>
      `;
    }

    // ---- categoria/tipologia overlay ----
    function renderCatTipOverlay() {
      const ie = state.step1.inlineEdit;
      if (!ie || ie.col !== "cat-tip") return null;

      const isMezzi = ie.tab === "mezzi";
      const catOpts = isMezzi ? MEZZI_CAT_OPT : MAT_CAT_OPT;
      const tipByCat = isMezzi ? MEZZI_TIP_OPT : MAT_TIP_OPT;

      const onCatChange = (newCat) => {
        ie.categoria = newCat;
        ie.tipologia = newCat === "Non assegnata" ? "Non assegnata" : "";
        state.step1.skipFetch = true;
        refresh();
      };

      const onTipChange = (newTip) => {
        ie.tipologia = newTip;
        state.step1.skipFetch = true;
        refresh();
      };

      // Only the tipologie of the selected categoria, as step 2 does. A value
      // already on the record that does not belong to it is kept as an
      // out-of-list option instead of disappearing from the dropdown.
      const allowedTips = (tipByCat[ie.categoria] || []).filter(
        (t) => t !== "Non assegnata"
      );
      const outOfListTip =
        ie.tipologia && !allowedTips.includes(ie.tipologia) ? ie.tipologia : "";

      const tipologiaField = ie.categoria === "Non assegnata"
        ? html`
            <div class="field">
              <label class="label is-small mb-1">Tipologia</label>
              <input class="input is-small" type="text" disabled .value=${"Non assegnata"} />
            </div>
          `
        : allowedTips.length === 0 && !outOfListTip
        ? html`
            <div class="field">
              <label class="label is-small mb-1">Tipologia</label>
              <input class="input is-small" type="text" disabled .value=${"—"} />
            </div>
          `
        : html`
            <div class="field">
              <label class="label is-small mb-1">Tipologia</label>
              <div class="select is-small is-fullwidth">
                <select @change=${(e) => onTipChange(e.target.value)}>
                  <option value="" ?selected=${!ie.tipologia}>— seleziona —</option>
                  ${allowedTips.map(
                    (t) => html`<option value=${t} ?selected=${t === ie.tipologia}>${t}</option>`
                  )}
                  ${outOfListTip
                    ? html`<option value=${outOfListTip} selected>
                        ${outOfListTip} (fuori elenco)
                      </option>`
                    : ""}
                </select>
              </div>
            </div>
          `;

      return html`
        <div
          style="position:fixed;inset:0;z-index:999"
          @click=${cancelInlineEdit}
        ></div>
        <div
          style="position:fixed;top:${ie.anchorY}px;left:${ie.anchorX}px;z-index:1000;background:#fff;border:1px solid #dbdbdb;border-radius:6px;padding:1rem;box-shadow:0 4px 16px rgba(0,0,0,.15);min-width:280px;"
          @click=${(e) => e.stopPropagation()}
          @keydown=${(e) => { if (e.key === "Escape") cancelInlineEdit(); }}
        >
          ${ie.saving
            ? html`<div style="display:flex;align-items:center;gap:.5rem;padding:.5rem 0">
                <span class="icon rm-spin"><i class="ri-loader-4-line"></i></span>
                <span class="is-size-7 has-text-grey">Salvataggio…</span>
              </div>`
            : html`
              <div class="field">
                <label class="label is-small mb-1">Categoria</label>
                <div class="select is-small is-fullwidth">
                  <select
                    data-inline-focus
                    .value=${ie.categoria}
                    @change=${(e) => onCatChange(e.target.value)}
                  >
                    ${catOpts.map((o) => html`<option value=${o} ?selected=${o === ie.categoria}>${o}</option>`)}
                  </select>
                </div>
              </div>
              ${tipologiaField}
              ${ie.error ? html`<p class="help ${ie.error === SESSIONE_NON_VALIDA ? "is-warning" : "is-danger"} mb-2">${ie.error}${
                ie.error === SESSIONE_NON_VALIDA
                  ? html` <a href="cf_logout.php">Esci e rientra</a>`
                  : ""}</p>` : null}
              <div class="buttons is-right mt-3" style="gap:.5rem">
                <button class="button is-small" @click=${cancelInlineEdit}>Annulla</button>
                <button
                  class="button is-small is-primary"
                  @click=${commitCatTipEdit}
                >Salva</button>
              </div>
            `}
        </div>
      `;
    }

    function renderCreatePicker() {
      const pk = state.step1.createPicker;
      if (!pk) return "";
      const risultati = createPickerRisultati();
      const provByCode = state.step1.orgProvinceByCode || {};

      return html`
        <div class="modal is-active">
          <div class="modal-background" @click=${chiudiCreatePicker}></div>
          <div class="modal-card" style="max-width:40rem">
            <header class="modal-card-head">
              <p class="modal-card-title is-size-6">
                Nuova risorsa in ${TAB_LABELS[pk.tab]} — scegli l'organizzazione
              </p>
              <button class="delete" aria-label="close" @click=${chiudiCreatePicker}></button>
            </header>

            <section class="modal-card-body">
              <div class="control has-icons-left mb-3">
                <input
                  class="input rm-search"
                  type="search"
                  placeholder="Cerca per denominazione o codice…"
                  .value=${safe(pk.q)}
                  @input=${(e) => setCreatePickerQuery(e.target.value)}
                />
                <span class="icon is-left has-text-link"><i class="ri-search-line"></i></span>
              </div>

              ${state.step1.orgCatalogError
                ? html`<p class="help is-danger">
                         Anagrafica organizzazioni non disponibile: ${state.step1.orgCatalogError}
                       </p>`
                : ""}

              <div style="max-height:22rem;overflow-y:auto">
                ${risultati.length === 0
                  ? html`<p class="has-text-grey is-size-7 p-3 has-text-centered">
                           ${(state.step1.orgCatalog || []).length === 0
                             ? "Nessuna organizzazione trovata."
                             : "Nessun risultato."}
                         </p>`
                  : risultati.map(
                      (o) => html`
                        <button
                          type="button"
                          class="button is-white is-fullwidth"
                          style="justify-content:flex-start;text-align:left;white-space:normal"
                          @click=${() => startCreateConOrg(pk.tab, o)}
                        >
                          <strong>${o.name || "(senza denominazione)"}</strong>
                          ${o.code ? html`<span class="tag ml-2">${o.code}</span>` : ""}
                          ${o.province || provByCode[o.code]
                            ? html`<span class="tag is-light ml-2"
                                >${o.province || provByCode[o.code]}</span
                              >`
                            : ""}
                        </button>
                      `
                    )}
              </div>
            </section>

            <footer class="modal-card-foot">
              <button class="button" @click=${chiudiCreatePicker}>Annulla</button>
            </footer>
          </div>
        </div>
      `;
    }

    function renderOrgFilterPopup() {
      const pk = state.step1.orgFilterPicker;
      if (!pk) return "";
      const risultati = searchOrgs(pk.q);
      const current = state.selectedOrgByTab?.[pk.tab] || "all";
      const provByCode = state.step1.orgProvinceByCode || {};
      const showAll = !searchNorm(pk.q);

      return html`
        <div class="modal is-active">
          <div class="modal-background" @click=${closeOrgFilter}></div>
          <div class="modal-card" style="max-width:40rem">
            <header class="modal-card-head">
              <p class="modal-card-title is-size-6">Filtra per organizzazione — ${TAB_LABELS[pk.tab]}</p>
              <button class="delete" aria-label="close" @click=${closeOrgFilter}></button>
            </header>

            <section class="modal-card-body">
              <div class="control has-icons-left mb-3">
                <input
                  class="input rm-search"
                  type="search"
                  data-orgfilter-focus
                  placeholder="Cerca per denominazione o codice…"
                  .value=${safe(pk.q)}
                  @input=${(e) => setOrgFilterQuery(e.target.value)}
                />
                <span class="icon is-left has-text-link"><i class="ri-search-line"></i></span>
              </div>

              ${state.step1.orgCatalogError
                ? html`<p class="help is-danger">
                         Anagrafica organizzazioni non disponibile: ${state.step1.orgCatalogError}
                       </p>`
                : ""}

              <div style="max-height:22rem;overflow-y:auto">
                ${showAll
                  ? html`<button
                      type="button"
                      class="button is-fullwidth ${current === "all" ? "is-link is-light" : "is-white"}"
                      style="justify-content:flex-start;text-align:left"
                      @click=${() => pickOrgFilter(pk.tab, "all")}
                    ><strong>Tutte le organizzazioni</strong></button>`
                  : ""}
                ${risultati.length === 0
                  ? html`<p class="has-text-grey is-size-7 p-3 has-text-centered">
                           ${(state.step1.orgCatalog || []).length === 0
                             ? "Nessuna organizzazione trovata."
                             : "Nessun risultato."}
                         </p>`
                  : risultati.map(
                      (o) => html`
                        <button
                          type="button"
                          class="button is-fullwidth ${current === o.code ? "is-link is-light" : "is-white"}"
                          style="justify-content:flex-start;text-align:left;white-space:normal"
                          @click=${() => pickOrgFilter(pk.tab, o.code)}
                        >
                          <strong>${o.name || "(senza denominazione)"}</strong>
                          ${o.code ? html`<span class="tag ml-2">${o.code}</span>` : ""}
                          ${o.province || provByCode[o.code]
                            ? html`<span class="tag is-light ml-2">${o.province || provByCode[o.code]}</span>`
                            : ""}
                        </button>
                      `
                    )}
              </div>
            </section>

            <footer class="modal-card-foot">
              <button class="button" @click=${closeOrgFilter}>Annulla</button>
            </footer>
          </div>
        </div>
      `;
    }

    function renderTransferPopup() {
      const tr = state.step1.transfer;
      if (!tr) return "";
      const row = tr.row;
      const log = state.step1.transferLog;
      const problem = transferProblem(tr);
      const matches = transferMatches(tr);
      const sessione = (tr.error || "") === SESSIONE_NON_VALIDA;
      const kind = tr.tab === "mezzi" ? "mezzo" : "materiale";
      const detail = tr.tab === "mezzi"
        ? [row.marca, row.modello].map(safe).filter(Boolean).join(" ")
        : [row.categoria, row.tipologia].map(safe).filter(Boolean).join(" / ");

      return html`
        <div class="modal is-active">
          <div class="modal-background" @click=${closeTransfer}></div>
          <div class="modal-card" style="max-width:40rem;width:calc(100% - 2rem)">
            <header class="modal-card-head">
              <p class="modal-card-title is-size-6">Trasferisci ${kind} a un'altra organizzazione</p>
              <button class="delete" aria-label="Chiudi" ?disabled=${tr.busy} @click=${closeTransfer}></button>
            </header>
            <section class="modal-card-body">
              <p class="mb-1"><strong>${resourceLabel(tr.tab, row)}</strong>${detail ? html` <span class="has-text-grey">${detail}</span>` : ""}</p>
              <p class="is-size-7 has-text-grey mb-3">
                Organizzazione attuale: <strong>${safe(row.organizzazione) || "—"}</strong>
                ${safe(row["codice-organizzazione"]) ? html` (${safe(row["codice-organizzazione"])})` : ""}
              </p>

              ${tr.done ? html`
                <article class="message is-success">
                  <div class="message-body">
                    <strong>${tr.done.label}</strong> trasferito da ${tr.done.from || "—"} a <strong>${tr.done.to}</strong>.
                    Il trasferimento è stato registrato.
                  </div>
                </article>` : html`
                ${!log.ok
                  ? html`<article class="message is-warning"><div class="message-body">${log.error || tr.error}${
                      sessione ? html` <a href="cf_logout.php">Esci e rientra</a>` : ""}
                      Senza il registro il trasferimento è disattivato: non si potrebbe tracciare.</div></article>`
                  : html`
                  <div class="field">
                    <label class="label is-small">Organizzazione di destinazione</label>
                    ${tr.dest
                      ? html`<div class="notification is-info is-light py-2 px-3 mb-2">
                          <button class="delete is-small" aria-label="Cambia destinazione" ?disabled=${tr.busy}
                            @click=${() => setTransferField("dest", null)}></button>
                          <strong>${tr.dest.name}</strong> (${tr.dest.code})${tr.dest.province ? html` — provincia ${tr.dest.province}` : ""}
                        </div>`
                      : html`
                        <input class="input is-small" type="text" placeholder="Cerca per denominazione o codice…"
                          .value=${tr.query} ?disabled=${tr.busy}
                          @input=${(e) => setTransferField("query", e.target.value)}>
                        ${tr.query.trim().length >= 2 && !matches.length
                          ? html`<p class="help">Nessuna organizzazione trovata.</p>` : ""}
                        ${matches.length ? html`
                          <div class="mt-1" style="max-height:12rem;overflow:auto">
                            ${matches.map((o) => html`
                              <button class="button is-small is-fullwidth is-justify-content-flex-start mb-1"
                                @click=${() => pickTransferDest(o)}>
                                <span>${o.name}</span>
                                <span class="has-text-grey ml-2">${o.code}</span>
                              </button>`)}
                          </div>` : ""}`}
                  </div>
                  <div class="field">
                    <label class="label is-small">Motivazione</label>
                    <textarea class="textarea is-small" rows="3" maxlength=${TRANSFER_REASON_MAX}
                      placeholder="Perché cambia organizzazione (obbligatoria)" ?disabled=${tr.busy}
                      .value=${tr.motivo} @input=${(e) => setTransferField("motivo", e.target.value)}></textarea>
                    <p class="help">${safe(tr.motivo).length} / ${TRANSFER_REASON_MAX}</p>
                  </div>
                  <p class="is-size-7 has-text-grey">
                    Cambiano organizzazione, codice organizzazione e provincia della risorsa; il trasferimento
                    viene registrato con data, ora e utente.
                  </p>
                  ${tr.error ? html`<p class="help ${sessione ? "is-warning" : "is-danger"} mt-2">${tr.error}${
                      sessione ? html` <a href="cf_logout.php">Esci e rientra</a>` : ""}</p>` : ""}`}`}
            </section>
            <footer class="modal-card-foot">
              ${tr.done
                ? html`<button class="button is-success" @click=${closeTransfer}>Chiudi</button>`
                : html`
                  <button class="button is-link" ?disabled=${tr.busy || !log.ok || !!problem} title=${problem}
                    @click=${confirmTransfer}>
                    ${tr.busy ? "Trasferimento…" : "Trasferisci"}
                  </button>
                  <button class="button" ?disabled=${tr.busy} @click=${closeTransfer}>Annulla</button>`}
            </footer>
          </div>
        </div>`;
    }

    // One column of the popup: the categories of a table with their tipologie and counts.
    function classSection(label, cats, byCat, data) {
      const pairs = data?.pairs || null;
      const n = (cat, tip) => (pairs ? pairs.get(JSON.stringify([cat, tip])) || 0 : null);
      const sumCat = (cat) => (pairs ? [...pairs].reduce((a, [k, v]) => a + (JSON.parse(k)[0] === cat ? v : 0), 0) : null);
      const badge = (v) => (v === null ? "" : html`<span class="tag ${v ? "is-info is-light" : "is-light has-text-grey-light"} ml-2">${v}</span>`);

      // "Non assegnata" has no tipologie of its own in the list: the tipologia that goes
      // with it is "Non assegnata" too (the rule of the inline editor).
      const tipsOf = (cat) => (byCat[cat] && byCat[cat].length ? byCat[cat] : (cat === "Non assegnata" ? ["Non assegnata"] : []));

      const known = new Set();
      for (const cat of cats) for (const tip of tipsOf(cat)) known.add(JSON.stringify([cat, tip]));
      // what the registry holds that the list does not define
      const outside = pairs ? [...pairs].filter(([k]) => !known.has(k)) : [];

      return html`
        <div class="column is-6">
          <h4 class="title is-6 mb-2">${label}${data ? html`<span class="has-text-weight-normal has-text-grey"> — ${data.total} risorse</span>` : ""}</h4>
          ${cats.length === 0 ? html`<p class="has-text-grey">Nessuna classificazione definita.</p>` : ""}
          ${cats.map((cat) => html`
            <p class="has-text-weight-semibold mt-3 mb-1">${cat}${badge(sumCat(cat))}</p>
            <ul class="mt-0 mb-0" style="list-style:none;margin-left:.25rem">
              ${tipsOf(cat).map((tip) => html`<li class="is-size-7">${tip}${badge(n(cat, tip))}</li>`)}
            </ul>
          `)}
          ${outside.length ? html`
            <p class="has-text-weight-semibold has-text-warning-dark mt-4 mb-1">Fuori elenco</p>
            <p class="is-size-7 has-text-grey mb-1">Valori presenti nelle risorse ma non definiti sulla scheda.</p>
            <ul style="list-style:none;margin-left:.25rem">
              ${outside.map(([k, v]) => {
                const [cat, tip] = JSON.parse(k);
                return html`<li class="is-size-7">${cat || "(categoria vuota)"} / ${tip || "(tipologia vuota)"}${badge(v)}</li>`;
              })}
            </ul>` : ""}
        </div>`;
    }

    function renderClassPopup() {
      const cp = state.step1.classPopup;
      if (!cp.open) return "";
      return html`
        <div class="modal is-active">
          <div class="modal-background" @click=${closeClassPopup}></div>
          <div class="modal-card" style="max-width:56rem;width:calc(100% - 2rem)">
            <header class="modal-card-head">
              <p class="modal-card-title is-size-6">Classificazioni di mezzi e materiali</p>
              <button class="delete" aria-label="Chiudi" @click=${closeClassPopup}></button>
            </header>
            <section class="modal-card-body">
              <p class="is-size-7 has-text-grey mb-3">
                Categorie e tipologie come sono definite sulla scheda; il numero accanto a ciascuna
                è quante risorse del database la usano.
              </p>
              ${cp.loading ? html`<p class="is-size-7 has-text-grey"><span class="icon is-small rm-spin"><i class="ri-loader-4-line"></i></span> Conteggio delle risorse…</p>` : ""}
              ${cp.error
                ? html`<p class="help ${cp.error === SESSIONE_NON_VALIDA ? "is-warning" : "is-danger"}">Conteggi non disponibili: ${cp.error}${
                    cp.error === SESSIONE_NON_VALIDA ? html` <a href="cf_logout.php">Esci e rientra</a>` : ""}</p>`
                : ""}
              <div class="columns">
                ${classSection("Mezzi", MEZZI_CAT_OPT, MEZZI_TIP_OPT, cp.counts?.mezzi)}
                ${classSection("Materiali", MAT_CAT_OPT, MAT_TIP_OPT, cp.counts?.materiali)}
              </div>
            </section>
            <footer class="modal-card-foot">
              <button class="button" @click=${closeClassPopup}>Chiudi</button>
            </footer>
          </div>
        </div>`;
    }

    function renderColPanel() {
      const exp = state.step1.exportByTab[tab];
      const pref = readColPref(tab);
      const personalizzato = pref.order.length > 0 || pref.hidden.length > 0;

      return html`
        <div class="is-flex is-align-items-center mb-2" style="gap:.5rem;flex-wrap:wrap">
          <button class="button is-small"
            @click=${() => { state.step1.colPanelOpen = !state.step1.colPanelOpen; refresh(); }}>
            <span class="icon is-small"><i class="ri-table-line"></i></span>
            <span>Colonne</span>
            ${colsNascoste.length
              ? html`<span class="tag is-info is-light ml-2" style="font-size:.6rem">${colsNascoste.length} nascoste</span>`
              : ""}
          </button>
          ${personalizzato
            ? html`<button class="button is-small is-text" @click=${() => resetColPref(tab)}>
                     Ripristina ordine predefinito
                   </button>`
            : ""}

          <div class="buttons has-addons mb-0">
            <button class="button is-small" ?disabled=${exp.busy || total === 0}
              title="Scarica in Excel (.xlsx) tutte le righe della lista, con i filtri applicati e le colonne che vedi"
              @click=${() => exportSheet(tab, cols, "xlsx")}>
              <span class="icon is-small"><i class="${exp.busy && exp.format === "xlsx" ? "ri-loader-4-line rm-spin" : "ri-file-excel-2-line"}"></i></span>
              <span>${exp.busy && exp.format === "xlsx" ? "Esportazione…" : "Esporta in Excel"}</span>
            </button>
            <button class="button is-small" ?disabled=${exp.busy || total === 0}
              title="Scarica in ODS (LibreOffice, OpenOffice) tutte le righe della lista, con i filtri applicati e le colonne che vedi"
              @click=${() => exportSheet(tab, cols, "ods")}>
              <span class="icon is-small"><i class="${exp.busy && exp.format === "ods" ? "ri-loader-4-line rm-spin" : "ri-file-text-line"}"></i></span>
              <span>${exp.busy && exp.format === "ods" ? "Esportazione…" : "Esporta in ODS"}</span>
            </button>
          </div>
          ${tab === "volontari" ? "" : html`
            <button class="button is-small" @click=${openClassPopup}
              title="Mostra categorie e tipologie di mezzi e materiali, con quante risorse le usano">
              <span class="icon is-small"><i class="ri-node-tree"></i></span>
              <span>Classificazioni</span>
            </button>`}
          ${exp.error
            ? html`<span class="help ${exp.error === SESSIONE_NON_VALIDA ? "is-warning" : "is-danger"} mb-0">${exp.error}${
                exp.error === SESSIONE_NON_VALIDA ? html` <a href="cf_logout.php">Esci e rientra</a>` : ""}</span>`
            : ""}

          <div class="is-flex is-align-items-center ml-auto" style="gap:.35rem">
            <span class="is-size-7 has-text-grey">Carattere</span>
            <div class="buttons has-addons mb-0">
              ${FONT_SIZES.map(
                (f) => html`
                  <button
                    class="button is-small ${readFontSize() === f.id ? "is-link is-light" : ""}"
                    title=${f.title}
                    @click=${() => setFontSize(f.id)}
                  >${f.label}</button>
                `
              )}
            </div>
          </div>
        </div>

        ${state.step1.colPanelOpen
          ? html`
              <div class="box p-2 mb-3">
                ${colsOrdinate.map((c, i) => {
                  const nascosta = colsNascoste.includes(c);
                  return html`
                    <div class="is-flex is-align-items-center"
                      style="gap:.4rem;padding:.15rem 0;border-bottom:1px solid #f4f4f4">
                      <button class="button is-small is-white" title="Su"
                        ?disabled=${i === 0}
                        @click=${() => moveCol(tab, c, -1, colsPresenti)}>
                        <span class="icon is-small"><i class="ri-arrow-up-line"></i></span>
                      </button>
                      <button class="button is-small is-white" title="Giù"
                        ?disabled=${i === colsOrdinate.length - 1}
                        @click=${() => moveCol(tab, c, 1, colsPresenti)}>
                        <span class="icon is-small"><i class="ri-arrow-down-line"></i></span>
                      </button>
                      <label class="checkbox is-size-7" style="flex:1;min-width:0">
                        <input type="checkbox" ?checked=${!nascosta}
                          @change=${() => toggleColHidden(tab, c, colsPresenti)} />
                        <span class=${nascosta ? "has-text-grey-light" : ""}>${colLabel(tab, c)}</span>
                      </label>
                    </div>
                  `;
                })}
              </div>
            `
          : ""}
      `;
    }

    function renderQuickSearch() {
      const qs = state.step1.quickSearch;
      const hits = searchHits();
      const q = safe(qs.q);

      return html`
        <div class="mb-3">
          <div class="control has-icons-left has-icons-right">
            <input
              class="input rm-search"
              type="search"
              placeholder="Cerca un volontario, un mezzo o un materiale…"
              .value=${q}
              @input=${(e) => setQuickSearch(e.target.value)}
            />
            <span class="icon is-left has-text-link"><i class="ri-search-line"></i></span>
            ${qs.loading
              ? html`<span class="icon is-right has-text-link"><i class="ri-loader-4-line rm-spin"></i></span>`
              : q
                ? html`<span class="icon is-right" style="pointer-events:auto;cursor:pointer"
                         title="Pulisci la ricerca"
                         @click=${() => setQuickSearch("")}><i class="ri-close-line"></i></span>`
                : ""}
          </div>

          ${qs.error === "load"
            ? html`<p class="help is-danger">Ricerca non disponibile: cataloghi non caricati.</p>`
            : qs.error === "partial"
              ? html`<p class="help is-warning">Alcuni cataloghi non si sono caricati: i risultati sono parziali.</p>`
              : ""}

          ${hits === null
            ? q
              ? html`<p class="help">Almeno ${SEARCH_MIN} caratteri.</p>`
              : ""
            : html`
                <div class="box p-0 mt-2" style="max-height:320px;overflow-y:auto">
                  ${hits.length === 0
                    ? html`<p class="has-text-grey is-size-7 p-3 has-text-centered">Nessun risultato.</p>`
                    : hits.slice(0, SEARCH_SHOWN).map(
                        (h) => html`
                          <a
                            class="is-block"
                            style="padding:.4rem .6rem;border-bottom:1px solid #f0f0f0;text-decoration:none;color:inherit"
                            @click=${(e) => {
                              e.preventDefault();
                              startEdit(h.tab, h.row.id);
                            }}
                          >
                            <div class="is-flex is-align-items-center" style="gap:.4rem;flex-wrap:wrap">
                              <span class="tag is-light is-small" style="font-size:.6rem">${TAB_LABELS[h.tab]}</span>
                              <strong class="is-size-7">${searchTitle(h.tab, h.row)}</strong>
                              ${searchBadges(h.tab, h.row).map(
                                (b) => html`<span class="tag is-info is-light" style="font-size:.6rem"
                                              title=${b.label}>${b.value}</span>`
                              )}
                            </div>
                            ${searchSubtitle(h.tab, h.row)
                              ? html`<div class="is-size-7 has-text-grey">${searchSubtitle(h.tab, h.row)}</div>`
                              : ""}
                          </a>
                        `
                      )}
                  ${hits.length > SEARCH_SHOWN
                    ? html`<p class="has-text-grey is-size-7 p-2 has-text-centered">
                             e altri ${hits.length - SEARCH_SHOWN} risultati — restringi la ricerca
                           </p>`
                    : ""}
                </div>
              `}
        </div>
      `;
    }

    return html`
      <style>
        .rm-spin{animation:rm-spin 1s linear infinite}
        @keyframes rm-spin{to{transform:rotate(360deg)}}
        /* The quick search is the entry point of the page: it was the same
           washed-out grey as the filters below it and went unnoticed. */
        .rm-search{border-color:#3273dc;box-shadow:0 1px 2px rgba(50,115,220,.12)}
        .rm-search::placeholder{color:#5b6b84;opacity:1}
        .rm-search:focus{box-shadow:0 0 0 .125em rgba(50,115,220,.25)}
        /* Filter row: the columns are not the same height - a .field.has-addons
           is taller than a bare .select - so bottom-aligning them pushed the
           labels of the shorter ones down. Stretch instead, so every column is
           as tall as the tallest: labels line up at the top, and margin-top:auto
           on the control pins them all to the bottom. */
        .rm-filtri{align-items:stretch}
        .rm-filtri > div{display:flex;flex-direction:column}
        .rm-filtri > div > :last-child{margin-top:auto}
      </style>
      ${renderCatTipOverlay()}
      ${renderCreatePicker()}
      ${renderOrgFilterPopup()}
      ${renderClassPopup()}
      ${renderTransferPopup()}
      <div style="padding:1rem 1.25rem">
          <div class="level is-mobile">
            <div class="level-left">
              <div class="level-item">
                <h1 class="title is-5">Database Risorse</h1>
              </div>
            </div>
            <div class="level-right">
              <div class="level-item">
                ${perms.canCreate
                  ? html`
                      <button class="button is-small is-primary" @click=${() => startCreate(tab)}>
                        <span class="icon is-small"><i class="ri-add-line"></i></span>
                        <span>Aggiungi nuova risorsa nella categoria ${TAB_LABELS[tab]}</span>
                      </button>
                    `
                  : html`
                      <button class="button is-small" disabled title="Sola lettura">
                        <span class="icon is-small"><i class="ri-lock-line"></i></span>
                        <span>Sola lettura</span>
                      </button>
                    `}
              </div>
            </div>
          </div>

          ${renderQuickSearch()}

          <div class="tabs is-boxed is-small mb-0">
            <ul>
              ${Object.keys(TAB_LABELS).map(
                (k) => html`
                  <li class=${k === tab ? "is-active" : ""}>
                    <a href="#" @click=${(e) => setTab(k, e)}>${TAB_LABELS[k]}</a>
                  </li>
                `
              )}
            </ul>
          </div>

          <div class="box spa-title-box p-3">
            <div class="is-flex rm-filtri" style="gap:.75rem">

              <div style="width:236px;flex-shrink:0;">
                <label class="label is-small mb-1">Organizzazione</label>
                <div class="is-flex" style="gap:.25rem">
                  <div class="select is-small" style="flex:1;min-width:0">
                    <select
                      style="width:100%"
                      @change=${(e) => onOrgChange(tab, e.target.value)}
                    >
                      <option value="all" ?selected=${(state.selectedOrgByTab?.[tab] || "all") === "all"}>Tutte</option>
                      ${(state.step1.orgCatalog || []).map((o) => html`<option value=${o.code} ?selected=${(state.selectedOrgByTab?.[tab] || "all") === o.code}>${o.name}</option>`)}
                    </select>
                  </div>
                  <button
                    type="button"
                    class="button is-small"
                    style="flex-shrink:0"
                    title="Cerca l'organizzazione"
                    aria-label="Cerca l'organizzazione"
                    @click=${() => openOrgFilter(tab)}
                  >
                    <span class="icon is-small"><i class="ri-search-line"></i></span>
                  </button>
                </div>
              </div>

              ${hasCatTip ? html`
                <div style="width:160px;flex-shrink:0;">
                  <label class="label is-small mb-1">Categoria</label>
                  <div class="select is-small is-fullwidth">
                    <select
                      .value=${catFilter}
                      @change=${(e) => onCatFilterChange(tab, e.target.value)}
                    >
                      <option value="">Tutte</option>
                      ${catOptsForFilter.map((o) => html`<option value=${o} ?selected=${o === catFilter}>${o}</option>`)}
                    </select>
                  </div>
                </div>

                <div style="width:200px;flex-shrink:0;">
                  <label class="label is-small mb-1">Tipologia</label>
                  <div class="select is-small is-fullwidth">
                    <select
                      .value=${tipFilter}
                      @change=${(e) => onTipFilterChange(tab, e.target.value)}
                    >
                      <option value="">Tutte</option>
                      ${tipOptsForFilter.map((o) => html`<option value=${o} ?selected=${o === tipFilter}>${o}</option>`)}
                    </select>
                  </div>
                </div>
              ` : null}

              <div style="flex:1;min-width:0;">
                <label class="label is-small mb-1">Filtro per colonna</label>
                <div class="field has-addons mb-0">
                  <p class="control">
                    <span class="select is-small">
                      <!-- colsOrdinate, non cols: una colonna nascosta nella
                           tabella resta filtrabile, e soprattutto non sparisce
                           da qui mentre e' quella selezionata.
                           ?selected al posto di .value: con opzioni dinamiche
                           il binding .value non e' affidabile (AGENTS.md). -->
                      <select @change=${(e) => onFilterColChange(tab, e.target.value)}>
                        ${colsOrdinate.map(
                          (c) => html`<option value=${c} ?selected=${c === f.col}>${COL_LABELS[c] || c}</option>`
                        )}
                      </select>
                    </span>
                  </p>
                  <p class="control is-expanded">
                    <input
                      class="input is-small"
                      type="text"
                      placeholder="contiene…"
                      .value=${f.val || ""}
                      @input=${(e) => onFilterValChange(tab, e.target.value)}
                    />
                  </p>
                </div>
                ${state.step1.readOnlyGlobal ? html`<p class="help is-size-7 mb-0"><i class="ri-lock-line"></i> sola lettura</p>` : null}
              </div>

              <div style="width:90px;flex-shrink:0;">
                <label class="label is-small mb-1">Per pagina</label>
                <div class="select is-small is-fullwidth">
                  <select .value=${String(pag.size)} @change=${(e) => onPageSizeChange(tab, e.target.value)}>
                    <option value="20">20</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="200">200</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          ${state.step1.permissionsErrorByTab?.[tab]
            ? html`
                <article class="message is-warning is-small mb-2">
                  <div class="message-body is-size-7">
                    Permessi non verificati su questa scheda: le azioni sono nascoste.
                    <button class="button is-small is-warning is-light ml-2"
                      @click=${() => retryPermissions(tab)}>Riprova</button>
                  </div>
                </article>
              `
            : ""}

          ${renderColPanel()}

          <div class="is-flex is-justify-content-space-between is-align-items-center mb-2" style="gap:.75rem;">
            <div class="is-size-7 has-text-grey">
              ${total === 0
                ? html`Nessun risultato.`
                : html`Mostrati <strong>${from}</strong>–<strong>${to}</strong> di <strong>${total}</strong>`}
            </div>
            <div class="is-flex is-align-items-center" style="gap:.5rem;">
              ${PaginationControls(tab, pag)}
            </div>
          </div>

          <div class="table-container">
            <table
              class="table is-small is-narrow is-fullwidth is-hoverable is-striped"
              style=${`font-size:${fontSizeCss()}`}
            >
              <thead>
                <tr>
                  ${showActionsCol ? html`<th style="width:70px;"></th>` : null}
                  ${cols.map((c) => {
                    const spec = state.step1.sortByTab?.[tab];
                    const active = spec?.key === c;
                    const icon = active
                      ? spec.dir === "asc"
                        ? "ri-arrow-up-s-line"
                        : "ri-arrow-down-s-line"
                      : "ri-arrow-up-down-line";

                    return html`
                      <th style="cursor:pointer; user-select:none;" @click=${() => setSort(tab, c)} title="Ordina">
                        <span class="is-flex is-align-items-center" style="gap:.25rem;">
                          <span>${COL_LABELS[c] || c}</span>
                          <i class="${icon}"></i>
                        </span>
                      </th>
                    `;
                  })}
                </tr>
              </thead>

              <tbody>
                ${rows.length === 0
                  ? html`
                      <tr>
                        <td colspan=${cols.length + (showActionsCol ? 1 : 0)}>
                          <div class="notification is-light p-2">Nessun risultato.</div>
                        </td>
                      </tr>
                    `
                  : rows.map(
                      (r) => html`
                        <tr>
                          ${showActionsCol
                            ? html`
                                <td class="has-text-centered" style="vertical-align:middle;">
                                  <div class="buttons are-small is-justify-content-center is-flex is-flex-wrap-nowrap">
                                    <button
                                      class="button is-small is-info is-light"
                                      @click=${() => startEdit(tab, r.id)}
                                      ?disabled=${!perms.canUpdate}
                                      title=${perms.canUpdate ? "Modifica" : "Sola lettura"}
                                    >
                                      <span class="icon is-small"><i class="ri-pencil-line"></i></span>
                                    </button>
                                    <button
                                      class="button is-small is-danger is-light"
                                      @click=${() => doDelete(tab, r)}
                                      ?disabled=${!perms.canDelete}
                                      title=${perms.canDelete ? "Elimina" : "Sola lettura"}
                                    >
                                      <span class="icon is-small"><i class="ri-delete-bin-6-line"></i></span>
                                    </button>
                                    ${tab === "volontari" ? null : html`
                                    <button
                                      class="button is-small is-warning is-light"
                                      @click=${() => openTransfer(tab, r)}
                                      ?disabled=${!canTransfer(perms)}
                                      title=${transferTitle(perms)}
                                    >
                                      <span class="icon is-small"><i class="ri-arrow-left-right-line"></i></span>
                                    </button>`}
                                  </div>
                                </td>
                              `
                            : null}

                          ${cols.map((c) => {
                            const ie = state.step1.inlineEdit;
                            const isEditing = ie && ie.rowId === r.id && ie.col === c;
                            const isSkip = inlineBlocked(tab, c);
                            if (isEditing) {
                              return html`<td style="vertical-align:middle;white-space:normal;min-width:12rem;">${renderInlineCell(r, c, ie)}</td>`;
                            }
                            return html`<td
                              style="max-width:28rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;${perms.canUpdate && !isSkip ? "cursor:text" : ""}"
                              title=${safe(r?.[c] ?? "")}
                              @dblclick=${(e) => { if (perms.canUpdate && !isSkip) startInlineEdit(r, c, e); }}
                            >${safe(r?.[c] ?? "")}</td>`;
                          })}
                        </tr>
                      `
                    )}
              </tbody>
            </table>
          </div>
      </div>
    `;
  }

  return view();
}
