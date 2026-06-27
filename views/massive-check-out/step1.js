// ./views/massive-check-out/step1.js

/* =========================
   helpers
   ========================= */

function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function norm(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function makeKey(it) {
  return [
    norm(it.org).toLowerCase(),
    norm(it.code).toLowerCase(),
    norm(it.provincia).toLowerCase()
  ].join("|");
}

/* =========================
   error handling
   ========================= */

function normalizeApiError(err) {
  const raw = err?.payload ?? err?.response ?? err;

  const status =
    raw?.status ??
    raw?.statusCode ??
    err?.status ??
    err?.statusCode ??
    raw?.response?.status;

  const code =
    raw?.code ??
    err?.code ??
    raw?.error?.code;

  const message =
    raw?.message ??
    err?.message ??
    raw?.error?.message ??
    (typeof raw === "string" ? raw : "Errore sconosciuto");

  let kind = "unknown";
  if (status === 401 || status === 403) kind = "auth";
  else if (status === 404) kind = "not_found";
  else if (status === 429) kind = "rate_limit";
  else if (status >= 500) kind = "server";
  else if (code === "ETIMEDOUT" || code === "ECONNABORTED") kind = "timeout";
  else if (code === "ENETUNREACH" || code === "ECONNRESET") kind = "network";

  return { status, code, message, kind, raw };
}

function userFriendlyErrorText(e) {
  switch (e.kind) {
    case "auth":
      return "Sessione scaduta o permessi insufficienti. Ricarica la pagina o rifai login.";
    case "rate_limit":
      return "Troppe richieste in poco tempo. Attendi qualche secondo e riprova.";
    case "timeout":
    case "network":
      return "Problema di connessione. Controlla la rete e riprova.";
    case "server":
      return "Il server sta avendo problemi. Riprova tra poco.";
    case "not_found":
      return "Risorsa non trovata (tabella o endpoint inesistente).";
    default:
      return "Si è verificato un errore durante il caricamento dei dati.";
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function shouldRetry(e) {
  return ["network", "timeout", "server", "rate_limit"].includes(e.kind);
}

async function withRetry(fn, { retries = 2, baseDelay = 400 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = normalizeApiError(err);
      if (attempt === retries || !shouldRetry(last)) throw last;

      const delay =
        baseDelay * Math.pow(2, attempt) +
        Math.floor(Math.random() * 150);

      await sleep(delay);
    }
  }
  throw last;
}

/* =========================
   data loading
   ========================= */

async function loadDistinctOrganizations(client, tableName) {
  const API = client.table(tableName);

  const res = await API.list({
    include: ["organizzazione", "codice-organizzazione", "provincia"],
    size: 5000
  });

  // TODO: se l'SDK supporta paginazione, ciclare qui

  const rows = getRecords(res);
  const map = new Map();

  for (const r of rows) {
    const org = norm(r["organizzazione"]);
    const code = norm(r["codice-organizzazione"]);
    const provincia = norm(r["provincia"]);
    if (!org) continue;

    const item = { org, code, provincia };
    const key = makeKey(item);
    if (!map.has(key)) map.set(key, item);
  }

  return Array.from(map.values());
}

/* =========================
   Step 1
   ========================= */

export async function Step1({ state, client, goTo, html, render, root }) {
  let loading = true;
  let retrying = false;
  let error = null;
  let items = [];
  let q = "";

  let cancelled = false;

  /* =========================
     modalità totem
     ========================= */

  const totemMode = new URLSearchParams(window.location.search).get("totem") === "1";
  let totemCode    = "";
  let totemLoading = false;
  let totemError   = null;

  // scanner QR (jsQR — funziona su tutti i browser desktop/mobile)
  let scanMode    = false;
  let scanStream  = null;
  let scanError   = null;
  let _scanning   = false;
  let _jsQR       = null;
  let _scanCanvas = null;
  let _scanCtx    = null;
  let _lastScan   = 0;

  async function loadJsQR() {
    if (_jsQR) return _jsQR;
    await new Promise((resolve, reject) => {
      if (window.jsQR) { resolve(); return; }
      const s = document.createElement("script");
      s.src = "/camila/js/jsQR/jsQR.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Impossibile caricare il decoder QR."));
      document.head.appendChild(s);
    });
    _jsQR = window.jsQR;
    return _jsQR;
  }

  async function openScanner() {
    scanError = null;
    try {
      const jsqr = await loadJsQR();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      scanStream  = stream;
      scanMode    = true;
      _scanning   = true;
      _jsQR       = jsqr;
      _scanCanvas = document.createElement("canvas");
      _scanCtx    = _scanCanvas.getContext("2d", { willReadFrequently: true });
      rerender();
      requestAnimationFrame(scanLoop);
    } catch (e) {
      scanError = e?.message || "Fotocamera o decoder QR non disponibili.";
      rerender();
    }
  }

  function closeScanner() {
    _scanning   = false;
    if (scanStream) scanStream.getTracks().forEach(t => t.stop());
    scanStream  = null;
    scanMode    = false;
    _scanCanvas = null;
    _scanCtx    = null;
    rerender();
  }

  function scanLoop(ts) {
    if (!_scanning) return;
    const video = document.getElementById("wt-totem-scanner");
    if (!video || video.readyState < 2) { requestAnimationFrame(scanLoop); return; }

    if (ts - _lastScan >= 100) {
      _lastScan = ts;
      try {
        const w = video.videoWidth, h = video.videoHeight;
        if (w && h) {
          _scanCanvas.width  = w;
          _scanCanvas.height = h;
          _scanCtx.drawImage(video, 0, 0, w, h);
          const img  = _scanCtx.getImageData(0, 0, w, h);
          const code = _jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const raw = code.data.trim();
            closeScanner();
            totemCode = raw;
            lookupTotem();
            return;
          }
        }
      } catch (_) {}
    }

    if (_scanning) requestAnimationFrame(scanLoop);
  }

  async function lookupTotem() {
    const code = totemCode.trim();
    if (!code) { totemError = "Inserisci il codice totem."; rerender(); return; }

    totemLoading = true;
    totemError   = null;
    rerender();

    try {
      const res   = await client.call("GET", "/segreteria-campo/totem/organization-codes");
      const list  = Array.isArray(res?.data) ? res.data : [];
      const match = list.find(item => String(item.code) === String(code));

      if (!match) {
        totemError   = "Codice non riconosciuto. Verifica e riprova.";
        totemLoading = false;
        rerender();
        return;
      }

      select({ org: match.organizzazione, code: match["codice-organizzazione"], provincia: match.provincia || "" });
    } catch (e) {
      totemError   = userFriendlyErrorText(normalizeApiError(e));
      totemLoading = false;
      rerender();
    }
  }

  function viewTotem() {
    return html`
      <div class="box">
        <p class="mb-4 has-text-grey is-size-7">
          Inserisci il codice assegnato alla tua organizzazione.
        </p>

        ${totemError ? html`
          <div class="notification is-danger is-light is-small mb-3">
            <i class="ri-error-warning-line mr-1"></i> ${totemError}
          </div>
        ` : ""}

        <div class="field has-addons">
          <div class="control is-expanded">
            <input
              class="input is-medium"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="Codice organizzazione"
              .value=${totemCode}
              ?disabled=${totemLoading}
              @input=${e => { totemCode = e.target.value; totemError = null; rerender(); }}
              @keydown=${e => { if (e.key === "Enter") lookupTotem(); }}
            />
          </div>
          <div class="control">
            <button
              class="button is-primary is-medium ${totemLoading ? "is-loading" : ""}"
              ?disabled=${totemLoading}
              @click=${lookupTotem}
            >
              <span class="icon"><i class="ri-arrow-right-line"></i></span>
              <span>Conferma</span>
            </button>
          </div>
        </div>

        <div class="mt-3">
          <button class="button is-light is-fullwidth"
            ?disabled=${totemLoading}
            @click=${openScanner}>
            <span class="icon"><i class="ri-qr-scan-2-line"></i></span>
            <span>Scansiona QR code</span>
          </button>
        </div>
      </div>

      ${scanMode ? html`
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:1200;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:1rem">
          ${scanError ? html`
            <div class="notification is-danger is-light is-small">
              <i class="ri-error-warning-line mr-1"></i> ${scanError}
            </div>
          ` : html`
            <p style="color:rgba(255,255,255,0.7);font-size:0.85rem;margin:0;text-align:center">
              <i class="ri-qr-code-line"></i> Inquadra il QR code dell'organizzazione
            </p>
          `}
          <video id="wt-totem-scanner" autoplay playsinline muted
            style="max-width:min(480px,90vw);max-height:60vh;border-radius:8px;background:#000;box-shadow:0 4px 32px rgba(0,0,0,0.5)">
          </video>
          <button class="button is-light" @click=${closeScanner}>
            <span class="icon"><i class="ri-close-line"></i></span>
            <span>Annulla</span>
          </button>
        </div>
      ` : ""}
    `;
  }

  async function load() {
    loading = true;
    retrying = false;
    error = null;
    rerender();

    try {
      // ✅ aggiunta tabella "materiali"
      const results = await Promise.allSettled([
        withRetry(() => loadDistinctOrganizations(client, "volontari")),
        withRetry(() => loadDistinctOrganizations(client, "mezzi")),
        withRetry(() => loadDistinctOrganizations(client, "materiali"))
      ]);

      const volontari =
        results[0].status === "fulfilled" ? results[0].value : [];
      const mezzi =
        results[1].status === "fulfilled" ? results[1].value : [];
      const materiali =
        results[2].status === "fulfilled" ? results[2].value : [];

      const merged = new Map();
      for (const it of [...volontari, ...mezzi, ...materiali]) {
        const key = makeKey(it);
        if (!merged.has(key)) merged.set(key, it);
      }

      items = Array.from(merged.values()).sort((a, b) => {
        const c = a.org.localeCompare(b.org, "it");
        if (c !== 0) return c;
        const d = a.code.localeCompare(b.code, "it");
        if (d !== 0) return d;
        return a.provincia.localeCompare(b.provincia, "it");
      });

      const failures = results.filter(r => r.status === "rejected");
      if (failures.length) {
        error = normalizeApiError(failures[0].reason);
      }
    } catch (e) {
      error = normalizeApiError(e);
    } finally {
      loading = false;
      if (!cancelled) rerender();
    }
  }

  function select(it) {
    state.org = state.org || {};
    state.org.name = it.org;
    state.org.code = it.code;
    state.org.province = it.provincia;

    // reset downstream state
    state.step2SelectedCFs = [];
    state.checkoutSelection = null;

    goTo(2);
  }

  function view() {
    const titleEl = html`
      <div class="box">
        <h3 class="title is-4">
          <span class="icon is-medium" style="vertical-align:middle;margin-right:.4rem">
            <i class="ri-logout-box-line ri-lg"></i>
          </span>Check-out
        </h3>
      </div>
    `;

    if (totemMode) return html`${titleEl}${viewTotem()}`;

    const needle = q ? q.toLocaleLowerCase("it-IT") : "";
    const filtered = needle
      ? items.filter(it =>
          `${it.org} ${it.code} ${it.provincia}`
            .toLocaleLowerCase("it-IT")
            .includes(needle)
        )
      : items;

    if (loading) return html`
      ${titleEl}
      <section class="section">
        <div class="container has-text-centered">
          <p class="has-text-grey mb-2">Caricamento…</p>
          <progress class="progress" style="max-width:400px;margin:0 auto"></progress>
        </div>
      </section>
    `;

    return html`
      ${titleEl}
      <div class="box">
        <div class="field">
          <input
            class="input"
            placeholder="Cerca organizzazione..."
            .value=${q}
            @input=${e => {
              q = e.target.value;
              rerender();
            }}
          />
        </div>

        <p class="help">${filtered.length} risultati</p>

        ${error
          ? html`
              <article class="message is-danger">
                <div class="message-body">
                  <p>${userFriendlyErrorText(error)}</p>

                  <div class="buttons mt-2">
                    <button
                      class="button is-light is-small"
                      ?disabled=${loading || retrying}
                      @click=${async () => {
                        retrying = true;
                        rerender();
                        await load();
                      }}
                    >
                      Riprova
                    </button>
                  </div>

                  <details class="mt-2">
                    <summary>Dettagli tecnici</summary>
                    <pre style="white-space:pre-wrap;margin:0">
${JSON.stringify(
  {
    status: error.status,
    code: error.code,
    message: error.message,
    kind: error.kind
  },
  null,
  2
)}
                    </pre>
                  </details>
                </div>
              </article>
            `
          : ""}

        <div
          class="menu"
          style="max-height:340px;overflow:auto;border:1px solid #ddd;border-radius:6px"
        >
          <ul class="menu-list">
            ${(!loading && filtered.length === 0)
              ? html`<li><span class="is-disabled">Nessun risultato</span></li>`
              : ""}

            ${filtered.map(
              it => html`
                <li>
                  <button
                    type="button"
                    class="button is-white is-fullwidth"
                    style="justify-content:flex-start;text-align:left;white-space:normal"
                    @click=${() => select(it)}
                  >
                    <strong>${it.org}</strong>

                    ${it.code
                      ? html`<span class="tag ml-2">${it.code}</span>`
                      : ""}

                    ${it.provincia
                      ? html`<span class="tag is-light ml-2"
                          >${it.provincia}</span
                        >`
                      : ""}

                  </button>
                </li>
              `
            )}
          </ul>
        </div>
      </div>
    `;
  }

  function rerender() {
    render(view(), root);
    const sv = document.getElementById("wt-totem-scanner");
    if (sv && scanStream && !sv.srcObject) sv.srcObject = scanStream;
  }

  if (!totemMode) load();

  // se il framework supporta cleanup:
  // return () => { cancelled = true; }

  return view();
}
