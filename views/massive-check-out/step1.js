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
    const needle = q ? q.toLocaleLowerCase("it-IT") : "";
    const filtered = needle
      ? items.filter(it =>
          `${it.org} ${it.code} ${it.provincia}`
            .toLocaleLowerCase("it-IT")
            .includes(needle)
        )
      : items;

    return html`
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
            ?disabled=${loading}
          />
        </div>

        ${loading
          ? html`<progress class="progress is-small is-primary"></progress>`
          : html`<p class="help">${filtered.length} risultati</p>`}

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
  }

  load();

  // se il framework supporta cleanup:
  // return () => { cancelled = true; }

  return view();
}
