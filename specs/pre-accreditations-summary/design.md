# Design — pre-accreditations-summary

**Pulsante dashboard:** "Riepilogo preaccreditamenti"
**Icona:** `ri-calendar-event-line`

## 1. Struttura

SPA a singolo step, nessun wizard. Caricamento unico al mount delle tre tabelle preaccreditati in parallelo; tutto il filtraggio e il raggruppamento avvengono client-side sui dati in memoria.

```
[Titolo + filtri turni/servizi (chip)]
[KPI: # org | # volontari | # mezzi | # materiali]  [🔍 Cerca org…] [Riepilogo | Dettaglio] [↺]
──────────────────────────────────────────────────────
Modalità RIEPILOGO:
  tabella compatta con totali a piè di pagina

Modalità DETTAGLIO:
  accordion per organizzazione, espansione on-click
  → sub-tabelle volontari / mezzi / materiali
```

## 2. State shape

```js
// caricamento
loading:         Boolean
error:           Any | null

// dati grezzi (caricati una volta al mount)
rawV:            Array   // record da volontari-preaccreditati
rawM:            Array   // record da mezzi-preaccreditati
rawA:            Array   // record da materiali-preaccreditati

// opzioni filtri (derivate dai raw dopo il load)
allTurni:        Array<String>   // valori distinti di `turno`, ordinati alfabeticamente
allServizi:      Array<String>   // valori distinti di `servizio`, ordinati alfabeticamente

// filtri attivi (multi-select, semantica OR)
filterTurni:     Set<String>     // empty = nessun filtro (tutti i turni)
filterServizi:   Set<String>     // empty = nessun filtro (tutti i servizi)

// UI lista
search:          String          // filtro testo sul nome organizzazione
viewMode:        "summary" | "detail"
expanded:        Set<String>     // nomi org espansi in modalità detail
```

## 3. Tabelle e campi

| Tabella | Campi inclusi |
|---|---|
| `volontari-preaccreditati` | `organizzazione`, `codice-organizzazione`, `provincia`, `turno`, `servizio`, `codice-fiscale`, `cognome`, `nome`, `mansione` |
| `mezzi-preaccreditati` | `organizzazione`, `codice-organizzazione`, `provincia`, `turno`, `servizio`, `targa`, `categoria`, `tipologia` |
| `materiali-preaccreditati` | `organizzazione`, `codice-organizzazione`, `provincia`, `turno`, `servizio`, `id-materiale`, `codice-inventario`, `categoria`, `tipologia` |

Tutte e tre le query usano `size: 5000`.

## 4. Logica di filtraggio e raggruppamento

### 4.1 Filtro

```js
// applicato a ciascuno dei tre array raw
raw.filter(r =>
  (filterTurni.size === 0   || filterTurni.has(norm(r.turno)))   &&
  (filterServizi.size === 0 || filterServizi.has(norm(r.servizio)))
)
```

I due filtri si combinano in AND tra loro; all'interno di ciascuno la semantica è OR (mostra record che matchano almeno uno dei valori selezionati).

### 4.2 Raggruppamento per organizzazione

La chiave di raggruppamento è `norm(organizzazione).toLowerCase() + "|" + norm(codice-organizzazione).toLowerCase()`.

Ogni gruppo contiene:
- `name` — nome organizzazione
- `code` — codice organizzazione
- `provincia`
- `v[]`, `m[]`, `a[]` — record filtrati per categoria

I gruppi sono ordinati alfabeticamente per nome.

Il filtro testo `search` si applica sul `name` del gruppo dopo il raggruppamento.

### 4.3 KPI

Derivati dai gruppi risultanti (aggiornati ad ogni `rerender`):

| KPI | Calcolo totale | Calcolo unici |
|---|---|---|
| Organizzazioni | `groups.length` | — |
| Volontari | `filtV.length` | `new Set(filtV.map(r => codice-fiscale)).size` |
| Mezzi | `filtM.length` | `new Set(filtM.map(r => targa)).size` |
| Materiali | `filtA.length` | `new Set(filtA.map(r => id-materiale \|\| codice-inventario)).size` |

I valori filtrati (`filtV`, `filtM`, `filtA`) sono calcolati applicando `applyFilters()` agli array raw prima del raggruppamento.

## 5. Componenti UI

### 5.1 Filtri chip

Chip toggle arrotondati (Bulma `tag is-rounded`). Stato attivo: `is-primary`. Stato inattivo: `is-light`.

- **Tutti** — chip fisso che azzera il Set e torna allo stato "nessun filtro". È evidenziato quando il Set è vuoto.
- Chip per valore — toggle: se presente nel Set lo rimuove, altrimenti lo aggiunge.

Turni e servizi hanno ciascuno la propria riga di chip con intestazione (`heading`).

### 5.2 KPI bar

Quattro blocchi affiancati con `title is-5` per il numero e `help` per l'etichetta con icona:

| Icona | Etichetta | Chiave deduplicazione |
|---|---|---|
| `ri-building-line` | organizzazioni | — |
| `ri-user-line` | volontari | `codice-fiscale` |
| `ri-truck-line` | mezzi | `targa` |
| `ri-tools-line` | materiali | `id-materiale` o `codice-inventario` |

I contatori volontari, mezzi e materiali mostrano il numero di **righe** (slot preaccreditati). Se il numero di risorse **uniche** (deduplicate per chiave) è inferiore al totale, viene mostrata una riga aggiuntiva sotto il contatore principale:

```
145
12 unici
👤 volontari
```

La riga "N unici" è omessa quando `unique === total` (nessun duplicato nei dati filtrati).

### 5.3 Modalità Riepilogo (tabella)

Tabella `is-fullwidth is-striped is-hoverable is-size-7` con colonne:

| Organizzazione | Prov | Vol | Mezzi | Mat | Tot |
|---|---|---|---|---|---|

- Celle numeriche allineate a destra
- Valori a zero mostrati come `—`
- Riga `<tfoot>` con totali di colonna e conteggio organizzazioni

### 5.4 Modalità Dettaglio (accordion)

Ogni organizzazione è un `box` cliccabile che mostra/nasconde il contenuto. L'header contiene:
- Icona chevron destra/giù
- Nome organizzazione + tag codice + tag provincia
- Badge colorati con conteggio risorse: info (V), warning (M), success (A), dark (totale)

Il corpo espanso (bordato a sinistra) mostra tre sezioni opzionali (omesse se array vuoto):

**Volontari** — colonne: `cognome nome` | `mansione` | `turno` | `servizio`

**Mezzi** — colonne: `targa` | `categoria · tipologia` | `turno` | `servizio`

**Materiali** — colonne: `id-materiale` o `codice-inventario` | `categoria · tipologia` | `turno` | `servizio`

Tutte le sub-tabelle: `is-fullwidth is-narrow is-striped is-size-7`.

## 6. WorkTableClient — pattern di utilizzo

```js
// caricamento parallelo al mount
const [resV, resM, resA] = await Promise.all([
  client.table("volontari-preaccreditati").list({ include: INCLUDE_V, size: 5000 }),
  client.table("mezzi-preaccreditati").list({ include: INCLUDE_M, size: 5000 }),
  client.table("materiali-preaccreditati").list({ include: INCLUDE_A, size: 5000 })
]);
```

SPA di sola lettura: nessuna chiamata `create`, `update` o `delete`.

## 7. File

| File | Ruolo |
|---|---|
| `app-pre-accreditations-summary.js` | Entry point: carica lit-html, WorkTableClient, importa e monta la view |
| `views/pre-accreditations-summary/index.js` | Intera logica e template della SPA (~250 righe) |
| `pre-accreditations-summary.inc.php` | Mount PHP tramite `CamilaUserInterface::mountMiniApp` |
| `dashboard_pre-accreditations-summary.inc.php` | Alias PHP per dashboard (include pre-accreditations-summary.inc.php) |
