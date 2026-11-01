# Riepilogo preaccreditamenti {#top}

Quante risorse sono attese, per organizzazione, e quante sono già arrivate. È di
sola lettura: non modifica nessun dato. Si apre da *Accreditamento risorse →
Riepilogo preaccreditamenti*, oppure dalla pagina d'ingresso del tab
*PREACCREDITAMENTI*.

Lavora sui dati dei preaccreditati (volontari, mezzi e materiali attesi) e, solo
nella vista **Confronto**, li mette a confronto con chi è già stato registrato con
il check-in.

## I filtri {#filtri}

In alto trovi i filtri: sono pulsanti rotondi, e puoi sceglierne più di uno per
gruppo. Un filtro attivo è colorato; **Tutti** (o **Tutte**) toglie la scelta di
quel gruppo. Compaiono solo i gruppi per cui nei dati c'è almeno un valore.

- **Turni**, **Provincia** e **Servizi**: restringono tutte le risorse.
- **Intolleranze**, **Benefici di legge**, **Cena**, **Pranzo** e **Pernottamento**
  riguardano solo i volontari: scegliendone uno, mezzi e materiali spariscono dal
  riepilogo.

Fra i valori di un gruppo si combinano con «oppure»; fra gruppi diversi con
«e».

## I contatori {#contatori}

Sotto i filtri vedi quanti sono, con le scelte attuali: **organizzazioni**,
**volontari**, **mezzi** e **materiali**. Quando in un elenco la stessa persona (o
lo stesso mezzo) compare più volte, sotto il totale vedi quanti sono **unici**.

Il campo **Cerca organizzazione…** restringe le organizzazioni per nome, e il
pulsante **Ricarica** rilegge i dati.

## Tre viste {#viste}

I tre pulsanti accanto alla ricerca cambiano il modo di leggere gli stessi dati.

### Riepilogo {#riepilogo}

**Riepilogo** è una tabella con una riga per organizzazione: **Organizzazione**
(con il suo codice), **Prov**, **Vol**, **Mezzi** e **Mat**. In fondo la riga dei
totali, **Totale** con il numero di organizzazioni.

### Dettaglio {#dettaglio}

**Dettaglio** mostra una scheda per organizzazione; un clic la apre e vedi i
nominativi.

- Volontari: **Nominativo**, **Mansione**, **Turno**, **Servizio**, **Pranzo**,
  **Cena**, **Pernott.**, **Benefici** e **Intolleranze**.
- Mezzi e materiali: l'identificativo, la categoria e il turno.

Puoi aprire più schede insieme.

### Confronto {#confronto}

**Confronto** dice, per ogni preaccreditato, se è già arrivato. Le informazioni
vengono dalle registrazioni del check-in (volontari, mezzi e materiali).

- Ogni organizzazione mostra, per volontari, mezzi e materiali, quanti sono
  arrivati su quanti attesi (per esempio «3/8»).
- Aprendola, accanto a ogni risorsa vedi una spunta verde se è arrivata e una
  croce rossa se non lo è ancora.
- In fondo alla lista, con un'icona di avviso, trovi chi risulta registrato per
  quell'organizzazione ma non era preaccreditato (**non preaccreditato**). Un
  riquadro in alto ti dice quanti sono in tutto
  (**non preaccreditati presenti in DB**).

Se le registrazioni non si caricano vedi **Errore caricamento dati operativi.**

## Stampare il modulo di un turno {#stampa}

Accanto a ogni turno, fra i filtri, c'è un'icona di stampante (**Stampa modulo**
seguito dal nome del turno): apre in una nuova scheda il modulo da stampare
dei volontari, dei mezzi e dei materiali di quel turno.

## Se qualcosa non va {#problemi}

- Se i dati non si caricano vedi **Errore durante il caricamento dei dati.** con
  **Riprova**. Con nessun risultato vedi **Nessuna organizzazione trovata.**
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.

## Non confonderlo con le altre pagine {#altre-pagine}

Il tab *PREACCREDITAMENTI* ha anche tre pagine sul servizio o sul pernottamento
assegnato ai preaccreditati, ciascuna per turno: [Volontari per
turno](guide:dashboards/pre-accreditations-by-service), [Mezzi per
turno](guide:dashboards/pre-accreditations-vehicles-by-service) e [Pernottamenti per
turno](guide:dashboards/pre-accreditations-by-overnight-stay). Rispondono a «chi fa cosa
e quando», e da lì si stampano i moduli di accreditamento complessivi e per turno.
Questo riepilogo risponde invece a «quanti ne aspetto, e quanti sono già arrivati».
