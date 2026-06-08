# UC-SM01 — Gestione Servizi

## 1. Identificativo

**UC-SM01** — CRUD completo dei servizi operativi con riordinamento drag & drop, selezione posizione geografica e strumenti di importazione/pulizia massiva.

## 2. Contesto di sistema

La tabella `servizi` definisce l'elenco dei servizi operativi ai quali possono essere assegnati volontari, mezzi e materiali durante l'emergenza. Questa SPA permette di configurare e mantenere aggiornato tale elenco prima e durante le operazioni.

## 3. Goal

L'operatore può creare, modificare, eliminare e riordinare i servizi; può associare ad ogni servizio un colore identificativo, una posizione geografica, date di inizio/fine e note operative. Può inoltre importare massivamente i servizi già utilizzati nelle tabelle di preaccreditamento e accreditamento, e garantire la presenza dei servizi obbligatori di sistema.

## 4. Primary Actor

Operatore di segreteria campo / responsabile configurazione.

## 5. Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore campo | Mantenere l'elenco servizi allineato alle esigenze operative |
| Coordinatore | Disporre di un elenco ordinato e colorato per riconoscimento rapido |
| Resource board | Consumare la tabella servizi per popolare colonne e dropdown |

## 6. Precondizioni

- La tabella `servizi` è accessibile tramite WorkTableClient
- I servizi obbligatori (`IN ATTESA DI SERVIZIO`, `USCITA DEFINITIVA`) possono essere assenti (vengono inseriti tramite strumento dedicato)

## 7. Postcondizioni (successo)

- La tabella `servizi` riflette le modifiche apportate
- L'ordine dei record rispetta l'ordinamento drag & drop
- I servizi obbligatori sono contrassegnati come protetti (non eliminabili, non riordinabili)

## 8. Flusso principale

1. L'operatore apre la SPA: viene mostrata la lista dei servizi ordinata per campo `ordine`, con pannello destro vuoto (nessuna selezione).
2. L'operatore seleziona un servizio dalla lista: il pannello destro mostra il form di modifica.
3. L'operatore modifica uno o più campi e clicca **Salva modifiche**: il sistema aggiorna il record e mostra conferma.
4. L'operatore clicca il pulsante **+**: il pannello destro mostra il form di creazione.
5. L'operatore compila il nome (obbligatorio) e gli altri campi, poi clicca **Crea servizio**: il sistema crea il record e seleziona automaticamente il nuovo servizio.
6. L'operatore trascina un servizio nella lista per riordinarlo: il sistema aggiorna il campo `ordine` di tutti i servizi coinvolti.

## 9. Flussi alternativi

### 9a — Eliminazione servizio

1. Con un servizio selezionato, l'operatore clicca **Elimina**.
2. Il sistema verifica se il servizio è assegnato a record nelle tabelle `volontari`, `mezzi`, `materiali`.
3a. Se il servizio è in uso: viene mostrato un messaggio bloccante con il conteggio delle risorse assegnate. L'eliminazione non è consentita.
3b. Se il servizio non è in uso: viene richiesta conferma. Alla conferma il record viene eliminato.

### 9b — Clonazione servizio

1. Con un servizio selezionato (non protetto), l'operatore clicca **Clona**.
2. Il sistema crea una copia del servizio con nome `<nome originale> (copia)` e ordine successivo all'ultimo.
3. Il nuovo servizio viene selezionato automaticamente con messaggio "Servizio clonato — modifica il nome e salva."

### 9c — Selezione posizione geografica tramite mappa

1. Dal form, l'operatore clicca **Scegli sulla mappa**.
2. Si apre una modale con mappa Leaflet/OpenStreetMap. Il campo di ricerca è pre-compilato con indirizzo, comune e provincia già presenti nel form (se valorizzati).
3. L'operatore può:
   - Cercare un indirizzo tramite Nominatim e selezionare un risultato dalla lista
   - Cliccare direttamente sulla mappa o trascinare il marker
4. Dopo la selezione, il pannello laterale mostra coordinate, comune, provincia e indirizzo ricavati via reverse geocoding. Il pulsante **Conferma** è disabilitato finché il reverse geocoding non è completato.
5. L'operatore clicca **Conferma**: le coordinate e i dati di indirizzo vengono copiati nel form.

### 9d — Copia/incolla coordinate

1. Con coordinate presenti nel form, l'operatore apre il dropdown **Copia coordinate** e sceglie:
   - **Solo coordinate**: copia latitudine e longitudine
   - **Coordinate con indirizzo**: copia anche comune, provincia, indirizzo
2. L'operatore seleziona un altro servizio e clicca **Incolla coordinate**: i dati vengono applicati al form del nuovo servizio.

### 9e — Navigazione con modifiche non salvate

1. L'operatore ha modificato il form senza salvare e tenta di selezionare un altro servizio o creare un nuovo servizio.
2. Il pannello viene scrollato in cima e compare un avviso con due pulsanti: **Annulla modifiche** e **Continua a modificare**.
3a. Se l'operatore conferma l'abbandono: le modifiche vengono scartate e si procede alla selezione/creazione.
3b. Se l'operatore annulla: rimane sul servizio corrente.

### 9f — Importa servizi da preaccreditati

1. L'operatore apre il menu **Strumenti** e clicca **Importa servizi da preaccreditati**.
2. Il sistema legge il campo `servizio` da `volontari-preaccreditati`, `mezzi-preaccreditati`, `materiali-preaccreditati`.
3. Calcola i valori distinti non vuoti e li confronta con i servizi esistenti (confronto case-insensitive sul nome).
4. Inserisce i servizi mancanti con ordine progressivo a partire dall'ultimo esistente.
5. Mostra un riepilogo: nomi inseriti e conteggio già presenti.

### 9g — Importa servizi da accreditati

1. Come 9f, ma legge il campo `servizio` da `volontari`, `mezzi`, `materiali` (tabelle degli accreditati attivi).

### 9h — Inserisci servizi obbligatori

1. L'operatore apre il menu **Strumenti** e clicca **Inserisci servizi obbligatori**.
2. Il sistema verifica la presenza di `IN ATTESA DI SERVIZIO` (ordine 1) e `USCITA DEFINITIVA` (ordine 999).
3. Inserisce quelli mancanti e mostra riepilogo.

### 9i — Elimina tutti i servizi non obbligatori

1. L'operatore apre il menu **Strumenti** e clicca **Elimina tutti i servizi non obbligatori**.
2. Il sistema chiede conferma esplicita (dialog browser).
3. Alla conferma, elimina tutti i servizi eccetto `IN ATTESA DI SERVIZIO` e `USCITA DEFINITIVA`.
4. Mostra il conteggio dei servizi eliminati.

## 10. Estensioni / Eccezioni

| Codice | Condizione | Comportamento |
|---|---|---|
| E01 | Nome servizio vuoto al salvataggio | Messaggio di errore in linea, salvataggio bloccato |
| E01b | Nome servizio già usato da un altro servizio | Salvataggio eseguito normalmente; messaggio di successo include avviso ⚠️. Controllo client-side su lista già in memoria, nessuna chiamata API aggiuntiva |
| E02 | Errore API in lettura | Messaggio di errore con dettagli tecnici espandibili |
| E03 | Errore API in scrittura | Messaggio di errore in linea nel form |
| E04 | Reverse geocoding non disponibile | `mapAddress` resta vuoto, il pulsante Conferma si sblocca comunque dopo timeout |
| E05 | Tentativo di eliminare servizio protetto | Il pulsante Elimina non è presente per i servizi protetti |
| E06 | Tentativo di riordinare servizio protetto | Il drag handle non è presente per i servizi protetti |

## 11. Servizi obbligatori (PROTECTED)

I servizi `IN ATTESA DI SERVIZIO` e `USCITA DEFINITIVA` sono protetti dal sistema:
- Non possono essere eliminati
- Non possono essere riordinati tramite drag & drop
- Non possono essere clonati
