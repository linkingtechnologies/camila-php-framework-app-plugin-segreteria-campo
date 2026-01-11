// ./views/massive-check-out/step3.js
function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function safe(v) {
  return String(v ?? "").trim();
}

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

function rowMatchesQuery(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();

  const hay = [
    r.targa,
    r.inventario,
    r.categoria,
    r.tipologia,
    r.marca,
    r.modello,
    r.note,
    r.servizio,
    r.kmInizioMissione,
    r.kmAllArrivo,
    r.kmAllaPartenza,
    r.nomeReferente,
    r.numeroTelefonoReferente,
    r.provenienza
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(s);
}

function sortMezzi(a, b) {
  const ta = (a.targa || "").localeCompare(b.targa || "", "it");
  if (ta !== 0) return ta;
  const ia = (a.inventario || "").localeCompare(b.inventario || "", "it");
  if (ia !== 0) return ia;
  return (a.marca || "").localeCompare(b.marca || "", "it");
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

function toNumericString(v) {
  const s = safe(v);
  if (!s) return "";
  const cleaned = s.replace(/[^\d.,-]/g, "").replace(",", ".");
  if (!cleaned) return "";
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

export async function Step3({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;
  let successMsg = null;

  let rowsInServizio = [];
  let rowsNonServizio = [];
  let rowsAltri = [];

  if (!Array.isArray(state.step3SelectedMezziIds)) state.step3SelectedMezziIds = [];
  let selected = new Set(state.step3SelectedMezziIds);

  if (state.s3_search_in === undefined) state.s3_search_in = "";
  if (state.s3_search_non === undefined) state.s3_search_non = "";
  let qIn = state.s3_search_in;
  let qNon = state.s3_search_non;

  const MezziAPI = client.table("mezzi");
  const MovAPI = client.table("mov-risorse");

  let busyCheckout = false;

  function rerender() {
    render(view(), root);
  }

  function setRowField(rowId, field, value) {
    const r = rowsInServizio.find(x => x.id === rowId);
    if (!r) return;

    if (field === "kmInizioMissione" || field === "kmAllArrivo" || field === "kmAllaPartenza") {
      r[field] = toNumericString(value);
    } else {
      r[field] = safe(value);
    }

    state.step3Draft = state.step3Draft || {};
    state.step3Draft[rowId] = state.step3Draft[rowId] || {};
    state.step3Draft[rowId][field] = r[field];

    rerender();
  }

  function applyDraft(row) {
    const d = state.step3Draft && state.step3Draft[row.id];
    if (!d) return row;
    return {
      ...row,
      kmInizioMissione: d.kmInizioMissione ?? row.kmInizioMissione,
      kmAllArrivo: d.kmAllArrivo ?? row.kmAllArrivo,
      kmAllaPartenza: d.kmAllaPartenza ?? row.kmAllaPartenza
    };
  }

  async function load() {
    try {
      loading = true;
      error = null;
      successMsg = null;
      rerender();

      const res = await MezziAPI.list({
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

          "targa",
          "codice-inventario",
          "categoria",
          "tipologia",
          "marca",
          "modello",
          "note",

          "servizio",
          "km-inizio-missione",
          "km-all'arrivo",
          "km-alla-partenza",
          "nome-referente",
          "numero-telefono-referente",
          "provenienza",

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
        const baseRow = {
          id: getId(r),

          targa: safe(r.targa),

          inventario: safe(r["codice-inventario"] ?? r.inventario),
          categoria: safe(r.categoria),
          tipologia: safe(r.tipologia),
          marca: safe(r.marca),
          modello: safe(r.modello),
          note: safe(r.note),

          servizio: safe(r.servizio),

          kmInizioMissione: toNumericString(r["km-inizio-missione"]),
          kmAllArrivo: toNumericString(r["km-all'arrivo"]),
          kmAllaPartenza: toNumericString(r["km-alla-partenza"]),

          nomeReferente: safe(r["nome-referente"]),
          numeroTelefonoReferente: safe(r["numero-telefono-referente"]),
          provenienza: safe(r.provenienza),

          dataInizio: safe(r["data-inizio-attestato"]),
          dataFine: safe(r["data-fine-attestato"]),
          dataOraUscitaDefinitiva: safe(r["data/ora-uscita-definitiva"])
        };

        if (!baseRow.id) continue;
        if (!baseRow.targa && !baseRow.inventario) continue;

        const hasInizio = !!baseRow.dataInizio;
        const hasFine = !!baseRow.dataFine;

        if (hasInizio && hasFine) outNon.push(baseRow);
        else if (hasInizio && !hasFine) outIn.push(baseRow);
        else outAltri.push(baseRow);
      }

      const outInDrafted = outIn.map(applyDraft);

      outInDrafted.sort(sortMezzi);
      outNon.sort(sortMezzi);
      outAltri.sort(sortMezzi);

      rowsInServizio = outInDrafted;
      rowsNonServizio = outNon;
      rowsAltri = outAltri;
    } catch (e) {
      error = e;
    } finally {
      loading = false;

      const inIds = new Set(rowsInServizio.map(r => r.id));
      selected = new Set([...selected].filter(id => inIds.has(id)));
      state.step3SelectedMezziIds = [...selected];

      rerender();
    }
  }

  function toggle(id, on) {
    if (!id) return;
    on ? selected.add(id) : selected.delete(id);
    state.step3SelectedMezziIds = [...selected];
    rerender();
  }

  function deselectAll() {
    selected.clear();
    state.step3SelectedMezziIds = [];
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
    getInFiltered().forEach(r => selected.add(r.id));
    state.step3SelectedMezziIds = [...selected];
    rerender();
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

    busyCheckout = true;
    error = null;
    successMsg = null;
    rerender();

    const date = todayISO();
    const dateTime = nowDateTime();

    try {
      for (const id of selected) {
        const r0 = rowsInServizio.find(x => x.id === id);
        if (!r0) continue;

        const r = applyDraft(r0);
        const servizioPrima = safe(r0.servizio);

        await MezziAPI.update(id, {
          "data-fine-attestato": date,
          "data/ora-uscita-definitiva": dateTime,
          "servizio": "USCITA DEFINITIVA",

          "km-inizio-missione": r.kmInizioMissione || "",
          "km-all'arrivo": r.kmAllArrivo || "",
          "km-alla-partenza": r.kmAllaPartenza || ""
        });

        await writeMov({
          dateTime,
          gruppo: state?.org?.name || "",
          risorsa: r.targa + " " + r.marca,
          tiporisorsa: "MEZZO",
          da: servizioPrima,
          a1: "USCITA DEFINITIVA"
        });
      }

      successMsg = `Check-out mezzi completato: ${selected.size} record aggiornati (servizio = USCITA DEFINITIVA).`;

      deselectAll();
      await load();
    } catch (e) {
      error = e;
      rerender();
    } finally {
      busyCheckout = false;
      rerender();
    }
  }

  function kmEditor(r) {
    return html`
      <div class="columns is-mobile" style="gap:0.5rem; margin:0;">
        <div class="column" style="padding:0;">
          <input
            class="input is-small"
            type="number"
            inputmode="decimal"
            placeholder="Inizio"
            .value=${r.kmInizioMissione}
            ?disabled=${loading || busyCheckout}
            @click=${e => e.stopPropagation()}
            @input=${e => setRowField(r.id, "kmInizioMissione", e.target.value)}
          />
        </div>
        <div class="column" style="padding:0;">
          <input
            class="input is-small"
            type="number"
            inputmode="decimal"
            placeholder="Arrivo"
            .value=${r.kmAllArrivo}
            ?disabled=${loading || busyCheckout}
            @click=${e => e.stopPropagation()}
            @input=${e => setRowField(r.id, "kmAllArrivo", e.target.value)}
          />
        </div>
        <div class="column" style="padding:0;">
          <input
            class="input is-small"
            type="number"
            inputmode="decimal"
            placeholder="Partenza"
            .value=${r.kmAllaPartenza}
            ?disabled=${loading || busyCheckout}
            @click=${e => e.stopPropagation()}
            @input=${e => setRowField(r.id, "kmAllaPartenza", e.target.value)}
          />
        </div>
      </div>
      <p class="help" style="margin-top:0.25rem;">Km: inizio / arrivo / partenza</p>
    `;
  }

  function kmReadOnly(r, q, html) {
    const parts = [
      r.kmInizioMissione ? `Inizio: ${r.kmInizioMissione}` : "",
      r.kmAllArrivo ? `Arrivo: ${r.kmAllArrivo}` : "",
      r.kmAllaPartenza ? `Partenza: ${r.kmAllaPartenza}` : ""
    ].filter(Boolean);

    const txt = parts.length ? parts.join(" • ") : "-";
    return html`${highlight(txt, q, html)}`;
  }

  function mezziTable(rows, q, selectable) {
    const cols = selectable ? 7 : 6;

    return html`
      <div class="table-container">
        <table class="table is-striped is-fullwidth is-hoverable">
          <thead>
            <tr>
              ${selectable ? html`style="width:3.5rem">✓</th>` : ""}
              <th>Mezzo</th>
              <th>Servizio</th>
              <th>Km</th>
              <th>Referente (nome / tel.)</th>
              <th>Provenienza</th>
              <th>Note</th>
            </tr>
          </thead>

          <tbody>
            ${rows.length === 0
              ? html`<tr><td colspan=${cols}><em>Nessun mezzo.</em></td></tr>`
              : rows.map(r => {
                  const checked = selected.has(r.id);
                  const mezzoLine2 = [r.marca, r.modello].filter(Boolean).join(" ");
                  const extra = [
                    r.inventario ? `Inv: ${r.inventario}` : "",
                    r.categoria ? `Cat: ${r.categoria}` : "",
                    r.tipologia ? `Tipo: ${r.tipologia}` : ""
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  const ref = [
                    r.nomeReferente || "",
                    r.numeroTelefonoReferente ? `(${r.numeroTelefonoReferente})` : ""
                  ]
                    .filter(Boolean)
                    .join(" ");

                  const trClick = selectable ? () => toggle(r.id, !checked) : null;

                  return html`
                    <tr
                      class=${selectable && checked ? "row-selected" : ""}
                      style=${selectable ? "cursor:pointer" : ""}
                      @click=${selectable ? trClick : undefined}
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
                          <strong>${highlight(r.targa || "-", q, html)}</strong>
                        </div>

                        ${mezzoLine2 || extra
                          ? html`
                              <div class="has-text-grey" style="margin-top:0.25rem; font-size:0.85em;">
                                ${mezzoLine2 ? highlight(mezzoLine2, q, html) : ""}
                                ${mezzoLine2 && extra ? html`<span> • </span>` : ""}
                                ${extra ? highlight(extra, q, html) : ""}
                              </div>
                            `
                          : ""}
                      </td>

                      <td>${highlight(r.servizio, q, html)}</td>

                      <td>
                        ${selectable ? kmEditor(r) : kmReadOnly(r, q, html)}
                      </td>

                      <td>${highlight(ref, q, html)}</td>
                      <td>${highlight(r.provenienza, q, html)}</td>
                      <td>${highlight(r.note, q, html)}</td>
                    </tr>
                  `;
                })}
          </tbody>
        </table>
      </div>
    `;
  }

  function sectionIn() {
    const rows = getInFiltered();
    return html`
      <div class="box">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:flex-end;">
            <h3 class="subtitle" style="margin-bottom:0;">
              Mezzi in servizio
              <span class="tag is-light ml-2">${rows.length}</span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input"
                  placeholder="Cerca mezzi..."
                  .value=${qIn}
                  ?disabled=${loading || busyCheckout}
                  @input=${e => {
                    qIn = e.target.value;
                    state.s3_search_in = qIn;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>

          <div class="level-right">
            <div class="buttons">
              <button
                class="button is-small"
                @click=${selectVisibleIn}
                ?disabled=${loading || busyCheckout || rows.length === 0}
              >
                Seleziona visibili
              </button>
              <button
                class="button is-small"
                @click=${deselectAll}
                ?disabled=${loading || busyCheckout || selected.size === 0}
              >
                Deseleziona tutto
              </button>
            </div>
          </div>
        </div>

        ${mezziTable(rows, qIn, true)}

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
              Mezzi non in servizio
              <span class="tag is-light ml-2">${rows.length}</span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input"
                  placeholder="Cerca mezzi..."
                  .value=${qNon}
                  ?disabled=${loading || busyCheckout}
                  @input=${e => {
                    qNon = e.target.value;
                    state.s3_search_non = qNon;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        ${mezziTable(rows, qNon, false)}
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
          <button class="button is-light is-small" ?disabled=${loading || busyCheckout} @click=${() => goTo(2)}>
            Indietro
          </button>

          <button
            class="button is-primary is-small"
            ?disabled=${loading || busyCheckout || selected.size === 0}
            @click=${checkoutSelected}
          >
            ${busyCheckout ? "Check-out in corso…" : `Check-out mezzi selezionati (${selected.size})`}
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
                  <strong>Attenzione:</strong> ${rowsAltri.length} mezzi non rientrano nelle regole (attestato non compilato o incoerente) e non sono mostrati nelle liste operative.
                </div>
              </article>
            `
          : ""}
      </div>

      ${sectionIn()}
      ${sectionNon()}
    `;
  }

  load();
  return view();
}
