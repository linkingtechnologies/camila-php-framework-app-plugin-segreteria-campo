# Volontari per turno {#top}

Una tabella con i volontari preaccreditati, organizzazione per organizzazione, e il
servizio a cui ciascuno è assegnato in ogni turno. Si apre da **Volontari per turno** nella
pagina [Preaccreditamenti](guide:dashboards/pre-accreditations). La pagina è di sola
lettura: le assegnazioni si cambiano nella scheda dei volontari preaccreditati.

I [Mezzi per turno](guide:dashboards/pre-accreditations-vehicles-by-service) e i
[Pernottamenti per turno](guide:dashboards/pre-accreditations-by-overnight-stay) funzionano
nello stesso modo.

## Tutti i turni, o un turno solo {#turni}

Sotto il titolo c'è una fila di pulsanti: **Riepilogo per turno** e uno per ogni turno
presente nei dati. Il pulsante del turno scelto è in evidenza.

- *Riepilogo per turno* (il titolo è «Volontari preaccreditati per turno»): una riga per
  volontario, con organizzazione, codice fiscale, cognome e nome, e una colonna per ogni
  turno che riporta il servizio assegnato in quel turno.
- *Un turno scelto*: la tabella si restringe ai volontari di quel turno e aggiunge la
  colonna *REGISTRAZIONE*, che dice **REGISTRATO** se il volontario risulta già nella
  tabella dei volontari (stesso codice fiscale, quindi ha fatto il check-in) oppure
  **Non registrato**; e una colonna con il servizio.

Se nei dati non c'è nessun turno vedi **Nessuna turnazione rilevata**.

## Sotto la tabella {#sotto}

Sotto ci sono tre gruppi di pulsanti, uguali in tutte le pagine dei pivot:

- **Modulistica**: **Elenco complessivo** e un pulsante *Turno N* per ogni turno. Producono
  il PDF filtrato sul turno scelto, per volontari, mezzi e materiali preaccreditati;
- **Pernottamenti**: **Riepilogo per turno** e un pulsante per turno, che aprono il pivot dei
  [pernottamenti](guide:dashboards/pre-accreditations-by-overnight-stay);
- **Elenchi**: gli elenchi grezzi, **Elenco complessivo** e uno per turno, per volontari
  e per mezzi. Sono le liste standard delle schede, con i filtri e le stampe di
  tutte le altre.

I turni sono letti dai dati dei volontari preaccreditati: un turno compare solo se c'è
almeno un volontario con quel turno.
