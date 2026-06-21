// views/pre-accreditations-summary/index.js

function norm(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

export async function PreAccreditationsSummary({ client, html, render, root }) {
  let loading = true;
  let error = null;

  let rawV = [];
  let rawM = [];
  let rawA = [];

  let allTurni = [];
  let allServizi = [];

  let filterTurni = new Set();
  let filterServizi = new Set();

  let search = "";
  let viewMode = "summary";
  let expanded = new Set();

  function rerender() {
    render(view(), root);
  }

  async function load() {
    loading = true;
    error = null;
    rerender();

    try {
      const INCLUDE_V = ["organizzazione", "codice-organizzazione", "provincia", "turno", "servizio", "codice-fiscale", "cognome", "nome", "mansione"];
      const INCLUDE_M = ["organizzazione", "codice-organizzazione", "provincia", "turno", "servizio", "targa", "categoria", "tipologia"];
      const INCLUDE_A = ["organizzazione", "codice-organizzazione", "provincia", "turno", "servizio", "id-materiale", "codice-inventario", "categoria", "tipologia"];

      const [resV, resM, resA] = await Promise.all([
        client.table("volontari-preaccreditati").list({ include: INCLUDE_V, size: 5000 }),
        client.table("mezzi-preaccreditati").list({ include: INCLUDE_M, size: 5000 }),
        client.table("materiali-preaccreditati").list({ include: INCLUDE_A, size: 5000 })
      ]);

      rawV = getRecords(resV);
      rawM = getRecords(resM);
      rawA = getRecords(resA);

      const turniSet = new Set();
      const serviziSet = new Set();
      for (const r of [...rawV, ...rawM, ...rawA]) {
        const t = norm(r.turno);
        const s = norm(r.servizio);
        if (t) turniSet.add(t);
        if (s) serviziSet.add(s);
      }

      allTurni = Array.from(turniSet).sort((a, b) => a.localeCompare(b, "it"));
      allServizi = Array.from(serviziSet).sort((a, b) => a.localeCompare(b, "it"));
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  function applyFilters(raw) {
    return raw.filter(r =>
      (filterTurni.size === 0 || filterTurni.has(norm(r.turno))) &&
      (filterServizi.size === 0 || filterServizi.has(norm(r.servizio)))
    );
  }

  function buildGroups() {
    const filtV = applyFilters(rawV);
    const filtM = applyFilters(rawM);
    const filtA = applyFilters(rawA);

    const map = {};
    const add = (recs, tipo) => recs.forEach(r => {
      const name = norm(r.organizzazione) || "—";
      const key = name.toLowerCase() + "|" + norm(r["codice-organizzazione"]).toLowerCase();
      if (!map[key]) map[key] = {
        name,
        code: norm(r["codice-organizzazione"]),
        provincia: norm(r.provincia),
        v: [], m: [], a: []
      };
      map[key][tipo].push(r);
    });
    add(filtV, "v");
    add(filtM, "m");
    add(filtA, "a");

    const needle = search.toLowerCase();
    return Object.values(map)
      .filter(g => !needle || g.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, "it"));
  }

  function toggleTurno(t) {
    if (filterTurni.has(t)) filterTurni.delete(t);
    else filterTurni.add(t);
    rerender();
  }

  function toggleServizio(s) {
    if (filterServizi.has(s)) filterServizi.delete(s);
    else filterServizi.add(s);
    rerender();
  }

  function toggleExpanded(name) {
    if (expanded.has(name)) expanded.delete(name);
    else expanded.add(name);
    rerender();
  }

  function chip(label, active, onClick) {
    return html`
      <span
        class="tag is-rounded is-clickable ${active ? "is-primary" : "is-light"}"
        style="cursor:pointer;user-select:none"
        @click=${onClick}>
        ${label}
      </span>
    `;
  }

  function kpiBox(icon, label, total, unique) {
    const showUniq = unique !== undefined && unique !== total;
    return html`
      <div style="text-align:center;min-width:80px">
        <div class="title is-5 mb-0">${total}</div>
        ${showUniq ? html`<div class="help has-text-grey-light">${unique} unici</div>` : ""}
        <div class="help"><i class="${icon}"></i> ${label}</div>
      </div>
    `;
  }

  function summaryTable(groups) {
    const totV = groups.reduce((s, g) => s + g.v.length, 0);
    const totM = groups.reduce((s, g) => s + g.m.length, 0);
    const totA = groups.reduce((s, g) => s + g.a.length, 0);

    return html`
      <div style="overflow-x:auto">
        <table class="table is-fullwidth is-striped is-hoverable is-size-7">
          <thead>
            <tr>
              <th>Organizzazione</th>
              <th>Prov</th>
              <th class="has-text-right">Vol</th>
              <th class="has-text-right">Mezzi</th>
              <th class="has-text-right">Mat</th>
              <th class="has-text-right">Tot</th>
            </tr>
          </thead>
          <tbody>
            ${groups.map(g => html`
              <tr>
                <td>
                  <strong>${g.name}</strong>
                  ${g.code ? html`<span class="tag is-light is-small ml-1">${g.code}</span>` : ""}
                </td>
                <td>${g.provincia || "—"}</td>
                <td class="has-text-right">${g.v.length || "—"}</td>
                <td class="has-text-right">${g.m.length || "—"}</td>
                <td class="has-text-right">${g.a.length || "—"}</td>
                <td class="has-text-right"><strong>${g.v.length + g.m.length + g.a.length}</strong></td>
              </tr>
            `)}
          </tbody>
          <tfoot>
            <tr>
              <th colspan="2">Totale (${groups.length} org)</th>
              <th class="has-text-right">${totV}</th>
              <th class="has-text-right">${totM}</th>
              <th class="has-text-right">${totA}</th>
              <th class="has-text-right"><strong>${totV + totM + totA}</strong></th>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  function detailSubTable(rows, cols) {
    return html`
      <table class="table is-fullwidth is-narrow is-striped is-size-7 mb-3">
        <tbody>
          ${rows.map(r => html`<tr>${cols.map(c => html`<td>${c(r) || "—"}</td>`)}</tr>`)}
        </tbody>
      </table>
    `;
  }

  function detailAccordion(groups) {
    return groups.map(g => {
      const isOpen = expanded.has(g.name);
      const tot = g.v.length + g.m.length + g.a.length;

      return html`
        <div class="box mb-2 p-3">
          <div class="is-flex is-align-items-center"
            style="gap:.75rem;cursor:pointer;user-select:none"
            @click=${() => toggleExpanded(g.name)}>
            <span class="icon has-text-grey is-small">
              <i class="${isOpen ? "ri-arrow-down-s-line" : "ri-arrow-right-s-line"} ri-lg"></i>
            </span>
            <div style="flex:1;min-width:0">
              <strong>${g.name}</strong>
              ${g.code ? html`<span class="tag is-light is-small ml-2">${g.code}</span>` : ""}
              ${g.provincia ? html`<span class="tag is-light is-small ml-1">${g.provincia}</span>` : ""}
            </div>
            <div style="display:flex;gap:.3rem;flex-wrap:nowrap;align-items:center">
              ${g.v.length ? html`<span class="tag is-info is-light is-small"><i class="ri-user-line mr-1"></i>${g.v.length}</span>` : ""}
              ${g.m.length ? html`<span class="tag is-warning is-light is-small"><i class="ri-truck-line mr-1"></i>${g.m.length}</span>` : ""}
              ${g.a.length ? html`<span class="tag is-success is-light is-small"><i class="ri-tools-line mr-1"></i>${g.a.length}</span>` : ""}
              <span class="tag is-dark is-small">${tot}</span>
            </div>
          </div>

          ${isOpen ? html`
            <div class="mt-3" style="padding-left:1.5rem;border-left:3px solid #dbdbdb">

              ${g.v.length ? html`
                <p class="heading mb-1 mt-2">
                  <i class="ri-user-line mr-1"></i>Volontari (${g.v.length})
                </p>
                ${detailSubTable(g.v, [
                  r => html`<strong>${norm(r.cognome)} ${norm(r.nome)}</strong>`,
                  r => norm(r.mansione),
                  r => norm(r.turno),
                  r => norm(r.servizio)
                ])}
              ` : ""}

              ${g.m.length ? html`
                <p class="heading mb-1 mt-2">
                  <i class="ri-truck-line mr-1"></i>Mezzi (${g.m.length})
                </p>
                ${detailSubTable(g.m, [
                  r => html`<strong>${norm(r.targa)}</strong>`,
                  r => [norm(r.categoria), norm(r.tipologia)].filter(Boolean).join(" · "),
                  r => norm(r.turno),
                  r => norm(r.servizio)
                ])}
              ` : ""}

              ${g.a.length ? html`
                <p class="heading mb-1 mt-2">
                  <i class="ri-tools-line mr-1"></i>Materiali (${g.a.length})
                </p>
                ${detailSubTable(g.a, [
                  r => html`<strong>${norm(r["id-materiale"]) || norm(r["codice-inventario"])}</strong>`,
                  r => [norm(r.categoria), norm(r.tipologia)].filter(Boolean).join(" · "),
                  r => norm(r.turno),
                  r => norm(r.servizio)
                ])}
              ` : ""}

              ${!g.v.length && !g.m.length && !g.a.length ? html`
                <p class="has-text-grey is-size-7 mt-2">Nessuna risorsa preaccreditata</p>
              ` : ""}
            </div>
          ` : ""}
        </div>
      `;
    });
  }

  function view() {
    const filtV  = applyFilters(rawV);
    const filtM  = applyFilters(rawM);
    const filtA  = applyFilters(rawA);
    const groups = buildGroups();
    const totOrg = groups.length;
    const totV   = filtV.length;
    const totM   = filtM.length;
    const totA   = filtA.length;
    const uniqV  = new Set(filtV.map(r => norm(r["codice-fiscale"])).filter(Boolean)).size;
    const uniqM  = new Set(filtM.map(r => norm(r.targa)).filter(Boolean)).size;
    const uniqA  = new Set(filtA.map(r => norm(r["id-materiale"]) || norm(r["codice-inventario"])).filter(Boolean)).size;

    return html`
      <!-- filtri -->
      <div class="box mb-3">
        <h3 class="title is-4 mb-4">
          <span class="icon is-medium" style="vertical-align:middle;margin-right:.4rem">
            <i class="ri-calendar-event-line ri-lg"></i>
          </span>Riepilogo preaccreditamenti
        </h3>

        ${loading ? html`<progress class="progress is-small is-primary mb-3"></progress>` : ""}

        ${error ? html`
          <div class="notification is-danger is-light mb-3">
            <button class="delete" @click=${() => { error = null; rerender(); }}></button>
            Errore durante il caricamento dei dati.
            <button class="button is-small is-light ml-3" @click=${load}>Riprova</button>
          </div>
        ` : ""}

        ${allTurni.length ? html`
          <div class="mb-3">
            <p class="heading mb-2">Turni</p>
            <div class="tags">
              ${chip("Tutti", filterTurni.size === 0, () => { filterTurni.clear(); rerender(); })}
              ${allTurni.map(t => chip(t, filterTurni.has(t), () => toggleTurno(t)))}
            </div>
          </div>
        ` : ""}

        ${allServizi.length ? html`
          <div class="mb-2">
            <p class="heading mb-2">Servizi</p>
            <div class="tags">
              ${chip("Tutti", filterServizi.size === 0, () => { filterServizi.clear(); rerender(); })}
              ${allServizi.map(s => chip(s, filterServizi.has(s), () => toggleServizio(s)))}
            </div>
          </div>
        ` : ""}
      </div>

      <!-- kpi + toolbar -->
      <div class="is-flex is-align-items-center is-flex-wrap-wrap mb-3" style="gap:1.5rem">
        <div class="is-flex" style="gap:1.5rem;flex-wrap:wrap">
          ${kpiBox("ri-building-line", "organizzazioni", totOrg)}
          ${kpiBox("ri-user-line", "volontari", totV, uniqV)}
          ${kpiBox("ri-truck-line", "mezzi", totM, uniqM)}
          ${kpiBox("ri-tools-line", "materiali", totA, uniqA)}
        </div>

        <div class="is-flex is-align-items-center" style="gap:.5rem;margin-left:auto;flex-wrap:wrap">
          <input class="input is-small" style="width:200px"
            placeholder="Cerca organizzazione…"
            .value=${search}
            @input=${e => { search = e.target.value; rerender(); }}>

          <div class="buttons has-addons mb-0">
            <button class="button is-small ${viewMode === "summary" ? "is-primary is-selected" : ""}"
              @click=${() => { viewMode = "summary"; rerender(); }}>
              <span class="icon"><i class="ri-table-line"></i></span>
              <span>Riepilogo</span>
            </button>
            <button class="button is-small ${viewMode === "detail" ? "is-primary is-selected" : ""}"
              @click=${() => { viewMode = "detail"; rerender(); }}>
              <span class="icon"><i class="ri-list-unordered"></i></span>
              <span>Dettaglio</span>
            </button>
          </div>

          <button class="button is-small is-light" title="Ricarica" @click=${load} ?disabled=${loading}>
            <span class="icon"><i class="ri-refresh-line"></i></span>
          </button>
        </div>
      </div>

      <!-- risultati -->
      ${!loading && groups.length === 0 ? html`
        <div class="notification is-light">
          Nessuna organizzazione trovata${filterTurni.size || filterServizi.size ? " con i filtri attivi" : ""}.
        </div>
      ` : ""}

      ${viewMode === "summary" ? summaryTable(groups) : detailAccordion(groups)}
    `;
  }

  load();
  return view();
}
