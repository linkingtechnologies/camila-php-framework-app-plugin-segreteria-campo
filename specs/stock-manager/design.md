# Design — stock-manager (Movimentazioni Consumabili)

**Pulsante dashboard:** "Gestione consumabili"

## 1. Struttura

Single-view SPA con tre tab principali:

```
[Tab: Movimentazioni (ri-exchange-box-line) | Giacenze (ri-home-gear-line) | Mappa (ri-map-2-line)]
                                                                    [Auto-refresh] [Fullscreen]  ← nella tabbar solo quando tab Mappa è attivo

--- Tab Movimentazioni ---
[Toolbar: cerca · filtro tipo · filtro magazzino · filtro articolo · + Nuova movimentazione · aggiorna]
[Banner conferma eliminazione — visibile solo quando deleteId ≠ null]
[Tabella storico paginata]
  data/ora | tipo | articolo | qtà | u.m. | da | a | servizio | operatore | note | ✏️ 🗑️
[Paginazione: ← Prec. | Pag N di M · X risultati | Succ. →]

--- Tab Giacenze ---
[Sezione: Per magazzino]
  Tabella articolo × magazzino
[Sezione: Per servizio]
  Tabella articolo × servizio
[Nota: giacenze calcolate client-side, nessuna API aggiuntiva]

--- Tab Mappa ---
[Layout orizzontale:]
  [Sidebar sinistra 260px — nascondibile con linguetta]
    Giacenze per location (magazzini + servizi)
  [Mappa Leaflet — occupa spazio rimanente]
    Layer toggle: OpenStreetMap | Satellite
    Marker colorati = colore del magazzino/servizio (icone PNG esistenti)
    Click marker → popup con giacenze per quella location
```

**Modale nuova/modifica movimentazione:**
```
data/ora     (datetime-local, sempre editabile; default: now())
tipo         (select) → CARICO / SCARICO / TRASFERIMENTO
articolo     (input + datalist ARTICOLI fissi + articoli già usati)
quantita     (input numerico)
unita-di-misura (select fisso: pezzo·bancale·bottiglia·Kg·l·confezione — default: pezzo)
magazzino-origine      (select magazzini — disabilitato se tipo = CARICO)
magazzino-destinazione (select magazzini — disabilitato se tipo = SCARICO)
servizio     (select servizi — opzionale)
operatore    (testo libero)
note         (testo libero)
```

## 2. Costanti

```js
const TIPI     = ["CARICO", "SCARICO", "TRASFERIMENTO"];
const UDM      = ["pezzo", "bancale", "bottiglia", "Kg", "l", "confezione"];
const ARTICOLI = [
  "Sacco sabbia vuoto", "Sacco sabbia pieno",
  "Sacco juta vuoto",   "Sacco juta pieno",
  "Sacco PTT vuoto",    "Sacco PTT pieno",
  "Big Bag vuoto",      "Big Bag pieno",
  "Pasto", "Acqua",
];
const PAGE_SIZE = 50;
```

`UDM` default nel modal = `"pezzo"`. `ARTICOLI` = lista fissa, unita agli articoli distinti già presenti nel dataset per il datalist.

## 3. State shape

```js
{
  // caricamento
  loading:           Boolean,
  error:             Any | null,

  // dati grezzi
  movimentazioni:    Array,        // ordinate data/ora DESC
  magazzini:         Array,        // oggetti { nome, latitudine, longitudine, colore, lettera }
  servizi:           Array,        // oggetti { nome, latitudine, longitudine, colore, lettera }
  magazziniNomi:     Array,        // solo nomi, per le select
  serviziNomi:       Array,

  // navigazione tab
  activeTab:         "movimentazioni" | "giacenze" | "mappa",

  // filtri + paginazione
  search:            String,
  filterTipo:        String,       // "" | "CARICO" | "SCARICO" | "TRASFERIMENTO"
  filterMagazzino:   String,
  filterArticolo:    String,
  page:              Number,       // 1-based, reset a 1 a ogni cambio filtro

  // modale new/edit
  modal:             null | ModalState,

  // delete inline
  deleteId:          String | null,
  deleteBusy:        Boolean,
  deleteError:       String | null,

  // mappa
  leafletMap:        Object | null,
  mapSidebarOpen:    Boolean,      // default true
  mapFullscreen:     Boolean,
  autoRefresh:       Boolean,
  autoRefreshTimer:  Number | null,
  countdownSec:      Number,         // 60→0, reset a 60 dopo ogni load
  mapResizeHandler:  Function | null,
  mapInitializing:   Boolean,         // true durante loadLeaflet+initMap, previene init concorrenti
}

// ModalState
{
  mode:                     "new" | "edit",
  editId:                   String | null,
  busy:                     Boolean,
  error:                    String | null,
  tipo:                     String,
  articolo:                 String,
  "quantita":               String,
  "unita-di-misura":        String,   // default "pezzo"
  "magazzino-origine":      String,
  "magazzino-destinazione": String,
  servizio:                 String,
  operatore:                String,
  note:                     String,
  "data/ora":               String,   // datetime-local, sempre editabile; default nowDateTime() su new
}
```

## 4. Tabelle coinvolte

| Operazione | Tabella |
|---|---|
| Lettura movimentazioni | `mov-consumabili` |
| Lettura magazzini | `magazzini` |
| Lettura servizi | `servizi` |
| Creazione movimentazione | `mov-consumabili` (`.create()`) |
| Modifica movimentazione | `mov-consumabili` (`.update(id, payload)`) |
| Eliminazione movimentazione | `mov-consumabili` (`.remove(id)`) |

## 5. Caricamento dati

Durante il caricamento (`loading === true`) viene mostrato uno spinner centrato: cerchio animato (`@keyframes sm-spin`, `border-top-color:#6366f1`) + testo "Caricamento…" in grigio, altezza fissa 200px, nessun sfondo aggiuntivo.

`Promise.all` su tre chiamate parallele al mount e dopo ogni scrittura:

```js
client.table("mov-consumabili").list({ include: INCLUDE_MOV, size: 5000 })
client.table("magazzini").list({ include: ["nome","latitudine","longitudine","colore","lettera"], size: 500 })
client.table("servizi").list({ include: ["nome","latitudine","longitudine","colore","lettera"], size: 500 })
```

`INCLUDE_MOV = ["id","data/ora","tipologia","articolo","quantita","unita-di-misura","magazzino-origine","magazzino-destinazione","servizio","operatore","note"]`

## 6. Paginazione

Client-side sul dataset filtrato. Cambio filtro → `page = 1`.

```js
const filtered   = movimentazioni.filter(applyFilters);
const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
const pageItems  = filtered.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
```

## 7. Edit e Delete movimentazioni

**Edit**: click su ✏️ → apre modal pre-compilato con `mode:"edit"` e `editId`. Salvataggio via `.update(id, payload)`.

Il campo `data/ora` usa sempre `<input type="datetime-local">` ed è sempre editabile (sia in creazione che in modifica). Il default in creazione è `nowDateTime()`. Il formato interno (`YYYY-MM-DD HH:MM:SS`) viene convertito in `YYYY-MM-DDTHH:MM` per il picker e riconvertito al salvataggio (`.replace("T"," ") + ":00"`).

**Delete**: click su 🗑️ → compare banner giallo sopra la tabella con conferma. Conferma → `.remove(id)` → `load()`. La riga evidenziata in giallo mentre il banner è visibile.

## 8. Giacenze per magazzino

```js
// giacenza(articolo, magazzino):
// CARICO  → dest +qty
// SCARICO → orig -qty
// TRASFERIMENTO → dest +qty, orig -qty
function buildGiacenze(movimentazioni) { /* Map<articolo, Map<magazzino, qty>> */ }
```

Visualizzazione: tabella articoli × magazzini + colonna Totale. Valori negativi in rosso.

## 9. Giacenze per servizio

```js
// giacenza(articolo, servizio):
// SCARICO      → +qty  (magazzino scarica → servizio riceve)
// CARICO       → -qty  (merce rientra al magazzino → servizio cede)
// TRASFERIMENTO → ignorato (tra magazzini, non impatta il servizio)
function buildGiacenzeServizi(movimentazioni) { /* Map<articolo, Map<servizio, qty>> */ }
```

Solo le movimentazioni con campo `servizio` valorizzato contribuiscono.

## 10. Tab Mappa

- **Leaflet 1.9.3** caricato lazy da CDN (script + CSS iniettati una sola volta).
- **Due layer**: OpenStreetMap (default) + Esri Satellite, con `L.control.layers`.
- **Marker**: icone PNG dal sistema esistente (`plugins/segreteria-campo/templates/images/`), colore e lettera letti dal record. Helper `markerIconUrl(colore, lettera)` e `traduciColore(it→en)` inline.
- **Popup**: nome + badge tipo + tabella giacenze calcolata da `giacenzePerLocation(nome, tipo)`.
- **`fitBounds`** automatico su tutti i marker con coordinate valide.
- **`fitMapHeight()`**: imposta `height` del container via `window.innerHeight - getBoundingClientRect().top - 8px`, chiamata al mount, al resize window e al cambio fullscreen.
- **Sidebar giacenze**: pannello sinistro 260px, scrollabile, mostrante giacenze per ciascuna location. Nascondibile con linguetta laterale; al toggle chiama `fitMapHeight()` per aggiornare Leaflet.
- **Auto-refresh e Fullscreen**: i pulsanti sono posizionati in `position:absolute` a destra della tabbar, visibili solo quando il tab Mappa è attivo. In fullscreen (la tabbar non è visibile), compare un mini-toolbar dentro `sm-map-wrapper` con gli stessi pulsanti. Intervallo da 1s che decrementa `countdownSec` (60→0); a 0 chiama `load(true)` (silent) e resetta a 60. Toggle button `is-success` + `ri-spin` + countdown `Live 58s` quando attivo. Il refresh è **silenzioso** (`silent=true`): nessuno spinner, nessuna sostituzione del DOM — i dati si aggiornano in background mantenendo lo stato fullscreen intatto.
- **Fullscreen**: `requestFullscreen()` / `exitFullscreen()` sul wrapper `sm-map-wrapper`. Evento `fullscreenchange` aggiorna `mapFullscreen` e chiama `fitMapHeight()`. Il fullscreen persiste durante l'auto-refresh grazie al refresh silenzioso (il browser blocca `requestFullscreen()` senza gesto utente).

## 11. Note tecniche

- `buildGiacenze` / `buildGiacenzeServizi` restituiscono `Map<articolo, Map<location, qty>>`. La sidebar usa `pivotByLocation()` per ottenere `Map<location, Map<articolo, qty>>`.
- **`initMap` e re-init della mappa**: `setTimeout(initMap, 0)` viene schedulato ad ogni render del tab Mappa (non solo se `leafletMap === null`). `initMap` stessa decide se procedere: se `mapInitializing === true` esce subito (evita init concorrenti da auto-refresh); se `leafletMap` esiste e `document.contains(leafletMap.getContainer())` è `true` (container ancora nel DOM) esce senza fare nulla. Altrimenti reinizializza. Questo copre il caso in cui lit-html rimuova il `#sm-map-container` al cambio tab, lasciando `leafletMap` puntare a un nodo staccato. Il flag `mapInitializing` (booleano) viene settato a `true` prima di `await loadLeaflet()` e azzerato al termine.
- `magazzini` e `servizi` sono array di oggetti completi (non solo nomi) per supportare la mappa. `magazziniNomi` e `serviziNomi` sono alias di soli nomi per le select.
- Nomi campi DB: `quantita` e `unita-di-misura` (senza apostrofi).
- **Servizi fittizi**: `"IN ATTESA DI SERVIZIO"` e `"USCITA DEFINITIVA"` sono esclusi **solo dalla tendina servizio del modal**. Appaiono normalmente in giacenze e mappa se referenziati da movimentazioni storiche.
