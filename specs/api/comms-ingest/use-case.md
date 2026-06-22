# Use Case — comms-ingest

## Identificativo

UC-CI — Ingestione comunicazioni digitali da canali esterni

---

## Contesto di sistema

Il sistema riceve comunicazioni da canali esterni (Telegram, Radio) tramite API pubbliche dedicate e le registra nella tabella `com-digitali` per essere visualizzate dal `comms-feed` in sala operativa.

---

## Goal

Acquisire in modo affidabile messaggi provenienti da canali eterogenei, normalizzarli in un formato comune e renderli disponibili al feed di sala operativa in tempo reale.

---

## Primary Actor

Sistema esterno (bot Telegram, dispatcher radio Sparviere)

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Bot Telegram | Consegnare aggiornamenti Telegram al sistema senza perdite |
| Dispatcher radio (Sparviere) | Sincronizzare il log radio con il sistema di segreteria |
| Operatore sala operativa | Ricevere comunicazioni normalizzate e deduiplicate nel feed |

---

## Precondizioni

- La tabella `com-digitali` è presente e accessibile.
- Per Telegram: `var/segreteria-campo-telegram.json` contiene `bot_token` valorizzato.
- Per Radio: `var/segreteria-campo-radio.json` contiene `username` e `password` valorizzati.
- Il plugin `segreteria-campo` è attivo nell'applicazione.

---

## Postcondizioni

- Il messaggio è registrato in `com-digitali` con tutti i campi normalizzati.
- Non esistono duplicati per lo stesso `update_id` (Telegram) o stesso `id` + canale (Radio).
- L'utente Telegram riceve conferma di ricezione con l'ID del record.

---

## Canali supportati

| Canale | Endpoint | Auth | `canale-origine` |
|---|---|---|---|
| Telegram | `POST /segreteria-campo/telegram/webhook` | Secret token header | `Telegram` |
| Radio (Sparviere) | `PUT /segreteria-campo/radio/messages` | Basic Auth | `Radio` |

---

## Main Success Scenario — Telegram

### Step 1 — Ricezione update

1. Telegram invia un POST al webhook con un oggetto `Update`.
2. Il sistema verifica l'header `X-Telegram-Bot-Api-Secret-Token` (se `webhook_secret` configurato).
3. Estrae `message` o `edited_message` dall'update.

### Step 2 — Validazione

1. Se il body è vuoto o non contiene né `message` né `edited_message`: risponde `{ok: true}` senza registrare.
2. Se il messaggio contiene allegati (photo, document, voice, video, sticker, animation, video_note): invia risposta all'utente via `sendMessage` e risponde `{ok: true}` senza registrare.

### Step 3 — Deduplicazione

1. Il sistema cerca in `com-digitali` un record con `update-id` = `update_id` ricevuto.
2. Se trovato: risponde `{ok: true}` senza registrare (idempotente).

### Step 4 — Normalizzazione e inserimento

1. Mappa i campi Telegram → `com-digitali` (vedi § Mapping).
2. Sanifica i caratteri 4-byte (emoji) nei campi testo: sostituisce con `[emoji]` in `messaggio` e `payload`, rimuove in `chiamante` e `username`.
3. Inserisce il record tramite `CamilaWorkTable::insertRow`.

### Step 5 — Conferma

1. Recupera l'`id` del record appena inserito.
2. Invia `sendMessage` all'utente: `"Messaggio ricevuto e registrato (ID: {id}). Grazie."`

---

## Main Success Scenario — Radio (Sparviere)

### Step 1 — Autenticazione

1. Il dispatcher invia un PUT con Basic Auth.
2. Il sistema verifica le credenziali contro `var/segreteria-campo-radio.json`.
3. Se non autenticato: risponde 401 o 403.

### Step 2 — Validazione payload

1. Il body deve contenere `messagesPayload` come array non vuoto.
2. Se non valido: risponde 400.

### Step 3 — Upsert per ogni messaggio

Per ogni entry in `messagesPayload`:
1. Cerca in `com-digitali` un record con `num-messaggio` = `entry.id` **e** `canale-origine` = `'Radio'` (filtro canale per evitare conflitti con Telegram).
2. Se non trovato: inserisce con `update-type = 'message'`.
3. Se trovato: aggiorna `data/ora`, `chiamante`, `chiamato`, `messaggio`, `payload` e imposta `update-type = 'edited_message'`.

### Step 4 — Risposta

Restituisce contatori: `inserted_count`, `updated_count`, `error_count`.

---

## Extensions

### Telegram — Secret token non valido
- Risponde `{ok: true}` senza registrare (risposta neutra per non esporre informazioni).

### Telegram — `edited_message`
- Trattato come nuovo record con `update-type = 'edited_message'`.
- L'`update_id` è univoco anche per gli edit, quindi la deduplication funziona correttamente.

### Radio — Errore DB su singola entry
- L'entry viene contata in `error_count`, il ciclo continua sulle successive.

### Emoji e caratteri 4-byte
- Colonne DB in `utf8` (non `utf8mb4`): i caratteri 4-byte vengono sanificati prima dell'insert.
- `messaggio`, `payload`: sostituiti con `[emoji]`.
- `chiamante`, `username`: rimossi.
