# Movimentazione risorse {#top}

Il quadro d'insieme di dove si trovano le risorse in campo: volontari, mezzi e
materiali, raggruppati per servizio su un *kanban*, cioè una lavagna a colonne, una per
servizio, con le schede che si spostano da una colonna all'altra. Da qui le sposti da
un servizio all'altro. Si apre da *Operatività → Movimentazione risorse*.

## Cosa vedi {#cosa-vedi}

- In alto la barra con la ricerca, i filtri e i comandi.
- Sotto la barra **Servizi:**, con un'etichetta per ogni servizio che ha risorse.
- Poi il kanban: una colonna per ogni servizio. La prima è sempre *IN ATTESA DI
  SERVIZIO*, dove stanno le risorse non ancora assegnate.

Nell'intestazione di una colonna vedi il nome del servizio e quanti gruppi
contiene; sotto, i totali di volontari, mezzi e materiali. Se la colonna non ha
risorse c'è un trattino.

Ogni scheda è un **gruppo**: un'organizzazione (o una squadra, vedi **Raggruppa:**)
con le sue risorse in quel servizio.

## Cosa guardi {#mostra}

Il comando **Mostra:** ha tre pulsanti:

- **Risorse registrate**: il kanban di volontari, mezzi e materiali registrati
  con il check-in;
- **Squadre dichiarate**: le squadre note solo per numeri (vedi sotto);
- **Disponibilità nel tempo**: una linea temporale delle squadre (vedi sotto).

**Raggruppa:** compare solo guardando le risorse registrate: **Organizzazione**
mette in una scheda le risorse di ogni organizzazione, **Squadra** quelle di ogni
squadra.

## La scheda {#scheda}

Una scheda mostra il nome del gruppo e quante risorse ha, per tipo. Se non ne ha
dice *vuoto*. La freccia (**Espandi dettagli**) apre l'elenco:

- volontari, con **Cognome** e **Nome**;
- mezzi, con **Targa** e **Marca/Modello**;
- materiali, con **ID / Inv.** e **Categoria**.

In basso ci sono due pulsanti con un'icona: **Cambia servizio** e **Cambia
squadra** (le squadre dichiarate non hanno il secondo).

## Spostare le risorse {#spostare}

Puoi spostare un gruppo intero, un'intera categoria o una sola risorsa.

- *Trascina una scheda* su un'altra colonna, o su un servizio della barra
  **Servizi:**: si spostano tutte le sue risorse.
- *Trascina una categoria*: dopo aver aperto la scheda, trascina l'intestazione
  (**Trascina tutti i volontari**, **Trascina tutti i mezzi**, **Trascina tutti i
  materiali**) per spostare solo quelle.
- *Trascina una riga* per spostare una sola risorsa.
- **Cambia servizio** (l'icona sulla scheda o sulla riga) apre una finestra con
  **Nuovo servizio**. Su una scheda c'è anche **Tipi di risorsa da spostare**:
  scegli volontari, mezzi e materiali che vuoi spostare. Poi **Conferma**.
  Senza almeno un tipo vedi **Seleziona almeno un tipo di risorsa.**

Quando trascini, i servizi che non hanno ancora risorse compaiono nella barra
come possibili destinazioni. Fuori dal trascinamento stanno dietro il pulsante
**+N**: premilo per vederli (**Mostra servizi non assegnati**) o nasconderli
(**Nascondi servizi non assegnati**).

Mentre il kanban salva vedi **Caricamento risorse…**. Gli spostamenti già
riusciti prima di un errore restano validi.

## Cambiare squadra {#squadra}

**Cambia squadra** apre la finestra **Nuova squadra**: scegli un nome fra quelli
esistenti o scrivine uno nuovo (*Seleziona o digita una nuova squadra…*), poi i
**Tipi di risorsa da spostare** e **Conferma**. Con nessuna squadra esistente vedi
**Nessuna squadra esistente — digita il nome della nuova squadra.**

## Cercare e filtrare {#filtri}

- Il campo di ricerca (*Cerca gruppo, risorsa, servizio…*) filtra le schede mentre
  scrivi; la ✕ lo svuota.
- **Tutte le province** e **Tutte le organizzazioni** restringono il kanban; i
  menu compaiono solo se c'è più di un valore.
- Con un filtro attivo compare una striscia gialla: **Filtro attivo:** con i
  valori scelti e «stai vedendo X di Y». **Rimuovi filtri** (la ✕) li toglie.
- **Aggiorna** rilegge i dati. Le frecce accanto scorrono le colonne se non ci
  stanno tutte.

## Squadre dichiarate sul kanban {#squadre-dichiarate}

Le squadre note solo per numeri (senza nominativi) compaiono come schede con i
loro numeri dichiarati, l'organizzazione e la disponibilità. Una scheda senza
numeri dice *nessuna consistenza*. I totali di colonna le contano.

Se sposti una squadra su un **intervento** (un servizio che è anche una scheda di
Gestione interventi), la squadra viene aggiunta alle *squadre attivate*
dell'intervento e le sue organizzazioni alle *organizzazioni attivate*. Non si
toglie mai nulla: se poi la squadra se ne va, l'intervento conserva la storia di
chi ha lavorato. Spostarla su un servizio che non è un intervento, su *IN ATTESA
DI SERVIZIO* o su *USCITA DEFINITIVA* non aggiorna nessuna scheda.

Se l'aggiornamento dell'intervento non riesce, lo spostamento resta valido e in
alto compare un avviso giallo che nomina squadra e intervento: aggiungila a mano
dalla scheda dell'intervento.

## Disponibilità nel tempo {#disponibilita}

Con **Disponibilità nel tempo** il kanban è sostituito da una linea temporale:
una riga per squadra, una barra per la sua finestra di disponibilità e una linea
**Adesso**. I colori dicono se la finestra è **Da iniziare**, **In corso** o
**Terminata**.

I pulsanti **Tutto**, **Settimana**, **3 giorni** e **Giorno** cambiano lo zoom.
Le squadre senza date, o con la fine prima dell'inizio, non si disegnano: stanno
in due elenchi sotto la griglia (**Senza finestra di disponibilità** e **Date
incoerenti**), e un clic su una squadra apre la sua scheda in una nuova
scheda del browser per impostare le date. Se nessuna squadra ha una finestra vedi
**Nessuna squadra ha indicato una finestra di disponibilità.**; senza squadre,
**Nessuna squadra dichiarata.**

## Lo storico {#storico}

Ogni spostamento viene registrato con data e ora, gruppo, risorsa, provenienza e
destinazione. Lo ritrovi nella scheda dati dei movimenti delle risorse.

## Se qualcosa non va {#problemi}

- Se i dati non si caricano vedi **Errore caricamento** e **Riprova**.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
