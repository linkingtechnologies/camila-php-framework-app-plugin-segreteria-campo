# Gestione interventi {#top}

Le schede degli interventi sul territorio: la versione digitale del modulo
cartaceo «INTERVENTI». Registri la segnalazione, compili chi ha segnalato, dove e
quando, annoti il sopralluogo, le squadre attivate e la cronologia, e chiudi
l'intervento indicando inizio e fine. Si apre da *Operatività → Gestione
interventi*.

Il nome di un intervento diventa un servizio a cui si possono assegnare le
risorse: compare nei menu dei servizi di check-in, check-out, movimentazione e
mappe.

## Le due viste {#viste}

I pulsanti **Kanban** e **Elenco** in alto a destra cambiano il modo di guardare
gli interventi.

- **Kanban**: una colonna per ogni stato (di solito *Segnalato*, *In corso*,
  *Concluso*). Ogni scheda mostra il nome, il codice, il comune e la data della
  segnalazione. *Trascina una scheda* in un'altra colonna per cambiarne lo stato;
  un clic la apre nella vista **Elenco**. Una colonna senza schede dice *vuota*.
- **Elenco**: a sinistra l'elenco degli interventi, a destra la scheda
  dell'intervento scelto. Con nessun intervento selezionato vedi **Seleziona un
  intervento dall'elenco.**

## L'elenco {#elenco}

- **Cerca…** filtra per testo: confronta nome, oggetto, comune, indirizzo, nome
  del segnalante, numero di riferimento dei Vigili del Fuoco, squadre attivate e
  codice.
- **Tutti gli stati** restringe a uno stato.
- **Ricarica** rilegge gli interventi dal server.
- In fondo vedi «X di Y»: quanti ne vedi dopo i filtri su quanti ce ne sono. Senza
  interventi vedi **Nessun intervento registrato.**, con i filtri che non trovano
  nulla **Nessun risultato.**

Ogni riga ha un pallino colorato per lo stato, il nome, il codice, il comune e la
data di segnalazione.

## Lo stato {#stato}

Lo stato lo scegli tu, nel menu **Stato**. Se lasci **Non impostato**, il sistema
lo ricava dalle date: senza inizio *Segnalato*, con inizio e senza fine *In corso*,
con entrambe *Concluso*. Nel kanban una scheda con lo stato ricavato porta la
scritta *dedotto*. Uno stato scelto a mano non viene mai cambiato compilando
l'inizio o la fine.

## Registrare un nuovo intervento {#nuovo}

1. Premi **Nuovo intervento** (o **Nuovo**, sulla scheda): si apre la finestra
   **Nuovo intervento**.
2. Scrivi il **Nome intervento**: è obbligatorio. Puoi indicare anche l'**Oggetto**,
   la **Segnalazione** (data e ora, già impostata a adesso), il **Comune** e la
   provincia (**Prov.**).
3. Premi **Crea**.

Il sistema assegna un codice e apre la scheda completa dell'intervento appena
creato, dove prosegui. **Annulla** chiude la finestra senza salvare.

Il nome identifica l'intervento: le risorse e le note vi fanno riferimento per
nome. Se esiste già un servizio con lo stesso nome il sistema te lo segnala e ti
chiede se procedere; due servizi omonimi rendono ambigua l'assegnazione.

## La scheda {#scheda}

La scheda è divisa in blocchi. Per salvare premi **Salva**, attivo solo se ci sono
modifiche (compare **Modifiche non salvate**); poi vedi **Modifiche salvate.**
Passando a un altro intervento con modifiche in sospeso il sistema chiede conferma
(**Ci sono modifiche non salvate. Scartarle?**).

- **Intervento**: il **Codice intervento**, il **Nome intervento**, lo **Stato** e
  l'**Oggetto**.
- **Segnalazione**: **Data e ora** e **N. riferimento VVF**.
- **Segnalante**: **Nome**, **Qualifica**, **Indirizzo** e **Telefono**.
- **Luogo**: **Via**, **Comune** e **Provincia**.
- **Tempi**: **Sopralluogo**, **Inizio intervento** e **Fine intervento**.
- **Squadre e referente**: vedi sotto.
- **Catalogo e mappa**: **Ordine**, **Lettera**, **Colore**, **Latitudine** e
  **Longitudine**. **Scegli sulla mappa** apre la mappa: puoi cercare un indirizzo
  o cliccare sul punto. La ricerca degli indirizzi usa il servizio pubblico di
  OpenStreetMap: senza internet vedi **Ricerca indirizzi non disponibile** e puoi
  comunque cliccare sul punto e scrivere comune e indirizzo a mano.
- **Cronologia**: le note libere e il brogliaccio (vedi sotto).
- **Richieste**: le richieste collegate (vedi sotto).

Se i permessi non permettono di modificare la scheda compare **Sola lettura** e i
campi sono disabilitati.

### Il codice {#codice}

Il **Codice intervento** identifica l'intervento in radio e al telefono: ha cinque
caratteri scelti in modo da non confondersi a voce. Lo assegna il sistema alla
creazione e non si modifica. Per gli interventi registrati prima che esistesse
vedi **Non assegnato** e il pulsante **Genera**.

### Rinominare {#rinominare}

Se cambi il **Nome intervento** di una scheda salvata il sistema avvisa: le
risorse già assegnate e le note di brogliaccio continueranno a puntare al nome
precedente e non verranno aggiornate.

## Squadre e referente {#squadre}

**Squadre attivate** è un elenco di caselle da spuntare, in gruppi:
**Organizzazioni**, **Squadre dichiarate** e **Squadre dalle risorse**. Sotto
**Organizzazioni attivate** (solo lettura) mostra le organizzazioni che ne
derivano. Una squadra scelta in passato e ora fuori elenco resta visibile con
l'etichetta *fuori lista*, e non viene scartata.

Se la squadra che ti serve non c'è, **Nuova squadra** apre una finestra con
**Nome squadra**, **Organizzazioni**, **N. volontari** e **N. mezzi**; **Crea e
attiva** la registra e la attiva subito su questo intervento. Il resto della sua
scheda (mansione, caposquadra, disponibilità) lo completi nella pagina **Squadre
dichiarate**, a cui porta il collegamento sotto l'elenco.

Poi indichi **Operatori a supporto** e il referente: **Cognome referente**, **Nome
referente** e **Telefono referente**, a mano oppure con **Cerca in anagrafica**.
Quest'ultimo apre **Scegli il referente**: scrivi cognome, nome o organizzazione,
poi **Scegli** sulla riga giusta; i tre campi si compilano e restano modificabili.
Vedi al massimo 50 risultati (**Primi 50 risultati: restringi la ricerca.**).
**Chiudi** esce senza scegliere.

## Cronologia: note e brogliaccio {#cronologia}

Ci sono due tipi di note.

- **Note libere**: testo che resta sulla scheda e *non* finisce nel brogliaccio.
- **Note brogliaccio**: scrivi la nota e premi **Annota** (o Invio). Ogni nota
  diventa una riga del brogliaccio con data e ora e il nome dell'intervento; le
  vedi dalla più recente. Il brogliaccio è un registro: le note non si cancellano
  da qui.

## Richieste collegate {#richieste}

Nel blocco **Richieste** vedi le richieste legate a questo intervento (**Stato**,
**Richiesta**, **Richiedente**, **Priorità**). **Nuova richiesta** apre un modulo:
**Data**, **Richiedente**, **Tipo**, **Priorità**, **Stato**, **Assegnatario** e
**Richiesta**; poi **Salva richiesta**. **Richiedente** e **Richiesta** sono
obbligatori (**Richiedente e richiesta sono obbligatori.**). Per lavorarle usa
**Gestione richieste**: il collegamento porta alla pagina delle richieste.

## Eliminare un intervento {#elimina}

**Elimina** controlla prima se volontari, mezzi o materiali hanno quel nome come
servizio (**Verifica risorse assegnate…**).

- Se ce ne sono, vedi **Non eliminabile** con quante risorse lo usano, per
  categoria: non si elimina.
- Se non ce n'è nessuna chiede conferma (**Nessuna risorsa assegnata. Confermi?**):
  **Sì, elimina** o **Annulla**.

## Se qualcosa non va {#problemi}

- Se gli interventi non si caricano vedi un messaggio d'errore con **Riprova** e
  **Dettagli tecnici**.
- Se un'attivazione di squadra salva l'intervento ma non registra il movimento,
  vedi un avviso che inizia con **Intervento salvato, ma la movimentazione di**.
  Il salvataggio resta valido.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
