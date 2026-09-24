# CAMILA WorkTable SPA Development Guide

## Purpose

This directory contains the **Segreteria Campo** plugin — a set of lightweight Single Page Applications for managing field operations (check-in, monitoring, and check-out of volunteers, vehicles, and materials).

The plugin is part of the **CAMILA WorkTable** ecosystem:

- **Framework**: [camila-php-framework](https://github.com/linkingtechnologies/camila-php-framework) — the PHP backend that provides the WorkTable API, authentication, and table management.
- **Plugin**: [camila-php-framework-app-plugin-segreteria-campo](https://github.com/linkingtechnologies/camila-php-framework-app-plugin-segreteria-campo) — this plugin, containing the SPAs in this directory.

The SPAs run entirely in the browser and communicate with the backend exclusively via `WorkTableClient`, which wraps the CAMILA WorkTable REST API.

AI agents working in this repository must generate and modify SPA modules that are deterministic, state-safe, backward-compatible, and easy to review.

The primary goal is to evolve existing administrative tools without introducing unnecessary framework complexity or speculative architecture changes.

## Operational context

The three main SPAs implement a coordinated field management workflow:

```
Check-in massivo  →  Stato organizzazione  →  Check-out massivo
(arrival)             (monitoring)              (departure)
```

1. **Check-in massivo**: registers the arrival of volunteers, vehicles, and materials for an organization. Sets `data-inizio-attestato = today`.
2. **Stato organizzazione**: real-time dashboard showing in-service and out-of-service resources per organization.
3. **Check-out massivo**: registers the departure. Sets `servizio = "USCITA DEFINITIVA"`, `data-fine-attestato = today`, `data/ora-uscita-definitiva`, and writes a movement record to `mov-risorse`.

---

## SPA Specifications

Each SPA has a dedicated specification directory under `specs/`. Read the relevant spec before modifying a SPA.

| SPA | Entry point | Views | Spec |
|---|---|---|---|
| Comunicazioni live | `app-comms-feed.js` | `views/comms-feed/` | [`specs/comms-feed/`](specs/comms-feed/) |
| Import Wizard | `app-import-wizard.js` | — (inline) | [`specs/import-wizard/`](specs/import-wizard/) |
| Mappe | `app-map-center.js` | `views/map-center/` | [`specs/map-center/`](specs/map-center/) |
| Massive Check-in | `app-massive-check-in.js` | `views/massive-check-in/` (7 step) | [`specs/massive-check-in/`](specs/massive-check-in/) |
| Massive Check-out | `app-massive-check-out.js` | `views/massive-check-out/` (4 step) | [`specs/massive-check-out/`](specs/massive-check-out/) |
| Org Status | `app-org-status.js` | `views/org-status/` (2 step) | [`specs/org-status/`](specs/org-status/) |
| Riepilogo preaccreditamenti | `app-pre-accreditations-summary.js` | `views/pre-accreditations-summary/` | [`specs/pre-accreditations-summary/`](specs/pre-accreditations-summary/) |
| Gestione richieste | `app-requests-board.js` | `views/requests-board/` | [`specs/requests-board/`](specs/requests-board/) |
| Movimentazione risorse | `app-resource-board.js` | `views/resource-board/` | [`specs/resource-board/`](specs/resource-board/) |
| Database risorse | `app-resource-manager.js` | `views/resource-manager/` (2 step) | [`specs/resource-manager/`](specs/resource-manager/) |
| Gestione servizi/interventi | `app-service-manager.js` | `views/service-manager/` | [`specs/service-manager/`](specs/service-manager/) |
| Smart Assistant | `app-smart-assistant.js` | `views/smart-assistant/` | [`specs/smart-assistant/`](specs/smart-assistant/) |
| Movimentazione consumabili | `app-stock-manager.js` | `views/stock-manager/` | [`specs/stock-manager/`](specs/stock-manager/) |
| Gestione magazzini | `app-warehouse-manager.js` | `views/warehouse-manager/` | [`specs/warehouse-manager/`](specs/warehouse-manager/) |
| WorkTable Explorer | `app-worktable-explorer.js` | `views/worktable-explorer/` | [`specs/worktable-explorer/`](specs/worktable-explorer/) |

Gli endpoint API del plugin hanno spec proprie sotto [`specs/api/`](specs/api/).

Una spec directory contiene:
- `use-case.md` — comportamento atteso (il "cosa"): goal, attori, scenario principale, flussi alternativi in stile Cockburn
- `design.md` — scelte tecniche (il "come"): state shape, tabelle coinvolte, logica di merge/verifica, payload

**La copertura non è ancora completa.** Allo stato attuale:

- senza `use-case.md`: `import-wizard`, `map-center`, `requests-board`, `resource-manager`, `worktable-explorer`
- senza `design.md`: nessuna

Quando si modifica una SPA la cui spec manca, scrivere il file mancante seguendo la struttura in §Specification Style prima o insieme alla modifica.

If implementation and specification disagree, report the discrepancy. Do not silently change behavior.

---

## Specification Style

When writing specs for a new or existing SPA, follow this exact structure.

### use-case.md — il "cosa"

Cockburn-style use case with the following sections, in order:

1. **Identificativo** — short code (UC-XXX) and one-line description
2. **Contesto di sistema** — where this SPA fits in the operational workflow (skip if standalone)
3. **Goal** — one paragraph, user-facing outcome
4. **Primary Actor** — who operates it
5. **Stakeholders e interessi** — table: stakeholder | interest
6. **Precondizioni** — bullet list
7. **Postcondizioni — Successo** — what is true after success
8. **Postcondizioni — Errore/Fallimento parziale** — what happens on partial failure
9. **Classificazione stati** *(if applicable)* — table mapping data conditions to UI labels (e.g. in servizio / non in servizio / dati incompleti)
10. **Main Success Scenario** — one sub-section per wizard step or view, with numbered steps describing actor actions and system responses
11. **Extensions** — coded as `Na.` (step N, alternative a), covering: empty states, API errors, validation failures, navigation guards, partial failures

Rules:
- Steps describe observable behavior, not implementation details
- Do not mention lit-html, state variables, or JS internals
- Do mention WorkTable table names, field names, and business rules
- Keep each step to one sentence where possible

### design.md — il "come"

Technical reference for implementors, with sections:

1. **Struttura** — wizard steps or views with ASCII flow diagram
2. **State shape** — full JS object with all keys and their types/defaults
3. **Tabelle coinvolte** — table: operation | WorkTable table name
4. **Logica di merge** *(if applicable)* — merge key, priority rules, field resolution strategy
5. **Payload** — exact field names and values written to each table
6. **Logica di classificazione** *(if applicable)* — code-level rules for categorizing records
7. **Altre note tecniche** — anything else an agent needs to preserve: loading strategy (`allSettled` vs `all`), draft editing pattern, sequence API usage, filter strategy, non-obvious guard conditions

Rules:
- Use code blocks for state shape, payload examples, and classification logic
- Use tables for tabelle coinvolte
- Use WorkTable API field names (hyphenated, e.g. `data-fine-attestato`, not camelCase)
- Note divergences from the general patterns documented in this AGENTS.md

---

## Core Principles

### 1. Deterministic behavior

Generated code must behave predictably across reloads, repeated operations, pagination changes, filtering, sorting, and editing flows.

Avoid hidden state transitions and implicit side effects.

### 2. State safety

State must be explicit and reset when the active context changes.

Examples of context changes:

* selected table
* selected tab
* selected organization
* selected event
* selected record id
* editor mode
* wizard step

Do not reuse stale drafts or stale API responses across contexts.

### 3. Backward compatibility

Prefer additive changes.

Do not rename existing state keys, API fields, table names, or DOM assumptions unless explicitly instructed.

Do not remove existing behavior without a matching specification change.

### 4. No speculative refactors

Do not rewrite working code for style, abstraction, or framework preference.

Only refactor when required by the requested behavior or when explicitly instructed.

### 5. Explicit over generic

Prefer explicit mappings and configuration objects over generic magic.

Examples:

* explicit table names
* explicit field lists
* explicit label overrides
* explicit filterable columns
* explicit derived-field rules

---

# Frontend Runtime

## Rendering

Use `lit-html` templates.

Do not introduce:

* React
* Vue
* Angular
* Svelte
* Solid
* Alpine
* JSX build steps
* virtual DOM frameworks

Templates should be pure functions of state wherever possible.

## lit-html — `<select>` con valore dinamico

Il binding `.value` su un `<select>` **non è affidabile** in lit-html quando le opzioni sono dinamiche o caricate in modo asincrono. Il browser applica `.value` solo se l'opzione corrispondente esiste già nel DOM; se le opzioni arrivano dopo (es. fine chiamata API), il select ricade silenziosamente sul primo elemento.

**Regola:** usare sempre `?selected` su ogni `<option>`.

```js
// ❌ SBAGLIATO
html`<select .value=${current}>
  ${opts.map(o => html`<option value=${o}>${o}</option>`)}
</select>`

// ✅ CORRETTO
html`<select @change=${e => onChange(e.target.value)}>
  ${opts.map(o => html`<option value=${o} ?selected=${current === o}>${o}</option>`)}
</select>`
```

Questa regola si applica a tutti i `<select>` il cui valore o le cui opzioni dipendono da stato asincrono (servizi, mansioni, turni, categorie, ecc.).

## Styling

Use:

* Bulma CSS
* Remix Icons

Do not introduce additional UI frameworks unless explicitly requested.

## Layout

Use responsive, non-fragile layouts.

Prefer:

* `flex-wrap`
* `min-width: 0`
* Bulma utility classes
* compact forms and tables for administrative screens

Avoid fixed widths unless needed for compact action columns.

## Module loading

SPA modules may be dynamically imported.

When the existing application uses cache-busting imports, preserve that behavior.

Example:

```js
import(`./views/my-module/step${n}.js?v=${VERSION}`)
```

`VERSION` must come from `window.APP_CONFIG?.version` with `Date.now()` as fallback:

```js
const VERSION = window.APP_CONFIG?.version || Date.now();
```

Do not introduce a bundler requirement unless explicitly requested.

---

# SPA Entry Points

Each SPA lives in a single `app-<name>.js` file at the plugin root.

An entry point must:

1. Import `html` and `render` from lit-html, con il path relativo esatto usato da tutte le SPA:
   ```js
   import { html, render } from "../../../../camila/js/lit-html/lit-html.js";
   ```
2. Importare `./no-pull-refresh.js` (side effect: disabilita il pull-to-refresh sui totem Android).
   Tutte le SPA lo fanno tranne `app-import-wizard.js`.
   ```js
   import "./no-pull-refresh.js";
   ```
3. Define `VERSION` via `APP_CONFIG` or `Date.now()`
4. Obtain `root` via `document.getElementById("app")`
5. Check that `WorkTableClient` is available before proceeding
6. Initialize `client` via `WorkTableClient(window.APP_CONFIG || {})`
7. Define only the state properties the SPA actually uses
8. Call `mount()` to start rendering

Una SPA non è raggiungibile finché non viene registrata lato PHP: vedere §SPA Registration (wiring PHP).

Single-view SPAs (no wizard) must not carry unused `step`, `org`, or wizard state.

Wizard SPAs must guard each step transition: if required preceding state is missing, redirect back to step 1.

---

# SPA Registration (wiring PHP)

Il modulo JS da solo non è raggiungibile. Per una SPA con id `<id>` servono quattro innesti PHP, tutti nella root del plugin.

**1. `<id>.inc.php` — mount del modulo**

```php
<?php
$camilaUI = new CamilaUserInterface();
$dir = __DIR__;
$pluginName = basename($dir);

$camilaUI->mountMiniApp($pluginName, '/app-<id>.js', '/app.css');
```

**2. `dashboard_<id>.inc.php` — voce di dashboard**

```php
<?php
require('<id>.inc.php');
```

**3. `conf/menu.xml` — aggiungere `<id>` all'elenco `<pages>` del tab che lo ospita**

Il routing vive in `dashboards.inc.php`: `?dashboard=<id>` viene risolto in
`plugins/segreteria-campo/dashboard_<id>.inc.php`. Il default è `m0`.

**4. `dashboard_m0.inc.php` — pulsante di accesso**

```php
$camilaUI->insertButton('?dashboard=<id>', 'Etichetta visibile', 'icona-remix');
```

L'ultimo argomento è un nome di icona Remix **senza** prefisso `ri-` e senza suffisso
(`login-box`, `file-list-3`, `route`, `inbox`, …).

## Modalità totem

`dashboards.inc.php` e `dashboard_m0.inc.php` riconoscono l'utente totem con:

```php
$_isTotemUser = strncasecmp($_CAMILA['user'] ?? '', 'totem', 5) === 0;
```

Per un utente totem il menu di navigazione non viene stampato e `dashboard_m0.inc.php`
mostra un ramo alternativo con i soli pulsanti kiosk, con `&totem=1` in query string.
Lato JS la modalità si legge così:

```js
const totemMode = new URLSearchParams(window.location.search).get("totem") === "1";
```

Aggiungere una SPA al ramo totem solo se richiesto esplicitamente.

---

# Navigation

Navigation is usually manual and state-driven.

Allowed patterns:

* wizard-style `state.step`
* tab-based `state.activeTab`
* explicit `goTo(step)`
* full reload when browser history consistency is at risk

Avoid introducing a router framework.

Prefer full reload over complex history manipulation when consistency matters.

---

# Data Access

All WorkTable data access must use `WorkTableClient`.

Allowed table-bound operations:

```js
client.table(tableName).list(query)
client.table(tableName).read(id)
client.table(tableName).create(payload)
client.table(tableName).update(id, payload)
client.table(tableName).remove(id)
client.table(tableName).describe(query)
client.table(tableName).permissions(query)
client.table(tableName).sequence(query)
client.table(tableName).distinct(column, query)
client.table(tableName).uploadAttachment(id, file)
client.table(tableName).fetchAttachment(id)
client.table(tableName).hasAttachment(id)
client.table(tableName).listAttachments()
client.table(tableName).deleteAttachment(id)
client.table(tableName).attachmentUrl(id)
```

Allowed public operations:

```js
client.list(tableName, query)
client.read(tableName, id)
client.create(tableName, payload)
client.update(tableName, id, payload)
client.remove(tableName, id)
client.describe(tableName, query)
client.permissions(tableName, query)
client.sequence(tableName, query)
client.distinct(tableName, column, query)
client.tables(query)
client.importTable(name, filepath, sheet)
client.importTableUpload(name, file, sheet)
client.call(method, path, body, query)
client.filter(column, operator, ...values)
client.negate(operator)
```

Do not introduce alternative API clients or abstraction layers unless explicitly requested.

## Endpoint custom del plugin

Gli endpoint non-CRUD vivono in `api/handlers.inc.php`, che ritorna una mappa
`"<VERB> /<path>" => handler`. Base path lato client:
`/app/segreteriacampo/cf_api.php/segreteria-campo`.

```php
// privato (sessione Camila)
'GET /status' => function(array $params, ?array $body, array $path): array {
    return ['status' => 'ok'];
},

// pubblico (auth propria, es. Basic Auth)
'POST /telegram/webhook' => [
    'public'  => true,
    'handler' => function(array $params, ?array $body, array $path): array { ... },
],
```

Regole:

* un handler ritorna sempre un array; `__status` imposta lo status HTTP
  (`['__status' => 500, 'message' => '...']`)
* `'public' => true` disattiva il controllo di sessione: l'handler deve allora
  implementare la propria autenticazione (vedere `/radio/*`, Basic Auth con
  credenziali da `var/segreteria-campo-*.json`)
* passare ogni testo libero in `sc_utf8_sanitize()` prima dell'insert: le colonne
  sono `utf8`, non `utf8mb4`, e i caratteri a 4 byte (emoji) fanno fallire la query
* accesso DB tramite `CamilaWorkTable` + `$_CAMILA['db']`; i nomi worktable nelle
  query SQL usano la sintassi `${NOME TABELLA.NOME COLONNA}`

Lato SPA si chiamano con `client.call()`:

```js
const res = await client.call("GET", "/segreteria-campo/totem/organization-codes");
```

Endpoint attuali: `/telegram/webhook`, `/totem/organization-codes`, `/radio/health`,
`/radio/messages`, `/import/examples`, `/status`. Spec in [`specs/api/`](specs/api/).

## Operazioni già in uso

Queste non sono estensioni da introdurre: fanno già parte della superficie esercitata dalle SPA esistenti.

| Operazione | Usata da |
|---|---|
| `sequence()` | `views/massive-check-in/step6.js`, `views/resource-manager/step2.js` — prefill di id progressivi |
| `call()` | lookup codice totem in check-in / check-out / org-status; `views/smart-assistant/home.js` |
| allegati | `views/worktable-explorer/index.js` — upload da fotocamera, preview via blob URL, delete |
| `importTable*`, `tables()` | `app-import-wizard.js` |
| `permissions()` | `views/resource-manager/step1.js` (unica SPA con read-only fallback) |

---

# WorkTable Query Rules

## Listing records

```js
client.table(tableName).list({
  include,    // string | string[]  — campi da restituire
  exclude,    // string | string[]  — campi da escludere
  filters,    // Array              — filtri AND (vedi §Filtering)
  orFilters,  // Object             — filtri OR (vedi §Filtering)
  order,      // Array              — ordinamento (vedi §Sorting)
  size,       // number             — max righe senza paginazione
  page,       // number | number[]  — paginazione (vedi §Pagination)
})
```

### include / exclude

```js
// array di nomi campo
client.table("servizi").list({ include: ["nome", "ordine", "colore"] })

// stringa separata da virgola (equivalente)
client.table("servizi").list({ include: "nome,ordine,colore" })

// escludere campi pesanti
client.table("servizi").list({ exclude: ["note", "descrizione"] })
```

### size

Usare `size` solo quando la paginazione non serve. Imposta il massimo di righe restituite in una sola chiamata.

```js
client.table("servizi").list({ size: 9999 })   // tutti i record
client.table("brogliaccio").list({ size: 1 })  // solo 1 record
```

## Sorting

Usare l'ordinamento server-side tramite il parametro `order`.

**Formato:** array di array `[campo, direzione]`

```js
// un solo campo
order: [["data/ora", "desc"]]

// più campi
order: [["cognome", "asc"], ["nome", "asc"]]
```

Direzioni supportate: `"asc"` | `"desc"`

**Esempio pratico — ultimo record inserito:**

```js
client.table("brogliaccio").list({
  include: ["data/ora"],
  size: 1,
  order: [["data/ora", "desc"]]
})
```

Se l'ordinamento server-side non è supportato dalla tabella, ordinare client-side con un sort stabile usando l'indice originale come tiebreaker.

## Filtering

Costruire filtri con `client.filter(column, operator, value)` che ritorna un array `[column, operator, value]`.

Passare i filtri come array al parametro `filters` (AND logico):

```js
client.table("volontari").list({
  filters: [client.filter("servizio", "eq", "TURNO A")]
})
```

**⚠️ IMPORTANTE:** usare sempre `filters: [...]` — la sintassi `filter: { campo: valore }` è silenziosamente ignorata dal client.

### Operatori confermati

| Operatore | Significato |
|---|---|
| `eq` | uguale |
| `neq` | diverso (`negate("eq")`) |
| `cs` | contiene stringa (case-sensitive) |
| `sw` / `ew` | inizia con / finisce con |
| `gt` / `gte` | maggiore di / maggiore o uguale |
| `lt` / `lte` | minore di / minore o uguale |
| `is` | IS NULL (`"null"`) / IS NOT NULL (`"notnull"`) |
| `in` | in lista (valori multipli) |
| `bt` | between (due valori) |

Per negare un operatore: `client.negate("eq")` → `"neq"`

In pratica le SPA esistenti usano **solo `eq`**. Gli altri operatori sono supportati
dal client ma non ancora esercitati contro queste tabelle: verificare il risultato
prima di darlo per acquisito.

Riferimento completo del client: [`specs/api/worktable-client.md`](specs/api/worktable-client.md).

### Filtri OR

Passare i filtri OR tramite il parametro `orFilters` (oggetto con chiavi `filter1`, `filter2`, ...):

```js
orFilters: {
  filter1: ["campo", "eq", "valoreA"],
  filter2: ["campo", "eq", "valoreB"],
}
```

## Pagination

```js
// pagina 1, 50 record per pagina → ?page=1,50
page: [1, 50]

// oppure solo numero di pagina
page: 2
```

**Risposta paginata attesa:**

```json
{
  "records": [...],
  "results": 150
}
```

`records` = record della pagina corrente. `results` = totale record senza paginazione.

Normalizzare sempre la risposta con:

```js
function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}
```

## Distinct values vs list with include

Usare `distinct()` per valori deduplicati su una singola colonna:

```js
client.table("volontari").distinct("codice-organizzazione", {
  include: "codice-organizzazione,organizzazione"
})
```

Usare `list()` con `include` e `size` quando serve unire sorgenti multiple o il distinct non espone tutti i campi necessari:

```js
client.table(tableName).list({
  include: ["organizzazione", "codice-organizzazione", "provincia"],
  size: 5000
})
```

When merging from multiple sources, use a `Map` keyed on a stable composite key to deduplicate:

```js
const map = new Map();
for (const row of rows) {
  const key = [norm(row.org), norm(row.code)].join("|");
  if (!map.has(key)) map.set(key, row);
}
```

Distinct values should be cached in state and reused across tabs or steps when appropriate.

## Parallel loading with partial fallback

When loading from multiple tables in parallel, use `Promise.allSettled` so that one failure does not block the other results:

```js
const results = await Promise.allSettled([
  withRetry(() => loadFromTableA(client)),
  withRetry(() => loadFromTableB(client))
]);

const dataA = results[0].status === "fulfilled" ? results[0].value : [];
const dataB = results[1].status === "fulfilled" ? results[1].value : [];

const failures = results.filter(r => r.status === "rejected");
if (failures.length) {
  error = normalizeApiError(failures[0].reason);
}
```

## Permissions

Use permissions to determine whether create, update, and delete actions are enabled.

Example response:

```json
{
  "table": "eventi",
  "id": "1",
  "can": {
    "create": true,
    "read": true,
    "update": true,
    "delete": true
  }
}
```

If the permissions request fails, the UI must enter read-only mode.

Create, edit, and delete actions must be disabled or hidden in read-only mode.

---

# Error Handling

Every API operation must handle failure.

At minimum:

* show an error message
* avoid corrupting state
* keep the UI usable when possible

## Error normalization

Normalize all API errors into a standard shape before using them in UI logic:

```js
function normalizeApiError(err) {
  const raw = err?.payload ?? err?.response ?? err;

  const status = raw?.status ?? raw?.statusCode ?? err?.status ?? err?.statusCode;
  const code = raw?.code ?? err?.code ?? raw?.error?.code;
  const message =
    raw?.message ?? err?.message ?? raw?.error?.message ??
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
```

`kind` values: `auth`, `not_found`, `rate_limit`, `server`, `timeout`, `network`, `unknown`.

Map `kind` to user-visible text in a dedicated helper:

```js
function userFriendlyErrorText(e) {
  switch (e.kind) {
    case "auth":    return "Sessione scaduta o permessi insufficienti.";
    case "rate_limit": return "Troppe richieste. Attendi e riprova.";
    case "timeout":
    case "network": return "Problema di connessione. Controlla la rete.";
    case "server":  return "Il server sta avendo problemi. Riprova tra poco.";
    case "not_found": return "Risorsa non trovata.";
    default:        return "Si è verificato un errore durante il caricamento.";
  }
}
```

Always show a retry button alongside error messages in load contexts.

## Retry with exponential backoff

Retry transient failures (network, timeout, server, rate_limit) with exponential backoff:

```js
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
      await sleep(baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 150));
    }
  }
  throw last;
}
```

Do not retry `auth` or `not_found` errors.

## Permission lookup failure

If the permissions request fails, fall back to read-only mode.

Catalog lookup failure should not block basic page rendering:

* show fallback option
* show error help text when useful

---

# Async render safety

When an async load is in-flight and the user navigates away or changes context, avoid re-rendering into a stale root.

Use a `cancelled` flag:

```js
let cancelled = false;

async function load() {
  // ...
  if (!cancelled) rerender();
}

// on context change or cleanup:
cancelled = true;
```

This prevents stale async callbacks from overwriting a new view.

---

# State Management

## General rules

Use plain JavaScript state objects.

Do not introduce:

* Redux
* Zustand
* MobX
* Pinia
* external state machines
* implicit global stores

## State shape

Define only the state properties that the SPA actually uses.

Preserve existing state shape across modifications.

Prefer additive properties.

Example:

```js
state.step1 ||= {};
state.step2 ||= {};
state.master ||= {};
```

## Context reset

Reset or invalidate state when context changes.

Examples:

* changing tab resets pagination page
* changing filter resets pagination page
* changing sort resets pagination page
* changing editor record resets draft
* saving a record invalidates list cache

## Draft editing

Editors must use a draft object separate from the persisted base row.

Example:

```js
state.step2.baseRow
state.step2.draftRow
```

Do not mutate persisted rows directly while editing.

## Dirty detection

Dirty state should compare base and draft deterministically.

Use stable serialization or explicit field comparison.

---

# UI Behavior

## Lists

List pages should support:

* loading state
* empty state
* error state
* pagination when needed
* sorting
* filtering
* permission-aware actions

Filters and pagination controls must remain visible even when no records are returned.

## Tables

Administrative tables should usually be compact.

Recommended Bulma classes:

```html
<table class="table is-small is-narrow is-fullwidth is-hoverable is-striped">
```

Action buttons may be placed in the first column.

Use icons consistently:

* edit: `ri-pencil-line`
* delete: `ri-delete-bin-6-line`
* add: `ri-add-line`
* save: `ri-save-line`
* back: `ri-arrow-left-line`
* read-only: `ri-lock-line`

## Forms

Forms must use controlled values.

Each visible field must read from state and write back to state.

Do not rely on uncontrolled DOM state.

## Derived fields

Derived fields must be explicit.

Example:

* user selects organization name
* frontend stores `organizzazione`
* frontend derives and stores `codice-organizzazione`

Derived fields must be kept synchronized in UI and before save.

If a selected value is no longer present in the catalog, render it as out-of-list rather than dropping it silently.

---

# CRUD Rules

## Create

Create actions must:

1. initialize a clean draft
2. populate required derived fields
3. call `create(payload)`
4. invalidate affected list cache
5. navigate back or refresh deterministically

## Update

Update actions must:

1. load the record by id
2. create a draft copy
3. save only after explicit user action
4. call `update(id, payload)`
5. invalidate affected list cache

## Delete

Delete actions must:

1. require explicit confirmation
2. call `remove(id)`
3. refresh or invalidate the list
4. handle empty page after deletion

Do not perform optimistic deletion.

---

# Security and Safety

Do not bypass permission checks in the frontend.

Frontend permissions are a UX guard only. Backend authorization remains authoritative.

Do not expose secrets or API keys in generated code.

Do not log sensitive payloads unless explicitly requested.

---

# Specification-Driven Development

Agents must consult project specifications before changing behavior.

Struttura effettiva:

```text
AGENTS.md
specs/
  <app-id>/
    use-case.md
    design.md
  api/
    worktable-client.md
    <endpoint-id>/
      use-case.md
      design.md
```

Use:

* `use-case.md` for product behavior (il "cosa")
* `design.md` for implementation decisions (il "come")

Il formato dei due file è definito in §Specification Style. In questo repository non
esistono `requirements.md`, `tasks.md` né `uispec/*.yaml`: non crearli e non cercarli.

If implementation and specification disagree, report the discrepancy.

Do not silently change behavior.

---

# Testing Expectations

For each generated or modified SPA page, verify:

* initial load
* empty list
* paginated list
* sorting
* filtering
* create permission
* update permission
* delete permission
* read-only fallback
* create flow
* edit flow
* delete flow
* API failure handling
* retry behavior
* derived field synchronization
* async render safety (no stale re-render after navigation)

Acceptance criteria should be derived from the SPA's `use-case.md` (sezioni Main Success Scenario ed Extensions) when available.

---

# Code Style

Prefer readable, explicit code.

Avoid excessive abstraction.

Use small helper functions for:

* response normalization (`getRecords`)
* error normalization (`normalizeApiError`)
* user-facing error text (`userFriendlyErrorText`)
* retry logic (`withRetry`)
* permission normalization
* pagination state
* stable sorting
* field derivation
* catalog loading

Keep helper behavior deterministic.

---

# Unknowns

Do not invent missing behavior.

If something is unknown:

* mark it as unknown in the specification
* ask for clarification when necessary
* otherwise implement the safest conservative behavior

Safe conservative defaults:

* read-only if permissions are unknown
* empty catalog if distinct lookup fails
* no mutation if record id is missing
* no destructive action without confirmation

---

# Non Goals

Do not introduce:

* frontend framework migrations
* global state managers
* optimistic sync
* speculative server validation
* hidden API conventions
* unrelated UI redesigns
* large-scale rewrites

without explicit instruction.
