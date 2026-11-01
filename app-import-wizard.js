import { html, render } from "../../../../camila/js/lit-html/lit-html.js";

const root   = document.getElementById("app");
const client = WorkTableClient(window.APP_CONFIG || {});

const t = (key, ...args) => {
  let s = window.I18N?.[key] ?? key;
  args.forEach(a => { s = s.replace('%s', a); });
  return s;
};

const state = {
  loading: true,
  error: null,
  tables: [],
  examples: {},
  selected: new Set(),
  importing: new Set(),
  queued: new Set(),    // selected, waiting for the one before: the imports run one at a time
  results: {},
};

// What a finished import says. The API counts rows it could not insert in `failed`; showing only
// `imported` made a sheet that lost rows look like a sheet with nothing to import.
function resultText(r) {
  if (r.imported === 0 && r.failed === 0 && r.total > 0) {
    return `${t('iw.imported', 0)} · ${t('iw.nodata', r.total)}`;
  }
  return t('iw.imported', r.imported) + (r.failed > 0 ? ` · ${t('iw.failed', r.failed)}` : '');
}
const resultClass = r => (!r.ok ? 'is-danger' : (r.failed > 0 || (r.imported === 0 && r.total > 0)) ? 'is-warning' : 'is-success');

function rerender() { render(App(), root); }

function toggleSelect(name) {
  if (state.selected.has(name)) state.selected.delete(name);
  else state.selected.add(name);
  rerender();
}

function App() {
  const importable   = state.tables.filter(tbl => state.examples[tbl.short_title] && !state.results[tbl.name]);
  const allChecked   = importable.length > 0 && importable.every(tbl => state.selected.has(tbl.name));
  const anyImporting = state.importing.size > 0 || state.queued.size > 0;
  const anyIncomplete = Object.values(state.results).some(r => r.ok && resultClass(r) === 'is-warning');
  const nSelected    = state.selected.size;
  const warnTables   = state.tables.filter(tbl => state.selected.has(tbl.name) && tbl.count > 0);

  function toggleAll() {
    if (allChecked) importable.forEach(tbl => state.selected.delete(tbl.name));
    else importable.forEach(tbl => state.selected.add(tbl.name));
    rerender();
  }

  const rows = state.tables.map(tbl => {
    const ex        = state.examples[tbl.short_title];
    const result    = state.results[tbl.name];
    const importing = state.importing.has(tbl.name);
    const checked   = state.selected.has(tbl.name);
    return html`<tr>
      <td style="width:2rem" class="has-text-centered">
        ${result || !ex ? html`` : html`<input type="checkbox"
          .checked=${checked} ?disabled=${importing || anyImporting}
          @change=${() => toggleSelect(tbl.name)}>`}
      </td>
      <td>${tbl.short_title}</td>
      <td>
        ${ex
          ? html`<span class="is-size-7">${ex.filename}</span>
              ${tbl.count > 0
                ? html`<span class="tag is-warning is-light ml-2">${t('iw.records', tbl.count)}</span>`
                : ''}`
          : html`<span class="has-text-grey">—</span>`}
      </td>
      <td>
        ${importing
          ? html`<progress class="progress is-small" style="max-width:160px"></progress>`
          : state.queued.has(tbl.name)
            ? html`<span class="tag is-light">${t('iw.queued')}</span>`
            : result
              ? html`<span class="tag is-light ${resultClass(result)}">
                  ${result.ok ? resultText(result) : result.error}
                </span>`
              : html`<span class="has-text-grey">—</span>`}
      </td>
    </tr>`;
  });

  return html`
    <div class="box spa-title-box mb-4">
      <h3 class="title is-4 mb-0">
        <span class="icon is-medium" style="vertical-align: middle; margin-right: 0.4rem;">
          <i class="ri-upload-2-line ri-lg"></i>
        </span>
        ${t('iw.title')}
      </h3>
    </div>

    <div class="level mb-3">
      <div class="level-left"></div>
      <div class="level-right">
        <div class="level-item">
          <button class="button is-primary is-small ${anyImporting ? 'is-loading' : ''}"
            ?disabled=${nSelected === 0 || anyImporting} @click=${runImports}>
            <span class="icon"><i class="ri-upload-2-line"></i></span>
            <span>${t('iw.btn.import')}${nSelected > 0 ? ` (${nSelected})` : ''}</span>
          </button>
        </div>
      </div>
    </div>

    ${state.error ? html`
      <article class="message is-danger"><div class="message-body">${state.error}</div></article>` : ''}

    ${warnTables.length > 0 ? html`
      <article class="message is-warning">
        <div class="message-body">
          ${t('iw.warn.nonempty')}
          <ul style="margin-top:0.4rem;margin-left:1rem;list-style:disc">
            ${warnTables.map(tbl => html`<li><strong>${tbl.short_title}</strong> (${t('iw.records', tbl.count)})</li>`)}
          </ul>
        </div>
      </article>` : ''}

    ${anyIncomplete ? html`
      <article class="message is-warning"><div class="message-body">${t('iw.warn.failed')}</div></article>` : ''}

    ${state.loading ? html`<progress class="progress is-small is-primary"></progress>` : ''}

    ${!state.loading
      ? state.tables.length === 0
        ? html`<p class="has-text-grey">${t('iw.empty')}</p>`
        : html`<table class="table is-fullwidth is-striped is-hoverable">
            <thead><tr>
              <th style="width:2rem" class="has-text-centered">
                ${importable.length > 0 ? html`<input type="checkbox"
                  .checked=${allChecked} ?disabled=${anyImporting} @change=${toggleAll}>` : html``}
              </th>
              <th>${t('iw.col.sheet')}</th>
              <th>${t('iw.col.file')}</th>
              <th>${t('iw.col.status')}</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>`
      : ''}`;
}

async function doImport(tablename, filepath) {
  state.importing.add(tablename); rerender();
  try {
    const res = await client.importTable(tablename, filepath);
    state.results[tablename] = {
      ok: true,
      imported: res.imported ?? 0,
      failed: res.failed ?? 0,
      total: res.total ?? res.imported ?? 0,
    };
  } catch (e) {
    state.results[tablename] = { ok: false, error: e?.payload?.message || e?.message || t('iw.error.unknown') };
  } finally { state.importing.delete(tablename); rerender(); }
}

// One sheet at a time, in the order of the table. Started together they would write to the database
// together, and SQLite (the local installation) takes one writer at a time: the others fail rows with
// "database is locked", more or less at random, and a sheet could end with fewer rows than its file.
async function runImports() {
  const toImport = state.tables
    .filter(tbl => state.selected.has(tbl.name))
    .map(tbl => ({ name: tbl.name, filepath: state.examples[tbl.short_title]?.filepath }));
  state.selected.clear();
  toImport.forEach(({ name }) => state.queued.add(name));
  rerender();
  for (const { name, filepath } of toImport) {
    state.queued.delete(name);
    await doImport(name, filepath);
  }
}

async function load() {
  try {
    const [tabResp, exResp] = await Promise.all([
      client.tables({ metadata: "1", count: "1" }),
      client.call("GET", "/segreteria-campo/import/examples"),
    ]);
    state.tables   = tabResp.tables || [];
    state.examples = exResp.byTable || {};
  } catch (e) {
    state.error = e?.payload?.message || e?.message || t('iw.error.load');
  } finally { state.loading = false; rerender(); }
}

render(html`<div></div>`, root);
load();
