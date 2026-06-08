# Use Case: Smart Assistant

## Identificativo

UC-SA — Assistente di configurazione iniziale del campo

---

## Goal

Guidare l'operatore nella configurazione iniziale del campo, segnalando le condizioni minime non soddisfatte che bloccherebbero il funzionamento delle altre SPA.

---

## Primary Actor

Amministratore / Operatore di segreteria campo (primo accesso)

---

## Precondizioni

- L'operatore è autenticato.

---

## Postcondizioni — Successo

- L'operatore è informato sullo stato di configurazione e guidato verso l'azione correttiva.

---

## Main Success Scenario

### Home — Verifica configurazione

Il sistema esegue in parallelo tutti i controlli al mount e mostra i relativi avvisi.

#### Controllo 1 — Tabella `servizi`

1. Il sistema verifica se la tabella `servizi` contiene almeno un record (`list({ size: 1 })`).
2. **Caso A — Servizi presenti:** nessun avviso mostrato.
3. **Caso B — Servizi assenti:** il sistema mostra una card con:
   - Titolo: "Nessun servizio trovato"
   - Descrizione: suggerimento di importare i servizi di esempio
   - Pulsante che porta alla pagina di importazione (`./index.php?dashboard=iw`)

#### Controllo 2 — Attività brogliaccio

1. Il sistema legge l'ultimo record della tabella `brogliaccio` ordinando per `data/ora` discendente (`size: 1, order: [["data/ora", "desc"]]`).
2. Confronta il timestamp con l'ora corrente.
3. **Caso A — Ultima voce recente (< 2 ore):** nessun avviso mostrato.
4. **Caso B — Ultima voce vecchia (≥ 2 ore):** il sistema mostra un banner arancione con:
   - Icona campanello
   - Testo: "Nessuna voce nel brogliaccio nelle ultime 2 ore."
   - Sottotesto: data/ora dell'ultima registrazione (formato locale italiano)
   - Pulsante **Inserisci messaggio** integrato nel banner
5. **Caso C — Brogliaccio vuoto:** nessun alert mostrato. L'alert scatta solo se il brogliaccio è stato utilizzato almeno una volta.

La soglia è configurabile tramite la costante `BROGLIACCIO_ALERT_HOURS` (default: `2`).

#### Azione — Inserimento messaggio nel brogliaccio

1. L'operatore clicca **Inserisci messaggio** (da banner o da pulsante discreto).
2. Si apre una modale con un campo textarea libero.
3. L'operatore scrive il messaggio e clicca **Salva** (oppure usa Ctrl+Invio).
4. Il sistema crea un record nella tabella `brogliaccio` con:
   - `data/ora`: timestamp corrente (formato `YYYY-MM-DD HH:MM:SS`)
   - `descrizione`: testo inserito dall'operatore
5. Alla conferma del salvataggio:
   - Viene mostrato il messaggio "Messaggio salvato."
   - La modale si chiude automaticamente dopo 1 secondo
   - Lo stato dell'alert viene aggiornato (alert rimosso, `brogliaccioLastTs` = ora corrente)

---

## Extensions

### 1a. Errore di verifica

- Il sistema mostra un avviso discreto: "Errore nel controllo della tabella servizi".
- Non blocca l'utente: può comunque navigare manualmente.

### 2a. Messaggio vuoto

- Se l'operatore tenta di salvare un messaggio vuoto, viene mostrato un errore in linea nella modale: "Il messaggio non può essere vuoto."

### 2b. Errore di salvataggio nel brogliaccio

- Viene mostrato un messaggio di errore in linea nella modale. La modale rimane aperta per consentire un nuovo tentativo.

---

## Note

Questa SPA è un punto di partenza espandibile. I controlli attuali coprono la tabella `servizi` e l'attività del brogliaccio. Controlli futuri (es. presenza di organizzazioni, configurazione squadre) possono essere aggiunti come ulteriori card/banner nella stessa home, senza modificare il flusso esistente.
