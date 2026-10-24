// Moduli condivisi: import dinamico con la versione in coda. Un `import`
// statico non porta la query string, quindi resta in cache e le modifiche non
// si vedono piu'. Vedi AGENTS.md §Module loading.
const VERSION = window.APP_CONFIG?.version || Date.now();

// views/intervention-manager/index.js — Gestione interventi
// Lavora sulla tabella `servizi`, sui soli record con intervento = "SI".
// Il catalogo dei servizi (ordine, colore, lettera, mappa) resta a service-manager.

const TABLE = "servizi";
const BROG_TABLE = "brogliaccio";
const ANAGRAFICA_TABLE = "db-volontari";
const RICH_TABLE = "richieste";
const SQUADRE_TABLE = "squadre-dichiarate";
const MOV_TABLE = "mov-risorse";

// Vocabolari presi dalle listbox_options delle colonne di `richieste`.
// Su quella tabella Data, Richiedente, Richiesta, Tipo, Priorita' e Stato sono
// tutti obbligatori: il form li chiede tutti.
const RICH_TIPI = ["Interna", "Esterna"];
const RICH_PRIORITA = ["1 - Urgente", "2 - Alta", "3 - Normale", "4 - Bassa", "5 - Molto bassa"];
const RICH_STATI = [
  "A - Presa in carico", "B - In valutazione", "C1 - In lavorazione",
  "C2 - In attesa di lavorazione", "D1 - Eseguita", "D2 - Respinta"
];
const RICH_STATO_COLOR = {
  "A - Presa in carico": "#6366f1", "B - In valutazione": "#f59e0b",
  "C1 - In lavorazione": "#10b981", "C2 - In attesa di lavorazione": "#8b5cf6",
  "D1 - Eseguita": "#22c55e", "D2 - Respinta": "#ef4444"
};

// Nomi campo esattamente come in tabella. Attenzione: `data/ora-sopralluogo`
// usa la barra, `data-ora-segnalazione` no. Non e' un refuso.
const FIELDS = [
  "id", "nome", "descrizione", "intervento",
  "stato", "data-ora-segnalazione", "riferimento-vvf",
  "nome-segnalante", "qualifica-segnalante",
  "indirizzo-segnalante", "telefono-segnalante",
  "cognome-referente", "nome-referente", "telefono-referente",
  "indirizzo", "comune", "provincia",
  "data/ora-sopralluogo", "inizio", "fine",
  "squadre-attivate", "operatori-a-supporto", "note",
  // campi di catalogo: alimentano la mappa e l'ordinamento, condivisi con
  // service-manager (vedi specs/service-manager/design.md §Divisione dei ruoli)
  "ordine", "lettera", "colore", "latitudine", "longitudine"
];

// Vocabolari identici a quelli di service-manager: due elenchi divergenti
// darebbero due verita' diverse sulla stessa tabella.
const COLORI = ["rosso","nero","blu","verde","grigio","arancione","viola","bianco","giallo"];

const COLOR_MAP = {
  rosso: "#e53e3e", nero: "#1a202c", blu: "#3182ce", verde: "#38a169",
  grigio: "#718096", arancione: "#dd6b20", viola: "#805ad5",
  bianco: "#edf2f7", giallo: "#d69e2e"
};

const LETTERE = [
  "",
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."123456789",
  ...["!", "#", "$", "%", "&", "+", "-", "=", "@"]
];

// Campi scrivibili dalla scheda (esclude id e intervento, gestiti a parte).
const EDITABLE = FIELDS.filter(f => f !== "id" && f !== "intervento");

// Vocabolario definito nella colonna stessa (string-listofvalues):
// listbox_options = ",Segnalato,In corso,Concluso"
const STATI = ["Segnalato", "In corso", "Concluso"];

const STATO_COLOR = {
  "Segnalato": "#888780",
  "In corso":  "#BA7517",
  "Concluso":  "#3B6D11"
};

/* ==========================
   Utils
========================== */

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function normalizeApiError(err) {
  const raw = err?.payload ?? err?.response ?? err;

  const status = raw?.status ?? raw?.statusCode ?? err?.status ?? err?.statusCode;
  const code = raw?.code ?? err?.code ?? raw?.error?.code;
  const message =
    raw?.message ?? err?.message ?? raw?.error?.message ??
    (typeof raw === "string" ? raw : "Errore sconosciuto");

  let kind = "unknown";
  if (status === 401 || status === 403) kind = "auth";
  else if (status === 404) kind = "not_found";
  else if (status === 429) kind = "rate_limit";
  else if (status >= 500) kind = "server";
  else if (code === "ETIMEDOUT" || code === "ECONNABORTED") kind = "timeout";
  else if (code === "ENETUNREACH" || code === "ECONNRESET") kind = "network";

  return { status, code, message, kind, raw };
}

function userFriendlyErrorText(e) {
  switch (e.kind) {
    case "auth":       return "Sessione scaduta o permessi insufficienti.";
    case "rate_limit": return "Troppe richieste. Attendi e riprova.";
    case "timeout":
    case "network":    return "Problema di connessione. Controlla la rete.";
    case "server":     return "Il server sta avendo problemi. Riprova tra poco.";
    case "not_found":  return "Risorsa non trovata.";
    default:           return "Si è verificato un errore durante il caricamento.";
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function shouldRetry(e) {
  return ["network", "timeout", "server", "rate_limit"].includes(e.kind);
}

async function withRetry(fn, { retries = 2, baseDelay = 400 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = normalizeApiError(err);
      if (attempt === retries || !shouldRetry(last)) throw last;
      await sleep(baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 150));
    }
  }
  throw last;
}

/* --- date: tabella "YYYY-MM-DD HH:MM:SS" <-> input "YYYY-MM-DDTHH:MM" --- */

function toInput(dbVal) {
  const s = norm(dbVal);
  if (!s) return "";
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(s);
  return m ? `${m[1]}T${m[2]}` : "";
}

function toDb(inputVal) {
  const s = norm(inputVal);
  if (!s) return "";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(s);
  return m ? `${m[1]} ${m[2]}:00` : "";
}

function nowForInput() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(dbVal) {
  const s = norm(dbVal);
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : "";
}

// Dedotto da inizio/fine, usato finche' l'operatore non sceglie uno stato
// esplicito: i record esistenti hanno tutti `stato` vuoto.
function statoDerivato(r) {
  if (!norm(r.inizio)) return "Segnalato";
  if (!norm(r.fine)) return "In corso";
  return "Concluso";
}

function statoOf(r) {
  return norm(r.stato) || statoDerivato(r);
}

function statoColor(v) {
  return STATO_COLOR[v] || "#888780";
}

function splitSquadre(v) {
  return norm(v).split(",").map(x => norm(x)).filter(Boolean);
}

function emptyForm() {
  const f = {};
  for (const k of EDITABLE) f[k] = "";
  return f;
}

function formFrom(record) {
  const f = {};
  for (const k of EDITABLE) f[k] = norm(record[k]);
  return f;
}

function serialize(f) {
  return JSON.stringify(EDITABLE.map(k => [k, norm(f[k])]));
}


/* ==========================
   View
========================== */

export async function InterventionManager({ client, html, render, root }) {
  const [{ createMapPicker, MAP_PICKER_CSS }, { createOrgPicker }] =
    await Promise.all([
      import(`../shared/map-picker.js?v=${VERSION}`),
      import(`../shared/org-picker.js?v=${VERSION}`)
    ]);

  const API = client.table(TABLE);

  let records = [];
  let allNames = [];          // nomi di TUTTI i servizi, per il controllo duplicati
  let loading = false;
  let error = null;
  let retrying = false;

  let search = "";
  let filtroStato = "";
  // La kanban e' la vista d'ingresso: in evento interessa prima lo stato
  // degli interventi, la scheda si apre da li' con un clic.
  let vista = "kanban";        // "kanban" | "elenco"
  let dragId = null;
  let dropTarget = null;

  let selected = null;
  let form = emptyForm();
  let baseForm = emptyForm();
  let formBusy = false;

  // creazione rapida: pochi campi in popup, il resto si compila nella scheda
  // una volta creato il record
  let createDraft = null;   // null = popup chiusa
  let createBusy = false;
  let createError = null;
  let formError = null;
  let formSuccess = null;

  let perms = { canCreate: false, canUpdate: false, canDelete: false };

  let deleteConfirm = false;
  let deleteBusy = false;
  let deleteUsage = null;
  let deleteBlocked = false;

  // Due cataloghi distinti: il cartaceo sotto "SQUADRE ATTIVATE" elenca
  // organizzazioni (G.C. DOVERA, O.V. GERUNDO), ma puo' servire anche il
  // raggruppamento interno (SQUADRA 2, RIBALTABILE 1). Restano separati
  // perche' sono due cose diverse, non un unico elenco.
  let organizzazioni = [];
  // due elenchi distinti, perche' sono due cose diverse: le etichette di
  // raggruppamento sulle risorse gia' registrate, e le squadre dichiarate
  // (conteggi senza nominativi)
  let squadreDaRisorse = [];
  let squadreDichiarate = [];
  // nome squadra -> organizzazioni, serve come `gruppo` sul movimento
  const orgDiSquadra = {};

  // note brogliaccio agganciate all'intervento tramite il campo `servizio`
  let brogRecords = [];
  let brogLoading = false;
  let brogError = null;
  let brogText = "";
  let brogBusy = false;
  let brogCanCreate = false;

  let cancelled = false;

  // anagrafica volontari per la scelta del referente: 766 record, caricati
  // una volta sola e solo alla prima apertura del popup
  let refOpen = false;
  let refQuery = "";
  let refRows = [];
  let refLoaded = false;
  let refLoading = false;
  let refError = null;

  async function openRefPicker() {
    refOpen = true;
    refQuery = [norm(form["cognome-referente"]), norm(form["nome-referente"])]
      .filter(Boolean).join(" ");
    rerender();
    if (refLoaded || refLoading) return;
    refLoading = true;
    refError = null;
    rerender();
    try {
      const res = await withRetry(() => client.table(ANAGRAFICA_TABLE).list({
        include: ["id", "cognome", "nome", "cellulare", "organizzazione", "provincia"],
        size: 5000
      }));
      refRows = getRecords(res);
      refLoaded = true;
    } catch (e) {
      refError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      refLoading = false;
      if (!cancelled) rerender();
    }
  }

  function closeRefPicker() {
    refOpen = false;
    rerender();
  }

  function pickReferente(r) {
    form["cognome-referente"] = norm(r.cognome);
    form["nome-referente"] = norm(r.nome);
    form["telefono-referente"] = norm(r.cellulare);   // in anagrafica il campo e' `cellulare`
    refOpen = false;
    formSuccess = null;
    rerender();
  }

  function refFiltered() {
    const q = norm(refQuery).toLocaleLowerCase("it-IT");
    if (!q) return refRows.slice(0, 50);
    const parts = q.split(" ").filter(Boolean);
    return refRows.filter(r => {
      const hay = [r.cognome, r.nome, r.organizzazione, r.provincia]
        .map(norm).join(" ").toLocaleLowerCase("it-IT");
      return parts.every(x => hay.includes(x));
    }).slice(0, 50);
  }

  // creazione rapida di una squadra, senza uscire dall'intervento.
  // La gestione completa resta in team-manager.
  let sqDraft = null;
  let sqBusy = false;
  let sqError = null;
  let sqCanCreate = false;

  function apriNuovaSquadra() {
    sqDraft = { nome: "", organizzazioni: "", "n-volontari": "", "n-mezzi": "" };
    sqError = null;
    orgPicker.load();     // pigro: solo alla prima apertura
    rerender();
  }

  function chiudiNuovaSquadra() {
    sqDraft = null;
    sqError = null;
    rerender();
  }

  async function salvaNuovaSquadra() {
    if (!sqDraft) return;
    const nome = norm(sqDraft.nome);
    if (!nome) {
      sqError = "Il nome della squadra è obbligatorio.";
      rerender();
      return;
    }
    if (squadreDichiarate.includes(nome) || squadreDaRisorse.includes(nome)) {
      sqError = "Esiste già una squadra con questo nome: selezionala dall'elenco.";
      rerender();
      return;
    }

    sqBusy = true;
    sqError = null;
    rerender();

    try {
      await client.table(SQUADRE_TABLE).create({
        nome,
        organizzazioni: norm(sqDraft.organizzazioni) || null,
        "n-volontari": parseInt(sqDraft["n-volontari"], 10) || null,
        "n-mezzi": parseInt(sqDraft["n-mezzi"], 10) || null
      });

      // entra subito nel catalogo e fra le squadre attivate dell'intervento
      if (!squadreDichiarate.includes(nome)) {
        squadreDichiarate = [...squadreDichiarate, nome]
          .sort((a, b) => a.localeCompare(b, "it"));
      }
      const attive = splitSquadre(form["squadre-attivate"]);
      if (!attive.includes(nome)) {
        form["squadre-attivate"] = [...attive, nome].join(", ");
      }
      sqDraft = null;
    } catch (e) {
      sqError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      sqBusy = false;
      if (!cancelled) rerender();
    }
  }

  // richieste legate all'intervento tramite il campo `servizio`
  let richRecords = [];
  let richLoading = false;
  let richError = null;
  let richBusy = false;
  let richCanCreate = false;
  let richDraft = null;      // null = form chiuso

  function nuovaRichiesta() {
    const oggi = new Date();
    const pad = n => String(n).padStart(2, "0");
    richDraft = {
      data: `${oggi.getFullYear()}-${pad(oggi.getMonth() + 1)}-${pad(oggi.getDate())}`,
      richiedente: "",
      richiesta: "",
      "tipo-richiesta": RICH_TIPI[0],
      priorita: RICH_PRIORITA[2],
      stato: RICH_STATI[0],
      "assegnatario-richiesta": "",
      note: ""
    };
    richError = null;
    rerender();
  }

  async function loadRichieste() {
    const nome = norm(selected?.nome);
    richRecords = [];
    richError = null;
    if (!nome) return;
    richLoading = true;
    rerender();
    try {
      const res = await client.table(RICH_TABLE).list({
        include: ["id", "data", "richiedente", "richiesta", "tipo-richiesta",
                  "priorita", "assegnatario-richiesta", "stato", "servizio", "note"],
        filters: [client.filter("servizio", "eq", nome)],
        size: 500
      });
      richRecords = getRecords(res);
    } catch (e) {
      richError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      richLoading = false;
      if (!cancelled) rerender();
    }
  }

  async function salvaRichiesta() {
    const nome = norm(selected?.nome);
    if (!nome || !richDraft) return;
    if (!norm(richDraft.richiedente) || !norm(richDraft.richiesta)) {
      richError = "Richiedente e richiesta sono obbligatori.";
      rerender();
      return;
    }
    richBusy = true;
    richError = null;
    rerender();
    try {
      await client.table(RICH_TABLE).create({
        data: richDraft.data,
        richiedente: norm(richDraft.richiedente),
        richiesta: norm(richDraft.richiesta),
        "tipo-richiesta": richDraft["tipo-richiesta"],
        priorita: richDraft.priorita,
        stato: richDraft.stato,
        "assegnatario-richiesta": norm(richDraft["assegnatario-richiesta"]) || null,
        note: norm(richDraft.note) || null,
        servizio: nome
      });
      richDraft = null;
      await loadRichieste();
    } catch (e) {
      richError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      richBusy = false;
      if (!cancelled) rerender();
    }
  }

  // selettore organizzazioni per la creazione rapida di una squadra
  const orgPicker = createOrgPicker({ client, html, rerender: () => rerender() });

  const mapPicker = createMapPicker({
    html,
    rerender: () => rerender(),
    onConfirm: pos => {
      // il comune restituito dal geocoding non sovrascrive un valore gia' inserito
      // a mano se il reverse non lo ha trovato
      form.latitudine = String(pos.lat);
      form.longitudine = String(pos.lon);
      if (pos.comune) form.comune = pos.comune;
      if (pos.provincia) form.provincia = pos.provincia;
      if (pos.indirizzo) form.indirizzo = pos.indirizzo;
      formSuccess = null;
      rerender();
    }
  });

  function openMapPicker() {
    mapPicker.open({
      lat: parseFloat(form.latitudine),
      lon: parseFloat(form.longitudine),
      query: [norm(form.indirizzo), norm(form.comune), norm(form.provincia)]
        .filter(Boolean).join(", ")
    });
  }

  /* ---- caricamento ---- */

  async function loadPerms() {
    try {
      const res = await API.permissions();
      const can = res?.can || {};
      perms = {
        canCreate: !!can.create,
        canUpdate: !!can.update,
        canDelete: !!can.delete
      };
    } catch {
      // AGENTS.md: permessi non recuperabili -> sola lettura
      perms = { canCreate: false, canUpdate: false, canDelete: false };
    }
    // il brogliaccio ha permessi propri: puo' essere scrivibile anche quando
    // `servizi` non lo e', e viceversa
    try {
      const res = await client.table(BROG_TABLE).permissions();
      brogCanCreate = !!(res?.can?.create);
    } catch {
      brogCanCreate = false;
    }
    try {
      const res = await client.table(RICH_TABLE).permissions();
      richCanCreate = !!(res?.can?.create);
    } catch {
      richCanCreate = false;
    }
    try {
      const res = await client.table(SQUADRE_TABLE).permissions();
      sqCanCreate = !!(res?.can?.create);
    } catch {
      sqCanCreate = false;    // tabella assente o permessi non leggibili
    }
  }

  async function loadBrogliaccio() {
    const nome = norm(selected?.nome);
    brogRecords = [];
    brogError = null;
    if (!nome) return;
    brogLoading = true;
    rerender();
    try {
      const res = await client.table(BROG_TABLE).list({
        include: ["id", "data/ora", "servizio", "descrizione"],
        filters: [client.filter("servizio", "eq", nome)],
        order: [["data/ora", "desc"]],
        size: 500
      });
      brogRecords = getRecords(res);
    } catch (e) {
      brogError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      brogLoading = false;
      if (!cancelled) rerender();
    }
  }

  async function addBrogNote() {
    const nome = norm(selected?.nome);
    const testo = norm(brogText);
    if (!nome) return;
    if (!testo) {
      brogError = "Scrivi il testo della nota prima di annotarla.";
      rerender();
      return;
    }
    brogBusy = true;
    brogError = null;
    rerender();
    try {
      // `data/ora` e `descrizione` sono obbligatori in tabella
      await client.table(BROG_TABLE).create({
        "data/ora": toDb(nowForInput()),
        servizio: nome,
        descrizione: testo
      });
      brogText = "";
      await loadBrogliaccio();
    } catch (e) {
      brogError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      brogBusy = false;
      if (!cancelled) rerender();
    }
  }

  async function loadCataloghi() {
    const pick = async (table, col) => {
      const res = await client.table(table).list({ include: [col], size: 5000 });
      return getRecords(res).map(r => norm(r[col])).filter(Boolean);
    };
    const results = await Promise.allSettled([
      pick("volontari", "organizzazione"),
      pick("mezzi", "organizzazione"),
      pick("materiali", "organizzazione"),
      pick("volontari", "squadra"),
      pick("mezzi", "squadra"),
      pick("materiali", "squadra"),
      // squadre dichiarate: se la tabella non esiste ancora,
      // allSettled lascia passare il resto
      (async () => {
        const res = await client.table(SQUADRE_TABLE).list({
          include: ["nome", "organizzazioni"], size: 2000
        });
        const righe = getRecords(res);
        for (const r of righe) {
          const n = norm(r.nome);
          if (n) orgDiSquadra[n] = norm(r.organizzazioni);
        }
        return righe.map(r => norm(r.nome)).filter(Boolean);
      })()
    ]);
    const collect = idx => {
      const set = new Set();
      for (const i of idx) {
        if (results[i].status === "fulfilled") for (const v of results[i].value) set.add(v);
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b, "it"));
    };
    organizzazioni = collect([0, 1, 2]);
    squadreDaRisorse = collect([3, 4, 5]);
    squadreDichiarate = collect([6]);
  }

  async function load() {
    loading = true;
    error = null;
    retrying = false;
    rerender();

    try {
      const results = await Promise.allSettled([
        withRetry(() => API.list({
          include: FIELDS,
          filters: [client.filter("intervento", "eq", "SI")],
          size: 2000
        })),
        withRetry(() => API.list({ include: ["id", "nome"], size: 2000 })),
        loadCataloghi()
      ]);

      if (results[0].status === "fulfilled") {
        const rows = getRecords(results[0].value);
        // ordinamento client-side: il campo puo' essere vuoto sui record vecchi,
        // quindi sort stabile con indice originale come tiebreaker
        records = rows
          .map((r, i) => ({ r, i }))
          .sort((a, b) => {
            const da = norm(a.r["data-ora-segnalazione"]);
            const db = norm(b.r["data-ora-segnalazione"]);
            if (da && db && da !== db) return db.localeCompare(da);
            if (da && !db) return -1;
            if (!da && db) return 1;
            return a.i - b.i;
          })
          .map(x => x.r);
      } else {
        error = normalizeApiError(results[0].reason);
      }

      if (results[1].status === "fulfilled") {
        allNames = getRecords(results[1].value)
          .map(r => ({ id: r.id, nome: norm(r.nome) }))
          .filter(x => x.nome);
      }
    } catch (e) {
      error = normalizeApiError(e);
    } finally {
      loading = false;
      if (!cancelled) rerender();
    }
  }

  /* ---- selezione e bozza ---- */

  function isDirty() {
    return serialize(form) !== serialize(baseForm);
  }

  function resetFormState() {
    formError = null;
    formSuccess = null;
    deleteConfirm = false;
    deleteUsage = null;
    deleteBlocked = false;
  }

  function apriCreazione() {
    createDraft = {
      nome: "",
      descrizione: "",
      "data-ora-segnalazione": toDb(nowForInput()),
      comune: "",
      provincia: ""
    };
    createError = null;
    rerender();
  }

  function chiudiCreazione() {
    createDraft = null;
    createError = null;
    rerender();
  }

  async function salvaNuovo() {
    if (!createDraft) return;
    const nome = norm(createDraft.nome);
    if (!nome) {
      createError = "Il nome dell'intervento è obbligatorio: le risorse vi fanno riferimento per nome.";
      rerender();
      return;
    }
    if (allNames.some(x => x.nome.toLowerCase() === nome.toLowerCase())) {
      const ok = confirm(
        "Esiste già un servizio con questo nome. Due servizi omonimi rendono " +
        "ambigua l'assegnazione delle risorse. Procedere comunque?");
      if (!ok) return;
    }

    createBusy = true;
    createError = null;
    rerender();

    try {
      const payload = {};
      for (const k of EDITABLE) payload[k] = null;
      for (const [k, v] of Object.entries(createDraft)) payload[k] = norm(v) || null;
      payload.intervento = "SI";      // senza questo non rientra nel filtro della SPA

      await API.create(payload);
      createDraft = null;
      await load();
      if (cancelled) return;

      // apre subito la scheda completa sul record appena creato
      const nuovo = records.find(r => norm(r.nome) === nome);
      if (nuovo) selectRecord(nuovo);
    } catch (e) {
      createError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      createBusy = false;
      if (!cancelled) rerender();
    }
  }

  function selectRecord(r) {
    if (selected?.id === r.id) return;
    if (isDirty() && !confirm("Ci sono modifiche non salvate. Scartarle?")) return;
    selected = r;
    form = formFrom(r);
    baseForm = formFrom(r);
    resetFormState();
    brogText = "";
    rerender();
    loadBrogliaccio();
    loadRichieste();
  }

  function setField(key, value) {
    form[key] = value;
    formSuccess = null;
    rerender();
  }

  function toggleSquadra(nome) {
    const cur = splitSquadre(form["squadre-attivate"]);
    const i = cur.indexOf(nome);
    if (i >= 0) cur.splice(i, 1);
    else cur.push(nome);
    setField("squadre-attivate", cur.join(", "));
  }

  /* ---- salvataggio ---- */

  function nomeDuplicato() {
    const n = norm(form.nome).toLowerCase();
    if (!n) return false;
    return allNames.some(x =>
      x.nome.toLowerCase() === n && x.id !== (selected?.id ?? null));
  }

  async function save() {
    formError = null;
    formSuccess = null;

    if (!norm(form.nome)) {
      formError = "Il nome dell'intervento è obbligatorio: le risorse vi fanno riferimento per nome.";
      rerender();
      return;
    }

    if (norm(form.nome) !== norm(baseForm.nome)) {
      const ok = confirm(
        "Stai rinominando l'intervento. Le risorse già assegnate e le note di " +
        "brogliaccio continueranno a puntare al nome precedente e non verranno " +
        "aggiornate. Procedere?");
      if (!ok) return;
    }

    if (nomeDuplicato()) {
      const ok = confirm(
        "Esiste già un servizio con questo nome. Due servizi omonimi rendono " +
        "ambigua l'assegnazione delle risorse. Procedere comunque?");
      if (!ok) return;
    }

    formBusy = true;
    rerender();

    try {
      // `null` e non stringa vuota: e' cio' che azzera davvero il valore, ed e'
      // la forma che usa gia' service-manager sulla stessa tabella
      const payload = {};
      for (const k of EDITABLE) payload[k] = norm(form[k]) || null;
      if (payload.ordine !== null) payload.ordine = parseInt(payload.ordine, 10) || null;

      // la creazione avviene solo dalla popup: qui si aggiorna e basta
      const squadrePrima = baseForm["squadre-attivate"];
      await API.update(selected.id, payload);
      formSuccess = "Modifiche salvate.";
      await registraAttivazioni(norm(form.nome), squadrePrima, form["squadre-attivate"]);

      const nomeSalvato = norm(form.nome);
      await load();
      if (cancelled) return;

      // mantiene selezionata la scheda appena salvata
      const again = records.find(r => norm(r.nome) === nomeSalvato);
      if (again) {
        selected = again;
        form = formFrom(again);
        baseForm = formFrom(again);
        loadBrogliaccio();
        loadRichieste();
      }
    } catch (e) {
      formError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      formBusy = false;
      if (!cancelled) rerender();
    }
  }

  /* ---- movimentazione: fotografia datata dell'attivazione ---- */

  // `mov-risorse` conserva nomi, non id: e' un registro storico, non un
  // collegamento. Per questo la riga porta anche le organizzazioni della
  // squadra com'erano al momento dell'attivazione.
  async function registraAttivazioni(nomeIntervento, prima, dopo) {
    const nuove = splitSquadre(dopo).filter(n => !splitSquadre(prima).includes(n));
    if (nuove.length === 0) return;

    const quando = toDb(nowForInput());
    for (const nome of nuove) {
      try {
        await client.table(MOV_TABLE).create({
          "data/ora": quando,
          gruppo: orgDiSquadra[nome] || "",
          risorsa: nome,
          "tipo-risorsa": "SQUADRA DICHIARATA",
          da: "",
          a: nomeIntervento
        });
      } catch (e) {
        // il movimento e' tracciatura, non deve far fallire il salvataggio
        formError = "Intervento salvato, ma la movimentazione di « " + nome +
                    " » non e' stata registrata: " + userFriendlyErrorText(normalizeApiError(e));
      }
    }
  }

  /* ---- eliminazione ---- */

  async function checkDeleteUsage() {
    deleteUsage = { checking: true };
    rerender();
    const nome = norm(selected?.nome);
    if (!nome) {
      deleteUsage = { v: 0, m: 0, mat: 0 };
      deleteBlocked = false;
      rerender();
      return;
    }
    try {
      const count = async table => {
        const res = await client.table(table).list({
          include: ["id"],
          filters: [client.filter("servizio", "eq", nome)],
          size: 2000
        });
        return getRecords(res).length;
      };
      const [v, m, mat] = await Promise.all([
        count("volontari"), count("mezzi"), count("materiali")
      ]);
      deleteUsage = { v, m, mat };
      deleteBlocked = (v + m + mat) > 0;
    } catch {
      // in dubbio non si cancella
      deleteUsage = { v: 0, m: 0, mat: 0 };
      deleteBlocked = true;
      formError = "Impossibile verificare se l'intervento è in uso. Eliminazione bloccata per sicurezza.";
    }
    if (!cancelled) rerender();
  }

  async function del() {
    if (!selected) return;
    deleteBusy = true;
    rerender();
    try {
      await API.remove(selected.id);
      selected = null;
      form = emptyForm();
      baseForm = emptyForm();
      resetFormState();
      await load();
    } catch (e) {
      formError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      deleteBusy = false;
      if (!cancelled) rerender();
    }
  }

  /* ---- kanban: spostamento fra colonne ---- */

  async function moveCard(id, nuovoStato) {
    const rec = records.find(r => r.id === id);
    if (!rec || statoOf(rec) === nuovoStato) return;

    const precedente = rec.stato;
    rec.stato = nuovoStato;          // aggiornamento ottimistico
    if (selected?.id === id) {
      form.stato = nuovoStato;
      baseForm.stato = nuovoStato;
    }
    rerender();

    try {
      await API.update(id, { stato: nuovoStato });
    } catch (e) {
      rec.stato = precedente;        // ripristino e ricarica: lo stato vero e' sul server
      error = normalizeApiError(e);
      await load();
    }
  }

  /* ---- filtri ---- */

  function filtered() {
    const q = search ? search.toLocaleLowerCase("it-IT") : "";
    return records.filter(r => {
      if (filtroStato && statoOf(r) !== filtroStato) return false;
      if (!q) return true;
      const hay = [
        r.nome, r.descrizione, r.comune, r.indirizzo,
        r["nome-segnalante"], r["riferimento-vvf"], r["squadre-attivate"]
      ].map(norm).join(" ").toLocaleLowerCase("it-IT");
      return hay.includes(q);
    });
  }

  /* ==========================
     Template
  ========================== */

  const readOnly = () => !perms.canUpdate;

  function field(label, key, { type = "text", width = "" } = {}) {
    const isDate = type === "datetime-local";
    return html`
      <div class="field" style=${width ? `width:${width}` : ""}>
        <label class="label is-small mb-1">${label}</label>
        <div class="control">
          <input
            class="input is-small"
            type=${type}
            .value=${isDate ? toInput(form[key]) : (form[key] || "")}
            ?disabled=${formBusy || readOnly()}
            @input=${e => setField(key, isDate ? toDb(e.target.value) : e.target.value)}
          />
        </div>
      </div>
    `;
  }

  function block(title, icon, body) {
    return html`
      <div class="mb-4">
        <p class="is-size-7 has-text-weight-semibold has-text-grey mb-2"
           style="text-transform:uppercase;letter-spacing:.04em">
          <span class="icon is-small"><i class="ri-${icon}"></i></span>
          ${title}
        </p>
        ${body}
      </div>
    `;
  }

  function viewSquadre() {
    const attive = splitSquadre(form["squadre-attivate"]);
    const inCatalogo = new Set([...organizzazioni, ...squadreDichiarate, ...squadreDaRisorse]);
    // AGENTS.md: un valore non piu' in catalogo resta visibile, non si scarta
    const fuoriLista = attive.filter(s => !inCatalogo.has(s));

    const gruppo = (titolo, voci) => voci.length === 0 ? "" : html`
      <p class="is-size-7 has-text-grey mt-1 mb-1">${titolo}</p>
      ${voci.map(s => html`
        <label class="checkbox is-size-7" style="display:block;margin-bottom:.2rem">
          <input type="checkbox"
            .checked=${attive.includes(s)}
            ?disabled=${formBusy || readOnly()}
            @change=${() => toggleSquadra(s)} />
          ${s}
        </label>
      `)}
    `;

    if (organizzazioni.length === 0 && squadreDichiarate.length === 0
        && squadreDaRisorse.length === 0 && fuoriLista.length === 0) {
      return html`<p class="help">Nessuna organizzazione o squadra registrata sulle risorse.</p>`;
    }

    return html`
      <div style="max-height:190px;overflow:auto;border:1px solid #dbdbdb;border-radius:4px;padding:.5rem">
        ${gruppo("Organizzazioni", organizzazioni)}
        ${gruppo("Squadre dichiarate", squadreDichiarate)}
        ${gruppo("Squadre dalle risorse", squadreDaRisorse)}
        ${fuoriLista.length ? html`
          <p class="is-size-7 has-text-grey mt-1 mb-1">Non piu' in elenco</p>
          ${fuoriLista.map(s => html`
            <label class="checkbox is-size-7" style="display:block;margin-bottom:.2rem">
              <input type="checkbox" .checked=${true}
                ?disabled=${formBusy || readOnly()}
                @change=${() => toggleSquadra(s)} />
              ${s}
              <span class="tag is-warning is-light ml-1" style="font-size:.6rem">fuori lista</span>
            </label>
          `)}
        ` : ""}
      </div>

      <div class="is-flex is-align-items-center mt-1" style="gap:.5rem;flex-wrap:wrap">
        ${sqCanCreate ? html`
          <button class="button is-small is-light"
            ?disabled=${formBusy || readOnly()} @click=${apriNuovaSquadra}>
            <span class="icon"><i class="ri-add-line"></i></span>
            <span>Nuova squadra</span>
          </button>` : ""}
        <a class="is-size-7" href="./index.php?dashboard=team-manager">
          Squadre dichiarate
        </a>
      </div>
    `;
  }

  function viewNuovaSquadra() {
    if (!sqDraft) return "";
    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${() => { if (!sqBusy) chiudiNuovaSquadra(); }}></div>
        <div class="modal-card" style="max-width:480px;width:92%">
          <header class="modal-card-head">
            <p class="modal-card-title" style="font-size:1rem">
              <span class="icon mr-2"><i class="ri-group-line"></i></span>Nuova squadra dichiarata
            </p>
            <button class="delete" ?disabled=${sqBusy} @click=${chiudiNuovaSquadra}></button>
          </header>

          <section class="modal-card-body">
            ${sqError ? html`
              <div class="notification is-danger is-light is-small mb-3">
                <i class="ri-error-warning-line mr-1"></i> ${sqError}
              </div>` : ""}

            <div class="field">
              <label class="label is-small mb-1">Nome squadra</label>
              <div class="control">
                <input class="input is-small" type="text" autofocus
                  placeholder="Es. SQUADRA IDRO 1"
                  .value=${sqDraft.nome}
                  ?disabled=${sqBusy}
                  @input=${e => { sqDraft.nome = e.target.value; }}
                  @keydown=${e => { if (e.key === "Enter") salvaNuovaSquadra(); }} />
              </div>
            </div>

            <div class="field">
              <label class="label is-small mb-1">Organizzazioni</label>
              ${orgPicker.template({
                value: sqDraft.organizzazioni,
                onChange: v => { sqDraft.organizzazioni = v; rerender(); },
                disabled: sqBusy,
                altezza: "150px"
              })}
            </div>

            <div class="is-flex" style="gap:.75rem">
              <div class="field" style="width:140px">
                <label class="label is-small mb-1">N. volontari</label>
                <div class="control">
                  <input class="input is-small" type="number" min="0"
                    .value=${sqDraft["n-volontari"]}
                    ?disabled=${sqBusy}
                    @input=${e => { sqDraft["n-volontari"] = e.target.value; }} />
                </div>
              </div>
              <div class="field" style="width:140px">
                <label class="label is-small mb-1">N. mezzi</label>
                <div class="control">
                  <input class="input is-small" type="number" min="0"
                    .value=${sqDraft["n-mezzi"]}
                    ?disabled=${sqBusy}
                    @input=${e => { sqDraft["n-mezzi"] = e.target.value; }} />
                </div>
              </div>
            </div>

            <p class="help">
              Viene creata e subito attivata su questo intervento. Il resto della
              scheda si completa nella vista Squadre dichiarate.
            </p>
          </section>

          <footer class="modal-card-foot" style="justify-content:flex-end;gap:.5rem">
            <button class="button is-small" ?disabled=${sqBusy}
              @click=${chiudiNuovaSquadra}>Annulla</button>
            <button class="button is-small is-primary ${sqBusy ? "is-loading" : ""}"
              ?disabled=${sqBusy} @click=${salvaNuovaSquadra}>
              <span class="icon"><i class="ri-check-line"></i></span>
              <span>Crea e attiva</span>
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  function viewCreazione() {
    if (!createDraft) return "";
    const set = (k, v) => { createDraft[k] = v; rerender(); };

    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${() => { if (!createBusy) chiudiCreazione(); }}></div>
        <div class="modal-card" style="max-width:560px;width:92%">
          <header class="modal-card-head">
            <p class="modal-card-title" style="font-size:1rem">
              <span class="icon mr-2"><i class="ri-first-aid-kit-line"></i></span>
              Nuovo intervento
            </p>
            <button class="delete" ?disabled=${createBusy} @click=${chiudiCreazione}></button>
          </header>

          <section class="modal-card-body">
            ${createError ? html`
              <div class="notification is-danger is-light is-small mb-3">
                <i class="ri-error-warning-line mr-1"></i> ${createError}
              </div>` : ""}

            <div class="field">
              <label class="label is-small mb-1">Nome intervento</label>
              <div class="control">
                <input class="input is-small" type="text" autofocus
                  placeholder="Es. MONTODINE"
                  .value=${createDraft.nome}
                  ?disabled=${createBusy}
                  @input=${e => { createDraft.nome = e.target.value; }}
                  @keydown=${e => { if (e.key === "Enter") salvaNuovo(); }} />
              </div>
            </div>

            <div class="field">
              <label class="label is-small mb-1">Oggetto</label>
              <div class="control">
                <textarea class="textarea is-small" rows="2"
                  placeholder="Es. Palazzina con garage allagati"
                  .value=${createDraft.descrizione}
                  ?disabled=${createBusy}
                  @input=${e => { createDraft.descrizione = e.target.value; }}></textarea>
              </div>
            </div>

            <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
              <div class="field" style="width:220px">
                <label class="label is-small mb-1">Segnalazione</label>
                <div class="control">
                  <input class="input is-small" type="datetime-local"
                    .value=${toInput(createDraft["data-ora-segnalazione"])}
                    ?disabled=${createBusy}
                    @input=${e => set("data-ora-segnalazione", toDb(e.target.value))} />
                </div>
              </div>
              <div class="field" style="width:180px">
                <label class="label is-small mb-1">Comune</label>
                <div class="control">
                  <input class="input is-small" type="text"
                    .value=${createDraft.comune}
                    ?disabled=${createBusy}
                    @input=${e => { createDraft.comune = e.target.value; }} />
                </div>
              </div>
              <div class="field" style="width:90px">
                <label class="label is-small mb-1">Prov.</label>
                <div class="control">
                  <input class="input is-small" type="text" maxlength="2"
                    .value=${createDraft.provincia}
                    ?disabled=${createBusy}
                    @input=${e => { createDraft.provincia = e.target.value; }} />
                </div>
              </div>
            </div>

            <p class="help">
              Il resto della scheda &mdash; segnalante, sopralluogo, squadre, mappa
              &mdash; si compila subito dopo, a intervento creato.
            </p>
          </section>

          <footer class="modal-card-foot" style="justify-content:flex-end;gap:.5rem">
            <button class="button is-small" ?disabled=${createBusy}
              @click=${chiudiCreazione}>Annulla</button>
            <button class="button is-small is-primary ${createBusy ? "is-loading" : ""}"
              ?disabled=${createBusy} @click=${salvaNuovo}>
              <span class="icon"><i class="ri-check-line"></i></span>
              <span>Crea</span>
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  function viewRichieste() {
    const nome = norm(selected?.nome);

    if (!nome) {
      return html`
        <!-- difensivo: l'aggancio e' per nome, e il nome e' obbligatorio,
             quindi in pratica non si arriva mai qui -->
        <p class="help">
          Non disponibili: l'intervento non ha un nome a cui legare la richiesta.
        </p>
      `;
    }

    const setD = (k, v) => { richDraft[k] = v; rerender(); };

    return html`
      ${richError ? html`
        <div class="notification is-danger is-light is-small mb-2">
          <i class="ri-error-warning-line mr-1"></i> ${richError}
        </div>` : ""}

      ${richDraft ? html`
        <div class="box p-3 mb-3">
          <div class="is-flex" style="gap:.5rem;flex-wrap:wrap">
            <div class="field" style="width:150px">
              <label class="label is-small mb-1">Data</label>
              <div class="control">
                <input class="input is-small" type="date" .value=${richDraft.data}
                  ?disabled=${richBusy} @input=${e => setD("data", e.target.value)} />
              </div>
            </div>
            <div class="field" style="width:200px">
              <label class="label is-small mb-1">Richiedente</label>
              <div class="control">
                <input class="input is-small" type="text" .value=${richDraft.richiedente}
                  ?disabled=${richBusy} @input=${e => setD("richiedente", e.target.value)} />
              </div>
            </div>
            <div class="field" style="width:140px">
              <label class="label is-small mb-1">Tipo</label>
              <div class="control"><div class="select is-small is-fullwidth">
                <select ?disabled=${richBusy} @change=${e => setD("tipo-richiesta", e.target.value)}>
                  ${RICH_TIPI.map(v => html`
                    <option value=${v} ?selected=${richDraft["tipo-richiesta"] === v}>${v}</option>`)}
                </select>
              </div></div>
            </div>
            <div class="field" style="width:160px">
              <label class="label is-small mb-1">Priorità</label>
              <div class="control"><div class="select is-small is-fullwidth">
                <select ?disabled=${richBusy} @change=${e => setD("priorita", e.target.value)}>
                  ${RICH_PRIORITA.map(v => html`
                    <option value=${v} ?selected=${richDraft.priorita === v}>${v}</option>`)}
                </select>
              </div></div>
            </div>
            <div class="field" style="width:220px">
              <label class="label is-small mb-1">Stato</label>
              <div class="control"><div class="select is-small is-fullwidth">
                <select ?disabled=${richBusy} @change=${e => setD("stato", e.target.value)}>
                  ${RICH_STATI.map(v => html`
                    <option value=${v} ?selected=${richDraft.stato === v}>${v}</option>`)}
                </select>
              </div></div>
            </div>
            <div class="field" style="width:200px">
              <label class="label is-small mb-1">Assegnatario</label>
              <div class="control">
                <input class="input is-small" type="text"
                  .value=${richDraft["assegnatario-richiesta"]}
                  ?disabled=${richBusy}
                  @input=${e => setD("assegnatario-richiesta", e.target.value)} />
              </div>
            </div>
          </div>

          <div class="field">
            <label class="label is-small mb-1">Richiesta</label>
            <div class="control">
              <textarea class="textarea is-small" rows="2" .value=${richDraft.richiesta}
                ?disabled=${richBusy} @input=${e => setD("richiesta", e.target.value)}></textarea>
            </div>
          </div>

          <div class="buttons">
            <button class="button is-small is-primary ${richBusy ? "is-loading" : ""}"
              ?disabled=${richBusy} @click=${salvaRichiesta}>
              <span class="icon"><i class="ri-save-line"></i></span>
              <span>Salva richiesta</span>
            </button>
            <button class="button is-small" ?disabled=${richBusy}
              @click=${() => { richDraft = null; richError = null; rerender(); }}>Annulla</button>
          </div>
        </div>
      ` : richCanCreate ? html`
        <button class="button is-small is-light mb-3" @click=${nuovaRichiesta}>
          <span class="icon"><i class="ri-add-line"></i></span>
          <span>Nuova richiesta</span>
        </button>
      ` : html`
        <p class="help mb-2">
          <span class="icon is-small"><i class="ri-lock-line"></i></span>
          Sola lettura sulle richieste.
        </p>
      `}

      ${richLoading
        ? html`<progress class="progress is-small"></progress>`
        : richRecords.length === 0
          ? html`<p class="help">Nessuna richiesta collegata a questo intervento.</p>`
          : html`
            <table class="table is-small is-narrow is-fullwidth is-hoverable">
              <thead>
                <tr><th>Stato</th><th>Richiesta</th><th>Richiedente</th><th>Priorità</th></tr>
              </thead>
              <tbody>
                ${richRecords.map(r => html`
                  <tr>
                    <td style="white-space:nowrap">
                      <span style=${`display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:.3rem;background:${RICH_STATO_COLOR[norm(r.stato)] || "#888780"}`}></span>
                      <span class="is-size-7">${norm(r.stato)}</span>
                    </td>
                    <td class="is-size-7">${norm(r.richiesta)}</td>
                    <td class="is-size-7">${norm(r.richiedente)}</td>
                    <td class="is-size-7">${norm(r.priorita).replace(/^\d+ - /, "")}</td>
                  </tr>
                `)}
              </tbody>
            </table>
            <p class="help">
              Per lavorarle usa <a href="./index.php?dashboard=requests-board">Gestione richieste</a>.
            </p>
          `}
    `;
  }

  function viewBrogliaccio() {
    const nome = norm(selected?.nome);

    if (!nome) {
      return html`
        <div class="field">
          <label class="label is-small mb-1">Note brogliaccio</label>
          <p class="help">
            Non disponibili: l'intervento non ha un nome a cui agganciare la nota.
          </p>
        </div>
      `;
    }

    return html`
      <div class="field">
        <label class="label is-small mb-1">Note brogliaccio</label>

        ${brogError ? html`
          <div class="notification is-danger is-light is-small mb-2">
            <i class="ri-error-warning-line mr-1"></i> ${brogError}
          </div>` : ""}

        ${brogCanCreate ? html`
          <div class="field has-addons mb-2">
            <div class="control is-expanded">
              <input class="input is-small" type="text"
                placeholder="Annota un evento e premi Invio…"
                .value=${brogText}
                ?disabled=${brogBusy}
                @input=${e => { brogText = e.target.value; }}
                @keydown=${e => { if (e.key === "Enter") { e.preventDefault(); addBrogNote(); } }} />
            </div>
            <div class="control">
              <!-- niente ?disabled legato al testo: l'@input non ridisegna la
                   vista, quindi il binding resterebbe fermo al primo render -->
              <button class="button is-small is-primary ${brogBusy ? "is-loading" : ""}"
                ?disabled=${brogBusy}
                @click=${addBrogNote}>
                <span class="icon"><i class="ri-add-line"></i></span>
                <span>Annota</span>
              </button>
            </div>
          </div>
        ` : html`
          <p class="help mb-2">
            <span class="icon is-small"><i class="ri-lock-line"></i></span>
            Sola lettura sul brogliaccio.
          </p>
        `}

        ${brogLoading
          ? html`<progress class="progress is-small"></progress>`
          : brogRecords.length === 0
            ? html`<p class="help">Nessuna nota registrata per questo intervento.</p>`
            : html`
              <div style="max-height:220px;overflow:auto;border:1px solid #dbdbdb;border-radius:4px">
                ${brogRecords.map(b => html`
                  <div style="padding:.4rem .6rem;border-bottom:1px solid #f0f0f0">
                    <div class="is-size-7 has-text-grey">
                      <span class="icon is-small"><i class="ri-time-line"></i></span>
                      ${fmtDate(b["data/ora"]) || "senza data"}
                    </div>
                    <div class="is-size-7" style="white-space:pre-wrap">${norm(b.descrizione)}</div>
                  </div>
                `)}
              </div>
            `}

        <p class="help mt-1">
          Ogni nota e' un record del brogliaccio con <code>servizio</code> =
          nome dell'intervento. Il brogliaccio e' un registro: le note
          non si cancellano da qui.
        </p>
      </div>
    `;
  }

  /* ---- vista kanban ---- */

  function renderCard(r) {
    const st = statoOf(r);
    const dedotto = !norm(r.stato);
    return html`
      <div draggable="true"
        @dragstart=${e => { dragId = r.id; e.dataTransfer.effectAllowed = "move"; }}
        @dragend=${() => { dragId = null; dropTarget = null; rerender(); }}
        @click=${() => { vista = "elenco"; selectRecord(r); }}
        style=${`background:#fff;border-radius:6px;border-left:4px solid ${statoColor(st)};
          box-shadow:0 1px 3px rgba(0,0,0,.08);padding:.5rem .6rem;margin-bottom:.5rem;
          cursor:grab;${dragId === r.id ? "opacity:.45" : ""}`}>
        <div class="is-size-7" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${norm(r.nome) || "(senza nome)"}
        </div>
        ${norm(r.comune) ? html`
          <div class="is-size-7 has-text-grey">
            <span class="icon is-small"><i class="ri-map-pin-line"></i></span>${norm(r.comune)}
          </div>` : ""}
        <div class="is-size-7 has-text-grey">
          ${fmtDate(r["data-ora-segnalazione"]) || "senza data"}
        </div>
        ${dedotto ? html`
          <span class="tag is-light" style="font-size:.6rem" title="Stato dedotto da inizio e fine, non ancora scelto">
            dedotto
          </span>` : ""}
      </div>
    `;
  }

  function renderColumn(stato, cards) {
    const color = statoColor(stato);
    const isOver = dropTarget === stato;
    return html`
      <div style=${`flex:0 0 260px;display:flex;flex-direction:column;background:#f1f5f9;
          border-radius:8px;overflow:hidden;border:2px solid ${isOver ? color : "transparent"};
          transition:border-color .12s`}
        @dragover=${e => {
          e.preventDefault();
          if (dropTarget !== stato) { dropTarget = stato; rerender(); }
        }}
        @dragleave=${() => { if (dropTarget === stato) { dropTarget = null; rerender(); } }}
        @drop=${e => {
          e.preventDefault();
          const id = dragId;
          dragId = null; dropTarget = null;
          if (id) moveCard(id, stato); else rerender();
        }}>

        <div style=${`padding:.55rem .7rem;background:${color};color:#fff;font-size:.75rem;
          font-weight:700;letter-spacing:.03em;display:flex;align-items:center;
          justify-content:space-between;flex-shrink:0`}>
          <span>${stato}</span>
          <span style="background:rgba(255,255,255,.25);border-radius:10px;padding:1px 8px;font-size:.7rem">
            ${cards.length}
          </span>
        </div>

        <div style="flex:1;overflow-y:auto;padding:.5rem;min-height:80px">
          ${cards.length
            ? cards.map(r => renderCard(r))
            : html`<div class="has-text-grey-light" style="font-size:.7rem;text-align:center;padding:1.2rem 0">vuota</div>`}
        </div>
      </div>
    `;
  }

  function viewKanban() {
    const rows = filtered();
    const byStato = new Map(STATI.map(v => [v, []]));
    for (const r of rows) {
      const v = statoOf(r);
      (byStato.get(v) || byStato.get(STATI[0])).push(r);
    }

    return html`
      <div style="padding:.75rem">
        ${loading
          ? html`<progress class="progress is-small"></progress>`
          : html`
            <div style="display:flex;gap:.75rem;min-width:max-content;height:520px">
              ${STATI.map(v => renderColumn(v, byStato.get(v)))}
            </div>
          `}
        <p class="help mt-2">
          Trascina una scheda per cambiarne lo stato. Un clic la apre per la modifica.
        </p>
      </div>
    `;
  }

  function viewRefPicker() {
    if (!refOpen) return "";
    const rows = refFiltered();
    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${closeRefPicker}></div>
        <div class="modal-card" style="max-width:640px;width:92%">
          <header class="modal-card-head">
            <p class="modal-card-title" style="font-size:1rem">
              <span class="icon mr-2"><i class="ri-user-star-line"></i></span>
              Scegli il referente
            </p>
            <button class="delete" @click=${closeRefPicker}></button>
          </header>
          <section class="modal-card-body">
            <div class="field">
              <div class="control has-icons-left">
                <input class="input is-small" type="text" autofocus
                  placeholder="Cognome, nome o organizzazione…"
                  .value=${refQuery}
                  @input=${e => { refQuery = e.target.value; rerender(); }} />
                <span class="icon is-small is-left"><i class="ri-search-line"></i></span>
              </div>
            </div>

            ${refError ? html`
              <div class="notification is-danger is-light is-small">
                <i class="ri-error-warning-line mr-1"></i> ${refError}
              </div>` : ""}

            ${refLoading
              ? html`<progress class="progress is-small"></progress>`
              : rows.length === 0
                ? html`<p class="has-text-grey is-size-7">
                         ${refLoaded ? "Nessun nominativo corrisponde." : "Anagrafica non disponibile."}
                       </p>`
                : html`
                  <table class="table is-small is-narrow is-fullwidth is-hoverable">
                    <thead>
                      <tr>
                        <th>Cognome e nome</th>
                        <th>Organizzazione</th>
                        <th>Cellulare</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      ${rows.map(r => html`
                        <tr>
                          <td><strong>${norm(r.cognome)}</strong> ${norm(r.nome)}</td>
                          <td class="is-size-7">${norm(r.organizzazione)}</td>
                          <td class="is-size-7">${norm(r.cellulare) || "—"}</td>
                          <td style="width:1%">
                            <button class="button is-small is-primary"
                              @click=${() => pickReferente(r)}>Scegli</button>
                          </td>
                        </tr>
                      `)}
                    </tbody>
                  </table>
                  ${rows.length === 50
                    ? html`<p class="help">Primi 50 risultati: restringi la ricerca.</p>`
                    : ""}
                `}
          </section>
          <footer class="modal-card-foot" style="justify-content:flex-end">
            <button class="button is-small" @click=${closeRefPicker}>Chiudi</button>
          </footer>
        </div>
      </div>
    `;
  }

  function viewForm() {
    if (!selected) {
      return html`
        <div class="has-text-centered has-text-grey" style="padding:3rem 1rem">
          <span class="icon is-large"><i class="ri-first-aid-kit-line ri-2x"></i></span>
          <p class="mt-2 mb-3 is-size-7">Seleziona un intervento dall'elenco.</p>
          <button class="button is-small is-primary"
            ?disabled=${!perms.canCreate} @click=${apriCreazione}>
            <span class="icon"><i class="ri-add-line"></i></span>
            <span>Nuovo intervento</span>
          </button>
        </div>
      `;
    }

    const dirty = isDirty();

    return html`
      <div style="padding:1rem">

        <div class="is-flex is-align-items-center mb-4" style="gap:.5rem;flex-wrap:wrap">
          <button class="button is-small is-primary ${formBusy ? "is-loading" : ""}"
            ?disabled=${formBusy || deleteBusy || readOnly() || !dirty}
            @click=${save}>
            <span class="icon"><i class="ri-save-line"></i></span>
            <span>Salva</span>
          </button>

          ${selected ? html`
            ${!deleteConfirm ? html`
              <button class="button is-small is-danger is-light"
                ?disabled=${formBusy || deleteBusy || !perms.canDelete}
                @click=${() => { deleteConfirm = true; deleteUsage = null; deleteBlocked = false; checkDeleteUsage(); }}>
                <span class="icon"><i class="ri-delete-bin-6-line"></i></span>
                <span>Elimina</span>
              </button>
            ` : deleteUsage?.checking ? html`
              <span class="is-size-7 has-text-grey">Verifica risorse assegnate…</span>
            ` : deleteBlocked ? html`
              <span class="is-size-7" style="color:#c0392b">
                <strong>Non eliminabile</strong> — assegnato a
                ${deleteUsage.v > 0 ? html`<strong>${deleteUsage.v} volontar${deleteUsage.v === 1 ? "io" : "i"}</strong>` : ""}
                ${deleteUsage.v > 0 && (deleteUsage.m > 0 || deleteUsage.mat > 0) ? ", " : ""}
                ${deleteUsage.m > 0 ? html`<strong>${deleteUsage.m} mezz${deleteUsage.m === 1 ? "o" : "i"}</strong>` : ""}
                ${deleteUsage.m > 0 && deleteUsage.mat > 0 ? ", " : ""}
                ${deleteUsage.mat > 0 ? html`<strong>${deleteUsage.mat} material${deleteUsage.mat === 1 ? "e" : "i"}</strong>` : ""}.
                <button class="delete is-small ml-2"
                  @click=${() => { deleteConfirm = false; deleteUsage = null; rerender(); }}></button>
              </span>
            ` : html`
              <span class="is-size-7" style="color:#c0392b">Nessuna risorsa assegnata. Confermi?</span>
              <button class="button is-danger is-small ${deleteBusy ? "is-loading" : ""}"
                ?disabled=${deleteBusy} @click=${del}>Sì, elimina</button>
              <button class="button is-small" ?disabled=${deleteBusy}
                @click=${() => { deleteConfirm = false; deleteUsage = null; rerender(); }}>Annulla</button>
            `}
          ` : ""}

          <button class="button is-small" ?disabled=${formBusy || deleteBusy || !perms.canCreate}
            @click=${apriCreazione}>
            <span class="icon"><i class="ri-add-line"></i></span>
            <span>Nuovo</span>
          </button>

          ${readOnly() ? html`
            <span class="tag is-light">
              <span class="icon is-small"><i class="ri-lock-line"></i></span>
              <span>Sola lettura</span>
            </span>
          ` : ""}

          ${dirty ? html`<span class="tag is-warning is-light">Modifiche non salvate</span>` : ""}
        </div>

        ${formError ? html`
          <div class="notification is-danger is-light is-small mb-3">
            <i class="ri-error-warning-line mr-1"></i> ${formError}
          </div>` : ""}

        ${formSuccess ? html`
          <div class="notification is-success is-light is-small mb-3">
            <i class="ri-check-line mr-1"></i> ${formSuccess}
          </div>` : ""}

        ${block("Intervento", "first-aid-kit-line", html`
          ${field("Nome intervento", "nome")}
          <div class="field" style="width:200px">
            <label class="label is-small mb-1">Stato</label>
            <div class="control">
              <div class="select is-small is-fullwidth">
                <select ?disabled=${formBusy || readOnly()}
                  @change=${e => setField("stato", e.target.value)}>
                  <option value="" ?selected=${!norm(form.stato)}>
                    Dedotto da inizio e fine
                  </option>
                  ${STATI.map(v => html`
                    <option value=${v} ?selected=${norm(form.stato) === v}>${v}</option>
                  `)}
                </select>
              </div>
            </div>
          </div>

          <div class="field">
            <label class="label is-small mb-1">Oggetto</label>
            <div class="control">
              <textarea class="textarea is-small" rows="2"
                .value=${form.descrizione || ""}
                ?disabled=${formBusy || readOnly()}
                @input=${e => setField("descrizione", e.target.value)}></textarea>
            </div>
          </div>
        `)}

        ${block("Segnalazione", "phone-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("Data e ora", "data-ora-segnalazione", { type: "datetime-local", width: "220px" })}
            ${field("N. riferimento VVF", "riferimento-vvf", { width: "220px" })}
          </div>
        `)}

        ${block("Segnalante", "user-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("Nome", "nome-segnalante", { width: "220px" })}
            ${field("Qualifica", "qualifica-segnalante", { width: "220px" })}
            ${field("Indirizzo", "indirizzo-segnalante", { width: "220px" })}
            ${field("Telefono", "telefono-segnalante", { width: "160px" })}
          </div>
        `)}

        ${block("Luogo", "map-pin-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("Via", "indirizzo", { width: "280px" })}
            ${field("Comune", "comune", { width: "200px" })}
            ${field("Provincia", "provincia", { width: "100px" })}
          </div>
        `)}

        ${block("Tempi", "time-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("Sopralluogo", "data/ora-sopralluogo", { type: "datetime-local", width: "220px" })}
            ${field("Inizio intervento", "inizio", { type: "datetime-local", width: "220px" })}
            ${field("Fine intervento", "fine", { type: "datetime-local", width: "220px" })}
          </div>
        `)}

        ${block("Squadre e referente", "group-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap;align-items:flex-start">
            <div style="min-width:0;flex:1">
              <label class="label is-small mb-1">Squadre attivate</label>
              ${viewSquadre()}
            </div>
            <div style="width:260px">
              ${field("Operatori a supporto", "operatori-a-supporto")}
            </div>
          </div>

          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap;align-items:flex-end">
            ${field("Cognome referente", "cognome-referente", { width: "200px" })}
            ${field("Nome referente", "nome-referente", { width: "200px" })}
            ${field("Telefono referente", "telefono-referente", { width: "160px" })}
            <!-- stesso margin-bottom dei .field accanto: con align-items:flex-end
                 l'allineamento e' sul margin box, e Bulma lo toglie all'ultimo figlio -->
            <div class="field" style="margin-bottom:.75rem">
              <button class="button is-small is-light"
                ?disabled=${formBusy || readOnly()} @click=${openRefPicker}>
                <span class="icon"><i class="ri-search-line"></i></span>
                <span>Cerca in anagrafica</span>
              </button>
            </div>
          </div>
        `)}

        ${block("Catalogo e mappa", "map-pin-user-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">

            <div class="field" style="width:110px">
              <label class="label is-small mb-1">Ordine</label>
              <div class="control">
                <input class="input is-small" type="number" min="0"
                  .value=${form.ordine || ""}
                  ?disabled=${formBusy || readOnly()}
                  @input=${e => setField("ordine", e.target.value)} />
              </div>
            </div>

            <div class="field" style="width:110px">
              <label class="label is-small mb-1">Lettera</label>
              <div class="control">
                <div class="select is-small is-fullwidth">
                  <select ?disabled=${formBusy || readOnly()}
                    @change=${e => setField("lettera", e.target.value)}>
                    ${LETTERE.map(l => html`
                      <option value=${l} ?selected=${norm(form.lettera) === l}>
                        ${l === "" ? "—" : l}
                      </option>
                    `)}
                  </select>
                </div>
              </div>
            </div>

            <div class="field" style="width:170px">
              <label class="label is-small mb-1">Colore</label>
              <div class="control is-flex" style="gap:.4rem;align-items:center">
                <div class="select is-small" style="flex:1">
                  <select style="width:100%" ?disabled=${formBusy || readOnly()}
                    @change=${e => setField("colore", e.target.value)}>
                    <option value="" ?selected=${!norm(form.colore)}>—</option>
                    ${COLORI.map(c => html`
                      <option value=${c} ?selected=${norm(form.colore) === c}>${c}</option>
                    `)}
                  </select>
                </div>
                <span style=${`display:inline-block;width:18px;height:18px;border-radius:3px;border:1px solid #b5b5b5;background:${COLOR_MAP[norm(form.colore)] || "transparent"}`}></span>
              </div>
            </div>

            <div class="field" style="width:150px">
              <label class="label is-small mb-1">Latitudine</label>
              <div class="control">
                <input class="input is-small" type="text" inputmode="decimal"
                  placeholder="45.143569"
                  .value=${form.latitudine || ""}
                  ?disabled=${formBusy || readOnly()}
                  @input=${e => setField("latitudine", e.target.value)} />
              </div>
            </div>

            <div class="field" style="width:150px">
              <label class="label is-small mb-1">Longitudine</label>
              <div class="control">
                <input class="input is-small" type="text" inputmode="decimal"
                  placeholder="9.979030"
                  .value=${form.longitudine || ""}
                  ?disabled=${formBusy || readOnly()}
                  @input=${e => setField("longitudine", e.target.value)} />
              </div>
            </div>

          </div>
          <button class="button is-small is-light mt-1"
            ?disabled=${formBusy || readOnly()} @click=${openMapPicker}>
            <span class="icon"><i class="ri-map-pin-2-line"></i></span>
            <span>Scegli sulla mappa</span>
          </button>
        `)}

        ${block("Cronologia", "file-list-3-line", html`
          <div class="field">
            <label class="label is-small mb-1">Note libere</label>
            <div class="control">
              <textarea class="textarea is-small" rows="6"
                placeholder="ore 8:48 Capo Gabinetto informa della criticità&#10;ore 9:15 coordinati con VVF&#10;…"
                .value=${form.note || ""}
                ?disabled=${formBusy || readOnly()}
                @input=${e => setField("note", e.target.value)}></textarea>
            </div>
            <p class="help">Restano sulla scheda, non finiscono nel brogliaccio.</p>
          </div>

          ${viewBrogliaccio()}
        `)}

        ${block("Richieste", "file-list-2-line", viewRichieste())}

      </div>
    `;
  }

  function viewList() {
    const rows = filtered();

    return html`
      <div style="border-right:1px solid #dbdbdb;display:flex;flex-direction:column;min-height:0">

        <div style="padding:.75rem;border-bottom:1px solid #dbdbdb">
          <input class="input is-small mb-2" type="text" placeholder="Cerca…"
            .value=${search}
            @input=${e => { search = e.target.value; rerender(); }} />

          <div class="select is-small is-fullwidth">
            <select @change=${e => { filtroStato = e.target.value; rerender(); }}>
              <option value="" ?selected=${filtroStato === ""}>Tutti gli stati</option>
              ${STATI.map(s => html`
                <option value=${s} ?selected=${filtroStato === s}>${s}</option>
              `)}
            </select>
          </div>

          <div class="is-flex is-align-items-center mt-2" style="gap:.4rem">
            <button class="button is-small is-primary is-fullwidth"
              ?disabled=${!perms.canCreate} @click=${apriCreazione}>
              <span class="icon"><i class="ri-add-line"></i></span>
              <span>Nuovo intervento</span>
            </button>
            <button class="button is-small" title="Ricarica"
              ?disabled=${loading} @click=${load}>
              <span class="icon"><i class="ri-refresh-line"></i></span>
            </button>
          </div>
        </div>

        <div style="flex:1;overflow:auto;min-height:0">
          ${loading
            ? html`<progress class="progress is-small m-3" style="width:auto"></progress>`
            : rows.length === 0
              ? html`<p class="has-text-grey is-size-7 p-4 has-text-centered">
                       ${records.length === 0 ? "Nessun intervento registrato." : "Nessun risultato."}
                     </p>`
              : rows.map(r => {
                  const st = statoOf(r);
                  const isSel = selected?.id === r.id;
                  return html`
                    <a class="is-block"
                       style=${`padding:.5rem .75rem;border-bottom:1px solid #f0f0f0;text-decoration:none;color:inherit;${isSel ? "background:#e6f1fb" : ""}`}
                       @click=${e => { e.preventDefault(); selectRecord(r); }}>
                      <div class="is-flex is-align-items-center" style="gap:.4rem">
                        <span title=${st}
                          style=${`display:inline-block;width:8px;height:8px;border-radius:50%;background:${statoColor(st)};flex-shrink:0`}></span>
                        <strong class="is-size-7" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                          ${norm(r.nome) || "(senza nome)"}
                        </strong>
                      </div>
                      <div class="is-size-7 has-text-grey" style="margin-left:1.2rem">
                        ${norm(r.comune) ? html`${norm(r.comune)} · ` : ""}
                        ${fmtDate(r["data-ora-segnalazione"]) || "senza data"}
                      </div>
                    </a>
                  `;
                })}
        </div>

        <div style="padding:.4rem .75rem;border-top:1px solid #dbdbdb" class="has-text-grey is-size-7">
          ${rows.length} di ${records.length}
        </div>
      </div>
    `;
  }

  function view() {
    return html`
      <style>${MAP_PICKER_CSS}</style>

      ${mapPicker.template()}
      ${viewRefPicker()}
      ${viewCreazione()}
      ${viewNuovaSquadra()}

      <div class="box spa-title-box" style="padding:0;overflow:hidden;margin:0 0 1rem 0">

        <div class="is-flex is-align-items-center"
          style="padding:.75rem 1rem;border-bottom:1px solid #dbdbdb;gap:.75rem;flex-wrap:wrap">
          <h3 class="title is-5 mb-0" style="flex:1;min-width:0">
            <span class="icon is-medium" style="vertical-align:middle;margin-right:.4rem">
              <i class="ri-first-aid-kit-line ri-lg"></i>
            </span>Gestione interventi
          </h3>
          <div class="buttons has-addons mb-0">
            <button class="button is-small ${vista === "kanban" ? "is-primary is-selected" : ""}"
              @click=${() => { vista = "kanban"; rerender(); }}>
              <span class="icon is-small"><i class="ri-kanban-view-2"></i></span>
              <span>Kanban</span>
            </button>
            <button class="button is-small ${vista === "elenco" ? "is-primary is-selected" : ""}"
              @click=${() => { vista = "elenco"; rerender(); }}>
              <span class="icon is-small"><i class="ri-list-check"></i></span>
              <span>Elenco</span>
            </button>
          </div>
        </div>

        ${error ? html`
          <article class="message is-danger m-3">
            <div class="message-body">
              <p>${userFriendlyErrorText(error)}</p>
              <div class="buttons mt-2">
                <button class="button is-light is-small" ?disabled=${loading || retrying}
                  @click=${async () => { retrying = true; rerender(); await load(); }}>
                  Riprova
                </button>
              </div>
              <details class="mt-2">
                <summary>Dettagli tecnici</summary>
                <pre style="white-space:pre-wrap;margin:0">${JSON.stringify(
                  { status: error.status, code: error.code, message: error.message, kind: error.kind },
                  null, 2)}</pre>
              </details>
            </div>
          </article>
        ` : ""}

        ${vista === "kanban"
          ? html`<div style="overflow-x:auto">${viewKanban()}</div>`
          : html`
            <div style="display:flex;min-height:520px;align-items:stretch">
              <div style="width:320px;flex-shrink:0;display:flex;flex-direction:column">
                ${viewList()}
              </div>
              <div style="flex:1;min-width:0;overflow:auto">
                ${viewForm()}
              </div>
            </div>
          `}

      </div>
    `;
  }

  function rerender() {
    render(view(), root);
    // il contenitore della mappa esiste solo quando la modale e' nel DOM
    mapPicker.afterRender();
  }

  await loadPerms();
  load();

  return view();
}
