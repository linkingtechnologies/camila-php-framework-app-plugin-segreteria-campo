// ./views/resource-manager/step2.js

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
function errorText(e) {
  if (isSessionError(e)) return SESSIONE_NON_VALIDA;
  return String(e?.payload?.message || e?.message || e || "Errore sconosciuto");
}

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

  // -------------------- MEZZI / MATERIALI OPTIONS --------------------
  // I vocabolari di categoria e tipologia arrivano dalle listbox_options delle
  // colonne, non da una copia qui: vedi views/shared/vocabularies.js. Il
  // modulo tiene la cache e, se l'endpoint non risponde, il fallback.
  const { loadCatalog, loadColumns } = await import(`../shared/vocabularies.js?v=${VERSION}`);

  // db-mezzi e db-materiali, le tabelle che questa SPA scrive (vedi RM_CONFIG
  // piu' sotto), non le tabelle di evento: colonne diverse, vocabolari che
  // possono divergere.
  const [mezziCat, materialiCat] = await Promise.all([
    loadCatalog(client, "db-mezzi"),
    loadCatalog(client, "db-materiali")
  ]);

  const MEZZI_CATEGORIE = mezziCat.categories;
  const MEZZI_TIPOLOGIE_BYCAT = mezziCat.byCat;

  const MATERIALI_CATEGORIE = materialiCat.categories;
  const MATERIALI_TIPOLOGIE_BYCAT = materialiCat.byCat;


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
        // `db-materiali` has a targa column too: trailers and towed equipment
        // moved here from the vehicles table carry a plate. Without this the
        // field only showed up when editing a record that already had one.
        "targa",
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

  // Singular noun per tab, for the create form heading: the tab key is plural
  // ("materiali"), so "Nuovo materiali" would read wrong.
  const TAB_SINGOLARE = {
    volontari: "volontario",
    mezzi: "mezzo",
    materiali: "materiale",
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
    return { tab, mode, id, readOnly: isReadOnly(tab, mode) };
  }

  // Per-column configuration from the extended describe. Same cached call as
  // the vocabularies, so this costs nothing extra.
  const colMeta = {
    "db-volontari": (await loadColumns(client, "db-volontari")).columns,
    "db-mezzi": (await loadColumns(client, "db-mezzi")).columns,
    "db-materiali": (await loadColumns(client, "db-materiali")).columns,
  };

  // A field is editable only if the table allows writing AND the column is not
  // declared read only on the worktable. The two are different things: the
  // first is about who you are, the second about what the field is.
  // Fields the operator never types, although the record must carry them: the
  // organisation triplet comes from the picker shown before the form, and
  // `id-materiale` from the sequence. They are read only in the UI, and exempt
  // from the read-only strip in doSave() - dropping them would save a record
  // without its organisation or without its id.
  const UI_READONLY_FIELDS = new Set([
    "organizzazione",
    "codice-organizzazione",
    "provincia",
    "id-materiale",
  ]);

  function fieldReadOnly(tab, readOnly, col) {
    if (readOnly) return true;
    if (UI_READONLY_FIELDS.has(col)) {
      // Escape hatch: when the sequence call failed there is no id to show, so
      // the field goes back to being typable rather than blocking every
      // creation. The help text under the form says so.
      if (col === "id-materiale" && state.step2.sequenceError) return false;
      return true;
    }
    const t = RM_CONFIG[tab]?.table;
    return colMeta[t]?.[col]?.readonly === true;
  }

  // Other per-column properties the worktable declares. `required` drives both
  // the asterisk and the save guard; `maxlength` is the configured maximum,
  // which is not the physical `length` - on some columns the two differ by a
  // lot (varchar(250) configured as 2 characters).
  function fieldMeta(tab, col) {
    const t = RM_CONFIG[tab]?.table;
    return colMeta[t]?.[col] || null;
  }

  function missingRequired(tab, draft) {
    const t = RM_CONFIG[tab]?.table;
    const cols = colMeta[t] || {};
    return Object.keys(cols).filter(
      (k) => cols[k]?.required === true && safeStr((draft || {})[k]).trim() === ""
    );
  }

  // Permissions are the ones step 1 already fetched: no second call. Unknown
  // means read only, as AGENTS.md prescribes - better a form that cannot be
  // saved than one that looks editable and is refused by the backend.
  function isReadOnly(tab, mode) {
    if (state.step1?.readOnlyGlobal) return true;
    const p = state.step1?.permissionsByTab?.[tab];
    if (!p) return true;
    if (mode !== "create" && isForeignBase(tab)) return true;
    return mode === "create" ? !p.canCreate : !p.canUpdate;
  }

  // The organisation of the user's group, as step 1 reads it (state.step1.whoami, orgCatalog):
  // only for a non-administrator whose group is the code of an organisation. "" when there is none.
  function myGroupOrgCode() {
    const d = state.step1?.whoami?.data;
    if (!d || d.isAdmin) return "";
    const g = safeStr(d.group).trim().toLowerCase();
    if (!g) return "";
    const hit = (state.step1.orgCatalog || []).find((o) => safeStr(o.code).trim().toLowerCase() === g);
    return hit ? safeStr(hit.code).trim().toLowerCase() : "";
  }

  // The record being edited belongs to another organisation than the user's group (mezzi and
  // materiali only): the form opens read only. A guard of the interface, not of the API.
  function isForeignBase(tab) {
    if (tab === "volontari") return false;
    const mine = myGroupOrgCode();
    const base = state.step2.baseRow;
    if (!mine || !base) return false;
    return safeStr(base["codice-organizzazione"]).trim().toLowerCase() !== mine;
  }

  function getFields(tab, base, draft) {
    const cfg = RM_CONFIG[tab] || {};
    const explicit = cfg.fields || [];

    const set = new Set(explicit);

    const src = draft || base || {};
    for (const k of Object.keys(src)) {
      // Technical columns, same set step 1 hides from the table: `id2` is an
      // internal counter and has no business in a form.
      if (k === "id" || k === "uuid" || k === "id2") continue;
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
    // Only while this step is the current one. After a save doSave() has already
    // moved to step 1 and cleared editId/editMode, so a late refresh() would read
    // the context as "create", fetch a new id-materiale from the sequence and paint
    // an empty "new record" form over the list - which, saved, creates a duplicate.
    if (Number(state.step) !== 2) return;
    const seq = ++renderSeq;
    const tpl = await view();
    if (seq !== renderSeq || Number(state.step) !== 2) return;   // superseded, or the step changed meanwhile
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
        // A new record is born with the organisation already chosen in step 1:
        // the three fields travel together because provincia and the code are
        // derived from it and the operator cannot type them.
        const org = state.createOrg || null;
        state.step2.draftRow = org
          ? {
              "codice-organizzazione": org.code || "",
              organizzazione: org.name || "",
              provincia: org.province || "",
            }
          : {};
      }

      // in create materiali prefill id-materiale
      await ensureMaterialIdPrefill(loadedKey);
    } catch (e) {
      state.step2.error = e;
    } finally {
      state.step2.loading = false;
    }
  }

  // Handles both a plain array and the paginated {records: []} shape.
  function normalizeListResponse(res) {
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
      const provSet = new Set();
      const orgProv = {};

      for (const r of rows) {
        const code = (r?.["codice"] ?? "").toString().trim();
        const name = (r?.["denominazione"] ?? "").toString().trim();
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
      // Resolved against this module's own URL, not against the page: the
      // asset lives next to the view, so the path holds whatever plugin the
      // `views/` folder is dropped into. The `?v=` of the dynamic import is
      // not inherited - it belongs to the last segment, which gets replaced.
      const url = new URL("./assets/mezzi-marche.txt", import.meta.url);
      const res = await fetch(url, { cache: "no-store" });
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
    // A second click must not become a second write: while a save is running, and
    // in the moment after it succeeded (the form is still on screen until step 1
    // is drawn, but editId/editMode are already cleared, so the context would now
    // read "create" and the same data would be inserted as a new record).
    if (state.step2.saving || Number(state.step) !== 2) return;

    const { tab, mode, id, readOnly } = getContext();
    const cfg = RM_CONFIG[tab];
    if (!cfg) return;
    // Second guard: the disabled button is UX, this is what actually stops a
    // write the backend would refuse anyway.
    if (readOnly) return;

    // Editing a record that has no id must stop here: the write below would fall
    // through to create() and add a copy instead of changing the record.
    if (mode === "edit" && !id) {
      state.step2.saveError = { message: "Risorsa senza identificativo: salvataggio annullato, nessun dato scritto." };
      await refresh();
      return;
    }

    // Required columns, as the worktable declares them. Checked here and not
    // only in the markup: the backend refuses the write anyway, and a refusal
    // explained as "campo obbligatorio" beats a raw API error.
    const mancanti = missingRequired(tab, state.step2.draftRow);
    if (mancanti.length) {
      state.step2.saveError = {
        message:
          "Campi obbligatori non compilati: " +
          mancanti.map((k) => COL_LABELS[k] || k).join(", "),
      };
      await refresh();
      return;
    }

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
      delete payload.id2;

      // Columns the worktable declares read only are dropped from the payload:
      // the form could not change them anyway, and sending a value the backend
      // may refuse would fail the whole save for a field nobody touched.
      //
      // UI_READONLY_FIELDS are exempt: they are not typed in the form, but the
      // record needs them. A `readonly` flag on those columns means "not
      // editable on the Camila form", so dropping them here would store a
      // resource with no organisation or no id, without any error to show.
      for (const k of Object.keys(payload)) {
        if (UI_READONLY_FIELDS.has(k)) continue;
        if (fieldReadOnly(tab, false, k)) delete payload[k];
      }

      if (mode === "edit" && id) {
        await client.table(cfg.table).update(id, payload);
      } else {
        await client.table(cfg.table).create(payload);
      }

      state.master ||= { volontari: null, mezzi: null, materiali: null };
      state.master[tab] = null;

      // step 1 shows this once, above the list, until it is dismissed or the
      // operator starts something else
      state.step1.notice = savedNotice(tab, payload);

      state.editId = null;
      state.editMode = null;
      state.createOrg = null;

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
    state.createOrg = null;   // chosen per creation, never reused
    goTo(1);
  }

  // The line step 1 shows after a save: what was saved, and for whom.
  const SAVED_LABEL = { volontari: "Volontario", mezzi: "Mezzo", materiali: "Materiale" };
  function savedNotice(tab, payload) {
    const p = payload || {};
    const v = (k) => safeStr(p[k] || "").trim();
    const ident =
      tab === "volontari"
        ? [v("cognome"), v("nome")].filter(Boolean).join(" ") || v("codice-fiscale")
        : tab === "mezzi"
        ? v("targa") || v("codice-inventario") || [v("marca"), v("modello")].filter(Boolean).join(" ")
        : v("id-materiale") || [v("categoria"), v("tipologia")].filter(Boolean).join(" / ");
    const org = v("organizzazione");
    return {
      text:
        `${SAVED_LABEL[tab] || "Risorsa"} salvato` +
        (ident ? `: ${ident}` : "") +
        (org ? ` (${org})` : "") +
        ".",
    };
  }

  async function view() {
    await ensureLoaded();
    await ensureOrgCatalog();
    await ensureMezziMarche();

    const { tab, mode, id, readOnly } = getContext();
    const cfg = RM_CONFIG[tab];
    const base = state.step2.baseRow;
    const draft = state.step2.draftRow;

    const fields = getFields(tab, base, draft);
    const dirty = isDirty(base, draft);

    const singolare = TAB_SINGOLARE[tab] || tab;
    const title = mode === "edit" ? `Modifica ${singolare}` : `Nuovo ${singolare}`;
    // No subtitle while creating: there is no id yet, and a "Creazione record"
    // line would only repeat the title.
    const subtitle = mode === "edit" ? `ID: ${safeStr(id)}` : "";

    const orgCatalog = state.step1.orgCatalog || [];
    const orgMap = new Map(orgCatalog.map((o) => [o.code, o.name]));

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
    const catSelectKey = `cat||${tab}||${state.step2.loadedKey || ""}`;
    const tipSelectKey = `tip||${tab}||${categoriaMezziEff}||${categoriaMatEff}||${state.step2.loadedKey || ""}`;

    const orgCodeIsKnown = currentOrgCode && orgMap.has(currentOrgCode);

    return html`
      <div style="padding:1rem 1.25rem">
          <div class="level is-mobile">
            <div class="level-left">
              <div class="level-item">
                <div>
                  <h1 class="title is-6">${title}</h1>
                  ${subtitle ? html`<p class="subtitle is-7">${subtitle}</p>` : ""}
                </div>
              </div>
            </div>
            <div class="level-right">
              ${readOnly
                ? html`
                    <div class="level-item">
                      <span class="tag is-light" title=${isForeignBase(tab) ? "Appartiene a un'altra organizzazione: la puoi consultare, non modificare" : "Permessi insufficienti su questa scheda"}>
                        <span class="icon is-small"><i class="ri-lock-line"></i></span>
                        <span>Sola lettura</span>
                      </span>
                    </div>
                  `
                : ""}
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
                <article class="message ${isSessionError(state.step2.error) ? "is-warning" : "is-danger"}">
                  <div class="message-header"><p>Errore caricamento</p></div>
                  <div class="message-body">
                    <p>${errorText(state.step2.error)}</p>
                    ${isSessionError(state.step2.error)
                      ? html`<a class="button is-primary mt-3" href="cf_logout.php">Esci e rientra</a>`
                      : ""}
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
                  <!-- ORGANIZZAZIONE: mostrata, mai modificabile -->
                  <div class="is-flex is-flex-wrap-wrap" style="gap: .75rem;">
                    <div style="flex: 1 1 28rem; min-width: 0;">
                      <label class="label is-small">
                        Organizzazione
                        <span class="icon is-small has-text-grey" title="Non modificabile"
                          ><i class="ri-lock-line"></i
                        ></span>
                      </label>
                      <div class="control">
                        <input
                          class="input is-small"
                          type="text"
                          .value=${currentOrgName
                            ? `${currentOrgName}${currentOrgCode ? ` — ${currentOrgCode}` : ""}`
                            : currentOrgCode || "—"}
                          disabled
                        />
                      </div>

                      <p class="help is-size-7">
                        Codice:
                        <span class="has-text-weight-semibold">${currentOrgCode || "—"}</span>
                      </p>

                      ${currentOrgCode && !orgCodeIsKnown
                        ? html`<p class="help is-size-7 has-text-warning">
                            Codice non presente in anagrafica organizzazioni.
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

                      const roK = fieldReadOnly(tab, readOnly, k);
                      const metaK = fieldMeta(tab, k);
                      const label = COL_LABELS[k] || k;
                      // Attribute, not the `.maxLength` property: assigning -1 to
                      // the property throws IndexSizeError, while an empty
                      // attribute is an invalid value the browser ignores -
                      // which is exactly "no limit".
                      const maxK = Number(metaK?.maxlength) || null;
                      const val = draftAfter ? draftAfter[k] : "";
                      const isKey = cfg?.keyLabel === k;

                      // PROPRIETARIO: chi possiede la risorsa, che non e'
                      // necessariamente chi la porta in campo. Elenca le
                      // denominazioni di `db-organizzazioni`, perche' i valori
                      // storici sono denominazioni e non codici.
                      if (k === "proprietario") {
                        const cur = safeStr(val).trim();
                        const nomi = [...new Set(orgCatalog.map((o) => safeStr(o.name).trim()))]
                          .filter(Boolean)
                          .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
                        const fuoriElenco = cur && !nomi.includes(cur);

                        return html`
                          <div style="flex: 1 1 18rem; min-width: 0;">
                            <label class="label is-small">
                              ${label}
                              ${metaK?.required
                                ? html`<span class="has-text-danger" title="Obbligatorio">*</span>`
                                : null}
                            </label>
                            <div class="control">
                              <div class="select is-small is-fullwidth">
                                <select
                                  @change=${(e) => setDraftFieldUI(k, e.target.value)}
                                  ?disabled=${state.step2.saving || roK}
                                >
                                  <option value="" ?selected=${!cur}>— nessuno —</option>
                                  ${fuoriElenco
                                    ? html`<option value=${cur} ?selected=${true}>
                                        ${cur} (fuori elenco)
                                      </option>`
                                    : null}
                                  ${nomi.map(
                                    (n) => html`<option value=${n} ?selected=${n === cur}>${n}</option>`
                                  )}
                                </select>
                              </div>
                            </div>
                            ${fuoriElenco
                              ? html`<p class="help is-size-7 has-text-warning">
                                  Non presente in anagrafica organizzazioni.
                                </p>`
                              : null}
                          </div>
                        `;
                      }

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
                                ?disabled=${state.step2.saving || roK}
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
                                  ?disabled=${state.step2.saving || roK}
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
                                  ?disabled=${state.step2.saving || roK}
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
                                  ?disabled=${state.step2.saving || roK}
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
                                  ?disabled=${state.step2.saving || roK}
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
                                  ?disabled=${state.step2.saving || roK}
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
                                      ?disabled=${state.step2.saving || roK}
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
                            ${metaK?.required
                              ? html`<span class="has-text-danger" title="Obbligatorio">*</span>`
                              : null}
                            ${isKey ? html`<span class="tag is-light ml-2">chiave</span>` : null}
                            ${!readOnly && roK
                              ? html`<span class="icon is-small has-text-grey" title="Campo di sola lettura"
                                       ><i class="ri-lock-line"></i></span>`
                              : null}
                          </label>
                          <div class="control">
                            <input
                              class="input is-small"
                              type="text"
                              maxlength=${maxK || ""}
                              .value=${safeStr(val)}
                              @input=${(e) => setDraftFieldUI(k, e.target.value)}
                              ?disabled=${state.step2.saving || roK}
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
                      ?disabled=${state.step2.saving || readOnly || !dirty}
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
      </div>
    `;
  }

  return view();
}
