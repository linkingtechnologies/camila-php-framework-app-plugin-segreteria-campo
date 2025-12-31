// views/massive-check-in/step1.js

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
  // chiave composta per deduplicare tra tabelle
  return [
    norm(it.org).toLowerCase(),
    norm(it.code).toLowerCase(),
    norm(it.provincia).toLowerCase()
  ].join("|");
}

/**
 * Estrae organizzazioni DISTINCT da una tabella
 */
async function loadDistinctOrganizations(client, tableName) {
  const API = client.table(tableName);

  const res = await API.list({
    include: ["organizzazione", "codice-organizzazione", "provincia"],
    size: 5000
  });

  const rows = getRecords(res);

  const map = new Map(); // key -> { org, code, provincia }

  for (const r of rows) {
    const org = norm(r["organizzazione"]);
    const code = norm(r["codice-organizzazione"]);
    const provincia = norm(r["provincia"]);

    if (!org) continue;

    const item = { org, code, provincia };
    const key = makeKey(item);

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values());
}

/* =========================
   Step 1
   ========================= */

export async function Step1({ state, client, goTo, html, render, root }) {
  let loading = true;
  let error = null;
  let items = [];
  let q = "";

  async function load() {
    try {
      const [attesi, preacc] = await Promise.all([
        loadDistinctOrganizations(client, "volontari-attesi"),
        loadDistinctOrganizations(client, "volontari-preaccreditati")
      ]);

      // merge finale senza duplicati
      const merged = new Map();
      for (const it of [...attesi, ...preacc]) {
        const key = makeKey(it);
        if (!merged.has(key)) merged.set(key, it);
      }

      items = Array.from(merged.values())
        .sort((a, b) => a.org.localeCompare(b.org, "it"));
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  function select(it) {
    state.org.name = it.org;
    state.org.code = it.code;
    state.org.province = it.provincia;
    goTo(2);
  }

  function view() {
    const filtered = q
      ? items.filter(it =>
          `${it.org} ${it.code} ${it.provincia}`
            .toLowerCase()
            .includes(q.toLowerCase())
        )
      : items;

    return html`
      <div class="box">
        <h2 class="subtitle">Step 1 — Organizzazione</h2>

        <div class="field">
          <input
            class="input"
            placeholder="Cerca organizzazione…"
            .value=${q}
            @input=${e => { q = e.target.value; rerender(); }}
            ?disabled=${loading}
          />
        </div>

        ${loading
          ? html`<progress class="progress is-small is-primary"></progress>`
          : ""}

        ${error
          ? html`
              <article class="message is-danger">
                <div class="message-body">
                  ${String(error && (error.payload || error.message || error))}
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
              ? html`<li><a class="is-disabled">Nessun risultato</a></li>`
              : ""}

            ${filtered.map(it => html`
              <li>
                <a @click=${() => select(it)}>
                  <strong>${it.org}</strong>

                  ${it.provincia
                    ? html`<span class="tag is-light ml-2">${it.provincia}</span>`
                    : ""}

                  ${it.code
                    ? html`<span class="tag ml-2">${it.code}</span>`
                    : ""}
                </a>
              </li>
            `)}
          </ul>
        </div>
      </div>
    `;
  }

  function rerender() {
    render(view(), root);
  }

  // kick-off
  load();
  return view();
}
