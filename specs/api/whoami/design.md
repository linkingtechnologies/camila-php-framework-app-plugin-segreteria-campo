# Design — whoami

## Architettura

L'endpoint e' **del framework**, non del plugin: sta in `camila/api/cf_handlers.inc.php`, accanto a `/users` e `/status/app`, e questo plugin lo usa soltanto (le specifiche stanno qui perche' e' la SPA a dipenderne). E' privato: passa per la catena di middleware di php-crud-api, che identifica l'utente dalla sessione, e non legge il database: espone variabili che il middleware ha gia' valorizzato nella richiesta. `isAdmin` viene da `CamilaAuth::isAdmin()`.

Il plugin non ne ha una copia: su un framework che non ha l'endpoint la richiesta da' 404 e la SPA lavora senza predefiniti di gruppo, come prima. Il plugin richiede quindi un framework che abbia `GET /whoami` solo per questa funzione, non per il resto.

## Endpoint

### GET /whoami

**Auth:** privata.

**Risposta (200):**
```json
{ "user": "mario", "group": "A1", "isAdmin": false, "level": 10, "visibilityType": "group" }
```

| Campo | Da dove | Note |
|---|---|---|
| `user` | `$_CAMILA['user']` | nome utente |
| `group` | `$_CAMILA['user_group']` | `users.grp`, **grezzo**: vuoto per un amministratore |
| `isAdmin` | `$_CAMILA['adm_user_group'] == CAMILA_ADM_USER_GROUP` (`CamilaAuth::isAdmin()`) | l'utente con gruppo vuoto vale amministratore (`adm_user_group` ricade su `CAMILA_ADM_USER_GROUP`); se la variabile non c'e', `false` |
| `level` | `$_CAMILA['user_level']` | intero, o `null` |
| `visibilityType` | `$_CAMILA['user_visibility_type']` | `public`, `group` o `personal` |

Le variabili sono quelle che il framework usa per le sue regole di gruppo: `camila/api.include.php`
(`apiKeyDbAuth`, righe `$_CAMILA['user_group'] = …`) le imposta dall'utente trovato per la sessione, e
`datagrid/configurator.class.php` e `_list()` le leggono per il valore predefinito del campo di gruppo e per
il filtro di visibilita'.

## Perche' un endpoint e non `APP_CONFIG`

`mountMiniApp()` (framework) potrebbe aggiungere il gruppo ad `APP_CONFIG` senza nessuna chiamata, ma
fisserebbe il valore al caricamento della pagina e non sarebbe disponibile alle pagine che non montano una mini-app.
L'endpoint costa una chiamata per apertura di pagina, ricordata dalla SPA.

## Cosa non fa

Non applica ne' impone nulla: e' un'informazione. Le regole di visibilita' vere sono del framework:
una colonna della worktable con l'opzione **VG** (*group visibility field*, `camila.worktable.field.groupvisibilityfield`)
riceve il gruppo dell'utente come valore predefinito ed e' non modificabile per i non amministratori, e per gli utenti con
`visibility_type = group` la REST API filtra le liste su quella colonna (`_list()` in `api.include.php`).
Sono impostazioni della scheda e dell'utente in Camila, non del plugin.
