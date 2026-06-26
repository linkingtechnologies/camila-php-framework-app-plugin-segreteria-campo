// views/requests-board/index.js

function norm(s) {
  return String(s ?? "").trim().replace(/\s+/g, " ");
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

const STATI = [
  "A - Presa in carico",
  "B - In valutazione",
  "C1 - In lavorazione",
  "C2 - In attesa di lavorazione",
  "D1 - Eseguita",
  "D2 - Respinta"
];

const TIPI = ["Interna", "Esterna"];

const PRIORITA = [
  "1 - Urgente",
  "2 - Alta",
  "3 - Normale",
  "4 - Bassa",
  "5 - Molto bassa"
];

const PRIO_STYLE = {
  "1 - Urgente":      { border: "#ef4444", bg: "#fef2f2", text: "#b91c1c" },
  "2 - Alta":         { border: "#f97316", bg: "#fff7ed", text: "#c2410c" },
  "3 - Normale":      { border: "#6b7280", bg: "#f9fafb", text: "#374151" },
  "4 - Bassa":        { border: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  "5 - Molto bassa":  { border: "#d1d5db", bg: "#f9fafb", text: "#9ca3af" }
};

const STATO_COLOR = {
  "A - Presa in carico":           "#6366f1",
  "B - In valutazione":            "#f59e0b",
  "C1 - In lavorazione":           "#10b981",
  "C2 - In attesa di lavorazione": "#8b5cf6",
  "D1 - Eseguita":                 "#22c55e",
  "D2 - Respinta":                 "#ef4444"
};

export async function RequestsBoard({ client, html, render, root }) {
  const Table = client.table("richieste");

  let records   = [];
  let loading   = false;
  let error     = null;

  let filterTipo = "";
  let filterPrio = "";
  let filterAss  = "";
  let search     = "";

  let dragId     = null;
  let dropTarget = null;

  let modal = null;
  // { mode:"create"|"edit", draft:{}, saving:false, error:null, recordId:null }

  let volontariNames = [];

  function rerender() { render(view(), root); }

  async function load() {
    loading = true; error = null; rerender();
    try {
      const res = await Table.list({
        include: ["id", "data", "richiedente", "richiesta", "tipo-richiesta",
                  "priorita", "assegnatario-richiesta", "stato", "note"],
        size: 2000
      });
      records = getRecords(res);
    } catch(e) { error = e; }
    finally { loading = false; rerender(); }
  }

  async function loadVolontari() {
    try {
      const [resV, resO] = await Promise.allSettled([
        client.table("volontari").list({ include: ["cognome", "nome"], size: 5000 }),
        client.table("operatori").list({ include: ["cognome", "nome"], size: 1000 })
      ]);
      const seen = new Set();
      volontariNames = [];
      const sources = [
        resV.status === "fulfilled" ? getRecords(resV.value) : [],
        resO.status === "fulfilled" ? getRecords(resO.value) : []
      ];
      for (const rows of sources) {
        for (const r of rows) {
          const name = `${norm(r.cognome)} ${norm(r.nome)}`.trim();
          if (name && !seen.has(name)) { seen.add(name); volontariNames.push(name); }
        }
      }
      volontariNames.sort();
      rerender();
    } catch {}
  }

  /* ── filters ─────────────────────────────────────────────── */

  function filtered() {
    return records.filter(r => {
      if (filterTipo && norm(r["tipo-richiesta"]) !== filterTipo) return false;
      if (filterPrio && norm(r.priorita)          !== filterPrio) return false;
      if (filterAss  && norm(r["assegnatario-richiesta"]) !== filterAss) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!norm(r.richiesta).toLowerCase().includes(q) &&
            !norm(r.richiedente).toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function assegnatari() {
    return [...new Set(records
      .map(r => norm(r["assegnatario-richiesta"]))
      .filter(Boolean))].sort();
  }

  /* ── modal ───────────────────────────────────────────────── */

  function openCreate() {
    const today = new Date().toISOString().slice(0, 10);
    modal = { mode: "create",
              draft: { stato: STATI[0], priorita: PRIORITA[2], "tipo-richiesta": TIPI[0], data: today },
              saving: false, error: null, recordId: null };
    rerender();
  }

  function openEdit(r) {
    modal = { mode: "edit",
              draft: { data: norm(r.data), richiedente: norm(r.richiedente),
                       richiesta: norm(r.richiesta),
                       "tipo-richiesta": norm(r["tipo-richiesta"]) || TIPI[0],
                       priorita: norm(r.priorita) || PRIORITA[2],
                       "assegnatario-richiesta": norm(r["assegnatario-richiesta"]),
                       stato: norm(r.stato) || STATI[0],
                       note: norm(r.note) },
              saving: false, error: null, recordId: r.id };
    rerender();
  }

  function closeModal() { modal = null; rerender(); }

  async function saveModal() {
    if (!modal) return;
    modal.saving = true; modal.error = null; rerender();
    try {
      const payload = {};
      for (const [k, v] of Object.entries(modal.draft)) {
        const s = norm(String(v ?? ""));
        if (s) payload[k] = s;
      }
      if (modal.mode === "create") await Table.create(payload);
      else                          await Table.update(modal.recordId, payload);
      modal = null;
      await load();
    } catch(e) {
      modal.saving = false; modal.error = e; rerender();
    }
  }

  async function deleteRecord(id) {
    if (!confirm("Eliminare questa richiesta?")) return;
    records = records.filter(r => r.id !== id);
    rerender();
    try { await Table.remove(id); }
    catch { await load(); }
  }

  /* ── drag & drop ─────────────────────────────────────────── */

  async function moveCard(id, newStato) {
    const rec = records.find(r => r.id === id);
    if (!rec || norm(rec.stato) === newStato) return;
    rec.stato = newStato; rerender();
    try { await Table.update(id, { stato: newStato }); }
    catch { await load(); }
  }

  /* ── render helpers ──────────────────────────────────────── */

  function ps(prio) { return PRIO_STYLE[prio] || PRIO_STYLE["3 - Normale"]; }

  function shortPrio(prio) { return norm(prio).replace(/^\d+ - /, ""); }

  function fmtDate(s) {
    const m = /(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? `${m[3]}/${m[2]}/${m[1]}` : norm(s);
  }

  /* ── card ────────────────────────────────────────────────── */

  function renderCard(r) {
    const prio = norm(r.priorita);
    const c    = ps(prio);
    return html`
      <div draggable="true"
        @dragstart=${e => { dragId = r.id; e.dataTransfer.effectAllowed = "move"; }}
        @dragend=${() => { dragId = null; dropTarget = null; rerender(); }}
        style="background:#fff;border-radius:6px;border-left:4px solid ${c.border};
          box-shadow:0 1px 3px rgba(0,0,0,.08);padding:.6rem .7rem;
          margin-bottom:.5rem;cursor:grab;
          opacity:${dragId === r.id ? .4 : 1};transition:opacity .1s">

        <div style="font-size:.8rem;font-weight:600;color:#1f2937;
          margin-bottom:.25rem;line-height:1.35">
          ${norm(r.richiesta) || "—"}
        </div>

        <div style="font-size:.7rem;color:#6b7280;display:flex;gap:.5rem;
          flex-wrap:wrap;margin-bottom:.3rem">
          ${norm(r.richiedente)
            ? html`<span><i class="ri-user-line"></i> ${norm(r.richiedente)}</span>` : ""}
          ${norm(r.data)
            ? html`<span><i class="ri-calendar-line"></i> ${fmtDate(norm(r.data))}</span>` : ""}
        </div>

        <div style="display:flex;gap:.3rem;flex-wrap:wrap;margin-bottom:.3rem">
          <span style="font-size:.65rem;padding:1px 6px;border-radius:10px;
            background:${c.bg};color:${c.text};font-weight:600">
            ${shortPrio(prio) || prio || "—"}
          </span>
          ${norm(r["tipo-richiesta"]) ? html`
            <span style="font-size:.65rem;padding:1px 6px;border-radius:10px;
              background:#f0f9ff;color:#0369a1">
              ${norm(r["tipo-richiesta"])}
            </span>` : ""}
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.68rem;color:#6b7280;overflow:hidden;
            text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">
            ${norm(r["assegnatario-richiesta"])
              ? html`<i class="ri-user-received-line"></i> ${norm(r["assegnatario-richiesta"])}`
              : ""}
          </span>
          <div style="display:flex;gap:.15rem;flex-shrink:0;margin-left:.3rem">
            <button class="button is-ghost is-small" style="padding:2px 4px;height:auto"
              title="Modifica"
              @click=${e => { e.stopPropagation(); openEdit(r); }}>
              <i class="ri-pencil-line" style="font-size:.75rem;color:#6b7280"></i>
            </button>
            <button class="button is-ghost is-small" style="padding:2px 4px;height:auto"
              title="Elimina"
              @click=${e => { e.stopPropagation(); deleteRecord(r.id); }}>
              <i class="ri-delete-bin-6-line" style="font-size:.75rem;color:#ef4444"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /* ── column ──────────────────────────────────────────────── */

  function renderColumn(stato, cards) {
    const color  = STATO_COLOR[stato] || "#6b7280";
    const isOver = dropTarget === stato;
    return html`
      <div style="flex:0 0 260px;display:flex;flex-direction:column;
        background:#f1f5f9;border-radius:8px;overflow:hidden;
        border:2px solid ${isOver ? color : "transparent"};transition:border-color .12s"
        @dragover=${e => {
          e.preventDefault();
          if (dropTarget !== stato) { dropTarget = stato; rerender(); }
        }}
        @dragleave=${() => {
          if (dropTarget === stato) { dropTarget = null; rerender(); }
        }}
        @drop=${e => {
          e.preventDefault();
          const id = dragId; dragId = null; dropTarget = null;
          if (id) moveCard(id, stato); else rerender();
        }}>

        <div style="padding:.55rem .7rem;background:${color};color:#fff;
          font-size:.75rem;font-weight:700;letter-spacing:.03em;
          display:flex;align-items:center;justify-content:space-between;
          flex-shrink:0">
          <span>${stato}</span>
          <span style="background:rgba(255,255,255,.25);border-radius:10px;
            padding:1px 8px;font-size:.7rem">${cards.length}</span>
        </div>

        <div style="flex:1;overflow-y:auto;padding:.5rem;min-height:80px">
          ${cards.length
            ? cards.map(r => renderCard(r))
            : html`<div style="font-size:.7rem;color:#9ca3af;
                text-align:center;padding:1.2rem 0">vuota</div>`}
        </div>
      </div>
    `;
  }

  /* ── modal ───────────────────────────────────────────────── */

  function renderModal() {
    if (!modal) return "";
    const d = modal.draft;
    const set = (f, v) => { d[f] = v; rerender(); };
    const isCreate = modal.mode === "create";

    return html`
      <div style="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;
        display:flex;align-items:center;justify-content:center;padding:1rem"
        @click=${e => { if (e.target === e.currentTarget) closeModal(); }}>

        <div style="background:#fff;border-radius:8px;width:100%;max-width:560px;
          max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3)">

          <div style="padding:.85rem 1rem;border-bottom:1px solid #e5e7eb;
            display:flex;align-items:center;justify-content:space-between;
            position:sticky;top:0;background:#fff;z-index:1">
            <strong style="font-size:.95rem">
              ${isCreate ? "Nuova richiesta" : "Modifica richiesta"}
            </strong>
            <button class="delete" @click=${closeModal}></button>
          </div>

          <div style="padding:1rem;display:flex;flex-direction:column;gap:.7rem">

            ${modal.error ? html`
              <div class="notification is-danger is-light p-3" style="font-size:.8rem">
                Errore durante il salvataggio.
              </div>` : ""}

            <div class="field">
              <label class="label is-small">Richiesta *</label>
              <div class="control">
                <textarea class="textarea is-small" rows="3"
                  .value=${d.richiesta || ""}
                  @input=${e => set("richiesta", e.target.value)}></textarea>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem">
              <div class="field">
                <label class="label is-small">Richiedente</label>
                <div class="control">
                  <input class="input is-small" type="text"
                    .value=${d.richiedente || ""}
                    @input=${e => set("richiedente", e.target.value)}>
                </div>
              </div>
              <div class="field">
                <label class="label is-small">Data</label>
                <div class="control">
                  <input class="input is-small" type="date"
                    .value=${d.data || ""}
                    @input=${e => set("data", e.target.value)}>
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem">
              <div class="field">
                <label class="label is-small">Tipo</label>
                <div class="control">
                  <div class="select is-small is-fullwidth">
                    <select @change=${e => set("tipo-richiesta", e.target.value)}>
                      ${TIPI.map(t => html`
                        <option value=${t} ?selected=${d["tipo-richiesta"] === t}>${t}</option>`)}
                    </select>
                  </div>
                </div>
              </div>
              <div class="field">
                <label class="label is-small">Priorità</label>
                <div class="control">
                  <div class="select is-small is-fullwidth">
                    <select @change=${e => set("priorita", e.target.value)}>
                      ${PRIORITA.map(p => html`
                        <option value=${p} ?selected=${d.priorita === p}>${p}</option>`)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.7rem">
              <div class="field">
                <label class="label is-small">Assegnatario</label>
                <div class="control">
                  <input class="input is-small" type="text"
                    list="rb-assignees"
                    autocomplete="off"
                    .value=${d["assegnatario-richiesta"] || ""}
                    @input=${e => set("assegnatario-richiesta", e.target.value)}>
                </div>
              </div>
              <div class="field">
                <label class="label is-small">Stato</label>
                <div class="control">
                  <div class="select is-small is-fullwidth">
                    <select @change=${e => set("stato", e.target.value)}>
                      ${STATI.map(s => html`
                        <option value=${s} ?selected=${d.stato === s}>${s}</option>`)}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div class="field">
              <label class="label is-small">Note</label>
              <div class="control">
                <textarea class="textarea is-small" rows="2"
                  .value=${d.note || ""}
                  @input=${e => set("note", e.target.value)}></textarea>
              </div>
            </div>
          </div>

          <div style="padding:.75rem 1rem;border-top:1px solid #e5e7eb;
            display:flex;justify-content:flex-end;gap:.5rem;
            position:sticky;bottom:0;background:#fff">
            <button class="button is-small" @click=${closeModal}
              ?disabled=${modal.saving}>Annulla</button>
            <button class="button is-small is-primary"
              ?disabled=${modal.saving || !norm(d.richiesta || "")}
              @click=${saveModal}>
              ${modal.saving ? html`<i class="ri-loader-4-line"></i>&nbsp;` : ""}
              <span>${isCreate ? "Crea" : "Salva"}</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /* ── main view ───────────────────────────────────────────── */

  function view() {
    const recs = filtered();
    const byStato = new Map(STATI.map(s => [s, []]));
    for (const r of recs) {
      const s = norm(r.stato);
      const target = byStato.has(s) ? s : STATI[0];
      byStato.get(target).push(r);
    }

    const ass = assegnatari();

    return html`
      <style>@keyframes rb-spin{to{transform:rotate(360deg)}}</style>
      <datalist id="rb-assignees">
        ${volontariNames.map(n => html`<option value=${n}></option>`)}
      </datalist>

      ${renderModal()}

      <!-- toolbar -->
      <div style="background:#1e293b;color:#fff;padding:.45rem .75rem;
        display:flex;align-items:center;gap:.6rem;flex-wrap:wrap;flex-shrink:0">

        <span style="font-weight:700;font-size:.9rem;flex-shrink:0">
          <i class="ri-kanban-view-2" style="color:#f59e0b"></i>
          Richieste
        </span>

        <input style="background:#334155;border:1px solid #475569;color:#fff;
          border-radius:4px;padding:3px 8px;font-size:.78rem;width:170px;outline:none"
          placeholder="Cerca…"
          .value=${search}
          @input=${e => { search = e.target.value; rerender(); }}>

        <select style="background:#334155;border:1px solid #475569;color:#fff;
          border-radius:4px;padding:3px 6px;font-size:.78rem;outline:none"
          @change=${e => { filterTipo = e.target.value; rerender(); }}>
          <option value="">Tutti i tipi</option>
          ${TIPI.map(t => html`<option value=${t} ?selected=${filterTipo === t}>${t}</option>`)}
        </select>

        <select style="background:#334155;border:1px solid #475569;color:#fff;
          border-radius:4px;padding:3px 6px;font-size:.78rem;outline:none"
          @change=${e => { filterPrio = e.target.value; rerender(); }}>
          <option value="">Tutte le priorità</option>
          ${PRIORITA.map(p => html`<option value=${p} ?selected=${filterPrio === p}>${p}</option>`)}
        </select>

        ${ass.length ? html`
          <select style="background:#334155;border:1px solid #475569;color:#fff;
            border-radius:4px;padding:3px 6px;font-size:.78rem;outline:none"
            @change=${e => { filterAss = e.target.value; rerender(); }}>
            <option value="">Tutti gli assegnatari</option>
            ${ass.map(a => html`<option value=${a} ?selected=${filterAss === a}>${a}</option>`)}
          </select>
        ` : ""}

        <span style="font-size:.75rem;color:#94a3b8">${recs.length} richieste</span>

        <div style="margin-left:auto;display:flex;gap:.4rem;align-items:center">
          <button style="background:#475569;border:none;color:#fff;border-radius:4px;
            padding:4px 8px;cursor:pointer;font-size:.78rem;display:flex;align-items:center"
            @click=${load} ?disabled=${loading} title="Aggiorna">
            <i class="ri-refresh-line"></i>
          </button>
          <button style="background:#10b981;border:none;color:#fff;border-radius:4px;
            padding:4px 10px;cursor:pointer;font-size:.78rem;display:flex;
            align-items:center;gap:4px"
            @click=${openCreate}>
            <i class="ri-add-line"></i> Nuova
          </button>
        </div>
      </div>

      ${loading
        ? html`<progress class="progress is-small is-primary" style="margin:0;height:3px"></progress>`
        : ""}

      ${error ? html`
        <div class="notification is-danger is-light m-3" style="font-size:.85rem">
          Errore durante il caricamento.
          <button class="button is-small is-light ml-3" @click=${load}>Riprova</button>
        </div>` : ""}

      <!-- board -->
      <div style="overflow-x:auto;overflow-y:hidden;padding:.75rem;
        height:calc(100vh - ${loading ? 49 : 46}px);box-sizing:border-box">
        ${loading ? html`
          <div style="display:flex;align-items:center;justify-content:center;
            height:100%;gap:.6rem;color:#94a3b8">
            <div style="width:22px;height:22px;border:3px solid #e2e8f0;
              border-top-color:#6366f1;border-radius:50%;flex-shrink:0;
              animation:rb-spin .9s linear infinite"></div>
            <span style="font-size:.85rem">Caricamento…</span>
          </div>
        ` : html`
          <div style="display:flex;gap:.75rem;height:100%;min-width:max-content">
            ${STATI.map(s => renderColumn(s, byStato.get(s)))}
          </div>
        `}
      </div>
    `;
  }

  load();
  loadVolontari();
  return view();
}
