# Design — totem

## Architettura

Endpoint **plugin handler** PHP registrato in `plugins/segreteria-campo/api/handlers.inc.php` e caricato da `CamilaPluginController` dentro il router di php-crud-api. Il prefisso `/segreteria-campo` viene preposto automaticamente dal plugin loader.

L'endpoint è **privato**: passa per il middleware chain standard di php-crud-api (`dbAuth`, `apiKeyDbAuth`, `authorization`). Richiede sessione Camila attiva o API key nell'header `X-API-Key`.

I dati vengono letti dal worktable Camila `VOLONTARI PREACCREDITATI` tramite `CamilaWorkTable::startExecuteQuery` con sintassi `${...}` per la risoluzione dei nomi fisici di tabella e colonna.

---

## Endpoint

### GET /segreteria-campo/totem/organization-codes

**Auth:** privata (richiede sessione Camila o API key)
**Sorgente dati:** worktable `VOLONTARI PREACCREDITATI`, colonne `ORGANIZZAZIONE`, `PROVINCIA`, `COD. ORGANIZZAZIONE`

**Risposta (200):**
```json
{
  "data": [
    { "organizzazione": "Croce Rossa Milano", "provincia": "MI", "codice-organizzazione": "CRI-MI-001", "code": 1482937 },
    { "organizzazione": "Protezione Civile Cremona", "provincia": "CR", "codice-organizzazione": "PC-CR-042", "code": 8834521 }
  ]
}
```

**Proprietà del codice `code`:**
- Deterministico: stessa organizzazione → stesso codice ad ogni chiamata
- Calcolato da nome uppercase, lunghezza e posizione di caratteri campione
- Non sequenziale: non rivela quante organizzazioni esistono
- Range: intero positivo modulo 2147483629
- Adatto a verifica offline: il totem può confrontare localmente senza ulteriori chiamate

**Formula (SQL):**
```sql
(
    LENGTH(u) * 7919
  + INSTR(r, SUBSTR(u, 1, 1))  * 101
  + INSTR(r, SUBSTR(u, 3, 1))  * 211
  + INSTR(r, SUBSTR(u, 6, 1))  * 307
  + INSTR(r, SUBSTR(u, 10, 1)) * 401
  + INSTR(r, SUBSTR(u, 15, 1)) * 503
  + INSTR(r, SUBSTR(u, LENGTH(u), 1)) * 601
  + 888
) % 2147483629
```
dove `u = UPPER(TRIM(organizzazione))` e `r = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.-&/'`

---

## File

| File | Ruolo |
|---|---|
| `plugins/segreteria-campo/api/handlers.inc.php` | Implementazione handler `GET /totem/organization-codes` |
