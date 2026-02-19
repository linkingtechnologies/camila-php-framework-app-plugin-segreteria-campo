// views/massive-check-in/step6.js

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(v) {
  return String(v ?? "").trim();
}

function getId(r) {
  return norm(r["id-materiale"] ?? r.idMateriale ?? r.id_materiale ?? r.id);
}

function sortById(a, b) {
  return a["id-materiale"].localeCompare(b["id-materiale"], "it");
}

function parseTurniValue(v) {
  if (Array.isArray(v)) return v.map(x => norm(x)).filter(Boolean);
  const s = norm(v);
  if (!s) return [];
  return s
    .split(/[,;|/]+/g)
    .map(x => norm(x))
    .filter(Boolean);
}

function pickFields(r) {
  return {
    "id-materiale": getId(r),
    "codice-inventario": norm(r["codice-inventario"]),
    categoria: norm(r["categoria"]),
    tipologia: norm(r["tipologia"]),
    marca: norm(r["marca"]),
    modello: norm(r["modello"]),
    note: norm(r["note"]),
    "note-ulteriori": norm(r["note-ulteriori"]),
    turni: parseTurniValue(r["turno"] ?? r["turni"] ?? r.turno ?? r.turni),
	organizzazione: norm(r["organizzazione"]),
    codiceOrganizzazione: norm(r["codice-organizzazione"]),
  };
}

function mergeField(dst, src, key) {
  if (!dst[key] && src[key]) dst[key] = src[key];
}

function mergeTurni(dst, src) {
  const a = Array.isArray(dst.turni) ? dst.turni : [];
  const b = Array.isArray(src.turni) ? src.turni : [];
  if (b.length === 0) return;
  const set = new Set([...a, ...b].map(norm).filter(Boolean));
  dst.turni = Array.from(set);
}

/**
 * Merge per id-materiale:
 * - una riga per id-materiale
 * - priorità: se in preaccreditati => sezione "Preaccreditati"
 * - se presente anche in db-materiali => merge campi mancanti
 * - turni aggregati (pre può avere più record per stesso id-materiale)
 */
function mergeById(preRecords, attRecords) {
  const preMap = new Map();
  const attMap = new Map();

  function upsert(map, r) {
    const id = getId(r);
    if (!id) return;

    const extra = pickFields(r);

    if (!map.has(id)) {
      map.set(id, { ...extra });
      return;
    }

    const cur = map.get(id);
    mergeField(cur, extra, "codice-inventario");
    mergeField(cur, extra, "categoria");
    mergeField(cur, extra, "tipologia");
    mergeField(cur, extra, "marca");
    mergeField(cur, extra, "modello");
    mergeField(cur, extra, "note");
    mergeField(cur, extra, "note-ulteriori");
	mergeField(cur, extra, "organizzazione");
	mergeField(cur, extra, "codiceOrganizzazione");
    mergeTurni(cur, extra);
  }

  preRecords.forEach(r => upsert(preMap, r));
  attRecords.forEach(r => upsert(attMap, r));

  const preRows = [];
  const attRows = [];

  for (const [id, row] of preMap.entries()) {
    const att = attMap.get(id);
    if (att) {
      mergeField(row, att, "codice-inventario");
      mergeField(row, att, "categoria");
      mergeField(row, att, "tipologia");
      mergeField(row, att, "marca");
      mergeField(row, att, "modello");
      mergeField(row, att, "note");
      mergeField(row, att, "note-ulteriori");
	  mergeField(row, att, "organizzazione");
	  mergeField(row, att, "codiceOrganizzazione");
      mergeTurni(row, att);
    }
    preRows.push(row);
  }

  for (const [id, row] of attMap.entries()) {
    if (!preMap.has(id)) attRows.push(row);
  }

  preRows.sort(sortById);
  attRows.sort(sortById);

  return { preRows, attRows };
}

function rowMatchesQuery(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  const hay = [
    r["id-materiale"],
    r["codice-inventario"],
    r.categoria,
    r.tipologia,
    r.marca,
    r.modello,
    r.note,
	r.organizzazione,
	r.codiceOrganizzazione,
    r["note-ulteriori"],
    ...(Array.isArray(r.turni) ? r.turni : [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return hay.includes(s);
}

function rowMatchesTurno(r, turno) {
  if (!turno) return true;
  const list = Array.isArray(r.turni) ? r.turni : [];
  return list.includes(turno);
}

function validateIdMateriale(id) {
  const v = norm(id);
  if (!v) return "ID materiale obbligatorio";
  if (v.length < 2) return "ID materiale non valido";
  return null;
}

function csvToOptions(csv) {
  return String(csv || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

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

function normalizeCategoriaLabel(s) {
  return norm(s);
}

function getTipologieForCategoria(TIP, categoria) {
  const cat = normalizeCategoriaLabel(categoria);
  if (!cat || cat === "Non assegnata") return { mode: "all" };
  const items = TIP.groupToItems.get(cat) || [];
  return { mode: "filtered", group: cat, items: [...items] };
}

function isTipologiaAllowedForCategoria(TIP, tipologia, categoria) {
  const tip = norm(tipologia);
  if (!tip) return true;

  const cat = normalizeCategoriaLabel(categoria);
  if (!cat || cat === "Non assegnata") return true;

  const g = TIP.itemToGroup.get(tip);
  return g === cat;
}

function autoSetCategoriaFromTipologia(TIP, form, tipologia) {
  const tip = norm(tipologia);
  if (!tip) return;

  if (tip === "Non assegnata") {
    form.categoria = form.categoria || "Non assegnata";
    return;
  }

  const g = TIP.itemToGroup.get(tip);
  if (g) form.categoria = g;
}


export async function Step6({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;

  let preRows = [];
  let attRows = [];

  if (!state.step6Selected) state.step6Selected = [];
  let selected = new Set(state.step6Selected);

  if (state.preMaterialiSearch === undefined) state.preMaterialiSearch = "";
  if (state.attMaterialiSearch === undefined) state.attMaterialiSearch = "";
  let preSearch = state.preMaterialiSearch;
  let attSearch = state.attMaterialiSearch;

  if (state.loadAllMaterialiDb === undefined) state.loadAllMaterialiDb = false;
  let loadAllDb = state.loadAllMaterialiDb;

  if (state.step6TurnoFilter === undefined) state.step6TurnoFilter = "";
  let turnoFilter = state.step6TurnoFilter;
  let turniOptions = [""];

  const Pre = client.table("materiali-preaccreditati");
  const Att = client.table("db-materiali");
  
let CATEGORIE_MATERIALI =
  "Non assegnata,Attrezzature speciali,Attrezzi vari,Container,Effetti letterecci,Generatori,Materiale AIB,Materiale antinquinante,Materiale elettrico,Materiale idraulico e idrogeologico,Radio e dispositivi TLC,Tende";

let TIPOLOGIE_MATERIALI =
  "Non assegnata,--Attrezzature speciali,Apparato climatizzazione,Arva,Aspiratore,Aspiratore ad aria,Cisterna per idrocarburi,Compressore,Drone per riprese aeree,Gruppo,Martello,Martinetto,Materiale nautici e subacquei,Nastro traportatore,Officina,Pallone di sollevamento,Ponte Bailey,Potabilizzatore,Rasasiepi,Robot subaqueo,Saldatrice,Serbatoio per acqua potabile,Sonda,Spaccarocce,Transpallet,Trivella,Vibroinfissore,--Attrezzi vari,Attrezzi da lavoro,Carriola Badile,DPI,Decespugliatore,Estintore,Grella di camminamento,Materiale da campeggio,Materiale per sollevamento,Motosega,Panca,Scala,Sedia,Tavolo,--Container,Attrezzati,Da trasporto,--Effetti letterecci,Branda,Coperta,Cuscino/guanciale,Lenzuola,Materasso,Sacco a pelo,Sacco lenzuolo,--Generatori,Generatore,--Materiale AIB,Chiave idratante,Colonnina a terra presa acqua,Lancia,Manichette,Modulo AIB,Raccordo / riduzione,Serbatoio, cisterna antincendio,Soffiatore,Vasca,--Materiale antinquinante,Assorbente solido,Disperdente prodotti petroliferi,Panna antiinquinamento,Solvente antinquinante,--Materiale elettrico,Adattatore,Altro materiale elettrico,Asciugatrice,Cavi elettrici,Condizionatore,Dispenser,Frigor portatile,Impianto di illuminazione,Lampada portatile,Lavatrice,Macchina distribuzione automatica,Quadro elettrico,Riscaldatore - generatore aria calda,Spina,Termosifone elettrico,Torre faro,--Materiale idraulico e idrogeologico,Elettropompa,Insacchettatrice,Modulo Idrogeologico,Motopompa,Tubazioni,--Radio e dispositivi TLC,Apparati radio da rack,Radio,Telefono satellitare,XCO-2020,--Tende,A pali,Gazebo,Multifunzione,Pneumatica,Sociale,Tensostruttura,Tipo p88";

const TIP_MAT = parseTipologieCsv(TIPOLOGIE_MATERIALI);


  // Modal add materiale
  let modalOpen = false;
  let modalBusy = false;
  let modalError = null;

  let form = {
    "id-materiale": "",
    "codice-inventario": "",
    categoria: "",
    tipologia: "",
    marca: "",
    modello: "",
    note: "",
    "note-ulteriori": "",
    turno: ""
  };

  async function load() {
    try {
      loading = true;
      error = null;
      rerender();

      const includeFields = [
        "id-materiale",
        "codice-inventario",
        "categoria",
        "tipologia",
        "note",
        "marca",
        "modello",
        "note-ulteriori",
        "turno",
		"organizzazione",
		"codice-organizzazione"
      ];

      const preReq = Pre.list({
        filters: [client.filter("organizzazione", "eq", state.org.name)],
        include: includeFields,
        size: 5000
      });

      const attReq = loadAllDb
        ? Att.list({ include: includeFields, size: 5000 })
        : Att.list({
            filters: [client.filter("organizzazione", "eq", state.org.name)],
            include: includeFields,
            size: 5000
          });

      const [resPre, resAtt] = await Promise.all([preReq, attReq]);

      const merged = mergeById(getRecords(resPre), getRecords(resAtt));
      preRows = merged.preRows;
      attRows = merged.attRows;

      // turni options SOLO dai PRE
      const all = new Set();
      preRows.forEach(r => {
        (Array.isArray(r.turni) ? r.turni : []).forEach(t => {
          const v = norm(t);
          if (v) all.add(v);
        });
      });

      const sorted = Array.from(all).sort((a, b) =>
        a.localeCompare(b, "it", { sensitivity: "base" })
      );

      turniOptions = ["", ...sorted];

      if (turnoFilter && !turniOptions.includes(turnoFilter)) {
        turnoFilter = "";
        state.step6TurnoFilter = "";
      }
    } catch (e) {
      error = e;
      turniOptions = [""];
    } finally {
      loading = false;

      const keys = new Set([...preRows, ...attRows].map(r => r["id-materiale"]));
      selected = new Set([...selected].filter(id => keys.has(id)));
      state.step6Selected = [...selected];

      rerender();
    }
  }

  function toggle(id, on) {
    if (!id) return;
    on ? selected.add(id) : selected.delete(id);
    state.step6Selected = [...selected];
    rerender();
  }

  function deselectAll() {
    selected.clear();
    state.step6Selected = [];
    rerender();
  }

  function getPreFiltered() {
    let out = preRows;
    if (turnoFilter) out = out.filter(r => rowMatchesTurno(r, turnoFilter));
    if (preSearch) out = out.filter(r => rowMatchesQuery(r, preSearch));
    return out;
  }

  function getAttFiltered() {
    let out = attRows;
    if (attSearch) out = out.filter(r => rowMatchesQuery(r, attSearch));
    return out;
  }

  function selectVisiblePre() {
    getPreFiltered().forEach(r => selected.add(r["id-materiale"]));
    state.step6Selected = [...selected];
    rerender();
  }

  function back() {
    goTo(5);
  }

  function toggleLoadAllDb(v) {
    loadAllDb = v;
    state.loadAllMaterialiDb = v;
    load();
  }

  function setTurnoFilter(v) {
    turnoFilter = v;
    state.step6TurnoFilter = v;
    rerender();
  }

  function doCheckinMateriali() {
    const byId = new Map();
    [...preRows, ...attRows].forEach(r => r && r["id-materiale"] && byId.set(r["id-materiale"], r));

    const preSet = new Set(preRows.map(r => r["id-materiale"]));

    const materiali = [...selected]
      .map(id => {
        const r = byId.get(id);
        if (!r) return null;

        const opts = Array.isArray(r.turni) ? r.turni : [];

        let preset = "";
        if (preSet.has(id) && turnoFilter && opts.includes(turnoFilter)) preset = turnoFilter;
        else if (opts.length === 1) preset = opts[0];

        return {
          "id-materiale": r["id-materiale"],
          "codice-inventario": r["codice-inventario"] || "",
          categoria: r.categoria || "",
          tipologia: r.tipologia || "",
          marca: r.marca || "",
          modello: r.modello || "",
          note: r.note || "",
          "note-ulteriori": r["note-ulteriori"] || "",
          turniOptions: opts,
          turno: preset
        };
      })
      .filter(Boolean);

    state.materialiSelection = {
      org: {
        name: state.org.name || "",
        code: state.org.code || "",
        province: state.org.province || ""
      },
      materiali
    };

    goTo(7);
  }

  // Modal handlers
  function openModal() {
    modalOpen = true;
    modalBusy = false;
    modalError = null;
    form = {
      "id-materiale": "",
      "codice-inventario": "",
      categoria: "",
      tipologia: "",
      marca: "",
      modello: "",
      note: "",
      "note-ulteriori": "",
      turno: ""
    };
    rerender();
  }

  function closeModal() {
    if (modalBusy) return;
    modalOpen = false;
    modalError = null;
    rerender();
  }

  async function submitNewMateriale() {
    if (modalBusy) return;

    modalError = null;

    const idErr = validateIdMateriale(form["id-materiale"]);
    if (idErr) {
      modalError = idErr;
      rerender();
      return;
    }

    const id = norm(form["id-materiale"]);

    const existsNow = [...preRows, ...attRows].some(r => r["id-materiale"] === id);
    if (existsNow) {
      modalError = "Materiale già presente (stesso id-materiale).";
      rerender();
      return;
    }

const catNorm = normalizeCategoriaLabel(form.categoria);
if (catNorm && catNorm !== "Non assegnata") {
  if (!norm(form.tipologia)) {
    modalError = "Tipologia obbligatoria quando la categoria è selezionata.";
    rerender();
    return;
  }
  if (!isTipologiaAllowedForCategoria(TIP_MAT, form.tipologia, form.categoria)) {
    modalError = "Tipologia non coerente con la categoria selezionata.";
    rerender();
    return;
  }
}


    modalBusy = true;
    rerender();

    try {
      const payload = {
        organizzazione: state.org.name || "",
        "codice-organizzazione": state.org.code || "",
        provincia: state.org.province || "",
        "id-materiale": id
      };

      const inv = norm(form["codice-inventario"]);
      const cat = norm(form.categoria);
      const tip = norm(form.tipologia);
      const marca = norm(form.marca);
      const modello = norm(form.modello);
      const note = norm(form.note);
      const note2 = norm(form["note-ulteriori"]);
      const turno = norm(form.turno);

      if (inv) payload["codice-inventario"] = inv;
      if (cat) payload.categoria = cat;
      if (tip) payload.tipologia = tip;
      if (marca) payload.marca = marca;
      if (modello) payload.modello = modello;
      if (note) payload.note = note;
      if (note2) payload["note-ulteriori"] = note2;
      if (turno) payload.turno = turno;

      await Pre.create(payload);

      modalOpen = false;
      modalBusy = false;

      await load();

      selected.add(id);
      state.step6Selected = [...selected];
      rerender();
    } catch (e) {
      modalError = String(e && (e.payload || e.message || e));
      modalBusy = false;
      rerender();
    }
  }

  function modal() {
    if (!modalOpen) return "";
	const categorieList = csvToOptions(CATEGORIE_MATERIALI);
const tipView = getTipologieForCategoria(TIP_MAT, form.categoria);


    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${closeModal}></div>

        <div class="modal-card" style="width:min(980px, 96vw);">
          <header class="modal-card-head">
            <p class="modal-card-title">Aggiungi materiale preaccreditato</p>
            <button class="delete" aria-label="close" @click=${closeModal}></button>
          </header>

          <section class="modal-card-body">
            ${modalError ? html`
              <article class="message is-danger">
                <div class="message-body">${modalError}</div>
              </article>
            ` : ""}

            <div class="columns is-multiline">
              <div class="column is-half">
                <div class="field">
                  <label class="label">ID materiale *</label>
                  <div class="control">
                    <input class="input"
                      .value=${form["id-materiale"]}
                      ?disabled=${modalBusy}
                      @input=${e => { form["id-materiale"] = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>

              <div class="column is-half">
                <div class="field">
                  <label class="label">Turno</label>
                  <div class="control">
                    <input class="input"
                      placeholder="es. T1"
                      .value=${form.turno}
                      ?disabled=${modalBusy}
                      @input=${e => { form.turno = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>


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

            // se tipologia non coerente con la nuova categoria => reset
            if (norm(form.tipologia) && !isTipologiaAllowedForCategoria(TIP_MAT, form.tipologia, form.categoria)) {
              form.tipologia = "";
            }

            rerender();
          }}
        >
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
            autoSetCategoriaFromTipologia(TIP_MAT, form, form.tipologia);
            rerender();
          }}
        >
          <option value="">Seleziona…</option>

          ${tipView.mode === "filtered"
            ? tipView.items.map(v => html`<option value=${v}>${v}</option>`)
            : html`
                ${(TIP_MAT.groupToItems.get("") || []).map(v => html`<option value=${v}>${v}</option>`)}
                ${TIP_MAT.groups.map(g => html`
                  <option disabled value="">${g}</option>
                  ${(TIP_MAT.groupToItems.get(g) || []).map(v => html`<option value=${v}>${v}</option>`)}
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


              <div class="column is-half">
                <div class="field">
                  <label class="label">Marca</label>
                  <div class="control">
                    <input class="input"
                      .value=${form.marca}
                      ?disabled=${modalBusy}
                      @input=${e => { form.marca = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>

              <div class="column is-half">
                <div class="field">
                  <label class="label">Modello</label>
                  <div class="control">
                    <input class="input"
                      .value=${form.modello}
                      ?disabled=${modalBusy}
                      @input=${e => { form.modello = e.target.value; rerender(); }}>
                  </div>
                </div>
              </div>

              <div class="column is-full">
                <div class="field">
                  <label class="label">Note</label>
                  <div class="control">
                    <textarea class="textarea" rows="2"
                      .value=${form.note}
                      ?disabled=${modalBusy}
                      @input=${e => { form.note = e.target.value; rerender(); }}></textarea>
                  </div>
                </div>
              </div>

              <div class="column is-full">
                <div class="field">
                  <label class="label">Note ulteriori</label>
                  <div class="control">
                    <textarea class="textarea" rows="2"
                      .value=${form["note-ulteriori"]}
                      ?disabled=${modalBusy}
                      @input=${e => { form["note-ulteriori"] = e.target.value; rerender(); }}></textarea>
                  </div>
                </div>
              </div>
            </div>
              <div class="column is-half">
                <div class="field">
                  <label class="label">Codice inventario</label>
                  <div class="control">
                    <input class="input"
                      .value=${form["codice-inventario"]}
                      ?disabled=${modalBusy}
                      @input=${e => { form["codice-inventario"] = e.target.value; rerender(); }}>
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
              @click=${submitNewMateriale}>
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

  function renderTurniBadges(turniArr) {
    const list = Array.isArray(turniArr) ? turniArr.map(norm).filter(Boolean) : [];
    if (list.length === 0) return html`<span class="has-text-grey">—</span>`;
    return html`
      <div class="tags" style="margin-bottom:0;">
        ${list.map(t => html`<span class="tag is-info is-light">${t}</span>`)}
      </div>
    `;
  }

  function section(title, kind) {
    const rows = kind === "pre" ? getPreFiltered() : getAttFiltered();
    const searchValue = kind === "pre" ? preSearch : attSearch;

    const hasTurniCol = kind === "pre";
    const colCount = hasTurniCol ? 9 : 8;
	
	const hasOrgCol = kind === "att";


    return html`
      <div class="box ${kind === "pre" ? "pre-section" : ""}">
        <div class="level">
          <div class="level-left" style="gap:1rem; align-items:center;">
            <h3 class="subtitle" style="margin-bottom:0;">
			<span class="icon">
				<i class="ri-tools-line ri-lg"></i>
			</span>
              <span>${title} <span class="tag is-light ml-2">${rows.length}</span></span>
            </h3>

            <div class="field" style="margin-bottom:0; min-width:420px;">
              <div class="control">
                <input class="input is-small"
                  placeholder="Cerca per id, inventario, categoria, marca, modello…"
                  .value=${searchValue}
                  ?disabled=${loading}
                  @input=${e => {
                    const v = e.target.value;
                    if (kind === "pre") { preSearch = v; state.preMaterialiSearch = v; }
                    else { attSearch = v; state.attMaterialiSearch = v; }
                    rerender();
                  }}>
              </div>
            </div>
          </div>

          <div class="level-right" style="gap:0.75rem; align-items:center;">
            ${kind === "pre" ? html`
              <div class="control">
                <div class="select is-small">
                  <select
                    .value=${turnoFilter}
                    ?disabled=${loading}
                    @change=${e => setTurnoFilter(e.target.value)}
                  >
                    <option value="">Tutti i turni</option>
                    ${turniOptions.filter(Boolean).map(t => html`<option value=${t}>${t}</option>`)}
                  </select>
                </div>
              </div>

              <button class="button is-info is-small"
                      @click=${openModal}
                      ?disabled=${loading}>
                + Aggiungi materiale
              </button>
            ` : ""}

            ${kind === "att" ? html`
              <label class="checkbox" style="white-space:nowrap;">
                <input type="checkbox"
                  .checked=${loadAllDb}
                  ?disabled=${loading || modalBusy}
                  @change=${e => toggleLoadAllDb(e.target.checked)}>
                Carica tutti i materiali presenti nel database
              </label>
            ` : ""}
          </div>
        </div>

        ${kind === "pre" ? html`
          <div class="buttons mb-2">
            <button class="button is-small"
                    @click=${selectVisiblePre}
                    ?disabled=${loading || rows.length === 0}>
              Seleziona preaccreditati visibili
            </button>
          </div>
        ` : ""}

        <div class="table-container">
          <table class="table is-striped is-fullwidth is-hoverable">
            <thead>
              <tr>
                <th style="width:3.5rem">✓</th>

${hasOrgCol ? html`<th>Organizzazione</th>` : ""}

${hasTurniCol ? html`<th>Turni</th>` : ""}

                <th>ID materiale</th>
                ${hasTurniCol ? html`<th>Turni</th>` : ""}
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
                <tr><td colspan="${colCount}"><em>Nessun materiale.</em></td></tr>
              ` : ""}

              ${rows.map(r => {
                const id = r["id-materiale"];
                const checked = selected.has(id);

                return html`
                  <tr class=${checked ? "row-selected" : ""} style="cursor:pointer"
                      @click=${() => toggle(id, !checked)}>
                    <td>
                      <input type="checkbox"
                        .checked=${checked}
                        @click=${e => e.stopPropagation()}
                        @change=${e => toggle(id, e.target.checked)}>
                    </td>

${hasOrgCol ? html`
  <td>
    <span class="tag is-light">${r.organizzazione || ""}</span>
    ${r.codiceOrganizzazione
      ? html`<span class="tag is-info is-light ml-1">${r.codiceOrganizzazione}</span>`
      : ""}
  </td>
` : ""}

                    <td><strong>${id}</strong></td>

                    ${hasTurniCol ? html`
                      <td>${renderTurniBadges(r.turni)}</td>
                    ` : ""}

                    <td>${r["codice-inventario"] || ""}</td>
                    <td>${r.categoria || ""}</td>
                    <td>${r.tipologia || ""}</td>
                    <td>${r.marca || ""}</td>
                    <td>${r.modello || ""}</td>
                    <td>
                      ${r.note || ""}
                      ${r["note-ulteriori"] ? html`<div class="has-text-grey" style="font-size:0.9em;margin-top:0.25rem;">${r["note-ulteriori"]}</div>` : ""}
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

  function view() {
    return html`
      <div class="box">
        <p>
          <strong>${state.org.name}</strong>
          ${state.org.code ? html`<span class="tag ml-2">${state.org.code}</span>` : ""}
          ${state.org.province ? html`<span class="tag is-light ml-2">${state.org.province}</span>` : ""}
        </p>

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
                  @click=${doCheckinMateriali}>
				  <span class="icon">
				<i class="ri-tools-line ri-lg"></i>
			</span>
            <span>Check-in materiali (${selected.size})</span>
          </button>
        </div>

        ${loading ? html`<progress class="progress is-small is-primary"></progress>` : ""}

        ${error ? html`
          <article class="message is-danger">
            <div class="message-body">${String(error && (error.payload || error.message || error))}</div>
          </article>
        ` : ""}
      </div>

      ${section("Materiali preaccreditati", "pre")}
      ${section("Database materiali", "att")}

      ${modal()}
    `;
  }

  function rerender() {
    render(view(), root);
  }

  load();
  return view();
}
