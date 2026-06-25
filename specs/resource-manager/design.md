# Design — resource-manager

**Pulsante dashboard:** "Database Risorse"

## 1. Struttura

Wizard a 2 step. Step 1 = lista paginata con filtri e editing inline. Step 2 = form completo per creazione e modifica.

```
[Step 1 — lista]
  [Titolo "Database Risorse"           | Pulsante Aggiungi]
  [Tab: Volontari · Mezzi · Materiali                    ]
  [Box filtri: Organizzazione · Filtro colonna · Per pagina]
  [Barra risultati: "Mostrati X–Y di T"    | ‹ N/M ›    ]
  [Tabella: col ordinabili · dblclick cella → edit inline]
    [ ✏ 🗑 | col1 | col2 | … ]
    …
  (nessuna paginazione in fondo: i controlli sono sopra)

[Step 2 — form]
  [Titolo: "Modifica risorsa" / "Nuova risorsa" | Salva · Annulla]
  [Campi della categoria attiva                               ]
```

## 2. Navigazione

```js
goTo(1)   // lista (default)
goTo(2)   // form — richiede state.editTab, state.editId, state.editMode
```

`state.editMode` = `"create"` | `"edit"`.
Se `editMode === "edit"`, il form carica la riga esistente tramite `editId`.
Se `editMode === "create"`, il form è vuoto (con prefill `id-materiale` via `.sequence()` per la tab materiali).

## 3. Parametro URL

`?tab=volontari` | `?tab=mezzi` | `?tab=materiali` apre direttamente la tab corrispondente al mount. Valori non riconosciuti vengono ignorati; default: `volontari`.

## 4. Tabelle coinvolte

| Tab | Tabella WorkTable |
|---|---|
| Volontari | `db-volontari` |
| Mezzi | `db-mezzi` |
| Materiali | `db-materiali` |

## 5. Colonne

### Colonne preferite (ordine fisso)

**Volontari:**
`codice-fiscale, cognome, nome, data-di-nascita, luogo-di-nascita, cellulare, organizzazione, codice-organizzazione, provincia`

**Mezzi:**
`targa, codice-inventario, codice-inventario-regionale, codice-inventario-provinciale, categoria, tipologia, note, marca, modello, note-ulteriori, organizzazione, codice-organizzazione, provincia, proprietario`

**Materiali:**
`id-materiale, codice-inventario, codice-inventario-regionale, codice-inventario-provinciale, categoria, tipologia, note, marca, modello, note-ulteriori, organizzazione, codice-organizzazione, provincia, proprietario`

Le colonne extra (presenti nei record ma non nell'elenco preferito) vengono accodate in ordine alfabetico.

### Colonne nascoste (sempre escluse dalla vista)

`id`, `uuid`, `id2`

### Colonne in sola lettura inline

`provincia`, `codice-organizzazione` — derivate automaticamente dalla selezione `organizzazione`; non modificabili con doppio click.

## 6. State shape

```js
// state condiviso tra i due step
{
  step: 1 | 2,
  activeTab:  "volontari" | "mezzi" | "materiali",
  editTab:    String,     // tab del record in step2
  editId:     String | null,
  editMode:   "create" | "edit",
  master:     { volontari: Array | null, mezzi: Array | null, materiali: Array | null },
  // master = cache della pagina corrente (sostituita ad ogni fetch server-side)

  step1: {
    activeTab:               String,
    orgCatalog:              Array<{ code, name }> | null,
    orgCatalogLoaded:        Boolean,
    orgCatalogError:         String | null,
    provinceCatalog:         Array<String> | null,
    provinceCatalogLoaded:   Boolean,
    provinceCatalogError:    String | null,
    orgProvinceByCode:       { [code]: provincia } | null,

    sortByTab:        { volontari: { key, dir }, mezzi: ..., materiali: ... },
    paginationByTab:  { volontari: PagState, mezzi: ..., materiali: ... },
    columnFilterByTab: { volontari: FilterState, mezzi: ..., materiali: ... },
    permissionsByTab:  { volontari: Perms | null, ... },
    readOnlyGlobal:   Boolean,

    inlineEdit:  InlineEditState | null,
    skipFetch:   Boolean,   // true = ensureLoaded usa cache, non chiama server
  },

  step2: {
    loadedKey:       String | null,
    draftRow:        Object | null,
    saving:          Boolean,
    error:           Any | null,
    sequenceLoadedKey:  String | null,   // per prefill id-materiale
    sequenceError:   String | null,
    // catalogs (stessi di step1, condivisi via state.step1)
  }
}

// PagState
{ page: Number, size: Number, total: Number, totalPages: Number, hasNext: Boolean }

// FilterState
{ col: String, op: "cs", val: String }

// Perms
{ canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean, canRead: Boolean }

// InlineEditState — singola cella
{ rowId: String, col: String, val: String, saving: Boolean, error: String | null }

// InlineEditState — overlay categoria/tipologia
{
  rowId:     String,
  col:       "cat-tip",
  tab:       "mezzi" | "materiali",
  categoria: String,
  tipologia: String,
  saving:    Boolean,
  error:     String | null,
  anchorX:   Number,   // px dal bordo sinistro viewport
  anchorY:   Number,   // px dal bordo superiore viewport
}
```

## 7. Paginazione e filtri (server-side)

```js
// Filtri inviati al server:
// 1. organizzazione: eq sul campo codice-organizzazione (se != "all")
// 2. colonna libera: cs (contains) sul campo selezionato

table.list({
  filters: [...],
  order:   [[colonna, "asc" | "desc"]],
  page:    [pageNumber, pageSize],
})
// res.results = totale record (per calcolo pagine)
// res.records = array record pagina corrente
```

### Filtri disponibili per tab

**Tutti i tab:**
- Organizzazione (`eq` su `codice-organizzazione`)
- Filtro testo libero (`cs` su colonna selezionabile)

**Solo Mezzi e Materiali** (select in testata):
- Categoria (`eq`) — opzioni da `MEZZI_CAT_OPT` / `MAT_CAT_OPT`
- Tipologia (`eq`) — se una categoria è selezionata mostra solo le sue voci; altrimenti mostra tutte in ordine alfabetico. Cambiare categoria azzera il filtro tipologia.

Colonne filtrabili per tab (filtro testo libero):
- **volontari:** `codice-fiscale, cognome, nome, organizzazione`
- **mezzi:** `targa, marca, modello, categoria, tipologia, organizzazione`
- **materiali:** `id-materiale, categoria, tipologia, marca, modello, organizzazione`

## 8. Editing inline (step 1, doppio click su cella)

### Campi con gestione speciale

| Campo | Comportamento |
|---|---|
| `organizzazione` | Select dal catalogo `db-volontari.distinct`. Al salvataggio scrive anche `codice-organizzazione` e `provincia` (ricavati dalla mappa `orgProvinceByCode`). |
| `categoria` + `tipologia` (mezzi e materiali) | Overlay fisso con due tendine dipendenti (vedi §9). |
| `data-di-nascita` | `<input type="date">`. |
| `provincia`, `codice-organizzazione` | Sola lettura (nessun editing inline). |
| tutti gli altri | `<input type="text">`. Enter = salva · Escape = annulla · blur = salva. |

### Commit

```js
client.table(tabella).update(rowId, payload)
// payload = { [col]: val, ...extra }
// extra usato per organizzazione (codice-organizzazione, provincia)
//       e per cat-tip (categoria + tipologia insieme)
```

Dopo il commit, la riga viene aggiornata nella cache locale (`state.master[tab]`) senza refetch, poi `refresh()` aggiorna il DOM.

### Flag `skipFetch`

`state.step1.skipFetch = true` prima di ogni `refresh()` innescato da editing inline impedisce a `ensureLoaded` di fare una nuova chiamata server, riutilizzando la cache. Il flag viene resettato a `false` dentro `ensureLoaded` al prossimo ciclo che non è di editing.

## 9. Overlay categoria/tipologia

Si apre con doppio click su qualsiasi cella `categoria` o `tipologia` di un record mezzi o materiali.

```
┌──────────────────────────────┐
│ Categoria  [select ▼]        │
│ Tipologia  [optgroup select ▼]│
│                 [Annulla] [Salva] │
└──────────────────────────────┘
```

- **Categoria select**: lista completa delle categorie (`MEZZI_CAT_OPT` o `MAT_CAT_OPT`).
- **Tipologia select**: `<select>` con `<optgroup>` per ogni categoria, mostra tutte le tipologie. Se categoria = "Non assegnata" → campo disabilitato con valore fisso "Non assegnata".
- **Dipendenza bidirezionale**:
  - Cambio categoria → tipologia si resetta a `""` (vuoto) o `"Non assegnata"` se categoria = "Non assegnata".
  - Cambio tipologia → categoria si aggiorna automaticamente per reverse lookup nella mappa `byCat`.
- **Backdrop**: `div position:fixed;inset:0` con `@click` → annulla. Click sull'overlay stesso ha `stopPropagation`.
- **Escape** ovunque nell'overlay → annulla.
- **Salva** invia `{ categoria, tipologia }` in un unico `update`.

### Opzioni mezzi

Categorie: `Non assegnata, Imbarcazioni, Mezzi aerei, Mezzi speciali, Rimorchi, Veicoli`

Tipologie per categoria (esempi principali):
- Imbarcazioni: Barca, Gommone, Hovercraft, Moto d'acqua
- Mezzi aerei: Aeroplano, Drone, Elicottero, Idrovolante, ULM
- Mezzi speciali: Battipista, Bobcat, Escavatore, Motoslitta, Muletto, Spazzaneve…
- Rimorchi: Biga, Carrello, Rimorchio, Roulotte, Semirimorchio…
- Veicoli: Ambulanza, Autobus, Autocarro, Autovettura, Furgone, Motociclo…

### Opzioni materiali

Categorie derivate da `MATERIALI_TIPOLOGIE_OPTS` (stessa stringa usata in step2):
`Non assegnata, Attrezzature speciali, Attrezzi vari, Container, Effetti letterecci, Generatori, Materiale AIB, Materiale antinquinante, Materiale elettrico, Materiale idraulico e idrogeologico, Radio e dispositivi TLC, Tende`

Tipologie: select con optgroup (lista completa in `MATERIALI_TIPOLOGIE_OPTS`).

## 10. Permissions

Lette tramite `client.table(tabella).permissions()` (o `client.permissions(tabella)` come fallback). Normalizzate con `normalizePermissionsPayload()`. Cache per tab in `state.step1.permissionsByTab`. Se nessuna API di permissions è disponibile, `state.step1.readOnlyGlobal = true`.

In sola lettura: pulsanti Aggiungi, Modifica e Elimina disabilitati, editing inline bloccato, cursore normale sulle celle.

## 11. Catalogo organizzazioni

Caricato una volta sola con:
```js
client.table("db-volontari").distinct("codice-organizzazione", {
  include: "codice-organizzazione,organizzazione,provincia"
})
```

Popola:
- `state.step1.orgCatalog` — `Array<{ code, name }>` ordinato per code
- `state.step1.provinceCatalog` — province distinte ordinate alfabeticamente
- `state.step1.orgProvinceByCode` — `{ [code]: provincia }` per auto-fill inline

## 12. Step 2 — form completo

Usato per creazione e modifica. Mantiene un `draftRow` con le modifiche in corso. Al salvataggio chiama `.create(payload)` o `.update(id, payload)` in base a `editMode`. Dopo il salvataggio torna a step 1 e invalida la cache (`state.master[tab] = null`).

Campi gestiti con logica speciale in step 2:
- `organizzazione` → select + auto-fill `codice-organizzazione` e `provincia`
- `categoria` (mezzi) → select; cambio resetta `tipologia`
- `tipologia` (mezzi) → select filtrata per `categoria`; disabilitata se categoria = "Non assegnata"
- `categoria` (materiali) → select; stessa logica
- `tipologia` (materiali) → select con optgroup (stessa `MATERIALI_TIPOLOGIE_OPTS`)
- `targa` (mezzi, create) → normalizzata in uppercase
- `codice-fiscale` (volontari, create) → normalizzato in uppercase
- `id-materiale` (materiali, create) → pre-fill con `client.table("db-materiali").sequence()`

## 13. File

| File | Ruolo |
|---|---|
| `app-resource-manager.js` | Entry point: spinner di caricamento, routing step 1/2, showError |
| `views/resource-manager/step1.js` | Lista con filtri, paginazione, editing inline |
| `views/resource-manager/step2.js` | Form creazione/modifica |
| `views/resource-manager/assets/mezzi-marche.txt` | Lista marche mezzi per autocomplete |
| `resource-manager.inc.php` | Mount SPA (`mountMiniApp`) |
| `dashboard_resource-manager.inc.php` | Alias per dashboard (`require resource-manager.inc.php`) |
