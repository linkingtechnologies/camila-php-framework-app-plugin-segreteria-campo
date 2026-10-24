# Design: Gestione interventi

**Pulsante dashboard:** "Interventi" (box "Operatività" di `dashboard_m0.inc.php`)

## 1. Struttura

SPA a pannello diviso, nessun wizard. I dati sono caricati al mount e ricaricati
dopo ogni scrittura.

```
[Toolbar: 🔍 Cerca… | filtro stato | + Nuovo | ↺ ]
┌────────────────────┬────────────────────────────────────────────┐
│  Elenco interventi │  Scheda                                    │
│  (320px, scroll)   │  (flex:1, scroll)                          │
│                    │                                            │
│  ● NOME            │  [pulsantiera: Salva | Elimina | Nuovo]    │
│    comune · data   │                                            │
│    [stato]         │  ▸ Intervento   nome, oggetto              │
│                    │  ▸ Segnalazione data/ora, rif. VVF         │
│                    │  ▸ Segnalante   nome, qualifica, indir.,   │
│                    │                 telefono                   │
│                    │  ▸ Luogo        via, comune, provincia     │
│                    │  ▸ Tempi        sopralluogo, inizio, fine  │
│                    │  ▸ Squadre e    squadre attivate, operatori │
│                    │    referente    a supporto, referente       │
│                    │  ▸ Cronologia   note (textarea)            │
└────────────────────┴────────────────────────────────────────────┘
```

## 1b. Vista kanban

Alternativa all'elenco, selezionabile da due pulsanti nell'intestazione. Una
colonna per valore di `stato`, schede trascinabili fra colonne.

```
[ Gestione interventi ]                    [ Kanban | Elenco ]
┌────────────┬────────────┬────────────┐
│ Segnalato 3│ In corso  2│ Concluso  7│   <- intestazione colorata + conteggio
│ ┌────────┐ │ ┌────────┐ │ ┌────────┐ │
│ │ NOME   │ │ │ NOME   │ │ │ NOME   │ │   <- trascinabile
│ │ comune │ │ │ comune │ │ │ comune │ │
│ │ data   │ │ │ data   │ │ │ data   │ │
│ │[dedotto]│ │ └────────┘ │ └────────┘ │
│ └────────┘ │            │            │
└────────────┴────────────┴────────────┘
```

Comportamento, modellato su `views/requests-board/index.js`:

* **Trascinamento** — al rilascio si scrive `stato` con il valore della colonna
  di destinazione, con aggiornamento ottimistico: la scheda si sposta subito e
  la chiamata parte dopo. Se fallisce, il valore precedente viene ripristinato e
  la lista ricaricata, perche' la verita' e' quella del server.
* **Clic su una scheda** — porta alla vista elenco con quell'intervento
  selezionato e la scheda aperta.
* **Badge "dedotto"** — marca le schede il cui `stato` e' vuoto e viene dedotto
  da `inizio`/`fine` (vedi §6). Trascinandole, lo stato diventa esplicito.
* **Filtri condivisi** — ricerca e filtro di stato valgono per entrambe le
  viste: `viewKanban()` parte da `filtered()`, la stessa dell'elenco.
* Il colore di colonna e del bordo sinistro delle schede viene da
  `STATO_COLOR`, la stessa mappa del pallino nell'elenco.

## 2. State shape

Tutto nella closure di `InterventionManager()`. `state` non è usato: vista
singola, niente da preservare tra render.

```js
let records    = [];      // interventi caricati
let loading    = false;
let error      = null;    // { status, code, message, kind, raw }
let retrying   = false;

let search     = "";
let filtroStato = "";     // "" | "Segnalato" | "In corso" | "Concluso"
let vista      = "elenco";  // "elenco" | "kanban"
let dragId     = null;      // scheda in trascinamento
let dropTarget = null;      // colonna sotto il cursore

let selected   = null;    // record persistito selezionato, o null
let form       = {};      // bozza in modifica
let baseForm   = {};      // copia di riferimento per il dirty check

// creazione rapida in popup
let createDraft = null;   // null = popup chiusa
let createBusy  = false;
let createError = null;
let formBusy   = false;
let formError  = null;
let formSuccess = null;

let perms      = { canCreate: false, canUpdate: false, canDelete: false };

let deleteConfirm = false;
let deleteBusy    = false;
let deleteUsage   = null;   // null | { checking: true } | { v, m, mat }
let deleteBlocked = false;

let squadre       = [];     // catalogo squadre (valori distinti)
let squadreLoaded = false;

let cancelled = false;      // guardia contro render su root stale
```

## 3. Tabella e campi

Tabella principale: **`servizi`** — la stessa di `service-manager`. Filtro fisso
`intervento = "SI"`.

Tabelle secondarie: **`brogliaccio`** per le note cronologiche (§10),
**`richieste`** per le richieste collegate (§12), **`db-volontari`**
per la scelta del referente (§11).

| Campo | Blocco scheda | Note |
|---|---|---|
| `id` | — | chiave primaria |
| `nome` | Intervento | **obbligatorio**, chiave funzionale (vedi §7) |
| `descrizione` | Intervento | l'OGGETTO del cartaceo |
| `intervento` | — | forzato a `"SI"` in creazione |
| `stato` | Intervento | vocabolario della colonna, vedi §6 |
| `data-ora-segnalazione` | Segnalazione | `YYYY-MM-DD HH:MM:SS` |
| `riferimento-vvf` | Segnalazione | |
| `nome-segnalante` | Segnalante | |
| `qualifica-segnalante` | Segnalante | |
| `indirizzo-segnalante` | Segnalante | |
| `telefono-segnalante` | Segnalante | |
| `cognome-referente` | Squadre e referente | |
| `nome-referente` | Squadre e referente | |
| `telefono-referente` | Squadre e referente | dal campo `cellulare` dell'anagrafica |
| `indirizzo` | Luogo | la VIA del cartaceo |
| `comune` | Luogo | |
| `provincia` | Luogo | sigla 2 lettere |
| `data/ora-sopralluogo` | Tempi | **attenzione alla barra** nel nome |
| `inizio` | Tempi | `YYYY-MM-DD HH:MM:SS` |
| `fine` | Tempi | `YYYY-MM-DD HH:MM:SS` |
| `squadre-attivate` | Squadre | stringa, valori separati da virgola |
| `operatori-a-supporto` | Squadre | |
| `note` | Cronologia | testo libero multilinea |

| `ordine` | Catalogo e mappa | numerico, inviato con `parseInt` |
| `lettera` | Catalogo e mappa | vocabolario fisso, vedi sotto |
| `colore` | Catalogo e mappa | vocabolario fisso, vedi sotto |
| `latitudine` | Catalogo e mappa | posizione sulla mappa |
| `longitudine` | Catalogo e mappa | posizione sulla mappa |

I cinque campi di catalogo sono **condivisi con `service-manager`**: servono alla
mappa di `map-center` e all'ordinamento, quindi vanno raggiungibili anche da qui.
I vocabolari di `lettera` e `colore` sono copiati identici da
`views/service-manager/index.js`: due elenchi divergenti darebbero due verita'
diverse sulla stessa colonna.

Il **selettore cartografico con ricerca indirizzo resta solo in
`service-manager`**: qui latitudine e longitudine sono due campi di testo. Non
duplico la modale Leaflet con geocoding Nominatim per non avere due
implementazioni della stessa cosa da tenere allineate.

**Incoerenza nei nomi da rispettare alla lettera**: `data/ora-sopralluogo` usa la
barra, `data-ora-segnalazione` no. Non è un refuso di questa spec, è come sono
definiti i campi.

## 4. Mappatura dal modulo cartaceo

Il foglio `INTERVENTI.xlsx` è disposto **per colonne**: la colonna B contiene le
etichette, ogni colonna successiva (D, E, F…) è un intervento. Una colonna = un
record.

| Etichetta cartacea | Campo |
|---|---|
| DATA + ORA | `data-ora-segnalazione` (il cartaceo li separa, il campo è unico) |
| N. RIFERIMENTO VVF | `riferimento-vvf` |
| OGGETTO | `descrizione` |
| VIA | `indirizzo` |
| COMUNE | `comune` |
| SEGNALANTE → NOME / QUALIFICA / INDIRIZZO / TELEFONO | i quattro `*-segnalante` |
| SQUADRE ATTIVATE | `squadre-attivate` |
| SOPRALLUOGO X DEFINIZIONE INTERVENTO | `data/ora-sopralluogo` |
| INIZIO INTERVENTO | `inizio` |
| FINE INTERVENTO | `fine` |
| blocco narrativo datato | `note` |

## 5. Payload

```js
// creazione
client.table("servizi").create({
  nome: "MONTODINE",
  intervento: "SI",              // sempre, altrimenti sparisce dal filtro
  descrizione: "…",
  "data-ora-segnalazione": "2026-09-26 08:48:00",
  "riferimento-vvf": "…",
  "nome-segnalante": "…", "qualifica-segnalante": "…",
  "indirizzo-segnalante": "…", "telefono-segnalante": "…",
  indirizzo: "…", comune: "…", provincia: "CR",
  "data/ora-sopralluogo": "…", inizio: "…", fine: "…",
  "squadre-attivate": "GC RIVOLTA, GC DOVERA",
  "operatori-a-supporto": "…",
  note: "…"
})

// aggiornamento
client.table("servizi").update(id, payload)   // stessi campi, senza intervento

// eliminazione
client.table("servizi").remove(id)
```

I campi vuoti sono inviati come `null`, non come stringa vuota e non omessi:
`null` azzera davvero il valore, ed e' la forma che usa gia' `service-manager`
sulla stessa tabella. `ordine` passa da `parseInt`.

## 6. Stato dell'intervento

Il vocabolario **non e' inventato dalla SPA**: e' definito nella colonna stessa,
di tipo `string-listofvalues`, con `listbox_options = ",Segnalato,In corso,Concluso"`.
La prima voce vuota e' l'opzione "nessun valore".

Lo stato mostrato e' quello scritto, e se manca viene dedotto da `inizio` e
`fine`:

```js
function statoDerivato(r) {
  if (!norm(r.inizio)) return "Segnalato";
  if (!norm(r.fine))   return "In corso";
  return "Concluso";
}

function statoOf(r) {
  return norm(r.stato) || statoDerivato(r);
}
```

Serve la deduzione perche' tutti i record esistenti hanno `stato` vuoto: senza,
l'elenco nascerebbe senza alcuno stato. Nella scheda l'opzione vuota e'
etichettata "Dedotto da inizio e fine", cosi' e' chiaro che non significa
"sconosciuto".

Impostare `inizio` o `fine` **non** cambia `stato`: se l'operatore lo ha scelto
esplicitamente, quella scelta resta.

## 7. `nome` è una chiave funzionale

`volontari.servizio`, `mezzi.servizio` e `materiali.servizio` contengono il
**nome** del servizio, non il suo id. Ne discendono due vincoli:

- il nome non può essere vuoto;
- rinominare un intervento **non** aggiorna le risorse che lo referenziano, che
  restano puntate al vecchio nome. La SPA avvisa in fase di rinomina.

Prima di eliminare si conta quante risorse lo usano, con lo stesso schema di
`service-manager`:

```js
const [v, m, mat] = await Promise.all([
  client.table("volontari").list({ filters: [client.filter("servizio","eq",nome)], size: 1 }),
  client.table("mezzi").list(     { filters: [client.filter("servizio","eq",nome)], size: 1 }),
  client.table("materiali").list( { filters: [client.filter("servizio","eq",nome)], size: 1 })
]);
```

Se il totale è maggiore di zero l'eliminazione è bloccata.

## 8. Catalogo delle squadre attivate

Il campo si alimenta da **tre cataloghi
distinti**, tenuti separati perche' sono due cose diverse:

| Gruppo | Sorgente | Valori reali osservati |
|---|---|---|
| Organizzazioni | `organizzazione` distinto su `volontari`, `mezzi`, `materiali` | `G.C. DOVERA`, `O.V. GERUNDO`, `G.I. CASTRUM LEONIS`, `O.V. IL GRIFONE` |
| Squadre | `squadra` distinto sulle stesse tre tabelle, **più** i `nome` della tabella `squadre-dichiarate` | `SQUADRA 2`, `SQUADRA 3`, `MMT BOBCAT`, `OPERATORE DRONE`, `RIBALTABILE 1` |

**Il cartaceo intende le organizzazioni.** Sotto "SQUADRE ATTIVATE" il modulo
riporta *GC RIVOLTA*, *GC DOVERA*, *GERUNDO Odv*, *GC CASTRUM*, che combaciano
con i valori di `organizzazione` e non con quelli di `squadra`. Il raggruppamento
interno resta comunque offerto come secondo gruppo, perche' un intervento puo'
attivare anche una squadra di campo.

Caricamento con `Promise.allSettled` su sei liste (tre tabelle x due colonne): se
una fallisce le altre restano utilizzabili.

`squadre-attivate` e' **una stringa**, non un array: valori separati da virgola e
spazio. In lettura si fa lo split, in scrittura il join. Un valore presente nel
record ma non piu' in nessuno dei due cataloghi resta mostrato, selezionato e
marcato "fuori lista", come prescrive AGENTS.md per i valori fuori catalogo.

## 9. Altre note tecniche

**Date e ore.** In tabella sono `YYYY-MM-DD HH:MM:SS`, negli input HTML
`datetime-local` sono `YYYY-MM-DDTHH:MM`. Due helper espliciti, `toInput()` e
`toDb()`, con `toDb()` che riporta i secondi a `:00`.

**Dirty detection.** Confronto di `JSON.stringify` fra `form` e `baseForm`, con
le chiavi ordinate — le chiavi sono un insieme fisso, quindi la serializzazione
è deterministica.

**Cambio di selezione con modifiche pendenti.** Se la bozza è sporca, il passaggio
a un altro intervento chiede conferma prima di scartare, come fa
`service-manager`.

**Permessi.** `client.table("servizi").permissions()` al mount; se fallisce, sola
lettura. È la seconda SPA del plugin a rispettare questa regola di AGENTS.md
dopo `resource-manager`.

**Caricamento.** `list()` con `include` esplicito e `size: 2000`, filtro
`intervento = "SI"` server-side. Ordinamento client-side per
`data-ora-segnalazione` decrescente, con sort stabile e indice originale come
tiebreaker: il campo può essere vuoto su record vecchi.

**Async render safety.** Flag `cancelled` impostato quando serve, controllato
prima di ogni `rerender()` che segue un `await`.


## 10. Note brogliaccio

La cronologia ha due forme, volutamente distinte.

**Note libere** — campo `note` della scheda, testo multilinea. Restano
sull'intervento, replicano il blocco narrativo del cartaceo, non sono
interrogabili singolarmente.

**Note brogliaccio** — record della tabella `brogliaccio`, agganciati
all'intervento tramite il campo `servizio`. La tabella ha tre sole colonne:

| Campo API | Obbligatorio |
|---|---|
| `data/ora` | si |
| `servizio` | no — qui usato come aggancio |
| `descrizione` | si |

```js
client.table("brogliaccio").create({
  "data/ora":   "YYYY-MM-DD HH:mm:ss",   // momento dell'annotazione
  servizio:     nomeIntervento,          // aggancio, per nome
  descrizione:  testoNota
})
```

Lettura: `list()` filtrato su `servizio eq <nome>`, ordinato per `data/ora`
discendente, `size: 500`.

Vincoli e conseguenze:

* **Solo in modifica.** Una nota richiede un nome gia' esistente, quindi il
  riquadro resta disabilitato finche' l'intervento non e' stato salvato almeno
  una volta.
* **L'aggancio e' per nome, non per id.** Rinominando l'intervento le note
  precedenti restano puntate al nome vecchio: l'avviso di rinomina lo dice
  esplicitamente.
* **Permessi propri.** `brogliaccio` puo' essere scrivibile anche quando
  `servizi` non lo e': i permessi si leggono separatamente e l'inserimento si
  disabilita da solo.
* **Nessuna cancellazione.** Il brogliaccio e' un registro cronologico: le note
  si aggiungono, non si rimuovono da questa SPA.


## 11. Scelta del referente dall'anagrafica

I tre campi del referente, nel blocco Squadre e referente, sono digitabili a mano, ma possono essere compilati
scegliendo un nominativo da **`db-volontari`** (766 record) con un popup di
ricerca.

| Campo scheda | Campo anagrafica |
|---|---|
| `cognome-referente` | `cognome` |
| `nome-referente` | `nome` |
| `telefono-referente` | **`cellulare`** — in anagrafica non esiste un campo "telefono" |

**Caricamento pigro e memorizzato.** L'anagrafica si carica alla prima apertura
del popup, non al mount della SPA: e' un elenco corposo e la maggior parte delle
schede non lo usa. Una volta caricato resta in memoria per il resto della
sessione.

**Ricerca client-side.** Il filtro lavora sui record gia' in memoria e confronta
cognome, nome, organizzazione e provincia; i termini separati da spazio sono in
AND, cosi' "rossi crem" trova Rossi della provincia di Cremona. Non si usa il
filtro server-side perche' l'operatore `cs` non e' ancora esercitato contro
queste tabelle (vedere AGENTS.md §Operatori confermati).

**Primi 50 risultati.** L'elenco e' troncato a 50 voci con un avviso, per non
disegnare centinaia di righe a ogni battitura.

**La scelta copia, non collega.** I valori vengono trascritti nei tre campi: non
resta alcun riferimento al record di anagrafica. Se il volontario cambia numero,
le schede gia' compilate mantengono quello vecchio. E' coerente col resto della
tabella `servizi`, che non ha chiavi esterne verso l'anagrafica.


## 12. Richieste collegate

Stesso schema delle note di brogliaccio: i record di **`richieste`** si legano
all'intervento tramite il campo `servizio`, valorizzato col nome.

**Sei campi su nove sono obbligatori** in tabella: `data`, `richiedente`,
`richiesta`, `tipo-richiesta`, `priorita`, `stato`. Per questo il riquadro non ha
un inserimento rapido a una riga come il brogliaccio, ma un form che li chiede
tutti, con valori iniziali sensati: data di oggi, tipo "Interna", priorita'
"3 - Normale", stato "A - Presa in carico".

```js
client.table("richieste").create({
  data:                      "YYYY-MM-DD",
  richiedente:               "…",
  richiesta:                 "…",
  "tipo-richiesta":          "Interna" | "Esterna",
  priorita:                  "1 - Urgente" … "5 - Molto bassa",
  stato:                     "A - Presa in carico" … "D2 - Respinta",
  "assegnatario-richiesta":  "…" | null,
  note:                      "…" | null,
  servizio:                  nomeIntervento
})
```

I tre vocabolari sono presi dalle `listbox_options` delle colonne e coincidono
con quelli cablati in `views/requests-board/index.js`; la verifica e' stata fatta
sul database, non assumendo che le due copie fossero allineate.

**Sola lettura sull'elenco.** Il riquadro crea e mostra, ma non modifica: per
cambiare stato, assegnatario o priorita' si va in `requests-board`, che ha la
kanban e la modale di modifica. C'e' un collegamento diretto sotto la tabella.

Vincoli identici a §10: disponibile solo in modifica, aggancio per nome quindi
sensibile alla rinomina, permessi letti separatamente da quelli di `servizi`.


## 13. Creazione in popup

La scheda completa ha otto blocchi, due dei quali inutilizzabili prima del primo
salvataggio. Per registrare una segnalazione mentre si e' al telefono serve
invece poco e subito, quindi la creazione avviene in una **popup con cinque
campi**:

| Campo | Note |
|---|---|
| `nome` | unico obbligatorio, e' la chiave funzionale (§7) |
| `descrizione` | l'oggetto della segnalazione |
| `data-ora-segnalazione` | precompilata al momento corrente |
| `comune` | |
| `provincia` | |

Il record nasce con `intervento = "SI"` e tutti gli altri campi a `null`; subito
dopo la creazione viene **selezionato nella scheda completa**, dove si prosegue
con segnalante, sopralluogo, squadre, mappa e cronologia.

**La popup resta deliberatamente minima.** Replicarvi l'intero form
significherebbe due interfacce sugli stessi campi da tenere allineate: ogni
richiesta di aggiungere "solo un altro campo" va valutata contro questo.

### Conseguenze sul resto della vista

Non esiste piu' uno stato "form in creazione": la scheda lavora sempre su un
record salvato. Ne discende che

* `formMode` e' stato eliminato; il discriminante e' `selected`, null oppure no;
* `save()` non ha piu' il ramo di creazione, fa solo `update`;
* `readOnly()` guarda solo `perms.canUpdate`, non piu' anche `canCreate`;
* il dirty check e' tornato onesto. Prima `startNew()` precompilava la data di
  segnalazione ma azzerava `baseForm`, cosi' la scheda nasceva gia' "sporca" per
  abilitare il pulsante Salva: un artificio che non serve piu';
* i riquadri brogliaccio e richieste non hanno piu' il messaggio "disponibili
  dopo il primo salvataggio". Il controllo sul nome resta come guardia difensiva,
  con un testo che dice cosa manca davvero.


## 14. Squadre: creazione rapida e catalogo

Il catalogo delle squadre attivabili unisce **due sorgenti**: i valori distinti
del campo `squadra` su volontari, mezzi e materiali (le etichette di
raggruppamento usate al campo) e i `nome` della tabella **`squadre-dichiarate`**, dove le
squadre esistono come risorsa aggregata.

La lettura di `squadre-dichiarate` sta nella stessa `Promise.allSettled` delle altre: se la
tabella non esiste ancora, le altre sorgenti restano utilizzabili e il riquadro
funziona come prima.

**Creazione senza uscire dall'intervento.** Sotto l'elenco c'e' un pulsante
"Nuova squadra" che apre una popup con quattro campi — nome, organizzazioni,
numero di volontari e di mezzi. Le organizzazioni si scelgono col selettore
condiviso `views/shared/org-picker.js`, con ricerca e filtro per provincia:
lo stesso usato nella scheda squadra. Alla conferma la squadra viene creata in
`squadre-dichiarate`, aggiunta al catalogo in memoria e **spuntata fra le squadre attivate**
dell'intervento corrente.

E' lo stesso schema gia' usato per le note di brogliaccio e per le richieste:
**si crea da dove serve, si gestisce dove appartiene**. La scheda completa della
squadra — mansione prevalente, caposquadra, periodo, conteggio attrezzature,
eliminazione — resta in [`team-manager`](../team-manager/), raggiungibile dal
collegamento accanto al pulsante.

Il pulsante compare solo se i permessi di creazione su `squadre-dichiarate` lo consentono,
letti separatamente da quelli di `servizi`; se la tabella non esiste, non compare
affatto.


## 15. Vista Squadre — rimossa

Il pannello squadre dichiarate era incorporato qui come terza vista. E' stato
tolto quando la SPA ha ottenuto un accesso proprio dal box "Anagrafiche": due
punti di gestione sugli stessi dati non si giustificavano piu'.

**Resta la creazione rapida** nel blocco "Squadre e referente" (§14): crea la
squadra e la attiva subito sull'intervento, senza farne la gestione. E' lo stesso
schema di brogliaccio e richieste — si crea da dove serve, si gestisce dove
appartiene.

## 16. Movimentazione delle squadre attivate

Al salvataggio dell'intervento, ogni squadra **aggiunta** a `squadre-attivate`
rispetto al valore precedente produce una riga in `mov-risorse`:

```js
client.table("mov-risorse").create({
  "data/ora":     "YYYY-MM-DD HH:mm:ss",
  gruppo:         organizzazioniDellaSquadra,   // com'erano al momento
  risorsa:        nomeSquadra,
  "tipo-risorsa": "SQUADRA DICHIARATA",         // quarto valore, colonna di testo libero
  da:             "",
  a:              nomeIntervento
})
```

`TIPO RISORSA` e' una colonna `Testo`, non un elenco chiuso: aggiungere un
quarto valore non richiede modifiche alla tabella.

Il valore e' **`SQUADRA DICHIARATA`**, non `SQUADRA`: letta da sola, una riga con
`SQUADRA` farebbe pensare a un gruppo di risorse registrate che si sposta, che e'
proprio l'ambiguita' che la rinomina della tabella ha eliminato. Gli altri valori
restano `VOLONTARIO`, `MEZZO`, `MATERIALE`.

**Perche' una riga di movimento e non solo il campo sull'intervento.**
`mov-risorse` registra nomi, non id: e' una fotografia datata, non un
collegamento. Se la squadra cambia composizione a settembre, l'intervento di
giugno conserva comunque che quel giorno e' stata attivata quella squadra con
quelle organizzazioni. E' lo stesso criterio con cui sono gia' tracciati
volontari e mezzi.

**Non blocca il salvataggio.** Se la scrittura del movimento fallisce,
l'intervento resta salvato e viene mostrato un avviso: la tracciatura non deve
far perdere il lavoro dell'operatore. E' la stessa scelta fatta nel check-out
massivo, dove `mov-risorse` non e' in transazione con l'`update`.

**Solo le aggiunte.** Rimuovere una squadra dall'elenco non scrive nulla: non e'
un'uscita, e' una correzione di cio' che era stato annotato.
