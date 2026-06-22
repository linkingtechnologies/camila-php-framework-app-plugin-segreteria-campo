# Design — comms-feed

**Pulsante dashboard:** "Comunicazioni live"
**Icona:** `ri-broadcast-line`

## 1. Struttura

SPA a singolo step, nessun wizard. Pensata per uno schermo dedicato in sala operativa. Layout a tre colonne sotto una toolbar scura.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  🔴 Comunicazioni live  [Audio ON/OFF]  [Tutti][Telegram][Radio]  🏢3 👤12 🚛4 🔧2  │  ← toolbar (#1e293b)
│                                                          Feed 10s ▼  23s  Mappa 41s [▦] │
├──────────────────────────┬─────────────────────────────────────┬─────────────────────┤
│  FEED COMUNICAZIONI      │  MAPPA RISORSE                      │  RISORSE            │
│  (~45%, scroll vert.)    │  Leaflet, height=viewport, flex:1   │  PER SERVIZIO       │
│                          │                                     │  (210px, togglabile)│
│  [card messaggio]        │  marker servizi con popup           │                     │
│  [card messaggio]        │  volontari/mezzi/materiali          │  [Org / Squadra]    │
│  …                       │  attivi per servizio                │  Servizio A 👤3 🚛1 │
│                          │                                     │  Servizio B 👤5     │
└──────────────────────────┴─────────────────────────────────────┴─────────────────────┘
```

Il pulsante `[▦]` in toolbar (icona `ri-layout-right-line`) mostra/nasconde il pannello laterale destro. Quando nascosto, la mappa occupa tutto lo spazio disponibile e `fitPanelHeight()` viene ricalcolata.

L'altezza dei pannelli è calcolata dinamicamente da `fitPanelHeight()` per riempire il viewport dalla posizione del pannello fino al fondo. Viene ricalcolata ad ogni `resize`.

---

## 2. State shape

```js
// comunicazioni
comms:           Array           // record da com-digitali, ordinati per received-date desc
commsLoading:    Boolean
commsError:      Any | null
lastCommsDate:   String          // max received-date visto finora (per rilevare nuovi)
newIds:          Set<String>     // id messaggi evidenziati come nuovi (rimossi dopo 4s)
newCount:        Number          // contatore cumulativo nuovi messaggi dall'ultimo scroll-in-cima (reset a 0 sul click pill)
channelFilter:   String          // "" = tutti, "Telegram", "Radio", …
commsInterval:   10 | 30 | 60   // secondi tra un refresh e l'altro
commsCountdown:  Number          // secondi al prossimo refresh
commsTimer:      IntervalHandle

// audio
audioEnabled:    Boolean

// mappa / risorse
servizi:         Array           // da tabella servizi
volontari:       Array           // attivi (isActive), escluso USCITA DEFINITIVA
mezzi:           Array           // attivi
materiali:       Array           // attivi
mapLoading:      Boolean
mapCountdown:    Number          // countdown fisso a 60s
mapTimer:        IntervalHandle
leafletMap:      L.Map | null
markersByName:   Map<String, { marker: L.Marker, lat: Number, lon: Number }>
groupBy:         "organizzazione" | "squadra"   // raggruppamento nel pannello risorse
sidebarOpen:     Boolean         // mostra/nasconde pannello risorse (default: true)
```

---

## 3. Tabelle e campi

### com-digitali (feed)

| Campo | Uso |
|---|---|
| `id` | chiave, tracking newIds |
| `received-date` | ordinamento, rilevazione nuovi messaggi |
| `data/ora` | fallback se received-date vuoto |
| `canale-origine` | filtro chip, icona, colore |
| `chiamante` | mittente (nome) |
| `chiamato` | destinatario (nome), mostrato con `→` se presente |
| `username` | mittente (handle), mostrato come `@username` |
| `messaggio` | testo principale |
| `priorita` | rilevazione priorità esplicita |
| `latitudine` | se presente (con longitudine), mostra pulsante pin per centrare mappa |
| `longitudine` | idem |
| `tipo-contenuto` | caricato, non ancora usato nella UI |
| `stato-elaborazione` | caricato, non ancora usato nella UI |

Query: `size: 100`, nessun filtro server-side. Ordinamento client-side per `received-date` desc.

### Mappa risorse (stesse tabelle del map-center tab risorse)

| Tabella | Campi |
|---|---|
| `servizi` | `id`, `nome`, `latitudine`, `longitudine`, `colore`, `lettera` |
| `volontari` | `id`, `cognome`, `nome`, `organizzazione`, `squadra`, `servizio`, `data-inizio-attestato`, `data-fine-attestato` |
| `mezzi` | `id`, `targa`, `marca`, `modello`, `organizzazione`, `squadra`, `servizio`, `data-inizio-attestato`, `data-fine-attestato` |
| `materiali` | `id`, `id-materiale`, `codice-inventario`, `tipologia`, `organizzazione`, `squadra`, `servizio`, `data-inizio-attestato`, `data-fine-attestato` |

Filtro risorse attive: `isActive(r)` → `data-inizio-attestato` compilata AND `data-fine-attestato` vuota. Escluso `USCITA DEFINITIVA`.

---

## 4. Toolbar

Sfondo `#1e293b` (slate-800), testo chiaro. Non sticky (rimossa la posizione fissa per compatibilità con il container Camila).

| Elemento | Comportamento |
|---|---|
| Titolo + icona | Statico (`ri-broadcast-line` rosso) |
| Toggle audio | Verde se ON, grigio se OFF. Vedi § Audio. |
| Chip canale | `""` = Tutti (default), uno per ogni canale distinto trovato nei dati. Filtro OR client-side. |
| Pillola risorse | `ri-building-line` N · `ri-user-line` N · `ri-truck-line` N · `ri-tools-line` N. Conteggi calcolati da dati già in memoria (zero chiamate extra). Visibile solo quando le risorse sono caricate. Org = organizzazioni distinte tra tutte le risorse attive. |
| Countdown feed | Numero secondi al prossimo refresh. Diventa giallo negli ultimi 3s. Select per cambiare intervallo (10/30/60s). Icona spinner mentre carica. |
| Countdown mappa | Fisso 60s. Icona spinner mentre carica. |
| Toggle sidebar | Pulsante `ri-layout-right-line` a destra dei timer. Blu se sidebar visibile, grigio se nascosta. Chiama `fitPanelHeight()` dopo il toggle. |

---

## 5. Feed messaggi

### 5.1 Rilevazione nuovi messaggi

Ad ogni poll, i record con `received-date` > `lastCommsDate` (salvato dall'ultimo poll) vengono considerati nuovi. I loro `id` vengono aggiunti a `newIds`. Dopo 4 secondi vengono rimossi e si chiama `rerender()`.

Al primo caricamento (`lastCommsDate === ""`) nessun messaggio è considerato nuovo (nessun beep, nessun highlight, nessun incremento di `newCount`).

Quando arrivano nuovi messaggi, `newCount += incoming.length`. Il contatore è cumulativo tra poll successivi finché l'utente non clicca la pill.

### 5.1a Preservazione scroll e pill "vai in cima"

Ogni `rerender()` salva `scrollTop` del pannello feed prima del render e lo ripristina dopo. Lo scroll non viene mai resettato automaticamente.

Quando `newCount > 0`, appare una pill sticky in cima al pannello feed:
```
↑  3 nuovi — vai in cima
```
La pill usa `position: sticky; top: 0` dentro il pannello scrollabile, quindi rimane visibile anche scorrendo. Al click: `scrollTop = 0` → `newCount = 0` → `rerender()`. Poiché `scrollTop` viene azzerato prima di `rerender()`, la funzione salva `st = 0` e non ripristina la vecchia posizione.

### 5.2 Priorità

Rilevata in questo ordine:
1. Campo `priorita`: `ALTA` o `EMERGENZA` → `"high"`; `MEDIA` o `ATTENZIONE` → `"medium"`
2. Keyword nel testo `messaggio` (uppercase): `EMERGENZA`, `SOS`, `URGENTE`, `URGENZA`, `INCENDIO`, `FERITO`, `FERITI`, `PERICOLO`, `MAYDAY` → `"high"`; `ATTENZIONE`, `ALLERTA`, `PROBLEMA` → `"medium"`
3. Default: `"normal"`

### 5.3 Card messaggio

```
┌────────────────────────────────────────────────────┐  ← border-left colorato
│  📱 Telegram          [EMERGENZA]    [📍]  14:53   │
│  Mario Rossi → Centrale  @mario_rossi               │
│                                                     │
│  EMERGENZA: incendio al secondo piano, ci sono      │
│  persone bloccate                                   │
└────────────────────────────────────────────────────┘
```

| Priorità | Border-left | Background normale | Background recente (< 4 min) |
|---|---|---|---|
| `high` | `#ef4444` (rosso) | `#fff5f5` | `#ffe4e4` |
| `medium` | `#f59e0b` (ambra) | `#fffbf0` | `#fff3d0` |
| `normal` | `#e5e7eb` (grigio) | `#fff` | `#eff6ff` (azzurro) |

"Recente" = `received-date` negli ultimi 4 minuti, calcolato a ogni render → torna a sfondo normale automaticamente allo scadere del tempo.

Messaggi in `newIds`: classe `cf-new` → animazione `cf-flash` (box-shadow blu che sfuma in 4s).

Il pulsante `ri-map-pin-line` appare solo se il record ha `latitudine` e `longitudine`. Al click chiama `flyToCoords(lat, lon, mittente)` che centra la mappa e aggiunge un marker temporaneo rosso (circleMarker, rimosso dopo 8s).

### 5.4 Canali

| Valore `canale-origine` | Icona | Colore |
|---|---|---|
| `Telegram` | `ri-telegram-line` | `#0088cc` |
| `Radio` o contiene "radio" | `ri-radio-line` | `#e67e22` |
| altro | `ri-message-line` | `#888` |

---

## 6. Audio

Generato via **Web Audio API** (nessun file audio esterno).

| Priorità nuovi messaggi | Suono |
|---|---|
| `high` | Due beep (1000Hz + 1200Hz, 350ms + 350ms con pausa 400ms) |
| `medium` o `normal` | Un beep breve (660Hz, 200ms) |

Attivato solo se `audioEnabled === true` e ci sono messaggi nuovi (non al primo caricamento).

La priorità del beep è quella più alta tra tutti i nuovi messaggi del poll.

---

## 7. Mappa risorse

Identica al tab "risorse" del `map-center`:

- Caricamento `servizi` + `volontari` + `mezzi` + `materiali` in parallelo (`Promise.all`)
- Marker per ogni servizio con coordinate valide (esclusi servizi fittizi)
- Icona marker: `marker_<colore><lettera>.png` da `templates/images/en/` (o `it/` se senza lettera)
- Popup: lista risorse attive per servizio, raggruppate per organizzazione, con dettagli espandibili
- Tile layers: OpenStreetMap (default) + Satellite (Esri), con control layer switcher
- Leaflet caricato lazy da CDN (`unpkg.com/leaflet@1.9.3`) al primo `initMap()`
- `refreshMarkers()`: rimuove i marker esistenti (tracciati in `markersByName`) e li riaggiunge con dati aggiornati

`flyToCoords(lat, lon, label)`: centra la mappa su coordinate specifiche (da messaggi con posizione), aggiunge un `L.circleMarker` rosso temporaneo rimosso dopo 8s. Un solo marker temporaneo alla volta (`_tempMarker`).

`flyToLocation(nome)`: centra la mappa sul marker del servizio e ne apre il popup.

### Refresh indipendente

Il refresh della mappa avviene ogni **60 secondi** tramite timer separato, indipendente dal timer del feed. Il countdown è visibile in toolbar.

---

## 8. Pannello "Risorse per servizio"

Pannello laterale destro (210px, `border-left`), togglabile dalla toolbar.

- Elenco dei servizi con risorse attive assegnate (esclusi servizi fittizi e senza risorse)
- Per ogni servizio: nome + conteggi `ri-user-line` N · `ri-truck-line` N · `ri-tools-line` N
- Click su un servizio → `flyToLocation(nome)` (centra mappa + apre popup)
- Toggle **Org / Squadra** (`groupBy`) che cambia il raggruppamento nei popup mappa
- Quando nascosto (`sidebarOpen = false`), la mappa occupa tutto lo spazio del pannello destro

---

## 9. Altezza pannelli

`fitPanelHeight()` calcola:
```js
const top = feedPanel.getBoundingClientRect().top;
const h = Math.max(400, window.innerHeight - top - 4);
feedPanel.style.height = h + "px";
mapPanel.style.height  = h + "px";
leafletMap?.invalidateSize();
```

Chiamata:
- Una volta dopo il primo render (via `setTimeout(..., 150)`)
- Ad ogni `window.resize`
- Al toggle del pannello risorse

---

## 10. File

| File | Ruolo |
|---|---|
| `app-comms-feed.js` | Entry point: carica lit-html, WorkTableClient, importa e monta la view |
| `views/comms-feed/index.js` | Intera logica e template (~460 righe) |
| `comms-feed.inc.php` | Mount PHP tramite `CamilaUserInterface::mountMiniApp` |
| `dashboard_comms-feed.inc.php` | Alias PHP per dashboard |
