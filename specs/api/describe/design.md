# Design: `describe()` con la configurazione della colonna

## 1. Struttura

```
SPA
 └── views/shared/vocabularies.js        cache + parsing + copia di riserva
      └── client.table(<tab>).describe()  →  GET /columns/<tab>
           └── camila/api.include.php — ColumnController
                └── camila_describe_table()
                     └── CAMILA_TABLE_WORKC ⨝ CAMILA_TABLE_WORKT
```

## 2. Il problema

Il controller `columns` di php-crud-api serializza una `ReflectedColumn`:
`name`, `realName`, `type`, `length`, `precision`, `scale`, `nullable`, `pk`,
`fk`. È la riflessione della **tabella fisica**, letta dallo schema del
database.

L'elenco dei valori è configurazione Camila: vive in
`CAMILA_TABLE_WORKC.listbox_options` e la riflessione non lo incontra mai. Il
`mapping` che collega i due mondi è un rinominatore — trasporta i nomi, non la
configurazione — quindi `describe()` dava `categoria` al posto di `cf_c123` ma
non i valori ammessi.

## 3. Estensione del framework

In `camila/api.include.php`, fuori dal plugin.

| Punto | Cosa |
|---|---|
| `ColumnController::getDatabase` | la tabella riflessa passa da `camila_describe_table()` |
| `ColumnController::getTable` | idem |
| `ColumnController::getColumn` | innesto della configurazione + rinomina |
| `Api::__construct` | una riga: consegna la `Cache` al custode |
| coda del file | quattro funzioni globali |

Le funzioni stanno dentro un `namespace { }`: il file usa namespace con
parentesi e il codice globale non può stare fuori.

| Funzione | Ruolo |
|---|---|
| `camila_worktable_column_config($tablename?)` | una query su `WORKC ⨝ WORKT`, cache statica per richiesta |
| `camila_describe_table($table)` | serializza la tabella riflessa e vi innesta la configurazione |
| `camila_describe_public_names($json)` | porta `alias` in `name` e toglie `alias` |
| `camila_describe_merge($col, $meta)` | fonde la configurazione nella colonna |
| `camila_api_cache_handle($cache?, $ttl?)` | custode della `Cache` costruita da `Api` |

Nessuna rotta nuova, nessuna modifica a `ReflectedColumn`, `ReflectedTable`,
`ReflectionService`, al router o al mapping.

## 3b. Quante query, e quando

### Il filtro

`camila_worktable_column_config()` prende il nome **fisico** della tabella
(`worktableNN`) e filtra la query su quello. Omettendolo legge la
configurazione di tutte le worktable, che serve solo a `GET /columns` senza
tabella — e lì viene chiamata **una volta in testa al ciclo**, altrimenti ogni
tabella farebbe la sua query.

Senza il filtro, descrivere una tabella significava leggere le colonne di tutte
le worktable e scartarle in PHP: oltre mille righe per usarne trenta.

### Due livelli di cache

| Livello | Dove | Durata |
|---|---|---|
| per richiesta | `static $cache` nella funzione | la singola richiesta HTTP |
| fra richieste | la `Cache` del framework | `CAMILA_DESCRIBE_CACHE_TTL`, 300s di default |

Il secondo usa lo stesso oggetto `Cache` che `ReflectionService` usa per lo
schema — `TempFile` di default, quindi su disco e condiviso fra richieste e
utenti — ma con un TTL **proprio**. Il valore è `gzcompress(json_encode(...))`
sotto la chiave `camila-WorktableColumnConfig(<tablename>)`, con `<tablename>`
vuoto per la lettura completa, lo stesso schema di `ReflectedTable`.

A regime la query sul database avviene **una volta ogni TTL**, non a ogni
describe.

### Perché un TTL separato da `cacheTime`

`cacheTime` vale 10 secondi ed è tarato sullo **schema**: cambia di rado, ma
quando cambia va visto subito. Un vocabolario cambia ancora più di rado e non ha
la stessa urgenza, quindi legarlo a quel valore significava interrogare il
database molto più del necessario.

Alzare `cacheTime` non era la strada: è globale e trascinerebbe anche la
riflessione, cioè il caso in cui i 10 secondi servono davvero.

```php
// config.php
define('CAMILA_DESCRIBE_CACHE_TTL', 300);   // secondi; 0 disattiva
```

A **0** la cache fra richieste è disattivata e resta solo quella per richiesta:
è la via da usare mentre si sta mettendo a punto un vocabolario, quando
aspettare la scadenza dà fastidio.

### Come la funzione arriva alla cache

`ColumnController` riceve Router, Responder, ReflectionService e
DefinitionService, ma **non** la Cache. Invece di ricostruirla con
`CacheFactory::create()` — che vorrebbe dire replicare prefisso e tipo, cioè
duplicare scelte che vivono in `Api::__construct` e lì possono cambiare — una
riga aggiunta a `Api::__construct` la consegna a un custode:

```php
$cache = CacheFactory::create($config->getCacheType(), $prefix, $config->getCachePath());
\camila_api_cache_handle($cache, $config->getCacheTime());
```

`camila_api_cache_handle()` con un argomento memorizza, senza argomenti
restituisce `[$cache, $ttl]`. Se non è mai stata popolata — la funzione chiamata
fuori da una richiesta API — torna `null` e resta solo la cache per richiesta:
degrada, non rompe.

### Cosa la cache non fa

**Non c'è invalidazione, solo scadenza.** Modificando le `listbox_options` di
una colonna, il describe continua a restituire le vecchie fino allo scadere del
TTL — con il default, fino a cinque minuti. È il prezzo del TTL lungo, e il
motivo per cui esiste lo 0: il configuratore di Camila scrive su `WORKC` senza
sapere che questa cache esiste, quindi non può svuotarla.

Se un giorno la latenza desse fastidio, il punto dove intervenire è il
configuratore — una `clear()` dopo il salvataggio delle colonne — non il TTL.

**Un errore di lettura non viene memorizzato.** Se la query fallisce la funzione
esce prima della scrittura in cache, così un guasto transitorio non resta
appiccicato per `cacheTime`. Un risultato legittimamente vuoto — una tabella che
non è una worktable — viene invece memorizzato: è una risposta valida.

## 4. L'aggancio è sul nome fisico

```php
$meta = $perTable[$col['name'] ?? ''] ?? null;   // prima della rinomina
```

`tablename` + `col_name` sono una chiave esatta e non dipendono da nessuna
trasformazione di nome.

Attenzione all'ordine: `ReflectedColumn::serialize()` mette il nome **fisico**
in `name` e quello pubblico in `alias`.

```php
'name'  => $this->realName,
'alias' => $this->name != $this->realName ? $this->name : null,
```

L'aggancio avviene quindi **prima** della rinomina. Subito dopo,
`camila_describe_public_names()` porta `alias` dentro `name` e toglie `alias`:
il nome fisico non serve a chi consuma l'API e mostrarlo invita solo a
costruirci sopra.

La trasformazione sta **solo nel describe**, non in `serialize()`, così il giro
`serialize()` → `fromJson()` che `DefinitionService` usa internamente resta
quello di sempre — e `fromJson` legge proprio `$json->alias ?? $json->name`.

## 5. Forma della risposta

La configurazione **è fusa dentro la colonna**, non annidata sotto una chiave
sua: aggiunge ciò che manca e sovrascrive ciò che c'è già.

```json
{ "name": "mezzi", "type": "table", "label": "MEZZI",
  "columns": [
    { "name": "tipologia",
      "type": "string-listofvalues", "dbType": "varchar",
      "length": 250, "nullable": true,
      "label": "TIPOLOGIA", "abbrev": "TIPOLOGIA", "sequence": 11,
      "required": false, "readonly": false, "unique": false, "visible": true,
      "maxlength": 255,
      "options": ["Non assegnata", "--VEICOLI", "AUTOCARRO", "…"] } ] }
```

Una tabella che non è una worktable resta come prima: nessuna chiave aggiunta.

### `type` è l'unica collisione

Per la riflessione `type` è il tipo SQL (`varchar`), per Camila il tipo di campo
(`string-listofvalues`). **Vince Camila**, che è il più informativo dei due; il
tipo SQL non viene buttato ma spostato in `dbType`, perché serve a chi valida.
`dbType` compare solo quando i due differiscono.

Nessun'altra chiave si sovrappone: `label`, `abbrev`, `sequence`, `required`,
`readonly`, `unique`, `visible`, `maxlength`, `default` e `options` non esistono
in php-crud-api.

`maxlength` e `length` restano entrambi e **non** sono la stessa cosa: il primo
è il massimo configurato nella scheda, il secondo la dimensione fisica della
colonna. Di norma coincidono; quando non coincidono dicono due cose diverse.

### Il prezzo del merge piatto

Non c'è più modo di distinguere, guardando il JSON, cosa viene dalla riflessione
e cosa dalla configurazione. Se una versione futura di php-crud-api introducesse
una colonna chiamata `label` o `required`, la configurazione Camila gliela
sovrascriverebbe in silenzio. È il compromesso accettato in cambio di un payload
senza annidamenti.

### Altri dettagli

`options` è l'elenco già diviso. I marcatori `--Categoria` restano fra le voci —
sono voci a tutti gli effetti — ed è il chiamante a interpretarli. La stringa
grezza `listbox_options` **non** viene esposta: sarebbe lo stesso dato due
volte.

I booleani vengono da colonne che valgono `y`/`n` (vedi
`camila.worktable.options.noyes`) e sono convertiti in `true`/`false`.

**`default` è un'espressione, non un valore.** Camila vi ammette segnaposto che
interpreta al momento dell'inserimento: una risposta reale contiene `"adesso"`,
`"oggi"`, `"ultimo valore"`. Usarlo per precompilare un campo ci scriverebbe
dentro quelle parole. Va interpretato, o ignorato.

**`maxlength` non è `length`, e divergono per davvero.** Su `mezzi.provincia` la
colonna fisica è `varchar(250)` mentre la configurazione dichiara
`maxlength: 2`. Chi valida deve guardare `maxlength`. Su colonne non testuali
(`integer`, `date`) il valore è il default di Camila, 255, e non significa
niente.

**`id` e `uuid` non ricevono configurazione**: sono colonne fisiche che la
worktable non dichiara. Restano quindi senza `label`, ed è anche il motivo per
cui il controllo "describe esteso" cerca `label` su *almeno una* colonna e non
su tutte.

Se la query fallisce, `describe()` torna quello di prima senza errore: meglio
povero che rotto.

## 6. Dove vive

La patch è in `camila/api.include.php`, quindi nel framework e non nel plugin:
va portata in `linkingtechnologies/camila-php-framework`.

## 7. Modulo client — `views/shared/vocabularies.js`

**Divergenza dal contratto dei moduli condivisi** (AGENTS.md §Moduli
condivisi): non compone markup, quindi non è una fabbrica con `html` e
`rerender`. Sono funzioni di dati.

```js
loadVocabularies(client, table)   // Promise<{colonna: string[] | csv}>
loadCatalog(client, table)        // Promise<{categories, byCat, all, itemToGroup}>
buildCatalog(tipologieCsv, categorieCsv?)
parseCsvOptions(csv | string[])
FALLBACK                          // { mezzi: {...}, materiali: {...} }
```

**La cache contiene la promessa, non il risultato**: due viste che partono
nello stesso momento condividono una sola chiamata invece di farne due.

### Riconoscere un framework non esteso

```js
if (!cols.some(c => c && c.label)) {
  throw new Error("describe senza la configurazione delle colonne");
}
```

Col merge piatto non c'è un blocco la cui assenza segnali "framework non
esteso": serve una chiave che la configurazione porta **sempre**. È `label`,
che ogni colonna di una worktable ha.

Perché serve: una risposta senza vocabolari è ambigua — può voler dire "nessuna
colonna ha un elenco" oppure "il framework non è quello esteso". Il secondo caso
deve far scattare la copia di riserva, altrimenti le tendine resterebbero vuote
senza che nessuno capisca perché.

### La copia di riserva

È l'unica copia del vocabolario rimasta nel plugin — prima erano quattro.
Scatta su errore, e sul caso appena descritto. Senza, un describe non esteso
lascerebbe l'operatore senza tendine.

## 8. Formato del vocabolario

Le categorie sono marcate `--Nome` **dentro** l'elenco delle tipologie; le
tipologie che seguono appartengono a quella categoria fino al marcatore
successivo.

L'etichetta dopo `--` deve coincidere **carattere per carattere** con quella in
`categoria`: l'associazione tipologia→categoria è una `Map` esatta, quindi
`--Veicoli` contro `VEICOLI` lascerebbe il filtro vuoto senza alcun errore.

Se la colonna `categoria` non ha un vocabolario proprio, le categorie si
ricavano dai marcatori (`buildCatalog` senza secondo argomento). È il caso di
`materiali`.

Una virgola dentro un valore lo spezza in due voci: è il separatore e non c'è
escape. In `materiali.tipologia` esiste già `Serbatoio, cisterna antincendio`,
che diventa due voci — difetto del dato, non del codice.

## 9. Viste che lo usano

| Vista | Cosa prende |
|---|---|
| `views/resource-manager/step1.js` | catalogo **db-mezzi** e **db-materiali** (array e oggetti) |
| `views/resource-manager/step2.js` | idem |
| `views/massive-check-in/step4.js` | CSV mezzi, dati a `parseTipologieCsv` |
| `views/massive-check-in/step6.js` | CSV materiali, idem |
| `views/requests-board/index.js` | `stato`, `tipo-richiesta`, `priorita` di `richieste` |
| `views/intervention-manager/index.js` | gli stessi tre, più `servizi.stato` |
| `views/massive-check-in/step3.js` | `volontari.mansione` |
| `views/massive-check-out/step2.js` | `volontari.mansione` |
| `views/team-manager/index.js` | `squadre-dichiarate.mansione-principale` |
| `views/stock-manager/index.js` | `mov-consumabili.tipologia`, `.articolo`, `.unita-di-misura` |

Due coppie leggevano lo **stesso** vocabolario da copie distinte, da tenere
allineate a mano: i tre di `richieste` fra `requests-board` e
`intervention-manager`, e `volontari.mansione` fra check-in e check-out. Ora
ciascuno ha una sola definizione, nella colonna.

### Due colonne, non una nomenclatura sola

`volontari.mansione` e `squadre-dichiarate.mansione-principale` contengono oggi
gli **stessi** 19 valori, ma restano due colonne su due tabelle. Ogni tendina
legge la propria: offrire un valore che la colonna di destinazione non ammette
sarebbe sbagliato anche se l'altra tabella lo ammette.

Vale identicamente per `mezzi.categoria` contro `db-mezzi.categoria`: le prime
le scrivono check-in e check-out, le seconde `resource-manager`. Leggere quella
sbagliata e' un errore che non si vede finche' i due elenchi coincidono.

Ne segue che i due elenchi **possono divergere** — aggiungendo una mansione ai
volontari non comparirà fra le squadre — e che è una scelta di configurazione,
non un difetto. L'alternativa scartata era far leggere a entrambe
`volontari.mansione`, trattandola come l'unica nomenclatura: avrebbe lasciato
il vocabolario della colonna delle squadre senza nessun lettore, e chi lo
avesse modificato non avrebbe visto alcun effetto.

`servizi.stato` dichiara un primo valore **vuoto** — "nessuno stato scelto" —
che `parseCsvOptions` scarta: alla vista arrivano i soli stati veri, com'era
quando l'elenco era cablato.

### Valori predefiniti scelti per posizione

In entrambe le viste il valore iniziale di una nuova richiesta è scelto per
**indice**: primo per `stato` e `tipo-richiesta`, terzo per `priorita`, cioè
"3 - Normale" nell'elenco attuale.

Finché il vocabolario era cablato era una coincidenza innocua. Ora che arriva
dalla colonna è un legame fra l'**ordine** dell'elenco e il **significato** del
predefinito: riordinando le priorità in Camila cambia anche quale viene
proposta. Il comportamento è stato conservato — cambiarlo non era richiesto —
ma è un accoppiamento da conoscere prima di toccare quell'elenco.

L'accesso passa da un helper (`primo` / `primoRich`) che ripiega sul primo
elemento e poi sulla stringa vuota, così un vocabolario più corto del previsto
non produce `undefined`.

Le due viste di `massive-check-in` prendono il **CSV grezzo** e non il catalogo
già costruito, perché hanno un parser proprio (`parseTipologieCsv`) le cui
strutture — `groups`, `groupToItems`, `itemToGroup` — sono usate direttamente
nei template. Riusarlo è stato preferito a riscrivere quei template.

Tutte e quattro importano il modulo **dinamicamente** con `?v=${VERSION}`: un
import statico non riceverebbe il cache-busting (AGENTS.md §L'import deve
essere dinamico).
