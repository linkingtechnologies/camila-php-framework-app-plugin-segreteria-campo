// ./views/massive-check-out/step2.js
function safe(v) {
  return String(v ?? "").trim();
}

function normSpaces(v) {
  return String(v ?? "")
    .replace(/\u00A0/g, " ")   // NBSP -> spazio normale
    .replace(/\s+/g, " ")     // collassa spazi multipli / tab / newline
    .trim();
}

function normMansione(v) {
  // Se vuoi mantenerla case-sensitive, togli toUpperCase().
  // Io lo lascio, perché la tua lista è tutta maiuscola.
  return normSpaces(v).toUpperCase();
}


function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

/* =========================
   Config (copiato da check-in UI)
   ========================= */

const DEFAULT_SERVIZIO = "IN ATTESA DI SERVIZIO";

const MANSIONI_CSV =
  "OPERATORE LOGISTICO,OPERATORE IDROGEOLOGICO,OPERATORE MOVIMENTO TERRA,OPERATORE INSACCHETTAMENTO,OPERATORE MOTOSEGA,OPERATORE SUB,OPERATORE CINOFILO,OPERATORE SEGRETERIA,OPERATORE SALA OPERATIVA,OPERATORE RADIO,OPERATORE NAUTICO,ELETTRICISTA,MURATORE,IDRAULICO,OPERATORE SANITARIO,OPERATORE CUCINA,OPERATORE ANTINCENDIO,OPERATORE A CAVALLO,OPERATORE SUBACQUEO";

const MANSIONI = MANSIONI_CSV.split(",").map(normMansione).filter(Boolean);


/* =========================
   Helpers
   ========================= */

function norm(v) {
  return String(v ?? "").trim();
}

function getId(r) {
  return r?.id ?? r?._id ?? r?.ID ?? null;
}

function nowDateTime() {
  const now = new Date();
  return now.toLocaleString("sv-SE", { hour12: false }).replace(",", "");
}

function todayISO() {
  const dt = nowDateTime(); // "YYYY-MM-DD HH:mm:ss"
  return dt.slice(0, 10);
}

function formatDMY(iso) {
  const s = norm(iso);
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const [, yyyy, mm, dd] = m;
  return `${dd}/${mm}/${yyyy}`;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlight(text, q, html) {
  const t = String(text ?? "");
  const query = norm(q);
  if (!query) return t;

  const re = new RegExp(escapeRegExp(query), "ig");
  const parts = [];
  let last = 0;

  for (const m of t.matchAll(re)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;

    if (start > last) parts.push(t.slice(last, start));
    parts.push(html`<mark class="wt-hl">${t.slice(start, end)}</mark>`);
    last = end;
  }

  if (last < t.length) parts.push(t.slice(last));
  return parts.length ? parts : t;
}

function rowMatchesQuery(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const hay = [
    r.cf,
    r.cognome,
    r.nome,
    r.mansione,
    r.servizio,
    r.responsabile,
    r.autista,
    r.cellulare,
    r.beneficiLegge,
    r.numGgBenefici,
    r.dataInizio,
    r.dataFine
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

function sortByName(a, b) {
  const c = (a.cognome || "").localeCompare(b.cognome || "", "it");
  if (c !== 0) return c;
  return (a.nome || "").localeCompare(b.nome || "", "it");
}

/* =========================
   UI helpers
   ========================= */

function statusTagServizio(r, html) {
  const hasInizio = !!safe(r.dataInizio);
  const hasFine = !!safe(r.dataFine);
  if (hasInizio && !hasFine) return html`<span class="tag is-success is-light ml-2">In servizio</span>`;
  if (hasInizio && hasFine) return html`<span class="tag is-light ml-2">Non in servizio</span>`;
  return html`<span class="tag is-warning is-light ml-2">Dati incompleti</span>`;
}

function siNoSelect(value, onChange, disabled = false, html) {
  return html`
    <div class="select is-small is-fullwidth">
      <select .value=${value} @change=${onChange} ?disabled=${disabled}>
        <option value="NO">NO</option>
        <option value="SI">SI</option>
      </select>
    </div>
  `;
}

/* =========================
   Step 2 (Volontari checkout)
   ========================= */

export async function Step2({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;
  let successMsg = null;

  let rowsInServizio = [];
  let rowsNonServizio = [];
  let rowsAltri = [];

  if (!Array.isArray(state.step2SelectedIds)) state.step2SelectedIds = [];
  let selected = new Set(state.step2SelectedIds);

  if (state.s2_search_in === undefined) state.s2_search_in = "";
  if (state.s2_search_non === undefined) state.s2_search_non = "";
  let qIn = state.s2_search_in;
  let qNon = state.s2_search_non;

  const VolontariAPI = client.table("volontari");
  const MovAPI = client.table("mov-risorse");

  let busyCheckout = false;

  function rerender() {
    render(view(), root);
  }

  async function loadVolontari() {
    try {
      loading = true;
      error = null;
      successMsg = null;
      rerender();

      const res = await VolontariAPI.list({
        filters: [
          client.filter("organizzazione", "eq", state.org.name),
          client.filter("codice-organizzazione", "eq", state.org.code),
          client.filter("provincia", "eq", state.org.province)
        ],
        include: [
          "id",
          "organizzazione",
          "codice-organizzazione",
          "provincia",

          "codice-fiscale",
          "cognome",
          "nome",

          "mansione",
          "servizio",
          "responsabile",
          "autista",
          "cellulare",
          "benefici-di-legge",
          "num-gg-ben-legge",

          "data-inizio-attestato",
          "data-fine-attestato",

          "data/ora-uscita-definitiva"
        ],
        size: 5000
      });

      const recs = getRecords(res);

      const outIn = [];
      const outNon = [];
      const outAltri = [];

      for (const r of recs) {
        const cf = safe(r["codice-fiscale"]);
        if (!cf) continue;

        const row = {
          id: getId(r),

          cf,
          cognome: safe(r["cognome"] ?? r.cognome),
          nome: safe(r["nome"] ?? r.nome),

          mansione: normMansione(r["mansione"] ?? r.mansione),
          servizio: safe(r["servizio"]) || DEFAULT_SERVIZIO,
          responsabile: safe(r["responsabile"]) || "NO",
          autista: safe(r["autista"]) || "NO",
          cellulare: safe(r["cellulare"]),
          beneficiLegge: safe(r["benefici-di-legge"]) || "NO",
          numGgBenefici: safe(r["num-gg-ben-legge"]),

          dataInizio: safe(r["data-inizio-attestato"]),
          dataFine: safe(r["data-fine-attestato"]),
          dataOraUscitaDefinitiva: safe(r["data/ora-uscita-definitiva"])
        };
		

        const hasInizio = !!row.dataInizio;
        const hasFine = !!row.dataFine;

        if (hasInizio && !hasFine) outIn.push(row);
        else if (hasInizio && hasFine) outNon.push(row);
        else outAltri.push(row);
      }

      outIn.sort(sortByName);
      outNon.sort(sortByName);

      rowsInServizio = outIn;
      rowsNonServizio = outNon;
      rowsAltri = outAltri;
    } catch (e) {
      error = e;
    } finally {
      loading = false;

      const ids = new Set(rowsInServizio.map(r => r.id).filter(Boolean));
      selected = new Set([...selected].filter(id => ids.has(id)));
      state.step2SelectedIds = [...selected];

      rerender();
    }
  }

  function toggle(id, on) {
    if (!id) return;
    on ? selected.add(id) : selected.delete(id);
    state.step2SelectedIds = [...selected];
    rerender();
  }

  function deselectAll() {
    selected.clear();
    state.step2SelectedIds = [];
    rerender();
  }

  function getInFiltered() {
    let out = rowsInServizio;
    if (qIn) out = out.filter(r => rowMatchesQuery(r, qIn));
    return out;
  }

  function getNonFiltered() {
    let out = rowsNonServizio;
    if (qNon) out = out.filter(r => rowMatchesQuery(r, qNon));
    return out;
  }

  function selectVisibleIn() {
    getInFiltered().forEach(r => r.id && selected.add(r.id));
    state.step2SelectedIds = [...selected];
    rerender();
  }

  function setRowField(rowId, field, value) {
    const r = rowsInServizio.find(x => x.id === rowId);
    if (!r) return;

    // servizio è in sola lettura (verrà sovrascritto in checkout)
    if (field === "servizio") return;

	r[field] = field === "mansione" ? normMansione(value) : safe(value);


    if (field === "beneficiLegge" && value !== "SI") {
      r.numGgBenefici = "";
    }

    state.step2Draft = state.step2Draft || {};
    state.step2Draft[rowId] = state.step2Draft[rowId] || {};
    state.step2Draft[rowId][field] = r[field];

    rerender();
  }

  function applyDraft(row) {
    const d = state.step2Draft && state.step2Draft[row.id];
    if (!d) return row;

    return {
      ...row,
      mansione: d.mansione ?? row.mansione,
      responsabile: d.responsabile ?? row.responsabile,
      autista: d.autista ?? row.autista,
      cellulare: d.cellulare ?? row.cellulare,
      beneficiLegge: d.beneficiLegge ?? row.beneficiLegge,
      numGgBenefici: d.numGgBenefici ?? row.numGgBenefici
    };
  }

  async function writeMov({ dateTime, gruppo, risorsa, tiporisorsa, da, a1 }) {
    await MovAPI.create({
      "data/ora": dateTime,
      gruppo: safe(gruppo),
      risorsa: safe(risorsa),
      "tipo-risorsa": safe(tiporisorsa),
      da: safe(da),
      a: safe(a1)
    });
  }

  async function checkoutSelected() {
    if (busyCheckout || selected.size === 0) return;

    const volunteers = [...selected]
      .map(id => rowsInServizio.find(r => r.id === id))
      .filter(Boolean);

    busyCheckout = true;
    error = null;
    successMsg = null;
    rerender();

    const date = todayISO();
    const dateTime = nowDateTime();

    try {
      for (const v0 of volunteers) {
        const v = applyDraft(v0);

        const ben = safe(v.beneficiLegge) || "NO";

        const servizioPrima = safe(v0.servizio) || DEFAULT_SERVIZIO;

        await VolontariAPI.update(v.id, {
          "data-fine-attestato": date,
          "data/ora-uscita-definitiva": dateTime,
          "servizio": "USCITA DEFINITIVA",

          // persist campi UI (opzionale)
          "mansione": safe(v.mansione),
          "responsabile": safe(v.responsabile) || "NO",
          "autista": safe(v.autista) || "NO",
          "cellulare": safe(v.cellulare),

          "benefici-di-legge": ben,
          "num-gg-ben-legge": ben === "SI" ? safe(v.numGgBenefici) : ""
        });

        await writeMov({
          dateTime,
          gruppo: state?.org?.name || "",
          risorsa: v.nome + " " + v.cognome,
          tiporisorsa: "VOLONTARIO",
          da: servizioPrima,
          a1: "USCITA DEFINITIVA"
        });
      }

      successMsg = `Check-out completato: ${volunteers.length} volontari aggiornati (data fine = ${formatDMY(
        date
      )}, servizio = USCITA DEFINITIVA).`;

      deselectAll();
      await loadVolontari();
    } catch (e) {
      error = e;
      rerender();
    } finally {
      busyCheckout = false;
      rerender();
    }
  }

function cellMansioneServizio(r, rowReadOnly) {
  const cur = normMansione(r.mansione); // usa la tua norm (raw/norm già ok)
  const disabled = rowReadOnly || loading || busyCheckout;

  return html`
    <div class="field" style="margin-bottom:0.5rem;">
      <label class="label" style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;">Mansione</label>

      <div class="select is-small is-fullwidth">
        <select
          ?disabled=${disabled}
          @click=${e => e.stopPropagation()}
          @change=${e => setRowField(r.id, "mansione", e.target.value)}
        >
          <option value="" ?selected=${!cur}>—</option>

          ${MANSIONI.map(m => {
            const v = normMansione(m);
            return html`
              <option value=${v} ?selected=${v === cur}>${m}</option>
            `;
          })}
        </select>
      </div>
    </div>

    <div class="field" style="margin-bottom:0;">
      <label class="label" style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;">Servizio</label>
      <input class="input is-small" .value=${safe(r.servizio) || DEFAULT_SERVIZIO} ?disabled=${true} />
    </div>
  `;
}

  function cellRespAutistaCell(r, rowReadOnly) {
    return html`
      <div class="field" style="margin-bottom:0.5rem;">
        <label class="label" style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;">Responsabile</label>
        ${siNoSelect(
          r.responsabile || "NO",
          e => setRowField(r.id, "responsabile", e.target.value),
          rowReadOnly || loading || busyCheckout,
          html
        )}
      </div>

      <div class="field" style="margin-bottom:0.5rem;">
        <label class="label" style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;">Autista</label>
        ${siNoSelect(
          r.autista || "NO",
          e => setRowField(r.id, "autista", e.target.value),
          rowReadOnly || loading || busyCheckout,
          html
        )}
      </div>

      <div class="field" style="margin-bottom:0;">
        <label class="label" style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;">Cellulare</label>
        <input
          class="input is-small"
          placeholder="es. 3331234567"
          .value=${r.cellulare}
          ?disabled=${rowReadOnly || loading || busyCheckout}
          @click=${e => e.stopPropagation()}
          @input=${e => setRowField(r.id, "cellulare", e.target.value)}
        />
      </div>
    `;
  }

  function cellBenefici(r, rowReadOnly) {
    const numDisabled =
      (safe(r.beneficiLegge) || "NO") !== "SI" ||
      rowReadOnly ||
      loading ||
      busyCheckout;

    return html`
      <div class="field" style="margin-bottom:0.5rem;">
        <label class="label" style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;">Benefici di legge</label>
        ${siNoSelect(
          r.beneficiLegge || "NO",
          e => setRowField(r.id, "beneficiLegge", e.target.value),
          rowReadOnly || loading || busyCheckout,
          html
        )}
      </div>

      <div class="field" style="margin-bottom:0;">
        <label class="label" style="margin-bottom:0.25rem;font-size:0.75rem;color:#666;">Num. gg benefici</label>
        <input
          class="input is-small"
          placeholder="es. 2"
          .value=${r.numGgBenefici}
          ?disabled=${numDisabled}
          @click=${e => e.stopPropagation()}
          @input=${e => setRowField(r.id, "numGgBenefici", e.target.value)}
        />
      </div>
    `;
  }

  function volunteerTable(rows, q, selectable) {
    const cols = selectable ? 6 : 5;

    return html`
      <div class="table-container">
        <table class="table is-striped is-fullwidth is-hoverable">
          <thead>
            <tr>
              ${selectable ? html`<th style="width:3.5rem">✓</th>` : ""}
              <th>Anagrafica</th>
              <th>Mansione / Servizio</th>
              <th>Resp. / Autista / Cellulare</th>
              <th>Benefici / Num. gg</th>
              <th>Attestato</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length === 0
              ? html`<tr><td colspan=${cols}><em>Nessun volontario.</em></td></tr>`
              : rows.map(r => {
                  const checked = !!(selectable && selected.has(r.id));
                  const rowReadOnly = !selectable;

                  return html`
                    <tr
                      class=${selectable && checked ? "row-selected" : ""}
                      style=${selectable ? "cursor:pointer" : ""}
                      @click=${selectable ? () => toggle(r.id, !checked) : undefined}
                    >
                      ${selectable
                        ? html`
                            <td>
                              <input
                                type="checkbox"
                                .checked=${checked}
                                ?disabled=${loading || busyCheckout}
                                @click=${e => e.stopPropagation()}
                                @change=${e => toggle(r.id, e.target.checked)}
                              />
                            </td>
                          `
                        : ""}

                      <td>
                        <div style="line-height:1.1">
                          <strong>${highlight(r.cognome, q, html)}</strong>
                          <span class="ml-1">${highlight(r.nome, q, html)}</span>
                        </div>
                        <div class="has-text-grey" style="margin-top:0.25rem; font-size:0.85em;">
                          ${highlight(r.cf, q, html)}
                          ${statusTagServizio(r, html)}
                        </div>
                      </td>

                      <td @click=${e => e.stopPropagation()}>
                        ${cellMansioneServizio(r, rowReadOnly)}
                      </td>

                      <td @click=${e => e.stopPropagation()}>
                        ${cellRespAutistaCell(r, rowReadOnly)}
                      </td>

                      <td @click=${e => e.stopPropagation()}>
                        ${cellBenefici(r, rowReadOnly)}
                      </td>

                      <td>
                        <div class="has-text-grey" style="font-size:0.9em;">
                          <div>Inizio: <strong>${highlight(formatDMY(r.dataInizio) || "-", q, html)}</strong></div>
                          <div>Fine: <strong>${highlight(formatDMY(r.dataFine) || "-", q, html)}</strong></div>
                        </div>
                      </td>
                    </tr>
                  `;
                })}
          </tbody>
        </table>
      </div>
    `;
  }

  function sectionIn() {
    const rows = getInFiltered().map(applyDraft);

    return html`
      <div class="box">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:flex-end;">
            <h3 class="subtitle" style="margin-bottom:0;">
              Volontari in servizio
              <span class="tag is-light ml-2">${rows.length}</span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input is-small"
                  placeholder="Cerca volontari..."
                  .value=${qIn}
                  ?disabled=${loading || busyCheckout}
                  @input=${e => {
                    qIn = e.target.value;
                    state.s2_search_in = qIn;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>

          <div class="level-right">
            <div class="buttons">
              <button class="button is-small" @click=${selectVisibleIn} ?disabled=${loading || busyCheckout || rows.length === 0}>
                Seleziona visibili
              </button>
              <button class="button is-small" @click=${deselectAll} ?disabled=${loading || busyCheckout || selected.size === 0}>
                Deseleziona tutto
              </button>
            </div>
          </div>
        </div>

        ${volunteerTable(rows, qIn, true)}

        <div class="notification is-light mt-3">
          Selezionati per check-out: <strong>${selected.size}</strong>
        </div>
      </div>
    `;
  }

  function sectionNon() {
    const rows = getNonFiltered();

    return html`
      <div class="box">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:flex-end;">
            <h3 class="subtitle" style="margin-bottom:0;">
              Volontari non più in servizio
              <span class="tag is-light ml-2">${rows.length}</span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input is-small"
                  placeholder="Cerca volontari..."
                  .value=${qNon}
                  ?disabled=${loading || busyCheckout}
                  @input=${e => {
                    qNon = e.target.value;
                    state.s2_search_non = qNon;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        ${volunteerTable(rows, qNon, false)}
      </div>
    `;
  }

  function view() {
    const org = state.org || { name: "", code: "", province: "" };

    return html`
      <div class="box">
        <p>
          <strong>${org.name}</strong>
          ${org.code ? html`<span class="tag ml-2">${org.code}</span>` : ""}
          ${org.province ? html`<span class="tag is-light ml-2">${org.province}</span>` : ""}
        </p>

        <div class="buttons mt-3">
          <button class="button is-light is-small" ?disabled=${loading || busyCheckout} @click=${() => goTo(1)}>
            Indietro
          </button>

          <button
            class="button is-primary is-small"
            ?disabled=${loading || busyCheckout || selected.size === 0}
            @click=${checkoutSelected}
          >
            ${busyCheckout
              ? "Check-out in corso…"
              : `Check-out volontari selezionati (${selected.size})`}
          </button>

          <button class="button is-small" ?disabled=${loading || busyCheckout} @click=${() => goTo(3)}>
            Passa a Check-out mezzi
          </button>

        </div>

        ${loading ? html`<progress class="progress is-small is-primary mt-3"></progress>` : ""}

        ${error
          ? html`
              <article class="message is-danger mt-3">
                <div class="message-body">${String(error?.payload || error?.message || error)}</div>
              </article>
            `
          : ""}

        ${successMsg
          ? html`
              <article class="message is-success mt-3">
                <div class="message-body">${successMsg}</div>
              </article>
            `
          : ""}

        ${!loading && rowsAltri.length
          ? html`
              <article class="message is-warning mt-3">
                <div class="message-body">
                  <strong>Attenzione:</strong> ${rowsAltri.length} volontari non rientrano nelle regole (attestato non compilato o incoerente) e non sono mostrati nelle liste operative.
                </div>
              </article>
            `
          : ""}
      </div>

      ${sectionIn()}
      ${sectionNon()}
    `;
  }

  rerender();
  loadVolontari();

  return view();
}
