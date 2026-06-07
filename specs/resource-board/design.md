# Design — resource-board

## 1. Struttura

Single-view SPA (nessun wizard). Tutti i dati vengono caricati al mount e ricaricati integralmente dopo ogni operazione di scrittura.

```
[Toolbar: cerca · raggruppa per · filtro provincia · filtro org · contatore risorse · aggiorna]
[Banner giallo — filtro attivo, "stai vedendo X di Y risorse" · ✕ rimuovi filtro]
[Barra servizi: chip blu attivi (drop target) | +N ▼ chip gialli non assegnati (nascosti, auto-visibili durante drag)]
[Kanban ──────────────────────────────────────────── scroll orizzontale →]
  [ ⏳ IN ATTESA ]  [ 📋 SERVIZIO A ]  [ 📋 SERVIZIO B ]  …
  [  card gruppo ]  [   card gruppo ]  [   card gruppo ]
[Modal cambio-servizio | Modal cambio-squadra | Modal cambio-risorsa]
```

## 2. State shape

```js
{
  // caricamento
  loading:           Boolean,          // true durante load e reload
  error:             Any | null,       // errore API grezzo

  // filtri toolbar
  search:            String,           // testo libero
  groupBy:           "organizzazione" | "squadra",
  filterOrg:         String,           // "" = nessun filtro, altrimenti nome org normalizzato
  filterProvincia:   String,           // "" = nessun filtro, altrimenti nome provincia normalizzato

  // dati grezzi dal server
  allVolontari:      Array,
  allMezzi:          Array,
  allMateriali:      Array,
  serviziTable:      Array<String>,    // nomi da tabella `servizi`

  // derivati (ricalcolati in rebuildDerived)
  cards:             Array<Card>,
  activeServices:    Array<String>,    // WAITING sempre primo, poi alfabetico
  availableServices: Array<String>,    // in serviziTable ma senza risorse
  distinctSquadre:   Array<String>,    // distinct squadra dalle risorse filtrate
  distinctOrgs:      Array<String>,    // distinct organizzazione da TUTTE le risorse (pre-filtro)
  distinctProvince:  Array<String>,    // distinct provincia da TUTTE le risorse (pre-filtro)

  // UI state
  expandedCards:     Set<String>,      // card.key delle card aperte
  showAvailable:     Boolean,          // toggle chip servizi non assegnati

  // drag & drop
  dragPayload:       DragPayload | null,
  dropTarget:        String | null,    // service string sotto il cursore

  // modale
  modal:             ModalState | null
}

// Card
{
  key:        String,    // `${groupValue}|||${service}`
  groupValue: String,    // nome organizzazione o squadra
  service:    String,    // servizio corrente
  volontari:  Array,     // subset risorse attive in questo (gruppo, servizio)
  mezzi:      Array,
  materiali:  Array
}

// DragPayload
{
  mode:        "card" | "category" | "resource",
  card:        Card,
  fromService: String,
  types:       Set<String>,    // usato per mode "card" e "category"
  category:    String,         // usato per mode "category" e "resource"
  resource:    Object          // usato per mode "resource"
}

// ModalState — cambio-servizio
{
  type:          "cambio-servizio",
  card:          Card,
  newService:    String,
  selectedTypes: Set<String>,   // sottoinsieme di {"volontari","mezzi","materiali"}
  busy:          Boolean,
  error:         Any | null
}

// ModalState — cambio-squadra
{
  type:          "cambio-squadra",
  card:          Card,
  newSquadra:    String,        // testo libero o valore da combobox
  selectedTypes: Set<String>,
  busy:          Boolean,
  error:         Any | null
}

// ModalState — cambio-risorsa (singola risorsa via icona ri-swap-line)
{
  type:        "cambio-risorsa",
  card:        Card,
  category:    String,      // "volontari" | "mezzi" | "materiali"
  resource:    Object,      // la singola risorsa da spostare
  fromService: String,      // servizio corrente della risorsa
  newService:  String,      // servizio di destinazione selezionato
  busy:        Boolean,
  error:       Any | null
}
```

## 3. Tabelle coinvolte

| Operazione | Tabella WorkTable |
|---|---|
| Lettura risorse attive | `volontari`, `mezzi`, `materiali` |
| Lettura servizi configurati | `servizi` |
| Aggiornamento `servizio` | `volontari` / `mezzi` / `materiali` (`.update(id, {...})`) |
| Aggiornamento `squadra` | `volontari` / `mezzi` / `materiali` (`.update(id, {...})`) |
| Scrittura storico movimenti | `mov-risorse` (`.create({...})`) |

## 4. Logica di merge

Non applicabile — le tre tabelle risorse non vengono mai fuse tra loro. Ciascuna è letta, filtrata e raggruppata separatamente.

## 5. Payload

### Filtro risorse attive (client-side)

```js
isActive(r) =>
  norm(r["data-inizio-attestato"]) !== ""
  && norm(r["data-fine-attestato"]) === ""
  && norm(r["servizio"]) !== "USCITA DEFINITIVA"
```

### Campi richiesti per lettura (`include`)

**`volontari`:**
`id, cognome, nome, codice-fiscale, organizzazione, provincia, squadra, servizio, data-inizio-attestato, data-fine-attestato`

**`mezzi`:**
`id, targa, codice-inventario, categoria, marca, modello, organizzazione, provincia, squadra, servizio, data-inizio-attestato, data-fine-attestato`

**`materiali`:**
`id, id-materiale, codice-inventario, categoria, tipologia, organizzazione, provincia, squadra, servizio, data-inizio-attestato, data-fine-attestato`

**`servizi`:** `nome`

### Update — cambio servizio

```js
client.table("volontari" | "mezzi" | "materiali").update(r.id, { servizio: newService })
```

### Update — cambio squadra

```js
client.table("volontari" | "mezzi" | "materiali").update(r.id, { squadra: newSquadra })
```

### Create `mov-risorse` — cambio servizio

```js
{
  "data/ora":     "YYYY-MM-DD HH:MM:SS",   // nowDateTime() formato sv-SE
  "gruppo":       groupValue,               // nome organizzazione o squadra
  "risorsa":      String,                   // vedi sotto
  "tipo-risorsa": "VOLONTARIO" | "MEZZO" | "MATERIALE",
  "da":           oldService,
  "a":            newService
}
// risorsa:
//   volontario → "Cognome Nome"
//   mezzo      → targa
//   materiale  → id-materiale || codice-inventario || "—"
```

### Create `mov-risorse` — cambio squadra

```js
{
  "data/ora":     "YYYY-MM-DD HH:MM:SS",
  "gruppo":       groupValue,
  "risorsa":      String,                   // stessa logica di cui sopra
  "tipo-risorsa": "VOLONTARIO" | "MEZZO" | "MATERIALE",
  "da":           "SQUADRA: <vecchia squadra | —>",
  "a":            "SQUADRA: <nuova squadra>"
}
// Il prefisso "SQUADRA: " distingue i mov di squadra da quelli di servizio
// sullo stesso schema di tabella.
```

## 6. Logica di classificazione

### Colonna di appartenenza della card

```js
norm(r.servizio) || "IN ATTESA DI SERVIZIO"
// Risorse con servizio vuoto finiscono sempre in IN ATTESA DI SERVIZIO
```

### Chiave di raggruppamento

```js
groupBy === "squadra"
  ? norm(r.squadra) || norm(r.organizzazione) || "—"
  : norm(r.organizzazione) || "—"
// Se squadra è vuota, il fallback è organizzazione.
// Conseguenza: in vista Squadra le card possono avere chiave mista
// (alcune per squadra, altre per organizzazione) se il campo non è
// compilato uniformemente.
```

### Costruzione colonne kanban

```js
// activeServices:
//   1. sempre "IN ATTESA DI SERVIZIO" come primo elemento
//   2. poi i valori distinct di card.service (≠ WAITING), ordinati alfabeticamente

// availableServices:
//   serviziTable.filter(s => !fromResources.has(s) && s !== WAITING)
//   ordinati alfabeticamente
//   — "USCITA DEFINITIVA" è escluso a monte dal filtro isActive
```

## 7. Altre note tecniche

- **Caricamento**: `Promise.all` su 4 chiamate parallele. Un errore su una qualsiasi blocca il rendering del kanban.
- **Reload dopo scrittura**: dopo ogni operazione (drag, modale) viene eseguito un reload completo (`reloadData`) per riallineare il kanban allo stato server. Non c'è ottimistic update.
- **Drag & Drop**: HTML5 native DnD API, senza librerie esterne. Il payload operativo è tenuto in memoria nella closure (`dragPayload`); il `dataTransfer` porta solo una stringa di fallback non usata dalla logica.
- **Drag risorsa singola**: le righe `<tr>` nel dettaglio espanso sono `draggable="true"` con `stopPropagation()` sul `dragstart` per evitare che il drag propaghi alla card padre.
- **Drag categoria**: l'header di sezione (`👤 Volontari ⠿`) è anch'esso `draggable="true"` con `stopPropagation()`.
- **Colonna IN ATTESA DI SERVIZIO**: sempre presente come prima colonna, sempre drop target, mai inclusa in `availableServices`.
- **USCITA DEFINITIVA**: esclusa sia dal filtro `isActive` che dalla lista `serviziTable`.
- **`nowDateTime()`**: `new Date().toLocaleString("sv-SE", { hour12: false }).replace(",", "")` → formato `YYYY-MM-DD HH:MM:SS`, coerente con le altre SPA del progetto.
- **ID risorsa nei `<tr>`**: ogni riga del dettaglio esposto porta `data-id="${r.id}"` per future integrazioni (link alla scheda risorsa) senza richiedere modifiche al loading.
- **Combobox squadra**: `<input type="text" list="gor-squadre-list">` + `<datalist>`. Accetta testo libero per squadre nuove non ancora presenti nel sistema.
- **`distinctSquadre`**: calcolato in `rebuildDerived()` dai dati già in memoria (nessuna chiamata API aggiuntiva), come `distinct` del campo `squadra` su tutte le risorse attive.
- **Barra servizi**: sempre visibile sopra il kanban. I chip blu (attivi) sono anch'essi drop target (oltre alle colonne kanban): `dragover`/`dragleave`/`drop` reindirizzano al servizio corrispondente. I chip gialli (non assegnati) sono drop target attivi; appaiono solo dopo click sul bottone `+N ▼` (`showAvailable`) **oppure automaticamente durante un drag** (`dragPayload !== null`), così da rendere sempre raggiungibili i servizi non assegnati senza dover espandere prima.
- **Filtro org/provincia**: `filterOrg` e `filterProvincia` sono filtri client-side applicati in `rebuildDerived()`. I valori distinti (`distinctOrgs`, `distinctProvince`) sono calcolati sull'intero dataset (pre-filtro) per popolare i dropdown. Quando almeno un filtro è attivo compare un banner giallo con il contatore "stai vedendo X di Y risorse" e un pulsante ✕ per rimuovere il filtro.
- **Modale cambio-risorsa**: ogni riga del dettaglio espanso porta un pulsante icona `ri-swap-line` che apre la modale `cambio-risorsa` per spostare quella singola risorsa senza trascinare. Il pulsante ha `@dragstart stopPropagation` per non interferire con il drag di riga.
