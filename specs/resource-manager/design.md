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

### Layout box filtri

Flex fisso senza wrap (`is-flex`, no `is-flex-wrap-wrap`). Larghezze fisse per ogni controllo; solo il campo "Filtro per colonna" cresce (`flex:1`):

| Controllo | Larghezza |
|---|---|
| Organizzazione | 200px |
| Categoria *(solo Mezzi e Materiali)* | 160px |
| Tipologia *(solo Mezzi e Materiali)* | 200px |
| Filtro per colonna | `flex:1` |
| Per pagina | 90px |

### Filtri server-side

Tutti applicati insieme in `buildFilters(tab)` e inviati al server via `table.list({ filters: [...] })`.

| Filtro | Campo | Operatore | Tab |
|---|---|---|---|
| Organizzazione | `codice-organizzazione` | `eq` | tutti |
| Categoria | `categoria` | `eq` | mezzi, materiali |
| Tipologia | `tipologia` | `eq` | mezzi, materiali |
| Filtro colonna | qualsiasi colonna visibile | `cs` | tutti |

**Filtro Categoria:** opzioni da `MEZZI_CAT_OPT` / `MAT_CAT_OPT`. Cambiare categoria azzera il filtro tipologia e resetta la pagina.

**Dove vive il vocabolario di categoria/tipologia.** Nelle `listbox_options`
delle colonne omonime di `mezzi` e `materiali`, lette a runtime da
`describe()` tramite `views/shared/vocabularies.js`. Non c'e' piu' una copia
nelle viste: vedi [`specs/api/describe/`](../api/describe/).

```js
const { loadCatalog } = await import(`../shared/vocabularies.js?v=${VERSION}`);
const [mezziCat, materialiCat] = await Promise.all([
  loadCatalog(client, "mezzi"),
  loadCatalog(client, "materiali")
]);
const MEZZI_CAT_OPT = mezziCat.categories;
const MEZZI_TIP_OPT = mezziCat.byCat;
```

Se il describe non risponde, o risponde senza la configurazione Camila, il
modulo ritorna la propria copia di riserva: le tendine non restano mai vuote. I mezzi gia' registrati con etichette non piu'
in elenco restano fuori lista e vengono mostrati come tali, non scartati.

## 7b. Ricerca rapida unificata

Un campo sopra la tab bar che cerca **in tutte e tre le schede insieme**, elenca
i risultati e, al clic, apre il record nel form completo.

### Perché in memoria e non server-side

Il filtro per colonna (§7) è server-side e cerca su **una** colonna alla volta:
per trovare un volontario bisogna prima scegliere se cercare per cognome o per
codice fiscale. La ricerca rapida cerca su più campi e su tutte e tre le
tabelle, quindi server-side avrebbe richiesto `orFilters` — mai esercitato
contro queste tabelle — e si sarebbe scontrata con due ostacoli: l'operatore
`cs` è **case-sensitive**, e mischiare filtri AND (organizzazione) e OR
(ricerca) nella stessa richiesta ha semantiche non verificate.

In memoria il confronto è normalizzato (minuscole, accenti rimossi), quindi
"rossi" trova "ROSSI" e "nicolo" trova "NICOLÒ".

### Caricamento

```js
state.step1.quickSearch = { q, loading, loaded, error, rows: { volontari, mezzi, materiali } }
```

**Pigro**: le tre `list({ size: 9999 })` partono alla prima query lunga almeno
`SEARCH_MIN` (2) caratteri, non al mount — la pagina si apre spesso solo per
sfogliare una scheda.

`Promise.allSettled`: se un catalogo non si carica si cerca negli altri due e si
mostra un avviso di risultati parziali, invece di non cercare affatto.

Lo stato vive in `state`, non nella closure: tornando dal form completo la
ricerca e i risultati sono ancora lì.

### Campi cercati

```js
SEARCH_FIELDS = {
  volontari: ["cognome", "nome", "codice-fiscale", "organizzazione"],
  mezzi:     ["targa", "codice-inventario", "marca", "modello", "organizzazione",
              "categoria", "tipologia", "note"],
  materiali: ["id-materiale", "codice-inventario", "marca", "modello", "organizzazione",
              "categoria", "tipologia", "note"],
}
```

Esplicito, non "tutte le colonne": l'elenco deve restare allineato a quello che
le tabelle hanno davvero. **`db-volontari` non ha `categoria`, `tipologia` né
`note`** — il suo form si ferma a codice fiscale, anagrafica, cellulare e
organizzazione — quindi quei tre campi compaiono solo sotto mezzi e materiali.

`note-ulteriori` esiste su entrambe ma è fuori dall'elenco: si aggiunge qui se
serve.

Cercare dentro `note` allarga parecchio i risultati, ed è voluto. L'ordinamento
per identificativo (sotto) regge il colpo: chi digita una targa la trova in cima
anche se il termine compare nelle note di altri venti record.

### Risultati

Ordinati mettendo davanti le righe il cui identificativo **inizia** con il
termine: digitando una targa, quella esatta sta in cima e non ventesima. Ne
vengono resi `SEARCH_SHOWN` (12); il resto è dichiarato come conteggio con
l'invito a restringere.

Ogni riga porta il tag della scheda di appartenenza (Volontari / Mezzi /
Materiali), perché i risultati arrivano da tre tabelle diverse, e — per mezzi e
materiali — due badge con **categoria** e **tipologia**: sono i due campi che
distinguono record altrimenti identici, tipo un materiale senza targa
identificato dal solo codice inventario. I badge compaiono solo se valorizzati;
sui volontari mai, perché `db-volontari` non ha quelle colonne.

`tipologia` è stata tolta dal sottotitolo dei materiali, dove ora compare solo
come badge: altrimenti sarebbe scritta due volte sulla stessa riga.

Il clic chiama `startEdit(tab, id)`, la stessa funzione del pulsante di modifica:
imposta `editTab`, `editId`, `editMode = "edit"` e va allo step 2. Se i permessi
di quella scheda non consentono l'update, `startEdit` non fa nulla.

## 7c. Ordine e visibilità delle colonne

Due livelli: l'ordine **predefinito** viene dalla configurazione della scheda,
e sopra ci sta una **preferenza dell'utente** che riordina e nasconde.

### Predefinito: `sequence` dal describe

Il describe esteso porta `sequence` su ogni colonna — l'ordine impostato sulla
scheda in Camila. `defaultColOrder()` ordina per quello, quindi aggiungendo una
colonna alla worktable compare al posto giusto **senza toccare il JS**.

Prima l'ordine era solo `PREFERRED_COLS`, un elenco cablato per scheda, con le
colonne non elencate accodate in ordine alfabetico. Quell'elenco resta come
riserva: lo si usa quando il describe non e' quello esteso, e come criterio di
parita' fra colonne con lo stesso `sequence`.

I metadati arrivano da `loadColumns()` di `views/shared/vocabularies.js`, la
stessa funzione da cui escono i vocabolari: una sola `describe()` per tabella,
non due.

### Preferenza utente

```js
localStorage["rm-cols-<tab>"] = { order: [...], hidden: [...] }
```

Un pannello "Colonne" sopra la tabella elenca le colonne con frecce su/giu' e
una spunta per la visibilita', piu' "Ripristina ordine predefinito".

**Niente trascinamento delle intestazioni**: quelle sono gia' cliccabili per
ordinare, e un trascinamento corto verrebbe letto come clic cambiando
l'ordinamento invece di spostare la colonna. Le frecce funzionano anche col dito
sui totem.

`orderedCols()` prende l'ordine salvato, lo filtra sulle colonne realmente
presenti nei dati, e **accoda in fondo** quelle che l'utente non ha mai visto:
una colonna aggiunta dopo che la preferenza e' stata salvata compare, invece di
sparire perche' assente dall'elenco.

`localStorage` e' per browser e per dispositivo, non e' un dato condiviso: ogni
accesso e ogni scrittura sta in `try/catch`, perche' in finestra privata o con
lo storage bloccato puo' lanciare. Fallendo, la preferenza vale per la sola
sessione.

### Cosa resta fuori

Le colonne nascoste restano **filtrabili**: il selettore del filtro per colonna
usa `colsOrdinate`, non `cols`. Serve anche a evitare un difetto: nascondendo la
colonna selezionata nel filtro, l'opzione sparirebbe dal `<select>` e il
controllo ricadrebbe in silenzio sulla prima voce mentre lo stato continua a
dire la vecchia. Nella stessa occasione quel `<select>` e' passato da `.value` a
`?selected`, come vuole AGENTS.md per le opzioni dinamiche.

Una colonna nascosta non e' modificabile inline, perche' la cella non c'e'.

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
- **Tipologia select**: `<select>` con `<optgroup>` per ogni categoria, mostra tutte le tipologie. Se categoria = "Non assegnata" → campo disabilitato con valore fisso "Non assegnata". Se la categoria selezionata ha tipologie vuote (es. "Materiale informatico") → campo disabilitato con valore "—".
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
`Non assegnata, Attrezzature speciali, Attrezzi vari, Container, Effetti letterecci, Generatori, Materiale AIB, Materiale antinquinante, Materiale elettrico, Materiale idraulico e idrogeologico, Materiale informatico, Radio e dispositivi TLC, Tende`

Tipologie: select con optgroup (lista completa in `MATERIALI_TIPOLOGIE_OPTS`). Le categorie senza tipologie (attualmente: "Materiale informatico") mostrano il campo tipologia disabilitato con "—".

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
- `tipologia` (materiali) → select con optgroup (stessa `MATERIALI_TIPOLOGIE_OPTS`); se la categoria non ha tipologie (es. "Materiale informatico") → campo disabilitato con "—" e help "Nessuna tipologia disponibile per questa categoria."
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
