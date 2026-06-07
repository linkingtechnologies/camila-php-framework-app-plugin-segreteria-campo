# Use Case: Org Status

## Identificativo

UC-OS — Visualizzazione stato presenti di un'organizzazione

---

## Contesto di sistema

Questa SPA è il secondo passo del flusso operativo del campo:

1. **Check-in massivo** → registrazione arrivo risorse
2. **Stato organizzazione** → monitoraggio situazione ← *questa SPA*
3. **Check-out massivo** → registrazione uscita

È lo strumento principale per il coordinamento operativo durante l'evento, i cambi turno e le verifiche amministrative.

---

## Goal

Visualizzare in tempo reale lo stato operativo di una specifica organizzazione: quante e quali risorse sono attualmente in servizio, e quante hanno già concluso la loro presenza.

---

## Primary Actor

Operatore di segreteria campo / Responsabile organizzazione / Coordinatore operativo

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore segreteria | Verifica rapida della situazione presenti |
| Responsabile organizzazione | Controllo che i propri volontari/mezzi/materiali risultino registrati |
| Coordinatore operativo | Monitoraggio situazione per decisioni operative (cambi turno, assegnazione servizi) |

---

## Precondizioni

- L'operatore è autenticato.
- Esistono dati nelle tabelle `volontari`, `mezzi` o `materiali`.

---

## Postcondizioni

- L'operatore visualizza l'elenco aggiornato delle risorse per l'organizzazione selezionata, suddivise per stato.

---

## Classificazione stati

| Stato | Condizione | Tag UI |
|---|---|---|
| **In servizio** | `data-inizio-attestato` compilata, `data-fine-attestato` vuota | verde |
| **Non in servizio** | Entrambe le date compilate | grigio |
| **Dati incompleti** | `data-inizio-attestato` vuota | non mostrato esplicitamente |

---

## Main Success Scenario

### Step 1 — Selezione organizzazione

1. Il sistema carica le organizzazioni distinte dalle tabelle `volontari-preaccreditati` e `db-volontari`, con merge, deduplicazione e ordinamento alfabetico (identico al check-in step 1).
2. L'operatore filtra per nome, codice o provincia.
3. L'operatore seleziona l'organizzazione.
4. Il sistema memorizza `state.org` e avanza allo Step 2.

### Step 2 — Dashboard presenti

1. Il sistema carica in parallelo (`Promise.all`) i dati per l'organizzazione da tre tabelle:
   - `volontari` → volontari in servizio e non in servizio
   - `mezzi` → mezzi in servizio e non in servizio
   - `materiali` → materiali in servizio e non in servizio
2. Filtraggio: filtro per `organizzazione`, `codice-organizzazione`, `provincia`.
3. Il sistema mostra nella parte alta tre **KPI card** con i contatori: per ciascuna categoria, numero in servizio e numero non in servizio.
4. Sotto le KPI card, sei tabelle dettagliate (in servizio + non in servizio per ogni categoria), ognuna con campo di ricerca.
5. L'operatore può cercare all'interno di ciascuna tabella.
6. L'operatore può ricaricare i dati con il pulsante **Ricarica** senza tornare allo Step 1.
7. L'operatore può cambiare organizzazione con **Cambia organizzazione** che torna allo Step 1.

---

## Extensions

### 1a. Errore caricamento organizzazioni

- Stesso comportamento del check-in: parziale con avviso se solo una tabella fallisce, pulsante Riprova.

### 2a. Nessuna risorsa per una categoria

- La KPI card mostra 0 / 0. La tabella mostra "Nessun risultato".

### 2b. Errore di caricamento

- L'intera dashboard mostra il messaggio di errore (il `Promise.all` fallisce al primo errore).
- L'operatore può ricaricare.

### 2c. Aggiornamento manuale

- L'operatore clicca **Ricarica**: il sistema esegue nuovamente il caricamento parallelo senza navigare allo Step 1.
