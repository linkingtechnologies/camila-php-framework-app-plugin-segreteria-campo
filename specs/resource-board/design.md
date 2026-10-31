# Design — resource-board

**Pulsante dashboard:** "Gestione operativa evento"

## 1. Struttura

Single-view SPA (nessun wizard). Tutti i dati vengono caricati al mount e ricaricati integralmente dopo ogni operazione di scrittura.

```
[Toolbar riga 1: cerca · raggruppa per · filtro provincia · filtro org]
[Toolbar riga 2: 👤 N · 🚚 N · 🛠 N (sx) — ‹ · +N → · › · 🔄 Aggiorna (dx)]
[Banner giallo — filtro attivo, "stai vedendo X di Y risorse" · ✕ rimuovi filtro]
[Barra servizi: chip blu attivi (drop target) | +N ▼ chip gialli non assegnati (nascosti, auto-visibili durante drag)]
[Kanban ──────────────────────────────────────────── scroll orizzontale →]
  [ ⏳ IN ATTESA          👥 N ]  [ 📋 SERVIZIO A         👥 N ]  …
  [  👤 N  🚛 N  🔧 N        ]  [  👤 N  🚛 N  🔧 N        ]
  [  card gruppo              ]  [   card gruppo             ]
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
| Attivazione di una squadra dichiarata su un intervento | lettura e `.update` di `servizi` (`squadre-attivate`, `organizzazioni-attivate`), vedi §Squadra dichiarata su un intervento |

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
- **Header colonna kanban**: mostra nome servizio (con icona ⏳ o 📋) + badge `ri-team-line N` (numero di card/organizzazioni). Sotto l'header una riga secondaria con `ri-user-line N · ri-truck-line N · ri-tools-line N` riporta il totale delle risorse aggregate in quella colonna (calcolato con `reduce` su `colCards`, nessuna chiamata API aggiuntiva). I contatori a zero vengono omessi; se la colonna è vuota compare `—`.
- **Colonna IN ATTESA DI SERVIZIO**: sempre presente come prima colonna, sempre drop target, mai inclusa in `availableServices`.
- **USCITA DEFINITIVA**: esclusa sia dal filtro `isActive` che dalla lista `serviziTable`.
- **`nowDateTime()`**: `new Date().toLocaleString("sv-SE", { hour12: false }).replace(",", "")` → formato `YYYY-MM-DD HH:MM:SS`, coerente con le altre SPA del progetto.
- **ID risorsa nei `<tr>`**: ogni riga del dettaglio esposto porta `data-id="${r.id}"` per future integrazioni (link alla scheda risorsa) senza richiedere modifiche al loading.
- **Combobox squadra**: `<input type="text" list="gor-squadre-list">` + `<datalist>`. Accetta testo libero per squadre nuove non ancora presenti nel sistema.
- **`distinctSquadre`**: calcolato in `rebuildDerived()` dai dati già in memoria (nessuna chiamata API aggiuntiva), come `distinct` del campo `squadra` su tutte le risorse attive.
- **Barra servizi**: sempre visibile sopra il kanban. I chip blu (attivi) sono anch'essi drop target (oltre alle colonne kanban): `dragover`/`dragleave`/`drop` reindirizzano al servizio corrispondente. I chip gialli (non assegnati) sono drop target attivi; appaiono solo dopo click sul bottone `+N ▼` (`showAvailable`) **oppure automaticamente durante un drag** (`dragPayload !== null`), così da rendere sempre raggiungibili i servizi non assegnati senza dover espandere prima.
- **Toolbar a due righe**: la toolbar è divisa in due righe distinte. Riga 1: cerca, raggruppa per, filtro provincia, filtro organizzazione. Riga 2: contatore risorse (sx) + controlli navigazione kanban + pulsante Aggiorna (dx).
- **Contatore in toolbar**: la riga 2 della toolbar mostra tre contatori, e **cambiano con la vista**:

  | Vista | Contatori | Calcolati su |
  |---|---|---|
  | Risorse registrate | `ri-user-line N · ri-truck-line N · ri-tools-line N` | `allVolontari`, `allMezzi`, `allMateriali` |
  | Squadre dichiarate | `ri-group-line N · ri-user-line N · ri-truck-line N` | `allSquadreDich`: quante squadre, e la **somma** di `n-volontari` e `n-mezzi` |

  Nella vista squadre il terzo numero non è `attrezzature`: su una squadra è testo libero, non un conteggio (vedi `specs/team-manager/design.md`), quindi quel posto tiene il numero di squadre. Senza questa distinzione il contatore mostrava le sole risorse registrate anche guardando le squadre, cioè `0 · 0 · 0` proprio negli eventi senza campo di ammassamento — dove le squadre dichiarate sono l'unica registrazione che esiste.

  In entrambe le viste i contatori sommano **tutto il caricato**, non il filtrato: a dire quanto si sta vedendo è il banner del filtro attivo, che riporta il dettaglio per tipo accanto al totale delle risorse.
- **Navigazione kanban**: la riga 2 della toolbar mostra, a destra del contatore, i controlli di scorrimento orizzontale: freccia `‹` (visibile solo se si è già scrollato), badge `+N →` (numero di colonne non visibili a destra, cliccabile per scrollare avanti), freccia `›` (visibile solo se c'è contenuto a destra). La visibilità è aggiornata da `attachKanbanScroll()` tramite scroll listener e ResizeObserver. Quando si è in fondo le frecce/badge scompaiono. Sul bordo destro del kanban è presente anche un gradient bianco (`::before`) e uno spacer fisso di 108px come ultima colonna flex per effetto "peek".
- **Filtro org/provincia**: `filterOrg` e `filterProvincia` sono filtri client-side applicati in `rebuildDerived()`. I valori distinti (`distinctOrgs`, `distinctProvince`) sono calcolati sull'intero dataset (pre-filtro) per popolare i dropdown. Quando almeno un filtro è attivo compare un banner giallo con il contatore "stai vedendo X di Y (👤 N · 🚚 N · 🛠 N) risorse" e un pulsante ✕ per rimuovere il filtro.
- **Modale cambio-risorsa**: ogni riga del dettaglio espanso porta un pulsante icona `ri-swap-line` che apre la modale `cambio-risorsa` per spostare quella singola risorsa senza trascinare. Il pulsante ha `@dragstart stopPropagation` per non interferire con il drag di riga.
- **Pulsanti azione card**: in fondo ad ogni card compaiono due pulsanti icon-only (nessun testo): `ri-swap-line` (`is-info is-light`) per aprire la modale cambio-servizio, `ri-team-line` (`is-warning is-light`) per aprire la modale cambio-squadra. Il tooltip è esposto via `title`. Nessun testo visibile per ridurre l'ingombro.


## Squadre dichiarate

Le squadre dichiarate (tabella `squadre-dichiarate`) sono una **quarta risorsa**:
hanno `servizio` come volontari, mezzi e materiali, quindi si spostano fra
servizi allo stesso modo.

### Due controlli distinti: vista e raggruppamento

In toolbar ci sono **due selettori**, non uno:

| Controllo | Valori | Cosa decide |
|---|---|---|
| **Mostra** | Risorse registrate / Squadre dichiarate / Disponibilità nel tempo | *cosa* si sta guardando |
| **Raggruppa** | Organizzazione / Squadra | *come* e' raggruppato |

Il secondo **compare solo nella vista risorse**: nella vista squadre dichiarate
c'e' un solo raggruppamento possibile, una scheda per squadra, quindi un
selettore sarebbe finto.

Le squadre dichiarate non sono un terzo modo di raggruppare le stesse risorse:
sono **un altro insieme**. Tenerle come terzo pulsante accanto a Organizzazione e
Squadra mescolava due concetti in un controllo solo.

Internamente `groupBy` riceve `"squadre-dichiarate"` quando la vista e' quella,
cosi' `buildCards` resta una funzione sola.

Le squadre dichiarate **non compaiono** negli altri due raggruppamenti. Mescolare
in una stessa scheda risorse registrate e un'entita' squadra renderebbe ambiguo
il conteggio della scheda — sei volontari registrati piu' una squadra da sei
sono sei o dodici? La vista che affianca dichiarati e registrati esiste gia', ed
e' il pannello Squadre dichiarate in `intervention-manager`.

### Una scheda per squadra

```
┌ IDRO 1 — MONTODINE ────┐  ┌ MOTOSEGHE 3 — MONTODINE ┐
│ 6👤 2🚚                │  │ 5👤 1🚚                 │
│ G.C. DOVERA            │  │ G.C. DOVERA             │
└────────────────────────┘  └─────────────────────────┘
```

`groupValue` e' il **nome della squadra**, non le sue organizzazioni. Una squadra
e' gia' un gruppo di persone: raggrupparla per organizzazione aggiungeva un
livello di troppo, e una squadra congiunta avrebbe avuto per titolo due sigle
unite. Le organizzazioni diventano una riga dentro la scheda.

Il campo `card.squadra` contiene il record quando la scheda e' di questo tipo,
`null` altrimenti: e' il discriminante usato in tutta la vista.

### Differenze di comportamento

| | Scheda normale | Scheda squadra dichiarata |
|---|---|---|
| Cambio servizio | per tipo selezionato | l'intera squadra, nessuna scelta di tipi; se la destinazione e' un intervento, la squadra e le sue organizzazioni vi vengono aggiunte (§Squadra dichiarata su un intervento) |
| Cambio squadra | disponibile | **nascosto** — la squadra non ha un campo `squadra`, lo *e'* |
| Movimento scritto | `VOLONTARIO` / `MEZZO` / `MATERIALE` | `SQUADRA DICHIARATA`, con le organizzazioni come `gruppo` |
| Conteggi mostrati | risorse presenti | conteggi **dichiarati** (`n-volontari`, `n-mezzi`), anche nei subtotali sotto l'intestazione di colonna; nessun subtotale materiali |
| Marcata come vuota | nessuna risorsa dentro | nessuna consistenza dichiarata |

### Squadra dichiarata su un intervento

Dopo l'`update` di `squadre-dichiarate.servizio` e la riga `mov-risorse`,
`applyServiceChange` chiama `attivaSquadraSuServizio(client, sq, newService)`:

1. esce subito se `newService` e' `IN ATTESA DI SERVIZIO` o `USCITA DEFINITIVA`;
2. cerca in `servizi` la riga con `nome == newService` (`filters` con `eq`); se
   non c'e' e' solo un'etichetta delle risorse, e non fa nulla;
3. aggiunge `sq.nome` a `squadre-attivate` (stringa con `", "`) se non c'e' gia';
4. **unisce** `sq.organizzazioni` a `organizzazioni-attivate`: insieme delle
   organizzazioni gia' presenti e di quelle della squadra, deduplicato, ordinato
   con `localeCompare(…, "it")`, unito con `", "`. Non e' la derivazione di
   `intervention-manager` §8b (che ricalcola tutto dai cataloghi): qui la squadra
   e' dichiarata, quindi basta il suo campo `organizzazioni`;
5. scrive con un solo `update` e **solo i campi cambiati**; se nulla cambia non
   scrive.

**Non toglie mai.** Spostare la squadra altrove non la rimuove dall'intervento
precedente: `squadre-attivate` e' storia (chi ha lavorato li'), `servizio` e'
stato corrente (AGENTS.md §Fotografia o riferimento).

**Non fa fallire lo spostamento.** La funzione non lancia: restituisce `null` o
un testo di avviso, che i due chiamanti (`onDrop`, `confirmServiceChange`)
mettono in `notice`, mostrato come `notification is-warning` in cima alla
toolbar con un pulsante di chiusura. `error` resta riservato ai fallimenti che
bloccano.

**Nessun movimento doppio.** `intervention-manager` §16 scrive `mov-risorse` solo
per le squadre *aggiunte* rispetto al valore salvato; se il kanban le ha gia'
aggiunte, al salvataggio non risultano nuove. Resta il rischio opposto: con la
scheda intervento aperta e modificata, il salvataggio sovrascrive
`squadre-attivate` con la sua copia e la squadra aggiunta dal kanban sparisce.

**Il tag rosso non e' lo stesso tag.** Una scheda squadra non contiene mai
risorse registrate — `buildCards` tiene apposta separati i due insiemi — quindi
`totalCount` e' sempre 0 e il "vuoto" delle schede normali compariva su *tutte*
le squadre, comprese quelle che dichiarano venti persone. Su una squadra la
condizione giusta e' `n-volontari + n-mezzi === 0`, e l'etichetta e' **nessuna
consistenza**. `attrezzature` non entra nella somma: e' testo libero, non un
conteggio.

### Filtri

Il filtro per organizzazione confronta **per contenuto**, perche'
`organizzazioni` e' plurale. Il filtro per provincia **esclude** le squadre
dichiarate: non hanno quel campo.

### Filtro di attivita': diverso dalle risorse registrate

Volontari, mezzi e materiali compaiono solo se **attivi**: data inizio attestato
valorizzata, data fine vuota, servizio diverso da `USCITA DEFINITIVA`.

Le squadre dichiarate **non passano da quel filtro sulle date**. Non attraversano
il check-in — nelle emergenze senza campo di ammassamento non c'e' un arrivo da
registrare — quindi le date di attestato possono restare vuote per sempre.
Applicare lo stesso criterio le farebbe sparire tutte.

**Nemmeno `USCITA DEFINITIVA` le esclude**, al contrario delle risorse
registrate. Il motivo sta nel paragrafo qui sotto: per una squadra quella
colonna non e' un archivio, e' l'unico posto dove l'uscita viene registrata.

### La colonna di uscita, solo nella vista squadre

Nella vista squadre dichiarate `USCITA DEFINITIVA` e' **sempre** una colonna:
`rebuildDerived()` la aggiunge ad `activeServices` e la toglie da
`availableServices`.

**Ovunque compaia e' l'ultima a destra.** Lo spostamento in coda e' un passo a
se', fuori dal ramo della vista: non e' una proprieta' della vista squadre ma
della colonna, che e' il punto da cui si esce dalla bacheca. In mezzo a due
servizi attivi sarebbe un bersaglio di drag come gli altri. L'ordine vale anche
per i chip della barra servizi, che scorrono la stessa lista.

Serve perche' una squadra **non passa dal check-out massivo** — quel flusso
lavora su `volontari`, `mezzi` e `materiali` — e da quando la scheda
dell'anagrafica non espone piu' `servizio` (vedi `specs/team-manager/design.md`),
trascinarla in quella colonna e' l'unico modo di segnare che se n'e' andata.

**Nella vista risorse la colonna non va aggiunta.** Li' l'uscita la fa il
check-out, che oltre al servizio scrive `data-fine-attestato`,
`data/ora-uscita-definitiva` e il movimento: un drag scriverebbe solo il
servizio, lasciando la risorsa a meta' strada.

Conseguenza sui contatori di testata: le squadre a `USCITA DEFINITIVA` restano
caricate e visibili nella loro colonna, ma **non entrano nei totali** — sarebbe
gente che non c'e' piu'. Il contatore lavora su `squadreInCampo`.

### La finestra di disponibilita' sulla card

Una card squadra mostra, sotto le organizzazioni, la finestra dichiarata nei
campi `inizio-disponibilita` e `fine-disponibilita`, con l'icona calendario:

| Campi valorizzati | Testo |
|---|---|
| entrambi | `31/10 08:00 → 02/11 20:00` |
| solo inizio | `dal 31/10 08:00` |
| solo fine | `fino al 02/11 20:00` |
| nessuno | la riga non compare |

Il formato lo produce `fmtDisponibilita()` di `timeline.js`, che e' anche il
punto in cui si leggono le date: la card e la linea temporale non possono quindi
dire cose diverse. Una data **senza ora** vale la giornata intera: come inizio
e' la mezzanotte, come fine e' l'ultimo secondo del giorno, altrimenti l'ultimo
giorno verrebbe tagliato.

I due campi sono nell'`include` del caricamento di `squadre-dichiarate`.

### La vista "Disponibilita' nel tempo"

Terza voce di **Mostra**: `vista === "disponibilita"`. E' una vista **di sola
lettura** sugli stessi dati delle squadre dichiarate, disegnati su una linea
temporale invece che per servizio. Non si trascina niente.

**Il codice sta in `views/resource-board/timeline.js`**, non in `index.js`: il
file della bacheca ha gia' piu' di millecinquecento righe. Segue il contratto dei
moduli condivisi di AGENTS.md — esporta `createTimeline({ html, rerender })`,
che non renderizza da se' e restituisce `{ template, setZoom }` — e si importa
**dinamicamente con la versione in coda**, perche' la query dell'entry point non
si propaga ai moduli importati.

```js
const timelineMod = await import(`./timeline.js?v=${VERSION}`);
const timeline = timelineMod.createTimeline({ html, rerender });
// ...
timeline.template({ squadre: squadreForTimeline() })
```

**Cosa viene disegnato.** Una riga per squadra, ordinate per inizio (chi e'
disponibile "da sempre" — ha solo la fine — per prime). La barra va da
`inizio-disponibilita` a `fine-disponibilita`:

| Caso | Resa |
|---|---|
| inizio e fine | barra piena |
| solo inizio | barra fino al bordo destro, con `›` |
| solo fine | barra dal bordo sinistro, con `‹` |
| nessuna data | **non c'e' barra**: la squadra sta nell'elenco *Senza finestra di disponibilita'* sotto la griglia |
| fine prima dell'inizio | **non si disegna**: sta nell'elenco *Date incoerenti*, perche' una barra invertita direbbe una cosa falsa |

Colore per stato rispetto ad **adesso**: verde *in corso*, blu *da iniziare*,
grigio *terminata*. Una linea rossa verticale segna l'ora corrente. Passando
col mouse su una barra, il `title` riporta nome, organizzazioni, finestra e
consistenza dichiarata.

**Quali squadre.** Quelle gia' filtrate per organizzazione (`squadreFiltered`,
calcolato da `rebuildDerived()`), piu' la casella di ricerca su nome e
organizzazioni. **Sono escluse** quelle a `USCITA DEFINITIVA`: una squadra uscita
non e' piu' disponibile, e resterebbe una barra verde su chi se n'e' andato. Il
filtro per provincia svuota la vista, come nella vista squadre: le squadre non
hanno provincia.

**Asse.** Va dal primo giorno che compare in una data (o in "adesso") alla fine
dell'ultimo, in giorni interi. Le posizioni sono **percentuali** della durata
totale, quindi lo stesso markup vale a ogni zoom: cambia solo la larghezza della
traccia.

| Zoom | Larghezza della traccia | Tacche |
|---|---|---|
| Tutto | 100% del contenitore (minimo 600px) | un'etichetta ogni N giorni, in modo che non si sovrappongano |
| Settimana | 140px per giorno | giorni |
| 3 giorni | 320px per giorno | giorni |
| Giorno | 900px per giorno | giorni, piu' tacche ogni 6 ore con l'etichetta oraria |

La colonna delle squadre e l'intestazione dell'asse sono **appiccicose**
(`position:sticky`): a zoom alto la griglia scorre in orizzontale e le etichette
restano. Anche l'etichetta del giorno si attacca al bordo sinistro dentro la
propria cella, cosi' a zoom "Giorno" si legge sempre di che giorno si tratta
anche quando la tacca di mezzanotte e' fuori schermo. Per quell'offset `left`
vale `240px + 4px`: gli offset sticky si misurano dal contenitore che scorre.

**Dall'elenco alla squadra.** Nei due elenchi sotto la griglia ogni squadra con un
`id` e' un collegamento a `?dashboard=team-manager&squadra=<id>`, in una **nuova
scheda**: la linea temporale conserva zoom e posizione di scorrimento, e al
ritorno basta ricaricare per vedere la finestra appena impostata. Una squadra
senza `id` resta un'etichetta semplice. Si crea da dove serve e si gestisce dove
appartiene: la modifica non e' duplicata qui.

**Le guide verticali** stanno in **un solo strato** per tutta la griglia, non una
per cella: sono i giorni (e le 6 ore), non righe x giorni.

**Differenze rispetto alle altre due viste.**

* niente barra servizi, niente kanban, niente drag & drop;
* i pulsanti di scorrimento del kanban nella riga 2 sono nascosti;
* i contatori di testata sono quelli delle squadre, come nella vista squadre;
* il banner del filtro attivo conta **squadre**, non risorse.

**Gli stili stanno nel template** del modulo, in un `<style>`, senza
interpolazioni: i due valori numerici condivisi con il JS (`240px` e `34px`)
sono ripetuti come letterali, e `LABEL_W`/`HEAD_H` lo ricordano in un commento.

### Tabella assente

Il caricamento di `squadre-dichiarate` ha un `.catch(() => null)` dedicato: se la
tabella non esiste, la bacheca funziona come prima e il terzo raggruppamento
risulta vuoto.
