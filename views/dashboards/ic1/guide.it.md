# Controllo dati {#top}

Cerca nei dati gli errori più comuni — codici fiscali mancanti, targhe doppie, uscite
registrate a metà — e, per alcuni, li sistema. Si apre dal tab VERIFICA DATI, con
**Controllo dati**. È bene lanciarlo prima di stampare gli attestati o di chiudere
l'evento, e ogni tanto durante l'evento.

## La lista dei controlli {#lista}

La pagina esegue i controlli uno dopo l'altro e li elenca. Per ciascuno:

- se va tutto bene vedi il titolo in verde con **OK**;
- se c'è qualcosa che non va vedi un avviso giallo con il problema e un pulsante
  **Visualizza** con il numero di righe coinvolte;
- se il controllo non riesce a girare (per esempio per una colonna mancante) vedi un
  avviso giallo senza pulsante.

I controlli nell'installazione base riguardano:

- **Volontari in uscita definitiva senza data/ora uscita** e **Mezzi in uscita
  definitiva senza data/ora uscita**;
- **Volontari in uscita definitiva senza movimentazione** e **Mezzi in uscita
  definitiva senza movimentazione**;
- **Volontari senza codice fiscale**, **Volontari con provincia errata**, **Volontari
  senza provincia**, **Volontari registrati più volte**;
- **Numero giorni benefici di legge**;
- **Nome organizzazione mezzi registrati**, **Mezzi senza targa**, **Mezzi registrati
  più volte**;
- **Mezzi senza indicazione KM all'arrivo**, **Mezzi senza indicazione KM inizio
  missione**, **Mezzi in uscita definitiva senza indicazione km alla partenza**,
  **Mezzi con più di 300 km percorsi in servizio**;
- **Servizi senza coordinate GPS**.

L'elenco è definito in `conf/integrity.xml` e può essere diverso in un'installazione
personalizzata.

## Vedere i casi e correggerli {#correggere}

**Visualizza** apre l'elenco delle righe con il problema, con il titolo del controllo.
In alto:

- **TORNA INDIETRO** riporta alla lista dei controlli;
- il pulsante **SCHEDA** con il nome della tabella (per esempio *SCHEDA VOLONTARI*)
  apre la scheda dei dati, dove correggi le righe a mano. Poi torna qui: la lista dei
  controlli si ricalcola a ogni apertura.

Le righe si possono esportare con le funzioni standard delle liste.

## La correzione automatica {#fix}

Solo i controlli sulle uscite definitive hanno il pulsante **FIX**: premendolo il
programma sistema i dati da solo. Non c'è un annulla: leggi qui sotto cosa fa prima di
premerlo.

- **Senza data/ora uscita** (volontari o mezzi): a tutte le righe in USCITA
  DEFINITIVA prive della data scrive *data e ora di adesso*. Non è l'ora in cui la persona o
  il mezzo sono davvero partiti: se quell'ora conta, correggi le righe a mano dalla
  scheda.
- **Senza movimentazione**: per le righe in USCITA DEFINITIVA con data di uscita, ma
  senza il relativo movimento nel registro, inserisce un movimento dal servizio in cui
  si trovava l'ultima volta (o da IN ATTESA DI SERVIZIO se non c'è nessun movimento)
  a USCITA DEFINITIVA, con la data di uscita già presente. Per ogni riga corretta
  scrive *Inserita movimentazione per* seguito da nome e organizzazione. Se non ci sono righe da sistemare compare
  **Non ho trovato informazioni sufficienti...**

Alla fine compare **Il problema dovrebbe essere risolto ora.** (per la data di uscita)
oppure **Tentativo di sistemazione dati terminato!** (per le movimentazioni). Controlla
sempre che il problema sia sparito riaprendo la lista dei controlli.

Gli altri controlli non hanno una correzione automatica: ogni caso va sistemato nella
scheda.
