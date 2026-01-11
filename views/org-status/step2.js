// ./views/org-status/step2.js
function safe(v) {
  return String(v ?? "").trim();
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function formatDMY(iso) {
  const s = safe(iso);
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
  const query = safe(q);
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

function sortByName(a, b) {
  const c = (a.cognome || "").localeCompare(b.cognome || "", "it");
  if (c !== 0) return c;
  return (a.nome || "").localeCompare(b.nome || "", "it");
}

function sortMezzi(a, b) {
  const ta = (a.targa || "").localeCompare(b.targa || "", "it");
  if (ta !== 0) return ta;
  const ia = (a.inventario || "").localeCompare(b.inventario || "", "it");
  if (ia !== 0) return ia;
  return (a.marca || "").localeCompare(b.marca || "", "it");
}

function rowMatches(hayParts, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const hay = hayParts.filter(Boolean).join(" ").toLowerCase();
  return hay.includes(s);
}

export async function Step2({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;

  const VolontariAPI = client.table("volontari");
  const MezziAPI = client.table("mezzi");

  // search persisted
  if (state.s2_v_q === undefined) state.s2_v_q = "";
  if (state.s2_m_q === undefined) state.s2_m_q = "";
  let vq = state.s2_v_q;
  let mq = state.s2_m_q;

  let volIn = [];
  let volNon = [];
  let volOther = [];

  let mezIn = [];
  let mezNon = [];
  let mezOther = [];

  function rerender() {
    render(view(), root);
  }

  async function load() {
    try {
      loading = true;
      error = null;
      rerender();

      const filters = [
        client.filter("organizzazione", "eq", state.org.name),
        client.filter("codice-organizzazione", "eq", state.org.code),
        client.filter("provincia", "eq", state.org.province)
      ];

      const [resV, resM] = await Promise.all([
        VolontariAPI.list({
          filters,
          include: [
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
        }),
        MezziAPI.list({
          filters,
          include: [
            "targa",
            "codice-inventario",
            "categoria",
            "tipologia",
            "marca",
            "modello",
            "servizio",
            "km-inizio-missione",
            "km-all'arrivo",
            "km-alla-partenza",
            "data-inizio-attestato",
            "data-fine-attestato",
            "data/ora-uscita-definitiva"
          ],
          size: 5000
        })
      ]);

      const vRecs = getRecords(resV);
      const mRecs = getRecords(resM);

      const vIn = [];
      const vNonArr = [];
      const vOth = [];

      vRecs.forEach(r => {
        const cf = safe(r["codice-fiscale"]);
        if (!cf) return;

        const row = {
          cf,
          cognome: safe(r["cognome"]),
          nome: safe(r["nome"]),
          mansione: safe(r["mansione"]),
          servizio: safe(r["servizio"]),
          responsabile: safe(r["responsabile"]),
          autista: safe(r["autista"]),
          cellulare: safe(r["cellulare"]),
          benefici: safe(r["benefici-di-legge"]),
          numgg: safe(r["num-gg-ben-legge"]),
          inizio: safe(r["data-inizio-attestato"]),
          fine: safe(r["data-fine-attestato"])
        };

        const hasInizio = !!row.inizio;
        const hasFine = !!row.fine;

        if (hasInizio && !hasFine) vIn.push(row);
        else if (hasInizio && hasFine) vNonArr.push(row);
        else vOth.push(row);
      });

      vIn.sort(sortByName);
      vNonArr.sort(sortByName);

      const mIn = [];
      const mNonArr = [];
      const mOth = [];

      mRecs.forEach(r => {
        const targa = safe(r["targa"]);
        const inv = safe(r["codice-inventario"]);
        if (!targa && !inv) return;

        const row = {
          targa,
          inventario: inv,
          categoria: safe(r["categoria"]),
          tipologia: safe(r["tipologia"]),
          marca: safe(r["marca"]),
          modello: safe(r["modello"]),
          servizio: safe(r["servizio"]),
          kmInizio: safe(r["km-inizio-missione"]),
          kmArrivo: safe(r["km-all'arrivo"]),
          kmPartenza: safe(r["km-alla-partenza"]),
          inizio: safe(r["data-inizio-attestato"]),
          fine: safe(r["data-fine-attestato"])
        };

        const hasInizio = !!row.inizio;
        const hasFine = !!row.fine;

        if (hasInizio && !hasFine) mIn.push(row);
        else if (hasInizio && hasFine) mNonArr.push(row);
        else mOth.push(row);
      });

      mIn.sort(sortMezzi);
      mNonArr.sort(sortMezzi);

      volIn = vIn;
      volNon = vNonArr;
      volOther = vOth;

      mezIn = mIn;
      mezNon = mNonArr;
      mezOther = mOth;
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  function kpiCard(title, value, subtitle, kind = "") {
    return html`
      <div class="column is-3">
        <div class="box ${kind}">
          <p class="has-text-grey" style="font-size:0.9em">${title}</p>
          <p class="title is-4" style="margin-top:0.25rem">${value}</p>
          ${subtitle ? html`<p class="help">${subtitle}</p>` : ""}
        </div>
      </div>
    `;
  }

  function volunteerTable(title, rows, q) {
    const filtered = q
      ? rows.filter(r =>
          rowMatches(
            [
              r.cf,
              r.cognome,
              r.nome,
              r.mansione,
              r.servizio,
              r.responsabile,
              r.autista,
              r.cellulare,
              r.benefici,
              r.numgg,
              r.inizio,
              r.fine
            ],
            q
          )
        )
      : rows;

    return html`
      <div class="box">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:flex-end;">
            <h3 class="subtitle" style="margin-bottom:0;">
              ${title} <span class="tag is-light ml-2">${filtered.length}</span>
            </h3>
            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input is-small"
                  placeholder="Cerca volontari..."
                  .value=${vq}
                  ?disabled=${loading}
                  @input=${e => {
                    vq = e.target.value;
                    state.s2_v_q = vq;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div class="table-container">
          <table class="table is-striped is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th>Anagrafica</th>
                <th>Mansione</th>
                <th>Servizio</th>
                <th>Resp./Autista/Cell.</th>
                <th>Benefici</th>
                <th>Attestato</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0
                ? html`<tr><td colspan="6"><em>Nessun risultato.</em></td></tr>`
                : filtered.map(r => html`
                    <tr>
                      <td>
                        <div style="line-height:1.1">
                          <strong>${highlight(r.cognome, vq, html)}</strong>
                          <span class="ml-1">${highlight(r.nome, vq, html)}</span>
                        </div>
                        <div class="has-text-grey" style="margin-top:0.25rem; font-size:0.85em;">
                          ${highlight(r.cf, vq, html)}
                        </div>
                      </td>
                      <td>${highlight(r.mansione || "-", vq, html)}</td>
                      <td>${highlight(r.servizio || "-", vq, html)}</td>
                      <td>
                        <div>${highlight(r.responsabile || "-", vq, html)}</div>
                        <div>${highlight(r.autista || "-", vq, html)}</div>
                        <div class="has-text-grey">${highlight(r.cellulare || "-", vq, html)}</div>
                      </td>
                      <td>
                        <div>${highlight(r.benefici || "-", vq, html)}</div>
                        <div class="has-text-grey">Num gg: ${highlight(r.numgg || "-", vq, html)}</div>
                      </td>
                      <td>
                        <div class="has-text-grey" style="font-size:0.9em;">
                          <div>Inizio: <strong>${highlight(formatDMY(r.inizio) || "-", vq, html)}</strong></div>
                          <div>Fine: <strong>${highlight(formatDMY(r.fine) || "-", vq, html)}</strong></div>
                        </div>
                      </td>
                    </tr>
                  `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function mezziTable(title, rows, q) {
    const filtered = q
      ? rows.filter(r =>
          rowMatches(
            [
              r.targa,
              r.inventario,
              r.categoria,
              r.tipologia,
              r.marca,
              r.modello,
              r.servizio,
              r.kmInizio,
              r.kmArrivo,
              r.kmPartenza,
              r.inizio,
              r.fine
            ],
            q
          )
        )
      : rows;

    return html`
      <div class="box">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:flex-end;">
            <h3 class="subtitle" style="margin-bottom:0;">
              ${title} <span class="tag is-light ml-2">${filtered.length}</span>
            </h3>
            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input
                  class="input is-small"
                  placeholder="Cerca mezzi..."
                  .value=${mq}
                  ?disabled=${loading}
                  @input=${e => {
                    mq = e.target.value;
                    state.s2_m_q = mq;
                    rerender();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        <div class="table-container">
          <table class="table is-striped is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th>Mezzo</th>
                <th>Servizio</th>
                <th>Km (inizio/arrivo/partenza)</th>
                <th>Attestato</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0
                ? html`<tr><td colspan="4"><em>Nessun risultato.</em></td></tr>`
                : filtered.map(r => html`
                    <tr>
                      <td>
                        <div style="line-height:1.1">
                          <strong>${highlight(r.targa || "-", mq, html)}</strong>
                        </div>
                        <div class="has-text-grey" style="margin-top:0.25rem; font-size:0.85em;">
                          ${[r.marca, r.modello].filter(Boolean).map(x => highlight(x, mq, html))}
                          ${r.inventario ? html`<span> • </span>${highlight(r.inventario, mq, html)}` : ""}
                          ${r.categoria ? html`<span> • </span>${highlight(r.categoria, mq, html)}` : ""}
                          ${r.tipologia ? html`<span> • </span>${highlight(r.tipologia, mq, html)}` : ""}
                        </div>
                      </td>
                      <td>${highlight(r.servizio || "-", mq, html)}</td>
                      <td>
                        <div>${highlight(r.kmInizio ? `Inizio: ${r.kmInizio}` : "Inizio: -", mq, html)}</div>
                        <div>${highlight(r.kmArrivo ? `Arrivo: ${r.kmArrivo}` : "Arrivo: -", mq, html)}</div>
                        <div>${highlight(r.kmPartenza ? `Partenza: ${r.kmPartenza}` : "Partenza: -", mq, html)}</div>
                      </td>
                      <td>
                        <div class="has-text-grey" style="font-size:0.9em;">
                          <div>Inizio: <strong>${highlight(formatDMY(r.inizio) || "-", mq, html)}</strong></div>
                          <div>Fine: <strong>${highlight(formatDMY(r.fine) || "-", mq, html)}</strong></div>
                        </div>
                      </td>
                    </tr>
                  `)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function view() {
    const org = state.org || { name: "", code: "", province: "" };

    const vIn = volIn.length;
    const vNon = volNon.length;
    const mIn = mezIn.length;
    const mNon = mezNon.length;

    return html`
      <div class="box">
        <p>
          <strong>${org.name}</strong>
          ${org.code ? html`<span class="tag ml-2">${org.code}</span>` : ""}
          ${org.province ? html`<span class="tag is-light ml-2">${org.province}</span>` : ""}
        </p>

        <div class="buttons mt-3">
          <button class="button is-light is-small" ?disabled=${loading} @click=${() => goTo(1)}>
            Cambia organizzazione
          </button>
          <button class="button is-info is-small" ?disabled=${loading} @click=${load}>
            Ricarica
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

        <div class="columns is-multiline mt-3">
          ${kpiCard("Volontari in servizio", vIn, "")}
          ${kpiCard("Volontari non in servizio", vNon, "")}
          ${kpiCard("Mezzi in servizio", mIn, "")}
          ${kpiCard("Mezzi non in servizio", mNon, "")}
        </div>

        ${(volOther.length || mezOther.length) ? html`
          <article class="message is-warning mt-2">
            <div class="message-body">
              <strong>Nota:</strong>
              ${volOther.length ? html`<span class="tag is-warning is-light mr-2">Volontari “dati incompleti”: ${volOther.length}</span>` : ""}
              ${mezOther.length ? html`<span class="tag is-warning is-light">Mezzi “dati incompleti”: ${mezOther.length}</span>` : ""}
              <div class="help mt-2">
                Questi record non rispettano le regole (manca data inizio attestato oppure è incoerente) e non sono inclusi nei conteggi principali.
              </div>
            </div>
          </article>
        ` : ""}
      </div>

      ${volunteerTable("Volontari in servizio", volIn, vq)}
      ${volunteerTable("Volontari non in servizio", volNon, vq)}

      ${mezziTable("Mezzi in servizio", mezIn, mq)}
      ${mezziTable("Mezzi non in servizio", mezNon, mq)}
    `;
  }

  rerender();
  load();
  return view();
}
