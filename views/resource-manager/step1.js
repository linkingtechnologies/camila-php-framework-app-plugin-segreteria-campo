// ./views/resource-manager/step1.js
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

  state.step1.columnFilterByTab ||= {
    volontari: { col: "cognome", op: "cs", val: "" },
    mezzi: { col: "targa", op: "cs", val: "" },
    materiali: { col: "id-materiale", op: "cs", val: "" },
  };

  state.step1.catFilterByTab ||= { volontari: "", mezzi: "", materiali: "" };
  state.step1.tipFilterByTab ||= { volontari: "", mezzi: "", materiali: "" };

  state.master ||= { volontari: null, mezzi: null, materiali: null };

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

  const MEZZI_CAT_OPT = ["Non assegnata", "Imbarcazioni", "Mezzi aerei", "Mezzi speciali", "Rimorchi", "Veicoli"];
  const MEZZI_TIP_OPT = {
    Imbarcazioni: ["Barca", "Gommone", "Hovercraft", "Moto d'acqua"],
    "Mezzi aerei": ["Aeroplano", "Drone", "Elicottero", "Idrovolante", "ULM (ultraleggero motorizzato)"],
    "Mezzi speciali": ["Battipista", "Bobcat", "Escavatore", "Listo spazzola", "Motoslitta", "Muletto", "Sollevatore idraulico", "Spargi sabbia e sale", "Spazzaneve", "Terna"],
    Rimorchi: ["Biga", "Carrello", "Carrello Appendice", "Rimorchio", "Roulotte", "Semirimorchio"],
    Veicoli: ["Ambulanza", "Autobotte", "Autobus", "Autocarro", "Autogru", "Autoidroschiuma", "Automedica", "Autopompa serbatoio (APS)", "Autoscala", "Autovettura", "Camper", "Carro attrezzi", "Fuoristrada", "Furgone", "Motociclo", "Motrice", "Trattore agricolo", "Trattore stradale"],
  };

  const MATERIALI_TIPOLOGIE_OPTS =
    "Non assegnata,--Attrezzature speciali,Apparato climatizzazione,Arva,Aspiratore,Aspiratore ad aria,Cisterna per idrocarburi,Compressore,Drone per riprese aeree,Gruppo,Martello,Martinetto,Materiale nautici e subacquei,Nastro traportatore,Officina,Pallone di sollevamento,Ponte Bailey,Potabilizzatore,Rasasiepi,Robot subaqueo,Saldatrice,Serbatoio per acqua potabile,Sonda,Spaccarocce,Transpallet,Trivella,Vibroinfissore,--Attrezzi vari,Attrezzi da lavoro,Carriola Badile,DPI,Decespugliatore,Estintore,Grella di camminamento,Materiale da campeggio,Materiale per sollevamento,Motosega,Panca,Scala,Sedia,Tavolo,--Container,Attrezzati,Da trasporto,--Effetti letterecci,Branda,Coperta,Cuscino/guanciale,Lenzuola,Materasso,Sacco a pelo,Sacco lenzuolo,--Generatori,Generatore,--Materiale AIB,Chiave idratante,Colonnina a terra presa acqua,Lancia,Manichette,Modulo AIB,Raccordo / riduzione,Serbatoio, cisterna antincendio,Soffiatore,Vasca,--Materiale antinquinante,Assorbente solido,Disperdente prodotti petroliferi,Panna antiinquinamento,Solvente antinquinante,--Materiale elettrico,Adattatore,Altro materiale elettrico,Asciugatrice,Cavi elettrici,Condizionatore,Dispenser,Frigor portatile,Impianto di illuminazione,Lampada portatile,Lavatrice,Macchina distribuzione automatica,Quadro elettrico,Riscaldatore - generatore aria calda,Spina,Termosifone elettrico,Torre faro,--Materiale idraulico e idrogeologico,Elettropompa,Insacchettatrice,Modulo Idrogeologico,Motopompa,Tubazioni,--Materiale informatico,--Radio e dispositivi TLC,Apparati radio da rack,Radio,Telefono satellitare,XCO-2020,--Tende,A pali,Gazebo,Multifunzione,Pneumatica,Sociale,Tensostruttura,Tipo p88";

  const { MAT_CAT_OPT, MAT_TIP_OPT } = (() => {
    const parts = MATERIALI_TIPOLOGIE_OPTS.split(",").map((x) => x.trim()).filter(Boolean);
    const cats = [];
    const byCat = {};
    let cur = null;
    for (const p of parts) {
      if (p.startsWith("--")) {
        cur = p.slice(2).trim();
        if (!byCat[cur]) byCat[cur] = [];
        if (!cats.includes(cur)) cats.push(cur);
        continue;
      }
      if (cur) byCat[cur].push(p);
    }
    return { MAT_CAT_OPT: ["Non assegnata", ...cats], MAT_TIP_OPT: byCat };
  })();

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
      const res = await client.table("db-volontari").distinct("codice-organizzazione", {
        include: "codice-organizzazione,organizzazione,provincia",
      });

      const rows = normalizeDistinctResponse(res);

      const orgMap = new Map();
      const orgProvMap = {};
      const provSet = new Set();

      for (const r of rows) {
        const code = (r?.["codice-organizzazione"] ?? "").toString().trim();
        const name = (r?.["organizzazione"] ?? "").toString().trim();
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

      state.step1.readOnlyGlobal = true;
    } catch (err) {
      state.step1.readOnlyGlobal = true;
    }
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
    state.editTab = tab;
    state.editId = null;
    state.editMode = "create";
    goTo(2);
  }

  function startEdit(tab, id) {
    const perms = getEffectivePermissions(tab);
    if (!perms.canUpdate) return;
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

    const cols = (() => {
      const set = new Set();
      for (const r of rows) Object.keys(r || {}).forEach((k) => set.add(k));
      set.delete("id");
      set.delete("uuid");
      set.delete("id2");

      const preferred = PREFERRED_COLS[tab] || [];
      const extra = [...set].filter((k) => !preferred.includes(k));
      extra.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

      return [...preferred.filter((k) => set.has(k)), ...extra];
    })();

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

    return html`
      <style>.rm-spin{animation:rm-spin 1s linear infinite}@keyframes rm-spin{to{transform:rotate(360deg)}}</style>
      ${renderCatTipOverlay()}
      <div class="container">
        <section class="section">
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

          <div class="tabs is-boxed is-small">
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

          <div class="box p-3">
            <div class="is-flex" style="gap:.75rem;align-items:flex-end;">

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
                      <select .value=${f.col} @change=${(e) => onFilterColChange(tab, e.target.value)}>
                        ${cols.map((c) => html`<option value=${c}>${COL_LABELS[c] || c}</option>`)}
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
            <table class="table is-small is-narrow is-fullwidth is-hoverable is-striped">
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
        </section>
      </div>
    `;
  }

  return view();
}
