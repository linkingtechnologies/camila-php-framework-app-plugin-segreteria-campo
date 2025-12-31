// views/massive-check-in/step3.js

function safe(v) {
  return String(v ?? "").trim();
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function buildVolontariInsertRow(selectionOrg, v) {
  // Prepare insert row for the "volontari" table (ID assigned by API).
  const now = new Date();

const dateTime = now
  .toLocaleString("sv-SE", { hour12: false })
  .replace(",", "");

const dateOnly = dateTime.slice(0, 10);

  return {
    "codice-fiscale": safe(v.cf),
    "cognome": safe(v.cognome),
    "nome": safe(v.nome),
    "organizzazione": safe(selectionOrg?.name),
    "codice-organizzazione": safe(selectionOrg?.code),
    "provincia": safe(selectionOrg?.province),
	"data/ora-registrazione": dateTime,
    "data-inizio-attestato": dateOnly,
	"servizio": "IN ATTESA DI SERVIZIO"
  };
}

function formatErr(e) {
  const payload = e && e.payload ? e.payload : null;
  if (payload && typeof payload === "object") return JSON.stringify(payload);
  return String(e && (e.message || e) || "Unknown error");
}

export async function Step3({ state, client, goTo, html, render, root }) {
  // Expected state.checkinSelection structure:
  // {
  //   org: { name, code, province },
  //   volunteers: [{ cf, cognome, nome }]
  // }

  const selection = state.checkinSelection || { org: {}, volunteers: [] };
  const org = selection.org || {};
  const inputVolunteers = Array.isArray(selection.volunteers) ? selection.volunteers : [];

  let loadingExisting = true;
  let checkingError = null;

  let submitting = false;
  let submitSummary = null;

  // status: "pending" | "exists" | "inserted" | "failed"
  let rows = inputVolunteers.map(v => ({
    cf: safe(v.cf),
    cognome: safe(v.cognome),
    nome: safe(v.nome),
    exists: false,
    status: "pending",
    message: ""
  }));

  const VolontariAPI = client.table("volontari");

  async function checkExisting() {
    loadingExisting = true;
    checkingError = null;
    rerender();

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
            include: ["codice-fiscale"],
            size: 1
          });

          const found = getRecords(res);
          if (found.length > 0) {
            r.exists = true;
            r.status = "exists";
            r.message = "Già presente";
          } else {
            r.exists = false;
            r.status = "pending";
            r.message = "";
          }
        } catch (e) {
          // If check fails, keep it insertable but note the issue.
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

  function restart() {
    // Reset wizard state completely and go back to Step 1.
    state.step2Selected = [];
    state.checkinSelection = null;
    state.volontariInsertPayload = null;

    state.preTurnoFilter = "";

    state.org = {
      name: "",
      code: "",
      province: ""
    };

    goTo(1);
  }

  async function insertWhere(predicate) {
    if (submitting) return;

    submitting = true;
    submitSummary = null;
    rerender();

    let inserted = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of rows) {
      if (!predicate(r)) continue;

      // Skip already existing volunteers.
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
    // Insert only "pending" rows.
    return insertWhere(r => r.status === "pending");
  }

  function retryFailed() {
    // Retry only failed rows by resetting them to pending first.
    rows.forEach(r => {
      if (r.status === "failed" && r.cf) {
        r.status = "pending";
        r.message = "";
      }
    });
    rerender();

    return insertWhere(r => r.status === "pending");
  }

  function statusTag(r) {
    if (r.status === "exists") return html`<span class="tag is-light">Già presente</span>`;
    if (r.status === "inserted") return html`<span class="tag is-success is-light">Inserito</span>`;
    if (r.status === "failed") return html`<span class="tag is-danger is-light">Errore</span>`;
    return html`<span class="tag is-warning is-light">Da inserire</span>`;
  }

  function view() {
    const total = rows.length;
    const nExists = rows.filter(r => r.status === "exists").length;
    const nPending = rows.filter(r => r.status === "pending").length;
    const nInserted = rows.filter(r => r.status === "inserted").length;
    const nFailed = rows.filter(r => r.status === "failed").length;

    return html`
      <div class="box">
        <h2 class="subtitle">Step 3 — Conferma</h2>

        <p>
          <strong>${safe(org.name)}</strong>
          ${org.code ? html`<span class="tag ml-2">${safe(org.code)}</span>` : ""}
          ${org.province ? html`<span class="tag is-light ml-2">${safe(org.province)}</span>` : ""}
        </p>

        <div class="buttons mt-3">
          <button class="button is-light is-small" @click=${back} ?disabled=${submitting}>
            Indietro
          </button>

          <button
            class="button is-primary is-small"
            ?disabled=${submitting || total === 0 || loadingExisting || nPending === 0}
            @click=${confirm}
          >
            ${submitting ? "Invio in corso…" : `Inserisci (${nPending})`}
          </button>

          <button
            class="button is-warning is-small"
            ?disabled=${submitting || loadingExisting || nFailed === 0}
            @click=${retryFailed}
          >
            Riprova solo quelli in errore (${nFailed})
          </button>

          <button
            class="button is-danger is-light is-small"
            @click=${restart}
            ?disabled=${submitting}
          >
            Ricomincia
          </button>
        </div>

        ${loadingExisting ? html`
          <progress class="progress is-small is-primary"></progress>
          <div class="has-text-grey">Verifica volontari già presenti…</div>
        ` : ""}

        ${checkingError ? html`
          <article class="message is-danger">
            <div class="message-body">
              ${String(checkingError && (checkingError.payload || checkingError.message || checkingError))}
            </div>
          </article>
        ` : ""}

        <div class="tags mt-3">
          <span class="tag is-info is-light">Totale: ${total}</span>
          <span class="tag is-light">Già presenti: ${nExists}</span>
          <span class="tag is-warning is-light">Da inserire: ${nPending}</span>
          <span class="tag is-success is-light">Inseriti: ${nInserted}</span>
          <span class="tag is-danger is-light">Errori: ${nFailed}</span>
        </div>

        ${submitSummary ? html`
          <article class="message ${submitSummary.failed ? "is-warning" : "is-success"}">
            <div class="message-body">
              Inseriti: <strong>${submitSummary.inserted}</strong> —
              Saltati (già presenti): <strong>${submitSummary.skipped}</strong> —
              Errori: <strong>${submitSummary.failed}</strong>
            </div>
          </article>
        ` : ""}

        <div class="table-container mt-4">
          <table class="table is-striped is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th>Codice fiscale</th>
                <th>Cognome</th>
                <th>Nome</th>
                <th>Esito</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? html`
                <tr><td colspan="4"><em>Nessun volontario selezionato.</em></td></tr>
              ` : ""}

              ${rows.map(r => html`
                <tr class=${r.status === "inserted" ? "row-selected" : ""}>
                  <td>${r.cf}</td>
                  <td>${r.cognome}</td>
                  <td>${r.nome}</td>
                  <td>
                    ${statusTag(r)}
                    ${r.message && r.status === "failed" ? html`
                      <div class="has-text-danger" style="margin-top:0.25rem;font-size:0.9em;">
                        ${r.message}
                      </div>
                    ` : ""}
                  </td>
                </tr>
              `)}
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
  checkExisting();

  return view();
}
