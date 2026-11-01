# C. Moduli e integrazioni {#top}

*Argomento avanzato.* Segreteria Campo è il nucleo di un ecosistema di moduli che condividono lo
stesso patrimonio di dati ([Che cos'è Segreteria Campo](guide:manuale/01-capire#ecosistema)). Alcuni
sono pagine del programma, altri sono servizi separati. Questo capitolo dice cosa sono e dove
trovarne le istruzioni.

## C.1 Portale dei preaccreditamenti {#portale}

Un portale web separato con cui le organizzazioni preaccreditano volontari, mezzi e attrezzature
partendo dai propri database. I dati preaccreditati arrivano poi in Segreteria Campo e si controllano
nel tab **PREACCREDITAMENTI** ([Preaccreditamenti](guide:manuale/03-preparare#preaccreditamenti)).

## C.2 Area riservata alle organizzazioni {#area-organizzazioni}

Un'area web per le organizzazioni, dove condividere informazioni, preaccreditamenti e censimenti.

## C.3 Geotracking {#geotracking}

Un modulo *sperimentale* per localizzare e monitorare le squadre sul territorio con un'app
installata sullo smartphone (OwnTracks). La pagina [Mappe servizi e
GeoTracker](guide:dashboards/m7) mostra lo stato della configurazione e il codice QR con cui si
configura il telefono; i dati si impostano in [Informazioni intervento](guide:dashboards/05)
(*Host geotracker*, *URL geotracker*, *Chiave mappa google*). Le mappe del GeoTracker sono su un
servizio separato.

## C.4 Radio e messaggi {#radio}

Un'integrazione riceve in tempo reale i messaggi della radio e di Telegram e li mostra in
[Comunicazioni live](guide:comms-feed). Funziona tramite i servizi di rete del programma, che
accettano i messaggi da fuori con una propria autenticazione. La configurazione è compito
dell'amministratore.

## C.5 Totem {#totem}

Postazioni dedicate in cui le persone registrano da sole arrivo e partenza. Usano le stesse pagine
del Check-in e del Check-out con una modalità semplificata; per le istruzioni vedi
[Registrazione in autonomia](guide:manuale/04-accreditare#totem). È in sperimentazione.

## C.6 Interfaccia per altri programmi (API) {#api}

Tutte le pagine del programma leggono e scrivono i dati attraverso un'interfaccia di programma
(API). È la stessa che i moduli sopra usano per condividere i dati. Per chi sviluppa è descritta nei
repository del progetto ([Installazione e architettura](guide:manuale/D-installazione#risorse)).
