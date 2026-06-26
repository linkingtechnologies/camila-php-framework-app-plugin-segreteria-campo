// ./views/resource-manager/step2.js
export async function Step2(props) {
  const { state, client, goTo, html, render, root } = props;

  // -------------------- BOOT STATE --------------------
  state.step2 ||= {};
  state.step2.loadedKey ||= null;
  state.step2.loading ||= false;
  state.step2.saving ||= false;
  state.step2.error ||= null;
  state.step2.saveError ||= null;

  state.step2.baseRow ||= null;
  state.step2.draftRow ||= null;

  // UI state (deterministico) per marca mezzi "select + altro"
  state.step2.ui ||= {};
  state.step2.ui.mezziMarcaMode ||= "select"; // "select" | "other"
  state.step2.ui.mezziMarcaOther ||= "";

  // NEW: sequence state (prefill id-materiale) — una sola chiamata per contesto
  state.step2.sequenceLoadedKey ||= null;
  state.step2.sequenceLoading ||= false;
  state.step2.sequenceError ||= null;

  state.step1 ||= {};
  state.step1.orgCatalog ||= null; // [{code,name}]
  state.step1.orgCatalogLoaded ||= false;
  state.step1.orgCatalogError ||= null;

  state.step1.provinceCatalog ||= null; // ["RM","MI",...]
  state.step1.provinceCatalogLoaded ||= false;
  state.step1.provinceCatalogError ||= null;

  state.step1.orgProvinceByCode ||= null; // { [code]: "RM" }
  state.step1.orgProvinceByCodeLoaded ||= false;

  // Marche mezzi (caricate da asset esterno per tenere JS piccolo)
  state.step1.mezziMarche ||= null; // ["Audi",...]
  state.step1.mezziMarcheLoaded ||= false;
  state.step1.mezziMarcheError ||= null;

  // -------------------- MEZZI OPTIONS --------------------
  const CATEGORIE_OPTS =
    "Non assegnata,Imbarcazioni,Mezzi aerei,Mezzi speciali,Rimorchi,Veicoli";

  const TIPOLOGIE_OPTS =
    "Non assegnata,--Imbarcazioni,Barca,Gommone,Hovercraft,Moto d'acqua,--Mezzi aerei,Aeroplano,Drone,Elicottero,Idrovolante,ULM (ultraleggero motorizzato),--Mezzi speciali,Battipista,Bobcat,Escavatore,Listo spazzola,Motoslitta,Muletto,Sollevatore idraulico,Spargi sabbia e sale,Spazzaneve,Terna,--Rimorchi,Biga,Carrello,Carrello Appendice,Rimorchio,Roulotte,Semirimorchio,--Veicoli,Ambulanza,Autobotte,Autobus,Autocarro,Autogru,Autoidroschiuma,Automedica,Autopompa serbatoio (APS),Autoscala,Autovettura,Camper,Carro attrezzi,Fuoristrada,Furgone,Motociclo,Motrice,Trattore agricolo,Trattore stradale";

  // -------------------- MATERIALI (ATTREZZATURE) OPTIONS --------------------
  const MATERIALI_TIPOLOGIE_OPTS =
    "Non assegnata,--Attrezzature speciali,Apparato climatizzazione,Arva,Aspiratore,Aspiratore ad aria,Cisterna per idrocarburi,Compressore,Drone per riprese aeree,Gruppo,Martello,Martinetto,Materiale nautici e subacquei,Nastro traportatore,Officina,Pallone di sollevamento,Ponte Bailey,Potabilizzatore,Rasasiepi,Robot subaqueo,Saldatrice,Serbatoio per acqua potabile,Sonda,Spaccarocce,Transpallet,Trivella,Vibroinfissore,--Attrezzi vari,Attrezzi da lavoro,Carriola Badile,DPI,Decespugliatore,Estintore,Grella di camminamento,Materiale da campeggio,Materiale per sollevamento,Motosega,Panca,Scala,Sedia,Tavolo,--Container,Attrezzati,Da trasporto,--Effetti letterecci,Branda,Coperta,Cuscino/guanciale,Lenzuola,Materasso,Sacco a pelo,Sacco lenzuolo,--Generatori,Generatore,--Materiale AIB,Chiave idratante,Colonnina a terra presa acqua,Lancia,Manichette,Modulo AIB,Raccordo / riduzione,Serbatoio, cisterna antincendio,Soffiatore,Vasca,--Materiale antinquinante,Assorbente solido,Disperdente prodotti petroliferi,Panna antiinquinamento,Solvente antinquinante,--Materiale elettrico,Adattatore,Altro materiale elettrico,Asciugatrice,Cavi elettrici,Condizionatore,Dispenser,Frigor portatile,Impianto di illuminazione,Lampada portatile,Lavatrice,Macchina distribuzione automatica,Quadro elettrico,Riscaldatore - generatore aria calda,Spina,Termosifone elettrico,Torre faro,--Materiale idraulico e idrogeologico,Elettropompa,Insacchettatrice,Modulo Idrogeologico,Motopompa,Tubazioni,--Radio e dispositivi TLC,Apparati radio da rack,Radio,Telefono satellitare,XCO-2020,--Tende,A pali,Gazebo,Multifunzione,Pneumatica,Sociale,Tensostruttura,Tipo p88";

  function parseCsvOptions(s) {
    return String(s || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function buildTipologieByCategoria() {
    const parts = parseCsvOptions(TIPOLOGIE_OPTS);
    const all = [];
    const byCat = {};
    let currentCat = null;

    for (const p of parts) {
      if (p.startsWith("--")) {
        currentCat = p.slice(2).trim();
        if (!byCat[currentCat]) byCat[currentCat] = [];
        continue;
      }
      all.push(p);
      if (currentCat) byCat[currentCat].push(p);
    }

    return { all, byCat };
  }

  function buildCatalogFromOpts(optsString) {
    const parts = parseCsvOptions(optsString);
    const byCat = {};
    const categories = [];
    let currentCat = null;

    for (const p of parts) {
      if (p.startsWith("--")) {
        currentCat = p.slice(2).trim();
        if (!byCat[currentCat]) byCat[currentCat] = [];
        if (!categories.includes(currentCat)) categories.push(currentCat);
        continue;
      }
      if (currentCat) byCat[currentCat].push(p);
    }

    return {
      categories: ["Non assegnata", ...categories],
      byCat,
    };
  }

  const MEZZI_CATEGORIE = parseCsvOptions(CATEGORIE_OPTS);
  const { byCat: MEZZI_TIPOLOGIE_BYCAT } = buildTipologieByCategoria();

  const { categories: MATERIALI_CATEGORIE, byCat: MATERIALI_TIPOLOGIE_BYCAT } =
    buildCatalogFromOpts(MATERIALI_TIPOLOGIE_OPTS);

  // -------------------- CONFIG --------------------
  const RM_CONFIG = {
    volontari: {
      table: "db-volontari",
      keyLabel: "codice-fiscale",
      fields: [
        "codice-fiscale",
        "cognome",
        "nome",
        "data-di-nascita",
        "luogo-di-nascita",
        "cellulare",
        "provincia",
        "organizzazione",
        "codice-organizzazione",
      ],
      normalize: (d) => {
        const out = { ...d };
        out["codice-fiscale"] = String(d?.["codice-fiscale"] || "")
          .trim()
          .toUpperCase();
        if (out["data-di-nascita"] !== undefined)
          out["data-di-nascita"] = String(out["data-di-nascita"] || "").trim(); // YYYY-MM-DD
        if (out["provincia"] !== undefined)
          out["provincia"] = String(out["provincia"] || "")
            .trim()
            .toUpperCase();
        return out;
      },
    },
    mezzi: {
      table: "db-mezzi",
      keyLabel: "targa",
      fields: [
        "targa",
        "categoria",
        "tipologia",
        "marca",
        "modello",
        "note",
        "provincia",
        "codice-inventario",
        "codice-inventario-regionale",
        "codice-inventario-provinciale",
        "organizzazione",
        "codice-organizzazione",
        "proprietario",
      ],
      normalize: (d) => ({
        ...d,
        targa: String(d?.targa || "").trim().toUpperCase(),
        provincia: String(d?.provincia || "").trim().toUpperCase(),
      }),
    },
    materiali: {
      table: "db-materiali",
      keyLabel: "id-materiale",
      fields: [
        "id-materiale",
        "codice-inventario",
        "codice-inventario-regionale",
        "codice-inventario-provinciale",
        "proprietario",
        "categoria",
        "tipologia",
        "note",
        "marca",
        "modello",
        "provincia",
        "organizzazione",
        "codice-organizzazione",
        "note-ulteriori",
      ],
      normalize: (d) => ({
        ...d,
        "id-materiale": String(d?.["id-materiale"] || "").trim(),
        provincia: String(d?.provincia || "").trim().toUpperCase(),
      }),
    },
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

  function safeStr(v) {
    return (v ?? "").toString();
  }

  function stableStringify(obj) {
    const seen = new WeakSet();
    const rec = (v) => {
      if (v === null || typeof v !== "object") return v;
      if (seen.has(v)) return "[Circular]";
      seen.add(v);
      if (Array.isArray(v)) return v.map(rec);
      const keys = Object.keys(v).sort();
      const out = {};
      for (const k of keys) out[k] = rec(v[k]);
      return out;
    };
    return JSON.stringify(rec(obj));
  }

  function isDirty(base, draft) {
    return stableStringify(base || {}) !== stableStringify(draft || {});
  }

  function getContext() {
    const tab = state.editTab || state.activeTab || "volontari";
    const mode = state.editMode || (state.editId ? "edit" : "create");
    const id = state.editId || null;
    return { tab, mode, id };
  }

  function getFields(tab, base, draft) {
    const cfg = RM_CONFIG[tab] || {};
    const explicit = cfg.fields || [];

    const set = new Set(explicit);

    const src = draft || base || {};
    for (const k of Object.keys(src)) {
      if (k === "id" || k === "uuid") continue;
      set.add(k);
    }

    const extra = [...set].filter((k) => !explicit.includes(k));
    extra.sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    return [...explicit, ...extra].filter((k) => k !== "id" && k !== "uuid");
  }

  function setDraftField(k, v) {
    state.step2.draftRow ||= {};
    state.step2.draftRow = { ...state.step2.draftRow, [k]: v };
  }

  // -------------------- RENDER LOOP (deterministico) --------------------
  let renderSeq = 0;

  async function refresh() {
    if (typeof render !== "function" || !root) return;
    const seq = ++renderSeq;
    const tpl = await view();
    if (seq !== renderSeq) return;
    render(tpl, root);
  }

  // NEW: helper “lit-proof” per aggiornare draft + UI (abilita subito il bottone Salva)
  // NOTE: lit-html non è reattivo -> senza refresh() il template non ricalcola `dirty`.
  function setDraftFieldUI(k, v) {
    setDraftField(k, v);
    refresh();
  }

  // NEW: helper per select “lit-proof”
  function SelectOption(label, value, selected) {
    return html`<option value=${value} ?selected=${!!selected}>${label}</option>`;
  }

  // FIX: update coerente di draft+base (così non sporchi dirty in edit)
  function setFieldIfMissingBoth(k, v) {
    const { mode } = getContext();
    const base = state.step2.baseRow || null;
    const draft = state.step2.draftRow || null;
    if (!draft) return;

    const draftCur = safeStr(draft[k] ?? "").trim();
    if (draftCur) return; // già presente nel draft -> non toccare

    // set draft sempre
    setDraftField(k, v);

    // se edit e il base era vuoto, aggiorna anche base per non attivare dirty
    if (mode === "edit" && base) {
      const baseCur = safeStr(base[k] ?? "").trim();
      if (!baseCur) state.step2.baseRow = { ...base, [k]: v };
    }
  }

  // FIX: riconcilia codice/nome/provincia una volta che orgCatalog è disponibile
  function reconcileOrgFromCatalog(orgCatalog, orgProvMap) {
    const draft = state.step2.draftRow || {};
    const codeCur = safeStr(draft["codice-organizzazione"] || "").trim();
    const nameCur = safeStr(draft["organizzazione"] || "").trim();

    const byCode = new Map(
      (orgCatalog || []).map((o) => [
        safeStr(o.code).trim(),
        safeStr(o.name || "").trim(),
      ])
    );

    // mappa nameLower -> [code,...] (deterministica: codes sorted)
    const nameToCodes = new Map();
    for (const o of orgCatalog || []) {
      const c = safeStr(o.code).trim();
      const n = safeStr(o.name || "").trim();
      if (!c || !n) continue;
      const key = n.toLowerCase();
      const arr = nameToCodes.get(key) || [];
      arr.push(c);
      nameToCodes.set(key, arr);
    }
    for (const [k, arr] of nameToCodes.entries()) {
      arr.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );
      nameToCodes.set(k, arr);
    }

    // 1) se manca il codice ma c'è il nome -> deriva codice
    if (!codeCur && nameCur) {
      const codes = nameToCodes.get(nameCur.toLowerCase());
      const derivedCode = codes && codes.length ? codes[0] : "";
      if (derivedCode) {
        setFieldIfMissingBoth("codice-organizzazione", derivedCode);

        const prov = safeStr(orgProvMap?.[derivedCode] || "")
          .trim()
          .toUpperCase();
        if (prov) setFieldIfMissingBoth("provincia", prov);
        // nome già presente, ok
      }
    }

    // 2) se c'è codice ma manca nome -> deriva nome
    const codeAfter =
      safeStr((state.step2.draftRow || {})["codice-organizzazione"] || "").trim() ||
      codeCur;
    const nameAfter =
      safeStr((state.step2.draftRow || {})["organizzazione"] || "").trim() ||
      nameCur;

    if (codeAfter && !nameAfter) {
      const derivedName = safeStr(byCode.get(codeAfter) || "").trim();
      if (derivedName) setFieldIfMissingBoth("organizzazione", derivedName);
    }

    // 3) se c'è codice e provincia manca -> deriva provincia
    const provAfter = safeStr((state.step2.draftRow || {})["provincia"] || "")
      .trim()
      .toUpperCase();
    if (codeAfter && !provAfter) {
      const prov = safeStr(orgProvMap?.[codeAfter] || "")
        .trim()
        .toUpperCase();
      if (prov) setFieldIfMissingBoth("provincia", prov);
    }
  }

  // NEW: prefill id-materiale in create usando sequence()
  async function ensureMaterialIdPrefill(loadedKey) {
    const { tab, mode } = getContext();
    if (tab !== "materiali" || mode !== "create") return;

    if (state.step2.sequenceLoadedKey === loadedKey) return;

    const cur = safeStr(state.step2.draftRow?.["id-materiale"] || "").trim();
    if (cur) {
      state.step2.sequenceLoadedKey = loadedKey;
      state.step2.sequenceError = null;
      return;
    }

    state.step2.sequenceLoading = true;
    state.step2.sequenceError = null;

    try {
      const res = await client.table("db-materiali").sequence(); // { table: "db-materiali", id: 103887 }
      const nextId = Number(res?.id);
      if (!Number.isFinite(nextId) || nextId <= 0)
        throw new Error("Sequence payload non valido");

      // NOTE: non facciamo refresh qui: ensureLoaded() porta già ad un render finale
      setDraftField("id-materiale", "M" + String(nextId));

      state.step2.sequenceLoadedKey = loadedKey;
      state.step2.sequenceError = null;
    } catch (e) {
      state.step2.sequenceLoadedKey = loadedKey;
      state.step2.sequenceError = e?.message || String(e);
    } finally {
      state.step2.sequenceLoading = false;
    }
  }

  async function ensureLoaded() {
    const { tab, mode, id } = getContext();
    const loadedKey = `${tab}||${mode}||${id || ""}`;

    if (state.step2.loadedKey === loadedKey) return;

    state.step2.loadedKey = loadedKey;
    state.step2.loading = true;
    state.step2.error = null;
    state.step2.saveError = null;
    state.step2.baseRow = null;
    state.step2.draftRow = null;

    state.step2.ui.mezziMarcaMode = "select";
    state.step2.ui.mezziMarcaOther = "";

    // reset sequence state per contesto
    state.step2.sequenceLoadedKey = null;
    state.step2.sequenceLoading = false;
    state.step2.sequenceError = null;

    try {
      if (mode === "edit" && id) {
        const tableName = RM_CONFIG[tab]?.table;
        const row = await client.table(tableName).read(id);
        state.step2.baseRow = row || null;
        state.step2.draftRow = row ? { ...row } : {};
      } else {
        state.step2.baseRow = null;
        state.step2.draftRow = {};
      }

      // in create materiali prefill id-materiale
      await ensureMaterialIdPrefill(loadedKey);
    } catch (e) {
      state.step2.error = e;
    } finally {
      state.step2.loading = false;
    }
  }

  function normalizeDistinctResponse(res) {
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.records)) return res.records;
    if (Array.isArray(res?.data?.records)) return res.data.records;
    return [];
  }

  async function ensureOrgCatalog() {
    if (
      state.step1.orgCatalogLoaded &&
      state.step1.provinceCatalogLoaded &&
      state.step1.orgProvinceByCodeLoaded
    )
      return;

    try {
      const res = await client
        .table("db-volontari")
        .distinct("codice-organizzazione", {
          include: "codice-organizzazione,organizzazione,provincia",
        });

      const rows = normalizeDistinctResponse(res);

      const orgMap = new Map();
      const provSet = new Set();
      const orgProv = {};

      for (const r of rows) {
        const code = (r?.["codice-organizzazione"] ?? "").toString().trim();
        const name = (r?.["organizzazione"] ?? "").toString().trim();
        const prov = (r?.["provincia"] ?? "").toString().trim().toUpperCase();

        if (code && !orgMap.has(code)) orgMap.set(code, name);
        if (prov) provSet.add(prov);
        if (code && prov && orgProv[code] === undefined) orgProv[code] = prov;
      }

      state.step1.orgCatalog = [...orgMap.entries()]
        .map(([code, name]) => ({ code, name }))
        .sort((a, b) =>
          a.code.localeCompare(b.code, undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );

      state.step1.orgCatalogLoaded = true;
      state.step1.orgCatalogError = null;

      state.step1.provinceCatalog = [...provSet].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );

      state.step1.provinceCatalogLoaded = true;
      state.step1.provinceCatalogError = null;

      state.step1.orgProvinceByCode = orgProv;
      state.step1.orgProvinceByCodeLoaded = true;
    } catch (e) {
      state.step1.orgCatalog = [];
      state.step1.orgCatalogLoaded = true;
      state.step1.orgCatalogError = e?.message || String(e);

      state.step1.provinceCatalog = [];
      state.step1.provinceCatalogLoaded = true;
      state.step1.provinceCatalogError = e?.message || String(e);

      state.step1.orgProvinceByCode = {};
      state.step1.orgProvinceByCodeLoaded = true;
    }
  }

  async function ensureMezziMarche() {
    if (state.step1.mezziMarcheLoaded) return;

    try {
      const res = await fetch(
        "./plugins/segreteria-campo/views/resource-manager/assets/mezzi-marche.txt",
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const txt = await res.text();

      const arr = txt
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      const uniq = Array.from(new Set(arr));
      uniq.sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
      );

      state.step1.mezziMarche = uniq;
      state.step1.mezziMarcheLoaded = true;
      state.step1.mezziMarcheError = null;
    } catch (e) {
      state.step1.mezziMarche = [];
      state.step1.mezziMarcheLoaded = true;
      state.step1.mezziMarcheError = e?.message || String(e);
    }
  }

  async function doSave() {
    const { tab, mode, id } = getContext();
    const cfg = RM_CONFIG[tab];
    if (!cfg) return;

    state.step2.saving = true;
    state.step2.saveError = null;
    await refresh();

    try {
      const draft = state.step2.draftRow || {};
      const payload = cfg.normalize ? cfg.normalize(draft) : { ...draft };

      // riallinea organizzazione + provincia dal codice selezionato
      const orgCatalog = state.step1.orgCatalog || [];
      const orgMap = new Map(orgCatalog.map((o) => [o.code, o.name]));
      const code = safeStr(payload["codice-organizzazione"] || "").trim();

      if (code) {
        payload["codice-organizzazione"] = code;
        payload["organizzazione"] = safeStr(
          orgMap.get(code) || payload["organizzazione"] || ""
        ).trim();

        const orgProv = state.step1.orgProvinceByCode || {};
        const prov = safeStr(orgProv[code] || "").trim().toUpperCase();
        if (prov) payload["provincia"] = prov;
      }

      delete payload.id;
      delete payload.uuid;

      if (mode === "edit" && id) {
        await client.table(cfg.table).update(id, payload);
      } else {
        await client.table(cfg.table).create(payload);
      }

      state.master ||= { volontari: null, mezzi: null, materiali: null };
      state.master[tab] = null;

      state.editId = null;
      state.editMode = null;

      goTo(1);
    } catch (e) {
      state.step2.saveError = e;
      await refresh();
    } finally {
      state.step2.saving = false;
      await refresh();
    }
  }

  function doCancel() {
    state.editId = null;
    state.editMode = null;
    goTo(1);
  }

  async function view() {
    await ensureLoaded();
    await ensureOrgCatalog();
    await ensureMezziMarche();

    const { tab, mode, id } = getContext();
    const cfg = RM_CONFIG[tab];
    const base = state.step2.baseRow;
    const draft = state.step2.draftRow;

    const fields = getFields(tab, base, draft);
    const dirty = isDirty(base, draft);

    const title = mode === "edit" ? `Modifica ${tab}` : `Nuovo ${tab}`;
    const subtitle = mode === "edit" ? `ID: ${safeStr(id)}` : "Creazione record";

    const orgCatalog = state.step1.orgCatalog || [];
    const orgMap = new Map(orgCatalog.map((o) => [o.code, o.name]));
    const orgCatalogByName = [...orgCatalog].sort((a, b) => {
      const an = (a.name || "").toString();
      const bn = (b.name || "").toString();
      const byName = an.localeCompare(bn, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      if (byName !== 0) return byName;
      return a.code.localeCompare(b.code, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    const orgProvMap = state.step1.orgProvinceByCode || {};

    // FIX: appena ho il catalogo, riallineo codice/nome/provincia se mancanti (draft + base)
    reconcileOrgFromCatalog(orgCatalog, orgProvMap);

    const draftAfter = state.step2.draftRow || draft || {};
    const currentOrgCode = safeStr(draftAfter?.["codice-organizzazione"] || "").trim();
    const currentOrgName = safeStr(draftAfter?.["organizzazione"] || "").trim();

    const derivedProv = safeStr(orgProvMap[currentOrgCode] || "").trim().toUpperCase();
    const currentProv = safeStr(draftAfter?.provincia || "").trim().toUpperCase();
    const provinceToShow = derivedProv || currentProv;

    const MEZZI_MARCHE = state.step1.mezziMarche || [];

    // -------------------- MEZZI: categoria/tipologia rules --------------------
    const draftCategoriaMezzi = safeStr(draftAfter?.categoria || "").trim();
    const categoriaMezziEff = draftCategoriaMezzi || "Non assegnata";
    const isCategoriaMezziNonAssegnata = categoriaMezziEff === "Non assegnata";
    const mezziCategorySelected = !isCategoriaMezziNonAssegnata;

    const allowedTipologieMezzi = mezziCategorySelected
      ? (MEZZI_TIPOLOGIE_BYCAT[categoriaMezziEff] || []).filter((t) => t !== "Non assegnata")
      : ["Non assegnata"];

    if (tab === "mezzi") {
      const curTip = safeStr(draftAfter?.tipologia || "").trim();
      if (isCategoriaMezziNonAssegnata && curTip !== "Non assegnata") {
        setDraftField("tipologia", "Non assegnata");
      }
      if (mezziCategorySelected && curTip === "Non assegnata") {
        setDraftField("tipologia", "");
      }
    }

    const draftTipologiaMezzi = safeStr(draftAfter?.tipologia || "").trim();

    // -------------------- MATERIALI: categoria/tipologia rules --------------------
    const draftCategoriaMat = safeStr(draftAfter?.categoria || "").trim();
    const categoriaMatEff = draftCategoriaMat || "Non assegnata";
    const isCategoriaMatNonAssegnata = categoriaMatEff === "Non assegnata";
    const materialiCategorySelected = !isCategoriaMatNonAssegnata;

    const allowedTipologieMat = materialiCategorySelected
      ? (MATERIALI_TIPOLOGIE_BYCAT[categoriaMatEff] || []).filter((t) => t !== "Non assegnata")
      : ["Non assegnata"];

    if (tab === "materiali") {
      const curTip = safeStr(draftAfter?.tipologia || "").trim();

      if (isCategoriaMatNonAssegnata && curTip !== "Non assegnata") {
        setDraftField("tipologia", "Non assegnata");
      }

      if (materialiCategorySelected && curTip === "Non assegnata") {
        setDraftField("tipologia", "");
      }

      if (materialiCategorySelected && curTip) {
        const allowed = (MATERIALI_TIPOLOGIE_BYCAT[categoriaMatEff] || []).filter(
          (t) => t !== "Non assegnata"
        );
        if (curTip && !allowed.includes(curTip)) setDraftField("tipologia", "");
      }
    }

    const draftTipologiaMat = safeStr(draftAfter?.tipologia || "").trim();

    // keys stabili (riduce reuse del nodo select)
    const orgSelectKey = `org||${state.step2.loadedKey || ""}`;
    const catSelectKey = `cat||${tab}||${state.step2.loadedKey || ""}`;
    const tipSelectKey = `tip||${tab}||${categoriaMezziEff}||${categoriaMatEff}||${state.step2.loadedKey || ""}`;

    const orgCodeIsKnown = currentOrgCode && orgMap.has(currentOrgCode);

    return html`
      <div class="container">
        <section class="section">
          <div class="level is-mobile">
            <div class="level-left">
              <div class="level-item">
                <div>
                  <h1 class="title is-6">${title}</h1>
                  <p class="subtitle is-7">${subtitle}</p>
                </div>
              </div>
            </div>
            <div class="level-right">
              <div class="level-item">
                <button class="button" @click=${doCancel} ?disabled=${state.step2.saving}>
                  <span class="icon"><i class="ri-arrow-left-line"></i></span>
                  <span>Indietro</span>
                </button>
              </div>
            </div>
          </div>

          ${state.step2.error
            ? html`
                <article class="message is-danger">
                  <div class="message-header"><p>Errore caricamento</p></div>
                  <div class="message-body">
                    <p>${safeStr(state.step2.error?.message || state.step2.error)}</p>
                  </div>
                </article>
              `
            : null}

          ${state.step2.loading
            ? html`<div class="notification is-info is-light">Caricamento…</div>`
            : null}

          ${!state.step2.loading
            ? html`
                <div class="box">
                  <!-- ORG SELECT IN ALTO -->
                  <div class="is-flex is-flex-wrap-wrap" style="gap: .75rem;">
                    <div style="flex: 1 1 28rem; min-width: 0;">
                      <label class="label is-small">Organizzazione</label>
                      <div class="control">
                        <div class="select is-small is-fullwidth">
                          <!-- FIX: ?selected + opzione "fuori elenco" se codice non presente nel catalogo -->
                          <select
                            data-key=${orgSelectKey}
                            @change=${async (e) => {
                              const code = safeStr(e.target.value).trim();
                              const name = safeStr(orgMap.get(code) || "").trim();
                              const prov = safeStr(orgProvMap[code] || "").trim().toUpperCase();

                              // NOTE: qui facciamo refresh perché questo cambio influenza provincia e UI
                              setDraftField("codice-organizzazione", code);
                              setDraftField("organizzazione", name);

                              if (prov) setDraftField("provincia", prov);
                              else if (code) setDraftField("provincia", "");

                              await refresh();
                            }}
                            ?disabled=${state.step2.saving}
                          >
                            ${SelectOption("— seleziona —", "", !currentOrgCode)}

                            ${currentOrgCode && !orgCodeIsKnown
                              ? SelectOption(
                                  `${currentOrgName || "Fuori elenco"} — ${currentOrgCode}`,
                                  currentOrgCode,
                                  true
                                )
                              : null}

                            ${orgCatalogByName.map((o) => {
                              const optLabel = o.name ? `${o.name} — ${o.code}` : o.code;
                              return SelectOption(optLabel, o.code, o.code === currentOrgCode);
                            })}
                          </select>
                        </div>
                      </div>

                      <p class="help is-size-7">
                        Codice: <code>${currentOrgCode || "—"}</code>
                        ${currentOrgName ? html`<span> · ${currentOrgName}</span>` : null}
                      </p>

                      ${currentOrgCode && !orgCodeIsKnown
                        ? html`<p class="help is-size-7 has-text-warning">
                            ${currentOrgName || "Fuori elenco"} — ${currentOrgCode} (fuori elenco)
                          </p>`
                        : null}

                      ${state.step1.orgCatalogError
                        ? html`<p class="help is-size-7 has-text-danger">
                            Errore caricamento organizzazioni
                          </p>`
                        : null}
                    </div>

                    <!-- PROVINCIA (readonly) -->
                    <div style="flex: 0 1 10rem; min-width: 10rem;">
                      <label class="label is-small">Provincia</label>
                      <div class="control">
                        <input class="input is-small" type="text" .value=${provinceToShow} disabled />
                      </div>
                    </div>
                  </div>

                  <hr />

                  ${tab === "materiali" && mode === "create" && state.step2.sequenceError
                    ? html`
                        <p class="help is-size-7 has-text-warning">
                          Prefill ID materiale non disponibile: ${safeStr(state.step2.sequenceError)}.
                          Puoi inserire l'ID manualmente.
                        </p>
                      `
                    : null}

                  <div class="is-flex is-flex-wrap-wrap" style="gap: .75rem;">
                    ${fields.map((k) => {
                      if (k === "organizzazione" || k === "codice-organizzazione" || k === "provincia")
                        return null;

                      const label = COL_LABELS[k] || k;
                      const val = draftAfter ? draftAfter[k] : "";
                      const isKey = cfg?.keyLabel === k;

                      // Volontari: date picker (YYYY-MM-DD)
                      if (tab === "volontari" && k === "data-di-nascita") {
                        const raw = safeStr(val).trim();
                        return html`
                          <div style="flex: 1 1 18rem; min-width: 0;">
                            <label class="label is-small">
                              ${label}
                              ${isKey ? html`<span class="tag is-light ml-2">chiave</span>` : null}
                            </label>
                            <div class="control">
                              <input
                                class="input is-small"
                                type="date"
                                .value=${raw || ""}
                                @input=${(e) => setDraftFieldUI(k, e.target.value)}
                                ?disabled=${state.step2.saving}
                              />
                            </div>
                          </div>
                        `;
                      }

                      // MEZZI: categoria select
                      if (tab === "mezzi" && k === "categoria") {
                        const cur = safeStr(val).trim() || "Non assegnata";
                        return html`
                          <div style="flex: 1 1 18rem; min-width: 0;">
                            <label class="label is-small">${label}</label>
                            <div class="control">
                              <div class="select is-small is-fullwidth">
                                <select
                                  data-key=${catSelectKey}
                                  @change=${async (e) => {
                                    const nextCat =
                                      safeStr(e.target.value).trim() || "Non assegnata";
                                    setDraftField("categoria", nextCat);

                                    if (nextCat === "Non assegnata") {
                                      setDraftField("tipologia", "Non assegnata");
                                    } else {
                                      const currentTip = safeStr(
                                        state.step2.draftRow?.tipologia || ""
                                      ).trim();
                                      if (currentTip === "Non assegnata")
                                        setDraftField("tipologia", "");
                                      else {
                                        const allowed = (
                                          MEZZI_TIPOLOGIE_BYCAT[nextCat] || []
                                        ).filter((t) => t !== "Non assegnata");
                                        if (currentTip && !allowed.includes(currentTip))
                                          setDraftField("tipologia", "");
                                      }
                                    }

                                    await refresh();
                                  }}
                                  ?disabled=${state.step2.saving}
                                >
                                  ${MEZZI_CATEGORIE.map((c) => SelectOption(c, c, c === cur))}
                                </select>
                              </div>
                            </div>
                          </div>
                        `;
                      }

                      // MEZZI: tipologia select
                      if (tab === "mezzi" && k === "tipologia") {
                        if (isCategoriaMezziNonAssegnata) {
                          return html`
                            <div style="flex: 1 1 22rem; min-width: 0;">
                              <label class="label is-small">${label}</label>
                              <div class="control">
                                <input class="input is-small" type="text" .value=${"Non assegnata"} disabled />
                              </div>
                              <p class="help is-size-7">
                                Compilata automaticamente perché la categoria è "Non assegnata".
                              </p>
                            </div>
                          `;
                        }

                        return html`
                          <div style="flex: 1 1 22rem; min-width: 0;">
                            <label class="label is-small">
                              ${label}
                              <span class="tag is-warning is-light ml-2">obbligatoria</span>
                            </label>
                            <div class="control">
                              <div class="select is-small is-fullwidth">
                                <select
                                  data-key=${tipSelectKey}
                                  @change=${(e) => setDraftFieldUI("tipologia", e.target.value)}
                                  ?disabled=${state.step2.saving}
                                >
                                  ${SelectOption("— seleziona tipologia —", "", !draftTipologiaMezzi)}
                                  ${allowedTipologieMezzi.map((t) =>
                                    SelectOption(t, t, t === draftTipologiaMezzi)
                                  )}
                                </select>
                              </div>
                            </div>
                            ${!draftTipologiaMezzi
                              ? html`<p class="help is-size-7 has-text-warning">
                                  Seleziona una tipologia per la categoria scelta.
                                </p>`
                              : null}
                          </div>
                        `;
                      }

                      // MATERIALI: categoria select
                      if (tab === "materiali" && k === "categoria") {
                        const cur = safeStr(val).trim() || "Non assegnata";
                        return html`
                          <div style="flex: 1 1 22rem; min-width: 0;">
                            <label class="label is-small">${label}</label>
                            <div class="control">
                              <div class="select is-small is-fullwidth">
                                <select
                                  data-key=${catSelectKey}
                                  @change=${async (e) => {
                                    const nextCat =
                                      safeStr(e.target.value).trim() || "Non assegnata";
                                    setDraftField("categoria", nextCat);

                                    if (nextCat === "Non assegnata") {
                                      setDraftField("tipologia", "Non assegnata");
                                    } else {
                                      const currentTip = safeStr(
                                        state.step2.draftRow?.tipologia || ""
                                      ).trim();
                                      const allowed = (
                                        MATERIALI_TIPOLOGIE_BYCAT[nextCat] || []
                                      ).filter((t) => t !== "Non assegnata");
                                      if (!currentTip || currentTip === "Non assegnata")
                                        setDraftField("tipologia", "");
                                      else if (!allowed.includes(currentTip))
                                        setDraftField("tipologia", "");
                                    }

                                    await refresh();
                                  }}
                                  ?disabled=${state.step2.saving}
                                >
                                  ${MATERIALI_CATEGORIE.map((c) =>
                                    SelectOption(c, c, c === cur)
                                  )}
                                </select>
                              </div>
                            </div>
                          </div>
                        `;
                      }

                      // MATERIALI: tipologia select
                      if (tab === "materiali" && k === "tipologia") {
                        if (isCategoriaMatNonAssegnata) {
                          return html`
                            <div style="flex: 1 1 28rem; min-width: 0;">
                              <label class="label is-small">${label}</label>
                              <div class="control">
                                <input class="input is-small" type="text" .value=${"Non assegnata"} disabled />
                              </div>
                              <p class="help is-size-7">
                                Compilata automaticamente perché la categoria è "Non assegnata".
                              </p>
                            </div>
                          `;
                        }

                        if (allowedTipologieMat.length === 0) {
                          return html`
                            <div style="flex: 1 1 28rem; min-width: 0;">
                              <label class="label is-small">${label}</label>
                              <div class="control">
                                <input class="input is-small" type="text" .value=${"—"} disabled />
                              </div>
                              <p class="help is-size-7">Nessuna tipologia disponibile per questa categoria.</p>
                            </div>
                          `;
                        }

                        return html`
                          <div style="flex: 1 1 28rem; min-width: 0;">
                            <label class="label is-small">
                              ${label}
                              <span class="tag is-warning is-light ml-2">obbligatoria</span>
                            </label>
                            <div class="control">
                              <div class="select is-small is-fullwidth">
                                <select
                                  data-key=${tipSelectKey}
                                  @change=${(e) => setDraftFieldUI("tipologia", e.target.value)}
                                  ?disabled=${state.step2.saving}
                                >
                                  ${SelectOption("— seleziona tipologia —", "", !draftTipologiaMat)}
                                  ${allowedTipologieMat.map((t) =>
                                    SelectOption(t, t, t === draftTipologiaMat)
                                  )}
                                </select>
                              </div>
                            </div>
                            ${!draftTipologiaMat
                              ? html`<p class="help is-size-7 has-text-warning">
                                  Seleziona una tipologia per la categoria scelta.
                                </p>`
                              : null}
                          </div>
                        `;
                      }

                      // MEZZI: marca (select + altro)
                      if (tab === "mezzi" && k === "marca") {
                        const current = safeStr(state.step2.draftRow?.marca || "").trim();
                        const isKnown = current && MEZZI_MARCHE.includes(current);

                        if (current && !isKnown && state.step2.ui.mezziMarcaMode !== "other") {
                          state.step2.ui.mezziMarcaMode = "other";
                          state.step2.ui.mezziMarcaOther = current;
                        }

                        const modeMarca = state.step2.ui.mezziMarcaMode || "select";
                        const selectValue =
                          modeMarca === "other" ? "__other__" : isKnown ? current : "";

                        return html`
                          <div style="flex: 1 1 18rem; min-width: 0;">
                            <label class="label is-small">${label}</label>

                            <div class="control">
                              <div class="select is-small is-fullwidth">
                                <select
                                  .value=${selectValue}
                                  @change=${async (e) => {
                                    const v = safeStr(e.target.value);
                                    if (v === "__other__") {
                                      state.step2.ui.mezziMarcaMode = "other";
                                      if (!state.step2.ui.mezziMarcaOther)
                                        state.step2.ui.mezziMarcaOther = "";
                                      setDraftField("marca", state.step2.ui.mezziMarcaOther || "");
                                      await refresh();
                                      return;
                                    }

                                    state.step2.ui.mezziMarcaMode = "select";
                                    state.step2.ui.mezziMarcaOther = "";
                                    setDraftField("marca", v);
                                    await refresh();
                                  }}
                                  ?disabled=${state.step2.saving}
                                >
                                  <option value="">— seleziona —</option>
                                  ${MEZZI_MARCHE.map((m) => html`<option value=${m}>${m}</option>`)}
                                  <option value="__other__">Altra…</option>
                                </select>
                              </div>
                            </div>

                            ${state.step1.mezziMarcheError
                              ? html`<p class="help is-size-7 has-text-danger">Errore caricamento marche</p>`
                              : null}

                            ${state.step2.ui.mezziMarcaMode === "other"
                              ? html`
                                  <div class="control mt-2">
                                    <input
                                      class="input is-small"
                                      type="text"
                                      placeholder="Inserisci marca…"
                                      .value=${safeStr(state.step2.ui.mezziMarcaOther || "")}
                                      @input=${(e) => {
                                        const v = safeStr(e.target.value);
                                        state.step2.ui.mezziMarcaOther = v;
                                        setDraftFieldUI("marca", v);
                                      }}
                                      ?disabled=${state.step2.saving}
                                    />
                                  </div>
                                  <p class="help is-size-7">
                                    Valore libero: verrà salvato come <code>marca</code>.
                                  </p>
                                `
                              : null}
                          </div>
                        `;
                      }

                      // DEFAULT: input text
                      return html`
                        <div style="flex: 1 1 18rem; min-width: 0;">
                          <label class="label is-small">
                            ${label}
                            ${isKey ? html`<span class="tag is-light ml-2">chiave</span>` : null}
                          </label>
                          <div class="control">
                            <input
                              class="input is-small"
                              type="text"
                              .value=${safeStr(val)}
                              @input=${(e) => setDraftFieldUI(k, e.target.value)}
                              ?disabled=${state.step2.saving}
                            />
                          </div>
                        </div>
                      `;
                    })}
                  </div>

                  ${state.step2.saveError
                    ? html`
                        <article class="message is-danger mt-4">
                          <div class="message-header"><p>Errore salvataggio</p></div>
                          <div class="message-body">
                            <p>${safeStr(state.step2.saveError?.message || state.step2.saveError)}</p>
                          </div>
                        </article>
                      `
                    : null}

                  <div class="buttons mt-4">
                    <button class="button" @click=${doCancel} ?disabled=${state.step2.saving}>
                      Annulla
                    </button>

                    <button
                      class="button is-primary"
                      @click=${doSave}
                      ?disabled=${state.step2.saving || !dirty}
                      title=${dirty ? "Salva" : "Nessuna modifica"}
                    >
                      <span class="icon"><i class="ri-save-line"></i></span>
                      <span>${state.step2.saving ? "Salvataggio…" : "Salva"}</span>
                    </button>
                  </div>

                  <p class="help">
                    ${dirty ? "Modifiche non salvate." : "Nessuna modifica da salvare."}
                  </p>
                </div>
              `
            : null}
        </section>
      </div>
    `;
  }

  return view();
}
