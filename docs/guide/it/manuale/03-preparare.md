# 3. Preparare l'evento {#top}

Prima che arrivi la prima organizzazione, si configura il programma. È un lavoro da fare *una
volta*, con calma, e conviene che lo faccia un amministratore o una persona esperta. Alla fine di
questo capitolo c'è una [lista di controllo](#controllo).

## 3.1 Dati dell'intervento e loghi {#intervento}

In *Configurazione* si impostano il nome dell'intervento, il comune, il nome del campo e i modelli
di stampa: [Informazioni intervento](guide:dashboards/05). Quei dati finiscono nell'intestazione
di report, attestati e moduli, quindi vanno scritti bene prima di stampare.

I loghi si caricano da [Carica loghi](guide:dashboards/06) e poi si scelgono in Informazioni
intervento. Il programma ne usa due:

- *logo*: immagine *quadrata* (per esempio 300 × 300 pixel), nell'intestazione di tutti i
  modelli;
- *logo2*: immagine *rettangolare*, larga il doppio dell'altezza, usata solo in alcuni modelli
  (per esempio gli attestati).

I loghi vanno caricati in formato JPG e conviene tenerli leggeri (meno di 200 KB).

## 3.2 Servizi e magazzini {#servizi}

I **servizi** sono i compiti a cui si assegnano le risorse durante l'evento (cucina, segreteria,
scenario operativo…). Si definiscono prima, in [Servizi](guide:service-manager), con posizione e
orari.

*Attenzione*: i due servizi **IN ATTESA DI SERVIZIO** e **USCITA DEFINITIVA** devono esistere
sempre, altrimenti il programma non funziona correttamente. Non si possono eliminare né
riordinare; lo strumento li inserisce da solo se mancano.

I **magazzini** sono i punti di deposito dei consumabili (acqua, sabbia, pasti): si definiscono in
[Magazzini](guide:warehouse-manager) e si usano poi dalla [Movimentazione
consumabili](guide:stock-manager).

## 3.3 Le anagrafiche {#anagrafiche}

Le anagrafiche sono i dati che esistono prima dell'evento e restano dopo: organizzazioni,
volontari, mezzi, materiali. Si consultano e si correggono dal [Database
risorse](guide:resource-manager). Se sono già disponibili in un file Excel, un amministratore le
carica in blocco ([Amministrazione](guide:manuale/B-amministrazione#importare)): organizzazione per
organizzazione sarà poi più rapido registrare gli arrivi.

## 3.4 I preaccreditamenti {#preaccreditamenti}

Se l'evento prevede un preaccreditamento, le organizzazioni dichiarano prima chi verrà, e il
programma lo sa in anticipo. I dati dei volontari, dei mezzi e dei materiali preaccreditati si
caricano da Excel (un amministratore, vedi [Amministrazione](guide:manuale/B-amministrazione#importare))
oppure arrivano dal portale dei preaccreditamenti ([Moduli e integrazioni](guide:manuale/C-moduli)).

Nel tab **PREACCREDITAMENTI** si controlla cosa è atteso:

- il [Riepilogo preaccreditamenti](guide:pre-accreditations-summary) dice quanti ne aspetti per
  organizzazione e, a evento avviato, quanti sono già arrivati;
- le tabelle per turno ([Volontari](guide:dashboards/pre-accreditations-by-service),
  [Mezzi](guide:dashboards/pre-accreditations-vehicles-by-service),
  [Pernottamenti](guide:dashboards/pre-accreditations-by-overnight-stay)) dicono chi fa cosa e quando.

## 3.5 Squadre dichiarate {#squadre}

Se per alcune organizzazioni non avrai i nominativi, ma solo i numeri, le registri come [squadre
dichiarate](guide:team-manager). Vedi [Risorse registrate e squadre
dichiarate](guide:manuale/01-capire#squadre).

## 3.6 Moduli di accreditamento e badge {#moduli}

Una volta caricati i preaccreditamenti si stampano i moduli di accreditamento: per mezzi e materiali
dal tab **PREACCREDITAMENTI**, con la **Modulistica** per turno (complessiva o per turno).
Alcuni moduli contengono codici a barre o codici QR che velocizzano la registrazione all'arrivo.

I badge di volontari, mezzi e operatori si stampano con il modello apposito dalla rispettiva scheda
dati ([Le schede dati](guide:manuale/A-schede-dati#modelli)). Il codice del badge si compone da
un prefisso definito in Informazioni intervento. Quando stampi, controlla nelle opzioni di stampa
che *non ci sia nessun ridimensionamento della pagina*.

## 3.7 Dati di esempio e prove {#esempio}

Per provare il programma o fare formazione c'è **Importa dati esempio** nel tab **AIUTO**: carica
servizi e dati d'esempio. Non usarlo su un'installazione già in uso. Conviene fare una prova
completa (un'organizzazione fittizia che arriva, si sposta e parte) prima dell'evento.

Spunta le schede da importare e premi *Importa*: vengono caricate *una alla volta* (quelle in attesa
dicono «In coda»). Per ognuna compare quante righe sono entrate; se qualcuna non è entrata lo dice
(*Importati: 20 · non importati: 5*), e lo stesso se non è stata letta nessuna riga (di solito le
intestazioni del file non combaciano con le colonne della scheda). In quel caso svuota la scheda,
ricarica la pagina e importa di nuovo: se ripeti l'importazione senza svuotarla, i record si
aggiungono a quelli già presenti.

## 3.8 Lista di controllo {#controllo}

Prima di aprire il campo:

- [ ] Informazioni intervento compilate e loghi caricati e scelti;
- [ ] servizi definiti, con IN ATTESA DI SERVIZIO e USCITA DEFINITIVA presenti;
- [ ] magazzini definiti, se si gestiscono consumabili;
- [ ] anagrafiche e preaccreditamenti caricati e controllati nel Riepilogo;
- [ ] moduli di accreditamento e badge pronti per la stampa;
- [ ] una password personale per ogni utente, e un utente per postazione;
- [ ] un [backup](guide:manuale/08-chiudere#backup) dello stato iniziale;
- [ ] una prova completa fatta.
