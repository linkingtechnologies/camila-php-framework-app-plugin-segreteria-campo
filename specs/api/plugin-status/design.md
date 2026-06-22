# Design — plugin-status

## Architettura

Endpoint **plugin handler** PHP registrato in `plugins/segreteria-campo/api/handlers.inc.php`. Privato: passa per il middleware chain standard di php-crud-api.

---

## Endpoint

### GET /segreteria-campo/status

**Auth:** privata (richiede sessione Camila o API key)

**Risposta (200):**
```json
{ "status": "ok" }
```

Liveness check minimale del plugin. Utile per verificare che il plugin sia attivo e il routing funzioni correttamente, senza dipendenze da DB o worktable.

---

## File

| File | Ruolo |
|---|---|
| `plugins/segreteria-campo/api/handlers.inc.php` | Implementazione handler `GET /status` |
