// views/resource-board/index.js — Gestione Operativa Risorse

const WAITING = "IN ATTESA DI SERVIZIO";
const USCITA  = "USCITA DEFINITIVA";

// ---- utils ----------------------------------------------------------------

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(v) { return String(v ?? "").trim(); }
function safe(v) { return norm(v); }

function isActive(r) {
  return !!norm(r["data-inizio-attestato"]) && !norm(r["data-fine-attestato"]);
}

function nowDateTime() {
  return new Date().toLocaleString("sv-SE", { hour12: false }).replace(",", "");
}

function normalizeError(e) {
  return String(e?.payload?.message || e?.message || e || "Errore sconosciuto");
}

// ---- data loading ----------------------------------------------------------

async function loadAll(client) {
  const [resV, resM, resMat, resSrv] = await Promise.all([
    client.table("volontari").list({
      include: ["id","cognome","nome","codice-fiscale","organizzazione","provincia","squadra",
                "servizio","data-inizio-attestato","data-fine-attestato"],
      size: 5000
    }),
    client.table("mezzi").list({
      include: ["id","targa","codice-inventario","categoria","marca","modello",
                "organizzazione","provincia","squadra","servizio","data-inizio-attestato","data-fine-attestato"],
      size: 5000
    }),
    client.table("materiali").list({
      include: ["id","id-materiale","codice-inventario","categoria","tipologia",
                "organizzazione","provincia","squadra","servizio","data-inizio-attestato","data-fine-attestato"],
      size: 5000
    }),
    client.table("servizi").list({ include: ["nome"], size: 1000 })
  ]);

  const filterActive = r => isActive(r) && norm(r.servizio) !== USCITA;

  return {
    volontari:    getRecords(resV).filter(filterActive),
    mezzi:        getRecords(resM).filter(filterActive),
    materiali:    getRecords(resMat).filter(filterActive),
    serviziTable: getRecords(resSrv)
      .map(r => norm(r.nome))
      .filter(s => s && s !== USCITA)
  };
}

// ---- card building ---------------------------------------------------------

function buildCards(volontari, mezzi, materiali, groupBy) {
  const map = new Map();

  function getGroup(r) {
    if (groupBy === "squadra") return norm(r.squadra) || norm(r.organizzazione) || "—";
    return norm(r.organizzazione) || "—";
  }

  function ensure(groupValue, service) {
    const key = `${groupValue}|||${service}`;
    if (!map.has(key)) {
      map.set(key, { key, groupValue, service, volontari: [], mezzi: [], materiali: [] });
    }
    return map.get(key);
  }

  for (const r of volontari) ensure(getGroup(r), norm(r.servizio) || WAITING).volontari.push(r);
  for (const r of mezzi)     ensure(getGroup(r), norm(r.servizio) || WAITING).mezzi.push(r);
  for (const r of materiali) ensure(getGroup(r), norm(r.servizio) || WAITING).materiali.push(r);

  return Array.from(map.values())
    .sort((a, b) => a.groupValue.localeCompare(b.groupValue, "it"));
}

function buildServices(cards, serviziTable) {
  const fromResources = new Set(cards.map(c => c.service));

  const active = [
    WAITING,
    ...Array.from(fromResources)
      .filter(s => s !== WAITING)
      .sort((a, b) => a.localeCompare(b, "it"))
  ];

  const available = serviziTable
    .filter(s => !fromResources.has(s) && s !== WAITING)
    .sort((a, b) => a.localeCompare(b, "it"));

  return { active, available };
}

// ---- search ----------------------------------------------------------------

function cardMatchesSearch(card, q) {
  if (!q) return true;
  const needle = q.toLocaleLowerCase("it");
  const hay = [
    card.groupValue,
    card.service,
    ...card.volontari.map(r  => `${norm(r.cognome)} ${norm(r.nome)} ${norm(r["codice-fiscale"])}`),
    ...card.mezzi.map(r      => `${norm(r.targa)} ${norm(r.marca)} ${norm(r.modello)}`),
    ...card.materiali.map(r  => `${norm(r["id-materiale"])} ${norm(r["codice-inventario"])} ${norm(r.categoria)} ${norm(r.tipologia)}`)
  ].join(" ").toLocaleLowerCase("it");
  return hay.includes(needle);
}

// ---- persistence -----------------------------------------------------------

async function writeMov(client, { groupValue, risorsa, tipoRisorsa, da, a }) {
  await client.table("mov-risorse").create({
    "data/ora":     nowDateTime(),
    "gruppo":       safe(groupValue),
    "risorsa":      safe(risorsa),
    "tipo-risorsa": safe(tipoRisorsa),
    "da":           safe(da),
    "a":            safe(a)
  });
}

async function applyServiceChange(client, card, newService, selectedTypes) {
  for (const r of (selectedTypes.has("volontari") ? card.volontari : [])) {
    await client.table("volontari").update(r.id, { servizio: newService });
    await writeMov(client, {
      groupValue: card.groupValue,
      risorsa:    `${safe(r.cognome)} ${safe(r.nome)}`,
      tipoRisorsa: "VOLONTARIO",
      da: card.service,
      a:  newService
    });
  }
  for (const r of (selectedTypes.has("mezzi") ? card.mezzi : [])) {
    await client.table("mezzi").update(r.id, { servizio: newService });
    await writeMov(client, {
      groupValue: card.groupValue,
      risorsa:    safe(r.targa),
      tipoRisorsa: "MEZZO",
      da: card.service,
      a:  newService
    });
  }
  for (const r of (selectedTypes.has("materiali") ? card.materiali : [])) {
    await client.table("materiali").update(r.id, { servizio: newService });
    await writeMov(client, {
      groupValue: card.groupValue,
      risorsa:    safe(r["id-materiale"]) || safe(r["codice-inventario"]) || "—",
      tipoRisorsa: "MATERIALE",
      da: card.service,
      a:  newService
    });
  }
}

async function applySquadraChange(client, card, newSquadra, selectedTypes) {
  for (const r of (selectedTypes.has("volontari") ? card.volontari : [])) {
    const oldSquadra = safe(r.squadra);
    await client.table("volontari").update(r.id, { squadra: newSquadra });
    await writeMov(client, {
      groupValue:  card.groupValue,
      risorsa:     `${safe(r.cognome)} ${safe(r.nome)}`,
      tipoRisorsa: "VOLONTARIO",
      da:          `SQUADRA: ${oldSquadra || "—"}`,
      a:           `SQUADRA: ${newSquadra}`
    });
  }
  for (const r of (selectedTypes.has("mezzi") ? card.mezzi : [])) {
    const oldSquadra = safe(r.squadra);
    await client.table("mezzi").update(r.id, { squadra: newSquadra });
    await writeMov(client, {
      groupValue:  card.groupValue,
      risorsa:     safe(r.targa),
      tipoRisorsa: "MEZZO",
      da:          `SQUADRA: ${oldSquadra || "—"}`,
      a:           `SQUADRA: ${newSquadra}`
    });
  }
  for (const r of (selectedTypes.has("materiali") ? card.materiali : [])) {
    const oldSquadra = safe(r.squadra);
    await client.table("materiali").update(r.id, { squadra: newSquadra });
    await writeMov(client, {
      groupValue:  card.groupValue,
      risorsa:     safe(r["id-materiale"]) || safe(r["codice-inventario"]) || "—",
      tipoRisorsa: "MATERIALE",
      da:          `SQUADRA: ${oldSquadra || "—"}`,
      a:           `SQUADRA: ${newSquadra}`
    });
  }
}

async function applySingleMove(client, { category, resource, card, fromService }, newService) {
  let table, risorsa, tipoRisorsa;
  if (category === "volontari") {
    table = "volontari";
    risorsa = `${safe(resource.cognome)} ${safe(resource.nome)}`;
    tipoRisorsa = "VOLONTARIO";
  } else if (category === "mezzi") {
    table = "mezzi";
    risorsa = safe(resource.targa);
    tipoRisorsa = "MEZZO";
  } else {
    table = "materiali";
    risorsa = safe(resource["id-materiale"]) || safe(resource["codice-inventario"]) || "—";
    tipoRisorsa = "MATERIALE";
  }
  await client.table(table).update(resource.id, { servizio: newService });
  await writeMov(client, { groupValue: card.groupValue, risorsa, tipoRisorsa, da: fromService, a: newService });
}

// ---- main export -----------------------------------------------------------

export async function GOR({ state, client, html, render, root }) {

  // --- local state ---
  let loading          = true;
  let error            = null;
  let search           = "";
  let groupBy          = "organizzazione";

  let allVolontari     = [];
  let allMezzi         = [];
  let allMateriali     = [];
  let serviziTable     = [];

  let cards             = [];
  let activeServices    = [WAITING];
  let availableServices = [];
  let distinctSquadre   = [];

  let filterOrg        = "";
  let filterProvincia  = "";
  let distinctOrgs     = [];
  let distinctProvince = [];

  let expandedCards    = new Set();
  let showAvailable    = false;
  let modal            = null;
  // modal shape: { type, card, newService, selectedTypes: Set, busy, error }
  // type: "cambio-servizio" | "cambio-squadra"

  let dragPayload      = null; // { mode:"card"|"category"|"resource", card, fromService, types?, category?, resource? }
  let dropTarget       = null; // service string being hovered

  // ---

  function rerender() { render(view(), root); }

  function rebuildDerived() {
    const all = [...allVolontari, ...allMezzi, ...allMateriali];

    // Distinct org e provincia da TUTTE le risorse (prima del filtro)
    const orgSet  = new Set();
    const provSet = new Set();
    for (const r of all) {
      const o = norm(r.organizzazione); if (o) orgSet.add(o);
      const p = norm(r.provincia);      if (p) provSet.add(p);
    }
    distinctOrgs     = Array.from(orgSet).sort((a, b) => a.localeCompare(b, "it"));
    distinctProvince = Array.from(provSet).sort((a, b) => a.localeCompare(b, "it"));

    // Applica filtro opzionale
    const match = r =>
      (!filterOrg       || norm(r.organizzazione) === filterOrg) &&
      (!filterProvincia || norm(r.provincia)       === filterProvincia);

    const fV   = allVolontari.filter(match);
    const fM   = allMezzi.filter(match);
    const fMat = allMateriali.filter(match);

    cards             = buildCards(fV, fM, fMat, groupBy);
    const svc         = buildServices(cards, serviziTable);
    activeServices    = svc.active;
    availableServices = svc.available;

    // distinctSquadre dalle risorse filtrate
    const sqSet = new Set();
    for (const r of [...fV, ...fM, ...fMat]) {
      const s = norm(r.squadra); if (s) sqSet.add(s);
    }
    distinctSquadre = Array.from(sqSet).sort((a, b) => a.localeCompare(b, "it"));
  }

  async function load() {
    loading = true;
    error   = null;
    rerender();
    try {
      const data    = await loadAll(client);
      allVolontari  = data.volontari;
      allMezzi      = data.mezzi;
      allMateriali  = data.materiali;
      serviziTable  = data.serviziTable;
      rebuildDerived();
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  async function reloadData() {
    try {
      const data    = await loadAll(client);
      allVolontari  = data.volontari;
      allMezzi      = data.mezzi;
      allMateriali  = data.materiali;
      serviziTable  = data.serviziTable;
      rebuildDerived();
    } catch (e) {
      error = e;
    }
  }

  // ---- drag & drop --------------------------------------------------------

  function onDragStart(e, card) {
    dragPayload = { mode: "card", card, fromService: card.service, types: new Set(["volontari", "mezzi", "materiali"]) };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", card.key);
  }

  function onDragStartCategory(e, card, category) {
    e.stopPropagation();
    dragPayload = { mode: "category", card, fromService: card.service, category, types: new Set([category]) };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${card.key}|||${category}`);
  }

  function onDragStartResource(e, card, category, resource) {
    e.stopPropagation();
    dragPayload = { mode: "resource", card, fromService: card.service, category, resource };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(resource.id));
  }

  function onDragEnd() {
    dragPayload = null;
    dropTarget  = null;
    rerender();
  }

  function onDragOver(e, service) {
    if (!dragPayload) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dropTarget !== service) {
      dropTarget = service;
      rerender();
    }
  }

  function onDragLeave(e, service) {
    // Ignore events caused by mouse moving over a child element
    if (e.currentTarget.contains && e.currentTarget.contains(e.relatedTarget)) return;
    if (dropTarget === service) {
      dropTarget = null;
      rerender();
    }
  }

  async function onDrop(e, service) {
    e.preventDefault();
    if (!dragPayload) return;

    const payload = dragPayload;
    dragPayload = null;
    dropTarget  = null;

    if (payload.fromService === service) { rerender(); return; }

    loading = true;
    rerender();
    try {
      if (payload.mode === "resource") {
        await applySingleMove(client, payload, service);
      } else {
        await applyServiceChange(client, payload.card, service, payload.types);
      }
      await reloadData();
    } catch (err) {
      error = err;
    } finally {
      loading = false;
      rerender();
    }
  }

  // ---- modals -------------------------------------------------------------

  function openResourceServiceModal(card, category, resource) {
    modal = {
      type:       "cambio-risorsa",
      card,
      category,
      resource,
      newService: "",
      busy:       false,
      error:      null
    };
    rerender();
  }

  async function confirmResourceServiceChange() {
    if (!modal || modal.type !== "cambio-risorsa") return;
    if (!modal.newService || modal.busy) return;

    modal.busy  = true;
    modal.error = null;
    rerender();

    try {
      await applySingleMove(client, {
        category:    modal.category,
        resource:    modal.resource,
        card:        modal.card,
        fromService: modal.card.service
      }, modal.newService);
      modal   = null;
      loading = true;
      rerender();
      await reloadData();
    } catch (e) {
      if (modal) { modal.busy = false; modal.error = e; }
      else error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  function openServiceChangeModal(card) {
    modal = {
      type:          "cambio-servizio",
      card,
      newService:    "",
      selectedTypes: new Set(
        ["volontari", "mezzi", "materiali"].filter(t => card[t].length > 0)
      ),
      busy:  false,
      error: null
    };
    rerender();
  }

  function openSquadraModal(card) {
    modal = {
      type:          "cambio-squadra",
      card,
      newSquadra:    "",
      selectedTypes: new Set(
        ["volontari", "mezzi", "materiali"].filter(t => card[t].length > 0)
      ),
      busy:  false,
      error: null
    };
    rerender();
  }

  async function confirmSquadraChange() {
    if (!modal || modal.type !== "cambio-squadra") return;
    if (!modal.newSquadra || modal.busy || modal.selectedTypes.size === 0) return;

    modal.busy  = true;
    modal.error = null;
    rerender();

    try {
      await applySquadraChange(client, modal.card, modal.newSquadra, modal.selectedTypes);
      modal   = null;
      loading = true;
      rerender();
      await reloadData();
    } catch (e) {
      if (modal) { modal.busy = false; modal.error = e; }
      else error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  function closeModal() {
    if (modal?.busy) return;
    modal = null;
    rerender();
  }

  async function confirmServiceChange() {
    if (!modal || modal.type !== "cambio-servizio") return;
    if (!modal.newService || modal.busy || modal.selectedTypes.size === 0) return;

    modal.busy  = true;
    modal.error = null;
    rerender();

    try {
      await applyServiceChange(client, modal.card, modal.newService, modal.selectedTypes);
      modal   = null;
      loading = true;
      rerender();
      await reloadData();
    } catch (e) {
      if (modal) { modal.busy = false; modal.error = e; }
      else error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  // ---- card rendering -----------------------------------------------------

  function renderCardDetail(card) {
    const dragRow = "cursor:grab;user-select:none";

    const volTable = card.volontari.length === 0 ? "" : html`
      <div class="mt-2">
        <p class="is-size-7 has-text-weight-semibold mb-1"
           draggable="true"
           style="${dragRow}"
           title="Trascina tutti i volontari"
           @dragstart=${e => onDragStartCategory(e, card, "volontari")}
           @dragend=${e => { e.stopPropagation(); onDragEnd(); }}
        ><i class="ri-user-line"></i> Volontari (${card.volontari.length}) ⠿</p>
        <table class="table is-narrow is-fullwidth is-size-7" style="margin-bottom:0">
          <thead><tr><th></th><th>Cognome</th><th>Nome</th><th></th></tr></thead>
          <tbody>
            ${card.volontari.map(r => html`
              <tr draggable="true" style="${dragRow}"
                  title="Trascina ${norm(r.cognome)} ${norm(r.nome)}"
                  data-id="${r.id}"
                  @dragstart=${e => onDragStartResource(e, card, "volontari", r)}
                  @dragend=${e => { e.stopPropagation(); onDragEnd(); }}
              >
                <td style="width:1rem;color:#aaa">⠿</td>
                <td>${norm(r.cognome) || "—"}</td>
                <td>${norm(r.nome)    || "—"}</td>
                <td style="width:1.5rem">
                  <button class="button is-white is-small p-0" style="height:1.2rem;min-width:1.2rem"
                    title="Cambia servizio"
                    @click=${e => { e.stopPropagation(); openResourceServiceModal(card, "volontari", r); }}
                    @dragstart=${e => e.stopPropagation()}
                  ><i class="ri-swap-line"></i></button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;

    const mezziTable = card.mezzi.length === 0 ? "" : html`
      <div class="mt-2">
        <p class="is-size-7 has-text-weight-semibold mb-1"
           draggable="true"
           style="${dragRow}"
           title="Trascina tutti i mezzi"
           @dragstart=${e => onDragStartCategory(e, card, "mezzi")}
           @dragend=${e => { e.stopPropagation(); onDragEnd(); }}
        ><i class="ri-truck-line"></i> Mezzi (${card.mezzi.length}) ⠿</p>
        <table class="table is-narrow is-fullwidth is-size-7" style="margin-bottom:0">
          <thead><tr><th></th><th>Targa</th><th>Marca/Modello</th><th></th></tr></thead>
          <tbody>
            ${card.mezzi.map(r => html`
              <tr draggable="true" style="${dragRow}"
                  title="Trascina ${norm(r.targa)}"
                  data-id="${r.id}"
                  @dragstart=${e => onDragStartResource(e, card, "mezzi", r)}
                  @dragend=${e => { e.stopPropagation(); onDragEnd(); }}
              >
                <td style="width:1rem;color:#aaa">⠿</td>
                <td>${norm(r.targa) || "—"}</td>
                <td>${[norm(r.marca), norm(r.modello)].filter(Boolean).join(" ") || "—"}</td>
                <td style="width:1.5rem">
                  <button class="button is-white is-small p-0" style="height:1.2rem;min-width:1.2rem"
                    title="Cambia servizio"
                    @click=${e => { e.stopPropagation(); openResourceServiceModal(card, "mezzi", r); }}
                    @dragstart=${e => e.stopPropagation()}
                  ><i class="ri-swap-line"></i></button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;

    const matTable = card.materiali.length === 0 ? "" : html`
      <div class="mt-2">
        <p class="is-size-7 has-text-weight-semibold mb-1"
           draggable="true"
           style="${dragRow}"
           title="Trascina tutti i materiali"
           @dragstart=${e => onDragStartCategory(e, card, "materiali")}
           @dragend=${e => { e.stopPropagation(); onDragEnd(); }}
        ><i class="ri-tools-line"></i> Materiali (${card.materiali.length}) ⠿</p>
        <table class="table is-narrow is-fullwidth is-size-7" style="margin-bottom:0">
          <thead><tr><th></th><th>ID / Inv.</th><th>Categoria</th><th></th></tr></thead>
          <tbody>
            ${card.materiali.map(r => html`
              <tr draggable="true" style="${dragRow}"
                  title="Trascina ${norm(r['id-materiale']) || norm(r['codice-inventario'])}"
                  @dragstart=${e => onDragStartResource(e, card, "materiali", r)}
                  @dragend=${e => { e.stopPropagation(); onDragEnd(); }}
              >
                <td style="width:1rem;color:#aaa">⠿</td>
                <td>${norm(r["id-materiale"]) || norm(r["codice-inventario"]) || "—"}</td>
                <td>${[norm(r.categoria), norm(r.tipologia)].filter(Boolean).join(" / ") || "—"}</td>
                <td style="width:1.5rem">
                  <button class="button is-white is-small p-0" style="height:1.2rem;min-width:1.2rem"
                    title="Cambia servizio"
                    @click=${e => { e.stopPropagation(); openResourceServiceModal(card, "materiali", r); }}
                    @dragstart=${e => e.stopPropagation()}
                  ><i class="ri-swap-line"></i></button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    `;

    return html`${volTable}${mezziTable}${matTable}`;
  }

  function renderCard(card) {
    const expanded    = expandedCards.has(card.key);
    const isDropTgt   = dropTarget === card.service && dragPayload?.card.key !== card.key;

    const totalCount  = card.volontari.length + card.mezzi.length + card.materiali.length;

    return html`
      <div
        class="box p-3 mb-2"
        style="cursor:grab;user-select:none;background:${isDropTgt ? '#e8f5e9' : '#fff'}"
        draggable="true"
        @dragstart=${e => onDragStart(e, card)}
        @dragend=${onDragEnd}
      >
        <!-- header row -->
        <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
          <strong class="is-size-7" style="flex:1;min-width:0;word-break:break-word"
            ><i class="ri-team-line"></i> ${card.groupValue}</strong>
          <button
            class="button is-white is-small p-1"
            style="height:1.5rem;min-width:1.5rem;flex-shrink:0"
            title="${expanded ? 'Comprimi' : 'Espandi dettagli'}"
            @click=${e => {
              e.stopPropagation();
              expanded ? expandedCards.delete(card.key) : expandedCards.add(card.key);
              rerender();
            }}
          >${expanded ? "▲" : "▼"}</button>
        </div>

        <!-- counts -->
        <div class="is-size-7 has-text-grey mt-1" style="display:flex;gap:10px">
          ${card.volontari.length  > 0 ? html`<span><i class="ri-user-line"></i> ${card.volontari.length}</span>`  : ""}
          ${card.mezzi.length      > 0 ? html`<span><i class="ri-truck-line"></i> ${card.mezzi.length}</span>`      : ""}
          ${card.materiali.length  > 0 ? html`<span><i class="ri-tools-line"></i> ${card.materiali.length}</span>`  : ""}
          ${totalCount === 0 ? html`<span class="has-text-danger">vuoto</span>` : ""}
        </div>

        <!-- detail (expanded) -->
        ${expanded ? html`<div style="overflow-x:auto">${renderCardDetail(card)}</div>` : ""}

        <!-- actions -->
        <div class="buttons mt-2" style="gap:4px;flex-wrap:wrap">
          <button
            class="button is-small is-info is-light"
            @click=${e => { e.stopPropagation(); openServiceChangeModal(card); }}
          >Cambia servizio</button>
          <button
            class="button is-small is-warning is-light"
            @click=${e => { e.stopPropagation(); openSquadraModal(card); }}
          >Cambia squadra</button>
        </div>
      </div>
    `;
  }

  // ---- modal rendering ----------------------------------------------------

  function renderModal() {
    if (!modal) return "";

    // --- cambio servizio singola risorsa ---
    if (modal.type === "cambio-risorsa") {
      const { card, category, resource } = modal;

      const label = category === "volontari"
        ? `${norm(resource.cognome)} ${norm(resource.nome)}`
        : category === "mezzi"
          ? norm(resource.targa)
          : norm(resource["id-materiale"]) || norm(resource["codice-inventario"]) || "—";

      const selectableServices = [
        WAITING,
        ...activeServices.filter(s => s !== WAITING && s !== card.service),
        ...availableServices
      ].filter(s => s !== card.service);

      const canConfirm = !modal.busy && !!modal.newService;

      return html`
        <div class="modal is-active">
          <div class="modal-background" @click=${closeModal}></div>
          <div class="modal-card">
            <header class="modal-card-head">
              <p class="modal-card-title">Cambia servizio — ${label}</p>
              <button class="delete" ?disabled=${modal.busy} @click=${closeModal}></button>
            </header>
            <section class="modal-card-body">
              <p class="is-size-7 has-text-grey mb-3">
                Da: <strong>${card.service}</strong>
              </p>
              <div class="field">
                <label class="label is-small">Nuovo servizio</label>
                <div class="control">
                  <div class="select is-fullwidth">
                    <select ?disabled=${modal.busy}
                      @change=${e => { modal.newService = e.target.value; rerender(); }}
                    >
                      <option value="">— seleziona —</option>
                      ${selectableServices.map(s => html`<option value="${s}">${s}</option>`)}
                    </select>
                  </div>
                </div>
              </div>
              ${modal.error ? html`
                <article class="message is-danger is-small mt-2">
                  <div class="message-body is-size-7">${normalizeError(modal.error)}</div>
                </article>
              ` : ""}
            </section>
            <footer class="modal-card-foot" style="gap:8px">
              <button class="button is-info" ?disabled=${!canConfirm} @click=${confirmResourceServiceChange}>
                ${modal.busy ? "Salvataggio…" : "Conferma"}
              </button>
              <button class="button" ?disabled=${modal.busy} @click=${closeModal}>Annulla</button>
            </footer>
          </div>
        </div>
      `;
    }

    // --- cambio squadra ---
    if (modal.type === "cambio-squadra") {
      const { card } = modal;
      const hasVol = card.volontari.length > 0;
      const hasMez = card.mezzi.length     > 0;
      const hasMat = card.materiali.length > 0;
      const canConfirm = !modal.busy && modal.newSquadra && modal.selectedTypes.size > 0;

      function toggleTypeS(type, checked) {
        checked ? modal.selectedTypes.add(type) : modal.selectedTypes.delete(type);
        rerender();
      }

      return html`
        <div class="modal is-active">
          <div class="modal-background" @click=${closeModal}></div>
          <div class="modal-card">
            <header class="modal-card-head">
              <p class="modal-card-title">Cambia squadra — ${card.groupValue}</p>
              <button class="delete" ?disabled=${modal.busy} @click=${closeModal}></button>
            </header>
            <section class="modal-card-body">
              <p class="is-size-7 has-text-grey mb-3">Servizio: <strong>${card.service}</strong></p>

              <div class="field">
                <label class="label is-small">Nuova squadra</label>
                <div class="control">
                  <input
                    class="input"
                    type="text"
                    list="gor-squadre-list"
                    placeholder="Seleziona o digita una nuova squadra…"
                    .value=${modal.newSquadra}
                    ?disabled=${modal.busy}
                    @input=${e => { modal.newSquadra = e.target.value.trim(); rerender(); }}
                  />
                  <datalist id="gor-squadre-list">
                    ${distinctSquadre.map(s => html`<option value="${s}"></option>`)}
                  </datalist>
                </div>
                ${distinctSquadre.length === 0 ? html`
                  <p class="help has-text-grey">Nessuna squadra esistente — digita il nome della nuova squadra.</p>
                ` : ""}
              </div>

              <div class="field">
                <label class="label is-small">Tipi di risorsa da spostare</label>
                <div class="control">
                  ${hasVol ? html`
                    <label class="checkbox is-block mb-1">
                      <input type="checkbox"
                        ?checked=${modal.selectedTypes.has("volontari")}
                        ?disabled=${modal.busy}
                        @change=${e => toggleTypeS("volontari", e.target.checked)}
                      />
                      &nbsp;<i class="ri-user-line"></i> Volontari (${card.volontari.length})
                    </label>
                  ` : ""}
                  ${hasMez ? html`
                    <label class="checkbox is-block mb-1">
                      <input type="checkbox"
                        ?checked=${modal.selectedTypes.has("mezzi")}
                        ?disabled=${modal.busy}
                        @change=${e => toggleTypeS("mezzi", e.target.checked)}
                      />
                      &nbsp;<i class="ri-truck-line"></i> Mezzi (${card.mezzi.length})
                    </label>
                  ` : ""}
                  ${hasMat ? html`
                    <label class="checkbox is-block mb-1">
                      <input type="checkbox"
                        ?checked=${modal.selectedTypes.has("materiali")}
                        ?disabled=${modal.busy}
                        @change=${e => toggleTypeS("materiali", e.target.checked)}
                      />
                      &nbsp;<i class="ri-tools-line"></i> Materiali (${card.materiali.length})
                    </label>
                  ` : ""}
                </div>
              </div>

              ${modal.selectedTypes.size === 0 ? html`
                <p class="help is-danger">Seleziona almeno un tipo di risorsa.</p>
              ` : ""}

              ${modal.error ? html`
                <article class="message is-danger is-small mt-2">
                  <div class="message-body is-size-7">${normalizeError(modal.error)}</div>
                </article>
              ` : ""}
            </section>
            <footer class="modal-card-foot" style="gap:8px">
              <button class="button is-warning" ?disabled=${!canConfirm} @click=${confirmSquadraChange}>
                ${modal.busy ? "Salvataggio…" : "Conferma"}
              </button>
              <button class="button" ?disabled=${modal.busy} @click=${closeModal}>Annulla</button>
            </footer>
          </div>
        </div>
      `;
    }

    // --- cambio servizio ---
    const { card } = modal;

    const selectableServices = [
      WAITING,
      ...activeServices.filter(s => s !== WAITING && s !== card.service),
      ...availableServices
    ].filter(s => s !== card.service);

    const hasVol = card.volontari.length > 0;
    const hasMez = card.mezzi.length     > 0;
    const hasMat = card.materiali.length > 0;

    const canConfirm = !modal.busy
      && modal.newService
      && modal.selectedTypes.size > 0;

    function toggleType(type, checked) {
      checked
        ? modal.selectedTypes.add(type)
        : modal.selectedTypes.delete(type);
      rerender();
    }

    return html`
      <div class="modal is-active">
        <div class="modal-background" @click=${closeModal}></div>
        <div class="modal-card">
          <header class="modal-card-head">
            <p class="modal-card-title">Cambia servizio — ${card.groupValue}</p>
            <button class="delete" ?disabled=${modal.busy} @click=${closeModal}></button>
          </header>
          <section class="modal-card-body">
            <p class="is-size-7 has-text-grey mb-3">
              Da: <strong>${card.service}</strong>
            </p>

            <div class="field">
              <label class="label is-small">Nuovo servizio</label>
              <div class="control">
                <div class="select is-fullwidth">
                  <select
                    ?disabled=${modal.busy}
                    @change=${e => { modal.newService = e.target.value; rerender(); }}
                  >
                    <option value="">— seleziona —</option>
                    ${selectableServices.map(s => html`
                      <option value="${s}">${s}</option>
                    `)}
                  </select>
                </div>
              </div>
            </div>

            <div class="field">
              <label class="label is-small">Tipi di risorsa da spostare</label>
              <div class="control">
                ${hasVol ? html`
                  <label class="checkbox is-block mb-1">
                    <input
                      type="checkbox"
                      ?checked=${modal.selectedTypes.has("volontari")}
                      ?disabled=${modal.busy}
                      @change=${e => toggleType("volontari", e.target.checked)}
                    />
                    &nbsp;<i class="ri-user-line"></i> Volontari (${card.volontari.length})
                  </label>
                ` : ""}
                ${hasMez ? html`
                  <label class="checkbox is-block mb-1">
                    <input
                      type="checkbox"
                      ?checked=${modal.selectedTypes.has("mezzi")}
                      ?disabled=${modal.busy}
                      @change=${e => toggleType("mezzi", e.target.checked)}
                    />
                    &nbsp;<i class="ri-truck-line"></i> Mezzi (${card.mezzi.length})
                  </label>
                ` : ""}
                ${hasMat ? html`
                  <label class="checkbox is-block mb-1">
                    <input
                      type="checkbox"
                      ?checked=${modal.selectedTypes.has("materiali")}
                      ?disabled=${modal.busy}
                      @change=${e => toggleType("materiali", e.target.checked)}
                    />
                    &nbsp;<i class="ri-tools-line"></i> Materiali (${card.materiali.length})
                  </label>
                ` : ""}
              </div>
            </div>

            ${modal.selectedTypes.size === 0 ? html`
              <p class="help is-danger">Seleziona almeno un tipo di risorsa.</p>
            ` : ""}

            ${modal.error ? html`
              <article class="message is-danger is-small mt-2">
                <div class="message-body is-size-7">${normalizeError(modal.error)}</div>
              </article>
            ` : ""}
          </section>
          <footer class="modal-card-foot" style="gap:8px">
            <button
              class="button is-info"
              ?disabled=${!canConfirm}
              @click=${confirmServiceChange}
            >
              ${modal.busy ? "Salvataggio…" : "Conferma"}
            </button>
            <button class="button" ?disabled=${modal.busy} @click=${closeModal}>Annulla</button>
          </footer>
        </div>
      </div>
    `;
  }

  // ---- main view ----------------------------------------------------------

  function view() {

    if (loading) {
      return html`
        <section class="section">
          <div class="container">
            <p class="has-text-grey mb-2">Caricamento risorse…</p>
            <progress class="progress is-primary" style="max-width:400px"></progress>
          </div>
        </section>
      `;
    }

    if (error) {
      return html`
        <section class="section">
          <div class="container">
            <article class="message is-danger">
              <div class="message-header"><p>Errore caricamento</p></div>
              <div class="message-body">
                <p>${normalizeError(error)}</p>
                <button class="button is-light mt-3" @click=${load}>🔄 Riprova</button>
              </div>
            </article>
          </div>
        </section>
      `;
    }

    const visibleCards = search
      ? cards.filter(c => cardMatchesSearch(c, search))
      : cards;

    const totalResources = allVolontari.length + allMezzi.length + allMateriali.length;

    return html`
      <style>
        .gor-available-bar {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
          padding: 2px 1.5rem 10px;
          min-height: 32px;
        }
        .gor-available-bar-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: #888;
          white-space: nowrap;
        }
        .gor-active-chip {
          padding: 3px 10px;
          border-radius: 4px;
          background: #e8f4fd;
          border: 1px solid #b5d9f5;
          font-size: 0.72rem;
          font-weight: 600;
          color: #2276ac;
          white-space: nowrap;
        }
        .gor-available-toggle {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 4px;
          background: #f0f0f0;
          border: 1px solid #ccc;
          font-size: 0.72rem;
          font-weight: 700;
          color: #666;
          cursor: pointer;
          white-space: nowrap;
          user-select: none;
        }
        .gor-available-toggle:hover {
          background: #e8e8e8;
          border-color: #aaa;
        }
        .gor-available-chip {
          padding: 3px 10px;
          border-radius: 4px;
          background: #fff8e1;
          border: 1px solid #ffe082;
          font-size: 0.72rem;
          font-weight: 600;
          color: #888;
          cursor: default;
          transition: background 0.1s, border-color 0.1s;
          white-space: nowrap;
        }
        .gor-available-chip.is-drop-target,
        .gor-active-chip.is-drop-target {
          background: #dceeff;
          border-color: #3273dc;
          outline: 2px dashed #3273dc;
          color: #3273dc;
        }
        .gor-kanban {
          display: flex;
          gap: 12px;
          padding: 0 1.5rem 1.5rem;
          align-items: flex-start;
          overflow-x: auto;
        }
        .gor-column {
          min-width: 270px;
          width: 270px;
          flex-shrink: 0;
          background: #f5f5f5;
          border-radius: 8px;
          padding: 10px;
        }
        .gor-column.is-drop-target {
          background: #dceeff;
          outline: 2px dashed #3273dc;
        }
        .gor-col-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          font-weight: 700;
          margin-bottom: 8px;
          padding-bottom: 6px;
          border-bottom: 2px solid #dbdbdb;
          gap: 6px;
        }
        .gor-col-header span:first-child {
          flex: 1;
          word-break: break-word;
        }
      </style>

      <div class="box" style="padding:0;overflow:hidden">

      <!-- Toolbar -->
      <div style="
        display:flex;
        align-items:center;
        flex-wrap:wrap;
        gap:10px;
        padding:12px 1.25rem;
        background:#f8f9fa;
        border-bottom:1px solid #e8e8e8;
      ">
        <!-- Cerca -->
        <div class="field has-addons mb-0" style="flex:1;min-width:180px;max-width:300px">
          <div class="control is-expanded">
            <input
              class="input is-small"
              type="text"
              placeholder="Cerca gruppo, risorsa, servizio…"
              .value=${search}
              @input=${e => { search = e.target.value; rerender(); }}
            />
          </div>
          ${search ? html`
            <div class="control">
              <button class="button is-small" @click=${() => { search = ""; rerender(); }}>✕</button>
            </div>
          ` : ""}
        </div>

        <!-- Raggruppa per -->
        <div style="display:flex;align-items:center;gap:6px">
          <span class="is-size-7 has-text-grey" style="white-space:nowrap">Raggruppa:</span>
          <div class="field has-addons mb-0">
            <p class="control">
              <button
                class="button is-small ${groupBy === "organizzazione" ? "is-info" : ""}"
                @click=${() => { groupBy = "organizzazione"; rebuildDerived(); rerender(); }}
              >Organizzazione</button>
            </p>
            <p class="control">
              <button
                class="button is-small ${groupBy === "squadra" ? "is-info" : ""}"
                @click=${() => { groupBy = "squadra"; rebuildDerived(); rerender(); }}
              >Squadra</button>
            </p>
          </div>
        </div>

        <!-- Filtro provincia -->
        ${distinctProvince.length > 1 ? html`
          <div class="select is-small">
            <select @change=${e => { filterProvincia = e.target.value; rebuildDerived(); rerender(); }}>
              <option value="">Tutte le province</option>
              ${distinctProvince.map(p => html`
                <option value="${p}" ?selected=${filterProvincia === p}>${p}</option>
              `)}
            </select>
          </div>
        ` : ""}

        <!-- Filtro organizzazione -->
        ${distinctOrgs.length > 1 ? html`
          <div class="select is-small">
            <select @change=${e => { filterOrg = e.target.value; rebuildDerived(); rerender(); }}>
              <option value="">Tutte le organizzazioni</option>
              ${distinctOrgs.map(o => html`
                <option value="${o}" ?selected=${filterOrg === o}>${o}</option>
              `)}
            </select>
          </div>
        ` : ""}

        <!-- Contatore risorse -->
        <span class="tag is-info is-light" style="white-space:nowrap">
          ${totalResources} risorse attive
        </span>

        <!-- Spacer -->
        <div style="flex:1"></div>

        <!-- Aggiorna -->
        <button class="button is-small is-light" @click=${load} style="white-space:nowrap">
          🔄 Aggiorna
        </button>
      </div>

      <!-- Banner filtro attivo -->
      ${(filterOrg || filterProvincia) ? html`
        <div style="
          background:#fff8e1;
          border-bottom:1px solid #ffe082;
          padding:6px 1.25rem;
          display:flex;
          align-items:center;
          gap:8px;
          font-size:0.8rem;
        ">
          <i class="ri-filter-line" style="color:#f59e0b"></i>
          <span>
            Filtro attivo:
            ${filterProvincia ? html`<strong>${filterProvincia}</strong>` : ""}
            ${filterProvincia && filterOrg ? " · " : ""}
            ${filterOrg ? html`<strong>${filterOrg}</strong>` : ""}
            — stai vedendo ${cards.reduce((n, c) => n + c.volontari.length + c.mezzi.length + c.materiali.length, 0)}
            di ${totalResources} risorse attive
          </span>
          <button class="delete is-small" title="Rimuovi filtri"
            @click=${() => { filterOrg = ""; filterProvincia = ""; rebuildDerived(); rerender(); }}
          ></button>
        </div>
      ` : ""}

      <!-- Barra servizi -->
      <div class="gor-available-bar">
        <span class="gor-available-bar-label">Servizi:</span>

        <!-- Assegnati (sempre visibili, drop target durante drag) -->
        ${activeServices.map(s => html`
          <div
            class="gor-active-chip ${dropTarget === s ? "is-drop-target" : ""}"
            @dragover=${e => { e.preventDefault(); if (dropTarget !== s) { dropTarget = s; rerender(); } }}
            @dragleave=${e => { if (!e.currentTarget.contains(e.relatedTarget) && dropTarget === s) { dropTarget = null; rerender(); } }}
            @drop=${e => onDrop(e, s)}
          >${s}</div>
        `)}

        <!-- Non assegnati: sempre visibili durante drag, altrimenti dietro toggle -->
        ${availableServices.length > 0 ? html`
          ${!dragPayload ? html`
            <span
              class="gor-available-toggle"
              @click=${() => { showAvailable = !showAvailable; rerender(); }}
              title="${showAvailable ? "Nascondi servizi non assegnati" : "Mostra servizi non assegnati"}"
            >+${availableServices.length} ${showAvailable ? "▲" : "▼"}</span>
          ` : ""}
          ${(showAvailable || dragPayload) ? availableServices.map(s => html`
            <div
              class="gor-available-chip ${dropTarget === s ? "is-drop-target" : ""}"
              @dragover=${e => { e.preventDefault(); if (dropTarget !== s) { dropTarget = s; rerender(); } }}
              @dragleave=${e => { if (!e.currentTarget.contains(e.relatedTarget) && dropTarget === s) { dropTarget = null; rerender(); } }}
              @drop=${e => onDrop(e, s)}
            >${s}</div>
          `) : ""}
        ` : ""}
      </div>

      <!-- Kanban (scroll orizzontale) -->
      <div class="gor-kanban">
        ${activeServices.map(service => {
          const colCards  = visibleCards.filter(c => c.service === service);
          const isTarget  = dropTarget === service;
          const isWaiting = service === WAITING;

          return html`
            <div
              class="gor-column ${isTarget ? "is-drop-target" : ""}"
              @dragover=${e => onDragOver(e, service)}
              @dragleave=${e => onDragLeave(e, service)}
              @drop=${e => onDrop(e, service)}
            >
              <div class="gor-col-header">
                <span title="${service}">${isWaiting ? "⏳" : "📋"} ${service}</span>
                <span class="tag is-light is-small" style="flex-shrink:0">${colCards.length}</span>
              </div>
              ${colCards.length === 0
                ? html`<p class="has-text-grey is-size-7 has-text-centered py-4">—</p>`
                : colCards.map(c => renderCard(c))
              }
            </div>
          `;
        })}
      </div>

      </div><!-- /.box -->

      <!-- Modal -->
      ${renderModal()}
    `;
  }

  // boot
  load();
  return view();
}
