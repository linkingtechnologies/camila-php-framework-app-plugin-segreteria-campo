# Design: Gestione squadre

**Collocazione:** raggiungibile da **due punti**, con lo stesso pannello.

| Accesso | Quando serve |
|---|---|
| Pulsante "Squadre dichiarate" (box "Anagrafiche") | tenere l'anagrafica: censire le squadre, correggerle, eliminarle |
| Creazione rapida dal blocco "Squadre e referente" di [`intervention-manager`](../intervention-manager/) | censire al volo una squadra mentre la si attiva su un intervento |

Dal secondo punto si **crea soltanto**: la gestione completa — modifica,
eliminazione, elenco — vive solo nella SPA. Il pannello era stato incorporato
in `intervention-manager` come terza vista; e' stato tolto quando la SPA ha
ottenuto un accesso proprio, perche' due punti di gestione sugli stessi dati non
si giustificavano piu'.

La fabbrica `createTeamPanel({ embedded })` resta comunque nel codice: e' quella
che `TeamManager()` avvolge, e permette di reincorporare il pannello altrove
senza modifiche.

## 1. Struttura

Pannello a due colonne con creazione in popup, **incorporato** nella gestione
interventi.

Il codice e' una fabbrica riusabile, `createTeamPanel({ client, html, rerender,
embedded })`, sullo stesso schema di `views/shared/map-picker.js`: non
renderizza da se', compone il template e chiede all'ospite di ridisegnare. Con
`embedded: true` omette il box esterno e l'intestazione, che mette gia' l'ospite.

Il file esporta anche `TeamManager()`, che avvolge il pannello per farne una SPA
a se': e' quella che serve il pulsante nel box amministrativo, tramite
`app-team-manager.js`, `team-manager.inc.php` e `dashboard_team-manager.inc.php`.

```
[ Gestione interventi ]        [ Elenco | Kanban | Squadre ]
[Toolbar: 🔍 Cerca… | stato | servizio | + Nuova | ↺ ]
[Totali: N squadre · N volontari · N mezzi · N attrezzature]
┌────────────────────┬────────────────────────────────────────────┐
│  Elenco squadre    │  Scheda                                    │
│  (320px, scroll)   │  (flex:1, scroll)                          │
│                    │                                            │
│  ● NOME            │  [pulsantiera: Salva | Elimina | Nuova]    │
│    organizzazioni  │                                            │
│    5👤 2🚚  [stato] │  ▸ Squadra      nome, mansione prevalente  │
│                    │  ▸ Provenienza  organizzazioni             │
│                    │  ▸ Consistenza  volontari, mezzi, attrezz. │
│                    │  ▸ Referente    caposquadra, cellulare     │
│                    │  ▸ Impiego      servizio, turno            │
│                    │  ▸ Periodo      4 date                     │
│                    │  ▸ Note                                    │
└────────────────────┴────────────────────────────────────────────┘
```

## 2. State shape

```js
let records   = [];
let loading   = false;
let error     = null;
let retrying  = false;

let search       = "";
let filtroStato  = "";     // "" | "In servizio" | "Non in servizio" | "Da registrare"
let filtroServizio = "";

let selected  = null;      // record selezionato, o null
let form      = {};
let baseForm  = {};        // riferimento per il dirty check
let formBusy  = false;
let formError = null;
let formSuccess = null;

// creazione rapida in popup
let createDraft = null;    // null = popup chiusa
let createBusy  = false;
let createError = null;

let perms = { canCreate: false, canUpdate: false, canDelete: false };

let deleteConfirm = false;
let deleteBusy    = false;
let deleteUsage   = null;  // null | { checking: true } | { v, m, mat }
let deleteBlocked = false;

let organizzazioni = [];   // catalogo, valori distinti
let servizi        = [];   // nomi da `servizi`

let cancelled = false;
```

## 3. Tabella e campi

Tabella: **`squadre-dichiarate`** — da creare come worktable, `tables/xls/it/65_Squadre.xlsx`.

| Campo | Blocco | Tipo | Note |
|---|---|---|---|
| `nome` | Squadra | testo | **obbligatorio**, chiave funzionale (§6) |
| `mansione-principale` | Squadra | elenco | mansione **prevalente**, vocabolario di `volontari` (§5) |
| `organizzazioni` | Provenienza | testo | **plurale**, valori separati da virgola (§4) |
| `n-volontari` | Consistenza | intero | |
| `n-mezzi` | Consistenza | intero | |
| `attrezzature` | Consistenza | testo | **non e' un conteggio**: descrizione libera, quindi non sommabile (§9) |
| `cognome-referente` | Referente | testo | |
| `nome-referente` | Referente | testo | |
| `cellulare-referente` | Referente | testo | |
| `servizio` | Impiego | testo | nome di un record di `servizi` |
| `turno` | Impiego | testo | libero; su `volontari` non ha vocabolario né valori in uso |
| `data-inizio-attestato` | Periodo | data | |
| `data-fine-attestato` | Periodo | data | |
| `data/ora-registrazione` | Periodo | data/ora | **attenzione alla barra** nel nome |
| `data/ora-uscita-definitiva` | Periodo | data/ora | idem |
| `note` | Note | testo lungo | |

### Cosa è stato ripreso dalle altre risorse, e cosa no

`volontari`, `mezzi` e `materiali` condividono esattamente 11 campi, che sono
l'involucro operativo comune: organizzazione, codice organizzazione, provincia,
servizio, turno, squadra, le quattro date e le note. Ciò che li distingue e' la
sola identità — cognome e codice fiscale, targa e modello, id materiale.

La scheda squadra **riusa quell'involucro** e sostituisce l'identità con nome e
conteggi. Non riusa mansione individuale per persona, autista, benefici di legge,
badge, km, categoria, tipologia, proprietario: sono attributi che su un aggregato
o non hanno senso o mentono.

**Due deroghe consapevoli** rispetto ai campi comuni:

* `codice-organizzazione` e `provincia` non ci sono. Conseguenza: le squadre si
  agganciano a un'organizzazione **solo per nome**, mentre `org-status` filtra
  per la terna nome + codice + provincia proprio per distinguere organizzazioni
  omonime in province diverse. Da mettere in conto se un domani le squadre
  dovranno comparire lì.
* `organizzazione` diventa `organizzazioni` al plurale (§4).

## 4. Organizzazioni multiple

Una squadra puo' essere congiunta: il modulo cartaceo degli interventi elenca
infatti piu' sigle sotto "SQUADRE ATTIVATE" (*GC RIVOLTA, GC DOVERA, SPARVIERE*).

Il campo e' **una stringa** con i valori separati da virgola e spazio: split in
lettura, join in scrittura.

### Selettore condiviso

Il selettore vive in **`views/shared/org-picker.js`**, non nella SPA: lo usano il
campo della scheda, la popup di creazione squadra e la creazione rapida dentro
`intervention-manager`. Tre punti, un solo comportamento.

```js
const orgPicker = createOrgPicker({ client, html, rerender });
await orgPicker.load();

orgPicker.template({
  value:    form.organizzazioni,
  onChange: v => setField("organizzazioni", v),
  disabled: formBusy || readOnly()
});
```

**Catalogo** — coppie `{ nome, provincia }` da quattro sorgenti:

| Sorgente | Campi |
|---|---|
| `db-organizzazioni` | `denominazione` + `provincia` — l'anagrafica, la piu' completa |
| `volontari`, `mezzi`, `materiali` | `organizzazione` + `provincia` — chi e' effettivamente al campo |

La prima sorgente vince, con un'eccezione: **una provincia valorizzata batte una
vuota**, perche' sulle risorse il campo resta spesso in bianco e in quel caso il
dato buono e' quello dell'altra sorgente. Caricamento con `Promise.allSettled` e
**pigro**: parte alla prima apertura, non al mount.

**Interfaccia** — ricerca testuale su nome e provincia, filtro per provincia con
le sole province presenti, elenco a caselle con la sigla accanto a ciascuna voce,
e sotto il riepilogo delle selezionate come tag rimovibili.

Il riepilogo non e' decorativo: con ricerca o filtro attivi una voce gia'
spuntata puo' uscire dall'elenco visibile, e senza quella riga non si saprebbe
piu' cosa si e' scelto.

Un valore fuori catalogo resta mostrato, selezionato e marcato, come prescrive
AGENTS.md.

**Conseguenza sui filtri di elenco:** il campo contiene piu' valori, quindi non
si puo' filtrare con `eq` come fanno le altre SPA. Il confronto e' per contenuto
e avviene client-side.

## 5. Mansione prevalente

Vocabolario **identico** a quello della colonna `MANSIONE` di `volontari`
(`string-listofvalues`, 19 valori):

```
OPERATORE LOGISTICO, OPERATORE IDROGEOLOGICO, OPERATORE MOVIMENTO TERRA,
OPERATORE INSACCHETTAMENTO, OPERATORE MOTOSEGA, OPERATORE SUB,
OPERATORE CINOFILO, OPERATORE SEGRETERIA, OPERATORE SALA OPERATIVA,
OPERATORE RADIO, OPERATORE NAUTICO, ELETTRICISTA, MURATORE, IDRAULICO,
OPERATORE SANITARIO, OPERATORE CUCINA, OPERATORE ANTINCENDIO,
OPERATORE A CAVALLO, OPERATORE SUBACQUEO
```

Valore **singolo**: descrive di che squadra si tratta, non cosa sa fare ciascun
componente.

Il vocabolario contiene sia `OPERATORE SUB` sia `OPERATORE SUBACQUEO`, entrambi
non utilizzati: sono probabilmente un doppione. E' copiato cosi' com'e' per
restare allineato a `volontari`; se va corretto, va corretto prima li'.

## 6. `nome` e' una chiave funzionale

Come per `servizi`, il nome della squadra e' il valore con cui viene
referenziata: `volontari.squadra`, `mezzi.squadra`, `materiali.squadra` e
`servizi.squadre-attivate` contengono il **nome**, non un id. Ne discende che

* il nome non puo' essere vuoto;
* rinominare una squadra **non** aggiorna chi la referenzia: la SPA avvisa;
* prima di eliminare si conta quante risorse la usano, e se ce n'e' anche una
  sola l'eliminazione e' bloccata.

## 7. Logica di classificazione

```js
function statoOf(r) {
  if (!norm(r["data-inizio-attestato"])) return "Da registrare";
  if (!norm(r["data-fine-attestato"]))   return "In servizio";
  return "Non in servizio";
}
```

Stessa regola di `org-status`, con in piu' la terza categoria per le squadre
ancora senza data di inizio.

## 8. Payload

```js
// creazione (dalla popup, campi essenziali)
client.table("squadre-dichiarate").create({
  nome:             "SQUADRA IDRO 1",
  organizzazioni:   "G.C. DOVERA, O.V. GERUNDO",
  "n-volontari":    6,
  "n-mezzi":        2,
  // gli altri campi a null
})

// aggiornamento
client.table("squadre-dichiarate").update(id, payload)
```

I campi vuoti sono inviati come `null`, non come stringa vuota: e' cio' che
azzera davvero il valore, coerentemente con `service-manager` e
`intervention-manager`. I tre conteggi passano da `parseInt`.

## 9. Totali in testa all'elenco

Somma dei conteggi sulle squadre **filtrate**, non su tutte: il numero deve
corrispondere a cio' che si sta guardando.

```js
const tot = rows.reduce((a, r) => ({
  v: a.v + (parseInt(r["n-volontari"], 10) || 0),
  m: a.m + (parseInt(r["n-mezzi"], 10)     || 0)
}), { v: 0, m: 0 });
```

**Le attrezzature non entrano nel totale.** In tabella `attrezzature` e' un campo
di testo libero (`clob`), non un intero: descrive cosa la squadra porta ("2
motopompe, 1 gruppo elettrogeno") e non e' sommabile. Nella scheda e' una
textarea, non un campo numerico.

## 10. Agganci mancanti, da valutare quando servira'

* ~~**`intervention-manager`** non legge `squadre-dichiarate`~~ — **fatto**: il catalogo
  delle squadre attivabili unisce ora le etichette sulle risorse e i nomi della
  tabella `squadre-dichiarate`, e da li' si puo' creare al volo una squadra che viene subito
  attivata sull'intervento. Vedere `intervention-manager/design.md` §14.
* **`org-status`** conta volontari, mezzi e materiali per organizzazione: le
  squadre non entrano nel conteggio. Con `organizzazioni` al plurale e senza
  `codice-organizzazione`, l'aggancio sarebbe per nome e meno preciso di quello
  attuale.
* **Check-in / check-out massivi** e **report**: fuori ambito, vedere
  `use-case.md` §Fuori ambito.


## 11. Campi effettivi della tabella

La tabella creata espone questi alias, che sono i nomi validi lato API. Alcuni
differiscono da quelli ipotizzati in prima stesura:

| Alias API | Colonna fisica | Tipo |
|---|---|---|
| `nome` | `nome` | varchar |
| `mansione-principale` | `mansione` | varchar |
| `organizzazioni` | `organizzazioni` | clob |
| `n-volontari` | `nvolontari` | integer |
| `n-mezzi` | `nmezzi` | integer |
| `attrezzature` | `nattrezzature` | **clob** |
| `cognome-referente` | `nuovocampo` | varchar |
| `nome-referente` | `caposquadra` | varchar |
| `cellulare-referente` | `cellulare` | varchar |
| `servizio`, `turno` | idem | varchar |
| `data-inizio-attestato`, `data-fine-attestato` | idem | varchar |
| `data/ora-registrazione`, `data/ora-uscita-definitiva` | idem | varchar |
| `note` | `note` | clob |

Ci sono inoltre `id` (chiave primaria) e `uuid`, gestiti dal framework e non
toccati dalla SPA.

Le date sono `varchar`, non tipi data: il formato resta quello testuale usato
altrove, `YYYY-MM-DD` e `YYYY-MM-DD HH:mm:ss`.


## 12. Dichiarati e registrati

I conteggi sulla squadra sono **dichiarati** dall'organizzazione. I nominativi
possono arrivare dopo — nelle emergenze flash, senza campo di ammassamento, anche
giorni dopo e a consuntivo — oppure non arrivare mai.

Quindi i due numeri **convivono** e vanno mostrati affiancati, mai fusi:

| | |
|---|---|
| **Dichiarati** | `n-volontari`, `n-mezzi` sulla squadra |
| **Registrati** | risorse che portano quel nome nel campo `squadra` |

```js
// un solo passaggio su volontari/mezzi/materiali, non una query per squadra
registrati[nomeMinuscolo] = { v, m, mat };
```

Lo **scarto fra i due e' un'informazione operativa**, non un errore: e' l'elenco
di chi deve ancora mandare i nominativi, e senza quei nomi non escono gli
attestati. Per questo compare in chiaro — "mancano 3 nominativi" — invece di
essere nascosto.

Tre stati per squadra, dedotti:

| Condizione | Etichetta |
|---|---|
| nessuna risorsa con quel nome | nessun nominativo |
| alcune, meno dei dichiarati | N/M nominativi |
| almeno quanti i dichiarati | nominativi completi |

**Niente somma unica.** Sommare dichiarati e registrati conterebbe due volte le
stesse persone durante il consolidamento; prendere solo i registrati
sottostimerebbe finche' i nomi non arrivano. Due numeri, nessuna regola magica.

Questo sostituisce la vecchia regola "o l'aggregato o il dettaglio": non e' piu'
una scelta esclusiva, e' una transizione che puo' durare settimane e restare a
meta'.
