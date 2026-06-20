// views/worktable-explorer/index.js — Esploratore WorkTable

function safe(v) {
  return String(v ?? "").trim();
}

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function getTotal(res) {
  if (res && typeof res.results === "number") return res.results;
  return null;
}

// ---- main export -----------------------------------------------------------

export async function WorktableExplorer({ state, client, html, render, root }) {

  // --- state ---
  let tables        = [];
  let tablesLoading = true;
  let tablesError   = null;

  let selectedTable = "";
  let records       = [];
  let columns       = [];   // tutti i campi del record (incluso id)
  let editableCols  = [];   // colonne senza id
  let total         = null;
  let page          = 1;
  let pageSize      = 20;
  let loading       = false;
  let error         = null;
  let successMsg    = null;
  let successTimer  = null;
  let errorTimer    = null;

  let editMode      = false;
  let drafts        = {};   // { [id]: { [col]: value } }
  let busyIds       = new Set();

  let creating      = false;
  let createDraft   = {};
  let busyCreate    = false;

  let deleteTarget  = null; // id in attesa conferma
  let busyDelete    = new Set();

  let attachmentMap = new Map(); // id → { mime, ext } per i record che hanno un allegato

  const READONLY_COLS = ["id", "uuid"];

  // sort
  let sortCol = "id";
  let sortDir = "asc"; // "asc" | "desc" | null

  // filter
  const OPERATORS = [
    { value: "cs", label: "contiene" },
    { value: "eq", label: "uguale a" },
    { value: "sw", label: "inizia con" },
    { value: "ew", label: "finisce con" },
    { value: "is", label: "è vuoto" },
    { value: "nis", label: "non è vuoto" },
  ];
  let filterCol    = "";
  let filterOp     = "cs";
  let filterVal    = "";
  let filterActive = false; // true quando il filtro corrente è applicato

  // overlay: { record, drafts, editing, busy, confirmDelete, attachmentBusy, confirmDeleteAttachment }
  let overlay = null;
  let attachmentPreview = false; // true = lightbox immagine aperto

  // crop fototessera (35×45mm = 7:9)
  const FOTO_W = 35, FOTO_H = 45;
  let cropState = null;
  // cropState = { blob, mimeType, imageEl, canvasW, canvasH, scaleX, scaleY,
  //               box:{x,y,w,h}, dragging, dragOffX, dragOffY, eventsAttached }

  // ---

  function rerender() {
    render(view(), root);
    const v = document.getElementById("wt-camera-preview");
    if (v && overlay?.cameraStream && !v.srcObject) v.srcObject = overlay.cameraStream;
    initCropCanvas();
  }

  function flash(msg, isError = false) {
    if (isError) {
      clearTimeout(errorTimer);
      error = msg; successMsg = null;
      rerender();
      errorTimer = setTimeout(() => { error = null; rerender(); }, 5000);
    } else {
      clearTimeout(successTimer);
      successMsg = msg; error = null;
      rerender();
      successTimer = setTimeout(() => { successMsg = null; rerender(); }, 3000);
    }
  }

  async function loadTables() {
    tablesLoading = true;
    tablesError = null;
    rerender();
    try {
      const res = await client.tables();
      tables = Array.isArray(res)
        ? res
        : Array.isArray(res?.tables)
          ? res.tables
          : [];
      tables = tables.map(t => safe(t.name ?? t)).filter(Boolean).sort();
    } catch (e) {
      tablesError = safe(e?.message || e);
    }
    tablesLoading = false;
    rerender();
  }

  async function loadRecords(resetPage = false) {
    if (!selectedTable) return;
    if (resetPage) {
      page = 1;
      sortCol = "id"; sortDir = "asc";
      filterCol = ""; filterOp = "cs"; filterVal = ""; filterActive = false;
    }
    loading = true;
    error = null;
    editMode = false;
    drafts = {};
    creating = false;
    createDraft = {};
    deleteTarget = null;
    rerender();

    const query = { size: pageSize, page: page };
    if (sortCol && sortDir) query.order = [[sortCol, sortDir]];
    if (filterActive && filterCol) {
      const noVal = filterOp === "is" || filterOp === "nis";
      if (noVal || filterVal.trim()) {
        query.filters = [client.filter(filterCol, filterOp, ...(noVal ? [] : [filterVal.trim()]))];
      }
    }

    try {
      const res = await client.table(selectedTable).list(query);
      records = getRecords(res);
      total = getTotal(res);
      if (records.length > 0) {
        columns = Object.keys(records[0]);
        editableCols = columns.filter(c => !READONLY_COLS.includes(c));
      } else {
        // fallback: use describe if available
        try {
          const desc = await client.table(selectedTable).describe();
          const cols = Array.isArray(desc) ? desc : (desc?.columns || []);
          columns = cols.map(c => safe(c.name ?? c)).filter(Boolean);
          editableCols = columns.filter(c => !READONLY_COLS.includes(c));
          if (!columns.includes("id")) columns = ["id", ...columns];
        } catch (_) {
          columns = [];
          editableCols = [];
        }
      }
    } catch (e) {
      error = safe(e?.payload?.message || e?.message || e);
      records = [];
      total = null;
    }
    loading = false;
    rerender();

    // carica in background quali record hanno un allegato
    client.table(selectedTable).listAttachments()
      .then(res => {
        const ids = Array.isArray(res) ? res : (res?.ids || []);
        attachmentMap = new Map(ids.map(item =>
          typeof item === "object"
            ? [String(item.id), { mime: item.mime || "", ext: item.ext || "" }]
            : [String(item), { mime: "", ext: "" }]
        ));
        rerender();
      })
      .catch(() => { attachmentMap = new Map(); });
  }

  async function saveRow(id) {
    const patch = drafts[id];
    if (!patch || !Object.keys(patch).length) return;
    busyIds.add(id);
    rerender();
    try {
      await client.table(selectedTable).update(id, patch);
      const idx = records.findIndex(r => String(r.id) === String(id));
      if (idx !== -1) Object.assign(records[idx], patch);
      delete drafts[id];
      flash("Record aggiornato.");
    } catch (e) {
      flash(safe(e?.payload?.message || e?.message || e), true);
    }
    busyIds.delete(id);
    rerender();
  }

  async function deleteRow(id) {
    busyDelete.add(id);
    deleteTarget = null;
    rerender();
    try {
      await client.table(selectedTable).remove(id);
      records = records.filter(r => String(r.id) !== String(id));
      if (total !== null) total--;
      flash("Record eliminato.");
    } catch (e) {
      flash(safe(e?.payload?.message || e?.message || e), true);
    }
    busyDelete.delete(id);
    rerender();
  }

  async function createRow() {
    busyCreate = true;
    rerender();
    try {
      const res = await client.table(selectedTable).create(createDraft);
      flash("Record creato.");
      creating = false;
      createDraft = {};
      await loadRecords();
    } catch (e) {
      flash(safe(e?.payload?.message || e?.message || e), true);
    }
    busyCreate = false;
    rerender();
  }

  function setDraft(id, col, val) {
    if (!drafts[id]) drafts[id] = {};
    drafts[id][col] = val;
  }

  function toggleSort(col) {
    if (sortCol !== col) { sortCol = col; sortDir = "asc"; }
    else if (sortDir === "asc")  sortDir = "desc";
    else if (sortDir === "desc") { sortCol = null; sortDir = null; }
    page = 1;
    loadRecords();
  }

  function applyFilter() {
    filterActive = true;
    page = 1;
    loadRecords();
  }

  function clearFilter() {
    filterCol = ""; filterOp = "cs"; filterVal = ""; filterActive = false;
    page = 1;
    loadRecords();
  }

  function totalPages() {
    if (!total || !pageSize) return 1;
    return Math.ceil(total / pageSize);
  }

  // ---- view ----

  function renderFilterRow() {
    if (!selectedTable || columns.length === 0) return "";
    const noVal = filterOp === "is" || filterOp === "nis";
    return html`
      <div style="
        display:flex;align-items:center;flex-wrap:wrap;gap:8px;
        padding:8px 1.25rem;background:#fffde7;border-bottom:1px solid #e8e8e8;
      ">
        <i class="ri-filter-3-line has-text-grey"></i>

        <div class="select is-small">
          <select @change=${e => { filterCol = e.target.value; rerender(); }}>
            <option value="">— colonna —</option>
            ${columns.map(c => html`
              <option value="${c}" ?selected=${c === filterCol}>${c}</option>
            `)}
          </select>
        </div>

        <div class="select is-small">
          <select @change=${e => { filterOp = e.target.value; rerender(); }}>
            ${OPERATORS.map(o => html`
              <option value="${o.value}" ?selected=${o.value === filterOp}>${o.label}</option>
            `)}
          </select>
        </div>

        ${noVal ? "" : html`
          <input
            class="input is-small"
            type="text"
            placeholder="valore…"
            style="max-width:200px"
            .value=${filterVal}
            @input=${e => { filterVal = e.target.value; }}
            @keydown=${e => { if (e.key === "Enter") applyFilter(); }}
          />
        `}

        <button class="button is-small is-warning"
          ?disabled=${!filterCol || loading}
          @click=${applyFilter}>
          <span class="icon"><i class="ri-search-line"></i></span>
          <span>Applica</span>
        </button>

        ${filterActive ? html`
          <button class="button is-small is-light" @click=${clearFilter}>
            <span class="icon"><i class="ri-close-line"></i></span>
            <span>Rimuovi filtro</span>
          </button>
          <span class="tag is-warning is-light">
            ${filterCol} ${OPERATORS.find(o => o.value === filterOp)?.label}${noVal ? "" : ` "${filterVal}"`}
          </span>
        ` : ""}
      </div>
    `;
  }

  function renderToolbar() {
    return html`
      <div style="
        display:flex;align-items:center;flex-wrap:wrap;gap:10px;
        padding:10px 1.25rem;background:#f8f9fa;border-bottom:1px solid #e8e8e8;
      ">
        <!-- Selettore tabella -->
        <div class="select is-small">
          <select
            ?disabled=${tablesLoading}
            @change=${e => {
              selectedTable = e.target.value;
              loadRecords(true);
            }}
          >
            <option value="">
              ${tablesLoading ? "Caricamento…" : tablesError ? "Errore caricamento tabelle" : "— Seleziona tabella —"}
            </option>
            ${tables.map(t => html`
              <option value="${t}" ?selected=${t === selectedTable}>${t}</option>
            `)}
          </select>
        </div>

        <!-- Page size -->
        <div class="select is-small">
          <select @change=${e => { pageSize = Number(e.target.value); loadRecords(true); }}>
            ${[10, 20, 50, 100].map(n => html`
              <option value="${n}" ?selected=${n === pageSize}>${n} / pag.</option>
            `)}
          </select>
        </div>

        <div style="flex:1"></div>

        <!-- Edit mode -->
        ${selectedTable && records.length > 0 ? html`
          <button
            class="button is-small ${editMode ? "is-warning" : "is-light"}"
            @click=${() => {
              editMode = !editMode;
              if (!editMode) { drafts = {}; creating = false; createDraft = {}; }
              rerender();
            }}
          >
            <span class="icon"><i class="${editMode ? "ri-close-line" : "ri-edit-line"}"></i></span>
            <span>${editMode ? "Annulla modifica" : "Modifica"}</span>
          </button>
          ${editMode ? html`
            <button
              class="button is-small is-success is-light"
              @click=${() => { creating = true; createDraft = {}; rerender(); }}
              ?disabled=${creating}
            >
              <span class="icon"><i class="ri-add-line"></i></span>
              <span>Nuovo</span>
            </button>
          ` : ""}
        ` : ""}

        <!-- Refresh -->
        <button
          class="button is-small is-light"
          ?disabled=${loading || !selectedTable}
          @click=${() => loadRecords()}
        >
          <span class="icon"><i class="ri-refresh-line"></i></span>
          <span>Aggiorna</span>
        </button>
      </div>
    `;
  }

  function renderPagination() {
    if (!total && total !== 0) return "";
    const tp = totalPages();
    return html`
      <div style="
        display:flex;align-items:center;gap:8px;
        padding:8px 1.25rem;background:#f8f9fa;border-top:1px solid #e8e8e8;
        font-size:0.8rem;
      ">
        <button class="button is-small" ?disabled=${page <= 1 || loading}
          @click=${() => { page--; loadRecords(); }}>
          <span class="icon"><i class="ri-arrow-left-s-line"></i></span>
        </button>
        <span class="is-size-7 has-text-grey">
          Pagina <strong>${page}</strong> di <strong>${tp}</strong>
          &nbsp;·&nbsp; ${total} record
        </span>
        <input
          class="input is-small"
          type="number" min="1" max="${tp}"
          .value=${String(page)}
          style="width:60px;text-align:center"
          @change=${e => {
            const v = Math.max(1, Math.min(tp, Number(e.target.value)));
            if (v !== page) { page = v; loadRecords(); }
          }}
        />
        <button class="button is-small" ?disabled=${page >= tp || loading}
          @click=${() => { page++; loadRecords(); }}>
          <span class="icon"><i class="ri-arrow-right-s-line"></i></span>
        </button>
      </div>
    `;
  }

  function renderTable() {
    if (!selectedTable) {
      return html`
        <div class="has-text-centered has-text-grey py-6">
          <i class="ri-table-line" style="font-size:2rem"></i>
          <p class="mt-2">Seleziona una tabella per esplorarne i dati.</p>
        </div>
      `;
    }

    if (loading) {
      return html`<div class="has-text-centered py-6"><span class="tag is-info is-light">Caricamento…</span></div>`;
    }

    if (error) {
      return html`
        <article class="message is-danger mx-4 my-4">
          <div class="message-header"><p>Errore</p></div>
          <div class="message-body">${error}</div>
        </article>
      `;
    }

    if (columns.length === 0) {
      return html`<div class="has-text-centered has-text-grey py-6">Nessun record trovato.</div>`;
    }

    return html`
      <div style="overflow-x:auto">
        <table class="table is-fullwidth is-narrow is-striped is-hoverable" style="font-size:0.8rem">
          <thead>
            <tr>
              ${columns.map(c => {
                const isSort = sortCol === c;
                const icon = isSort
                  ? (sortDir === "asc" ? "ri-sort-asc" : "ri-sort-desc")
                  : "ri-expand-up-down-line";
                return html`
                  <th style="white-space:nowrap;cursor:pointer;user-select:none"
                    @click=${() => toggleSort(c)}>
                    ${c}
                    <i class="${icon}" style="margin-left:4px;opacity:${isSort ? 1 : 0.3};font-size:0.75rem"></i>
                  </th>`;
              })}
              <th style="width:110px"></th>
            </tr>
          </thead>
          <tbody>
            ${creating ? html`
              <tr style="background:#e8f5e9">
                ${columns.map(c => html`
                  <td>
                    ${c === "id"
                      ? html`<span class="has-text-grey is-italic">auto</span>`
                      : html`<input
                          class="input is-small"
                          type="text"
                          .value=${safe(createDraft[c])}
                          @input=${e => { createDraft[c] = e.target.value; }}
                        />`
                    }
                  </td>
                `)}
                <td>
                  <div class="buttons are-small">
                    <button class="button is-success is-small" ?disabled=${busyCreate}
                      @click=${createRow}>
                      <i class="ri-check-line"></i>
                    </button>
                    <button class="button is-light is-small"
                      @click=${() => { creating = false; createDraft = {}; rerender(); }}>
                      <i class="ri-close-line"></i>
                    </button>
                  </div>
                </td>
              </tr>
            ` : ""}
            ${records.map(r => {
              const id = r.id;
              const isBusy = busyIds.has(id);
              const isDeleting = busyDelete.has(id);
              const isDraftDirty = drafts[id] && Object.keys(drafts[id]).length > 0;
              const isConfirming = deleteTarget === id;

              return html`
                <tr style="${isConfirming ? "background:#fff3e0" : ""}">
                  ${columns.map(c => html`
                    <td style="vertical-align:middle;cursor:pointer"
                      @dblclick=${() => {
                        overlay = { record: Object.assign({}, r), drafts: {}, editing: false, busy: false, confirmDelete: false, attachmentBusy: false, confirmDeleteAttachment: false, attachmentBlobUrl: null, cameraOpen: false, cameraStream: null, cameraDevices: [], cameraDeviceId: "" };
                        rerender();
                        // se ha allegato, carica subito il blob autenticato
                        if (attachmentMap.has(String(r.id))) {
                          client.table(selectedTable).fetchAttachment(r.id)
                            .then(({ blob }) => {
                              if (overlay && String(overlay.record.id) === String(r.id)) {
                                overlay.attachmentBlobUrl = URL.createObjectURL(blob);
                                rerender();
                              }
                            })
                            .catch(() => {});
                        }
                      }}>
                      ${editMode && !READONLY_COLS.includes(c)
                        ? html`<input
                            class="input is-small"
                            type="text"
                            .value=${safe(drafts[id]?.[c] ?? r[c])}
                            @input=${e => setDraft(id, c, e.target.value)}
                          />`
                        : html`<span
                            style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px"
                            title="${safe(r[c])}"
                          >${safe(r[c])}</span>`
                      }
                    </td>
                  `)}
                  <td style="vertical-align:middle">
                    <div class="buttons are-small" style="flex-wrap:nowrap;gap:4px">
                      ${attachmentMap.has(String(id)) ? html`
                        <span class="tag is-light is-small" title="${attachmentMap.get(String(id))?.ext || "allegato"}">
                          <i class="ri-attachment-2"></i>
                        </span>
                      ` : ""}
                      ${editMode ? html`
                        <button
                          class="button is-small is-info is-light"
                          ?disabled=${isBusy || !isDraftDirty}
                          title="Salva"
                          @click=${() => saveRow(id)}
                        >
                          <i class="${isBusy ? "ri-loader-line ri-spin" : "ri-save-line"}"></i>
                        </button>
                      ` : ""}
                      ${!isConfirming ? html`
                        <button
                          class="button is-small is-danger is-light"
                          ?disabled=${isDeleting}
                          title="Elimina"
                          @click=${() => { deleteTarget = id; rerender(); }}
                        >
                          <i class="${isDeleting ? "ri-loader-line ri-spin" : "ri-delete-bin-line"}"></i>
                        </button>
                      ` : html`
                        <button class="button is-small is-danger" @click=${() => deleteRow(id)}>
                          <i class="ri-check-line"></i>
                        </button>
                        <button class="button is-small is-light" @click=${() => { deleteTarget = null; rerender(); }}>
                          <i class="ri-close-line"></i>
                        </button>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  async function saveOverlay() {
    if (!overlay || !overlay.editing) return;
    const patch = {};
    for (const c of editableCols) {
      const val = overlay.drafts[c] ?? safe(overlay.record[c]);
      if (val !== safe(overlay.record[c])) patch[c] = val;
    }
    if (!Object.keys(patch).length) { overlay.editing = false; rerender(); return; }
    overlay.busy = true;
    rerender();
    try {
      await client.table(selectedTable).update(overlay.record.id, patch);
      const idx = records.findIndex(r => String(r.id) === String(overlay.record.id));
      if (idx !== -1) Object.assign(records[idx], patch);
      Object.assign(overlay.record, patch);
      flash("Record aggiornato.");
      overlay.editing = false;
      overlay.drafts = {};
    } catch (e) {
      flash(safe(e?.payload?.message || e?.message || e), true);
    }
    overlay.busy = false;
    rerender();
  }

  function closeOverlay() {
    cropState = null;
    if (overlay?.cameraStream) overlay.cameraStream.getTracks().forEach(t => t.stop());
    if (overlay?.attachmentBlobUrl) URL.revokeObjectURL(overlay.attachmentBlobUrl);
    overlay = null;
    attachmentPreview = false;
    rerender();
  }

  async function openCamera() {
    try {
      const devices = (await navigator.mediaDevices.enumerateDevices())
        .filter(d => d.kind === "videoinput");
      overlay.cameraDevices = devices;
      if (!overlay.cameraDeviceId && devices.length) overlay.cameraDeviceId = devices[0].deviceId;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: overlay.cameraDeviceId ? { deviceId: { exact: overlay.cameraDeviceId } } : true
      });
      if (overlay.cameraStream) overlay.cameraStream.getTracks().forEach(t => t.stop());
      overlay.cameraStream = stream;
      overlay.cameraOpen = true;
    } catch(e) {
      flash("Fotocamera non disponibile: " + (e?.message || e), true);
    }
    rerender();
  }

  function stopCamera() {
    if (overlay?.cameraStream) overlay.cameraStream.getTracks().forEach(t => t.stop());
    overlay.cameraStream = null;
    overlay.cameraOpen = false;
    rerender();
  }

  async function capturePhoto() {
    const video = document.getElementById("wt-camera-preview");
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(async blob => {
      stopCamera();
      await startCrop(blob, "image/jpeg");
    }, "image/jpeg", 0.92);
  }

  async function startCrop(blob, mimeType) {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    await new Promise(r => { img.onload = r; });
    URL.revokeObjectURL(url);

    const MAX_W = 520, MAX_H = 390;
    const scale = Math.min(MAX_W / img.naturalWidth, MAX_H / img.naturalHeight, 1);
    const cW = Math.round(img.naturalWidth * scale);
    const cH = Math.round(img.naturalHeight * scale);

    // crop box iniziale: altezza 70% del canvas, ratio 35:45
    const boxH = Math.round(cH * 0.70);
    const boxW = Math.round(boxH * FOTO_W / FOTO_H);
    cropState = {
      blob, mimeType, imageEl: img,
      canvasW: cW, canvasH: cH,
      scaleX: img.naturalWidth / cW, scaleY: img.naturalHeight / cH,
      box: {
        x: Math.round((cW - boxW) / 2),
        y: Math.round((cH - boxH) / 2),
        w: boxW, h: boxH
      },
      dragging: false, dragOffX: 0, dragOffY: 0, eventsAttached: false
    };
    rerender();
  }

  function initCropCanvas() {
    const canvas = document.getElementById("wt-crop-canvas");
    if (!canvas || !cropState || cropState.eventsAttached) return;
    canvas.width = cropState.canvasW;
    canvas.height = cropState.canvasH;
    drawCropCanvas();

    function canvasPx(e) {
      const r = canvas.getBoundingClientRect();
      return {
        mx: (e.clientX - r.left) * (canvas.width / r.width),
        my: (e.clientY - r.top) * (canvas.height / r.height)
      };
    }
    canvas.addEventListener("pointerdown", e => {
      const { mx, my } = canvasPx(e);
      const b = cropState.box;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        cropState.dragging = true;
        cropState.dragOffX = mx - b.x;
        cropState.dragOffY = my - b.y;
        canvas.setPointerCapture(e.pointerId);
      }
    });
    canvas.addEventListener("pointermove", e => {
      if (!cropState?.dragging) return;
      const { mx, my } = canvasPx(e);
      const b = cropState.box;
      b.x = Math.max(0, Math.min(cropState.canvasW - b.w, mx - cropState.dragOffX));
      b.y = Math.max(0, Math.min(cropState.canvasH - b.h, my - cropState.dragOffY));
      drawCropCanvas();
    });
    canvas.addEventListener("pointerup", () => { if (cropState) cropState.dragging = false; });
    cropState.eventsAttached = true;
  }

  function drawCropCanvas() {
    const canvas = document.getElementById("wt-crop-canvas");
    if (!canvas || !cropState) return;
    const ctx = canvas.getContext("2d");
    const { imageEl, canvasW, canvasH, box, scaleX, scaleY } = cropState;

    ctx.drawImage(imageEl, 0, 0, canvasW, canvasH);

    // oscura fuori dal crop
    ctx.fillStyle = "rgba(0,0,0,0.58)";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // reintegra immagine dentro il crop
    ctx.drawImage(imageEl,
      box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY,
      box.x, box.y, box.w, box.h
    );

    // bordo bianco
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);

    // griglie dei terzi
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    [1/3, 2/3].forEach(f => {
      ctx.beginPath(); ctx.moveTo(box.x + box.w * f, box.y); ctx.lineTo(box.x + box.w * f, box.y + box.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(box.x, box.y + box.h * f); ctx.lineTo(box.x + box.w, box.y + box.h * f); ctx.stroke();
    });
  }

  async function confirmCrop() {
    if (!cropState) return;
    const { imageEl, box, scaleX, scaleY, mimeType } = cropState;
    const out = document.createElement("canvas");
    out.width = 350; out.height = 450; // 100 px/cm a 3.5×4.5cm
    out.getContext("2d").drawImage(imageEl,
      box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY,
      0, 0, 350, 450
    );
    out.toBlob(async blob => {
      cropState = null;
      overlay.attachmentBusy = true;
      rerender();
      try {
        const file = new File([blob], "fototessera.jpg", { type: "image/jpeg" });
        await client.table(selectedTable).uploadAttachment(overlay.record.id, file);
        attachmentMap.set(String(overlay.record.id), { mime: "image/jpeg", ext: "jpg" });
        if (overlay.attachmentBlobUrl) URL.revokeObjectURL(overlay.attachmentBlobUrl);
        overlay.attachmentBlobUrl = URL.createObjectURL(blob);
        flash("Fototessera caricata.");
      } catch(e) { flash(safe(e?.payload?.message || e?.message || e), true); }
      overlay.attachmentBusy = false;
      rerender();
    }, "image/jpeg", 0.92);
  }

  async function skipCrop() {
    if (!cropState) return;
    const { blob, mimeType } = cropState;
    cropState = null;
    overlay.attachmentBusy = true;
    rerender();
    try {
      const ext = mimeType.split("/")[1] || "jpg";
      const file = new File([blob], `allegato.${ext}`, { type: mimeType });
      await client.table(selectedTable).uploadAttachment(overlay.record.id, file);
      attachmentMap.set(String(overlay.record.id), { mime: mimeType, ext });
      if (overlay.attachmentBlobUrl) URL.revokeObjectURL(overlay.attachmentBlobUrl);
      overlay.attachmentBlobUrl = URL.createObjectURL(blob);
      flash("Allegato caricato.");
    } catch(e) { flash(safe(e?.payload?.message || e?.message || e), true); }
    overlay.attachmentBusy = false;
    rerender();
  }

  function cancelCrop() { cropState = null; rerender(); }

  function renderCropModal() {
    if (!cropState) return "";
    return html`
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:1300;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1rem">
        <p style="color:rgba(255,255,255,0.7);font-size:0.82rem;margin:0;text-align:center">
          <i class="ri-drag-move-line"></i> Trascina il riquadro per posizionarlo &nbsp;·&nbsp; Formato fototessera 35×45 mm
        </p>
        <canvas id="wt-crop-canvas" style="cursor:move;border-radius:6px;max-width:90vw;box-shadow:0 4px 24px rgba(0,0,0,0.6)"></canvas>
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;justify-content:center">
          <button class="button is-success"
            @click=${() => confirmCrop()}>
            <span class="icon"><i class="ri-scissors-cut-line"></i></span>
            <span>Ritaglia e carica</span>
          </button>
          <button class="button is-light"
            @click=${() => skipCrop()}>
            <span class="icon"><i class="ri-upload-line"></i></span>
            <span>Carica originale</span>
          </button>
          <button class="button is-light"
            @click=${() => cancelCrop()}>
            <span class="icon"><i class="ri-close-line"></i></span>
            <span>Annulla</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderOverlay() {
    if (!overlay) return "";
    return html`
      <div
        style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem"
        @click=${e => { if (e.target === e.currentTarget) { closeOverlay(); } }}
      >
        <div style="background:#fff;border-radius:8px;width:min(640px,95vw);max-height:90vh;display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.2)">

          <!-- Header -->
          <div style="display:flex;align-items:center;gap:8px;padding:1rem 1.25rem;border-bottom:1px solid #e8e8e8;flex-shrink:0">
            <span class="tag is-light" style="font-family:monospace">${selectedTable}</span>
            <span class="tag is-info is-light" style="font-family:monospace">id: ${safe(overlay.record.id)}</span>
            <div style="flex:1"></div>
            ${!overlay.editing && !overlay.confirmDelete ? html`
              <button class="button is-small is-info is-light" ?disabled=${overlay.busy}
                @click=${() => { overlay.editing = true; overlay.drafts = {}; rerender(); }}>
                <span class="icon"><i class="ri-edit-line"></i></span>
                <span>Modifica</span>
              </button>
              <button class="button is-small is-danger is-light" ?disabled=${overlay.busy}
                @click=${() => { overlay.confirmDelete = true; rerender(); }}>
                <span class="icon"><i class="ri-delete-bin-line"></i></span>
              </button>
            ` : ""}
            <button class="button is-small is-ghost" ?disabled=${overlay.busy}
              @click=${() => { closeOverlay(); }}>
              <i class="ri-close-line"></i>
            </button>
          </div>

          <!-- Campi -->
          <div style="overflow-y:auto;padding:1rem 1.25rem;flex:1">
            <table class="table is-fullwidth is-narrow" style="font-size:0.85rem">
              <tbody>
                ${columns.map(c => {
                  const isReadonly = READONLY_COLS.includes(c);
                  const current = safe(overlay.record[c]);
                  const draft = overlay.drafts[c] ?? current;
                  const isDirty = overlay.editing && !isReadonly && draft !== current;
                  return html`
                    <tr style="${isDirty ? "background:#fffde7" : ""}">
                      <td style="white-space:nowrap;font-weight:600;width:35%;vertical-align:top;padding-top:0.6rem">
                        ${c}
                        ${isReadonly ? html`<span class="tag is-light is-small ml-1">Sola lettura</span>` : ""}
                      </td>
                      <td style="vertical-align:top">
                        ${overlay.editing && !isReadonly
                          ? html`<textarea
                              class="textarea is-small"
                              style="font-family:monospace;font-size:0.8rem;min-height:38px;resize:vertical"
                              .value=${draft}
                              @input=${e => { overlay.drafts[c] = e.target.value; rerender(); }}
                              ?disabled=${overlay.busy}
                            ></textarea>`
                          : html`<pre style="white-space:pre-wrap;word-break:break-all;background:#f5f5f5;padding:.4rem .6rem;border-radius:4px;font-size:0.8rem;margin:0;min-height:28px">${current || html`<span class="has-text-grey">—</span>`}</pre>`
                        }
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>

          <!-- Allegato -->
          <div style="padding:.75rem 1.25rem;border-top:1px solid #e8e8e8;flex-shrink:0">
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
              <span style="font-size:0.8rem;font-weight:600;color:#555">
                <i class="ri-attachment-2"></i> Allegato
              </span>

              ${(() => {
                const att = attachmentMap.get(String(overlay.record.id));
                if (!att) return html`<span style="font-size:0.8rem;color:#aaa;font-style:italic">Nessun allegato</span>`;
                const isImage = att.mime.startsWith("image/");
                return isImage
                  ? overlay.attachmentBlobUrl
                    ? html`<img
                        src="${overlay.attachmentBlobUrl}"
                        style="max-height:80px;max-width:120px;border-radius:4px;border:1px solid #e0e0e0;object-fit:cover;cursor:zoom-in"
                        title="Clicca per ingrandire"
                        @click=${() => { attachmentPreview = true; rerender(); }}
                      />`
                    : html`<span style="font-size:0.8rem;color:#aaa"><i class="ri-loader-4-line"></i> caricamento…</span>`
                  : html`<span class="tag is-light" style="font-family:monospace">
                      <i class="ri-file-line" style="margin-right:4px"></i>${att.ext || att.mime || "file"}
                    </span>`;
              })()}

              <div style="flex:1"></div>

              ${overlay.confirmDeleteAttachment ? html`
                <span style="font-size:0.8rem;color:#c0392b">Eliminare l'allegato?</span>
                <button class="button is-small is-light"
                  ?disabled=${overlay.attachmentBusy}
                  @click=${() => { overlay.confirmDeleteAttachment = false; rerender(); }}>
                  Annulla
                </button>
                <button class="button is-small is-danger"
                  ?disabled=${overlay.attachmentBusy}
                  @click=${async () => {
                    overlay.attachmentBusy = true;
                    rerender();
                    try {
                      await client.table(selectedTable).deleteAttachment(overlay.record.id);
                      attachmentMap.delete(String(overlay.record.id));
                      overlay.confirmDeleteAttachment = false;
                      if (overlay.attachmentBlobUrl) { URL.revokeObjectURL(overlay.attachmentBlobUrl); overlay.attachmentBlobUrl = null; }
                      flash("Allegato eliminato.");
                    } catch(e) {
                      flash(safe(e?.payload?.message || e?.message || e), true);
                    }
                    overlay.attachmentBusy = false;
                    rerender();
                  }}>
                  <i class="${overlay.attachmentBusy ? "ri-loader-line ri-spin" : "ri-delete-bin-line"}"></i>
                </button>
              ` : html`
                ${attachmentMap.has(String(overlay.record.id)) ? html`
                  ${attachmentMap.get(String(overlay.record.id))?.mime?.startsWith("image/") ? html`
                    <button class="button is-small is-light"
                      ?disabled=${overlay.attachmentBusy || overlay.busy}
                      title="Anteprima"
                      @click=${() => { attachmentPreview = true; rerender(); }}>
                      <i class="ri-eye-line"></i>
                    </button>
                  ` : ""}
                  <button class="button is-small is-light"
                    ?disabled=${overlay.attachmentBusy || overlay.busy}
                    title="Scarica allegato"
                    @click=${async () => {
                      overlay.attachmentBusy = true;
                      rerender();
                      try {
                        const { blob, ext } = await client.table(selectedTable).fetchAttachment(overlay.record.id);
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${selectedTable}-${overlay.record.id}${ext ? "." + ext : ""}`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      } catch(e) {
                        flash(safe(e?.message || e), true);
                      }
                      overlay.attachmentBusy = false;
                      rerender();
                    }}>
                    <i class="ri-download-line"></i>
                  </button>
                  <button class="button is-small is-danger is-light"
                    ?disabled=${overlay.attachmentBusy || overlay.busy}
                    title="Elimina allegato"
                    @click=${() => { overlay.confirmDeleteAttachment = true; rerender(); }}>
                    <i class="ri-delete-bin-line"></i>
                  </button>
                ` : ""}
                <label class="button is-small is-info is-light"
                  style="cursor:pointer"
                  title="${attachmentMap.has(String(overlay.record.id)) ? "Sostituisci allegato" : "Carica allegato"}">
                  <i class="${overlay.attachmentBusy ? "ri-loader-line ri-spin" : "ri-upload-line"}"></i>
                  <input type="file" accept="image/*" style="display:none"
                    ?disabled=${overlay.attachmentBusy || overlay.busy}
                    @change=${async e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      e.target.value = "";
                      if (file.type.startsWith("image/")) {
                        await startCrop(file, file.type);
                      } else {
                        overlay.attachmentBusy = true;
                        rerender();
                        try {
                          await client.table(selectedTable).uploadAttachment(overlay.record.id, file);
                          attachmentMap.set(String(overlay.record.id), { mime: file.type, ext: file.name.split(".").pop() || "" });
                          if (overlay.attachmentBlobUrl) URL.revokeObjectURL(overlay.attachmentBlobUrl);
                          overlay.attachmentBlobUrl = null;
                          flash("Allegato caricato.");
                        } catch(e) {
                          flash(safe(e?.payload?.message || e?.message || e), true);
                        }
                        overlay.attachmentBusy = false;
                        rerender();
                      }
                    }}
                  />
                </label>
                <button class="button is-small is-info is-light"
                  title="Scatta foto con fotocamera"
                  ?disabled=${overlay.attachmentBusy || overlay.busy}
                  @click=${() => openCamera()}>
                  <i class="ri-camera-line"></i>
                </button>
              `}
            </div>
          </div>

          <!-- Footer -->
          ${overlay.confirmDelete ? html`
            <div style="display:flex;align-items:center;gap:8px;padding:.75rem 1.25rem;border-top:1px solid #e8e8e8;flex-shrink:0;background:#fff3e0">
              <span class="icon has-text-danger"><i class="ri-error-warning-line"></i></span>
              <span style="flex:1;font-size:0.85rem">Eliminare questo record? L'operazione è irreversibile.</span>
              <button class="button is-small is-light"
                @click=${() => { overlay.confirmDelete = false; rerender(); }}
                ?disabled=${overlay.busy}>
                Annulla
              </button>
              <button class="button is-small is-danger" ?disabled=${overlay.busy}
                @click=${async () => {
                  overlay.busy = true;
                  rerender();
                  await deleteRow(overlay.record.id);
                  closeOverlay();
                }}>
                <span class="icon"><i class="${overlay.busy ? "ri-loader-line ri-spin" : "ri-delete-bin-line"}"></i></span>
                <span>Elimina</span>
              </button>
            </div>
          ` : overlay.editing ? html`
            <div style="display:flex;justify-content:flex-end;gap:8px;padding:.75rem 1.25rem;border-top:1px solid #e8e8e8;flex-shrink:0">
              <button class="button is-small is-light"
                @click=${() => { overlay.editing = false; overlay.drafts = {}; rerender(); }}
                ?disabled=${overlay.busy}>
                Annulla
              </button>
              <button class="button is-small is-success" @click=${saveOverlay} ?disabled=${overlay.busy}>
                <span class="icon"><i class="${overlay.busy ? "ri-loader-line ri-spin" : "ri-save-line"}"></i></span>
                <span>Salva modifiche</span>
              </button>
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }

  function renderAttachmentPreview() {
    if (!attachmentPreview || !overlay) return "";
    const att = attachmentMap.get(String(overlay.record.id));
    if (!att || !att.mime.startsWith("image/")) return "";
    const blobUrl = overlay.attachmentBlobUrl;
    if (!blobUrl) return "";
    return html`
      <div
        style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1100;display:flex;align-items:center;justify-content:center;padding:1rem;cursor:zoom-out"
        @click=${() => { attachmentPreview = false; rerender(); }}
      >
        <img
          src="${blobUrl}"
          style="max-width:90vw;max-height:90vh;border-radius:6px;object-fit:contain;box-shadow:0 4px 32px rgba(0,0,0,0.5)"
          @click=${e => e.stopPropagation()}
        />
        <button
          style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.15);border:none;border-radius:50%;width:36px;height:36px;cursor:pointer;color:#fff;font-size:1.1rem;display:flex;align-items:center;justify-content:center"
          @click=${() => { attachmentPreview = false; rerender(); }}>
          <i class="ri-close-line"></i>
        </button>
      </div>
    `;
  }

  function renderCameraModal() {
    if (!overlay?.cameraOpen) return "";
    const devices = overlay.cameraDevices;
    return html`
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:1200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1rem">
        ${devices.length > 1 ? html`
          <select class="select is-small"
            style="color:#fff;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.3);border-radius:4px;padding:4px 8px"
            @change=${async e => {
              overlay.cameraDeviceId = e.target.value;
              await openCamera();
            }}>
            ${devices.map(d => html`
              <option value="${d.deviceId}" ?selected=${d.deviceId === overlay.cameraDeviceId}>
                ${d.label || "Fotocamera " + (devices.indexOf(d) + 1)}
              </option>
            `)}
          </select>
        ` : ""}
        <video id="wt-camera-preview" autoplay playsinline muted
          style="max-width:min(640px,90vw);max-height:60vh;border-radius:8px;background:#000;box-shadow:0 4px 32px rgba(0,0,0,0.5)">
        </video>
        <div style="display:flex;gap:.75rem">
          <button class="button is-success"
            @click=${() => capturePhoto()}>
            <span class="icon"><i class="ri-camera-line"></i></span>
            <span>Scatta</span>
          </button>
          <button class="button is-light"
            @click=${() => stopCamera()}>
            <span class="icon"><i class="ri-close-line"></i></span>
            <span>Annulla</span>
          </button>
        </div>
      </div>
    `;
  }

  function view() {
    return html`
      <div class="box" style="padding:0;overflow:hidden;margin:1rem">

        ${renderToolbar()}

        <!-- Notifiche -->
        ${successMsg ? html`
          <div class="notification is-success is-light py-2 px-4 mb-0" style="border-radius:0;border-bottom:1px solid #c3e6cb">
            <i class="ri-check-line"></i> ${successMsg}
          </div>
        ` : ""}
        ${error && !loading ? html`
          <div class="notification is-danger is-light py-2 px-4 mb-0" style="border-radius:0;border-bottom:1px solid #f5c6cb">
            <i class="ri-error-warning-line"></i> ${error}
          </div>
        ` : ""}

        ${renderFilterRow()}
        ${renderPagination()}
        ${renderTable()}
        ${renderPagination()}
      </div>

      ${renderOverlay()}
      ${renderAttachmentPreview()}
      ${renderCameraModal()}
      ${renderCropModal()}
    `;
  }

  // boot
  await loadTables();
  return view();
}
