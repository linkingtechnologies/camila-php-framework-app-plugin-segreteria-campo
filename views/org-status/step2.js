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
  return (a.targa || "").localeCompare(b.targa || "", "it");
}

function sortMateriali(a, b) {
  return (a.id || "").localeCompare(b.id || "", "it");
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
  const MaterialiAPI = client.table("materiali");

  if (state.s2_v_q === undefined) state.s2_v_q = "";
  if (state.s2_m_q === undefined) state.s2_m_q = "";
  if (state.s2_a_q === undefined) state.s2_a_q = "";

  let vq = state.s2_v_q;
  let mq = state.s2_m_q;
  let aq = state.s2_a_q;

  let volIn = [], volNon = [];
  let mezIn = [], mezNon = [];
  let attIn = [], attNon = [];

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

      const [resV, resM, resA] = await Promise.all([
        VolontariAPI.list({
          filters,
          include: [
            "codice-fiscale","cognome","nome","mansione","servizio",
            "responsabile","autista","cellulare",
            "benefici-di-legge","num-gg-ben-legge",
            "data-inizio-attestato","data-fine-attestato"
          ],
          size: 5000
        }),
        MezziAPI.list({
          filters,
          include: [
            "targa","codice-inventario","categoria","tipologia",
            "marca","modello","servizio",
            "km-inizio-missione","km-all'arrivo","km-alla-partenza",
            "data-inizio-attestato","data-fine-attestato"
          ],
          size: 5000
        }),
        MaterialiAPI.list({
          filters,
          include: [
            "id-materiale","codice-inventario",
            "categoria","tipologia","marca","modello",
            "note","note-ulteriori","servizio",
            "data-inizio-attestato","data-fine-attestato"
          ],
          size: 5000
        })
      ]);

      const vRecs = getRecords(resV);
      const mRecs = getRecords(resM);
      const aRecs = getRecords(resA);

      // ---------- VOLONTARI ----------
      volIn = [];
      volNon = [];

      vRecs.forEach(r => {
        const row = {
          cf: safe(r["codice-fiscale"]),
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

        if (!row.cf) return;

        if (row.inizio && !row.fine) volIn.push(row);
        else volNon.push(row);
      });

      volIn.sort(sortByName);
      volNon.sort(sortByName);

      // ---------- MEZZI ----------
      mezIn = [];
      mezNon = [];

      mRecs.forEach(r => {
        const row = {
          targa: safe(r["targa"]),
          inventario: safe(r["codice-inventario"]),
          marca: safe(r["marca"]),
          modello: safe(r["modello"]),
          categoria: safe(r["categoria"]),
          tipologia: safe(r["tipologia"]),
          servizio: safe(r["servizio"]),
          kmInizio: safe(r["km-inizio-missione"]),
          kmArrivo: safe(r["km-all'arrivo"]),
          kmPartenza: safe(r["km-alla-partenza"]),
          inizio: safe(r["data-inizio-attestato"]),
          fine: safe(r["data-fine-attestato"])
        };

        if (!row.targa && !row.inventario) return;

        if (row.inizio && !row.fine) mezIn.push(row);
        else mezNon.push(row);
      });

      mezIn.sort(sortMezzi);
      mezNon.sort(sortMezzi);

      // ---------- MATERIALI ----------
      attIn = [];
      attNon = [];

      aRecs.forEach(r => {
        const row = {
          id: safe(r["id-materiale"]),
          inventario: safe(r["codice-inventario"]),
          categoria: safe(r["categoria"]),
          tipologia: safe(r["tipologia"]),
          marca: safe(r["marca"]),
          modello: safe(r["modello"]),
          note: safe(r["note"]),
          servizio: safe(r["servizio"]),
          inizio: safe(r["data-inizio-attestato"]),
          fine: safe(r["data-fine-attestato"])
        };

        if (!row.id) return;

        if (row.inizio && !row.fine) attIn.push(row);
        else attNon.push(row);
      });

      attIn.sort(sortMateriali);
      attNon.sort(sortMateriali);

    } catch (e) {
      error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  // ---------- KPI CARD ----------
  function summaryCard(title, iconClass, inCount, nonCount) {
    return html`
      <div class="column is-4">
        <div class="box">
          <div class="level" style="margin-bottom:0.5rem;">
            <div class="level-left" style="gap:0.75rem;">
              <span class="icon">
                <i class=${iconClass}></i>
              </span>
              <div>
                <div class="has-text-grey">${title}</div>
                <div class="help">In / Non in servizio</div>
              </div>
            </div>
          </div>

          <div class="columns is-mobile">
            <div class="column">
              <div class="has-text-grey is-size-7">In servizio</div>
              <div class="title is-4">${inCount}</div>
            </div>

            <div class="column">
              <div class="has-text-grey is-size-7">Non in servizio</div>
              <div class="title is-4">${nonCount}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ---------- TABLES ----------
  function volunteerTable(title, rows) {
    const filtered = vq
      ? rows.filter(r =>
          rowMatches([r.cf, r.cognome, r.nome, r.servizio], vq))
      : rows;

    return html`
      <div class="box">
        <h3 class="subtitle">
          <span class="icon mr-2"><i class="ri-user-line ri-lg"></i></span>
          ${title}
          <span class="tag is-light ml-2">${filtered.length}</span>
        </h3>

        <input class="input is-small mb-3"
          placeholder="Cerca volontari..."
          .value=${vq}
          @input=${e => { vq = e.target.value; state.s2_v_q = vq; rerender(); }}>

        <table class="table is-fullwidth is-striped">
          <tbody>
            ${filtered.map(r => html`
              <tr>
                <td>
                  <strong>${highlight(r.cognome, vq, html)} ${highlight(r.nome, vq, html)}</strong>
                  <div class="has-text-grey">${highlight(r.cf, vq, html)}</div>
                </td>
                <td>${highlight(r.servizio || "-", vq, html)}</td>
                <td>${formatDMY(r.inizio)}</td>
                <td>${formatDMY(r.fine)}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  function mezziTable(title, rows) {
    const filtered = mq
      ? rows.filter(r =>
          rowMatches([r.targa, r.inventario, r.servizio], mq))
      : rows;

    return html`
      <div class="box">
        <h3 class="subtitle">
          <span class="icon mr-2"><i class="ri-truck-line ri-lg"></i></span>
          ${title}
          <span class="tag is-light ml-2">${filtered.length}</span>
        </h3>

        <input class="input is-small mb-3"
          placeholder="Cerca mezzi..."
          .value=${mq}
          @input=${e => { mq = e.target.value; state.s2_m_q = mq; rerender(); }}>

        <table class="table is-fullwidth is-striped">
          <tbody>
            ${filtered.map(r => html`
              <tr>
                <td>
                  <strong>${highlight(r.targa, mq, html)}</strong>
                  <div class="has-text-grey">${highlight(r.inventario, mq, html)}</div>
                </td>
                <td>${highlight(r.servizio || "-", mq, html)}</td>
                <td>${formatDMY(r.inizio)}</td>
                <td>${formatDMY(r.fine)}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  function materialiTable(title, rows) {
    const filtered = aq
      ? rows.filter(r =>
          rowMatches([r.id, r.inventario, r.servizio], aq))
      : rows;

    return html`
      <div class="box">
        <h3 class="subtitle">
          <span class="icon mr-2"><i class="ri-tools-line ri-lg"></i></span>
          ${title}
          <span class="tag is-light ml-2">${filtered.length}</span>
        </h3>

        <input class="input is-small mb-3"
          placeholder="Cerca materiali..."
          .value=${aq}
          @input=${e => { aq = e.target.value; state.s2_a_q = aq; rerender(); }}>

        <table class="table is-fullwidth is-striped">
          <tbody>
            ${filtered.map(r => html`
              <tr>
                <td>
                  <strong>${highlight(r.id, aq, html)}</strong>
                  <div class="has-text-grey">${highlight(r.inventario, aq, html)}</div>
                </td>
                <td>${highlight(r.servizio || "-", aq, html)}</td>
                <td>${formatDMY(r.inizio)}</td>
                <td>${formatDMY(r.fine)}</td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;
  }

  function view() {
    const org = state.org || {};

    return html`
      <div class="box">
        <p>
          <strong>${org.name}</strong>
          ${org.code ? html`<span class="tag ml-2">${org.code}</span>` : ""}
          ${org.province ? html`<span class="tag is-light ml-2">${org.province}</span>` : ""}
        </p>

        <div class="buttons mt-3">
          <button class="button is-light is-small"
            ?disabled=${loading}
            @click=${() => goTo(1)}>
            Cambia organizzazione
          </button>

          <button class="button is-info is-small"
            ?disabled=${loading}
            @click=${load}>
            Ricarica
          </button>
        </div>

        ${loading ? html`<progress class="progress is-small is-primary mt-3"></progress>` : ""}

        <div class="columns is-multiline mt-4">
          ${summaryCard("Volontari", "ri-user-line ri-lg", volIn.length, volNon.length)}
          ${summaryCard("Mezzi", "ri-truck-line ri-lg", mezIn.length, mezNon.length)}
          ${summaryCard("Materiali", "ri-tools-line ri-lg", attIn.length, attNon.length)}
        </div>
      </div>

      ${volunteerTable("Volontari in servizio", volIn)}
      ${volunteerTable("Volontari non in servizio", volNon)}

      ${mezziTable("Mezzi in servizio", mezIn)}
      ${mezziTable("Mezzi non in servizio", mezNon)}

      ${materialiTable("Materiali in servizio", attIn)}
      ${materialiTable("Materiali non in servizio", attNon)}
    `;
  }

  rerender();
  load();

  return view();
}
