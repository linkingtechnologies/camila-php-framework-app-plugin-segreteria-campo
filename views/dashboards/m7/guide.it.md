# Mappe servizi e GeoTracker {#top}

Una pagina di collegamenti alle mappe dei servizi e al GeoTracker, il servizio che
mostra sulla mappa la posizione dei telefoni delle squadre. Non c'è un pulsante nella
pagina iniziale: si apre scrivendo l'indirizzo `?dashboard=m7` dopo quello
dell'applicazione. Per le mappe di ogni giorno usa le [Mappe](guide:map-center).

## Le mappe dei servizi {#mappe}

Sotto **Mappe**:

- **Mappa servizi (OpenStreetMap)**: la [mappa dei servizi](guide:dashboards/12) con le
  carte di OpenStreetMap;
- **Mappa servizi (locale)**: la [versione che funziona senza
  Internet](guide:dashboards/12l);
- **Mappa servizi (Google Maps)**: la versione con Google non è più supportata; usa le
  mappe qui sopra.

## Il GeoTracker {#geotracker}

Se in [Informazioni intervento](guide:dashboards/05) è indicato l'*Host geotracker*
compaiono i pulsanti **GeoTracker (Google Maps)** e **GeoTracker (OpenStreetMap)**, che
aprono in una nuova scheda le mappe del GeoTracker, un'applicazione separata sul server
indicato.

Se è indicato anche l'*URL geotracker*, la pagina mostra l'indirizzo e un *codice QR*: si
inquadra con l'app OwnTracks del telefono per configurarla in un colpo solo, con quell'indirizzo
e un nome di dispositivo di due lettere scelto a caso. Ogni volta che la pagina si apre il
codice cambia, quindi per ogni telefono si apre la pagina e si inquadra il codice
mostrato in quel momento.

## Lo stato della configurazione {#stato}

In fondo la pagina dice cosa è configurato: **URL GeoTracker configurato!** oppure l'avviso
*URL GeoTracker non configurato!*; **Chiave per mappa Google configurata!** oppure *Chiave
per mappa Google non configurata!*; **Host GeoTracker configurato!** oppure *Host
GeoTracker non configurato!*. Si correggono in [Informazioni
intervento](guide:dashboards/05).
