# Design — map-center (Centro Mappe)

**Pulsante dashboard:** "Mappe"

## 1. Struttura

Single-view SPA con quattro tab a tema mappa. Tab di default: **Risorse**.

```
[Tab: Risorse (ri-team-line) | Consumabili (ri-exchange-box-line) | Servizi (ri-pushpin-line) | Organizzazioni (ri-building-2-line)]
                                                          [Auto-refresh] [Fullscreen]  ← destra tabbar (Auto-refresh nascosto nel tab Servizi)

--- Tab Risorse (default) ---
[Layout orizzontale:]
  [Sidebar sinistra 1/3 larghezza (flex:0 0 33.333%) — nascondibile con linguetta]
    Toggle: raggruppa per [Organizzazione | Squadra]
    Per ogni servizio con risorse attive:
      🔴A Nome Servizio          ← icona marker (markerIconUrl) + nome
         🏢2 👤3 🚛1             ← nGruppi in viola + conteggi totali (ri-user-line, ri-truck-line, ri-tools-line)
         Org A    👤2 🚛1        ← sub-lista: una riga per ogni org/squadra con conteggi
         Org B    👤1
    Click riga → flyToLocation(nome)
  [Mappa Leaflet — isolation:isolate per contenere z-index Leaflet]
    Marker colorati = servizi (esclusi servizi fittizi)
    Click marker → popup con <details> collassibili per gruppo
    Ogni gruppo: elenco volontari + mezzi + materiali attivi

--- Tab Consumabili ---
[Layout orizzontale:]
  [Sidebar sinistra 1/3 larghezza (flex:0 0 33.333%) — nascondibile con linguetta]
    Giacenze per location (magazzini + servizi)
  [Mappa Leaflet — isolation:isolate]
    Marker colorati = magazzini + servizi
    Click marker → popup giacenze

--- Tab Servizi (chiave interna: "posizioni") ---
[Layout orizzontale:]
  [Sidebar sinistra 1/3 larghezza (flex:0 0 33.333%) — nascondibile con linguetta]
    [Modifica] button + [ingranaggio → ?dashboard=service-manager]
    Se modifica attiva: hint "Trascina i marker per spostare la posizione"
    Sezione "Senza posizione (N)": servizi senza latitudine/longitudine
      → click riga = seleziona per posizionamento
      → riga selezionata evidenziata in giallo + testo "Clicca sulla mappa"
    Sezione "Posizionati (N)": click riga = flyToLocation
    Se servizio selezionato da marker: pannello editor colore + lettera + Salva/Annulla
  [Mappa Leaflet — isolation:isolate]
    Marker per tutti i servizi con coordinate (esclusi SERVIZI_FITTIZI)
    In modalità modifica: marker draggabili; cursor crosshair quando servizio in attesa di posizionamento
    Drag marker → salva immediatamente nuova posizione
    Click marker (in modifica) → apre editor nella sidebar
    Click mappa (quando servizio selezionato per posizionamento) → salva nuova posizione

--- Tab Organizzazioni ---
[Layout orizzontale:]
  [Sidebar sinistra 1/3 larghezza (flex:0 0 33.333%) — nascondibile con linguetta]
    Elenco organizzazioni + warning "N senza coordinate"
  [Mappa Leaflet — isolation:isolate]
    Marker per ogni org con latitudine + longitudine valide
    Click marker → popup con dati organizzazione
```

I pulsanti Auto-refresh e Fullscreen sono posizionati in `position:absolute` a destra della tabbar. Auto-refresh è **nascosto nel tab Servizi** (evitare reload durante editing). In fullscreen, la tabbar è nascosta dal browser: compare un mini-toolbar dentro `mc-map-wrapper` con gli stessi pulsanti.

Click su qualsiasi riga sidebar → `flyToLocation(nome)`: `leafletMap.flyTo([lat, lon], 14)` + `marker.openPopup()`.

## 2. Costanti e tabelle coinvolte

```js
const SERVIZI_FITTIZI = ["IN ATTESA DI SERVIZIO", "USCITA DEFINITIVA"];
const WAITING         = "IN ATTESA DI SERVIZIO";
const COLORI_SERVIZI  = ["rosso","blu","verde","arancione","viola","giallo","grigio","nero","bianco"];
```

| Tabella | Operazione | Tab |
|---|---|---|
| `mov-consumabili` | `list` | Consumabili |
| `magazzini` | `list` | Consumabili |
| `servizi` | `list` | Consumabili + Risorse + Servizi |
| `servizi` | `update` (latitudine, longitudine, colore, lettera) | Servizi |
| `volontari` | `list` | Risorse |
| `mezzi` | `list` | Risorse |
| `materiali` | `list` | Risorse |
| `db-organizzazioni` | `list` | Organizzazioni |

## 3. Campi inclusi per tabella

```js
INCLUDE_MOV = ["id","data/ora","tipologia","articolo","quantita",
               "unita-di-misura","magazzino-origine","magazzino-destinazione","servizio","operatore","note"]
INCLUDE_SRV = ["id","nome","latitudine","longitudine","colore","lettera"]   // id necessario per update
INCLUDE_MAG = ["nome","latitudine","longitudine","colore","lettera"]
INCLUDE_V   = ["id","cognome","nome","codice-fiscale","organizzazione","provincia","squadra",
               "servizio","data-inizio-attestato","data-fine-attestato"]
INCLUDE_M   = ["id","targa","codice-inventario","categoria","marca","modello",
               "organizzazione","provincia","squadra","servizio","data-inizio-attestato","data-fine-attestato"]
INCLUDE_MAT = ["id","id-materiale","codice-inventario","categoria","tipologia",
               "organizzazione","provincia","squadra","servizio","data-inizio-attestato","data-fine-attestato"]
INCLUDE_ORG = ["id","denominazione","codice","sezione","tipologia-sezione",
               "comune","provincia","indirizzo","latitudine","longitudine","colore","lettera"]
```

## 4. State shape

```js
{
  // caricamento
  loading:           Boolean,
  error:             Any | null,

  // dati grezzi
  movimentazioni:    Array,
  magazzini:         Array,        // { nome, latitudine, longitudine, colore, lettera }
  servizi:           Array,        // { id, nome, latitudine, longitudine, colore, lettera }
  volontari:         Array,
  mezzi:             Array,
  materiali:         Array,
  organizzazioni:    Array,        // { denominazione, codice, sezione, tipologia-sezione,
                                   //   comune, provincia, indirizzo, latitudine, longitudine, colore, lettera }

  // navigazione tab
  activeTab:         "risorse" | "consumabili" | "posizioni" | "organizzazioni",

  // mappa
  leafletMap:        Object | null,
  markersByName:     Map<string, { marker, lat, lon }>,
  mapSidebarOpen:    Boolean,      // default true
  mapFullscreen:     Boolean,
  autoRefresh:       Boolean,
  autoRefreshTimer:  Number | null,
  countdownSec:      Number,       // 60→0, reset dopo ogni load
  mapResizeHandler:  Function | null,

  // tab risorse
  groupBy:           "organizzazione" | "squadra",

  // tab servizi (posizioni)
  posEditMode:       Boolean,      // modifica attiva
  selectedSrv:       Object | null,  // copia locale del servizio in editing (colore+lettera)
  pendingPlace:      Object | null,  // servizio selezionato per posizionamento su click mappa
  posSaveBusy:       Boolean,
  posSaveError:      String | null,
}
```

## 5. Caricamento dati

`load(silent=false)` esegue 7 chiamate in parallelo:

```js
Promise.all([
  client.table("mov-consumabili").list({ include: INCLUDE_MOV, size: 5000 }),
  client.table("magazzini").list({ include: INCLUDE_MAG, size: 500 }),
  client.table("servizi").list({ include: INCLUDE_SRV, size: 500 }),
  client.table("volontari").list({ include: INCLUDE_V, size: 5000 }),
  client.table("mezzi").list({ include: INCLUDE_M, size: 2000 }),
  client.table("materiali").list({ include: INCLUDE_MAT, size: 2000 }),
  client.table("db-organizzazioni").list({ include: INCLUDE_ORG, size: 2000 }),
])
```

`load(silent=true)`: nessuno spinner, nessuna sostituzione del DOM → fullscreen resta intatto.

## 6. Tab Consumabili

Logica identica al tab Mappa di stock-manager:

- `buildGiacenze(movimentazioni)` → `Map<articolo, Map<magazzino, qty>>`
- `buildGiacenzeServizi(movimentazioni)` → `Map<articolo, Map<servizio, qty>>`
- `pivotByLocation(giacenze)` → `Map<location, Map<articolo, qty>>` per la sidebar
- Segno per servizi: SCARICO = +qty (riceve), CARICO = -qty (cede)
- Popup marker: nome location + tabella giacenze articolo/qty

## 7. Tab Risorse

### Filtraggio attivi
```js
function isActive(r) {
  return !!norm(r["data-inizio-attestato"]) && !norm(r["data-fine-attestato"]);
}
```

### Raggruppamento
`buildCards(volontari, mezzi, materiali, groupBy)` raggruppa le risorse attive per `organizzazione` o `squadra` (stesso pattern di resource-board).

### Marker servizi
- Esclude `SERVIZI_FITTIZI` dalla mappa
- Marker su `latitudine`/`longitudine` del servizio
- Popup: elemento `<details>` per ogni gruppo (org o squadra), contenente liste volontari/mezzi/materiali
- Icone allineate a resource-board: `ri-user-line` (volontari), `ri-truck-line` (mezzi), `ri-tools-line` (materiali)

### Sidebar

Per ogni servizio con risorse attive:
- **Intestazione**: icona marker (`markerIconUrl(colore, lettera)`) + nome servizio
- **Riga conteggi**: `ri-building-line` N (org/squadre) in viola · `ri-user-line` N · `ri-truck-line` N · `ri-tools-line` N
- **Sub-lista**: una riga per ogni org o squadra con nome a sinistra e conteggi a destra
- Click su riga servizio → `flyToLocation(nome)` (centra mappa + apre popup)

Toggle buttons `Organizzazione` / `Squadra` cambiano `groupBy`, forzano re-render e chiamano `refreshMarkers()` per aggiornare i popup.

L'icona nel contatore e nella sub-lista cambia col toggle: `ri-building-line` in modalità **Organizzazione**, `ri-group-line` in modalità **Squadra**.

Servizi fittizi (`IN ATTESA DI SERVIZIO`, `USCITA DEFINITIVA`) e servizi senza risorse attive sono esclusi dall'elenco.

## 8. Tab Servizi

### Modalità visualizzazione (`posEditMode = false`)
- Sidebar: lista servizi posizionati (click → flyToLocation), lista servizi senza coordinate
- Mappa: marker statici con popup nome; click su riga sidebar → flyTo + openPopup

### Modalità modifica (`posEditMode = true`)
Attivata con il pulsante "Modifica" in sidebar. Ricostruisce la mappa.

**Spostamento posizione:**
- Marker con `draggable: true`
- Su `dragend`: `savePosition(r, latlng.lat, latlng.lng)` → `client.table("servizi").update(r.id, { latitudine, longitudine })` → aggiorna oggetto locale → ricostruisce mappa
- Click marker → seleziona il servizio in sidebar per editing colore/lettera (`selectedSrv = { ...r }`)

**Posizionamento nuovo servizio (senza coordinate):**
- Click su riga "Senza posizione" → `pendingPlace = r`; cursore mappa diventa crosshair
- Click sulla mappa → `savePosition(r, lat, lng)`; `pendingPlace = null` dopo il salvataggio
- Click di nuovo sulla stessa riga → deseleziona

**Editor colore/lettera:**
- Appare in sidebar quando `selectedSrv !== null`
- Select colore da `COLORI_SERVIZI`; input lettera (maxlength=1, uppercase)
- "Salva" → `saveProp()`: `client.table("servizi").update(id, { colore, lettera })` → aggiorna array locale → ricostruisce mappa
- "Annulla" → `selectedSrv = null`

### Pulsante Gestione servizi
Link `<a href="?dashboard=service-manager">` con icona `ri-settings-3-line`, affiancato al toggle Modifica.

### Reset stato al cambio tab
`switchTab()` azzera: `selectedSrv`, `pendingPlace`, `posSaveError`.

## 9. Tab Organizzazioni

- Marker solo per org con `latitudine` e `longitudine` non vuote
- `colore`/`lettera` dal record (fallback: `grigio`)
- Popup: denominazione, tipologia-sezione, sezione, codice, indirizzo, comune, provincia
- Sidebar: elenco org totale + contatore "N senza coordinate" in warning

## 10. Gestione mappa (Leaflet)

- **Singola istanza** `leafletMap` distrutta e ricreata ad ogni `switchTab()` e `togglePosEditMode()`
- **Leaflet 1.9.3** caricato lazy da CDN (script + CSS iniettati una sola volta)
- **Due layer**: OpenStreetMap (default) + Esri Satellite con `L.control.layers`
- **Marker**: icone PNG dal sistema esistente, helper `markerIconUrl(colore, lettera)` + `traduciColore(it→en)`
- **`markersByName`**: `Map<nome, { marker, lat, lon }>` — popolata in ogni `addMarkers*()`, usata da `flyToLocation()`
- **`fitBounds`** automatico su tutti i marker con coordinate valide
- **`fitMapHeight()`**: `window.innerHeight - getBoundingClientRect().top - 8`, chiamata a mount, resize, cambio tab, cambio fullscreen
- **`isolation: isolate`** sul container della mappa (`#mc-map-container`): crea un nuovo stacking context che contiene i z-index alti di Leaflet, impedendo che i tile/control overlay finiscano sopra ai menu dell'applicazione
- **Linguetta sidebar**: `z-index: 10` (ridotto da 1000); posizione `left: 33.333%` per seguire la larghezza 1/3 della sidebar

## 11. Auto-refresh e fullscreen

- Intervallo 1s, `countdownSec` 60→0; a 0 chiama `load(true)` (silent) e resetta a 60
- Badge `Live 58s` con icona `ri-spin` mentre attivo
- Auto-refresh **nascosto nel tab Servizi** per non interrompere operazioni di editing
- **Fullscreen**: `requestFullscreen()` / `exitFullscreen()` sul wrapper `mc-map-wrapper`
- Il refresh silenzioso mantiene il DOM intatto → fullscreen non viene perso
- Evento `fullscreenchange` aggiorna `mapFullscreen` e chiama `fitMapHeight()`

## 12. CSS e file helper

- Prefisso CSS: `mc-`
- Entry point JS: `app-map-center.js` → `import { MapCenter } from './views/map-center/index.js'`
- Helper PHP: `map-center.inc.php` (`mountMiniApp`)
- Dashboard include: `dashboard_map-center.inc.php` (`require('map-center.inc.php')`)
