# 5. Gestire l'operatività {#top}

Registrate le risorse, comincia il lavoro vero: assegnarle ai servizi, seguirne gli spostamenti,
rispondere alle richieste, tenere d'occhio la situazione. Queste sono le pagine che si usano di più
in evento, e infatti stanno nei primi riquadri della pagina iniziale.

## 5.1 Assegnare e spostare le risorse {#risorse}

La [Movimentazione risorse](guide:resource-board) è il quadro d'insieme di tutte le risorse presenti
(volontari, mezzi, materiali): una tavola a colonne, una per servizio. Per assegnare o spostare si
trascina una scheda (un'organizzazione o una squadra) da una colonna all'altra, oppure si usano i
comandi **Cambia servizio** e **Cambia squadra** per operare su più risorse insieme.

Cose da sapere:

- appena registrate, tutte le risorse stanno in **IN ATTESA DI SERVIZIO**, che è sempre la prima
  colonna;
- ogni spostamento viene *registrato automaticamente* con data e ora (chi, da quale servizio a
  quale): è lo storico che permette di ricostruire la «vita operativa» di una risorsa, consultabile
  nella scheda *Mov. risorse* ([Le schede dati](guide:manuale/A-schede-dati));
- l'ordine in cui i servizi compaiono nelle tendine lo decide il loro campo *Ordine*
  ([Servizi](guide:service-manager));
- se un servizio ha le coordinate GPS, compare sulle [mappe](guide:manuale/05-gestire#mappe).

Le squadre dichiarate hanno una loro lavagna nella stessa pagina, perché si assegnano agli stessi
servizi ([Squadre dichiarate](guide:team-manager)).

## 5.2 Gli interventi {#interventi}

La [Gestione interventi](guide:intervention-manager) tiene le schede degli interventi sul territorio,
la versione digitale del modulo cartaceo: la segnalazione, chi ha segnalato, dove e quando, il
sopralluogo, le squadre attivate e la cronologia, fino alla chiusura con inizio e fine. Il nome di un
intervento diventa un *servizio* a cui si assegnano le risorse. Da qui si crea al volo una nota di
brogliaccio, una richiesta o una squadra dichiarata, che poi si gestiscono nelle loro pagine.

## 5.3 Le richieste {#richieste}

Le [Richieste](guide:requests-board) raccolgono qualsiasi richiesta di risorse, di materiali o di
documenti, interna o esterna. Stanno su una lavagna a colonne, una per stato: una richiesta cambia
stato quando la si sposta da una colonna all'altra. Le valuta il responsabile dell'evento.

## 5.4 Consumabili e magazzini {#consumabili}

La [Movimentazione consumabili](guide:stock-manager) tiene traccia di acqua, sabbia, pasti e simili:
carichi, scarichi e trasferimenti fra magazzini, con le giacenze di ogni magazzino e servizio. I
magazzini si definiscono prima ([Servizi e magazzini](guide:manuale/03-preparare#servizi)).

## 5.5 Le mappe {#mappe}

Le [Mappe](guide:map-center) mostrano sul territorio dove si trovano le risorse assegnate ai servizi,
le scorte nei magazzini e la sede delle organizzazioni; con **Modifica** si posizionano i servizi
trascinandoli. È la pagina da usare di norma.

Esistono anche le mappe più semplici di una versione precedente, che si aprono dall'indirizzo
`?dashboard=m7` ([Mappe servizi e GeoTracker](guide:dashboards/m7)); una funziona anche senza Internet
([Mappa servizi locale](guide:dashboards/12l)).

## 5.6 Comunicazioni live {#comunicazioni}

[Comunicazioni live](guide:comms-feed) è lo schermo per la sala operativa: i messaggi digitali in
arrivo (per esempio da Telegram o dalla radio) accanto alla mappa dei servizi e alle risorse
attive. Si aggiorna da solo.

## 5.7 Guardare la situazione {#situazione}

Per avere il quadro a colpo d'occhio:

- i [Report](guide:dashboards/m1) (**Report situazione attuale**) con tabelle e grafici, che si
  aggiornano da soli;
- lo [Stato registrazione](guide:org-status) per una singola organizzazione;
- il [Riepilogo ospiti e risorse](guide:dashboards/01), un elenco di contatori.

## 5.8 L'assistente intelligente {#assistente}

In cima alla pagina iniziale, l'[assistente](guide:smart-assistant) segnala quando manca qualcosa di
essenziale: nessun servizio, evento non configurato, brogliaccio fermo da più di due ore. Se non
c'è nulla da segnalare non compare, e la pagina resta pulita.
