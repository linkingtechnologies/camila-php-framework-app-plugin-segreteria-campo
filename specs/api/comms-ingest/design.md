# Design — comms-ingest

## Architettura

Gli endpoint sono **plugin handler** PHP registrati in `plugins/segreteria-campo/api/handlers.inc.php` e caricati da `CamilaPluginController` dentro il router di php-crud-api (mevdschee/php-crud-api v2). Il prefisso `/segreteria-campo` viene preposto automaticamente dal plugin loader configurato in `camila/api/cf_api_controller.inc.php`.

### Tipi di autenticazione

| Tipo | Meccanismo |
|---|---|
| **Pubblica** | Bypassa il middleware chain di php-crud-api (`dbAuth`, `apiKeyDbAuth`, `authorization`) tramite `$publicHandlers` in `Api::handle()`. L'autenticazione, se richiesta, è gestita internamente dall'handler (es. Basic Auth, secret token). |
| **Privata** | Passa per il middleware chain standard. Richiede sessione Camila attiva o API key nell'header `X-API-Key`. |

### Convenzione nomi campi

I nomi dei campi nel worktable Camila usano spazi e maiuscole (`'Num. Messaggio'`, `'Canale origine'`). Nell'API php-crud-api gli stessi campi appaiono in kebab-case (`num-messaggio`, `canale-origine`). Nei mapping di questo documento si usa la forma kebab-case (API), con il nome Camila tra parentesi dove utile.

---

## Endpoint

Base path: `/app/segreteriacampo/cf_api.php/segreteria-campo`

---

### POST /segreteria-campo/telegram/webhook

**Auth:** pubblica — verificata via `X-Telegram-Bot-Api-Secret-Token` (opzionale, configurabile)
**Config:** `var/segreteria-campo-telegram.json`

```json
{
  "bot_token": "<token>",
  "bot_name": "<nome visualizzato come Chiamato>",
  "webhook_secret": "<secret impostato su setWebhook>"
}
```

**Payload atteso (Telegram Update):**
```json
{
  "update_id": 910000001,
  "message": {
    "message_id": 401,
    "date": 1781983905,
    "from": { "id": 123, "first_name": "Mario", "last_name": "Rossi", "username": "mario_rossi" },
    "chat": { "id": 123 },
    "text": "testo del messaggio"
  }
}
```

**Risposta:** sempre `{"ok": true}` (Telegram richiede HTTP 200 in ogni caso)

**Comandi speciali:**
| Comando | Comportamento |
|---|---|
| `/start` | Risponde "Benvenuto, [nome]!" all'utente. Non registra il messaggio nel worktable. |

**Tipi `update-type`:**
| Caso | Valore |
|---|---|
| Nuovo messaggio | `message` |
| Messaggio modificato | `edited_message` |

**Tipi `tipo-contenuto`:**
| Caso | Valore |
|---|---|
| Testo | `Testo` |
| Posizione GPS | `Posizione` |
| Allegati (rifiutati) | — (non registrati) |

---

### GET /segreteria-campo/radio/health

**Auth:** pubblica — Basic Auth via `var/segreteria-campo-radio.json`

**Risposta (200):**
```json
{
  "status": "ok",
  "db": "connected",
  "worktable": "Com. Digitali",
  "time": "2026-06-21T18:00:00+02:00"
}
```

**Risposta (401/403):**
```json
{ "status": "error", "message": "Authentication required" }
```

---

### PUT /segreteria-campo/radio/messages

**Auth:** pubblica — Basic Auth via `var/segreteria-campo-radio.json`
**Config:** `var/segreteria-campo-radio.json`

```json
{
  "username": "<utente>",
  "password": "<password>"
}
```

**Payload:**
```json
{
  "messagesPayload": [
    {
      "id": "MSG-001",
      "timestamp": 1726087976,
      "from": "Squadra A",
      "to": "Centrale",
      "text": "Siamo arrivati in posizione"
    }
  ]
}
```

**Risposta (200):**
```json
{
  "status": "success",
  "message": "Data processed successfully",
  "inserted_count": 1,
  "updated_count": 0,
  "error_count": 0
}
```

**Chiave upsert:** `num-messaggio` + `canale-origine = 'Radio'`
(il filtro su canale evita conflitti con messaggi Telegram con lo stesso `num-messaggio`)

**Tipi `update-type`:**
| Caso | Valore |
|---|---|
| Primo inserimento | `message` |
| Aggiornamento esistente | `edited_message` |

---

## Mapping Telegram → com-digitali

| Campo com-digitali | Sorgente Telegram |
|---|---|
| `data/ora` | `message.date` (unix → datetime) |
| `num-messaggio` | `message.message_id` |
| `chiamante` | `from.first_name + last_name` (emoji rimossi) |
| `chiamato` | `bot_name` da config |
| `messaggio` | `message.text` (emoji → `[emoji]`) |
| `canale-origine` | `'Telegram'` |
| `tipo-contenuto` | `'Testo'` / `'Posizione'` |
| `latitudine` | `message.location.latitude` (null se assente) |
| `longitudine` | `message.location.longitude` (null se assente) |
| `update-id` | `update_id` (chiave deduplication) |
| `message-id` | `message.message_id` |
| `chat-id` | `chat.id` |
| `user-id` | `from.id` |
| `username` | `from.username` o `from.first_name` (emoji rimossi) |
| `update-type` | `'message'` / `'edited_message'` |
| `received-date` | timestamp server al momento della ricezione |
| `payload` | JSON completo dell'Update (emoji → `[emoji]`) |

> I campi `priorita`, `necessaria-risposta`, `nota`, `stato-elaborazione`, `servizio` non sono mappati da Telegram e vengono lasciati vuoti — da valorizzare manualmente dall'operatore se necessario.

## Mapping Radio → com-digitali

| Campo com-digitali | Sorgente Radio |
|---|---|
| `data/ora` | `entry.timestamp` (unix → datetime) |
| `num-messaggio` | `entry.id` |
| `chiamante` | `entry.from` |
| `chiamato` | `entry.to` |
| `messaggio` | `entry.text` |
| `servizio` | `'Sala Radio'` |
| `canale-origine` | `'Radio'` |
| `tipo-contenuto` | `'Testo'` |
| `message-id` | `entry.id` |
| `update-type` | `'message'` / `'edited_message'` |
| `received-date` | timestamp server al momento della ricezione |
| `payload` | JSON dell'entry |

---

## File

| File | Ruolo |
|---|---|
| `plugins/segreteria-campo/api/handlers.inc.php` | Implementazione handler |
| `var/segreteria-campo-telegram.json` | Config bot Telegram (bot_token, bot_name, webhook_secret) |
| `var/segreteria-campo-radio.json` | Credenziali Basic Auth canale radio |
| `var/log/telegram-webhook.log` | Log operativo webhook Telegram |
| `var/log/radio-messages.log` | Log operativo endpoint radio |
