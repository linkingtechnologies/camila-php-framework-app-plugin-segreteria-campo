// views/massive-check-in/step2.js

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(v) {
  return String(v ?? "").trim();
}

function getCF(r) {
  return norm(r["codice-fiscale"]);
}

function getTurno(r) {
  return norm(r["turno"]);
}

function getCognome(r) {
  return norm(r["cognome"] ?? r.cognome);
}

function getNome(r) {
  return norm(r["nome"] ?? r.nome);
}

function sortByName(a, b) {
  const c = a.cognome.localeCompare(b.cognome, "it");
  if (c !== 0) return c;
  return a.nome.localeCompare(b.nome, "it");
}

function mergeByCF(preRecords, attRecords) {
  // One row per CF, shifts aggregated.
  // Priority: if CF exists in preaccreditati, it belongs to pre section.
  const preMap = new Map();
  const attMap = new Map();

  function upsert(map, r) {
    const cf = getCF(r);
    if (!cf) return;

    const turno = getTurno(r);
    const cognome = getCognome(r);
    const nome = getNome(r);

    if (!map.has(cf)) {
      map.set(cf, {
        cf,
        cognome,
        nome,
        turni: new Set(turno ? [turno] : [])
      });
      return;
    }

    const cur = map.get(cf);
    if (!cur.cognome && cognome) cur.cognome = cognome;
    if (!cur.nome && nome) cur.nome = nome;
    if (turno) cur.turni.add(turno);
  }

  preRecords.forEach(r => upsert(preMap, r));
  attRecords.forEach(r => upsert(attMap, r));

  const preRows = [];
  const attRows = [];

  for (const [cf, row] of preMap.entries()) {
    const att = attMap.get(cf);
    if (att) {
      att.turni.forEach(t => row.turni.add(t));
      if (!row.cognome && att.cognome) row.cognome = att.cognome;
      if (!row.nome && att.nome) row.nome = att.nome;
    }
    preRows.push(row);
  }

  for (const [cf, row] of attMap.entries()) {
    if (!preMap.has(cf)) attRows.push(row);
  }

  preRows.sort(sortByName);
  attRows.sort(sortByName);

  return { preRows, attRows };
}

function collectPreTurni(preRows) {
  const s = new Set();
  preRows.forEach(r => r.turni.forEach(t => t && s.add(t)));
  return Array.from(s).sort((a, b) => a.localeCompare(b, "it"));
}

function rowMatchesQuery(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const turni = r.turni ? Array.from(r.turni).join(" ") : "";
  const hay = `${r.cf} ${r.cognome} ${r.nome} ${turni}`.toLowerCase();
  return hay.includes(s);
}

/* ---------- highlight helpers ---------- */

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

function validateCF(cf) {
  // Minimal validation: 16 chars (Italian CF) - adjust if needed.
  const v = norm(cf).toUpperCase();
  if (!v) return "Codice fiscale obbligatorio";
  if (v.length !== 16) return "Codice fiscale deve essere lungo 16 caratteri";
  return null;
}

export async function Step2({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;

  let preRows = [];
  let attRows = [];

  if (!state.step2Selected) state.step2Selected = [];
  let selected = new Set(state.step2Selected);

  // Pre filters
  if (state.preTurnoFilter === undefined) state.preTurnoFilter = "";
  let turnoFilter = state.preTurnoFilter;

  // Search inputs (persisted in state)
  if (state.preSearch === undefined) state.preSearch = "";
  if (state.attSearch === undefined) state.attSearch = "";
  let preSearch = state.preSearch;
  let attSearch = state.attSearch;

  const Pre = client.table("volontari-preaccreditati");
  const Att = client.table("db-volontari");

  // Modal state for manual volunteer insertion
  let modalOpen = false;
  let modalBusy = false;
  let modalError = null;

  let form = {
    cf: "",
    cognome: "",
    nome: "",
    turno: ""
  };

  async function load() {
    try {
      loading = true;
      error = null;
      rerender();

      const [resPre, resAtt] = await Promise.all([
        Pre.list({
          filters: [client.filter("organizzazione", "eq", state.org.name)],
          include: ["codice-fiscale", "cognome", "nome", "turno"],
          size: 5000
        }),
        Att.list({
          filters: [client.filter("organizzazione", "eq", state.org.name)],
          include: ["codice-fiscale", "cognome", "nome"],
          size: 5000
        })
      ]);

      const merged = mergeByCF(getRecords(resPre), getRecords(resAtt));
      preRows = merged.preRows;
      attRows = merged.attRows;
    } catch (e) {
      error = e;
    } finally {
      loading = false;

      const keys = new Set([...preRows, ...attRows].map(r => r.cf));
      selected = new Set([...selected].filter(cf => keys.has(cf)));
      state.step2Selected = [...selected];

      rerender();
    }
  }

  function toggle(cf, on) {
    if (!cf) return;
    on ? selected.add(cf) : selected.delete(cf);
    state.step2Selected = [...selected];
    rerender();
  }

  function deselectAll() {
    selected.clear();
    state.step2Selected = [];
    rerender();
  }

  function getPreFiltered() {
    let out = preRows;
    if (turnoFilter) out = out.filter(r => r.turni.has(turnoFilter));
    if (preSearch) out = out.filter(r => rowMatchesQuery(r, preSearch));
    return out;
  }

  function getAttFiltered() {
    if (!attSearch) return attRows;
    return attRows.filter(r => rowMatchesQuery(r, attSearch));
  }

  function selectVisiblePre() {
    getPreFiltered().forEach(r => selected.add(r.cf));
    state.step2Selected = [...selected];
    rerender();
  }

  function doCheckin() {
    // Build a confirmation payload with org header + selected volunteers.
    const byCf = new Map();
    [...preRows, ...attRows].forEach(r => r && r.cf && byCf.set(r.cf, r));

    const volunteers = [...selected]
      .map(cf => {
        const r = byCf.get(cf);
        if (!r) return null;

        return {
          cf: r.cf,
          cognome: r.cognome || "",
          nome: r.nome || "",
          turni: Array.from(r.turni || [])
        };
      })
      .filter(Boolean);

    state.checkinSelection = {
      org: {
        name: state.org.name || "",
        code: state.org.code || "",
        province: state.org.province || ""
      },
      volunteers
    };

    goTo(3);
  }

  // Modal handlers
  function openModal() {
    modalOpen = true;
    modalBusy = false;
    modalError = null;

    form = {
      cf: "",
      cognome: "",
      nome: "",
      turno: turnoFilter || ""
    };

    rerender();
  }

  function closeModal() {
    if (modalBusy) return;
    modalOpen = false;
    modalError = null;
    rerender();
  }

  async function submitNewVolunteer() {
    if (modalBusy) return;

    modalError = null;

    const cfErr = validateCF(form.cf);
    if (cfErr) {
      modalError = cfErr;
      rerender();
      return;
    }

    const cf = norm(form.cf).toUpperCase();
    const cognome = norm(form.cognome);
    const nome = norm(form.nome);
    const turno = norm(form.turno);

    if (!cognome) {
      modalError = "Cognome obbligatorio";
      rerender();
      return;
    }
    if (!nome) {
      modalError = "Nome obbligatorio";
      rerender();
      return;
    }
    // Turno is optional by request.

    modalBusy = true;
    rerender();

    try {
      // Insert into preaccreditati so it appears in the top section.
      // Turno is included only if provided.
      const payload = {
        "organizzazione": state.org.name || "",
        "codice-organizzazione": state.org.code || "",
        "provincia": state.org.province || "",
        "codice-fiscale": cf,
        "cognome": cognome,
        "nome": nome
      };

      if (turno) payload["turno"] = turno;

      await Pre.create(payload);

      modalOpen = false;
      modalBusy = false;

      await load();

      // Auto-select newly inserted CF.
      selected.add(cf);
      state.step2Selected = [...selected];
      rerender();
    } catch (e) {
      modalError = String(e && (e.payload || e.message || e));
      modalBusy = false;
      rerender();
    }
  }

  function section(title, kind) {
    // kind: "pre" | "att"
    const rows = kind === "pre" ? getPreFiltered() : getAttFiltered();
    const searchValue = kind === "pre" ? preSearch : attSearch;
    const turniOptions = collectPreTurni(preRows);

    return html`
      <div class="box ${kind === "pre" ? "pre-section" : ""}">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:flex-end;">
            <h3 class="subtitle" style="margin-bottom:0;">
              ${title} <span class="tag is-light ml-2">${rows.length}</span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:360px;">
              <div class="control">
                <input class="input is-small"
                  placeholder="Cerca per CF, cognome, nome, turno…"
                  .value=${searchValue}
                  @input=${e => {
                    const v = e.target.value;
                    if (kind === "pre") { preSearch = v; state.preSearch = v; }
                    else { attSearch = v; state.attSearch = v; }
                    rerender();
                  }}>
              </div>
            </div>
          </div>

          ${kind === "pre" ? html`
            <div class="level-right" style="min-width:420px">
              <div class="field" style="margin-bottom:0;">
                <!-- VARIANTE: select + button su stessa riga con gap -->
                <div style="display:flex; gap:0.75rem; align-items:flex-end;">
                  <div class="control" style="flex:1;">
                    <div class="select is-fullwidth is-small">
                      <select
                        .value=${turnoFilter}
                        @change=${e => {
                          turnoFilter = e.target.value;
                          state.preTurnoFilter = turnoFilter;
                          rerender();
                        }}>
                        <option value="">Tutti i turni</option>
                        ${turniOptions.map(t => html`<option value=${t}>${t}</option>`)}
                      </select>
                    </div>
                  </div>

                  <div class="control">
                    <button class="button is-info is-small"
                      @click=${openModal}>
                      + Aggiungi volontario
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ` : ""}
        </div>

        ${kind === "pre" ? html`
          <div class="buttons">
            <button class="button is-small"
                    @click=${selectVisiblePre}
                    ?disabled=${rows.length === 0}>
              Seleziona preaccreditati visibili
            </button>
          </div>
        ` : ""}

        <div class="table-container">
          <table class="table is-striped is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th style="width:3.5rem">✓</th>
                <th>Codice fiscale</th>
                <th>Cognome</th>
                <th>Nome</th>
                <th>Turno</th>
              </tr>
            </thead>
            <tbody>
              ${rows.length === 0 ? html`
                <tr><td colspan="5"><em>Nessun volontario.</em></td></tr>
              ` : ""}

              ${rows.map(r => {
                const checked = selected.has(r.cf);
                const q = kind === "pre" ? preSearch : attSearch;

                return html`
                  <tr class=${checked ? "row-selected" : ""} style="cursor:pointer"
                      @click=${() => toggle(r.cf, !checked)}>
                    <td>
                      <input type="checkbox"
                        .checked=${checked}
                        @click=${e => e.stopPropagation()}
                        @change=${e => toggle(r.cf, e.target.checked)}>
                    </td>
                    <td>${highlight(r.cf, q, html)}</td>
                    <td>${highlight(r.cognome, q, html)}</td>
                    <td>${highlight(r.nome, q, html)}</td>
                    <td>
                      ${[...r.turni].map(t => html`
                        <span class="tag is-light mr-2 mb-1">
                          ${highlight(t, q, html)}
                        </span>
                      `)}
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

  function modal() {
    if (!modalOpen) return "";

    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${closeModal}></div>

        <div class="modal-card" style="width:min(920px, 96vw);">
          <header class="modal-card-head">
            <p class="modal-card-title">Aggiungi volontario</p>
            <button class="delete" aria-label="close" @click=${closeModal}></button>
          </header>

          <section class="modal-card-body">
            ${modalError ? html`
              <article class="message is-danger">
                <div class="message-body">${modalError}</div>
              </article>
            ` : ""}

            <div class="field is-small">
              <label class="label">Codice fiscale</label>
              <div class="control">
                <input class="input is-small"
                  .value=${form.cf}
                  ?disabled=${modalBusy}
                  placeholder="RSSMRA80A01H501U"
                  @input=${e => { form.cf = e.target.value; rerender(); }}>
              </div>
            </div>

            <div class="columns">
              <div class="column">
                <div class="field">
                  <label class="label">Cognome</label>
                  <div class="control">
                    <input class="input"
                      .value=${form.cognome}
                      ?disabled=${modalBusy}
                      placeholder="Rossi"
                      @input=${e => { form.cognome = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>

              <div class="column">
                <div class="field">
                  <label class="label">Nome</label>
                  <div class="control">
                    <input class="input"
                      .value=${form.nome}
                      ?disabled=${modalBusy}
                      placeholder="Mario"
                      @input=${e => { form.nome = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>
            </div>

            <div class="field">
              <label class="label">Turno (opzionale)</label>
              <div class="control">
                <input class="input"
                  .value=${form.turno}
                  ?disabled=${modalBusy}
                  placeholder="es. Mattina / Pomeriggio / 08:00-12:00"
                  @input=${e => { form.turno = e.target.value; rerender(); }}>
              </div>
              <p class="help">Se lasci vuoto, il volontario verrà inserito senza turno.</p>
            </div>

            <article class="message is-info is-light">
              <div class="message-body">
                Organizzazione: <strong>${state.org.name}</strong>
                ${state.org.code ? html`<span class="tag ml-2">${state.org.code}</span>` : ""}
                ${state.org.province ? html`<span class="tag is-light ml-2">${state.org.province}</span>` : ""}
              </div>
            </article>
          </section>

          <footer class="modal-card-foot">
            <button class="button is-primary"
              ?disabled=${modalBusy}
              @click=${submitNewVolunteer}>
              ${modalBusy ? "Salvataggio…" : "Salva"}
            </button>

            <button class="button"
              ?disabled=${modalBusy}
              @click=${closeModal}>
              Annulla
            </button>
          </footer>
        </div>
      </div>
    `;
  }

  function view() {
    return html`
      <div class="box">
        <p>
          <strong>${state.org.name}</strong>
          ${state.org.code ? html`<span class="tag ml-2">${state.org.code}</span>` : ""}
          ${state.org.province ? html`<span class="tag is-light ml-2">${state.org.province}</span>` : ""}
        </p>

        <div class="buttons mt-2">
          <button class="button is-light is-small"
                  @click=${() => goTo(1)}>
            Indietro
          </button>

          <button class="button is-small"
                  @click=${deselectAll}
                  ?disabled=${selected.size === 0}>
            Deseleziona tutto
          </button>

          <button class="button is-primary is-small"
                  ?disabled=${selected.size === 0}
                  @click=${doCheckin}>
            Check-in volontari selezionati (${selected.size})
          </button>

          <button class="button is-small"
                  @click=${() => goTo(4)}>
            Passa direttamente a Check-in mezzi
          </button>

        </div>

        ${loading ? html`<progress class="progress is-small is-primary"></progress>` : ""}
        ${error ? html`
          <article class="message is-danger">
            <div class="message-body">${String(error)}</div>
          </article>
        ` : ""}
      </div>

      ${section("Volontari preaccreditati", "pre")}
      ${section("DB Volontari", "att")}

      ${modal()}
    `;
  }

  function rerender() {
    render(view(), root);
  }

  load();
  return view();
}
