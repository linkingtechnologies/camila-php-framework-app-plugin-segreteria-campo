# Use Case — pre-accreditations-summary

## Identificativo

UC-PAS — Riepilogo preaccreditamenti per turno, servizio e organizzazione

---

## Contesto di sistema

Strumento di consultazione che permette di vedere in un colpo d'occhio quante e quali risorse (volontari, mezzi, materiali) sono preaccreditate, con possibilità di filtrare per turno e servizio e di raggruppare per organizzazione.

È uno strumento di sola lettura: non modifica i dati preaccreditati.

---

## Goal

Ottenere rapidamente un quadro numerico e nominativo delle risorse preaccreditate, applicando filtri multipli su turno e servizio.

---

## Primary Actor

Coordinatore operativo / Operatore di segreteria campo

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Coordinatore operativo | Verificare quante risorse sono attese per un turno o servizio specifico |
| Operatore segreteria | Confrontare il preaccreditato con il check-in già eseguito |
| Responsabile logistico | Valutare la distribuzione delle risorse tra le organizzazioni |

---

## Precondizioni

- L'operatore è autenticato.
- Esistono dati in almeno una delle tabelle `volontari-preaccreditati`, `mezzi-preaccreditati`, `materiali-preaccreditati`.

---

## Postcondizioni

- L'operatore visualizza i contatori e/o gli elenchi delle risorse preaccreditate in base ai filtri attivi.

---

## Main Success Scenario

### Step 1 — Caricamento dati

1. La SPA si avvia e carica in parallelo (`Promise.all`) le tre tabelle preaccreditati.
2. Al termine del caricamento, il sistema calcola i valori distinti di `turno` e `servizio` presenti nei dati e li mostra come chip selezionabili.
3. I KPI iniziali mostrano il totale complessivo (tutti i turni, tutti i servizi). Per volontari, mezzi e materiali viene calcolato anche il contatore di risorse uniche (deduplicate per codice fiscale / targa / id-materiale).

### Step 2 — Filtro per turno e/o servizio

1. L'operatore clicca uno o più chip di turno e/o servizio.
2. Il sistema aggiorna istantaneamente (client-side) KPI (totale e unici), tabella riepilogo e accordion dettaglio.
3. L'operatore può selezionare più turni e più servizi contemporaneamente (selezione OR all'interno di ciascun gruppo, AND tra i due gruppi).
4. Cliccando "Tutti" si azzera la selezione del gruppo corrispondente.

### Step 3 — Consultazione in modalità Riepilogo

1. La vista predefinita mostra una tabella con una riga per organizzazione e colonne: Vol | Mezzi | Mat | Tot.
2. L'ultima riga riporta i totali di colonna e il numero di organizzazioni.
3. L'operatore può cercare un'organizzazione per nome tramite il campo di ricerca.

### Step 4 — Consultazione in modalità Dettaglio

1. L'operatore clicca "Dettaglio" nel toggle vista.
2. Il sistema mostra un accordion: una card per organizzazione con badge numerici V/M/A/Tot.
3. L'operatore clicca una card per espanderla: appaiono le sub-tabelle nominative (volontari, mezzi, materiali) con turno e servizio di ciascun record.
4. Più card possono essere aperte contemporaneamente.

### Step 5 — Ricarica

1. L'operatore clicca il pulsante ricarica (↺).
2. Il sistema ricarica le tre tabelle e ricalcola filtri e vista mantenendo le selezioni attive.

---

## Extensions

### 1a. Errore di caricamento

- Il sistema mostra una notifica `is-danger` con pulsante "Riprova".
- I filtri e la vista non sono accessibili finché il caricamento non va a buon fine.

### 1b. Tabelle preaccreditati vuote

- `allTurni` e `allServizi` risultano vuoti: i chip non vengono mostrati.
- I KPI mostrano tutti zero.
- La tabella/accordion mostra "Nessuna organizzazione trovata".

### 2a. Nessun risultato con filtri attivi

- Il sistema mostra "Nessuna organizzazione trovata con i filtri attivi."

### 3a. Ricerca org senza risultati

- Il sistema mostra la stessa notifica "Nessuna organizzazione trovata".

### 4a. Organizzazione senza risorse in una categoria

- La sezione corrispondente (Volontari / Mezzi / Materiali) non viene renderizzata nel corpo espanso.
- Il badge della categoria assente non compare nell'header della card.
