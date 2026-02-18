// views/massive-check-in/step4.js

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(v) {
  return String(v ?? "").trim();
}

function upper(v) {
  return norm(v).toUpperCase();
}

function getTarga(r) {
  return upper(r["targa"] ?? r.targa);
}

function sortByTarga(a, b) {
  return a.targa.localeCompare(b.targa, "it");
}

function pickFields(r) {
  return {
    inventario: norm(r["codice-inventario"]),
    categoria: norm(r["categoria"]),
    tipologia: norm(r["tipologia"]),
    marca: norm(r["marca"]),
    modello: norm(r["modello"]),
    note: norm(r["note"])
  };
}

function mergeField(dst, src, key) {
  if (!dst[key] && src[key]) dst[key] = src[key];
}

/**
 * Merge per targa:
 * - una riga per targa
 * - priorità: se la targa è in preaccreditati, va nella sezione "Preaccreditati"
 * - se presente anche in "attesi", non duplica: merge (riempiendo i campi mancanti)
 */
function mergeByTarga(preRecords, attRecords) {
  const preMap = new Map();
  const attMap = new Map();

  function upsert(map, r) {
    const targa = getTarga(r);
    if (!targa) return;

    const extra = pickFields(r);

    if (!map.has(targa)) {
      map.set(targa, { targa, ...extra });
      return;
    }

    const cur = map.get(targa);
    mergeField(cur, extra, "inventario");
    mergeField(cur, extra, "categoria");
    mergeField(cur, extra, "tipologia");
    mergeField(cur, extra, "marca");
    mergeField(cur, extra, "modello");
    mergeField(cur, extra, "note");
  }

  preRecords.forEach(r => upsert(preMap, r));
  attRecords.forEach(r => upsert(attMap, r));

  const preRows = [];
  const attRows = [];

  for (const [targa, row] of preMap.entries()) {
    const att = attMap.get(targa);
    if (att) {
      mergeField(row, att, "inventario");
      mergeField(row, att, "categoria");
      mergeField(row, att, "tipologia");
      mergeField(row, att, "marca");
      mergeField(row, att, "modello");
      mergeField(row, att, "note");
    }
    preRows.push(row);
  }

  for (const [targa, row] of attMap.entries()) {
    if (!preMap.has(targa)) attRows.push(row);
  }

  preRows.sort(sortByTarga);
  attRows.sort(sortByTarga);

  return { preRows, attRows };
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
    r.note
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

function validateTarga(targa) {
  const v = upper(targa);
  if (!v) return "Targa obbligatoria";
  if (v.length < 3) return "Targa non valida";
  return null;
}

/* ----------------- CSV utils + Tipologie parser ----------------- */

function csvToOptions(csv) {
  return String(csv || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Tipologie CSV supports group labels prefixed with "--".
 * Example: "--Veicoli,Autovettura,Furgone,--Rimorchi,Carrello"
 */
function parseTipologieCsv(csv) {
  const tokens = csvToOptions(csv);

  const groups = [];
  const itemToGroup = new Map();
  const groupToItems = new Map();

  let currentGroup = null;

  function ensureGroup(name) {
    const n = norm(name);
    if (!n) return null;
    if (!groupToItems.has(n)) {
      groupToItems.set(n, []);
      groups.push(n);
    }
    return n;
  }

  for (const t of tokens) {
    if (t.startsWith("--")) {
      currentGroup = ensureGroup(t.replace(/^--+/, "").trim());
      continue;
    }

    const item = t;

    if (currentGroup) {
      groupToItems.get(currentGroup).push(item);
      if (!itemToGroup.has(item)) itemToGroup.set(item, currentGroup);
    } else {
      if (!groupToItems.has("")) groupToItems.set("", []);
      groupToItems.get("").push(item);
      if (!itemToGroup.has(item)) itemToGroup.set(item, "");
    }
  }

  return { groups, itemToGroup, groupToItems };
}

export async function Step4({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;

  let preRows = [];
  let attRows = [];

  // Selection persisted
  if (!state.step4Selected) state.step4Selected = [];
  let selected = new Set(state.step4Selected);

  // Search inputs (persisted)
  if (state.preMezziSearch === undefined) state.preMezziSearch = "";
  if (state.attMezziSearch === undefined) state.attMezziSearch = "";
  let preSearch = state.preMezziSearch;
  let attSearch = state.attMezziSearch;

  // Toggle: carica TUTTI i mezzi attesi (persistito)
  if (state.loadAllAttesi === undefined) state.loadAllAttesi = false;
  let loadAllAttesi = state.loadAllAttesi;

  const Pre = client.table("mezzi-preaccreditati");
  const Att = client.table("db-mezzi");

  /* ----------------- MODAL: dropdown values ----------------- */

  // Valori mostrati nelle tendine (separati da virgola)
  let CATEGORIE_OPTS =
    "Non assegnata,Imbarcazioni,Mezzi aerei,Mezzi speciali,Rimorchi,Veicoli";

  let TIPOLOGIE_OPTS =
    "Non assegnata,--Imbarcazioni,Barca,Gommone,Hovercraft,Moto d'acqua,--Mezzi aerei,Aeroplano,Drone,Elicottero,Idrovolante,ULM (ultraleggero motorizzato),--Mezzi speciali,Battipista,Bobcat,Escavatore,Listo spazzola,Motoslitta,Muletto,Sollevatore idraulico,Spargi sabbia e sale,Spazzaneve,Terna,--Rimorchi,Biga,Carrello,Carrello Appendice,Rimorchio,Roulotte,Semirimorchio,--Veicoli,Ambulanza,Autobotte,Autobus,Autocarro,Autogru,Autoidroschiuma,Automedica,Autopompa serbatoio (APS),Autoscala,Autovettura,Camper,Carro attrezzi,Fuoristrada,Furgone,Motociclo,Motrice,Trattore agricolo,Trattore stradale";

  // Pre-parse tipologie once
  const TIP = parseTipologieCsv(TIPOLOGIE_OPTS);

  function normalizeCategoriaLabel(s) {
    return norm(s);
  }

  /**
   * Se categoria è selezionata (e NON è "Non assegnata"),
   * la tendina Tipologia mostra SOLO le tipologie di quella categoria,
   * e "Non assegnata" sparisce (quindi la tipologia diventa di fatto obbligatoria/pertinente).
   */
  function getTipologieForCategoria(categoria) {
    const cat = normalizeCategoriaLabel(categoria);

    // show everything if categoria not selected or "Non assegnata"
    if (!cat || cat === "Non assegnata") return { mode: "all" };

    const items = TIP.groupToItems.get(cat) || [];
    return { mode: "filtered", group: cat, items: [...items] };
  }

  function isTipologiaAllowedForCategoria(tipologia, categoria) {
    const tip = norm(tipologia);
    if (!tip) return true;

    const cat = normalizeCategoriaLabel(categoria);
    if (!cat || cat === "Non assegnata") return true;

    const g = TIP.itemToGroup.get(tip);
    return g === cat;
  }

  function autoSetCategoriaFromTipologia(tipologia) {
    const tip = norm(tipologia);
    if (!tip) return;

    if (tip === "Non assegnata") {
      form.categoria = form.categoria || "Non assegnata";
      return;
    }

    const g = TIP.itemToGroup.get(tip);
    if (g) form.categoria = g;
  }

  // Modal state: aggiungi mezzo
  let modalOpen = false;
  let modalBusy = false;
  let modalError = null;

  // NOTE: inventario rimosso dalla modale
  let form = {
    targa: "",
    categoria: "",
    tipologia: "",
    marca: "",
    modello: "",
    note: ""
  };

  async function load() {
    try {
      loading = true;
      error = null;
      rerender();

      const includeFields = [
        "targa",
        "codice-inventario",
        "categoria",
        "tipologia",
        "marca",
        "modello",
        "note"
      ];

      const preReq = Pre.list({
        filters: [client.filter("organizzazione", "eq", state.org.name)],
        include: includeFields,
        size: 5000
      });

      const attReq = loadAllAttesi
        ? Att.list({ include: includeFields, size: 5000 })
        : Att.list({
            filters: [client.filter("organizzazione", "eq", state.org.name)],
            include: includeFields,
            size: 5000
          });

      const [resPre, resAtt] = await Promise.all([preReq, attReq]);

      const merged = mergeByTarga(getRecords(resPre), getRecords(resAtt));
      preRows = merged.preRows;
      attRows = merged.attRows;
    } catch (e) {
      error = e;
    } finally {
      loading = false;

      const keys = new Set([...preRows, ...attRows].map(r => r.targa));
      selected = new Set([...selected].filter(t => keys.has(t)));
      state.step4Selected = [...selected];

      rerender();
    }
  }

  function toggle(targa, on) {
    if (!targa) return;
    on ? selected.add(targa) : selected.delete(targa);
    state.step4Selected = [...selected];
    rerender();
  }

  function deselectAll() {
    selected.clear();
    state.step4Selected = [];
    rerender();
  }

  function getPreFiltered() {
    let out = preRows;
    if (preSearch) out = out.filter(r => rowMatchesQuery(r, preSearch));
    return out;
  }

  function getAttFiltered() {
    let out = attRows;
    if (attSearch) out = out.filter(r => rowMatchesQuery(r, attSearch));
    return out;
  }

  function selectVisiblePre() {
    getPreFiltered().forEach(r => selected.add(r.targa));
    state.step4Selected = [...selected];
    rerender();
  }

  function back() {
    goTo(3);
  }

  function toggleLoadAllAttesi(v) {
    loadAllAttesi = v;
    state.loadAllAttesi = v;
    load();
  }

  function doCheckinMezzi() {
    // Payload come Step2: org + mezzi selezionati
    const byTarga = new Map();
    [...preRows, ...attRows].forEach(r => r && r.targa && byTarga.set(r.targa, r));

    const mezzi = [...selected]
      .map(targa => {
        const r = byTarga.get(targa);
        if (!r) return null;

        return {
          targa: r.targa,
          "codice-inventario": r.inventario || "",
          categoria: r.categoria || "",
          tipologia: r.tipologia || "",
          marca: r.marca || "",
          modello: r.modello || "",
          note: r.note || ""
        };
      })
      .filter(Boolean);

    state.mezziSelection = {
      org: {
        name: state.org.name || "",
        code: state.org.code || "",
        province: state.org.province || ""
      },
      mezzi
    };

    goTo(5);
  }

  /* ---------- Modal handlers ---------- */

  function openModal() {
    modalOpen = true;
    modalBusy = false;
    modalError = null;

    form = {
      targa: "",
      categoria: "",
      tipologia: "",
      marca: "",
      modello: "",
      note: ""
    };

    rerender();
  }

  function closeModal() {
    if (modalBusy) return;
    modalOpen = false;
    modalError = null;
    rerender();
  }

  async function submitNewMezzo() {
    if (modalBusy) return;

    modalError = null;

    const targaErr = validateTarga(form.targa);
    if (targaErr) {
      modalError = targaErr;
      rerender();
      return;
    }

    if (!norm(form.marca)) {
      modalError = "Marca obbligatoria";
      rerender();
      return;
    }

    if (!norm(form.modello)) {
      modalError = "Modello obbligatorio";
      rerender();
      return;
    }

    // Se categoria è selezionata (non "Non assegnata"), la tipologia è obbligatoria
    const catNorm = normalizeCategoriaLabel(form.categoria);
    if (catNorm && catNorm !== "Non assegnata") {
      if (!norm(form.tipologia)) {
        modalError = "Tipologia obbligatoria quando la categoria è selezionata.";
        rerender();
        return;
      }
      if (!isTipologiaAllowedForCategoria(form.tipologia, form.categoria)) {
        modalError = "Tipologia non coerente con la categoria selezionata.";
        rerender();
        return;
      }
    }

    const targa = upper(form.targa);

    const existsNow = [...preRows, ...attRows].some(r => r.targa === targa);
    if (existsNow) {
      modalError = "Mezzo già presente (stessa targa).";
      rerender();
      return;
    }

    modalBusy = true;
    rerender();

    try {
      const payload = {
        "organizzazione": state.org.name || "",
        "codice-organizzazione": state.org.code || "",
        "provincia": state.org.province || "",
        "targa": targa,
        "marca": norm(form.marca),
        "modello": norm(form.modello)
      };

      const cat = norm(form.categoria);
      const tip = norm(form.tipologia);
      const note = norm(form.note);

      if (cat) payload["categoria"] = cat;
      if (tip) payload["tipologia"] = tip;
      if (note) payload["note"] = note;

      await Pre.create(payload);

      modalOpen = false;
      modalBusy = false;

      await load();

      // Auto-select newly added vehicle
      selected.add(targa);
      state.step4Selected = [...selected];
      rerender();
    } catch (e) {
      modalError = String(e && (e.payload || e.message || e));
      modalBusy = false;
      rerender();
    }
  }

  function modal() {
    if (!modalOpen) return "";

    const categorieList = csvToOptions(CATEGORIE_OPTS);
    const tipView = getTipologieForCategoria(form.categoria);

    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${closeModal}></div>

        <div class="modal-card" style="width:min(980px, 96vw);">
          <header class="modal-card-head">
            <p class="modal-card-title">Aggiungi mezzo preaccreditato</p>
            <button class="delete" aria-label="close" @click=${closeModal}></button>
          </header>

          <section class="modal-card-body">
            ${modalError ? html`
              <article class="message is-danger">
                <div class="message-body">${modalError}</div>
              </article>
            ` : ""}

            <div class="field">
              <label class="label">Targa *</label>
              <div class="control">
                <input class="input"
                  .value=${form.targa}
                  ?disabled=${modalBusy}
                  placeholder="AB123CD"
                  @input=${e => { form.targa = e.target.value; rerender(); }}>
              </div>
            </div>

            <div class="columns">
              <div class="column">
                <div class="field">
                  <label class="label">Marca *</label>
                  <div class="control">
                    <input class="input"
                      .value=${form.marca}
                      ?disabled=${modalBusy}
                      @input=${e => { form.marca = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>

              <div class="column">
                <div class="field">
                  <label class="label">Modello *</label>
                  <div class="control">
                    <input class="input"
                      .value=${form.modello}
                      ?disabled=${modalBusy}
                      @input=${e => { form.modello = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>
            </div>

            <div class="columns is-multiline">
              <div class="column is-half">
                <div class="field">
                  <label class="label">Categoria</label>
                  <div class="control">
                    <div class="select is-fullwidth">
                      <select
                        .value=${form.categoria}
                        ?disabled=${modalBusy}
                        @change=${e => {
                          form.categoria = e.target.value;

                          // se la tipologia non è più coerente con la nuova categoria, la resetto
                          if (norm(form.tipologia) && !isTipologiaAllowedForCategoria(form.tipologia, form.categoria)) {
                            form.tipologia = "";
                          }

                          rerender();
                        }}>
                        <option value="">Seleziona…</option>
                        ${categorieList.map(v => html`<option value=${v}>${v}</option>`)}
                      </select>
                    </div>
                  </div>

                  <p class="help">
                    ${normalizeCategoriaLabel(form.categoria) && normalizeCategoriaLabel(form.categoria) !== "Non assegnata"
                      ? html`Con una categoria selezionata, la tipologia diventa <strong>obbligatoria</strong>.`
                      : html`Se scegli una tipologia, la categoria verrà impostata automaticamente.`}
                  </p>
                </div>
              </div>

              <div class="column is-half">
                <div class="field">
                  <label class="label">Tipologia</label>
                  <div class="control">
                    <div class="select is-fullwidth">
                      <select
                        .value=${form.tipologia}
                        ?disabled=${modalBusy}
                        @change=${e => {
                          form.tipologia = e.target.value;

                          // auto-set categoria dalla tipologia (se possibile)
                          autoSetCategoriaFromTipologia(form.tipologia);

                          rerender();
                        }}>
                        <option value="">Seleziona…</option>

                        ${tipView.mode === "filtered"
                          ? tipView.items.map(v => html`<option value=${v}>${v}</option>`)
                          : html`
                              ${(TIP.groupToItems.get("") || []).map(v => html`<option value=${v}>${v}</option>`)}
                              ${TIP.groups.map(g => html`
                                <option disabled value="">${g}</option>
                                ${(TIP.groupToItems.get(g) || []).map(v => html`<option value=${v}>${v}</option>`)}
                              `)}
                            `}
                      </select>
                    </div>
                  </div>

                  <p class="help">
                    ${tipView.mode === "filtered"
                      ? html`Mostrate solo le tipologie di <strong>${tipView.group}</strong>.`
                      : html`Puoi scegliere una tipologia: la categoria verrà impostata automaticamente.`}
                  </p>
                </div>
              </div>

              <div class="column is-full">
                <div class="field">
                  <label class="label">Note</label>
                  <div class="control">
                    <textarea class="textarea"
                      rows="3"
                      ?disabled=${modalBusy}
                      .value=${form.note}
                      @input=${e => { form.note = e.target.value; rerender(); }}></textarea>
                  </div>
                </div>
              </div>
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
              @click=${submitNewMezzo}>
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

  /* ---------- UI sections ---------- */

  function section(title, kind) {
    const rows = kind === "pre" ? getPreFiltered() : getAttFiltered();
    const searchValue = kind === "pre" ? preSearch : attSearch;

    return html`
      <div class="box ${kind === "pre" ? "pre-section" : ""}">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:flex-end;">
            <h3 class="subtitle" style="margin-bottom:0;">
              ${title} <span class="tag is-light ml-2">${rows.length}</span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:360px;">
              <div class="control">
                <input class="input"
                  placeholder="Cerca per targa, inventario, marca, modello…"
                  .value=${searchValue}
                  ?disabled=${loading}
                  @input=${e => {
                    const v = e.target.value;
                    if (kind === "pre") { preSearch = v; state.preMezziSearch = v; }
                    else { attSearch = v; state.attMezziSearch = v; }
                    rerender();
                  }}>
              </div>
            </div>
          </div>

          ${kind === "pre" ? html`
            <div class="level-right" style="gap:0.5rem;">
              <button class="button is-small"
                      @click=${selectVisiblePre}
                      ?disabled=${loading || rows.length === 0}>
                Seleziona preaccreditati visibili
              </button>

              <button class="button is-info is-small"
                      @click=${openModal}
                      ?disabled=${loading}>
                + Aggiungi mezzo
              </button>
            </div>
          ` : ""}
        </div>

        <div class="table-container">
          <table class="table is-striped is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th style="width:3.5rem">✓</th>
                <th>Targa</th>
                <th>Codice inventario</th>
                <th>Categoria</th>
                <th>Tipologia</th>
                <th>Marca</th>
                <th>Modello</th>
                <th>Note</th>
              </tr>
            </thead>

            <tbody>
              ${(!loading && rows.length === 0) ? html`
                <tr><td colspan="8"><em>Nessun mezzo.</em></td></tr>
              ` : ""}

              ${rows.map(r => {
                const checked = selected.has(r.targa);

                return html`
                  <tr class=${checked ? "row-selected" : ""} style="cursor:pointer"
                      @click=${() => toggle(r.targa, !checked)}>
                    <td>
                      <input type="checkbox"
                        .checked=${checked}
                        @click=${e => e.stopPropagation()}
                        @change=${e => toggle(r.targa, e.target.checked)}>
                    </td>

                    <td><strong>${r.targa}</strong></td>
                    <td>${r.inventario || ""}</td>
                    <td>${r.categoria || ""}</td>
                    <td>${r.tipologia || ""}</td>
                    <td>${r.marca || ""}</td>
                    <td>${r.modello || ""}</td>
                    <td>${r.note || ""}</td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
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

        <div class="field">
          <label class="checkbox">
            <input type="checkbox"
              .checked=${loadAllAttesi}
              ?disabled=${loading || modalBusy}
              @change=${e => toggleLoadAllAttesi(e.target.checked)}>
            Carica tutti i mezzi nel database (ignora filtro organizzazione)
          </label>
        </div>

        <div class="buttons mt-2">
          <button class="button is-light is-small" @click=${back} ?disabled=${modalBusy}>
            Indietro
          </button>

          <button class="button is-small"
                  @click=${deselectAll}
                  ?disabled=${selected.size === 0}>
            Deseleziona tutto
          </button>

          <button class="button is-primary is-small"
                  ?disabled=${selected.size === 0 || loading}
                  @click=${doCheckinMezzi}>
            Check-in mezzi (${selected.size})
          </button>
        </div>

        ${loading ? html`<progress class="progress is-small is-primary"></progress>` : ""}

        ${error ? html`
          <article class="message is-danger">
            <div class="message-body">${String(error && (error.payload || error.message || error))}</div>
          </article>
        ` : ""}
      </div>

      ${section("Mezzi preaccreditati", "pre")}
      ${section("DB mezzi", "att")}

      ${modal()}
    `;
  }

  function rerender() {
    render(view(), root);
  }

  load();
  return view();
}
