// ./views/massive-check-out/step4.js

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
  // per la tabella "materiali" in check-out mi aspetto l'id record
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

function rowMatchesQuery(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();

  const hay = [
    r.idMateriale,
    r.codiceInventario,
    r.categoria,
    r.tipologia,
    r.marca,
    r.modello,
    r.note,
    r.noteUlteriori,
    r.servizio,
    r.turno
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return hay.includes(s);
}

function sortMateriali(a, b) {
  const ia = (a.idMateriale || "").localeCompare(b.idMateriale || "", "it");
  if (ia !== 0) return ia;
  const inv = (a.codiceInventario || "").localeCompare(b.codiceInventario || "", "it");
  if (inv !== 0) return inv;
  return (a.categoria || "").localeCompare(b.categoria || "", "it");
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

export async function Step4({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;
  let successMsg = null;

  let rowsInServizio = [];
  let rowsNonServizio = [];
  let rowsAltri = [];

  if (!Array.isArray(state.step4SelectedMaterialiIds)) state.step4SelectedMaterialiIds = [];
  let selected = new Set(state.step4SelectedMaterialiIds);

  if (state.s4_search_in === undefined) state.s4_search_in = "";
  if (state.s4_search_non === undefined) state.s4_search_non = "";
  let qIn = state.s4_search_in;
  let qNon = state.s4_search_non;

  const MaterialiAPI = client.table("materiali");
  const MovAPI = client.table("mov-risorse");

  let busyCheckout = false;

  function rerender() {
    render(view(), root);
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

  async function load() {
    try {
      loading = true;
      error = null;
      successMsg = null;
      rerender();

      const res = await MaterialiAPI.list({
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

          "id-materiale",
          "codice-inventario",
          "categoria",
          "tipologia",
          "marca",
          "modello",
          "note",
          "note-ulteriori",

          "turno",
          "servizio",

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
        const row = {
          id: getId(r),

          idMateriale: safe(r["id-materiale"]),
          codiceInventario: safe(r["codice-inventario"]),
          categoria: safe(r.categoria),
          tipologia: safe(r.tipologia),
          marca: safe(r.marca),
          modello: safe(r.modello),
          note: safe(r.note),
          noteUlteriori: safe(r["note-ulteriori"]),

          turno: safe(r.turno),
          servizio: safe(r.servizio),

          dataInizio: safe(r["data-inizio-attestato"]),
          dataFine: safe(r["data-fine-attestato"]),
          dataOraUscitaDefinitiva: safe(r["data/ora-uscita-definitiva"])
        };

        if (!row.id) continue;
        if (!row.idMateriale && !row.codiceInventario) continue;

        const hasInizio = !!row.dataInizio;
        const hasFine = !!row.dataFine;

        if (hasInizio && !hasFine) outIn.push(row);
        else if (hasInizio && hasFine) outNon.push(row);
        else outAltri.push(row);
      }

      outIn.sort(sortMateriali);
      outNon.sort(sortMateriali);
      outAltri.sort(sortMateriali);

      rowsInServizio = outIn;
      rowsNonServizio = outNon;
      rowsAltri = outAltri;
    } catch (e) {
      error = e;
    } finally {
      loading = false;

      const inIds = new Set(rowsInServizio.map(r => r.id).filter(Boolean));
      selected = new Set([...selected].filter(id => inIds.has(id)));
      state.step4SelectedMaterialiIds = [...selected];

      rerender();
    }
  }

  function toggle(id, on) {
    if (!id) return;
    on ? selected.add(id) : selected.delete(id);
    state.step4SelectedMaterialiIds = [...selected];
    rerender();
  }

  function deselectAll() {
    selected.clear();
    state.step4SelectedMaterialiIds = [];
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
    state.step4SelectedMaterialiIds = [...selected];
    rerender();
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

        const servizioPrima = safe(r0.servizio);

        await MaterialiAPI.update(id, {
          "data-fine-attestato": date,
          "data/ora-uscita-definitiva": dateTime,
          "servizio": "USCITA DEFINITIVA"
        });

        await writeMov({
          dateTime,
          gruppo: state?.org?.name || "",
          risorsa: `${r0.idMateriale}${r0.codiceInventario ? " (" + r0.codiceInventario + ")" : ""}`,
          tiporisorsa: "MATERIALE",
          da: servizioPrima,
          a1: "USCITA DEFINITIVA"
        });
      }

      successMsg = `Check-out materiali completato: ${selected.size} record aggiornati (servizio = USCITA DEFINITIVA).`;

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

  function materialiTable(rows, q, selectable) {
    const cols = selectable ? 6 : 5;

    return html`
      <div class="table-container mt-3">
        <table class="table is-striped is-fullwidth is-hoverable">
          <thead>
            <tr>
              ${selectable ? html`<th style="width:3.5rem">✓</th>` : ""}
              <th>Materiale</th>
              <th>Dettagli</th>
              <th>Servizio</th>
              <th>Attestato</th>
              <th>Note</th>
            </tr>
          </thead>

          <tbody>
            ${rows.length === 0
              ? html`<tr><td colspan="${cols}"><em>Nessun materiale.</em></td></tr>`
              : ""}

            ${rows.map(r => {
              const checked = selected.has(r.id);
              const rowReadOnly = !selectable;

              const attestatoTxt =
                r.dataInizio && r.dataFine
                  ? `Dal ${formatDMY(r.dataInizio)} al ${formatDMY(r.dataFine)}`
                  : r.dataInizio
                    ? `Dal ${formatDMY(r.dataInizio)} (aperto)`
                    : "—";

              return html`
                <tr
                  class=${checked ? "row-selected" : ""}
                  style=${selectable ? "cursor:pointer" : ""}
                  @click=${selectable ? () => toggle(r.id, !checked) : null}
                >
                  ${selectable
                    ? html`
                        <td>
                          <input
                            type="checkbox"
                            .checked=${checked}
                            @click=${e => e.stopPropagation()}
                            ?disabled=${loading || busyCheckout || rowReadOnly}
                            @change=${e => toggle(r.id, e.target.checked)}
                          />
                        </td>
                      `
                    : ""}

                  <td>
                    <div style="line-height:1.1">
                      <strong>${highlight(r.idMateriale || "-", q, html)}</strong>
                    </div>
                    <div class="has-text-grey" style="margin-top:0.25rem; font-size:0.85em;">
                      ${r.codiceInventario ? highlight(`Inv: ${r.codiceInventario}`, q, html) : ""}
                      ${r.turno ? html`<span class="tag is-light ml-2">${highlight(r.turno, q, html)}</span>` : ""}
                    </div>
                  </td>

                  <td>
                    <div class="has-text-grey" style="font-size:0.9em;">
                      ${highlight([r.categoria, r.tipologia].filter(Boolean).join(" • "), q, html)}
                    </div>
                    <div style="margin-top:0.25rem;">
                      ${highlight([r.marca, r.modello].filter(Boolean).join(" "), q, html)}
                    </div>
                  </td>

                  <td>${highlight(r.servizio || "-", q, html)}</td>

                  <td class="has-text-grey" style="font-size:0.9em;">
                    ${highlight(attestatoTxt, q, html)}
                  </td>

                  <td style="font-size:0.9em;">
                    ${highlight(r.note || "", q, html)}
                    ${r.noteUlteriori
                      ? html`<div class="has-text-grey" style="margin-top:0.25rem;">${highlight(
                          r.noteUlteriori,
                          q,
                          html
                        )}</div>`
                      : ""}
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
    const rows = getInFiltered();

    return html`
      <div class="box">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:center;">
            <h3 class="subtitle" style="margin-bottom:0;">
              <span class="icon mr-2">
    <i class="ri-tools-line ri-lg"></i>
  </span>

              <span>
                Materiali in servizio
                <span class="tag is-light ml-2">${rows.length}</span>
              </span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input is-small"
                  placeholder="Cerca materiali..."
                  .value=${qIn}
                  ?disabled=${loading || busyCheckout}
                  @input=${e => {
                    qIn = e.target.value;
                    state.s4_search_in = qIn;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>

          <div class="level-right" style="gap:0.5rem;">
            <button
              class="button is-small"
              ?disabled=${loading || busyCheckout || rows.length === 0}
              @click=${selectVisibleIn}
            >
              Seleziona visibili
            </button>
          </div>
        </div>

        ${materialiTable(rows, qIn, true)}
      </div>
    `;
  }

  function sectionNon() {
    const rows = getNonFiltered();

    return html`
      <div class="box">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:center;">
            <h3 class="subtitle" style="margin-bottom:0;">
			<span class="icon mr-2">
    <i class="ri-tools-line ri-lg"></i>
  </span>

              <span>Materiali non più in servizio
              <span class="tag is-light ml-2">${rows.length}</span></span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input is-small"
                  placeholder="Cerca materiali..."
                  .value=${qNon}
                  ?disabled=${loading || busyCheckout}
                  @input=${e => {
                    qNon = e.target.value;
                    state.s4_search_non = qNon;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        ${materialiTable(rows, qNon, false)}
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
          <button class="button is-light is-small" ?disabled=${loading || busyCheckout} @click=${() => goTo(3)}>
            Indietro
          </button>

          <button
            class="button is-primary is-small"
            ?disabled=${loading || busyCheckout || selected.size === 0}
            @click=${checkoutSelected}
          >
            ${busyCheckout
              ? "Check-out in corso…"
              : `Check-out materiali selezionati (${selected.size})`}
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
                  <strong>Attenzione:</strong> ${rowsAltri.length} materiali non rientrano nelle regole (attestato non compilato o incoerente) e non sono mostrati nelle liste operative.
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
  load();

  return view();
}
