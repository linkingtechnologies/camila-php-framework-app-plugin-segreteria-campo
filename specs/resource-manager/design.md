# Design — resource-manager

**Pulsante dashboard:** "Database Risorse"

## 1. Struttura

Wizard a 2 step. Step 1 = lista paginata con filtri e editing inline. Step 2 = form completo per creazione e modifica.

```
[Step 1 — lista]
  [Titolo "Database Risorse"           | Pulsante Aggiungi]
  [Tab: Volontari · Mezzi · Materiali                    ]
  [Box filtri: Organizzazione · Filtro colonna · Per pagina]
  [Barra risultati: "Mostrati X–Y di T"    | ‹ N/M ›    ]
  [Tabella: col ordinabili · dblclick cella → edit inline]
    [ ✏ 🗑 | col1 | col2 | … ]
    …
  (nessuna paginazione in fondo: i controlli sono sopra)

[Step 2 — form]
  [Titolo: "Modifica risorsa" / "Nuova risorsa" | Salva · Annulla]
  [Campi della categoria attiva                               ]
```

## 2. Navigazione

```js
goTo(1)   // lista (default)
goTo(2)   // form — richiede state.editTab, state.editId, state.editMode
```

`state.editMode` = `"create"` | `"edit"`.
Se `editMode === "edit"`, il form carica la riga esistente tramite `editId`.
Se `editMode === "create"`, il form è vuoto (con prefill `id-materiale` via `.sequence()` per la tab materiali).

## 3. Parametro URL

`?tab=volontari` | `?tab=mezzi` | `?tab=materiali` apre direttamente la tab corrispondente al mount. Valori non riconosciuti vengono ignorati; default: `volontari`.

## 4. Tabelle coinvolte

| Tab | Tabella WorkTable |
|---|---|
| Volontari | `db-volontari` |
| Mezzi | `db-mezzi` |
| Materiali | `db-materiali` |
| Registro dei trasferimenti di organizzazione (solo scrittura, da §7f) | `trasferimenti-risorse` |

## 5. Colonne

### Colonne preferite (ordine fisso)

**Volontari:**
`codice-fiscale, cognome, nome, data-di-nascita, luogo-di-nascita, cellulare, organizzazione, codice-organizzazione, provincia`

**Mezzi:**
`targa, codice-inventario, codice-inventario-regionale, codice-inventario-provinciale, categoria, tipologia, note, marca, modello, note-ulteriori, organizzazione, codice-organizzazione, provincia, proprietario`

**Materiali:**
`id-materiale, codice-inventario, codice-inventario-regionale, codice-inventario-provinciale, categoria, tipologia, note, marca, modello, note-ulteriori, organizzazione, codice-organizzazione, provincia, proprietario`

Le colonne extra (presenti nei record ma non nell'elenco preferito) vengono accodate in ordine alfabetico.

### Colonne nascoste (sempre escluse)

`id`, `uuid`, `id2` — nella tabella dello step 1 **e nel form dello step 2**,
che prima escludeva solo `id` e `uuid` e mostrava quindi `id2`, un contatore
interno. Vengono tolte anche dal payload del salvataggio.

### Colonne in sola lettura inline

`provincia`, `codice-organizzazione` — derivate automaticamente dalla selezione `organizzazione`; non modificabili con doppio click.

## 6. State shape

```js
// state condiviso tra i due step
{
  step: 1 | 2,
  activeTab:  "volontari" | "mezzi" | "materiali",
  editTab:    String,     // tab del record in step2
  editId:     String | null,
  editMode:   "create" | "edit",
  master:     { volontari: Array | null, mezzi: Array | null, materiali: Array | null },
  // master = cache della pagina corrente (sostituita ad ogni fetch server-side)

  step1: {
    activeTab:               String,
    orgCatalog:              Array<{ code, name }> | null,
    orgCatalogLoaded:        Boolean,
    orgCatalogError:         String | null,
    provinceCatalog:         Array<String> | null,
    provinceCatalogLoaded:   Boolean,
    provinceCatalogError:    String | null,
    orgProvinceByCode:       { [code]: provincia } | null,

    sortByTab:        { volontari: { key, dir }, mezzi: ..., materiali: ... },
    paginationByTab:  { volontari: PagState, mezzi: ..., materiali: ... },
    columnFilterByTab: { volontari: FilterState, mezzi: ..., materiali: ... },
    permissionsByTab:  { volontari: Perms | null, ... },
    readOnlyGlobal:   Boolean,

    inlineEdit:  InlineEditState | null,
    skipFetch:   Boolean,   // true = ensureLoaded usa cache, non chiama server
    notice:      { text: String } | null,   // conferma dell'ultimo salvataggio (scritta da step 2)
  },

  step2: {
    loadedKey:       String | null,
    draftRow:        Object | null,
    saving:          Boolean,
    error:           Any | null,
    sequenceLoadedKey:  String | null,   // per prefill id-materiale
    sequenceError:   String | null,
    // catalogs (stessi di step1, condivisi via state.step1)
  }
}

// PagState
{ page: Number, size: Number, total: Number, totalPages: Number, hasNext: Boolean }

// FilterState
{ col: String, op: "cs", val: String }

// Perms
{ canCreate: Boolean, canUpdate: Boolean, canDelete: Boolean, canRead: Boolean }

// InlineEditState — singola cella
{ rowId: String, col: String, val: String, saving: Boolean, error: String | null }

// InlineEditState — overlay categoria/tipologia
{
  rowId:     String,
  col:       "cat-tip",
  tab:       "mezzi" | "materiali",
  categoria: String,
  tipologia: String,
  saving:    Boolean,
  error:     String | null,
  anchorX:   Number,   // px dal bordo sinistro viewport
  anchorY:   Number,   // px dal bordo superiore viewport
}
```

## 7. Paginazione e filtri (server-side)

```js
// Filtri inviati al server:
// 1. organizzazione: eq sul campo codice-organizzazione (se != "all")
// 2. colonna libera: cs (contains) sul campo selezionato

table.list({
  filters: [...],
  order:   [[colonna, "asc" | "desc"]],
  page:    [pageNumber, pageSize],
})
// res.results = totale record (per calcolo pagine)
// res.records = array record pagina corrente
```

### Layout box filtri

La riga e' un flex che **va a capo** (`flex-wrap:wrap`): su uno schermo stretto il filtro per colonna passa da solo su una seconda riga invece di
restare schiacciato. Prima era senza wrap, con larghezze fisse (Categoria 160px, Tipologia 200px) che tagliavano «MATERIALE IDROGEOLOGICO»
e le tipologie piu' lunghe; ora Categoria e Tipologia hanno una base ma possono crescere e ridursi:

| Controllo | Larghezza |
|---|---|
| Organizzazione (tendina + lente) | 236px fissi |
| Categoria *(solo Mezzi e Materiali)* | `flex: 0 1 230px`, min 170, max 340 |
| Tipologia *(solo Mezzi e Materiali)* | `flex: 0 1 260px`, min 190, max 460 |
| Filtro per colonna | `flex: 1 1 280px`, min 280 |
| Per pagina | 90px fissi |

I due menu portano il valore scelto nel `title`, cosi' una tipologia lunga si legge per intero al passaggio del mouse (aperto, l'elenco la mostra gia' intera).

**La lente** (`ri-search-line`, `title` «Cerca l'organizzazione») sta a destra della tendina
Organizzazione e apre `renderOrgFilterPopup()`, una finestra con la ricerca per denominazione o
codice sullo stesso catalogo `db-organizzazioni` (`searchOrgs()`, ordinato per denominazione; la
stessa funzione serve la finestra di creazione). In cima c'e' **Tutte le organizzazioni**, solo a
ricerca vuota; l'organizzazione attualmente filtrata e' evidenziata; il cursore va nel campo di
ricerca all'apertura (`refresh()` legge `orgFilterPicker.focus` una volta sola). Un clic su una voce
chiude la finestra e passa per `onOrgChange()`, cioe' lo stesso gestore della tendina: stato in
`state.selectedOrgByTab[tab]`, ritorno alla prima pagina, nuova lettura. Aprire, scrivere nella ricerca
e chiudere usano `skipFetch`: la tabella dietro non si rilegge finche' non si sceglie. La tendina
usa `?selected` sulle opzioni, non `.value` (AGENTS.md), perche' la scelta puo' arrivare dalla finestra.
Stato: `state.step1.orgFilterPicker = null | { tab, q, focus }`.

### Filtri server-side

Tutti applicati insieme in `buildFilters(tab)` e inviati al server via `table.list({ filters: [...] })`.

| Filtro | Campo | Operatore | Tab |
|---|---|---|---|
| Organizzazione | `codice-organizzazione` | `eq` | tutti |
| Categoria | `categoria` | `eq` | mezzi, materiali |
| Tipologia | `tipologia` | `eq` | mezzi, materiali |
| Filtro colonna | qualsiasi colonna visibile | `cs` | tutti |

**Filtro Categoria:** opzioni da `MEZZI_CAT_OPT` / `MAT_CAT_OPT`. Cambiare categoria azzera il filtro tipologia e resetta la pagina.

**Dove vive il vocabolario di categoria/tipologia.** Nelle `listbox_options`
delle colonne omonime di `mezzi` e `materiali`, lette a runtime da
`describe()` tramite `views/shared/vocabularies.js`. Non c'e' piu' una copia
nelle viste: vedi [`specs/api/describe/`](../api/describe/).

```js
const { loadCatalog } = await import(`../shared/vocabularies.js?v=${VERSION}`);
const [mezziCat, materialiCat] = await Promise.all([
  loadCatalog(client, "mezzi"),
  loadCatalog(client, "materiali")
]);
const MEZZI_CAT_OPT = mezziCat.categories;
const MEZZI_TIP_OPT = mezziCat.byCat;
```

Se il describe non risponde, o risponde senza la configurazione Camila, il
modulo ritorna la propria copia di riserva: le tendine non restano mai vuote. I mezzi gia' registrati con etichette non piu'
in elenco restano fuori lista e vengono mostrati come tali, non scartati.

## 7b. Ricerca rapida unificata

Un campo sopra la tab bar che cerca **in tutte e tre le schede insieme**, elenca
i risultati e, al clic, apre il record nel form completo.

### Perché in memoria e non server-side

Il filtro per colonna (§7) è server-side e cerca su **una** colonna alla volta:
per trovare un volontario bisogna prima scegliere se cercare per cognome o per
codice fiscale. La ricerca rapida cerca su più campi e su tutte e tre le
tabelle, quindi server-side avrebbe richiesto `orFilters` — mai esercitato
contro queste tabelle — e si sarebbe scontrata con due ostacoli: l'operatore
`cs` è **case-sensitive**, e mischiare filtri AND (organizzazione) e OR
(ricerca) nella stessa richiesta ha semantiche non verificate.

In memoria il confronto è normalizzato (minuscole, accenti rimossi), quindi
"rossi" trova "ROSSI" e "nicolo" trova "NICOLÒ".

### Caricamento

```js
state.step1.quickSearch = { q, loading, loaded, error, rows: { volontari, mezzi, materiali } }
```

**Pigro**: le tre `list({ size: 9999 })` partono alla prima query lunga almeno
`SEARCH_MIN` (2) caratteri, non al mount — la pagina si apre spesso solo per
sfogliare una scheda.

`Promise.allSettled`: se un catalogo non si carica si cerca negli altri due e si
mostra un avviso di risultati parziali, invece di non cercare affatto.

Lo stato vive in `state`, non nella closure: tornando dal form completo la
ricerca e i risultati sono ancora lì.

### Campi cercati

```js
SEARCH_FIELDS = {
  volontari: ["cognome", "nome", "codice-fiscale", "organizzazione"],
  mezzi:     ["targa", "codice-inventario", "marca", "modello", "organizzazione",
              "categoria", "tipologia", "note"],
  materiali: ["id-materiale", "codice-inventario", "targa", "marca", "modello",
              "organizzazione", "categoria", "tipologia", "note"],
}
```

Esplicito, non "tutte le colonne": l'elenco deve restare allineato a quello che
le tabelle hanno davvero. **`db-volontari` non ha `categoria`, `tipologia` né
`note`** — il suo form si ferma a codice fiscale, anagrafica, cellulare e
organizzazione — quindi quei tre campi compaiono solo sotto mezzi e materiali.

`note-ulteriori` esiste su entrambe ma è fuori dall'elenco: si aggiunge qui se
serve.

Cercare dentro `note` allarga parecchio i risultati, ed è voluto. L'ordinamento
per identificativo (sotto) regge il colpo: chi digita una targa la trova in cima
anche se il termine compare nelle note di altri venti record.

### Risultati

Ordinati mettendo davanti le righe il cui identificativo **inizia** con il
termine: digitando una targa, quella esatta sta in cima e non ventesima. Ne
vengono resi `SEARCH_SHOWN` (12); il resto è dichiarato come conteggio con
l'invito a restringere.

Ogni riga porta il tag della scheda di appartenenza (Volontari / Mezzi /
Materiali), perché i risultati arrivano da tre tabelle diverse, e — per mezzi e
materiali — due badge con **categoria** e **tipologia**: sono i due campi che
distinguono record altrimenti identici, tipo un materiale senza targa
identificato dal solo codice inventario. I badge compaiono solo se valorizzati;
sui volontari mai, perché `db-volontari` non ha quelle colonne.

`tipologia` è stata tolta dal sottotitolo dei materiali, dove ora compare solo
come badge: altrimenti sarebbe scritta due volte sulla stessa riga.

Il clic chiama `startEdit(tab, id)`, la stessa funzione del pulsante di modifica:
imposta `editTab`, `editId`, `editMode = "edit"` e va allo step 2.

**`startEdit` sposta anche la scheda attiva** su quella del record. Serve proprio
alla ricerca unificata: un risultato può appartenere a una scheda diversa da
quella aperta, e lo step 2 torna indietro con `goTo(1)` senza toccarla — senza
questa riga, salvando un mezzo trovato mentre si è su Volontari si tornerebbe
all'elenco dei volontari.

**Senza permessi di scrittura il record si apre comunque, in sola lettura.**
`startEdit` non ha più un controllo sui permessi: prima rifiutava in silenzio, e
sul risultato di ricerca il clic sembrava inerte. Ora apre e il blocco sta allo
step 2 — vedi §12.

## 7c. Ordine e visibilità delle colonne

Due livelli: l'ordine **predefinito** viene dalla configurazione della scheda,
e sopra ci sta una **preferenza dell'utente** che riordina e nasconde.

### Predefinito: `sequence` dal describe

Il describe esteso porta `sequence` su ogni colonna — l'ordine impostato sulla
scheda in Camila. `defaultColOrder()` ordina per quello, quindi aggiungendo una
colonna alla worktable compare al posto giusto **senza toccare il JS**.

Prima l'ordine era solo `PREFERRED_COLS`, un elenco cablato per scheda, con le
colonne non elencate accodate in ordine alfabetico. Quell'elenco resta come
riserva: lo si usa quando il describe non e' quello esteso, e come criterio di
parita' fra colonne con lo stesso `sequence`.

I metadati arrivano da `loadColumns()` di `views/shared/vocabularies.js`, la
stessa funzione da cui escono i vocabolari: una sola `describe()` per tabella,
non due.

### Preferenza utente

```js
localStorage["rm-cols-<tab>"] = { order: [...], hidden: [...] }
```

Un pannello "Colonne" sopra la tabella elenca le colonne con frecce su/giu' e
una spunta per la visibilita', piu' "Ripristina ordine predefinito".

Il pannello **non spiega il meccanismo**: niente note su dove viva l'ordine
predefinito o su dove sia salvata la preferenza. Sono dettagli di
implementazione, e all'operatore non servono - gli serve il controllo.

**Niente trascinamento delle intestazioni**: quelle sono gia' cliccabili per
ordinare, e un trascinamento corto verrebbe letto come clic cambiando
l'ordinamento invece di spostare la colonna. Le frecce funzionano anche col dito
sui totem.

`orderedCols()` prende l'ordine salvato, lo filtra sulle colonne realmente
presenti nei dati, e **accoda in fondo** quelle che l'utente non ha mai visto:
una colonna aggiunta dopo che la preferenza e' stata salvata compare, invece di
sparire perche' assente dall'elenco.

`localStorage` e' per browser e per dispositivo, non e' un dato condiviso: ogni
accesso e ogni scrittura sta in `try/catch`, perche' in finestra privata o con
lo storage bloccato puo' lanciare. Fallendo, la preferenza vale per la sola
sessione.

### Dimensione del carattere

Accanto a "Colonne", tre pulsanti S / M / L cambiano la dimensione del
carattere della tabella: `0.70rem` (**predefinito**), `0.80rem` — quello che
Bulma dà con `is-small` — e `0.95rem`. Si applica come `font-size` in linea sulla `<table>`,
quindi eredita su intestazioni e celle senza toccare il resto della pagina.

```js
localStorage["rm-font-size"] = "s" | "m" | "l"
```

Il predefinito è **S**, quindi più compatto di quello che Bulma darebbe da solo:
su tabelle da quattordici colonne la densità conta più della leggibilità del
singolo carattere, e chi preferisce il contrario ha M e L.

**Una chiave sola, non una per scheda**, a differenza dell'ordine colonne: la
dimensione del carattere riguarda chi guarda, non quale tabella sta guardando.
Come per le colonne, lettura e scrittura stanno in `try/catch` e un valore
illeggibile o sconosciuto ricade sul predefinito.

### Cosa resta fuori

Le colonne nascoste restano **filtrabili**: il selettore del filtro per colonna
usa `colsOrdinate`, non `cols`. Serve anche a evitare un difetto: nascondendo la
colonna selezionata nel filtro, l'opzione sparirebbe dal `<select>` e il
controllo ricadrebbe in silenzio sulla prima voce mentre lo stato continua a
dire la vecchia. Nella stessa occasione quel `<select>` e' passato da `.value` a
`?selected`, come vuole AGENTS.md per le opzioni dinamiche.

Una colonna nascosta non e' modificabile inline, perche' la cella non c'e'.

## 7d. Esportazione in Excel e in ODS

I pulsanti **Esporta in Excel** ed **Esporta in ODS** stanno nella riga di **Colonne**
(`renderColPanel()`), affiancati, per ognuna delle tre schede. Esporta cio' che l'operatore sta guardando: la stessa
tabella, gli stessi filtri (`buildFilters(tab)`), lo stesso ordine (`getOrder(tab)`) e
le colonne **visibili** (`cols`, cioe' `colsOrdinate` meno le nascoste), nell'ordine in
cui le vede. L'intestazione usa `colLabel(tab, k)`: l'etichetta della worktable, non
l'abbreviazione della tabella a schermo. Mai `id`, `uuid`, `id2`.

```text
exportSheet(tab, cols, format)                       // format: "xlsx" | "ods"
  exportByTab[tab] = { busy: true, format, error: null }   // redisegna solo i pulsanti (skipFetch)
  rows = []
  per page = 1..EXPORT_MAX_PAGES (200):
      list({ filters, order + ["id","asc"], page: [page, EXPORT_PAGE (1000)] })
      rows += records;  fermo se la pagina e' vuota o rows >= results
  buildXlsx | buildOds ({ sheetName: etichetta della scheda, headers, rows, numeric, dates })
  verifyXlsx | verifyOds (bytes, stessi dati)  // se non passa: errore, nessun download
  saveBytes(bytes, "database-<tab>_<AAAA-MM-GG>.<xlsx|ods>")
```

- **Non e' la pagina a schermo.** Il punto dell'esportazione e' la lista intera, quindi
  rilegge a blocchi con lo stesso client della tabella, e con gli stessi permessi di lettura.
  Niente endpoint nuovo e niente dati che escono dal browser.
- **`id` come ultima chiave d'ordine**, se non c'e' gia': con un ordine su una colonna con
  valori ripetuti, due richieste di pagine successive potrebbero ripetere o saltare righe.
- **Un file per scheda**, non un file con tre fogli: il foglio si chiama come la scheda.
- **Due formati, un solo flusso:** l'unica differenza e' la funzione che scrive e quella che controlla.
  Un solo pulsante alla volta lavora (`busy` li disattiva entrambi) e a girare e' quello premuto.
- **Il file lo scrive `views/shared/spreadsheet.js`**, un modulo puro (nessun DOM, nessuno stato)
  con un writer `.xlsx` e uno `.ods` minimi, dagli stessi dati (stesse colonne, stesse regole per
  numeri e date, stesso controllo). Il writer `.xlsx`: un foglio, intestazione in grassetto su fondo chiaro,
  prima riga bloccata, filtro automatico su ogni colonna, larghezze dal contenuto, zip
  senza compressione (serve solo il CRC-32). Un import dinamico con `?v=VERSION`, come
  ogni modulo condiviso.
- **Celle di testo, tranne le colonne numeriche.** Una colonna e' scritta come numero solo
  se il describe esteso ne dice il tipo (`integer`, `decimal`, `number`, `float`) **e** il
  valore e' un numero scritto in modo canonico (niente zeri iniziali). Codici fiscali,
  cellulari, targhe e codici inventario arrivano a Excel come sono stati scritti, senza
  perdere gli zeri o diventare `3,3E+11`.
- **Date vere.** Una colonna e' scritta come data Excel se il describe esteso ne dice il tipo
  (`date`, `datetime`, `timestamp`); senza describe, la sola colonna data di queste tre tabelle,
  `data-di-nascita`, si riconosce dal nome. Nella cella c'e' il numero seriale della data con il
  formato breve di Excel (`numFmtId` 14, o 22 se c'e' anche l'ora): Excel la mostra nel formato
  regionale di chi apre il file (gg/mm/aaaa su un PC italiano) e la ordina e la filtra come data.
  `toSerial()` capisce `AAAA-MM-GG`, `AAAA-MM-GG hh:mm[:ss]` (anche con la `T`) e `gg/mm/aaaa`.
  **Cio' che non e' una data resta il testo che era**: formato sconosciuto, data impossibile
  (31 febbraio), la data zero di un database (`0000-00-00`), `n.d.`. Resta testo anche una data
  prima del 1° marzo 1900: il sistema 1900 di Excel conta un 29 febbraio 1900 che non e' mai
  esistito, e prima di allora il numero sarebbe sbagliato di un giorno. Niente fuso orario: la
  data e' quella scritta, senza conversioni. Il controllo del file confronta il numero seriale.
- **Stato:** `state.step1.exportByTab[tab] = { busy, error }`. `busy` disattiva il pulsante
  e mostra *Esportazione…*; con lista vuota (`total === 0`) il pulsante e' disattivato.
- **Errori:** `errorText(e)` come nel resto della SPA; con la sessione non piu' valida
  il messaggio e' giallo e porta il collegamento **Esci e rientra**. Nessun file parziale.
- **Funziona anche in sola lettura:** esportare non scrive.
- **Controllo del file** (`verifyXlsx()`, e `verifyOds()` per l'ods): prima di offrirlo, il file appena scritto viene riletto
  contro i dati da cui nasce. Controlla lo zip (record finale, intestazioni centrali e locali,
  dimensioni, CRC-32 di ogni parte), che le sei parti attese ci siano, che ogni parte XML sia ben
  formata (`DOMParser`; il foglio oltre 4 MB di testo non passa dal DOM e resta coperto dai conti),
  che i tag di apertura e chiusura si bilancino, che le righe vadano da 1 a N senza buchi, che ogni
  cella stia nella sua riga e in ordine di colonna, che il numero di celle coincida con i valori non
  vuoti, che filtro e nome definito coprano esattamente i dati, e il contenuto cella per cella della
  prima riga, della seconda e dell'ultima. Un file che non passa **non viene salvato**: l'errore dice
  il primo problema e `console.warn` li elenca tutti.
  **Limite dichiarato:** trova gli errori del writer, non dice se Excel accettera' il file. Excel
  e' piu' severo di qualunque controllo fatto qui; solo aprirlo in Excel lo prova.
- **Il formato `.ods`** (`buildOds()`): zip con `mimetype` come **primo** elemento, non compresso e senza
  altro scritto dentro, poi `META-INF/manifest.xml`, `content.xml`, `styles.xml`, `meta.xml` e
  `settings.xml`. Le date sono vere (`office:date-value`, ISO) e non hanno il limite del 1900 di Excel:
  una data come `1850-01-01` e' una data anche qui, mentre in `.xlsx` resta testo. Gli stili data usano
  `number:automatic-order`, quindi LibreOffice ne sceglie l'ordine giorno-mese-anno dalla lingua di chi
  apre il file. In ODF un a capo, una tabulazione e una serie di spazi sono **elementi** (`text:line-break`,
  `text:tab`, `text:s`), non caratteri: scritti normali si fonderebbero in uno spazio solo.
  Intestazione in grassetto su fondo chiaro, filtro automatico (`table:database-range`).
- **Riga bloccata nell'ods:** e' un'impostazione di visualizzazione in `settings.xml`, e LibreOffice la
  legge solo se la radice dichiara lo spazio `xmlns:ooo` e accanto al gruppo `ooo:view-settings` c'e' il
  gruppo (anche vuoto) `ooo:configuration-settings`. Senza, la riga semplicemente non si blocca, senza
  errori. Verificato aprendo il file con LibreOffice da script (`hasFrozenPanes()`), come per l'xlsx.
- Un carattere spaiato (meta' di un emoji) non e' scrivibile in UTF-8: writer e controllo lo
  normalizzano allo stesso modo (U+FFFD), cosi' non nasce un falso allarme.
- **Dimensioni:** lo zip non e' compresso, quindi 50.000 righe per 5 colonne pesano circa 18 MB
  (costruzione e controllo: meno di un secondo ciascuno); un `.ods` della stessa lista pesa circa il
  doppio (34 MB), perche' ogni cella porta i suoi attributi. Nessun limite pratico per i programmi, ma
  sono file grandi da allegare a una mail. Una compressione (deflate) li ridurrebbe molto: non c'e'.
- Il file non include gli allegati (le foto) e non e' un backup: per quello c'e' *Backup
  schede dati*.

Verificato con PhpSpreadsheet (rilettura di fogli, riga bloccata, filtro, grassetto) e con
LibreOffice (conversione in CSV: zeri iniziali, caratteri XML, accenti, a capo).

## 7e. Popup delle classificazioni

Il pulsante **Classificazioni** sta nella riga di **Colonne**, accanto a quelli di esportazione, ma solo
nelle schede **Mezzi** e **Materiali** (in Volontari non c'e' classificazione). Apre una finestra
(`renderClassPopup()`) con **due colonne**, Mezzi e Materiali, sempre entrambe: ogni categoria con le sue
tipologie e, accanto a ciascuna, quante risorse del database la usano.

- **La definizione** viene dagli elenchi che la SPA ha gia' in memoria (`MEZZI_CAT_OPT`/`MEZZI_TIP_OPT`,
  `MAT_CAT_OPT`/`MAT_TIP_OPT`, da `loadCatalog()` di `views/shared/vocabularies.js`): niente chiamata in piu'.
  Alla categoria «Non assegnata», che nell'elenco non ha tipologie sue, si affianca la tipologia «Non
  assegnata», come fa l'editor in linea.
- **I conteggi** (`countClasses(tab)`) si leggono **all'apertura**, non al caricamento della pagina, cosi'
  non sono mai vecchi e chi non apre il popup non paga nulla. Si chiedono solo le due colonne
  (`include: ["categoria","tipologia"]`), a blocchi di `EXPORT_PAGE` e ordinati per `id` come
  l'esportazione, per le due tabelle in parallelo. La chiave del conteggio e' la coppia
  `JSON.stringify([categoria, tipologia])`; il totale di una categoria e' la somma delle sue coppie.
- **Fuori elenco:** le coppie presenti nelle risorse ma non definite sulla scheda (un valore rinominato, uno
  importato, uno vuoto) compaiono in un gruppo a parte, con «(categoria vuota)» / «(tipologia vuota)» dove
  manca il valore. E' il modo piu' rapido per accorgersi di un dato fuori vocabolario.
- **Se i conteggi falliscono** (rete, server, sessione) il popup resta aperto con la sola definizione e un
  messaggio «Conteggi non disponibili: …» (con **Esci e rientra** se la sessione non e' valida): la
  definizione serve comunque.
- **Stato:** `state.step1.classPopup = { open, loading, error, counts }`. Apertura e chiusura ridisegnano
  solo la finestra (`skipFetch`): la tabella dietro non si ricarica. Si chiude con la ✕, con **Chiudi** o
  con un clic sullo sfondo.
- Sola lettura: non scrive nulla, quindi funziona anche senza permessi di scrittura.

## 7f. Trasferimento a un'altra organizzazione

L'organizzazione di un mezzo o di un materiale si sceglie alla creazione e poi e' in sola lettura nella
tabella (`INLINE_SKIP`). Cambiarla e' un atto diverso - cambia a chi appartiene la risorsa - e ha un'azione
propria: la quarta icona della riga (`ri-arrow-left-right-line`, «Trasferisci a un'altra organizzazione»),
solo nelle schede Mezzi e Materiali e solo con `canUpdate`.

**La finestra** (`renderTransferPopup()`): la risorsa (targa, marca e modello; oppure id materiale,
categoria e tipologia), l'organizzazione attuale, la ricerca della destinazione, la **Motivazione** e i
pulsanti **Trasferisci** / **Annulla**.

- **Destinazione:** si cerca per denominazione o codice (almeno due caratteri, 8 risultati al massimo) nel
  catalogo `db-organizzazioni` che la SPA ha gia' (`state.step1.orgCatalog`), **escludendo l'organizzazione
  attuale**. La provincia e' quella della destinazione (`state.step1.orgProvinceByCode`).
- **Motivazione obbligatoria**: almeno 3 caratteri, al massimo 255 (la dimensione della colonna).
  **Trasferisci** resta disattivato finche' mancano destinazione e motivazione.
- **Cosa cambia nella risorsa:** `organizzazione`, `codice-organizzazione` e `provincia`, insieme e nient'altro.
  Una provincia vuota si invia `null`, come ogni campo vuoto.

**Il registro `trasferimenti-risorse`** (definizione: `tables/xls/it/96_Trasferimenti risorse.xlsx`,
scheda «TRASFERIMENTI RISORSE», categoria RISORSE, ordinata per data decrescente, **solo inserimenti**: niente
modifiche e niente cancellazioni, e' uno storico). Una riga per trasferimento:

| Colonna (nome API) | Contenuto |
|---|---|
| `data/ora` | `AAAA-MM-GG hh:mm:ss`, dell'ora in cui si preme **Trasferisci** |
| `tipo-risorsa` | `MEZZO` o `MATERIALE` |
| `id-risorsa` | l'`id` che l'API da' alla riga in `db-mezzi` / `db-materiali`, **come testo**: con la modalita' UUID attiva e' un GUID (la chiave numerica diventa `id2`), altrimenti il numero. Con `tipo-risorsa` dice in quale scheda cercare |
| `targa` | la targa; solo per i mezzi, `null` per i materiali |
| `id-materiale` | l'id materiale; solo per i materiali, `null` per i mezzi |
| `categoria`, `tipologia` | la classificazione della risorsa al momento del trasferimento |
| `marca/modello` | marca e modello uniti da uno spazio (uno solo se l'altro manca) |
| `codice-inventario`, `proprietario` | come sulla risorsa |
| `note` | le note della risorsa; solo per i materiali, `null` per i mezzi |
| `organizzazione-origine`, `codice-organizzazione-origine`, `provincia-origine` | i valori **prima** del trasferimento |
| `organizzazione-destinazione`, `codice-organizzazione-destinazione`, `provincia-destinazione` | i valori **dopo** |
| `motivazione` | il testo scritto dall'operatore |

I dati della risorsa si ricavano in `transferSnapshot(tab, row)`; un valore vuoto va come `null`. Il registro
**non copia** referente, telefono, provenienza e i codici inventario regionale/provinciale: cambiano nel
tempo o esistono solo in alcune installazioni. Le colonne in piu' rispetto alla prima versione richiedono la
definizione aggiornata: una tabella gia' importata con la versione precedente va reimportata o completata.

I nomi si copiano **come testo, non come riferimenti** («fotografia o riferimento», AGENTS.md): e' storia,
e deve leggersi uguale anche se un'organizzazione viene poi rinominata. **Chi** ha trasferito non ha una
colonna: lo scrive Camila nelle colonne di sistema (`created_by_name`, `created_by_surname`) a ogni inserimento
tramite API, dall'utente della sessione.

**Un trasferimento che non si puo' tracciare non si fa.** Tre protezioni:

1. **Prima di tutto**, quando una scheda Mezzi o Materiali viene mostrata, `view()` chiama
   `ensureTransferLog()`: chiede `permissions()` del registro e ricorda la risposta
   (`state.step1.transferLog`). **Il trasferimento e' consentito solo se `can.create === true` sul registro**
   (in aggiunta a `canUpdate` sulla risorsa). Altrimenti l'icona della riga e' disattivata e il `title` dice
   perche' (`transferTitle()`): «Non hai il permesso di scrivere nel registro dei trasferimenti.», oppure
   «Il registro dei trasferimenti (…) non è disponibile su questa installazione.» se la tabella non c'e'.
   `openTransfer()` ripete la stessa verifica, e `confirmTransfer()` ancora, come ultima difesa.
   Limite noto: come per ogni permesso della SPA e' una guardia d'interfaccia; l'API non applica i flag
   della scheda (vedi AGENTS.md §Permissions). Un errore di rete transitorio nella verifica vale come
   «non disponibile» fino al ricaricamento della pagina.
2. **L'ordine** in `confirmTransfer()`: prima l'`update` della risorsa, poi la riga di registro.
3. **Se la riga di registro non si scrive**, l'`update` viene **annullato** (si rimettono i tre valori di
   prima) e l'operatore legge che il trasferimento non e' avvenuto. Se anche l'annullamento fallisce compare
   un avviso **«ATTENZIONE»** che dice dove e' finita la risorsa e dove va riportata a mano: e' l'unico caso
   in cui i dati possono restare incoerenti, ed e' dichiarato.

A trasferimento riuscito la finestra mostra la conferma e la lista dietro si ricarica (la risorsa sparisce
dalla lista se e' filtrata per l'organizzazione di prima); **Chiudi** la chiude. Con la sessione non piu'
valida compare il messaggio giallo con **Esci e rientra**.

**Installazione:** il registro e' una scheda nuova. Un'installazione gia' in uso la riceve importando
`96_Trasferimenti risorse.xlsx` dall'amministrazione di Camila (**non** con la reimpostazione delle schede
del plugin, che le azzera tutte). Finche' non c'e', il trasferimento e' disattivato e la finestra lo dice.

## 8. Editing inline (step 1, doppio click su cella)

### Campi con gestione speciale

| Campo | Comportamento |
|---|---|
| `categoria` + `tipologia` (mezzi e materiali) | Overlay fisso con due tendine dipendenti (vedi §9). |
| `data-di-nascita` | `<input type="date">`. |
| `provincia`, `organizzazione`, `codice-organizzazione` | Sola lettura (nessun editing inline). |
| `id-materiale` | Sola lettura: lo assegna la `sequence()` alla creazione. |
| tutti gli altri | `<input type="text">`. Enter = salva · Escape = annulla · blur = salva. |

### Commit

```js
client.table(tabella).update(rowId, payload)
// payload = { [col]: val, ...extra }
// extra usato per cat-tip (categoria + tipologia insieme)
```

Dopo il commit, la riga viene aggiornata nella cache locale (`state.master[tab]`) senza refetch, poi `refresh()` aggiorna il DOM.

### L'organizzazione non si modifica, da nessuna delle due parti

La terna `organizzazione` / `codice-organizzazione` / `provincia` e' di sola
lettura in entrambi gli step: campo disabilitato col lucchetto nel form, e
`INLINE_SKIP` nella lista. L'organizzazione si sceglie **una volta sola**, nel
picker che precede la creazione.

**E' una decisione della UI, non della worktable**: le colonne in Camila sono
scrivibili, e il flag `readonly` non vi e' impostato (vedi §11, *Sola lettura per
singolo campo*). Conseguenza da tenere presente: nella SPA **non esiste piu' modo
di spostare una risorsa fra organizzazioni**. Il ramo `col === "organizzazione"`
di `renderInlineCell` — una tendina che riscrive tutti e tre i campi — resta nel
codice, irraggiungibile, perche' e' l'unico punto che sa farlo se un giorno
diventera' un'azione da soli amministratori.

### Flag `skipFetch`

`state.step1.skipFetch = true` prima di ogni `refresh()` innescato da editing inline impedisce a `ensureLoaded` di fare una nuova chiamata server, riutilizzando la cache. Il flag viene resettato a `false` dentro `ensureLoaded` al prossimo ciclo che non è di editing.

## 9. Overlay categoria/tipologia

Si apre con doppio click su qualsiasi cella `categoria` o `tipologia` di un record mezzi o materiali.

```
┌──────────────────────────────┐
│ Categoria  [select ▼]        │
│ Tipologia  [select ▼]        │
│                 [Annulla] [Salva] │
└──────────────────────────────┘
```

- **Categoria select**: lista completa delle categorie (`MEZZI_CAT_OPT` o `MAT_CAT_OPT`).
- **Tipologia select**: solo le tipologie della categoria selezionata, **come in step 2**. Se categoria = "Non assegnata" → campo disabilitato con valore fisso "Non assegnata". Se la categoria selezionata non ha tipologie → campo disabilitato con valore "—".
- **Dipendenza a senso unico**: cambio categoria → tipologia si resetta a `""` (vuoto) o `"Non assegnata"` se categoria = "Non assegnata". Il cambio di tipologia **non** tocca la categoria: con l'elenco filtrato la tipologia scelta le appartiene già.
- **Valore fuori elenco**: una `tipologia` già sul record che non appartiene alla categoria corrente resta nella tendina come opzione marcata `(fuori elenco)`, invece di sparire silenziosamente (AGENTS.md §Derived fields).

> Fino a ottobre 2026 la tendina elencava le tipologie di **tutte** le categorie in `<optgroup>`, e il cambio di tipologia riallineava la categoria per reverse lookup. Era l'unico punto del plugin che lo faceva: step 2 filtrava già sulla categoria.
- **Backdrop**: `div position:fixed;inset:0` con `@click` → annulla. Click sull'overlay stesso ha `stopPropagation`.
- **Escape** ovunque nell'overlay → annulla.
- **Salva** invia `{ categoria, tipologia }` in un unico `update`.

### Da dove vengono le opzioni

Non sono più cablate qui. Categorie e tipologie di `db-mezzi` e `db-materiali`
arrivano da `loadCatalog()` di `views/shared/vocabularies.js`, che le legge
dalle `listbox_options` della colonna via describe esteso — vedi §"Dove vive il
vocabolario di categoria/tipologia" e `specs/api/describe/design.md`.

Lo step 1 le tiene in `MEZZI_CAT_OPT` / `MEZZI_TIP_OPT` e `MAT_CAT_OPT` /
`MAT_TIP_OPT`; sono le stesse strutture che usa lo step 2. Per cambiare un
elenco si tocca la colonna in Camila, non questi file.

## 10. Permissions

### Un errore non blocca tutto

`ensurePermissions(tab)` memorizza il fallimento **per scheda**, in
`permissionsErrorByTab`, e la vista mostra un avviso con un pulsante "Riprova".

Prima qualunque errore — rete, sessione scaduta, risposta inattesa — metteva
`readOnlyGlobal = true`, che vale per **tutte** le schede e non si azzera mai:
`ensurePermissions` esce alla prima riga quando e' alzato, quindi non si
riprovava nemmeno. Il sintomo era che la **colonna delle azioni spariva**
(`showActionsCol = canUpdate || canDelete`), matita e cestino insieme, senza
dire perche' e fino a un ricaricamento della pagina.

`readOnlyGlobal` resta solo per il caso in cui il client non espone affatto una
chiamata `permissions()`: quella e' una proprieta' della build, non di una
tabella.

Da sapere su questo deployment: tutte e 36 le worktable hanno
`$camila_access_u[...] = (...) ? true : true`, cioe' concedono l'update
incondizionatamente. Un'assenza di permessi vista qui viene quasi certamente da
una chiamata fallita, non da una configurazione.


Lette tramite `client.table(tabella).permissions()` (o `client.permissions(tabella)` come fallback). Normalizzate con `normalizePermissionsPayload()`. Cache per tab in `state.step1.permissionsByTab`. Se nessuna API di permissions è disponibile, `state.step1.readOnlyGlobal = true`.

In sola lettura: pulsanti Aggiungi, Modifica e Elimina disabilitati, editing inline bloccato, cursore normale sulle celle.

## 11. Catalogo organizzazioni

```js
client.table("db-organizzazioni").list({
  include: ["codice", "denominazione", "provincia"],
  size: 5000
})
```

Alimenta tre cose: la tendina Organizzazione del form, il filtro per
organizzazione dell'elenco, e la mappa `orgProvinceByCode` da cui si deriva la
`provincia` — che infatti è in sola lettura.

**Non** viene dai valori distinti di `db-volontari.codice-organizzazione`, come
era prima. Leggere le organizzazioni dai volontari aveva tre difetti:

* un'organizzazione **senza volontari** non era selezionabile, quindi non si
  poteva registrare un mezzo per un'organizzazione nuova;
* un **refuso** su un singolo volontario diventava un'opzione dall'aria valida,
  e da lì si propagava a mezzi e materiali;
* la **provincia** ereditava lo stesso difetto, ed è un campo derivato che
  l'operatore non può correggere a mano.

`db-organizzazioni` è l'anagrafica, ed è la stessa che usano `map-center` e
`views/shared/org-picker.js` — che la definisce "la più completa".

Il caricamento è **duplicato** in step 1 e step 2, ciascuno con il proprio
`ensureOrgCatalog()`: entrambi scrivono in `state.step1.*` e il secondo non
rifà il lavoro se il primo l'ha già fatto. Cambiando sorgente vanno cambiati
tutti e due.

### Scelta dell'organizzazione prima della creazione

"Aggiungi nuova risorsa" **non apre più il form**: apre una finestra con
l'elenco delle organizzazioni, cercabile per denominazione o codice. Il form si
apre solo dopo la scelta.

```
[Aggiungi nuova risorsa] → modale organizzazioni → step 2 con i tre campi già valorizzati
```

La ragione è che una risorsa appartiene sempre a un'organizzazione, e da quella
si derivano `codice-organizzazione` e `provincia` — campi che l'operatore non
può scrivere a mano, perché sono in sola lettura. Aprendo il form prima, tre
campi su quindici nascono vuoti e sbagliati finché non si sceglie
l'organizzazione dalla tendina. È lo stesso ordine di `massive-check-in`, che
apre sull'organizzazione e solo dopo mostra le risorse.

Il passaggio avviene tramite `state.createOrg = { code, name, province }`, letto
da `ensureLoaded()` dello step 2 quando costruisce la bozza di un nuovo record.
Viene azzerato sia dall'annullamento sia dopo il salvataggio: vale per quella
creazione e non deve sopravviverle.

### La scheda Riepilogo

Non e' una scheda dati: e' `state.step1.showSummary` (booleano), e `activeTab` continua a nominare l'ultima
scheda dati, perche' lo step 2, l'esportazione e le chiamate `getContext()` si appoggiano a quella. La barra
mette «Riepilogo» davanti alle tre schede dati; `setTab()` e `startEdit()` spengono il flag.

**Apertura.** Il flag nasce una volta sola (`=== undefined`, non `||=`, altrimenti tornando dallo step 2 si
finirebbe sul riepilogo): vero se l'indirizzo non ha `?tab=` o ha `?tab=riepilogo`, falso se nomina una
scheda dati, come fanno i tre pulsanti della home.

**Dati.** `ensureSummary()` condivide una `promise` (`state.step1.summary.promise`) fra i render che arrivano
insieme: senza, il secondo render disegnerebbe la pagina prima dei conteggi e nessuno la ridisegnerebbe. Per
ogni tabella un `list({ filters, include: ["id"], page: [1, 1] })`: una riga, e il totale e' nel campo
`results` della risposta; con un'organizzazione scelta si legge anche il totale generale, per «su N in
totale» (6 chiamate invece di 3). `Promise.allSettled`: una tabella che fallisce mostra «—» e non toglie
le altre. Il conteggio e' per `summaryOrg`: cambiare organizzazione ricarica, un ridisegno con la stessa no;
riaprire la scheda (`setSummaryTab()`) azzera la chiave e rilegge, perche' i dati possono essere cambiati.
`results` mancante o non numerico e' un errore («Conteggio non disponibile»), non uno zero.

**Filtro.** Ha il proprio valore, `state.step1.summaryOrg` ("all" o un codice), non quello di una scheda
dati; `renderOrgFilterControl(key)` disegna tendina e lente per entrambi, con la chiave `"riepilogo"` per
questa scheda, e `onOrgChange()`/`orgFilterValue()` la smistano. `applyGroupDefault()` imposta anche
`summaryOrg`. Un riquadro (`openFromSummary()`) copia l'organizzazione nel filtro della scheda scelta e vi
passa.

**Nel view().** In modalita' riepilogo non si leggono permessi, lista, colonne ne' registro dei
trasferimenti, e `skipFetch` viene azzerato (uno rimasto da una finestra aperta sul riepilogo farebbe saltare
la prima lettura della scheda dati successiva). Non c'e' il pulsante di creazione.

**Ripartizione per categoria e tipologia.** Sotto i riquadri, per mezzi e materiali, riusa `countClasses(tab, org)`
(le righe lette a pagine di `EXPORT_PAGE`, con le sole colonne `categoria` e `tipologia`; il parametro `org` e' stato aggiunto
per il filtro, la finestra **Classificazioni** non lo passa) e `classSection()` con `{ onlyUsed: true }`, che omette
categorie e tipologie senza risorse invece di elencare tutta la definizione con gli zeri come fa la finestra. L'ordine e' quello
della scheda (`MEZZI_CAT_OPT`/`MEZZI_TIP_OPT`, `MAT_CAT_OPT`/`MAT_TIP_OPT`); cio' che non e' nella definizione va in
«Fuori elenco». In modalita' `onlyUsed` la coppia (categoria definita, tipologia vuota) conta come nota (`known`) e si
mostra sotto la categoria come «(tipologia non indicata)»: altrimenti la stessa risorsa comparirebbe due volte, sotto la
categoria e in «Fuori elenco» come «cat / (tipologia vuota)», che e' invece ancora il comportamento della finestra
**Classificazioni**. Il titolo di sezione e' un `title is-5` dentro un `box`, sopra i titoli di colonna (`title is-6`);
il totale di colonna va al singolare con una sola risorsa. Le letture stanno nella stessa promise dei conteggi (la pagina aspetta entrambi) ma con un
`Promise.allSettled` a parte: se falliscono, `s.classError` mostra «Ripartizione non disponibile» e i riquadri restano. **Collegamenti.** `classSection()` accetta `opts.onPick(cat, tip)`: con quello disegna come `<a>` il nome della categoria e delle
tipologie che la scheda definisce (`byCat[cat].includes(tip)`), e `openFromSummary(tab, { cat, tip })` imposta
`selectedOrgByTab`, `catFilterByTab`, `tipFilterByTab` e azzera il filtro per colonna della scheda di arrivo: nessun filtro
rimasto la restringerebbe oltre cio' che il riepilogo ha contato (il clic su un riquadro azzera categoria e tipologia
per lo stesso motivo). Senza collegamento «(tipologia non indicata)» e «Fuori elenco»: `tipFilter === ""` significa «tutte» e un
valore fuori lista non sarebbe fra le opzioni del menu, che cadrebbe sulla prima. I collegamenti hanno la classe `rm-classlink`: colore del testo, e blu con sottolineatura solo al passaggio del
mouse o con il focus da tastiera; una colonna di nomi tutta blu annegava la gerarchia fra categorie, tipologie e
conteggi. La finestra **Classificazioni** non passa `onPick` e resta senza collegamenti. Costo:
2 letture in piu' per apertura o cambio di organizzazione, di una pagina ciascuna fino a 1000 righe (circa 940 mezzi negli esempi).
I volontari non hanno categoria: nessuna ripartizione.

### La scheda Mappa (`views/resource-manager/map.js`)

E' un pannello come il Riepilogo (`state.step1.showMap`, esclusivo con `showSummary`; `?tab=mappa` la apre) ma sta in
un file a parte, seguendo lo schema dei moduli condivisi: non renderizza da se', esporta `createResourceMap(deps)` →
`{ template, load, reset, afterRender, bind, state }` e step1 lo importa **dinamicamente con la versione**
(`ensureMapPanel()`, alla prima apertura). `bind(deps)` lo richiama ogni `Step1()`: il pannello vive in
`state.step1.mapPanel` e sopravvive a una invocazione, quindi i suoi callback (`rerender`, `vocab`, `onOpen`, `errorText`)
non possono restare quelli della prima. `onOpen` e' `openList()`, la stessa che usa il riepilogo.

**Perche' numeri e non marker.** Le risorse non hanno coordinate, ereditano quelle dell'organizzazione
(`db-organizzazioni.latitudine/longitudine`): un marker per risorsa ne impilerebbe centinaia sugli stessi punti, e
anche raggruppandoli (markercluster) non si separano mai zoomando. La mappa disegna un cerchio (`L.divIcon`, nessuna immagine)
per **luogo**, con il **numero** di risorse che rispettano i filtri; diametro `26 + 38·√(n/max)` px, al massimo 64.

**Dati.** Una lettura sola a ogni apertura (`reset()` la invalida): `db-organizzazioni` (codice, denominazione, comune,
provincia, coordinate; fino a 5000) e, a pagine di 1000 come l'export, `db-mezzi` e `db-materiali` con le sole colonne
`codice-organizzazione`, `categoria`, `tipologia`. `Promise.allSettled`: una lettura che fallisce non toglie le altre
(`st.error`, con Riprova). Le coordinate passano da `parseCoord()`: non numeriche, fuori scala (|lat| > 90, |lon| > 180) o 0/0
(una cella vuota letta come zero non e' un luogo) valgono «senza posizione». I filtri sono tutti **in memoria**: cambiarli non
rilegge nulla.

**Il conto** (`compute()`, puro): scorre le righe dei tipi attivi, scarta quelle che non rispettano categoria e tipologia, e le assegna
a un luogo: l'organizzazione (`org`), il suo comune o la sua provincia (`by`). Un gruppo sta nel **punto medio** delle
organizzazioni distinte che lo compongono. Una risorsa con organizzazione sconosciuta o senza posizione e' «non posizionabile»: conteggiata
a parte e nominata, mai scartata. `sanitize()` toglie dalla scelta una categoria o una tipologia che i tipi attivi non offrono piu'.

**Disegno.** `afterRender(root)` (chiamato dal `refresh()` di step1 dopo `render`) cerca `#rm-map`, carica Leaflet con
`loadLeaflet()` di `views/shared/map-picker.js` (import dinamico con la versione, come tutto il codice condiviso; Leaflet e' una copia locale in `camila/js/leaflet/`), crea la mappa
**una volta per nodo** e a ogni render ricostruisce solo il `layerGroup`. `fitBounds` solo alla prima volta: filtrare non
deve far saltare la vista. Un token (`drawToken`) scarta i disegni scavalcati da un render piu' recente mentre Leaflet si caricava. Il popup e' fatto con
`createElement` e `textContent` (i nomi delle organizzazioni sono dati), e per `by === "org"` ha i collegamenti `onOpen(tab, { org, cat, tip })`; `cat`
e `tip` passano solo se la scheda di arrivo li ha fra le opzioni (altrimenti il menu mostrerebbe «Tutte» con la lista filtrata).
Per Comune e Provincia non ci sono collegamenti: non sono un solo filtro dell'elenco.

**Larghezze dei filtri.** Categoria e Tipologia non hanno una larghezza fissa: `flex: 1 1 230px` (min 200, max 340) e `flex: 1 1 260px` (min 220, max 460),
con la riga che va a capo (`flex-wrap`) sugli schermi stretti. Con 200 px fissi «MATERIALE IDROGEOLOGICO» veniva tagliata; la tipologia piu' lunga
(«MATERIALE LOGISTICO PER TENDE (CESTELLI / CASSE)») nel menu chiuso si legge fino a meta' e per intero nell'elenco aperto e nel `title` del menu.

**Senza internet.** Leaflet e' locale, le tessere no: i cerchi si disegnano comunque, su sfondo vuoto. Il layer delle tessere ascolta `tileerror` e,
la prima volta, imposta `st.tilesError` e ridisegna: il template mostra una riga che dice che lo sfondo non si carica (`data-map-tiles`).
**Senza libreria.** Se i file locali mancano (`st.leaflet === "error"`) il template toglie `#rm-map`, dice perche' e apre l'**Elenco numerico**; il ridisegno
chiesto per mostrarlo avviene **una volta sola** (`before !== "error"`), altrimenti si ripeterebbe a ogni render: nel test
con un finto DOM che restituiva sempre il nodo, era un ciclo infinito. Il codice sta fuori da `step1.js` anche perche' e' un file gia' molto lungo.

### Il gruppo dell'utente come predefinito

`ensureWhoami()` chiama una volta `GET /whoami` del framework (`specs/api/whoami/`) e tiene la risposta in
`state.step1.whoami = { loaded, data }`; senza `client.call`, o con un errore (un framework senza l'endpoint
risponde 404), `data` resta `null` e non si applica nulla. `groupOrg()` risolve il gruppo contro `state.step1.orgCatalog`
**solo se l'utente non e' amministratore** e il gruppo (senza distinguere maiuscole) e' il codice di
un'organizzazione dell'anagrafica; restituisce la voce del catalogo, quindi nome e provincia sono
quelli dell'anagrafica.

Due usi, entrambi predefiniti e non vincoli:

* **Filtro.** `applyGroupDefault()` gira in `view()` dopo `ensureOrgCatalog()`/`ensureWhoami()` e
  **prima** di `ensureLoaded()`, cosi' anche la prima lista e' gia' filtrata: ogni scheda che e' ancora
  su «Tutte» passa a quel codice. `state.step1.groupDefaultApplied` lo rende unico per pagina, per
  lasciare all'operatore la scelta di tornare a «Tutte». Se il catalogo e' vuoto non marca come
  applicato e ritenta al render successivo.
* **Nuova risorsa.** `startCreate()` chiede `groupOrg()`: se c'e' un'organizzazione di gruppo **salta la
  finestra** e chiama direttamente `startCreateConOrg(tab, org)`, come se l'avesse scelta l'operatore (stesso
  `state.createOrg`, stessa `lastCreateOrg`). Il passo 2 e' invariato. Senza organizzazione di gruppo
  (amministratore, gruppo non-organizzazione, gruppo vuoto, `/whoami` non riuscito) si apre la finestra
  come prima. Conseguenza voluta: chi ha un gruppo-organizzazione non puo' creare per un'altra
  dalla UI, come il campo di gruppo del framework, non modificabile per i non amministratori.

Non e' un controllo di accesso: il browser non puo' impedire nulla e un amministratore o chiunque
chiami l'API vede il resto. La visibilita' per gruppo la fa il framework (opzione **VG** sulla colonna e
`visibility_type = group` sull'utente: `_list()` filtra la REST API) e in quel caso questa SPA riceve gia'
liste ristrette; il predefinito qui evita solo di partire da una lista piu' larga del necessario.

### L'ultima organizzazione scelta

`startCreateConOrg()` salva la scelta in `state.step1.lastCreateOrg = { code, name, province }`.
La finestra la propone in cima (`createPickerOffers()`) solo a ricerca vuota, con la
voce «Ultima organizzazione usata», e la toglie dall'elenco sotto per non ripeterla. Si
risolve contro `state.step1.orgCatalog` (valgono nome e provincia dell'anagrafica, e se il
codice non c'e' piu' non si offre nulla). E' una **proposta**: nessuna preselezione e nessun
salto della finestra, perche' un'organizzazione presa per abitudine sarebbe sbagliata in
silenzio, e `organizzazione`, `codice-organizzazione` e `provincia` non si correggono poi dal
form. Vive solo in `state`: niente `localStorage`, quindi dura quanto la pagina; una
persistenza fra sessioni e' possibile ma non richiesta. Lo registra la scelta, non il
salvataggio: chi apre la scheda e poi annulla ritrova comunque quella organizzazione.

### Una sola sorgente: `db-organizzazioni`

La finestra di creazione, il filtro dell'elenco e la destinazione del
trasferimento (§7f) leggono tutti la stessa anagrafica, `state.step1.orgCatalog`
(`ensureOrgCatalog()`). La finestra la ordina per **denominazione**, che è ciò
che l'operatore digita; il catalogo è ordinato per codice.

Prima la finestra leggeva le organizzazioni dai volontari
(`db-volontari.distinct("codice-organizzazione")`, con ripiego sull'anagrafica):
un elenco più corto, "già in campo". È stato tolto perché un'organizzazione
**senza volontari** non compariva e, non essendo l'organizzazione modificabile dal
form, non c'era modo di registrarle una risorsa; e perché il refuso di un singolo
volontario diventava un'opzione valida (gli stessi difetti di cui sopra). Non
c'è più `orgFromRecords` né la chiamata alla distinct all'apertura della finestra.

Conseguenza da conoscere: la finestra offre **ogni** organizzazione censita,
anche quelle che all'evento non ci sono; si cerca per denominazione o codice.

### L'organizzazione non si cambia dal form

Nel form è un **campo fisso**, con il lucchetto sull'etichetta: niente tendina,
niente modifica. Si stabilisce alla creazione, scegliendola nella finestra, e da
lì non cambia più — né creando né modificando.

Ne discende che `codice-organizzazione` e `provincia`, che da essa si derivano,
sono stabili per tutta la vita del record. L'unico modo di cambiarla è il
trasferimento di un mezzo o di un materiale (§7f), che lo registra con la motivazione.

Il `<select>` che c'era prima, con l'opzione "fuori elenco" e il riallineamento
di provincia al cambio, non esiste più; `orgCatalogByName` e `orgSelectKey`
sono stati rimossi con lui. Restano `orgMap` e `orgProvMap`, che servono a
`reconcileOrgFromCatalog()` e al payload.

### `targa` anche sui materiali

`db-materiali` ha una colonna `targa`, e serve: rimorchi, carrelli e roulotte
sono passati dai mezzi ai materiali con la nuova classificazione, e la targa e'
il loro identificativo.

Era assente da `RM_CONFIG.materiali.fields`, quindi il campo **compariva solo in
modifica** — `getFields()` aggiunge le chiavi presenti nel record, e in
creazione la bozza non ne ha. Aggiunta anche a `PREFERRED_COLS.materiali` e ai
campi di ricerca, cosi' un rimorchio si trova digitandone la targa.

### Proprietario

Tendina alimentata dalle **denominazioni** di `db-organizzazioni`, non dai
codici: i valori storici sono denominazioni (`PROVINCIA DI CREMONA`,
`O.V. LE AQUILE`) e il campo continua a salvare quelle.

Non e' l'organizzazione del record: dice **di chi e'** la risorsa, che spesso
non coincide con chi la porta in campo — nei dati attuali 19 mezzi sono della
Provincia e 16 della Regione, assegnati a organizzazioni diverse.

Un valore che in anagrafica non c'e' resta selezionato come `"… (fuori elenco)"`
con un avviso sotto, invece di essere scartato: fra i dati attuali
`REGIONE LOMBARDIA` e i vari `COMUNE …` potrebbero non essere organizzazioni
censite.

### Codici fuori elenco

Un record può referenziare un codice che in `db-organizzazioni` non c'è —
storico, o cancellato dopo. Il campo lo mostra comunque, con il nome che il
record stesso porta, e sotto compare l'avviso *"Codice non presente in
anagrafica organizzazioni"*: il valore non viene mai scartato in silenzio, come
vuole AGENTS.md §Derived fields.

È il segnale che quell'organizzazione va aggiunta all'anagrafica — e, non
essendo il campo modificabile, è l'unico modo di risolverlo.

## 12. Step 2 — form completo

### La bozza riparte da zero a ogni apertura

`ensureLoaded()` rilegge la bozza solo se cambia `state.step2.loadedKey`, che e'
`tab||mode||id`. In **creazione** l'id e' vuoto, quindi la chiave e' sempre la stessa
(`materiali||create||`): dopo un salvataggio, un secondo «Aggiungi nuova risorsa»
trovava la chiave uguale, saltava la lettura e riapriva la bozza di prima, con
l'organizzazione scelta prima e il suo `id-materiale` — che quindi non chiedeva la
`sequence()` e poteva duplicare l'id appena salvato. Lo stesso valeva in modifica:
dopo **Annulla** le modifiche abbandonate tornavano alla riapertura.

La correzione sta in step 1, non in step 2: `forgetStep2Draft()` azzera `loadedKey`
in tutti i modi di entrare nello step 2 (`startCreateConOrg()`, `startEdit()`). Non
si azzera in uscita (`doSave()`/`doCancel()`) perche' `doSave()` chiama `refresh()`
anche dopo `goTo(1)`: con la chiave vuota rileggerebbe il record, e in creazione di
materiali consumerebbe un numero della sequenza per niente.

### Un salvataggio non puo' diventare una creazione

`doSave()` sceglie fra `update(id, …)` e `create(…)` da `getContext()`, che legge
`state.editMode` e `state.editId`. Entrambi vengono azzerati **subito dopo** una scrittura
riuscita, prima che lo step 1 sia disegnato (`goTo(1)` monta in modo asincrono). In quella
finestra il form e' ancora a schermo e un secondo clic su **Salva** leggeva il contesto come
«creazione» e inseriva gli stessi dati come record nuovo; lo stesso faceva il `refresh()` nel
`finally` di `doSave()`, che ridisegnava lo step 2 come nuova risorsa (chiamando anche la
`sequence()` per un `id-materiale` mai usato). Tre difese, tutte in `step2.js`:

* `doSave()` esce subito se `state.step2.saving` o se `state.step` non e' 2;
* `refresh()` non fa nulla, e non disegna dopo l'`await`, se `state.step` non e' 2 (lo stesso
  controllo, con 1, e' in `refresh()` dello step 1: un ridisegno tardivo non copre lo step 2);
* se il contesto e' «modifica» ma manca l'id, `doSave()` non scrive nulla e mostra
  «Risorsa senza identificativo: salvataggio annullato, nessun dato scritto.» invece di
  ricadere su `create()`.

`state.step` lo imposta `goTo()` in `app-boot.js` in modo sincrono, quindi vale gia'
dalla riga dopo la chiamata.

### Conferma del salvataggio

Dopo una scrittura riuscita `doSave()` scrive `state.step1.notice = { text }` con
`savedNotice(tab, payload)`: «<Volontario|Mezzo|Materiale> salvato: <identificativo>
(<organizzazione>).». L'identificativo e' cognome e nome (o codice fiscale) per i
volontari, targa (o codice inventario, o marca e modello) per i mezzi, `id-materiale`
(o categoria e tipologia) per i materiali. Step 1 la mostra in un riquadro
`notification is-success is-light` sopra la ricerca rapida, con la ✕
(`dismissNotice()`); la azzerano anche `startCreate()`, `startCreateConOrg()`,
`startEdit()` e `setTab()`. Non ha scadenza: un timer richiederebbe un `refresh()` fuori
da ogni azione dell'operatore. Un salvataggio fallito non la scrive: resta l'errore
nella scheda.

### Sola lettura

Lo step 2 non aveva alcuna nozione di permessi: ogni controllo era disabilitato
solo durante il salvataggio. Chi ci arrivava senza permessi di scrittura vedeva
un form modificabile, e scopriva il rifiuto solo al salvataggio.

```js
function isReadOnly(tab, mode) {
  if (state.step1?.readOnlyGlobal) return true;
  const p = state.step1?.permissionsByTab?.[tab];
  if (!p) return true;                                  // ignoto = sola lettura
  return mode === "create" ? !p.canCreate : !p.canUpdate;
}
```

Usa i permessi che lo **step 1 ha già letto**: nessuna chiamata aggiuntiva.
Permessi ignoti significano sola lettura, come prescrive AGENTS.md §Unknowns —
meglio un form che non si salva di uno che sembra modificabile e viene rifiutato
dal backend.

In sola lettura:

* ogni campo, tendina e pulsante del form è disabilitato (11 controlli più Salva);
* **"Indietro" e "Annulla" restano attivi**: sono l'unica via d'uscita;
* l'intestazione mostra il tag `Sola lettura` con il lucchetto;
* `doSave()` esce subito anche se venisse invocata: i controlli disabilitati
  sono interfaccia, la guardia nel gestore è ciò che ferma davvero la scrittura.

Gli altri controlli sui permessi nello step 1 — cancellazione, editing inline,
creazione — restano dove sono: lì l'azione è immediata e non c'è una schermata
in cui atterrare.

### Sola lettura per singolo campo

Due cose diverse decidono se un campo si può modificare:

| | Da dove | Riguarda |
|---|---|---|
| permessi sulla tabella | `permissions()`, letti dallo step 1 | **chi sei** |
| `readonly` sulla colonna | `describe()`, configurazione della scheda | **cos'è il campo** |

```js
function fieldReadOnly(tab, readOnly, col) {
  if (readOnly) return true;                      // la tabella non è scrivibile
  const t = RM_CONFIG[tab]?.table;
  return colMeta[t]?.[col]?.readonly === true;    // la colonna è di sola lettura
}
```

`colMeta` viene da `loadColumns()` sulle tre tabelle `db-*`: è la **stessa
chiamata** già fatta per i vocabolari, quindi non costa nulla in più.

Ogni campo del form valuta la propria colonna; il pulsante Salva resta legato al
solo permesso di tabella, perché il salvataggio riguarda il record e non il
singolo campo.

**Le colonne di sola lettura escono anche dal payload** di `doSave()`. Il form
non potrebbe cambiarle, ma inviarle comunque significherebbe far fallire l'intero
salvataggio se il backend rifiuta la scrittura su una colonna che nessuno ha
toccato.

Da sapere: nella configurazione attuale **nessuna colonna è `readonly`** — i
describe di `db-mezzi` e `mezzi` riportano `"readonly": false` ovunque. La
funzione è quindi latente finché qualcuno non marca una colonna in Camila.

**Anche l'editing inline dello step 1 rispetta il flag.** `inlineBlocked(tab, col)`
unisce le due fonti — l'elenco fisso `INLINE_SKIP` e il `readonly` della
colonna — e governa sia il doppio click sia il cursore sulla cella. Senza, la
lista sarebbe la porta di servizio per modificare una colonna che il form
protegge.

### Campi che l'operatore non digita mai

`UI_READONLY_FIELDS` raccoglie i campi di sola lettura **per decisione della
UI**, non della worktable:

| Campo | Da dove arriva |
|---|---|
| `organizzazione`, `codice-organizzazione`, `provincia` | dal picker che precede la form |
| `id-materiale` | da `sequence()` all'apertura della form di creazione |

Sono disabilitati nella form, col lucchetto sull'etichetta, e stanno in
`INLINE_SKIP` per la tabella dello step 1.

**Sono esenti dallo strip del payload**, ed e' la parte che conta: il record ha
bisogno di quei valori anche se nessuno li ha digitati. Un `readonly` su quelle
colonne significa "non modificabile nella scheda Camila", non "non salvare":
senza l'esenzione una `create` scriverebbe la risorsa **senza organizzazione o
senza id, e senza errori**. Il controllo su `required` non protegge da questo,
perche' guarda il draft, dove il valore c'e', mentre lo strip avviene dopo.

**Una via d'uscita per `id-materiale`**: se la `sequence()` fallisce non c'e'
nessun id da mostrare, quindi il campo torna digitabile e l'avviso sotto la form
lo dice. Senza, un disservizio della sequence bloccherebbe ogni inserimento.

**Il flag non e' applicato dall'API.** La catena di middleware e'
`dbAuth,apiKeyDbAuth,authorization,sanitation`, e `authorization.columnHandler`
(`camila/api/cf_api_controller.inc.php`) esclude solo le colonne tecniche
(`created`, `last_upd`, `grp`, `is_deleted`, …): non legge mai
`CAMILA_TABLE_WORKC`. Il `readonly` e' quindi **solo un vincolo di interfaccia**,
e il backend accetta la scrittura. Vale la regola di AGENTS.md §Security: i
permessi lato frontend sono una guardia di UX.

**Non esiste un `readonly` per ruolo.** Il flag e' uno solo per colonna
(`c.readonly` in WORKC), senza dimensione di gruppo: marcarlo vale per tutti,
amministratori compresi. Il controllo per gruppo in Camila sta a livello di
**tabella**, nei `.access.inc.php` generati per worktable
(`$_CAMILA['adm_user_group'] == CAMILA_ADM_USER_GROUP`), che oggi su tutte le
worktable del progetto e' scritto `? true : true`, cioe' disinnescato. Togliere
un singolo campo ai non amministratori non e' esprimibile: la grana minima e'
l'update dell'intero record.

### Le altre proprietà della colonna

Oltre a `readonly`, il describe porta `required` e `maxlength`, e il form li usa:

| Proprietà | Effetto |
|---|---|
| `required` | asterisco rosso sull'etichetta, e `doSave()` rifiuta elencando i campi vuoti |
| `maxlength` | limite di battitura sul campo (attributo `maxlength`, vuoto quando non c'è) |
| `readonly` | campo disabilitato, lucchetto sull'etichetta, colonna fuori dal payload |

`maxlength` è il massimo **configurato**, che non è `length`, la dimensione
fisica della colonna: su `mezzi.provincia` la colonna è `varchar(250)` ma la
scheda dichiara 2 caratteri. Limitare su `length` non limiterebbe nulla.

Il limite si passa come **attributo** e non come proprietà `.maxLength`:
assegnare `-1` alla proprietà lancia `IndexSizeError`, mentre leggerla restituisce
`-1` quando non è impostata — getter e setter non accettano lo stesso dominio.
Un attributo vuoto è invece un valore non valido che il browser ignora, cioè
esattamente "nessun limite".

Il controllo sugli obbligatori sta in `doSave()` e non solo nel markup: il
backend rifiuterebbe comunque la scrittura, e un rifiuto spiegato come "campi
obbligatori non compilati" vale più di un errore API grezzo.

Non usate: `unique` (servirebbe una verifica remota prima di salvare),
`visible` (nasconderebbe colonne che oggi si vedono: è un cambio di
comportamento da decidere), `sequence` — che governa invece l'ordine nella
tabella dello step 1, vedi §7c.


Usato per creazione e modifica. Mantiene un `draftRow` con le modifiche in corso. Al salvataggio chiama `.create(payload)` o `.update(id, payload)` in base a `editMode`. Dopo il salvataggio torna a step 1 e invalida la cache (`state.master[tab] = null`).

Campi gestiti con logica speciale in step 2:
- `organizzazione` → select + auto-fill `codice-organizzazione` e `provincia`
- `categoria` (mezzi) → select; cambio resetta `tipologia`
- `tipologia` (mezzi) → select filtrata per `categoria`; disabilitata se categoria = "Non assegnata"
- `categoria` (materiali) → select; stessa logica
- `tipologia` (materiali) → select filtrata per `categoria`; una tipologia non ammessa dalla categoria scelta viene azzerata; se la categoria non ha tipologie → campo disabilitato con "—" e help "Nessuna tipologia disponibile per questa categoria."
- `targa` (mezzi, create) → normalizzata in uppercase
- `codice-fiscale` (volontari, create) → normalizzato in uppercase
- `id-materiale` (materiali, create) → pre-fill con `client.table("db-materiali").sequence()`; campo in sola lettura, salvo fallimento della sequence (vedi §11)

## 13. File

| File | Ruolo |
|---|---|
| `app-resource-manager.js` | Entry point: spinner di caricamento, routing step 1/2, showError |
| `views/resource-manager/step1.js` | Lista con filtri, paginazione, editing inline |
| `views/resource-manager/step2.js` | Form creazione/modifica |
| `views/resource-manager/assets/mezzi-marche.txt` | Lista marche mezzi per autocomplete |
| `resource-manager.inc.php` | Mount SPA (`mountMiniApp`) |
| `dashboard_resource-manager.inc.php` | Alias per dashboard (`require resource-manager.inc.php`) |
