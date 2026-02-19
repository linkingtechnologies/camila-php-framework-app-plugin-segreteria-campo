// views/massive-check-in/step3.js

function safe(v) {
  return String(v ?? "").trim();
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

/* =========================
   Config
   ========================= */

const DEFAULT_SERVIZIO = "IN ATTESA DI SERVIZIO";

const MANSIONI_CSV =
  "OPERATORE LOGISTICO,OPERATORE IDROGEOLOGICO,OPERATORE MOVIMENTO TERRA,OPERATORE INSACCHETTAMENTO,OPERATORE MOTOSEGA,OPERATORE SUB,OPERATORE CINOFILO,OPERATORE SEGRETERIA,OPERATORE SALA OPERATIVA,OPERATORE RADIO,OPERATORE NAUTICO,ELETTRICISTA,MURATORE,IDRAULICO,OPERATORE SANITARIO,OPERATORE CUCINA,OPERATORE ANTINCENDIO,OPERATORE A CAVALLO,OPERATORE SUBACQUEO";

const MANSIONI = MANSIONI_CSV.split(",").map(safe).filter(Boolean);

/* =========================
   Insert payload builder
   ========================= */

function buildVolontariInsertRow(selectionOrg, v) {
  const now = new Date();

  const dateTime = now
    .toLocaleString("sv-SE", { hour12: false })
    .replace(",", "");

  const dateOnly = dateTime.slice(0, 10);


  const row = {
    "codice-fiscale": safe(v.cf),
    "cognome": safe(v.cognome),
    "nome": safe(v.nome),
    "organizzazione": safe(selectionOrg?.name),
    "codice-organizzazione": safe(selectionOrg?.code),
    "provincia": safe(selectionOrg?.province),
    "data/ora-registrazione": dateTime,
    "data-inizio-attestato": dateOnly
  };

  // ====== mapping editabili (come da tua lista) ======
  const mansione = safe(v.mansione);
  const servizio = safe(v.servizio) || DEFAULT_SERVIZIO;
  const responsabile = safe(v.responsabile) || "NO";
  const cellulare = safe(v.cellulare);
  const autista = safe(v.autista) || "NO";
  const benefici = safe(v.beneficiLegge) || "NO";
  const numGg = safe(v.numGgBenefici);

  if (mansione) row["mansione"] = mansione;

  // servizio sempre valorizzato col default
  row["servizio"] = servizio;

  // SI/NO default NO
  row["responsabile"] = responsabile;
  row["autista"] = autista;
  row["benefici-di-legge"] = benefici;

  if (cellulare) row["cellulare"] = cellulare;

  // solo se benefici = SI
  if (benefici === "SI" && numGg) {
    row["num-gg-ben-legge"] = numGg;
  }

  return row;
}

function formatErr(e) {
  const payload = e && e.payload ? e.payload : null;
  if (payload && typeof payload === "object") return JSON.stringify(payload);
  return String((e && (e.message || e)) || "Unknown error");
}

/**
 * Record considerato "già presente" se:
 * - data-inizio-attestato === oggi
 * - oppure data-inizio-attestato < oggi AND data-fine-attestato vuota
 */
function isActiveForToday(rec, todayDate) {
  const start = safe(rec["data-inizio-attestato"]);
  const end = safe(rec["data-fine-attestato"]);

  if (!start) return false;
  if (start === todayDate) return true;
  if (start < todayDate && !end) return true;

  return false;
}

export async function Step3({ state, client, goTo, html, render, root }) {
  const selection = state.checkinSelection || { org: {}, volunteers: [] };
  const org = selection.org || {};
  const inputVolunteers = Array.isArray(selection.volunteers)
    ? selection.volunteers
    : [];

  let loadingExisting = true;
  let checkingError = null;

  let loadingServizi = true;
  let serviziError = null;
  let serviziOptions = []; // array di stringhe (campo nome), con DEFAULT in testa

  let submitting = false;
  let submitSummary = null;

  // Messaggio blocco step4
  let mezziBlockMsg = null;

  // status: "pending" | "exists" | "inserted" | "failed"
  let rows = inputVolunteers.map(v => ({
    cf: safe(v.cf),
    cognome: safe(v.cognome),
    nome: safe(v.nome),
    exists: false,
    status: "pending",
    message: "",

    mansione: "",
    servizio: DEFAULT_SERVIZIO,
    responsabile: "NO",
    autista: "NO",
    cellulare: "",
    beneficiLegge: "NO",
    numGgBenefici: ""
  }));

  const VolontariAPI = client.table("volontari");
  const ServiziAPI = client.table("servizi");

  async function loadServizi() {
    loadingServizi = true;
    serviziError = null;
    rerender();

    try {
      const res = await ServiziAPI.list({
        include: ["nome"],
        size: 5000
      });

      const recs = getRecords(res);
      const set = new Set();

      recs.forEach(r => {
        const nome = safe(r["nome"]);
        if (nome) set.add(nome);
      });

      const others = Array.from(set.values())
        .filter(s => s && s !== DEFAULT_SERVIZIO)
        .sort((a, b) => a.localeCompare(b, "it"));

      serviziOptions = [DEFAULT_SERVIZIO, ...others];

      rows.forEach(r => {
        if (!safe(r.servizio)) r.servizio = DEFAULT_SERVIZIO;
      });
    } catch (e) {
      serviziError = e;
      serviziOptions = [DEFAULT_SERVIZIO];

      rows.forEach(r => {
        if (!safe(r.servizio)) r.servizio = DEFAULT_SERVIZIO;
      });
    } finally {
      loadingServizi = false;
      rerender();
    }
  }

  async function checkExisting() {
    loadingExisting = true;
    checkingError = null;
    rerender();

    const todayDate = new Date()
      .toLocaleString("sv-SE", { hour12: false })
      .replace(",", "")
      .slice(0, 10);

    try {
      for (const r of rows) {
        if (!r.cf) {
          r.exists = false;
          r.status = "failed";
          r.message = "Missing codice fiscale";
          rerender();
          continue;
        }

        try {
          const res = await VolontariAPI.list({
            filters: [client.filter("codice-fiscale", "eq", r.cf)],
            include: [
              "codice-fiscale",
              "data-inizio-attestato",
              "data-fine-attestato"
            ],
            size: 50
          });

          const found = getRecords(res);
          const active = found.some(rec => isActiveForToday(rec, todayDate));

          if (active) {
            r.exists = true;
            r.status = "exists";
            r.message = "Già presente";
          } else {
            r.exists = false;
            r.status = "pending";
            r.message = "";
          }
        } catch (e) {
          r.exists = false;
          r.status = "pending";
          r.message = "Impossibile verificare (proverò a inserire)";
        }

        rerender();
      }
    } catch (e) {
      checkingError = e;
    } finally {
      loadingExisting = false;
      rerender();
    }
  }

  function back() {
    goTo(2);
  }

  function canProceedToMezzi() {
    const pending = rows.filter(r => r.status === "pending" && !r.exists);
    return pending.length === 0;
  }

  function goToMezzi() {
    mezziBlockMsg = null;

    if (submitting || loadingExisting) {
      mezziBlockMsg =
        "Attendi il completamento delle operazioni in corso prima di proseguire.";
      rerender();
      return;
    }

    if (!canProceedToMezzi()) {
      const nPendingLocal = rows.filter(
        r => r.status === "pending" && !r.exists
      ).length;
      mezziBlockMsg =
        `Prima di inserire i mezzi devi completare l’inserimento dei volontari non già presenti. ` +
        `Volontari ancora da inserire: ${nPendingLocal}.`;
      rerender();
      return;
    }

    goTo(4);
  }

  function setRowField(r, field, value) {
    // ✅ se già presente, riga in sola lettura
    if (r.exists || r.status === "exists") return;

    mezziBlockMsg = null;
    r[field] = value;

    if (field === "beneficiLegge" && value !== "SI") {
      r.numGgBenefici = "";
    }

    rerender();
  }

  async function insertWhere(predicate) {
    if (submitting) return;

    submitting = true;
    submitSummary = null;
    mezziBlockMsg = null;
    rerender();

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of rows) {
      if (!predicate(r)) continue;

      if (r.status === "exists" || r.exists) {
        skipped += 1;
        continue;
      }

      if (!r.cf) {
        failed += 1;
        r.status = "failed";
        r.message = "Missing codice fiscale";
        rerender();
        continue;
      }

      try {
        const insertRow = buildVolontariInsertRow(org, r);
        await VolontariAPI.create(insertRow);

        inserted += 1;
        r.status = "inserted";
        r.message = "Inserito";
      } catch (e) {
        failed += 1;
        r.status = "failed";
        r.message = formatErr(e);
      }

      rerender();
    }

    submitSummary = { inserted, skipped, failed };
    submitting = false;
    rerender();
  }

  function confirm() {
    return insertWhere(r => r.status === "pending");
  }

  function retryFailed() {
    rows.forEach(r => {
      if (r.status === "failed" && r.cf) {
        r.status = "pending";
        r.message = "";
      }
    });
    mezziBlockMsg = null;
    rerender();

    return insertWhere(r => r.status === "pending");
  }

  function statusTag(r) {
    if (r.status === "exists")
      return html`<span class="tag is-light">Già presente</span>`;
    if (r.status === "inserted")
      return html`<span class="tag is-success is-light">Inserito</span>`;
    if (r.status === "failed")
      return html`<span class="tag is-danger is-light">Errore</span>`;
    return html`<span class="tag is-warning is-light">Da inserire</span>`;
  }

  function siNoSelect(value, onChange, disabled = false) {
    return html`
      <div class="select is-small is-fullwidth">
        <select .value=${value} @change=${onChange} ?disabled=${disabled}>
          <option value="NO">NO</option>
          <option value="SI">SI</option>
        </select>
      </div>
    `;
  }

  function view() {
    const total = rows.length;
    const nExists = rows.filter(r => r.status === "exists").length;
    const nPending = rows.filter(r => r.status === "pending").length;
    const nInserted = rows.filter(r => r.status === "inserted").length;
    const nFailed = rows.filter(r => r.status === "failed").length;

    const mezziDisabled = submitting || loadingExisting || !canProceedToMezzi();

    return html`
      <div class="box">
        <p>
          <strong>${safe(org.name)}</strong>
          ${org.code ? html`<span class="tag ml-2">${safe(org.code)}</span>` : ""}
          ${org.province
            ? html`<span class="tag is-light ml-2">${safe(org.province)}</span>`
            : ""}
        </p>

        <div class="buttons mt-3">
          <button
            class="button is-light is-small"
            @click=${back}
            ?disabled=${submitting}
          >
            Indietro
          </button>

          <button
            class="button is-warning is-small"
            ?disabled=${submitting || loadingExisting || nFailed === 0}
            @click=${retryFailed}
          >
            Riprova solo quelli in errore (${nFailed})
          </button>

          <button
            class="button is-primary is-small"
            ?disabled=${submitting ||
            total === 0 ||
            loadingExisting ||
            nPending === 0}
            @click=${confirm}
          >
		    <span class="icon">
				<i class="ri-user-line ri-lg"></i>
			</span>
            <span>${submitting ? "Invio in corso…" : `Inserisci volontari (${nPending})`}</span>
          </button>

          <button
            class="button is-primary is-small"
            @click=${goToMezzi}
            ?disabled=${mezziDisabled}
            title=${mezziDisabled
              ? "Completa prima l’inserimento dei volontari pendenti"
              : ""}
          >
            Check-in mezzi
          </button>
        </div>

        ${mezziBlockMsg
          ? html`
              <article class="message is-warning">
                <div class="message-body">${mezziBlockMsg}</div>
              </article>
            `
          : ""}

        ${loadingExisting
          ? html`
              <progress class="progress is-small is-primary"></progress>
              <div class="has-text-grey">Verifica volontari già presenti…</div>
            `
          : ""}

        ${checkingError
          ? html`
              <article class="message is-danger">
                <div class="message-body">
                  ${String(
                    checkingError &&
                      (checkingError.payload ||
                        checkingError.message ||
                        checkingError)
                  )}
                </div>
              </article>
            `
          : ""}

        ${loadingServizi
          ? html`<div class="has-text-grey">Caricamento servizi…</div>`
          : ""}

        ${serviziError
          ? html`
              <article class="message is-warning">
                <div class="message-body">
                  Impossibile caricare la lista servizi (puoi comunque procedere).<br />
                  <small
                    >${String(
                      serviziError &&
                        (serviziError.payload ||
                          serviziError.message ||
                          serviziError)
                    )}</small
                  >
                </div>
              </article>
            `
          : ""}

        <div class="tags mt-3">
          <span class="tag is-info is-light">Totale: ${total}</span>
          <span class="tag is-light">Già presenti: ${nExists}</span>
          <span class="tag is-warning is-light">Da inserire: ${nPending}</span>
          <span class="tag is-success is-light">Inseriti: ${nInserted}</span>
          <span class="tag is-danger is-light">Errori: ${nFailed}</span>
        </div>

        ${submitSummary
          ? html`
              <article
                class="message ${submitSummary.failed
                  ? "is-warning"
                  : "is-success"}"
              >
                <div class="message-body">
                  Inseriti: <strong>${submitSummary.inserted}</strong> — Saltati
                  (già presenti): <strong>${submitSummary.skipped}</strong> —
                  Errori: <strong>${submitSummary.failed}</strong>
                </div>
              </article>
            `
          : ""}

        <div class="table-container mt-4">
          <table class="table is-striped is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th>Anagrafica</th>
                <th>Mansione / Servizio</th>
                <th>Resp. / Autista / Cellulare</th>
                <th>Benefici / Num. gg</th>
                <th>Esito</th>
              </tr>
            </thead>

            <tbody>
              ${rows.length === 0
                ? html`
                    <tr>
                      <td colspan="5"><em>Nessun volontario selezionato.</em></td>
                    </tr>
                  `
                : ""}

              ${rows.map(r => {
                const rowReadOnly = r.exists || r.status === "exists";
                const numDisabled =
                  (r.beneficiLegge || "NO") !== "SI" || rowReadOnly;

                return html`
                  <tr class=${r.status === "inserted" ? "row-selected" : ""}>
                    <td>
                      <div
                        style="display:flex; gap:0.5rem; align-items:baseline; flex-wrap:wrap; line-height:1.1"
                      >
                        <strong>${r.cognome}</strong>
                        <span>${r.nome}</span>
                      </div>
                      <div
                        class="has-text-grey"
                        style="margin-top:0.25rem; font-size:0.85em;"
                      >
                        ${r.cf}
                      </div>
                    </td>

                    <td>
                      <div class="field" style="margin-bottom:0.5rem">
                        <label
                          class="label"
                          style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;"
                          >Mansione</label
                        >
                        <div class="select is-small is-fullwidth">
                          <select
                            .value=${r.mansione}
                            @change=${e =>
                              setRowField(r, "mansione", e.target.value)}
                            ?disabled=${rowReadOnly}
                          >
                            <option value="">—</option>
                            ${MANSIONI.map(m => html`<option value=${m}>${m}</option>`)}
                          </select>
                        </div>
                      </div>

                      <div class="field" style="margin-bottom:0;">
                        <label
                          class="label"
                          style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;"
                          >Servizio</label
                        >
                        <div class="select is-small is-fullwidth">
                          <select
                            .value=${safe(r.servizio) || DEFAULT_SERVIZIO}
                            @change=${e =>
                              setRowField(r, "servizio", e.target.value)}
                            ?disabled=${rowReadOnly ||
                            loadingServizi ||
                            !!serviziError}
                          >
                            ${serviziOptions.map(s => html`<option value=${s}>${s}</option>`)}
                          </select>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div class="field" style="margin-bottom:0.5rem">
                        <label
                          class="label"
                          style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;"
                          >Responsabile</label
                        >
                        ${siNoSelect(
                          r.responsabile || "NO",
                          e => setRowField(r, "responsabile", e.target.value),
                          rowReadOnly
                        )}
                      </div>

                      <div class="field" style="margin-bottom:0.5rem">
                        <label
                          class="label"
                          style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;"
                          >Autista</label
                        >
                        ${siNoSelect(
                          r.autista || "NO",
                          e => setRowField(r, "autista", e.target.value),
                          rowReadOnly
                        )}
                      </div>

                      <div class="field" style="margin-bottom:0;">
                        <label
                          class="label"
                          style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;"
                          >Cellulare</label
                        >
                        <input
                          class="input is-small"
                          placeholder="es. 3331234567"
                          .value=${r.cellulare}
                          ?disabled=${rowReadOnly}
                          @input=${e =>
                            setRowField(r, "cellulare", e.target.value)}
                        />
                      </div>
                    </td>

                    <td>
                      <div class="field" style="margin-bottom:0.5rem">
                        <label
                          class="label"
                          style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;"
                          >Benefici</label
                        >
                        ${siNoSelect(
                          r.beneficiLegge || "NO",
                          e => setRowField(r, "beneficiLegge", e.target.value),
                          rowReadOnly
                        )}
                      </div>

                      <div class="field" style="margin-bottom:0;">
                        <label
                          class="label"
                          style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;"
                          >Num. gg</label
                        >
                        <input
                          class="input is-small"
                          placeholder="es. 2"
                          .value=${r.numGgBenefici}
                          ?disabled=${numDisabled}
                          @input=${e =>
                            setRowField(r, "numGgBenefici", e.target.value)}
                        />
                      </div>
                    </td>

                    <td>
                      ${statusTag(r)}
                      ${r.message && r.status === "failed"
                        ? html`
                            <div
                              class="has-text-danger"
                              style="margin-top:0.25rem;font-size:0.9em;"
                            >
                              ${r.message}
                            </div>
                          `
                        : ""}
                    </td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function rerender() {
    render(view(), root);
  }

  rerender();
  loadServizi();
  checkExisting();

  return view();
}
