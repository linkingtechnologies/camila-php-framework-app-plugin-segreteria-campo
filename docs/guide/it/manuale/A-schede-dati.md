# A. Le schede dati {#top}

*Argomento avanzato.* Le pagine del programma (check-in, movimentazione, mappe…) sono pensate per
lavorare senza toccare i dati direttamente. Sotto, però, tutto è memorizzato in **schede dati**, e
conoscerle serve per le procedure senza una pagina dedicata ([Tracciare e
comunicare](guide:manuale/06-tracciare), [Campo di accoglienza](guide:manuale/07-accoglienza)), per le
correzioni e per l'amministrazione.

## A.1 Cos'è una scheda dati {#cosa}

Il programma è costituito da una serie di schede dati con funzionalità comuni. Una scheda dati è
paragonabile a un foglio di lavoro di un foglio di calcolo (come Microsoft Excel): ogni *riga* è
un'entità (un volontario, un mezzo, un'attrezzatura, un ospite…), ogni *colonna* un'informazione.
Le stesse funzioni valgono per tutte le schede, e quelle che seguono si imparano una volta sola.

Le schede sono raggruppate così:

| Gruppo | Schede |
|---|---|
| Risorse operative | Volontari, Mezzi, Materiali, Operatori |
| Preaccreditamenti | Volontari, Mezzi, Materiali preaccreditati |
| Anagrafiche di riferimento | Organizzazioni, Volontari, Mezzi, Materiali, Operatori (database) |
| Configurazione dell'evento | Servizi, Magazzini |
| Consumabili e logistica | Movimentazioni consumabili, Magazzino |
| Ospiti e accessi | Ospiti, Ex ospiti, Ospiti attesi, Strutture, Esterni, Visitatori |
| Comunicazione e coordinamento | Rubrica, Richieste, Avvisi, Protocollo, Messaggi, Radio, Danneggiamenti |
| Reportistica e monitoraggio | Movimentazione risorse, Brogliaccio, Report, Pasti stimati, Conteggio pasti |

Le pagine del programma lavorano su queste stesse schede: per esempio il [Check-in
massivo](guide:massive-check-in) scrive nelle schede Volontari, Mezzi e Materiali, la [Movimentazione
risorse](guide:resource-board) cambia il campo *Servizio* e scrive lo storico nella scheda
Movimentazione risorse. *Una correzione fatta in una scheda si vede subito anche nelle pagine.*

## A.2 La struttura delle pagine {#struttura}

In alto a destra compare il nome dell'operatore al lavoro; *Preferenze* permette di cambiare la
password e i caratteri. Di fianco al nome dell'applicazione c'è la *barra dei menu*: dove ci sono
sotto menu compare una freccina verso il basso. Sotto la barra dei menu c'è la *barra di
navigazione*, che dice in quale area o scheda si sta lavorando; le sue voci si possono cliccare per
raggiungere altre aree senza ripassare dal menu.

## A.3 L'elenco {#elenco}

Aprendo una scheda (per esempio *Volontari*) si vede l'elenco di tutte le righe, anche di chi ha
già terminato il servizio. Voci come *Volontari in servizio* mostrano invece solo chi è presente e
disponibile al campo.

Sopra e sotto la tabella c'è una barra con alcuni pulsanti:

- *Pagina n/m*: la pagina corrente, se l'elenco è diviso in più pagine;
- *Tutte le pagine (n righe)*: mostra l'elenco completo in una sola pagina; il numero di righe è il
  numero di entità censite (per esempio 4 volontari registrati);
- *Opzioni / Rimuovi colonne*: sceglie le colonne da vedere (per esempio solo nome, cognome e
  cellulare);
- *Applica modello*: applica un modello di stampa precaricato (vedi sotto).

Un clic sull'intestazione di una colonna ordina l'elenco per quella colonna.

## A.4 Inserire, modificare, eliminare {#modificare}

- Per inserire: *INSERISCI NUOVO*, compare una scheda con i campi previsti.
- Per modificare: il pulsante *SCHEDA* su ogni riga.
- Per eliminare: *Elimina* sulla riga (la riga viene cancellata dal database).
- *Modifica in tabella*: si può anche cliccare direttamente sui valori delle celle per cambiarli.
- **Suggerimenti** («aiutini»): scrivendo poche lettere in alcuni campi (nome, cognome, codice
  fiscale, organizzazione…) il programma propone valori già presenti in altre schede.

## A.5 I filtri {#filtri}

Sopra ogni tabella c'è la barra del filtro, con tre caselle. È come in Excel: si sceglie il campo
(per esempio *ORGANIZZAZIONE*), il tipo di confronto (*contiene*, *uguale a*, *maggiore di*…) e il
valore. Basta scrivere una parte del nome e compare un suggerimento col nominativo registrato. Si
conferma con *Filtra i dati*. Le voci disponibili sono quelle della scheda: nella scheda *Mezzi* ci
sono TARGA, MARCA E MODELLO, ORGANIZZAZIONE…

Filtri speciali:

- *raggruppa per campo*: raggruppa le righe per i valori del campo e mostra quante volte compare
  ciascun valore (raggruppando i volontari per organizzazione si contano i volontari per
  organizzazione);
- *speciali* (con la «stellina»): mostra o nasconde solo le righe contrassegnate come speciali;
- *selezionati* (con la «spunta»): mostra o nasconde solo le righe selezionate.

## A.6 Esportare, stampare, modelli {#modelli}

In fondo alla pagina ci sono le opzioni di esportazione: *XLSX* (Excel), *ODS*
(OpenOffice/LibreOffice), **PDF**, *RTF* (Word, Writer) e **HTML** (versione stampabile).

Ai dati si possono applicare *modelli* che generano un PDF per usi particolari: badge con codice a
barre, attestati, moduli di accreditamento, avvisi, denunce di danneggiamento. I modelli sono
configurati in [Informazioni intervento](guide:dashboards/05) e descritti in
[Amministrazione](guide:manuale/B-amministrazione#modelli). Quando stampi un modello controlla che
nelle opzioni di stampa del browser *non ci sia nessun ridimensionamento della pagina*.

## A.7 Importare da Excel {#importare}

Con *IMPORTA DATI* si inserisce il contenuto di un file Excel in una scheda. La *prima riga* del file
deve contenere le intestazioni, uguali ai nomi dei campi della scheda. La funzione è riservata agli
amministratori ([Amministrazione](guide:manuale/B-amministrazione#importare)).

## A.8 Dove si trovano {#dove}

Le schede si aprono dal menu in alto, per area (per esempio *Risorse*, *Campo*, *Comunicazioni*,
*Servizi*). Chi amministra può inoltre vedere e correggere i dati grezzi di qualunque tabella con il
**Worktable Explorer** (pulsante in *Configurazione*, del plugin *Worktable*).
