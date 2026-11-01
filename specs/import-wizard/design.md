# Design — import-wizard

**Voce dashboard:** "Importazione dati esempio"
**File PHP:** `dashboard_iw.inc.php` → `import-wizard.inc.php`

## 1. Scopo

SPA amministrativa che sostituisce il vecchio `dashboard_iw.inc.php` (PHP puro). Permette di importare i file di esempio distribuiti con il plugin nelle schede dati worktable, selezionando più fogli contemporaneamente e avviando gli import in parallelo.

## 2. Struttura file

```
plugins/segreteria-campo/
  dashboard_iw.inc.php        ← thin wrapper: require('import-wizard.inc.php')
  import-wizard.inc.php       ← setup APP_CONFIG + I18N + mount SPA
  app-import-wizard.js        ← SPA lit-html
  lang/
    it.lang.php               ← chiavi camila.iw.*
    en.lang.php
```

## 3. Layout

Struttura visiva identica a `/cf_app.php?admin&dashboard=users`:

```
┌─────────────────────────────────────────────────────┐  ← box mb-4
│ ↑  Importazione dati esempio                        │     title is-4 con icona ri-upload-2-line
└─────────────────────────────────────────────────────┘

                               [↑ Importa (N)] ←── level-right, button is-primary is-small
                                                     disabilitato se nessuna selezione

── progress is-small is-primary (solo durante il caricamento iniziale) ──

┌──┬─────────────────────┬───────────────────────────┐  ← table is-fullwidth is-striped is-hoverable
│☐ │ Scheda dati         │ Stato                     │
├──┼─────────────────────┼───────────────────────────┤
│☑ │ Organizzazioni      │ nome-file.xlsx            │  ← file esempio disponibile
│☐ │ Volontari           │ nome-file.xlsx            │
│  │ Materiali           │ —                         │  ← nessun file esempio
│  │ Servizi             │ ✓ Importati: 42           │  ← già importato (tag is-success)
│  │ Comunicazioni       │ ✗ Messaggio errore        │  ← errore (tag is-danger)
└──┴─────────────────────┴───────────────────────────┘
```

La tabella ha 4 colonne: checkbox, Scheda dati, File esempio, Stato.

- **Colonna "File esempio"**: mostra sempre il nome del file se disponibile, altrimenti `—`. Se la tabella contiene già record, aggiunge `<span class="tag is-warning is-light">N record</span>`.
- **Colonna "Stato"**: mostra `—` a riposo, `<progress class="progress is-small">` durante l'import, tag `is-success`/`is-danger` dopo.
- **Checkbox** visibile solo per righe con file esempio non ancora importate.
- **Checkbox header** seleziona/deseleziona tutte le righe importabili.
- **Durante l'import**: checkbox e pulsante disabilitati per tutte le righe.
- **Dopo l'import**: il risultato rimane nella colonna Stato; la checkbox sparisce.
- **Warning tabelle non vuote**: quando almeno una riga selezionata ha `count > 0`, appare un `<article class="message is-warning">` con la lista delle schede interessate. Il warning è reattivo alla selezione e non blocca l'import.
- **Errori di caricamento**: `<article class="message is-danger">` inline (senza `section/container`).

## 4. API utilizzate

| Metodo | Endpoint | Scopo |
|--------|----------|-------|
| GET | `/tables?metadata=1&count=1` | Lista schede dati con nome DB, `short_title` e conteggio record |
| GET | `/segreteria-campo/import/examples` | File di esempio disponibili, raggruppati per `short_title` |
| POST | `/tables/{name}/import` | Import di un file (body: `{ filepath }`) |

### GET /segreteria-campo/import/examples
Risposta:
```json
{
  "byTable": {
    "Organizzazioni": {
      "filename": "Organizzazioni_esempio.xlsx",
      "filepath": "/plugins/segreteria-campo/examples/it/Organizzazioni_esempio.xlsx"
    }
  }
}
```
- Scansiona `CAMILA_APP_PATH/plugins/segreteria-campo/examples/it/`
- Filtra `.xls`/`.xlsx`; chiave = parte del nome prima del primo `_`
- Il `filepath` è relativo a `CAMILA_APP_PATH` (usato direttamente in `POST .../import`)

### POST /tables/{name}/import
Body JSON: `{ "filepath": "/plugins/segreteria-campo/examples/it/file.xlsx" }`
Risposta: `{ "status": "ok", "imported": 42, "failed": 0, "total": 42 }`

## 5. i18n

Il file `import-wizard.inc.php` legge direttamente `__DIR__/lang/{lang}.lang.php` (senza passare da `camila_get_translation`). Fallback a `it.lang.php` se la lingua richiesta non esiste.

Chiavi definite:

| Chiave | IT | EN |
|--------|----|----|
| `camila.iw.title` | Importazione dati esempio | Sample data import |
| `camila.iw.loading` | Caricamento... | Loading... |
| `camila.iw.error` | Errore | Error |
| `camila.iw.error.load` | Impossibile caricare i dati | Failed to load data |
| `camila.iw.error.unknown` | Errore sconosciuto | Unknown error |
| `camila.iw.empty` | Nessun foglio worktable disponibile. | No worktable sheets available. |
| `camila.iw.col.sheet` | Scheda dati | Data sheet |
| `camila.iw.col.file` | File esempio | Example file |
| `camila.iw.col.status` | Stato | Status |
| `camila.iw.btn.import` | Importa | Import |
| `camila.iw.imported` | Importati: %s | Imported: %s |
| `camila.iw.records` | %s record | %s records |
| `camila.iw.warn.nonempty` | Le seguenti schede contengono già dei dati. L'import aggiungerà nuovi record: | The following sheets already contain data. The import will add new records: |
| `camila.iw.queued` | In coda | Queued |
| `camila.iw.failed` | non importati: %s | not imported: %s |
| `camila.iw.nodata` | nessuna riga letta su %s: controlla le intestazioni del file | no rows read out of %s: check the file headers |
| `camila.iw.warn.failed` | Alcune schede non sono state importate per intero. Controlla la scheda e, se serve, svuotala e importa di nuovo (ricarica la pagina). | Some sheets were not imported in full. Check the sheet and, if needed, empty it and import again (reload the page). |

Nel JS: `t(key, ...args)` — legge `window.I18N[key]`, sostituisce `%s` con gli argomenti posizionali.

## 6. Import in sequenza

`runImports()` svuota la selezione e importa **una scheda alla volta**, nell'ordine delle schede (`state.tables`), aspettando la fine di ciascuna (`await doImport(...)`). Le schede ancora da fare stanno in `state.queued` (un `Set`) e mostrano «In coda»; quella in corso sta in `state.importing` e mostra la barra. Il pulsante e le caselle restano disattivati finche' `importing` o `queued` non sono vuoti.

**Perche' non in parallelo.** Fino alla v. precedente le importazioni partivano insieme, senza `await`. L'API chiude subito la sessione e nginx ha piu' processi PHP, quindi le richieste giravano davvero insieme; con SQLite (installazione locale), che ammette un solo scrittore alla volta, gli inserimenti delle altre schede fallivano con «database is locked», a caso. L'importatore del framework li conta in `failed` e prosegue, e il wizard mostrava solo `imported`: una scheda che aveva perso righe sembrava una scheda con 0 record da importare. Provato su una copia del database: 4 schede da 400 righe in sequenza, tutte e 1600 importate; in parallelo da 23 a 86 righe perse per scheda (fino a 274 con 6 schede da 1000), con un risultato diverso a ogni prova.

**Il risultato mostra anche cio' che non e' entrato.** `state.results[nome]` tiene `{ ok, imported, failed, total }` (dalla risposta dell'API, `failed` e `total` valgono 0 se mancano). Il testo e' «Importati: N», seguito da «· non importati: M» se `failed > 0`; se `imported` e `failed` sono 0 ma `total > 0` (nessuna riga riconosciuta: di solito le intestazioni del file non combaciano con le colonne della scheda) dice «Importati: 0 · nessuna riga letta su N…». In entrambi i casi l'etichetta e' gialla (`is-warning`) e compare l'avviso `iw.warn.failed`. Una scheda gia' nei risultati non si puo' reimportare senza ricaricare la pagina.

**Limite noto.** La causa piu' a monte sta nel framework (`configurator::importXlsData`, una transazione per riga, nessuna attesa sul blocco): la sequenza nel wizard la evita ma non la corregge per chi importa da altri punti (per esempio due amministratori insieme).
