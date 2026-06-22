# Design — pre-accreditations-summary

**Pulsante dashboard:** "Riepilogo preaccreditamenti"
**Icona:** `ri-calendar-event-line`

## 1. Struttura

SPA a singolo step, nessun wizard. Caricamento unico al mount delle tre tabelle preaccreditati in parallelo; tutto il filtraggio e il raggruppamento avvengono client-side sui dati in memoria.

```
[Titolo]
[Filtri — griglia 2 colonne]
  Turni (con 🖨 per turno)  |  Provincia
  Servizi                   |  Intolleranze *
  Benefici di legge *       |  Cena *
  Pranzo *                  |  Pernottamento *
  (* solo volontari)

[KPI: # org | # volontari | # mezzi | # materiali]  [🔍 Cerca org…] [Riepilogo | Dettaglio] [↺]
──────────────────────────────────────────────────────
Modalità RIEPILOGO:
  tabella compatta (Org | Prov | Vol | Mezzi | Mat) — nessuna colonna "Tot"

Modalità DETTAGLIO:
  accordion per organizzazione, espansione on-click
  → sub-tabelle volontari / mezzi / materiali
```

## 2. State shape

```js
// caricamento
loading:             Boolean
error:               Any | null

// dati grezzi (caricati una volta al mount)
rawV:                Array   // record da volontari-preaccreditati
rawM:                Array   // record da mezzi-preaccreditati
rawA:                Array   // record da materiali-preaccreditati

// opzioni filtri (derivate dai raw dopo il load, ordinate alfabeticamente)
allTurni:            Array<String>
allServizi:          Array<String>
allProvince:         Array<String>   // da tutti e tre i dataset
allBenefici:         Array<String>   // da rawV; null/vuoto → "—"
allIntolleranze:     Array<String>   // da rawV; null/vuoto → "—"
allPranzo:           Array<String>   // da rawV; null/vuoto → "—"
allCena:             Array<String>   // da rawV; null/vuoto → "—"
allPernottamento:    Array<String>   // da rawV; null/vuoto → "—"

// filtri attivi (multi-select, semantica OR; empty = tutti)
filterTurni:         Set<String>
filterServizi:       Set<String>
filterProvincia:     Set<String>
filterBenefici:      Set<String>
filterIntolleranze:  Set<String>
filterPranzo:        Set<String>
filterCena:          Set<String>
filterPernottamento: Set<String>

// UI lista
search:              String          // filtro testo sul nome organizzazione
viewMode:            "summary" | "detail"
expanded:            Set<String>     // nomi org espansi in modalità detail
```

## 3. Tabelle e campi

| Tabella | Campi inclusi |
|---|---|
| `volontari-preaccreditati` | `organizzazione`, `codice-organizzazione`, `provincia`, `turno`, `servizio`, `codice-fiscale`, `cognome`, `nome`, `mansione`, `benefici-di-legge`, `intolleranze`, `pranzo`, `cena`, `pernottamento` |
| `mezzi-preaccreditati` | `organizzazione`, `codice-organizzazione`, `provincia`, `turno`, `servizio`, `targa`, `categoria`, `tipologia` |
| `materiali-preaccreditati` | `organizzazione`, `codice-organizzazione`, `provincia`, `turno`, `servizio`, `id-materiale`, `codice-inventario`, `categoria`, `tipologia` |

Tutte e tre le query usano `size: 5000`.

## 4. Logica di filtraggio e raggruppamento

### 4.1 Funzioni filtro

```js
// filtri comuni a tutti e tre i dataset
function applyFiltersBase(r) {
  return (filterTurni.size === 0    || filterTurni.has(norm(r.turno)))    &&
         (filterServizi.size === 0  || filterServizi.has(norm(r.servizio))) &&
         (filterProvincia.size === 0 || filterProvincia.has(norm(r.provincia)));
}

// per mezzi e materiali
function applyFilters(raw) { return raw.filter(r => applyFiltersBase(r)); }

// per volontari — aggiunge i filtri logistici (solo rawV ha questi campi)
function applyFiltersV(raw) {
  return raw.filter(r =>
    applyFiltersBase(r) &&
    (filterBenefici.size === 0     || filterBenefici.has(norm(r["benefici-di-legge"]) || "—")) &&
    (filterIntolleranze.size === 0 || filterIntolleranze.has(norm(r.intolleranze) || "—")) &&
    (filterPranzo.size === 0       || filterPranzo.has(norm(r.pranzo) || "—")) &&
    (filterCena.size === 0         || filterCena.has(norm(r.cena) || "—")) &&
    (filterPernottamento.size === 0 || filterPernottamento.has(norm(r.pernottamento) || "—"))
  );
}
```

I filtri logistici (benefici, intolleranze, pranzo, cena, pernottamento) si applicano **solo ai volontari**. Mezzi e materiali non vengono esclusi da questi filtri.

I valori null/vuoti vengono normalizzati a `"—"` sia in raccolta che in confronto, così le chip appaiono sempre una volta caricati i dati.

### 4.2 Raggruppamento per organizzazione

Chiave: `norm(organizzazione).toLowerCase() + "|" + norm(codice-organizzazione).toLowerCase()`.

Ogni gruppo: `{ name, code, provincia, v[], m[], a[] }`. Ordinamento alfabetico per nome.

Il filtro testo `search` si applica sul `name` del gruppo dopo il raggruppamento.

### 4.3 KPI

| KPI | Calcolo totale | Calcolo unici |
|---|---|---|
| Organizzazioni | `groups.length` | — |
| Volontari | `filtV.length` (`applyFiltersV`) | `new Set(filtV.map(r => codice-fiscale)).size` |
| Mezzi | `filtM.length` (`applyFilters`) | `new Set(filtM.map(r => targa)).size` |
| Materiali | `filtA.length` (`applyFilters`) | `new Set(filtA.map(r => id-materiale \|\| codice-inventario)).size` |

## 5. Componenti UI

### 5.1 Filtri chip — layout

I filtri sono disposti in una griglia CSS `display:grid; grid-template-columns:1fr 1fr; gap:.25rem 2rem`. Ordine DOM (determina la colonna per auto-placement):

| Sinistra | Destra |
|---|---|
| Turni | Provincia |
| Servizi | Intolleranze |
| Benefici di legge | Cena |
| Pranzo | Pernottamento |

### 5.2 Chip standard

Bulma `tag is-rounded`. Attivo: `is-primary`. Inattivo: `is-light`. Il chip **Tutti/Tutte** azzera il Set.

### 5.3 Chip turno con stampa (`chipTurno`)

I chip turno usano Bulma `tags has-addons` (due tag connessi):

```
[TURNO 1][🖨]
```

- Parte sinistra: label del turno, click → toggle filtro
- Parte destra: icona `ri-printer-line`, `<a target="_blank">` → `stampaUrl(turno)`

```js
function stampaUrl(turno) {
  const f1 = encodeURIComponent(` AND \${VOLONTARI PREACCREDITATI.TURNO} = '${turno}'`);
  const f2 = encodeURIComponent(` AND \${MEZZI PREACCREDITATI.TURNO} = '${turno}'`);
  const f3 = encodeURIComponent(` AND \${MATERIALI PREACCREDITATI.TURNO} = '${turno}'`);
  return `?camila_worktable_add_child_filter_1=${f1}`
       + `&camila_worktable_add_child_filter_2=${f2}`
       + `&camila_worktable_add_child_filter_3=${f3}`
       + `&camila_xml2pdf`;
}
```

Il parametro `camila_xml2pdf` senza valore attiva la generazione PDF in Camila. Il chip **Tutti** rimane chip standard senza icona stampante.

### 5.4 KPI bar

Quattro blocchi con `title is-5` + `help`:

| Icona | Etichetta | Deduplicazione |
|---|---|---|
| `ri-building-line` | organizzazioni | — |
| `ri-user-line` | volontari | `codice-fiscale` |
| `ri-truck-line` | mezzi | `targa` |
| `ri-tools-line` | materiali | `id-materiale` o `codice-inventario` |

Se `unique < total` appare riga `N unici` sotto il contatore.

### 5.5 Modalità Riepilogo (tabella)

Tabella `is-fullwidth is-striped is-hoverable is-size-7`:

| Organizzazione | Prov | Vol | Mezzi | Mat |
|---|---|---|---|---|

- Valori zero → `—`
- Nessuna colonna "Tot" (sommare risorse eterogenee non ha significato)
- `<tfoot>` con totali di colonna e conteggio org

### 5.6 Modalità Dettaglio (accordion)

Header box: chevron · nome + tag codice + tag provincia · badge `is-info` (V) · `is-warning` (M) · `is-success` (A). Nessun badge totale cumulativo.

Corpo espanso — tre sezioni opzionali con `<thead>`:

**Volontari** — colonne: Nominativo | Mansione | Turno | Servizio | Pranzo | Cena | Pernott. | Benefici | Intolleranze

**Mezzi** — colonne: Targa | Categoria · Tipologia | Turno | Servizio

**Materiali** — colonne: ID/Codice | Categoria · Tipologia | Turno | Servizio

`detailSubTable(rows, cols, headers=[])` accetta un terzo parametro opzionale per la riga `<thead>`.

## 6. WorkTableClient

```js
const [resV, resM, resA] = await Promise.all([
  client.table("volontari-preaccreditati").list({ include: INCLUDE_V, size: 5000 }),
  client.table("mezzi-preaccreditati").list({ include: INCLUDE_M, size: 5000 }),
  client.table("materiali-preaccreditati").list({ include: INCLUDE_A, size: 5000 })
]);
```

SPA di sola lettura.

## 7. File

| File | Ruolo |
|---|---|
| `app-pre-accreditations-summary.js` | Entry point |
| `views/pre-accreditations-summary/index.js` | Logica e template (~530 righe) |
| `pre-accreditations-summary.inc.php` | Mount PHP via `mountMiniApp` |
| `dashboard_pre-accreditations-summary.inc.php` | Alias dashboard |
