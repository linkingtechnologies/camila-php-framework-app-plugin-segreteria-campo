# Use Case: Massive Check-in

## Identificativo

UC-MCI — Registrazione massiva di volontari, mezzi e materiali al campo

---

## Goal

Registrare in un'unica sessione guidata l'arrivo al campo di un gruppo di volontari, dei loro mezzi e dei materiali portati, tutti appartenenti alla stessa organizzazione.

---

## Primary Actor

Operatore di segreteria campo

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore segreteria | Completare il check-in rapidamente, con minimo errori di digitazione |
| Responsabile organizzazione | Avere tutti i propri volontari/mezzi/materiali registrati correttamente |
| Sistema CAMILA | Mantenere la coerenza dei dati nelle tabelle operative |

---

## Precondizioni

- L'operatore è autenticato nel sistema CAMILA WorkTable.
- Esiste almeno un'organizzazione con volontari nelle tabelle `volontari-preaccreditati` o `db-volontari`.
- La tabella `servizi` esiste (può essere vuota: il default `IN ATTESA DI SERVIZIO` è sempre disponibile).

---

## Postcondizioni — Successo

- I volontari selezionati non ancora presenti oggi nella tabella `volontari` sono stati inseriti con `data-inizio-attestato = oggi`.
- I mezzi selezionati non ancora presenti oggi nella tabella `mezzi` sono stati inseriti con `data-inizio-attestato = oggi`.
- I materiali selezionati non ancora presenti oggi nella tabella `materiali` sono stati inseriti con `data-inizio-attestato = oggi`.
- I record già presenti oggi vengono saltati senza errore.

## Postcondizioni — Fallimento parziale

- I record con errore di inserimento rimangono in stato `failed` con messaggio diagnostico visibile.
- I record già inseriti non vengono ripetuti.
- L'operatore può ritentare i soli record falliti senza ricominciare da capo.

---

## Main Success Scenario

### Step 1 — Selezione organizzazione (modalità standard)

1. L'operatore apre la dashboard del Massive Check-in (senza `?totem=1`).
2. Il sistema carica in parallelo le organizzazioni distinte dalle tabelle `volontari-preaccreditati` e `db-volontari`, le unisce per chiave composta (organizzazione + codice + provincia) e le ordina alfabeticamente.
3. L'operatore filtra per nome, codice o provincia tramite campo di ricerca.
4. L'operatore seleziona l'organizzazione desiderata.
5. Il sistema memorizza `{ name, code, province }` in `state.org` e avanza allo Step 2.

### Step 1 — Inserimento codice totem (modalità totem, `?totem=1`)

1. L'operatore apre la dashboard con il parametro `?totem=1`.
2. Il sistema mostra un campo di inserimento codice numerico e un pulsante "Scansiona QR code" (sempre visibile; usa jsQR, compatibile con tutti i browser).
3. **Inserimento manuale**: l'operatore digita il codice e clicca "Conferma" (o preme Invio).
4. **Scansione QR**: l'operatore clicca "Scansiona QR code" → il sistema carica jsQR, attiva la fotocamera e avvia il rilevamento automatico (~10fps via canvas); al riconoscimento del QR procede come al punto seguente.
5. Il sistema chiama `GET /segreteria-campo/totem/organization-codes` e cerca l'entry con il codice inserito.
6. Se trovata: memorizza `{ name, code, province: "" }` in `state.org` e avanza allo Step 2.
7. Se non trovata: mostra "Codice non riconosciuto. Verifica e riprova."

### Step 2 — Selezione volontari

1. Il sistema carica in parallelo i volontari dell'organizzazione selezionata dalle tabelle `volontari-preaccreditati` (sezione "Preaccreditati") e `db-volontari` (sezione "Database Volontari").
2. I record vengono uniti per codice fiscale: chi appare in entrambe le tabelle viene mostrato una sola volta nella sezione Preaccreditati, con i turni aggregati.
3. L'operatore può:
   - filtrare per turno (solo nella sezione Preaccreditati)
   - cercare per CF, cognome, nome, turno in entrambe le sezioni
   - selezionare/deselezionare singoli volontari o tutti i visibili (sezione Preaccreditati)
   - aggiungere un nuovo volontario tramite modale (inserisce in `volontari-preaccreditati`)
4. L'operatore clicca **Check-in volontari selezionati** e avanza allo Step 3.
5. In alternativa, l'operatore può saltare direttamente allo Step 4 (mezzi) o Step 6 (materiali).

### Step 3 — Configurazione e inserimento volontari

1. Il sistema verifica quali codici fiscali selezionati sono già presenti oggi nella tabella `volontari` (confronto `data-inizio-attestato` con oggi; considera attivi anche i record iniziati in giorni precedenti senza `data-fine-attestato`).
2. I volontari già presenti mostrano stato `Già presente` e sono in sola lettura.
3. Per i volontari da inserire, l'operatore può modificare per ciascuno: mansione, servizio, responsabile (SI/NO), autista (SI/NO), cellulare, benefici di legge (SI/NO), numero giorni benefici.
4. Il campo servizio è popolato dalla tabella `servizi`; se il caricamento fallisce, viene usato solo il default `IN ATTESA DI SERVIZIO`.
5. L'operatore clicca **Inserisci volontari**: il sistema inserisce uno per uno i record pendenti nella tabella `volontari`, aggiornando lo stato di ogni riga in tempo reale.
6. I record falliti possono essere ritentati con **Riprova solo quelli in errore**.
7. Quando tutti i record sono in stato `inserted` o `exists`, il pulsante **Check-in mezzi** diventa abilitato.
8. L'operatore avanza allo Step 4.

### Step 4 — Selezione mezzi

1. Il sistema carica i mezzi dell'organizzazione dalle tabelle `mezzi-preaccreditati` e `db-mezzi`, uniti per targa con turni aggregati.
2. La sezione "Database mezzi" può opzionalmente caricare tutti i mezzi presenti (non filtrati per organizzazione) tramite checkbox.
3. L'operatore seleziona i mezzi, con funzionalità analoghe allo Step 2 (filtro turno, ricerca, selezione visibili, aggiunta modale).
4. Il modale di aggiunta mezzo valida categoria/tipologia con coerenza bidirezionale (selezionare tipologia imposta categoria; cambiare categoria resetta tipologia incompatibile).
5. L'operatore clicca **Check-in mezzi selezionati** e avanza allo Step 5.
6. In alternativa può saltare direttamente allo Step 6 (materiali).

### Step 5 — Configurazione e inserimento mezzi

1. Flusso analogo allo Step 3 ma per la tabella `mezzi`.
2. Campi aggiuntivi per mezzo: servizio, km inizio missione, km all'arrivo, km alla partenza, nome referente, telefono referente, provenienza, turno.
3. L'operatore avanza allo Step 6 quando tutti i mezzi sono inseriti o già presenti.

### Step 6 — Selezione materiali

1. Il sistema carica i materiali dell'organizzazione dalle tabelle `materiali-preaccreditati` e `db-materiali`, uniti per `id-materiale`.
2. Funzionamento analogo agli Step 2/4.
3. Il modale di aggiunta materiale precompila l'ID con `MAT` + sequence dalla tabella, se disponibile.
4. L'operatore clicca **Check-in materiali selezionati** e avanza allo Step 7.

### Step 6 — Selezione materiali (fine sessione)

Il pulsante **Fine** è sempre visibile nella toolbar di step 6, indipendentemente dalla selezione. Permette di concludere la sessione senza inserire materiali: azzera lo state e torna allo Step 1.

### Step 7 — Configurazione e inserimento materiali

1. Flusso analogo agli Step 3/5 ma per la tabella `materiali`.
2. Campi aggiuntivi: servizio, turno per ogni materiale.
3. Quando non c'è un inserimento in corso, compare il pulsante **Fine**: azzera lo state e torna allo Step 1 per una nuova sessione.

---

## Extensions (flussi alternativi / errori)

### 1a. Nessuna organizzazione disponibile (modalità standard)

- Il sistema mostra lo stato vuoto: "Nessun risultato".
- Il pulsante di avanzamento rimane disabilitato.

### 1b. Codice totem non riconosciuto

- Il sistema mostra "Codice non riconosciuto. Verifica e riprova." sopra l'input.
- Il campo rimane modificabile per un nuovo tentativo.

### 1c. Errore API endpoint totem

- Il sistema mostra il messaggio user-friendly corrispondente al `kind` dell'errore (stesso `normalizeApiError` della modalità standard).

### 1d. Fotocamera non disponibile (scansione QR)

- Il sistema mostra "Fotocamera non disponibile: \<messaggio\>" nell'overlay scanner.
- L'overlay rimane aperto con il pulsante "Annulla".
- L'operatore può chiudere e procedere con inserimento manuale.

### 1e. jsQR non caricabile

- Se il file `/camila/js/jsQR/jsQR.js` non è raggiungibile, `openScanner()` cattura l'errore e mostra "Impossibile caricare il decoder QR." nell'overlay scanner.
- L'overlay rimane aperto con il pulsante "Annulla".
- L'operatore può chiudere e procedere con inserimento manuale.

### 2a. Errore di caricamento organizzazioni

- Il sistema mostra il messaggio user-friendly corrispondente al `kind` dell'errore.
- Compare il pulsante **Riprova**.
- Se solo una delle due tabelle fallisce (`Promise.allSettled`), le organizzazioni dell'altra vengono comunque mostrate e l'errore è indicato.

### 2b. Aggiunta volontario — CF non valido

- Il sistema blocca il salvataggio mostrando: "Codice fiscale deve essere lungo 16 caratteri".

### 2c. Aggiunta volontario — cognome o nome mancante

- Il sistema blocca il salvataggio con il messaggio di campo obbligatorio.

### 3a. Verifica esistenza volontario fallisce per errore API

- Il record viene impostato a `pending` con messaggio "Impossibile verificare (proverò a inserire)".
- Il sistema tenterà comunque l'inserimento.

### 3b. Inserimento volontario fallisce

- Il record passa a stato `failed` con il messaggio di errore API.
- Il totale degli errori è visibile nel contatore e nel pulsante **Riprova**.

### 3c. Tentativo di avanzare ai mezzi con record pendenti

- Il sistema mostra un messaggio di blocco: indica quanti volontari devono ancora essere inseriti.
- Il pulsante **Check-in mezzi** rimane disabilitato.

### 4a. Aggiunta mezzo — targa duplicata

- Il sistema blocca il salvataggio: "Mezzo già presente (stessa targa)".

### 4b. Aggiunta mezzo — tipologia non coerente con categoria

- Il sistema blocca il salvataggio: "Tipologia non coerente con la categoria selezionata".

### 5a/7a. Servizi non caricabili

- Il sistema mostra un avviso warning (non bloccante).
- La select del servizio mostra solo il valore default `IN ATTESA DI SERVIZIO`.

### 6a. Aggiunta materiale — ID duplicato

- Il sistema blocca il salvataggio: "Materiale già presente (stesso id-materiale)".

### 6b. Sequence API non disponibile

- L'ID non viene precompilato; l'operatore lo inserisce manualmente.
- La modale rimane aperta e funzionante.

### *a. Navigazione indietro con organizzazione non impostata

- Il sistema rileva l'assenza di `state.org.name` e redirige allo Step 1.
