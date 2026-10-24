// I moduli condivisi vanno importati in modo dinamico con la versione in coda:
// un `import` statico non porta la query string, quindi il browser lo mette in
// cache e le modifiche non si vedono piu'. Vedi AGENTS.md §Module loading.
const VERSION = window.APP_CONFIG?.version || Date.now();

// views/team-manager/index.js — Gestione squadre dichiarate
// Le squadre sono una risorsa aggregata: identita' = nome, consistenza = conteggi.
// Regola organizzativa: o la squadra o le risorse registrate singolarmente, mai
// entrambe, altrimenti i riepiloghi contano due volte le stesse persone.

// Squadre *dichiarate*: descritte da conteggi, non da nominativi. Da non
// confondere con il campo `squadra` sulle risorse registrate, che e' l'etichetta
// di raggruppamento di chi il check-in lo ha gia' fatto.
const TABLE = "squadre-dichiarate";

const FIELDS = [
  "id", "nome", "mansione-principale", "organizzazioni",
  "n-volontari", "n-mezzi", "attrezzature",
  "cognome-referente", "nome-referente", "cellulare-referente",
  "servizio", "turno",
  "data-inizio-attestato", "data-fine-attestato",
  "data/ora-registrazione", "data/ora-uscita-definitiva",
  "note"
];

const EDITABLE = FIELDS.filter(f => f !== "id");

// `attrezzature` e' testo libero, non un conteggio: resta fuori dai numerici
// e dai totali in testa all'elenco.
const NUMERICI = ["n-volontari", "n-mezzi"];

// Vocabolario identico alla colonna MANSIONE di `volontari`: due elenchi
// divergenti darebbero due verita' diverse sulla stessa nomenclatura.
const MANSIONI = [
  "OPERATORE LOGISTICO", "OPERATORE IDROGEOLOGICO", "OPERATORE MOVIMENTO TERRA",
  "OPERATORE INSACCHETTAMENTO", "OPERATORE MOTOSEGA", "OPERATORE SUB",
  "OPERATORE CINOFILO", "OPERATORE SEGRETERIA", "OPERATORE SALA OPERATIVA",
  "OPERATORE RADIO", "OPERATORE NAUTICO", "ELETTRICISTA", "MURATORE", "IDRAULICO",
  "OPERATORE SANITARIO", "OPERATORE CUCINA", "OPERATORE ANTINCENDIO",
  "OPERATORE A CAVALLO", "OPERATORE SUBACQUEO"
];

const STATI = ["In servizio", "Non in servizio", "Da registrare"];

const STATO_COLOR = {
  "In servizio": "#3B6D11",
  "Non in servizio": "#888780",
  "Da registrare": "#BA7517"
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
    case "not_found":  return "Risorsa non trovata: la tabella `squadre-dichiarate` esiste?";
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

/* --- date --- */

function toInputDate(v) {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(norm(v));
  return m ? m[1] : "";
}

function toInputDateTime(v) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(norm(v));
  return m ? `${m[1]}T${m[2]}` : "";
}

function toDbDateTime(v) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(norm(v));
  return m ? `${m[1]} ${m[2]}:00` : "";
}

function fmtDate(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(norm(v));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

function statoOf(r) {
  if (!norm(r["data-inizio-attestato"])) return "Da registrare";
  if (!norm(r["data-fine-attestato"])) return "In servizio";
  return "Non in servizio";
}

function num(v) {
  return parseInt(v, 10) || 0;
}

function emptyForm() {
  const f = {};
  for (const k of EDITABLE) f[k] = "";
  return f;
}

function formFrom(r) {
  const f = {};
  for (const k of EDITABLE) f[k] = norm(r[k]);
  return f;
}

function serialize(f) {
  return JSON.stringify(EDITABLE.map(k => [k, norm(f[k])]));
}

/* ==========================
   View
========================== */

/**
 * Pannello di gestione squadre, riusabile.
 *
 * Non renderizza da solo: compone il template e chiede all'ospite di ridisegnare
 * tramite `rerender`. Cosi' puo' vivere sia come SPA a se' (vedi TeamManager in
 * fondo al file) sia dentro un'altra vista, come la terza scheda di
 * intervention-manager.
 *
 * @param {Object}   o
 * @param {Object}   o.client    WorkTableClient
 * @param {Function} o.html      tag template di lit-html
 * @param {Function} o.rerender  ridisegna la vista ospite
 * @param {Boolean}  [o.embedded] true = niente box esterno ne' intestazione:
 *                                li mette gia' l'ospite
 */
export async function createTeamPanel({ client, html, rerender, embedded = false }) {
  const { createOrgPicker, splitOrg } =
    await import(`../shared/org-picker.js?v=${VERSION}`);

  const API = client.table(TABLE);

  let records = [];
  let loading = false;
  let error = null;
  let retrying = false;

  let search = "";
  let filtroStato = "";
  let filtroServizio = "";

  let selected = null;
  let form = emptyForm();
  let baseForm = emptyForm();
  let formBusy = false;
  let formError = null;
  let formSuccess = null;

  let createDraft = null;
  let createBusy = false;
  let createError = null;

  let perms = { canCreate: false, canUpdate: false, canDelete: false };

  let deleteConfirm = false;
  let deleteBusy = false;
  let deleteUsage = null;
  let deleteBlocked = false;

  let servizi = [];

  // Nominativi effettivamente registrati, per nome squadra.
  // I conteggi sulla squadra sono *dichiarati* dall'organizzazione; questi sono
  // le risorse che portano davvero quel nome nel campo `squadra`. I due numeri
  // convivono: i nominativi possono arrivare giorni dopo, e anche solo in parte.
  let registrati = {};        // { nomeMinuscolo: { v, m, mat } }
  let registratiCaricati = false;

  const orgPicker = createOrgPicker({ client, html, rerender: () => rerender() });

  let cancelled = false;

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
      perms = { canCreate: false, canUpdate: false, canDelete: false };
    }
  }

  async function loadRegistrati() {
    const conta = async (table, chiave) => {
      const res = await client.table(table).list({ include: ["squadra"], size: 5000 });
      for (const r of getRecords(res)) {
        const k = norm(r.squadra).toLowerCase();
        if (!k) continue;
        registrati[k] ||= { v: 0, m: 0, mat: 0 };
        registrati[k][chiave]++;
      }
    };
    registrati = {};
    await Promise.allSettled([
      conta("volontari", "v"), conta("mezzi", "m"), conta("materiali", "mat")
    ]);
    registratiCaricati = true;
    rerender();
  }

  function reg(nome) {
    return registrati[norm(nome).toLowerCase()] || { v: 0, m: 0, mat: 0 };
  }

  async function loadCataloghi() {
    orgPicker.load();   // in parallelo, non blocca l'elenco squadre
    loadRegistrati();
    try {
      const res = await client.table("servizi").list({ include: ["nome"], size: 2000 });
      servizi = Array.from(new Set(getRecords(res).map(r => norm(r.nome)).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "it"));
    } catch {
      servizi = [];
    }
  }

  async function load() {
    loading = true;
    error = null;
    retrying = false;
    rerender();

    try {
      const results = await Promise.allSettled([
        withRetry(() => API.list({ include: FIELDS, size: 2000 })),
        loadCataloghi()
      ]);

      if (results[0].status === "fulfilled") {
        records = getRecords(results[0].value)
          .map((r, i) => ({ r, i }))
          .sort((a, b) => {
            const na = norm(a.r.nome).toLocaleLowerCase("it-IT");
            const nb = norm(b.r.nome).toLocaleLowerCase("it-IT");
            return na.localeCompare(nb, "it") || a.i - b.i;
          })
          .map(x => x.r);
      } else {
        error = normalizeApiError(results[0].reason);
      }
    } catch (e) {
      error = normalizeApiError(e);
    } finally {
      loading = false;
      if (!cancelled) rerender();
    }
  }

  /* ---- selezione e bozza ---- */

  const isDirty = () => serialize(form) !== serialize(baseForm);

  function resetFormState() {
    formError = null;
    formSuccess = null;
    deleteConfirm = false;
    deleteUsage = null;
    deleteBlocked = false;
  }

  function selectRecord(r) {
    if (selected?.id === r.id) return;
    if (isDirty() && !confirm("Ci sono modifiche non salvate. Scartarle?")) return;
    selected = r;
    form = formFrom(r);
    baseForm = formFrom(r);
    resetFormState();
    rerender();
  }

  function setField(k, v) {
    form[k] = v;
    formSuccess = null;
    rerender();
  }

  /* ---- creazione rapida ---- */

  function apriCreazione() {
    createDraft = { nome: "", organizzazioni: "", "n-volontari": "", "n-mezzi": "" };
    createError = null;
    rerender();
  }

  function chiudiCreazione() {
    createDraft = null;
    createError = null;
    rerender();
  }

  async function salvaNuova() {
    if (!createDraft) return;
    const nome = norm(createDraft.nome);
    if (!nome) {
      createError = "Il nome della squadra è obbligatorio: è il valore con cui viene referenziata altrove.";
      rerender();
      return;
    }
    if (records.some(r => norm(r.nome).toLowerCase() === nome.toLowerCase())) {
      if (!confirm("Esiste già una squadra con questo nome. Procedere comunque?")) return;
    }

    createBusy = true;
    createError = null;
    rerender();

    try {
      const payload = {};
      for (const k of EDITABLE) payload[k] = null;
      payload.nome = nome;
      payload.organizzazioni = norm(createDraft.organizzazioni) || null;
      payload["n-volontari"] = num(createDraft["n-volontari"]) || null;
      payload["n-mezzi"] = num(createDraft["n-mezzi"]) || null;

      await API.create(payload);
      createDraft = null;
      await load();
      if (cancelled) return;

      const nuova = records.find(r => norm(r.nome) === nome);
      if (nuova) selectRecord(nuova);
    } catch (e) {
      createError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      createBusy = false;
      if (!cancelled) rerender();
    }
  }

  /* ---- salvataggio ---- */

  async function save() {
    if (!selected) return;
    formError = null;
    formSuccess = null;

    if (!norm(form.nome)) {
      formError = "Il nome della squadra è obbligatorio.";
      rerender();
      return;
    }

    if (norm(form.nome) !== norm(baseForm.nome)) {
      const ok = confirm(
        "Stai rinominando la squadra. Le risorse che la referenziano nel campo " +
        "`squadra` e gli interventi che l'hanno fra le squadre attivate " +
        "continueranno a puntare al nome precedente. Procedere?");
      if (!ok) return;
    }

    formBusy = true;
    rerender();

    try {
      const payload = {};
      for (const k of EDITABLE) payload[k] = norm(form[k]) || null;
      for (const k of NUMERICI) {
        payload[k] = payload[k] === null ? null : (num(payload[k]) || null);
      }

      await API.update(selected.id, payload);
      formSuccess = "Modifiche salvate.";

      const nomeSalvato = norm(form.nome);
      await load();
      if (cancelled) return;

      const again = records.find(r => norm(r.nome) === nomeSalvato);
      if (again) {
        selected = again;
        form = formFrom(again);
        baseForm = formFrom(again);
      }
    } catch (e) {
      formError = userFriendlyErrorText(normalizeApiError(e));
    } finally {
      formBusy = false;
      if (!cancelled) rerender();
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
          filters: [client.filter("squadra", "eq", nome)],
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
      deleteUsage = { v: 0, m: 0, mat: 0 };
      deleteBlocked = true;
      formError = "Impossibile verificare se la squadra è in uso. Eliminazione bloccata per sicurezza.";
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

  /* ---- filtri ---- */

  function filtered() {
    const q = search ? search.toLocaleLowerCase("it-IT") : "";
    return records.filter(r => {
      if (filtroStato && statoOf(r) !== filtroStato) return false;
      // `organizzazioni` contiene piu' valori: confronto per contenuto, non `eq`
      if (filtroServizio && norm(r.servizio) !== filtroServizio) return false;
      if (!q) return true;
      const hay = [r.nome, r.organizzazioni, r["cognome-referente"],
                   r["nome-referente"], r.servizio, r["mansione-principale"]]
        .map(norm).join(" ").toLocaleLowerCase("it-IT");
      return hay.includes(q);
    });
  }

  function totali(rows) {
    return rows.reduce((a, r) => {
      const e = reg(r.nome);
      return {
        v: a.v + num(r["n-volontari"]),
        m: a.m + num(r["n-mezzi"]),
        rv: a.rv + e.v,
        rm: a.rm + e.m
      };
    }, { v: 0, m: 0, rv: 0, rm: 0 });
  }

  /* ==========================
     Template
  ========================== */

  const readOnly = () => !perms.canUpdate;

  function field(label, key, { type = "text", width = "" } = {}) {
    const isDateTime = type === "datetime-local";
    const isDate = type === "date";
    const val = isDateTime ? toInputDateTime(form[key])
              : isDate ? toInputDate(form[key])
              : (form[key] || "");
    return html`
      <div class="field" style=${width ? `width:${width}` : ""}>
        <label class="label is-small mb-1">${label}</label>
        <div class="control">
          <input class="input is-small" type=${type} .value=${val}
            ?disabled=${formBusy || readOnly()}
            @input=${e => setField(key, isDateTime ? toDbDateTime(e.target.value) : e.target.value)} />
        </div>
      </div>
    `;
  }

  function block(title, icon, body) {
    return html`
      <div class="mb-4">
        <p class="is-size-7 has-text-weight-semibold has-text-grey mb-2"
           style="text-transform:uppercase;letter-spacing:.04em">
          <span class="icon is-small"><i class="ri-${icon}"></i></span>${title}
        </p>
        ${body}
      </div>
    `;
  }

  function viewOrganizzazioni() {
    return orgPicker.template({
      value: form.organizzazioni,
      onChange: v => setField("organizzazioni", v),
      disabled: formBusy || readOnly()
    });
  }

  function viewCreazione() {
    if (!createDraft) return "";
    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${() => { if (!createBusy) chiudiCreazione(); }}></div>
        <div class="modal-card" style="max-width:520px;width:92%">
          <header class="modal-card-head">
            <p class="modal-card-title" style="font-size:1rem">
              <span class="icon mr-2"><i class="ri-group-line"></i></span>Nuova squadra dichiarata
            </p>
            <button class="delete" ?disabled=${createBusy} @click=${chiudiCreazione}></button>
          </header>

          <section class="modal-card-body">
            ${createError ? html`
              <div class="notification is-danger is-light is-small mb-3">
                <i class="ri-error-warning-line mr-1"></i> ${createError}
              </div>` : ""}

            <div class="field">
              <label class="label is-small mb-1">Nome squadra</label>
              <div class="control">
                <input class="input is-small" type="text" autofocus
                  placeholder="Es. SQUADRA IDRO 1"
                  .value=${createDraft.nome}
                  ?disabled=${createBusy}
                  @input=${e => { createDraft.nome = e.target.value; }}
                  @keydown=${e => { if (e.key === "Enter") salvaNuova(); }} />
              </div>
            </div>

            <div class="field">
              <label class="label is-small mb-1">Organizzazioni</label>
              ${orgPicker.template({
                value: createDraft.organizzazioni,
                onChange: v => { createDraft.organizzazioni = v; rerender(); },
                disabled: createBusy,
                altezza: "150px"
              })}
            </div>

            <div class="is-flex" style="gap:.75rem">
              <div class="field" style="width:140px">
                <label class="label is-small mb-1">N. volontari</label>
                <div class="control">
                  <input class="input is-small" type="number" min="0"
                    .value=${createDraft["n-volontari"]}
                    ?disabled=${createBusy}
                    @input=${e => { createDraft["n-volontari"] = e.target.value; }} />
                </div>
              </div>
              <div class="field" style="width:140px">
                <label class="label is-small mb-1">N. mezzi</label>
                <div class="control">
                  <input class="input is-small" type="number" min="0"
                    .value=${createDraft["n-mezzi"]}
                    ?disabled=${createBusy}
                    @input=${e => { createDraft["n-mezzi"] = e.target.value; }} />
                </div>
              </div>
            </div>

            <p class="help">
              Mansione, caposquadra, servizio e periodo si compilano subito dopo,
              nella scheda.
            </p>
          </section>

          <footer class="modal-card-foot" style="justify-content:flex-end;gap:.5rem">
            <button class="button is-small" ?disabled=${createBusy}
              @click=${chiudiCreazione}>Annulla</button>
            <button class="button is-small is-primary ${createBusy ? "is-loading" : ""}"
              ?disabled=${createBusy} @click=${salvaNuova}>
              <span class="icon"><i class="ri-check-line"></i></span>
              <span>Crea</span>
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  function viewForm() {
    if (!selected) {
      return html`
        <div class="has-text-centered has-text-grey" style="padding:3rem 1rem">
          <span class="icon is-large"><i class="ri-group-line ri-2x"></i></span>
          <p class="mt-2 mb-3 is-size-7">Seleziona una squadra dall'elenco.</p>
          <button class="button is-small is-primary"
            ?disabled=${!perms.canCreate} @click=${apriCreazione}>
            <span class="icon"><i class="ri-add-line"></i></span>
            <span>Nuova squadra</span>
          </button>
        </div>
      `;
    }

    const dirty = isDirty();

    return html`
      <div style="padding:1rem">

        <div class="is-flex is-align-items-center mb-4" style="gap:.5rem;flex-wrap:wrap">
          <button class="button is-small is-primary ${formBusy ? "is-loading" : ""}"
            ?disabled=${formBusy || deleteBusy || readOnly() || !dirty} @click=${save}>
            <span class="icon"><i class="ri-save-line"></i></span>
            <span>Salva</span>
          </button>

          ${!deleteConfirm ? html`
            <button class="button is-small is-danger is-light"
              ?disabled=${formBusy || deleteBusy || !perms.canDelete}
              @click=${() => { deleteConfirm = true; deleteUsage = null; deleteBlocked = false; checkDeleteUsage(); }}>
              <span class="icon"><i class="ri-delete-bin-6-line"></i></span>
              <span>Elimina</span>
            </button>
          ` : deleteUsage?.checking ? html`
            <span class="is-size-7 has-text-grey">Verifica risorse collegate…</span>
          ` : deleteBlocked ? html`
            <span class="is-size-7" style="color:#c0392b">
              <strong>Non eliminabile</strong> — referenziata da
              ${deleteUsage.v > 0 ? html`<strong>${deleteUsage.v} volontar${deleteUsage.v === 1 ? "io" : "i"}</strong>` : ""}
              ${deleteUsage.v > 0 && (deleteUsage.m > 0 || deleteUsage.mat > 0) ? ", " : ""}
              ${deleteUsage.m > 0 ? html`<strong>${deleteUsage.m} mezz${deleteUsage.m === 1 ? "o" : "i"}</strong>` : ""}
              ${deleteUsage.m > 0 && deleteUsage.mat > 0 ? ", " : ""}
              ${deleteUsage.mat > 0 ? html`<strong>${deleteUsage.mat} material${deleteUsage.mat === 1 ? "e" : "i"}</strong>` : ""}.
              <button class="delete is-small ml-2"
                @click=${() => { deleteConfirm = false; deleteUsage = null; rerender(); }}></button>
            </span>
          ` : html`
            <span class="is-size-7" style="color:#c0392b">Nessuna risorsa collegata. Confermi?</span>
            <button class="button is-danger is-small ${deleteBusy ? "is-loading" : ""}"
              ?disabled=${deleteBusy} @click=${del}>Sì, elimina</button>
            <button class="button is-small" ?disabled=${deleteBusy}
              @click=${() => { deleteConfirm = false; deleteUsage = null; rerender(); }}>Annulla</button>
          `}

          <button class="button is-small" ?disabled=${formBusy || deleteBusy || !perms.canCreate}
            @click=${apriCreazione}>
            <span class="icon"><i class="ri-add-line"></i></span>
            <span>Nuova</span>
          </button>

          ${readOnly() ? html`
            <span class="tag is-light">
              <span class="icon is-small"><i class="ri-lock-line"></i></span>
              <span>Sola lettura</span>
            </span>` : ""}

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

        ${block("Squadra", "group-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("Nome", "nome", { width: "240px" })}
            <div class="field" style="width:260px">
              <label class="label is-small mb-1">Mansione prevalente</label>
              <div class="control"><div class="select is-small is-fullwidth">
                <select ?disabled=${formBusy || readOnly()}
                  @change=${e => setField("mansione-principale", e.target.value)}>
                  <option value="" ?selected=${!norm(form["mansione-principale"])}>—</option>
                  ${MANSIONI.map(m => html`
                    <option value=${m} ?selected=${norm(form["mansione-principale"]) === m}>${m}</option>`)}
                </select>
              </div></div>
            </div>
          </div>
        `)}

        ${block("Provenienza", "building-line", viewOrganizzazioni())}

        ${block("Consistenza", "team-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("N. volontari", "n-volontari", { type: "number", width: "140px" })}
            ${field("N. mezzi", "n-mezzi", { type: "number", width: "140px" })}
          </div>
          ${selected ? (() => {
            const e = reg(form.nome);
            const dv = num(form["n-volontari"]), dm = num(form["n-mezzi"]);
            return html`
              <table class="table is-narrow is-size-7 mb-3" style="width:auto">
                <thead>
                  <tr><th></th><th>Dichiarati</th><th>Registrati</th><th></th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Volontari</td><td>${dv}</td><td>${e.v}</td>
                    <td>${dv - e.v > 0
                      ? html`<span style="color:#b45309">mancano ${dv - e.v}</span>` : ""}</td>
                  </tr>
                  <tr>
                    <td>Mezzi</td><td>${dm}</td><td>${e.m}</td>
                    <td>${dm - e.m > 0
                      ? html`<span style="color:#b45309">mancano ${dm - e.m}</span>` : ""}</td>
                  </tr>
                </tbody>
              </table>
              <p class="help mb-3">
                Registrati = risorse che portano « ${norm(form.nome) || "—"} » nel campo squadra.
                I nominativi possono arrivare anche a consuntivo.
              </p>
            `;
          })() : ""}

          <div class="field">
            <label class="label is-small mb-1">Attrezzature</label>
            <div class="control">
              <textarea class="textarea is-small" rows="2"
                placeholder="Es. 2 motopompe, 1 gruppo elettrogeno, 300 sacchi"
                .value=${form.attrezzature || ""}
                ?disabled=${formBusy || readOnly()}
                @input=${e => setField("attrezzature", e.target.value)}></textarea>
            </div>
          </div>
        `)}

        ${block("Referente", "user-star-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("Cognome", "cognome-referente", { width: "200px" })}
            ${field("Nome", "nome-referente", { width: "200px" })}
            ${field("Cellulare", "cellulare-referente", { width: "160px" })}
          </div>
        `)}

        ${block("Impiego", "pushpin-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            <div class="field" style="width:260px">
              <label class="label is-small mb-1">Servizio</label>
              <div class="control"><div class="select is-small is-fullwidth">
                <select ?disabled=${formBusy || readOnly()}
                  @change=${e => setField("servizio", e.target.value)}>
                  <option value="" ?selected=${!norm(form.servizio)}>—</option>
                  ${servizi.map(v => html`
                    <option value=${v} ?selected=${norm(form.servizio) === v}>${v}</option>`)}
                  ${norm(form.servizio) && !servizi.includes(norm(form.servizio))
                    ? html`<option value=${norm(form.servizio)} selected>
                             ${norm(form.servizio)} (fuori lista)
                           </option>`
                    : ""}
                </select>
              </div></div>
            </div>
            ${field("Turno", "turno", { width: "160px" })}
          </div>
        `)}

        ${block("Periodo", "calendar-line", html`
          <div class="is-flex" style="gap:.75rem;flex-wrap:wrap">
            ${field("Inizio attestato", "data-inizio-attestato", { type: "date", width: "170px" })}
            ${field("Fine attestato", "data-fine-attestato", { type: "date", width: "170px" })}
            ${field("Registrazione", "data/ora-registrazione", { type: "datetime-local", width: "220px" })}
            ${field("Uscita definitiva", "data/ora-uscita-definitiva", { type: "datetime-local", width: "220px" })}
          </div>
        `)}

        ${block("Note", "sticky-note-line", html`
          <div class="field">
            <div class="control">
              <textarea class="textarea is-small" rows="4"
                .value=${form.note || ""}
                ?disabled=${formBusy || readOnly()}
                @input=${e => setField("note", e.target.value)}></textarea>
            </div>
          </div>
        `)}

      </div>
    `;
  }

  function viewList() {
    const rows = filtered();
    const t = totali(rows);

    return html`
      <div style="border-right:1px solid #dbdbdb;display:flex;flex-direction:column;min-height:0">

        <div style="padding:.75rem;border-bottom:1px solid #dbdbdb">
          <input class="input is-small mb-2" type="text" placeholder="Cerca…"
            .value=${search} @input=${e => { search = e.target.value; rerender(); }} />

          <div class="select is-small is-fullwidth mb-2">
            <select @change=${e => { filtroStato = e.target.value; rerender(); }}>
              <option value="" ?selected=${filtroStato === ""}>Tutti gli stati</option>
              ${STATI.map(v => html`
                <option value=${v} ?selected=${filtroStato === v}>${v}</option>`)}
            </select>
          </div>

          ${servizi.length ? html`
            <div class="select is-small is-fullwidth mb-2">
              <select @change=${e => { filtroServizio = e.target.value; rerender(); }}>
                <option value="" ?selected=${filtroServizio === ""}>Tutti i servizi</option>
                ${servizi.map(v => html`
                  <option value=${v} ?selected=${filtroServizio === v}>${v}</option>`)}
              </select>
            </div>` : ""}

          <div class="is-flex" style="gap:.4rem">
            <button class="button is-small is-primary is-fullwidth"
              ?disabled=${!perms.canCreate} @click=${apriCreazione}>
              <span class="icon"><i class="ri-add-line"></i></span>
              <span>Nuova squadra</span>
            </button>
            <button class="button is-small" title="Ricarica" ?disabled=${loading} @click=${load}>
              <span class="icon"><i class="ri-refresh-line"></i></span>
            </button>
          </div>
        </div>

        <div class="has-text-grey is-size-7"
          style="padding:.4rem .75rem;border-bottom:1px solid #f0f0f0;background:#fafafa">
          <strong>${rows.length}</strong> squadre ·
          dichiarati <strong>${t.v}</strong>👤 <strong>${t.m}</strong>🚚 ·
          registrati <strong>${t.rv}</strong>👤 <strong>${t.rm}</strong>🚚
          ${registratiCaricati && (t.v - t.rv) > 0
            ? html`<span style="color:#b45309"> · mancano ${t.v - t.rv} nominativi</span>`
            : ""}
        </div>

        <div style="flex:1;overflow:auto;min-height:0">
          ${loading
            ? html`<progress class="progress is-small m-3" style="width:auto"></progress>`
            : rows.length === 0
              ? html`<p class="has-text-grey is-size-7 p-4 has-text-centered">
                       ${records.length === 0 ? "Nessuna squadra registrata." : "Nessun risultato."}
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
                          style=${`display:inline-block;width:8px;height:8px;border-radius:50%;background:${STATO_COLOR[st]};flex-shrink:0`}></span>
                        <strong class="is-size-7" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                          ${norm(r.nome) || "(senza nome)"}
                        </strong>
                      </div>
                      <div class="is-size-7 has-text-grey" style="margin-left:1.2rem">
                        ${splitOrg(r.organizzazioni).join(" · ") || "—"}
                      </div>
                      <div class="is-size-7 has-text-grey" style="margin-left:1.2rem">
                        ${num(r["n-volontari"])}👤 ${num(r["n-mezzi"])}🚚
                        ${(() => {
                          const e = reg(r.nome);
                          const manca = num(r["n-volontari"]) - e.v;
                          if (!registratiCaricati) return "";
                          if (e.v === 0 && e.m === 0)
                            return html`<span class="tag is-light" style="font-size:.6rem">nessun nominativo</span>`;
                          if (manca > 0)
                            return html`<span class="tag is-warning is-light" style="font-size:.6rem">${e.v}/${num(r["n-volontari"])} nominativi</span>`;
                          return html`<span class="tag is-success is-light" style="font-size:.6rem">nominativi completi</span>`;
                        })()}
                        ${norm(r.servizio) ? html` · ${norm(r.servizio)}` : ""}
                        ${fmtDate(r["data-inizio-attestato"])
                          ? html` · dal ${fmtDate(r["data-inizio-attestato"])}` : ""}
                      </div>
                    </a>
                  `;
                })}
        </div>
      </div>
    `;
  }

  function corpo() {
    return html`
      ${error ? html`
          <article class="message is-danger m-3">
            <div class="message-body">
              <p>${userFriendlyErrorText(error)}</p>
              <div class="buttons mt-2">
                <button class="button is-light is-small" ?disabled=${loading || retrying}
                  @click=${async () => { retrying = true; rerender(); await load(); }}>Riprova</button>
              </div>
              <details class="mt-2">
                <summary>Dettagli tecnici</summary>
                <pre style="white-space:pre-wrap;margin:0">${JSON.stringify(
                  { status: error.status, code: error.code, message: error.message, kind: error.kind },
                  null, 2)}</pre>
              </details>
            </div>
          </article>` : ""}

      <div style="display:flex;min-height:520px;align-items:stretch">
        <div style="width:320px;flex-shrink:0;display:flex;flex-direction:column">
          ${viewList()}
        </div>
        <div style="flex:1;min-width:0;overflow:auto">
          ${viewForm()}
        </div>
      </div>
    `;
  }

  function view() {
    const comune = html`
      ${viewCreazione()}
    `;

    if (embedded) return html`${comune}${corpo()}`;

    return html`
      ${comune}
      <div class="box spa-title-box" style="padding:0;overflow:hidden;margin:0 0 1rem 0">
        <div style="padding:.75rem 1rem;border-bottom:1px solid #dbdbdb">
          <h3 class="title is-5 mb-0">
            <span class="icon is-medium" style="vertical-align:middle;margin-right:.4rem">
              <i class="ri-group-line ri-lg"></i>
            </span>Squadre dichiarate
          </h3>
        </div>
        ${corpo()}
      </div>
    `;
  }

  async function start() {
    await loadPerms();
    load();
  }

  return { template: view, start, reload: load };
}

/* ==========================
   SPA autonoma
   Resta disponibile come pagina a se': la gestione squadre vive dentro
   intervention-manager, ma il pannello non e' legato a quel contesto.
========================== */

export async function TeamManager({ client, html, render, root }) {
  let panel;
  const rerender = () => render(panel.template(), root);
  panel = await createTeamPanel({ client, html, rerender });
  await panel.start();
  return panel.template();
}
