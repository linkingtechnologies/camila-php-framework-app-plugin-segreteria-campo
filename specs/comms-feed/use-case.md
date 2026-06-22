# Use Case — comms-feed

## Identificativo

UC-CF — Monitoraggio comunicazioni digitali in sala operativa

---

## Contesto di sistema

Schermo dedicato in sala operativa che mostra in tempo reale le comunicazioni digitali in arrivo (Telegram, Radio) affiancate alla mappa delle risorse attive per servizio. Permette al coordinatore di avere un quadro immediato sia delle comunicazioni che della situazione sul campo.

---

## Goal

Visualizzare in tempo reale il flusso di comunicazioni digitali e lo stato delle risorse operative sul territorio, con segnalazione sonora e visiva per i messaggi ad alta priorità.

---

## Primary Actor

Coordinatore sala operativa / Operatore di segreteria campo

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Coordinatore sala operativa | Intercettare rapidamente comunicazioni urgenti e correlare con la situazione sul campo |
| Operatore di segreteria | Monitoraggio passivo del canale Telegram/Radio senza dover aprire applicazioni esterne |

---

## Precondizioni

- L'operatore è autenticato.
- Esiste la tabella `com-digitali` con almeno un record.
- Esiste la tabella `servizi` con coordinate geografiche valorizzate per i servizi attivi.

---

## Postcondizioni

- Il feed si aggiorna automaticamente mostrando le comunicazioni più recenti in cima.
- I nuovi messaggi sono evidenziati visivamente e, se l'audio è abilitato, segnalati acusticamente.

---

## Main Success Scenario

### Step 1 — Avvio

1. La SPA si avvia e avvia in parallelo:
   - Caricamento comunicazioni da `com-digitali` (ultimi 100 record, ordinati per `received-date` desc)
   - Caricamento dati mappa: `servizi`, `volontari`, `mezzi`, `materiali` (solo risorse attive)
2. Mentre i dati caricano, la toolbar mostra i countdown e lo spinner.
3. Al termine del caricamento:
   - Il feed mostra i messaggi in ordine cronologico inverso (più recente in cima)
   - La mappa Leaflet viene inizializzata e posizionata sui marker dei servizi con coordinate

### Step 2 — Monitoraggio continuo (feed)

1. Il timer del feed scatta ogni N secondi (default 10s, configurabile a 30s o 60s dalla toolbar).
2. Il sistema carica i nuovi record da `com-digitali`.
3. I record con `received-date` più recente dell'ultimo poll vengono considerati nuovi:
   - Appaiono in cima al feed con animazione flash blu per 4 secondi
   - Se l'audio è abilitato, viene riprodotto un beep (doppio acuto per emergenza, singolo per gli altri)
4. Il countdown in toolbar si azzera e riparte.

### Step 3 — Filtro per canale

1. I chip canale in toolbar si popolano automaticamente dai valori distinti di `canale-origine` nei dati.
2. L'operatore clicca un chip (es. "Telegram") per mostrare solo quel canale.
3. Clicca "Tutti" per tornare alla vista completa.
4. Il filtro è client-side, non richiede un nuovo caricamento.

### Step 4 — Abilitazione audio

1. L'operatore clicca il pulsante "Audio OFF" → diventa "Audio ON" (verde).
2. Al prossimo poll con nuovi messaggi, viene riprodotto il beep appropriato.
3. Cliccando di nuovo si disabilita l'audio.

### Step 5 — Aggiornamento mappa

1. Il timer della mappa scatta ogni 60 secondi (indipendente dal feed).
2. Il sistema ricarica `servizi`, `volontari`, `mezzi`, `materiali`.
3. I marker vengono rimossi e ricreati con i dati aggiornati.
4. I popup sui marker mostrano le risorse attive aggiornate.

---

## Extensions

### 1a. Errore caricamento comunicazioni

- Viene mostrato un banner di errore nel pannello feed con pulsante "Riprova".
- Il timer continua a girare e ritenta automaticamente al prossimo tick.

### 1b. Tabella com-digitali vuota

- Il feed mostra "Nessuna comunicazione" con icona inbox.

### 1c. Servizi senza coordinate

- I servizi senza `latitudine`/`longitudine` vengono ignorati nella mappa (nessun marker).

### 1d. Leaflet non caricabile (CDN irraggiungibile)

- Il pannello mappa rimane vuoto (nessun errore visibile all'utente — la mappa è complementare).

### 2a. Messaggio ad alta priorità ricevuto

- Il sistema rileva la priorità `"high"` (da campo `priorita` o da keyword nel testo).
- Il messaggio appare con border rosso e badge "EMERGENZA".
- Se audio abilitato: doppio beep acuto (1000Hz + 1200Hz).

### 3a. Canale non in elenco

- I chip si aggiornano dinamicamente ad ogni caricamento in base ai valori presenti nei dati: un canale non ancora mai ricevuto non compare tra i chip finché non arriva.
