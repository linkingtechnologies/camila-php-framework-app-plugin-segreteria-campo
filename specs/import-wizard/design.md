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

Nel JS: `t(key, ...args)` — legge `window.I18N[key]`, sostituisce `%s` con gli argomenti posizionali.

## 6. Comportamento import parallelo

`runImports()` svuota la selezione e chiama `doImport(name, filepath)` per ogni riga selezionata senza `await`. Ogni chiamata è indipendente e aggiorna `state.importing` (un `Set`) e `state.results` in autonomia. Il re-render avviene per ogni transizione di stato.
