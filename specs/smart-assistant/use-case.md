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

1. Il sistema verifica se la tabella `servizi` contiene almeno un record (`list({ size: 1 })`).
2. **Caso A — Servizi presenti:** il sistema non mostra avvisi. La vista è vuota (nessun problema rilevato).
3. **Caso B — Servizi assenti:** il sistema mostra una card con:
   - Titolo: "Nessun servizio trovato"
   - Descrizione: suggerimento di importare i servizi di esempio
   - Pulsante che porta alla pagina di importazione (`./index.php?dashboard=iw`)

---

## Extensions

### 1a. Errore di verifica tabella `servizi`

- Il sistema mostra un avviso discreto: "Errore nel controllo della tabella servizi".
- Non blocca l'utente: può comunque navigare manualmente.

---

## Note

Questa SPA è un punto di partenza espandibile. I controlli attuali coprono solo la tabella `servizi`. Controlli futuri (es. presenza di eventi, configurazione organizzazioni) possono essere aggiunti come card aggiuntive nella stessa home, senza modificare il flusso esistente.
