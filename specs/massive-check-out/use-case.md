# Use Case: Massive Check-out

## Identificativo

UC-MCO — Chiusura massiva della presenza di volontari, mezzi e materiali

---

## Contesto di sistema

Questa SPA è il terzo passo del flusso operativo del campo:

1. **Check-in massivo** → registrazione arrivo risorse
2. **Stato organizzazione** → monitoraggio situazione
3. **Check-out massivo** → registrazione uscita ← *questa SPA*

---

## Goal

Registrare la fine della presenza al campo di un gruppo di volontari, mezzi e materiali appartenenti alla stessa organizzazione, impostando `servizio = "USCITA DEFINITIVA"`, `data-fine-attestato` e `data/ora-uscita-definitiva`, e tracciando il movimento nella tabella `mov-risorse`.

---

## Primary Actor

Operatore di segreteria campo

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore segreteria | Chiudere rapidamente tutti i presenti di un'organizzazione |
| Sistema CAMILA | Mantenere coerenza degli attestati e dello storico movimenti |

---

## Precondizioni

- L'operatore è autenticato.
- Esistono record in stato "in servizio" (con `data-inizio-attestato` compilata e `data-fine-attestato` vuota) nelle tabelle `volontari`, `mezzi` e/o `materiali` per almeno un'organizzazione.

---

## Postcondizioni — Successo

Per ogni risorsa processata con successo:
- `servizio` = `"USCITA DEFINITIVA"`
- `data-fine-attestato` = data odierna (`YYYY-MM-DD`)
- `data/ora-uscita-definitiva` = data e ora corrente (`YYYY-MM-DD HH:mm:ss`)
- Un record di movimento viene inserito in `mov-risorse` con: `da` = servizio precedente, `a` = `"USCITA DEFINITIVA"`, `tipo-risorsa` = tipo entità.

## Postcondizioni — Errore

- I record non aggiornati mostrano il messaggio di errore API.
- La sessione rimane aperta per permettere interventi manuali.

---

## Classificazione stati

| Stato | Condizione nel record | Visibile in |
|---|---|---|
| **In servizio** | `data-inizio-attestato` compilata, `data-fine-attestato` vuota | Sezione selezionabile (check-out) |
| **Non in servizio** | `data-inizio-attestato` e `data-fine-attestato` entrambe compilate | Sezione di sola lettura |
| **Dati incompleti** | `data-inizio-attestato` vuota | Avviso, non mostrato nelle sezioni operative |

---

## Main Success Scenario

### Step 1 — Selezione organizzazione (modalità standard)

1. Il sistema carica le organizzazioni distinte dalle tabelle operative `volontari`, `mezzi`, `materiali` (chi è attualmente a campo), con merge e deduplicazione per chiave composta.
2. L'operatore filtra e seleziona l'organizzazione.
3. Il sistema memorizza `state.org` e avanza allo Step 2.

### Step 1 — Inserimento codice totem (modalità totem, `?totem=1`)

1. L'operatore apre la dashboard con il parametro `?totem=1`.
2. Il sistema mostra un campo di inserimento codice numerico e un pulsante "Scansiona QR code" (sempre visibile; usa jsQR, compatibile con tutti i browser).
3. **Inserimento manuale**: l'operatore digita il codice e clicca "Conferma" (o preme Invio).
4. **Scansione QR**: il sistema carica jsQR, attiva la fotocamera e rileva automaticamente il codice.
5. Il sistema chiama `GET /segreteria-campo/totem/organization-codes` e cerca l'entry con il codice.
6. Se trovata: chiama `select()` che imposta `state.org` e avanza allo Step 2.
7. Se non trovata: mostra "Codice non riconosciuto. Verifica e riprova."

### Step 2 — Check-out volontari

1. Il sistema carica tutti i volontari dell'organizzazione dalla tabella `volontari` (filtro per `organizzazione`, `codice-organizzazione`, `provincia`).
2. Li suddivide in due sezioni:
   - **In servizio** (selezionabili per check-out)
   - **Non in servizio** (sola lettura, già usciti)
3. Per i volontari in servizio, l'operatore può modificare prima del check-out: mansione, responsabile, autista, cellulare, benefici di legge, num. giorni benefici. Il campo servizio è in sola lettura (sarà sovrascritto con "USCITA DEFINITIVA").
4. L'operatore seleziona i volontari da portare in uscita e clicca **Check-out volontari selezionati**.
5. Il sistema aggiorna ciascun record con `update(id, payload)` e scrive il movimento in `mov-risorse`.
6. Dopo il check-out i record passano nella sezione "Non in servizio".
7. L'operatore può avanzare allo Step 3 (mezzi).

### Step 3 — Check-out mezzi (fine sessione opzionale)

1. Il sistema carica tutti i mezzi dell'organizzazione dalla tabella `mezzi`.
2. Stessa suddivisione in/non in servizio.
3. Per i mezzi in servizio, l'operatore può modificare prima del check-out: km inizio missione, km all'arrivo, km alla partenza.
4. L'operatore seleziona e clicca **Check-out mezzi selezionati**.
5. Payload aggiornato: `servizio = "USCITA DEFINITIVA"`, data fine, data/ora, km.
6. L'operatore può avanzare allo Step 4 (materiali) oppure cliccare **Fine** per concludere la sessione senza fare il check-out dei materiali.

### Step 4 — Check-out materiali (fine sessione)

1. Il sistema carica tutti i materiali dell'organizzazione dalla tabella `materiali`.
2. Stessa struttura in/non in servizio; nessun campo aggiuntivo modificabile prima del check-out.
3. Payload: `servizio = "USCITA DEFINITIVA"`, data fine, data/ora.
4. Quando non è in corso un check-out, compare il pulsante **Fine**: azzera lo state e torna allo Step 1 per una nuova sessione.

---

## Extensions

### 1b. Codice totem non riconosciuto

- Il sistema mostra "Codice non riconosciuto. Verifica e riprova." sopra l'input.
- Il campo rimane modificabile per un nuovo tentativo.

### 1c. Errore API endpoint totem

- Il sistema mostra il messaggio user-friendly corrispondente al `kind` dell'errore.

### 1d. Fotocamera non disponibile (scansione QR)

- Il sistema mostra l'errore nell'overlay scanner con il pulsante "Annulla".
- L'operatore può chiudere e procedere con inserimento manuale.

### 1e. jsQR non caricabile

- `openScanner()` mostra "Impossibile caricare il decoder QR." nell'overlay.
- L'operatore può chiudere e procedere con inserimento manuale.

### 1a. Nessuna organizzazione con presenti attivi

- Il sistema mostra stato vuoto.

### 2a/3a/4a. Nessun record in servizio per la categoria

- La sezione "In servizio" mostra "Nessun volontario/mezzo/materiale". L'operatore può avanzare.

### 2b. Record con dati incompleti (data-inizio-attestato vuota)

- Il sistema mostra un avviso warning con il conteggio dei record esclusi dalle liste operative.
- Questi record non sono selezionabili e non vengono processati.

### 2c/3c/4c. Errore di aggiornamento o di scrittura mov-risorse

- Il sistema mostra il messaggio di errore API.
- Gli altri record della stessa sessione non vengono interrotti.
- Il record rimane in stato "in servizio" e può essere ritentato.

### *a. Navigazione indietro senza organizzazione in state

- Il sistema redirige allo Step 1.

### *b. Pulsante "Passa a step successivo" senza check-out

- Consentito: l'operatore può saltare una categoria (es. nessun mezzo da portare in uscita).
