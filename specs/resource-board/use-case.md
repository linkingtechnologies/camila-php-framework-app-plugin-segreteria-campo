# UC-RB01 — Gestione Operativa Risorse

## 1. Identificativo

**UC-RB01** — Assegnazione operativa di volontari, mezzi e materiali a servizi e squadre tramite kanban board.

## 2. Contesto di sistema

Questa SPA opera sul pool di risorse attive presenti in campo (check-in effettuato, check-out non ancora registrato). È il punto centrale di coordinamento operativo durante l'emergenza: consente di vedere la distribuzione delle risorse tra i servizi e di spostarle in tempo reale.

## 3. Goal

L'operatore può vedere in un colpo d'occhio come sono distribuiti volontari, mezzi e materiali tra i servizi operativi, spostarli tramite drag & drop o operazioni massive, e consultare in ogni momento lo storico dei movimenti.

## 4. Primary Actor

Operatore di segreteria campo / coordinatore operativo.

## 5. Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore campo | Assegnare rapidamente le risorse ai servizi giusti |
| Coordinatore | Visione d'insieme della distribuzione risorse per servizio |
| Responsabile organizzazione | Sapere dove sono collocate le proprie risorse |

## 6. Precondizioni

- Almeno una risorsa attiva esiste (`data-inizio-attestato` valorizzata, `data-fine-attestato` vuota, `servizio` ≠ `USCITA DEFINITIVA`)
- La tabella `servizi` contiene i servizi operativi configurati

## 7. Postcondizioni — Successo

- Il campo `servizio` (o `squadra`) delle risorse spostate è aggiornato al nuovo valore
- Per ogni risorsa spostata esiste un record in `mov-risorse` con data/ora, gruppo, identificativo risorsa, tipo, valore di provenienza e destinazione
- Il kanban riflette immediatamente la nuova distribuzione

## 8. Postcondizioni — Errore/Fallimento parziale

- Le risorse già aggiornate prima dell'errore mantengono il nuovo valore
- Le risorse non ancora processate restano al valore originale
- I record `mov-risorse` sono presenti solo per le risorse effettivamente aggiornate
- L'errore viene mostrato nella modale (senza chiuderla) o nella pagina

## 9. Classificazione stati

| Condizione sui dati | Significato |
|---|---|
| `data-inizio-attestato` valorizzata AND `data-fine-attestato` vuota AND `servizio` ≠ `USCITA DEFINITIVA` | Risorsa attiva — inclusa nel kanban |
| `servizio` valorizzato (non vuoto) | Card nella colonna del servizio corrispondente |
| `servizio` vuoto o assente | Card nella colonna `IN ATTESA DI SERVIZIO` |
| Servizio presente in `servizi` ma senza risorse attive | Chip giallo nella barra (non assegnato, espandibile) |
| Servizio con almeno una risorsa attiva | Colonna kanban + chip blu nella barra servizi |

## 10. Main Success Scenario

### Caricamento e visualizzazione

1. L'operatore apre la SPA; il sistema carica in parallelo le tabelle `volontari`, `mezzi`, `materiali` (solo risorse attive) e `servizi`.
2. Il sistema costruisce il kanban: prima colonna fissa `IN ATTESA DI SERVIZIO`, poi le colonne dei servizi con risorse in ordine alfabetico.
3. Il sistema mostra la barra servizi: chip blu per i servizi attivi, bottone `+N ▼` per espandere i servizi non assegnati (chip gialli, drop target).
4. Ogni colonna contiene una card per ogni gruppo (organizzazione o squadra) che ha risorse in quel servizio.
5. Ogni card mostra: nome gruppo, conteggi per tipo (👤 volontari / 🚚 mezzi / 🛠 materiali), pulsanti "Cambia servizio" e "Cambia squadra".
6. L'operatore filtra tramite la casella di ricerca; il sistema filtra le card in tempo reale su: nome gruppo, servizio, nominativi volontari, targhe e marca/modello mezzi, ID e categoria materiali.
6b. L'operatore può filtrare per organizzazione e/o provincia tramite due dropdown nella toolbar; il sistema mostra un banner giallo con il conteggio "stai vedendo X di Y risorse" e un pulsante ✕ per rimuovere il filtro.

### Espansione card e drag risorsa singola

7. L'operatore espande una card con ▼; il sistema mostra le liste dettagliate:
   - Volontari: cognome, nome (con handle ⠿)
   - Mezzi: targa, marca/modello (con handle ⠿)
   - Materiali: ID/inventario, categoria (con handle ⠿)
8. L'operatore trascina l'header di categoria (es. "👤 Volontari (6) ⠿") verso una colonna o chip di destinazione; il sistema sposta tutte le risorse di quel tipo.
9. L'operatore trascina una singola riga risorsa verso una colonna o chip di destinazione; il sistema sposta solo quella risorsa.
10. Per ogni risorsa spostata il sistema aggiorna `servizio` e scrive un record in `mov-risorse`.

### Cambio servizio singola risorsa (icona)

10b. L'operatore clicca l'icona 🔀 accanto a una singola risorsa nel dettaglio espanso; il sistema apre la modale `cambio-risorsa` con il nome della risorsa, il servizio corrente e una select del nuovo servizio.
10c. L'operatore seleziona il servizio di destinazione e clicca "Conferma"; il sistema aggiorna `servizio` sulla singola risorsa, scrive un record in `mov-risorse`, chiude la modale e ricarica il kanban.

### Drag card intera

11. L'operatore trascina la card intera verso una colonna o chip di destinazione; il sistema sposta tutte le risorse del gruppo in quel servizio (volontari + mezzi + materiali).
12. La colonna/chip di destinazione si evidenzia durante il trascinamento.
13. Al rilascio il sistema aggiorna `servizio` su tutte le risorse coinvolte, scrive i record `mov-risorse` e ricarica il kanban.

### Cambio servizio massivo (modale)

14. L'operatore clicca "Cambia servizio" su una card; il sistema apre la modale con select del nuovo servizio (include `IN ATTESA DI SERVIZIO`, servizi attivi e servizi disponibili) e checkbox per tipo risorsa (pre-selezionate per i tipi presenti).
15. L'operatore seleziona il nuovo servizio e i tipi da spostare, poi clicca "Conferma".
16. Il sistema aggiorna `servizio` su tutte le risorse selezionate, scrive i record `mov-risorse`, chiude la modale e ricarica il kanban.

### Cambio squadra massivo (modale)

17. L'operatore clicca "Cambia squadra" su una card; il sistema apre la modale con combobox squadra (suggerisce le squadre esistenti, accetta testo libero per nuove squadre) e checkbox per tipo risorsa.
18. L'operatore seleziona o digita la nuova squadra e i tipi, poi clicca "Conferma".
19. Il sistema aggiorna `squadra` su tutte le risorse selezionate, scrive i record `mov-risorse` con `da: "SQUADRA: <vecchia>"` / `a: "SQUADRA: <nuova>"`, chiude la modale e ricarica il kanban.

## 11. Extensions

**1a. Errore API al caricamento**
- Il sistema mostra un messaggio di errore con pulsante "Riprova"; il kanban non viene renderizzato.

**1b. Nessuna risorsa attiva**
- Il kanban mostra solo la colonna `IN ATTESA DI SERVIZIO` vuota.

**6a. Ricerca senza risultati**
- Tutte le colonne mostrano il segnaposto "—"; la barra servizi rimane visibile.

**10a / 13a. Errore API durante drag & drop**
- Il sistema mostra il messaggio di errore nella pagina; le risorse già aggiornate mantengono il nuovo servizio.

**6c. Filtro org/provincia senza risultati**
- Il kanban non mostra nessuna card; il banner filtro rimane visibile con "stai vedendo 0 di N risorse".

**10d. Nessun servizio selezionato nella modale cambio-risorsa**
- Il pulsante "Conferma" rimane disabilitato.

**10e. Errore API durante cambio-risorsa**
- Il sistema mostra l'errore nella modale senza chiuderla; il pulsante "Conferma" torna abilitato.

**15a. Nessun servizio selezionato nella modale**
- Il pulsante "Conferma" rimane disabilitato.

**15b. Nessun tipo di risorsa selezionato nella modale**
- Il pulsante "Conferma" rimane disabilitato; viene mostrato "Seleziona almeno un tipo di risorsa."

**15c. Errore API durante cambio servizio**
- Il sistema mostra l'errore nella modale senza chiuderla; il pulsante "Conferma" torna abilitato.

**18a. Campo squadra vuoto alla conferma**
- Il pulsante "Conferma" rimane disabilitato.

**18b. Nessuna squadra esistente nel sistema**
- La combobox non mostra suggerimenti; viene mostrato "Nessuna squadra trovata nei dati attivi."

**18c. Errore API durante cambio squadra**
- Il sistema mostra l'errore nella modale senza chiuderla; il pulsante "Conferma" torna abilitato.
