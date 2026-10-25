# UC-A04 — Describe con la configurazione della colonna

**Identificativo:** UC-A04 — `describe()` restituisce, accanto al tipo fisico di
ogni colonna, come la colonna è configurata in Camila.

## Contesto di sistema

I campi a elenco chiuso (`categoria`, `tipologia`, `stato`, `mansione`, …) sono
configurati in Camila come *elenco dei valori* della colonna. Prima di questa
estensione quegli elenchi erano copiati dentro le SPA: quattro copie dello
stesso vocabolario di `categoria`/`tipologia`, da tenere allineate a mano.

Non è un endpoint del plugin: è il `describe` del framework, esteso. La spec
sta qui perché il plugin ci si appoggia e la forma della risposta è un
contratto fra i due.

## Goal

Un operatore che cambia l'elenco dei valori di una colonna dall'interfaccia di
Camila vede il nuovo elenco nelle tendine delle SPA, senza che nessuno debba
modificare il codice.

## Primary Actor

Le SPA del plugin, tramite `client.table(<tabella>).describe()`. L'operatore
non lo chiama mai direttamente.

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore di segreteria | Vedere nelle tendine le voci che ha appena configurato |
| Responsabile dei dati | Una sola definizione del vocabolario, non cinque |
| Manutentore | Non dover ritoccare quattro file per aggiungere una voce |

## Precondizioni

- Sessione Camila attiva.
- La tabella è visibile all'utente.
- Il framework espone il describe esteso.

## Postcondizioni — Successo

- Per ogni colonna di una worktable il chiamante riceve, oltre al tipo fisico,
  l'etichetta della scheda, il tipo Camila, obbligatorietà, sola lettura,
  unicità, visibilità, lunghezza massima, valore predefinito, e — se la colonna
  è a elenco chiuso — l'elenco dei valori.
- Le colonne sono identificate con il **nome pubblico**, quello con cui
  compaiono nei record. Il nome fisico non viene esposto.

## Postcondizioni — Errore/Fallimento parziale

- Nessuna scrittura: è di sola lettura.
- Se la configurazione non è leggibile, il describe resta quello di prima — tipo
  e lunghezza — senza errore.
- Se il chiamante non riceve la configurazione, usa la propria copia di riserva
  e resta utilizzabile: le tendine mostrano l'ultimo elenco conosciuto, non il
  vuoto.

## Main Success Scenario

1. La SPA chiede la descrizione di una tabella indicandola con il nome che ha
   nell'API (`mezzi`, `materiali`, `servizi`).
2. Il sistema riflette la tabella fisica, come faceva già.
3. Il sistema associa a ciascuna colonna la propria configurazione Camila.
4. Il sistema restituisce le colonne col nome pubblico, ciascuna con la propria
   configurazione.
5. La SPA costruisce le tendine dagli elenchi di valori ricevuti.

## Extensions

**2a. Tabella inesistente o non visibile** — errore di tabella non trovata, come
già oggi; la SPA ricade sulla copia di riserva.

**3a. La tabella non è una worktable** — la descrizione non riceve nessuna
configurazione. Non è un errore: tabelle di servizio e di sistema non ne hanno.

**3b. Configurazione non leggibile** — la descrizione resta quella fisica. Il
chiamante non distingue questo caso dal precedente e ricade sulla copia di
riserva.

**4a. Colonna senza elenco di valori** — l'elenco è assente dalla sua
configurazione. È la norma per i campi liberi, non un errore.

**5a. Framework non esteso** — nessuna colonna porta la configurazione. La SPA
lo riconosce — non è "nessun vocabolario", è "non lo sappiamo" — e usa la copia
di riserva.
