# CAMILA WorkTable SPA Development Guide

## Purpose

This repository contains lightweight Single Page Applications integrated with CAMILA WorkTable APIs.

AI agents working in this repository must generate and modify SPA modules that are deterministic, state-safe, backward-compatible, and easy to review.

The primary goal is to evolve existing administrative tools without introducing unnecessary framework complexity or speculative architecture changes.

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

1. Import `html` and `render` from `lit-html`
2. Define `VERSION` via `APP_CONFIG` or `Date.now()`
3. Obtain `root` via `document.getElementById("app")`
4. Check that `WorkTableClient` is available before proceeding
5. Initialize `client` via `WorkTableClient(window.APP_CONFIG || {})`
6. Define only the state properties the SPA actually uses
7. Call `mount()` to start rendering

Single-view SPAs (no wizard) must not carry unused `step`, `org`, or wizard state.

Wizard SPAs must guard each step transition: if required preceding state is missing, redirect back to step 1.

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
client.table(tableName).distinct(column, query)
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
client.distinct(tableName, column, query)
client.filter(column, operator, ...values)
client.negate(operator)
```

Do not introduce alternative API clients or abstraction layers unless explicitly requested.

---

# WorkTable Query Rules

## Listing records

Use:

```js
client.table(tableName).list({
  filters,
  order,
  page
})
```

Additional supported parameters:

| Parameter | Type | Description |
|---|---|---|
| `include` | string or array | Comma-separated or array of column names to fetch |
| `size` | number | Max rows without pagination (use only when paging is not needed) |

When backend pagination follows CAMILA format, use:

```js
page: [pageNumber, pageSize]
```

which produces:

```text
?page=1,50
```

Expected paginated response shape:

```json
{
  "records": [],
  "results": 0
}
```

`records` contains the current page.
`results` contains the total number of records without pagination.

Always normalize the response with a helper to handle both array and paginated shapes:

```js
function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}
```

## Sorting

Use server-side sorting when supported:

```js
order: [[field, direction]]
```

where direction is:

```text
asc | desc
```

Sorting must remain deterministic.

If client-side sorting is required, it must be stable and must use original index as a tie-breaker.

## Filtering

Use WorkTable filters:

```js
client.filter(column, operator, value)
```

Typical filters:

```js
client.filter("codice-organizzazione", "eq", selectedOrgCode)
client.filter("nome", "cs", searchValue)
```

Do not invent filter operators.

If an operator is not confirmed, document it as unknown.

## Distinct values vs list with include

Use `distinct()` when you need deduplicated values for a single column or a tightly related set:

```js
client.table("db-volontari").distinct("codice-organizzazione", {
  include: "codice-organizzazione,organizzazione"
})
```

Use `list()` with `include` and `size` when you need to load, merge, and deduplicate records from multiple tables or when the distinct API does not expose all required fields:

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

Recommended structure:

```text
AGENTS.md
specs/
  <app-id>/
    requirements.md
    design.md
    tasks.md
    uispec/
      <page-id>.yaml
```

Use:

* `requirements.md` for product behavior
* `design.md` for implementation decisions
* `tasks.md` for implementation checklist
* `uispec/*.yaml` for page-level behavior contracts

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

Acceptance criteria should be derived from UISpec when available.

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
