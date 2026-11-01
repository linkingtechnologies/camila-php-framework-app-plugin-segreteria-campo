# Mappe {#top}

Mostra su una mappa dove si trovano risorse, consumabili, servizi e organizzazioni,
e permette di posizionare i servizi trascinandoli. Si apre da *Monitoraggio → Mappe*.

Le quattro schede in alto sono **Risorse**, **Consumabili**, **Servizi** e
**Organizzazioni**. In ognuna c'è un pannello a sinistra con l'elenco e la mappa a
destra. Un clic su una voce dell'elenco centra la mappa su quel punto (**Centra sulla
mappa**) e apre il suo riquadro. Il pannello si chiude e si riapre con la linguetta al
bordo (**Chiudi pannello** e **Apri pannello**).

I comandi comuni stanno in alto a destra:

- **Auto-refresh** diventa **Live** con un conto alla rovescia: la mappa si ricarica
  ogni minuto. Premilo di nuovo per spegnerlo. Nella scheda *Servizi* non c'è, per
  non togliere di mezzo il punto che stai spostando.
- **Schermo intero** (e **Esci da schermo intero**) porta la mappa a tutto schermo.
- Il selettore sulla mappa cambia lo sfondo: **OpenStreetMap** o **Satellite**.

I servizi sono mostrati solo se hanno una posizione: per darla a quelli che non ce
l'hanno vedi [Servizi sulla mappa](#servizi) qui sotto, oppure la scheda di
[Servizi](guide:service-manager).

## Risorse {#risorse}

Dove si trovano le persone, i mezzi e i materiali *in servizio*: volontari, mezzi e
materiali registrati con il check-in e non ancora usciti. Il pannello elenca, per ogni
servizio, i conteggi di volontari, mezzi e materiali e il numero dei gruppi presenti.

Con **Raggruppamento** scegli come dividere le risorse dentro ogni servizio:
**Organizzazione** oppure **Squadra**. Sotto **Risorse per servizio** ogni servizio
mostra i gruppi con i loro conteggi. Sulla mappa, il riquadro del servizio ha la stessa
struttura: i gruppi si aprono e mostrano i nominativi dei volontari, le targhe dei mezzi
e i materiali.

Servizi senza risorse non compaiono nel pannello; un servizio sulla mappa senza
nessuna risorsa dice **Nessuna risorsa assegnata**.

### Le squadre dichiarate {#squadre}

Le [squadre dichiarate](guide:team-manager) non hanno i nominativi e non hanno una
posizione propria: quelle assegnate a un servizio compaiono nel riquadro del servizio
come una riga a parte, per esempio «2 squadre dichiarate · 8 vol. · 3 mezzi». Sono
conteggi dichiarati e **non** vengono sommati ai totali delle risorse registrate.

## Consumabili {#consumabili}

Dove sono i materiali di consumo. Il pannello **Giacenze** elenca, per ogni magazzino
(**MAG**) e per ogni servizio (**SRV**), gli articoli presenti con le quantità; un
valore negativo è rosso e indica un possibile errore di inserimento. Le giacenze sono
calcolate dalle movimentazioni, come nella scheda *Giacenze* della
[Movimentazione consumabili](guide:stock-manager). Senza dati vedi **Nessuna
giacenza.**

Sulla mappa, un clic su un magazzino o su un servizio apre le sue giacenze.

## Servizi sulla mappa {#servizi}

La scheda **Servizi** serve a posizionare i servizi e a scegliere come appaiono
sulla mappa. Il pannello elenca i servizi in due gruppi: **Senza posizione** e
**Posizionati**, ciascuno con il numero fra parentesi.

Per cambiare le posizioni premi **Modifica**: il pulsante diventa **Modifica attiva**
e compare l'avviso *Trascina i marker per spostare la posizione.* Premilo di nuovo per
uscire. Il pulsante con l'ingranaggio porta a [Servizi](guide:service-manager).

- *Dare una posizione a un servizio senza posizione*: nel pannello clicca il servizio
  (compare **Clicca sulla mappa per posizionare**), poi clicca il punto sulla mappa.
- *Spostare un servizio*: trascina il suo segno sulla mappa.

In entrambi i casi la posizione viene *salvata subito*, senza un pulsante di
conferma. Se il salvataggio non riesce vedi un messaggio rosso sopra il pannello,
chiudibile con la ✕.

Con **Modifica attiva**, un clic su un segno apre sopra l'elenco la scheda del
servizio, dove scegli il **Colore** e la **Lettera** del segno. **Salva** applica,
**Annulla** chiude senza salvare. Fuori dalla modifica, un clic sul segno mostra solo
il nome del servizio.

I servizi «IN ATTESA DI SERVIZIO» e «USCITA DEFINITIVA» non sono luoghi e non vengono
mostrati.

## Organizzazioni {#organizzazioni}

Dove hanno sede le organizzazioni, dal database delle organizzazioni. Il pannello
dice **N su mappa** e, se ce ne sono, quante sono **senza coordinate**: quelle non si
vedono sulla mappa e non sono nell'elenco. Ogni riga ha denominazione, comune e
provincia; il riquadro sulla mappa aggiunge tipologia, sezione, codice e indirizzo.

Le coordinate delle organizzazioni si impostano nel database organizzazioni, non da
qui.

## Se qualcosa non va {#problemi}

- Se i dati non si caricano vedi **Errore caricamento** con **Riprova**.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e rientra**.
  Ricaricare la pagina non basta.
- Se lo sfondo della mappa resta grigio controlla la connessione a Internet: le
  tessere della cartina arrivano da servizi esterni (OpenStreetMap).
