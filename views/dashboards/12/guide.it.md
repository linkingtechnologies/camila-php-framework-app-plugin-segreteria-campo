# Mappa servizi {#top}

Una mappa che mostra dove si trovano i servizi e quante risorse hanno. È la versione
precedente delle [Mappe](guide:map-center), più semplice: sola lettura, senza gli altri
livelli (consumabili, organizzazioni) e senza la possibilità di spostare i segni.

Non c'è un pulsante nella pagina iniziale: la pagina si apre dalla pagina
[Mappe servizi e GeoTracker](guide:dashboards/m7) o scrivendo l'indirizzo
`?dashboard=12` dopo quello dell'applicazione. Per l'uso di ogni giorno usa le
[Mappe](guide:map-center).

La pagina esiste in due versioni, a seconda del pulsante: **Mappa servizi
(OpenStreetMap)** e **Mappa servizi (Google Maps)**. Quest'ultima compare solo se è
stata configurata la chiave di Google in
[Informazioni intervento](guide:dashboards/05), e [DA VERIFICARE]: in questa
installazione manca il file del modello per la versione Google, quindi potrebbe non
aprirsi. Qui si descrive quella OpenStreetMap, la sola completa.

Servono la connessione a Internet (le carte arrivano da servizi esterni) e servizi con
latitudine e longitudine: gli altri non compaiono. Le coordinate si danno dalla [scheda
del servizio](guide:service-manager) o dalle [Mappe](guide:map-center).

## Il pannello a sinistra {#elenco}

In alto, il campo *Cerca…* filtra l'elenco mentre scrivi. Sotto, un riquadro per ogni
servizio, secondo il campo *Ordine* della scheda: il segno con colore e lettera, il nome, la descrizione,
il comune e i conteggi **Volontari** e **Mezzi** assegnati al servizio. Un clic sul nome
centra la mappa su quel servizio con lo zoom avanti.

I conteggi contano tutte le righe delle tabelle volontari e mezzi che hanno quel servizio,
senza guardare le date.

## La mappa {#mappa}

Sulla destra, la carta con un segno per ogni servizio. Un clic su un segno mostra il
nome e quanti **VOLONTARI** e **MEZZI** ci sono. Il selettore in alto a destra cambia lo
sfondo: **OpenStreetMap** o **Satellite**. All'apertura la mappa si adatta per
contenere tutti i servizi.

## Cercare un indirizzo {#indirizzo}

Sotto la mappa, il campo *Ricerca indirizzo e premi invio…* cerca un luogo e porta la
mappa lì. Le caselle *Latitudine* e *Longitudine* accanto mostrano le coordinate del
luogo trovato: servono solo a leggerle e copiarle, *non vengono salvate* da nessuna
parte.
