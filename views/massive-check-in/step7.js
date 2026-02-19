// views/massive-check-in/step7.js

function safe(v) {
  return String(v ?? "").trim();
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

const DEFAULT_SERVIZIO = "IN ATTESA DI SERVIZIO";

function formatErr(e) {
  const payload = e && e.payload ? e.payload : null;
  if (payload && typeof payload === "object") return JSON.stringify(payload);
  return String((e && (e.message || e)) || "Unknown error");
}

function isActiveForToday(rec, todayDate) {
  const start = safe(rec["data-inizio-attestato"]);
  const end = safe(rec["data-fine-attestato"]);

  if (!start) return false;
  if (start === todayDate) return true;
  if (start < todayDate && !end) return true;

  return false;
}

function buildMaterialiInsertRow(selectionOrg, r) {
  const now = new Date();
  const dateTime = now
    .toLocaleString("sv-SE", { hour12: false })
    .replace(",", "");
  const dateOnly = dateTime.slice(0, 10);

  const row = {
    "id-materiale": safe(r["id-materiale"]),
    organizzazione: safe(selectionOrg?.name),
    "codice-organizzazione": safe(selectionOrg?.code),
    provincia: safe(selectionOrg?.province),
    "data/ora-registrazione": dateTime,
    "data-inizio-attestato": dateOnly
  };

  const inv = safe(r["codice-inventario"]);
  const categoria = safe(r.categoria);
  const tipologia = safe(r.tipologia);
  const marca = safe(r.marca);
  const modello = safe(r.modello);
  const note = safe(r.note);
  const note2 = safe(r["note-ulteriori"]);
  const turno = safe(r.turno);

  if (inv) row["codice-inventario"] = inv;
  if (categoria) row.categoria = categoria;
  if (tipologia) row.tipologia = tipologia;
  if (marca) row.marca = marca;
  if (modello) row.modello = modello;
  if (note) row.note = note;
  if (note2) row["note-ulteriori"] = note2;
  if (turno) row.turno = turno;

  // ✅ servizio sempre valorizzato (default incluso)
  row.servizio = safe(r.servizio) || DEFAULT_SERVIZIO;

  return row;
}

export async function Step7({ state, client, goTo, html, render, root }) {
  const selection = state.materialiSelection || { org: {}, materiali: [] };
  const org = selection.org || {};
  const input = Array.isArray(selection.materiali) ? selection.materiali : [];

  let loadingExisting = true;
  let checkingError = null;

  let submitting = false;
  let submitSummary = null;

  // ✅ servizi
  let loadingServizi = true;
  let serviziError = null;
  let serviziOptions = [DEFAULT_SERVIZIO];

  let rows = input.map(m => ({
    "id-materiale": safe(m["id-materiale"]),

    "codice-inventario": safe(m["codice-inventario"]),
    categoria: safe(m.categoria),
    tipologia: safe(m.tipologia),
    marca: safe(m.marca),
    modello: safe(m.modello),
    note: safe(m.note),
    "note-ulteriori": safe(m["note-ulteriori"]),

    // ✅ servizio editabile
    servizio: DEFAULT_SERVIZIO,

    // turni
    turniOptions: Array.isArray(m.turniOptions) ? m.turniOptions.map(safe).filter(Boolean) : [],
    turno: safe(m.turno),

    exists: false,
    status: "pending",
    message: ""
  }));

  const MaterialiAPI = client.table("materiali");
  const ServiziAPI = client.table("servizi");

  async function loadServizi() {
    loadingServizi = true;
    serviziError = null;
    rerender();

    try {
      const res = await ServiziAPI.list({
        include: ["nome"],
        size: 500
      });

      const records = getRecords(res);
      const names = records.map(r => safe(r.nome)).filter(Boolean);

      const uniqueSorted = Array.from(new Set(names)).sort((a, b) =>
        a.localeCompare(b, "it", { sensitivity: "base" })
      );

      serviziOptions = [DEFAULT_SERVIZIO, ...uniqueSorted];
    } catch (e) {
      serviziError = e;
      serviziOptions = [DEFAULT_SERVIZIO];
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
        if (!r["id-materiale"]) {
          r.exists = false;
          r.status = "failed";
          r.message = "Missing id-materiale";
          rerender();
          continue;
        }

        try {
          const res = await MaterialiAPI.list({
            filters: [client.filter("id-materiale", "eq", r["id-materiale"])],
            include: ["id-materiale", "data-inizio-attestato", "data-fine-attestato"],
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
    goTo(6);
  }

  function setRowField(r, field, value) {
    if (r.exists || r.status === "exists") return;
    r[field] = value;
    rerender();
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

      if (r.status === "exists" || r.exists) {
        skipped += 1;
        continue;
      }

      if (!r["id-materiale"]) {
        failed += 1;
        r.status = "failed";
        r.message = "Missing id-materiale";
        rerender();
        continue;
      }

      try {
        const insertRow = buildMaterialiInsertRow(org, r);
        await MaterialiAPI.create(insertRow);

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
      if (r.status === "failed" && r["id-materiale"]) {
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
            class="button is-warning is-small"
            ?disabled=${submitting || loadingExisting || nFailed === 0}
            @click=${retryFailed}
          >
            Riprova solo quelli in errore (${nFailed})
          </button>

          <button
            class="button is-primary is-small"
            ?disabled=${submitting || total === 0 || loadingExisting || nPending === 0}
            @click=${confirm}
          >
            ${submitting ? "Invio in corso…" : `Inserisci materiali (${nPending})`}
          </button>
        </div>

        ${loadingServizi ? html`
          <progress class="progress is-small is-link"></progress>
          <div class="has-text-grey">Caricamento servizi…</div>
        ` : ""}

        ${serviziError ? html`
          <article class="message is-warning">
            <div class="message-body">
              Impossibile caricare i servizi: ${String(serviziError && (serviziError.payload || serviziError.message || serviziError))}
              <br/>
              Uso solo il valore di default: <strong>${DEFAULT_SERVIZIO}</strong>
            </div>
          </article>
        ` : ""}

        ${loadingExisting ? html`
          <progress class="progress is-small is-primary"></progress>
          <div class="has-text-grey">Verifica materiali già presenti…</div>
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
                <th>Materiale</th>
                <th>Servizio</th>
                <th>Dettagli</th>
                <th>Note</th>
                <th>Esito</th>
              </tr>
            </thead>

            <tbody>
              ${rows.length === 0 ? html`
                <tr><td colspan="6"><em>Nessun materiale selezionato.</em></td></tr>
              ` : ""}

              ${rows.map(r => {
                const rowReadOnly = r.exists || r.status === "exists";

                const current = safe(r.servizio) || DEFAULT_SERVIZIO;
                const hasCurrent = serviziOptions.includes(current);
                const optionsServ = hasCurrent
                  ? serviziOptions
                  : [DEFAULT_SERVIZIO, current, ...serviziOptions.filter(x => x !== DEFAULT_SERVIZIO)];

                return html`
                  <tr class=${r.status === "inserted" ? "row-selected" : ""}>
                    <td>
                      <div style="line-height:1.1">
                        <strong>${r["id-materiale"]}</strong>
                      </div>
                      <div class="has-text-grey" style="margin-top:0.25rem; font-size:0.85em;">
                        ${r["codice-inventario"] ? `Inv: ${r["codice-inventario"]}` : ""}
                      </div>
                    </td>

                    <td>
                      <div class="select is-small is-fullwidth">
                        <select
                          .value=${current}
                          ?disabled=${rowReadOnly || loadingServizi || submitting}
                          @change=${e => setRowField(r, "servizio", e.target.value)}
                        >
                          ${optionsServ.map(opt => html`<option value=${opt}>${opt}</option>`)}
                        </select>
                      </div>
                    </td>

                    <td>
                      <div class="has-text-grey" style="font-size:0.9em;">
                        ${[r.categoria, r.tipologia].filter(Boolean).join(" • ")}
                      </div>
                      <div style="margin-top:0.25rem;">
                        ${[r.marca, r.modello].filter(Boolean).join(" ")}
                      </div>
                    </td>

                    <td style="font-size:0.9em;">
                      ${r.note || ""}
                      ${r["note-ulteriori"] ? html`<div class="has-text-grey" style="margin-top:0.25rem;">${r["note-ulteriori"]}</div>` : ""}
                    </td>

                    <td>
                      ${statusTag(r)}
                      ${r.message && r.status === "failed" ? html`
                        <div class="has-text-danger" style="margin-top:0.25rem;font-size:0.9em;">
                          ${r.message}
                        </div>
                      ` : ""}
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
