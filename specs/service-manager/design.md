# Design — service-manager

## 1. Struttura

SPA a pannello diviso (lista + form laterale). Nessun wizard. I dati vengono caricati al mount e ricaricati dopo ogni operazione di scrittura.

```
[Toolbar lista: 🔍 Cerca… | + | ↺ | 🔧 Strumenti ▼]
[Banner risultato operazione strumenti]
┌────────────────────┬────────────────────────────────────────────┐
│  Lista servizi     │  Pannello dettaglio / form                 │
│  (320px, scroll)   │  (flex:1, scroll)                          │
│                    │                                            │
│  ⠿ ● Nome  ord     │  [placeholder se nessun servizio selezionato]
│  ⠿ ● Nome  ord  📍 │  [form con pulsantiera in cima]            │
│  …                 │                                            │
└────────────────────┴────────────────────────────────────────────┘
[Modale mappa (overlay fisso)]
```

## 2. State shape

```js
// caricamento
loading:        Boolean
error:          Any | null

// lista
services:       Array           // tutti i servizi, ordinati per campo `ordine`
search:         String          // filtro testo libero sul nome

// form
selected:       Object | null   // servizio selezionato (record grezzo)
form:           Object          // copia editabile del record
formMode:       "new" | "edit" | null   // null = nessuna selezione
formBusy:       Boolean
formError:      String | null
formSuccess:    String | null
formDirty:      Boolean         // true se il form ha modifiche non salvate
pendingSelect:  Object | "new" | null  // target di navigazione in attesa di conferma abbandono

// eliminazione
deleteConfirm:  Boolean
deleteBusy:     Boolean
deleteUsage:    { v: Number, m: Number, mat: Number } | null
deleteBlocked:  Boolean

// UI
colorDropOpen:  Boolean         // dropdown colore aperto
dragId:         String | null   // id del servizio in drag
dragOverId:     String | null   // id del servizio sotto il cursore

// clipboard coordinate
coordClipboard: { latitudine, longitudine } |
                { latitudine, longitudine, comune, provincia, indirizzo } | null

// mappa
showMap:        Boolean
mapSearch:      String
mapResults:     Array           // risultati Nominatim search
mapSearching:   Boolean
mapReversing:   Boolean         // reverse geocoding in corso (disabilita Conferma)
mapLat:         Number | null
mapLon:         Number | null
mapAddress:     { comune, provincia, indirizzo }

// strumenti bulk
toolsBusy:      Boolean
toolsResult:    { inserted: Array, skipped: Array, deleted?: Array } |
                { error: String } | null
```

## 3. Tabella e campi

Tabella: `servizi`

| Campo | Tipo | Note |
|---|---|---|
| `id` | String | chiave primaria |
| `nome` | String | obbligatorio, usato come chiave funzionale |
| `ordine` | Number | determina l'ordinamento nella lista |
| `lettera` | String | abbreviazione (1-2 caratteri) |
| `colore` | String | nome colore da vocabolario fisso |
| `descrizione` | String | testo libero |
| `latitudine` | String | coordinata geografica |
| `longitudine` | String | coordinata geografica |
| `comune` | String | da reverse geocoding o inserimento manuale |
| `provincia` | String | sigla 2 lettere |
| `indirizzo` | String | via + numero civico |
| `inizio` | String | formato `YYYY-MM-DD HH:MM:SS` |
| `fine` | String | formato `YYYY-MM-DD HH:MM:SS` |
| `operatori-a-supporto` | String | |
| `note` | String | |

Colori disponibili (`COLORI`): `rosso`, `nero`, `blu`, `verde`, `grigio`, `arancione`, `viola`, `bianco`, `giallo`

Servizi protetti (`PROTECTED`): `IN ATTESA DI SERVIZIO`, `USCITA DEFINITIVA`

## 4. Componenti UI

### 4.1 Lista servizi

- Ogni riga mostra: drag handle (se non protetto), pallino colorato, nome, indicatore modifiche non salvate (●  arancione), icona GPS grigia se coordinate mancanti, numero ordine
- Drag & drop per riordinare: `draggable`, eventi `dragstart/dragover/dragleave/drop/dragend`
- I servizi protetti non hanno drag handle e non sono draggabili
- La riga selezionata ha classe `is-selected`
- Filtro testo libero sul nome (case-insensitive)

### 4.2 Dropdown colore custom

Dropdown div-based (non `<select>`) per mostrare pallini colorati nelle opzioni. Chiude al click esterno tramite listener su `document`. Struttura: `.sm-color-trigger` + `.sm-color-menu` con `.sm-color-opt` per ogni voce.

### 4.3 Datetime picker

Campi `inizio` e `fine` usano `<input type="datetime-local">`.
- Conversione DB→input: `YYYY-MM-DD HH:MM:SS` → `YYYY-MM-DDTHH:MM` (funzione `toDatetimeLocal`)
- Conversione input→DB: `YYYY-MM-DDTHH:MM` → `YYYY-MM-DD HH:MM:SS` (funzione `fromDatetimeLocal`)

### 4.4 Modale mappa

Overlay fisso `.sm-map-overlay` con layout a due colonne:
- **Sidebar** (260px): campo di ricerca Nominatim + lista risultati + pannello coordinate (lat/lon/comune/provincia/indirizzo) + footer con Annulla/Conferma
- **Canvas mappa** (flex:1): istanza Leaflet con marker draggabile

Leaflet viene caricato lazy da CDN al primo utilizzo. L'istanza viene distrutta alla chiusura della modale (`_map.remove()`).

Geocoding:
- **Forward** (search): `https://nominatim.openstreetmap.org/search?q=...&format=json&limit=6&addressdetails=1&accept-language=it`
- **Reverse**: `https://nominatim.openstreetmap.org/reverse?lat=&lon=&format=json&addressdetails=1&accept-language=it`

Estrazione indirizzo da risposta Nominatim (`extractAddress`):
- `comune`: `address.city || address.town || address.village || address.municipality || address.city_district || address.suburb || address.hamlet || address.quarter`
- `provincia`: da `address["ISO3166-2-lvl6"]` o `["ISO3166-2-lvl5"]` (formato "IT-MI" → "MI"), fallback su `address.state_code`
- `indirizzo`: `address.road + address.house_number`

### 4.5 Menu Strumenti

Dropdown Bulma `is-hoverable is-right` nel toolbar della lista. Voci:
1. **Importa servizi da preaccreditati** — merge da `volontari/mezzi/materiali-preaccreditati` (campo `servizio`)
2. **Inserisci servizi obbligatori** — assicura presenza di `IN ATTESA DI SERVIZIO` e `USCITA DEFINITIVA`
3. **Importa servizi da accreditati** — merge da `volontari/mezzi/materiali` (campo `servizio`)
4. *(separatore)*
5. **Elimina tutti i servizi non obbligatori** — in rosso, con `confirm()` browser

Risultato mostrato in un banner sotto il toolbar: verde per successo, rosso per errore, con pulsante ✕ per chiuderlo.

## 5. WorkTableClient — pattern di utilizzo

```js
// lista
client.table("servizi").list({ include: INCLUDE, size: 2000 })

// creazione
client.table("servizi").create({ nome, ordine, ... })

// aggiornamento
client.table("servizi").update(id, { campo: valore })

// eliminazione
client.table("servizi").remove(id)

// verifica utilizzo (filtro corretto)
client.table("volontari").list({
  filters: [client.filter("servizio", "eq", nome)],
  include: ["id"],
  size: 1
})
```

**Importante**: usare sempre `filters: [client.filter(campo, "eq", valore)]` — la sintassi `filter: { campo: valore }` è silenziosamente ignorata.

## 6. Logica riordinamento drag & drop

Al drop, la funzione `applyReorder` riceve `fromId` e `toId`:
1. Trova gli indici nella lista ordinata corrente
2. Sposta l'elemento `from` nella posizione di `to` (splice)
3. Riassegna `ordine` come `(indice + 1) * 10` a tutti i servizi non protetti
4. Chiama `client.table("servizi").update` per ogni servizio il cui ordine è cambiato

## 7. File

| File | Ruolo |
|---|---|
| `app-service-manager.js` | Entry point: carica lit-html, WorkTableClient, importa e monta la view |
| `views/service-manager/index.js` | Intera logica e template della SPA (~1100 righe) |
| `service-manager.inc.php` | Mount PHP tramite `CamilaUserInterface::mountMiniApp` |
| `dashboard_service-manager.inc.php` | Alias PHP per dashboard (include service-manager.inc.php) |
