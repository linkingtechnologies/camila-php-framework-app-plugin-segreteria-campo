// views/massive-check-in/step5.js

function safe(v) {
  return String(v ?? "").trim();
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

const DEFAULT_SERVIZIO = "IN ATTESA DI SERVIZIO";

function buildMezziInsertRow(selectionOrg, m) {
  const now = new Date();

  const dateTime = now
    .toLocaleString("sv-SE", { hour12: false })
    .replace(",", "");

  const dateOnly = dateTime.slice(0, 10);

  const row = {
    targa: safe(m.targa),
    organizzazione: safe(selectionOrg?.name),
    "codice-organizzazione": safe(selectionOrg?.code),
    provincia: safe(selectionOrg?.province),
    "data/ora-registrazione": dateTime,
    "data-inizio-attestato": dateOnly
  };

  const inv = safe(m["codice-inventario"] ?? m.inventario);
  const categoria = safe(m.categoria);
  const tipologia = safe(m.tipologia);
  const marca = safe(m.marca);
  const modello = safe(m.modello);
  const note = safe(m.note);

  if (inv) row["codice-inventario"] = inv;
  if (categoria) row.categoria = categoria;
  if (tipologia) row.tipologia = tipologia;
  if (marca) row.marca = marca;
  if (modello) row.modello = modello;
  if (note) row.note = note;

  const servizio = safe(m.servizio) || DEFAULT_SERVIZIO;
  const kmInizio = safe(m.kmInizioMissione);
  const kmArrivo = safe(m.kmAllArrivo);
  const kmPartenza = safe(m.kmAllaPartenza);
  const refNome = safe(m.nomeReferente);
  const refTel = safe(m.numeroTelefonoReferente);
  const provenienza = safe(m.provenienza);

  row.servizio = servizio;

  if (kmInizio) row["km-inizio-missione"] = kmInizio;
  if (kmArrivo) row["km-all'arrivo"] = kmArrivo;
  if (kmPartenza) row["km-alla-partenza"] = kmPartenza;

  if (refNome) row["nome-referente"] = refNome;
  if (refTel) row["numero-telefono-referente"] = refTel;

  if (provenienza) row.provenienza = provenienza;

  return row;
}

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

export async function Step5({ state, client, goTo, html, render, root }) {
  const selection = state.mezziSelection || { org: {}, mezzi: [] };
  const org = selection.org || {};
  const inputMezzi = Array.isArray(selection.mezzi) ? selection.mezzi : [];

  let loadingExisting = true;
  let checkingError = null;

  let submitting = false;
  let submitSummary = null;

  let loadingServizi = true;
  let serviziError = null;
  let serviziOptions = [DEFAULT_SERVIZIO];

  let rows = inputMezzi.map(m => ({
    targa: safe(m.targa),

    inventario: safe(m["codice-inventario"] ?? m.inventario),
    categoria: safe(m.categoria),
    tipologia: safe(m.tipologia),
    marca: safe(m.marca),
    modello: safe(m.modello),
    note: safe(m.note),

    exists: false,
    status: "pending",
    message: "",

    servizio: DEFAULT_SERVIZIO,
    kmInizioMissione: "",
    kmAllArrivo: "",
    kmAllaPartenza: "",
    nomeReferente: "",
    numeroTelefonoReferente: "",
    provenienza: ""
  }));

  const MezziAPI = client.table("mezzi");
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
        if (!r.targa) {
          r.exists = false;
          r.status = "failed";
          r.message = "Missing targa";
          rerender();
          continue;
        }

        try {
          const res = await MezziAPI.list({
            filters: [client.filter("targa", "eq", r.targa)],
            include: ["targa", "data-inizio-attestato", "data-fine-attestato"],
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
    goTo(4);
  }

  function resetStateAndRestart() {
    try {
      if (state && typeof state.reset === "function") {
        state.reset();
      } else if (state && typeof state === "object") {
        for (const k of Object.keys(state)) {
          try {
            const v = state[k];
            if (typeof v === "function") continue;
            delete state[k];
          } catch (_) {}
        }
      }
    } catch (_) {}

    goTo(0);
  }

  function setRowField(r, field, value) {
    // ✅ se già presente, riga in sola lettura
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

      if (!r.targa) {
        failed += 1;
        r.status = "failed";
        r.message = "Missing targa";
        rerender();
        continue;
      }

      try {
        const insertRow = buildMezziInsertRow(org, r);
        await MezziAPI.create(insertRow);

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
      if (r.status === "failed" && r.targa) {
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

    // Nuovo inserimento massivo: abilitato SOLO se non ci sono pending
    const canRestart = !submitting && !loadingExisting && nPending === 0;

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
            ${submitting ? "Invio in corso…" : `Inserisci mezzi (${nPending})`}
          </button>

          <button
            class="button is-link is-light is-small"
            ?disabled=${!canRestart}
            @click=${resetStateAndRestart}
            title=${canRestart
              ? "Riparte con un nuovo check-in massivo"
              : "Non puoi iniziare un nuovo check-in massivo finché ci sono mezzi da inserire (pending)"}
          >
            Nuovo check-in massivo
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
          <div class="has-text-grey">Verifica mezzi già presenti…</div>
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
                <th>Mezzo</th>
                <th>Servizio</th>
                <th>Km (inizio/arrivo/partenza)</th>
                <th>Referente (nome / tel.)</th>
                <th>Provenienza</th>
                <th>Esito</th>
              </tr>
            </thead>

            <tbody>
              ${rows.length === 0 ? html`
                <tr><td colspan="6"><em>Nessun mezzo selezionato.</em></td></tr>
              ` : ""}

              ${rows.map(r => {
                const rowReadOnly = r.exists || r.status === "exists";

                const current = safe(r.servizio) || DEFAULT_SERVIZIO;
                const hasCurrent = serviziOptions.includes(current);
                const options = hasCurrent
                  ? serviziOptions
                  : [DEFAULT_SERVIZIO, current, ...serviziOptions.filter(x => x !== DEFAULT_SERVIZIO)];

                return html`
                  <tr class=${r.status === "inserted" ? "row-selected" : ""}>
                    <td>
                      <div style="line-height:1.1">
                        <strong>${r.targa}</strong>
                      </div>
                      <div class="has-text-grey" style="margin-top:0.25rem; font-size:0.85em;">
                        ${[r.marca, r.modello].filter(Boolean).join(" ")}
                        ${r.inventario ? ` • ${r.inventario}` : ""}
                      </div>
                    </td>

                    <td>
                      <div class="select is-small is-fullwidth">
                        <select
                          .value=${current}
                          ?disabled=${rowReadOnly || loadingServizi || submitting}
                          @change=${e => setRowField(r, "servizio", e.target.value)}
                        >
                          ${options.map(opt => html`<option value=${opt}>${opt}</option>`)}
                        </select>
                      </div>
                    </td>

                    <td>
                      <div class="field" style="margin-bottom:0.5rem">
                        <input
                          class="input is-small"
                          placeholder="Km inizio missione"
                          .value=${r.kmInizioMissione}
                          ?disabled=${rowReadOnly}
                          @input=${e => setRowField(r, "kmInizioMissione", e.target.value)}
                        />
                      </div>
                      <div class="field" style="margin-bottom:0.5rem">
                        <input
                          class="input is-small"
                          placeholder="Km all'arrivo"
                          .value=${r.kmAllArrivo}
                          ?disabled=${rowReadOnly}
                          @input=${e => setRowField(r, "kmAllArrivo", e.target.value)}
                        />
                      </div>
                      <div class="field" style="margin-bottom:0;">
                        <input
                          class="input is-small"
                          placeholder="Km alla partenza"
                          .value=${r.kmAllaPartenza}
                          ?disabled=${rowReadOnly}
                          @input=${e => setRowField(r, "kmAllaPartenza", e.target.value)}
                        />
                      </div>
                    </td>

                    <td>
                      <div class="field" style="margin-bottom:0.5rem">
                        <input
                          class="input is-small"
                          placeholder="Nome referente"
                          .value=${r.nomeReferente}
                          ?disabled=${rowReadOnly}
                          @input=${e => setRowField(r, "nomeReferente", e.target.value)}
                        />
                      </div>
                      <div class="field" style="margin-bottom:0;">
                        <input
                          class="input is-small"
                          placeholder="Telefono referente"
                          .value=${r.numeroTelefonoReferente}
                          ?disabled=${rowReadOnly}
                          @input=${e => setRowField(r, "numeroTelefonoReferente", e.target.value)}
                        />
                      </div>
                    </td>

                    <td>
                      <input
                        class="input is-small"
                        placeholder="Provenienza"
                        .value=${r.provenienza}
                        ?disabled=${rowReadOnly}
                        @input=${e => setRowField(r, "provenienza", e.target.value)}
                      />
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
