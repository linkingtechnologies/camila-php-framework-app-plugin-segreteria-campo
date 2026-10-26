// ./views/resource-manager/step1.js

// Cache-busting dell'import dinamico: la query dell'entry point non si
// propaga ai moduli importati dalla view (AGENTS.md §L'import deve essere dinamico).
const VERSION = window.APP_CONFIG?.version || Date.now();
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

  // The picker lists the organisations that ALREADY have volunteers, from a
  // distinct on `db-volontari` - deliberately not the same source as the form
  // dropdown, which reads the registry `db-organizzazioni`. Creating a resource
  // is about an organisation already on the field; the dropdown has to be able
  // to offer every one on record.
  state.step1.orgFromRecords ||= null;
  state.step1.orgFromRecordsLoading ||= false;

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

  // colonne derivate: non modificabili inline
  const INLINE_SKIP = new Set(["provincia", "codice-organizzazione"]);
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

  function normalizeDistinctResponse(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.records)) return res.records;
    if (Array.isArray(res?.data?.records)) return res.data.records;
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
    ensureOrgFromRecords();
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

  async function ensureOrgFromRecords() {
    if (state.step1.orgFromRecords || state.step1.orgFromRecordsLoading) return;
    state.step1.orgFromRecordsLoading = true;
    try {
      const res = await client.table("db-volontari").distinct("codice-organizzazione", {
        include: "codice-organizzazione,organizzazione,provincia",
      });
      const map = new Map();
      for (const r of normalizeDistinctResponse(res)) {
        const code = (r?.["codice-organizzazione"] ?? "").toString().trim();
        const name = (r?.["organizzazione"] ?? "").toString().trim();
        const prov = (r?.["provincia"] ?? "").toString().trim().toUpperCase();
        if (code && !map.has(code)) map.set(code, { code, name, province: prov });
      }
      state.step1.orgFromRecords = [...map.values()].sort((a, b) =>
        a.name.localeCompare(b.name, "it", { sensitivity: "base" })
      );
    } catch (_) {
      // falls back to the registry: better a longer list than none
      state.step1.orgFromRecords = [];
    }
    state.step1.orgFromRecordsLoading = false;
    refresh();
  }

  function createPickerRisultati() {
    const pk = state.step1.createPicker;
    if (!pk) return [];
    const q = searchNorm(pk.q);
    const dai = state.step1.orgFromRecords;
    const list = dai && dai.length ? dai : state.step1.orgCatalog || [];
    if (!q) return list;
    return list.filter(
      (o) => searchNorm(o.name).includes(q) || searchNorm(o.code).includes(q)
    );
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
    if (INLINE_SKIP.has(col)) return;
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
      ie.error = e?.message || String(e);
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
      ie.error = e?.message || String(e);
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

      // organizzazione → select from catalog; auto-fills codice-organizzazione + provincia
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
          ${ie.error ? html`<p class="help is-danger">${ie.error}</p>` : null}
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
        for (const [cat, tips] of Object.entries(tipByCat)) {
          if (tips.includes(newTip)) { ie.categoria = cat; break; }
        }
        state.step1.skipFetch = true;
        refresh();
      };

      const tipologiaField = ie.categoria === "Non assegnata"
        ? html`
            <div class="field">
              <label class="label is-small mb-1">Tipologia</label>
              <input class="input is-small" type="text" disabled .value=${"Non assegnata"} />
            </div>
          `
        : (tipByCat[ie.categoria] || []).length === 0
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
                  ${Object.entries(tipByCat).map(([cat, tips]) => html`
                    <optgroup label=${cat}>
                      ${tips.map((t) => html`<option value=${t} ?selected=${t === ie.tipologia}>${t}</option>`)}
                    </optgroup>
                  `)}
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
              ${ie.error ? html`<p class="help is-danger mb-2">${ie.error}</p>` : null}
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
                ${state.step1.orgFromRecordsLoading
                  ? html`<progress class="progress is-small m-3" style="width:auto"></progress>`
                  : risultati.length === 0
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

    function renderColPanel() {
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

              <div style="width:200px;flex-shrink:0;">
                <label class="label is-small mb-1">Organizzazione</label>
                <div class="select is-small is-fullwidth">
                  <select
                    .value=${state.selectedOrgByTab?.[tab] || "all"}
                    @change=${(e) => onOrgChange(tab, e.target.value)}
                  >
                    <option value="all">Tutte</option>
                    ${(state.step1.orgCatalog || []).map((o) => html`<option value=${o.code}>${o.name}</option>`)}
                  </select>
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
                                  </div>
                                </td>
                              `
                            : null}

                          ${cols.map((c) => {
                            const ie = state.step1.inlineEdit;
                            const isEditing = ie && ie.rowId === r.id && ie.col === c;
                            const isSkip = INLINE_SKIP.has(c);
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
