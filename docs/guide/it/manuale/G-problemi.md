# G. Problemi frequenti {#top}

## Il programma dice che la sessione non è più valida {#sessione}

È il caso più frequente, e *non è un guasto*: succede quando lo stesso utente è entrato da un altro
browser o dispositivo. Il programma ricorda una sola sessione per utente, e l'ultimo accesso toglie il
posto agli altri.

Cosa fare: *ricaricare la pagina non basta*. Premi **Esci e rientra** (compare nel riquadro giallo)
e accedi di nuovo. Attenzione: rientrando con lo stesso utente metti fuori l'altra postazione, che poi
rientrerà a sua volta e ti metterà fuori. Per non rimbalzare usa *un utente per postazione*
([Accedere](guide:manuale/02-primi-passi#accesso)).

*Permessi insufficienti per questa operazione* è invece un'altra cosa: l'utente non ha il permesso
per quell'azione.

## Una risorsa non compare dove me l'aspetto {#risorsa-assente}

- Controlla lo [Stato registrazione](guide:org-status) dell'organizzazione: dice se la risorsa risulta
  in servizio o no.
- Le [Mappe](guide:map-center) mostrano solo le risorse *in servizio*: una risorsa in USCITA DEFINITIVA non
  compare.
- Se è stata registrata con il nome dell'organizzazione scritto in modo diverso, compare come
  un'altra organizzazione. Per i mezzi lo segnala il [Controllo dati](guide:dashboards/ic1)
  (*Nome organizzazione mezzi registrati*).

## Gli attestati sono vuoti o mancano {#attestati}

[Attestati volontari](guide:dashboards/27) e [mezzi](guide:dashboards/28) mostrano solo le risorse in
USCITA DEFINITIVA, quindi dopo il [Check-out massivo](guide:massive-check-out). Se l'elenco è vuoto
vedi *Nessun dato disponibile!*.

## Le mappe non mostrano le carte {#mappe}

Le carte geografiche arrivano da servizi su Internet: senza connessione lo sfondo resta grigio. La
[Mappa servizi (locale)](guide:dashboards/12l) funziona anche senza Internet.

## Il badge non si legge {#badge}

Controlla che nelle opzioni di stampa del browser *non ci sia nessun ridimensionamento della
pagina*: un ridimensionamento può rendere illeggibile il codice a barre.

## Un messaggio d'errore rosso {#errore}

Se una pagina mostra un riquadro rosso con un messaggio tecnico, prova a ricaricare la pagina. Se
l'errore continua, segna il testo del messaggio e avvisa chi amministra il sistema. Nelle pagine che
caricano elenchi compare il pulsante **Riprova**.

## Dati strani o incoerenti {#dati}

Lancia il [Controllo dati](guide:dashboards/ic1), che cerca gli errori più comuni, e guarda i
[Report](guide:dashboards/m1). Per correggere righe singole usa le [schede
dati](guide:manuale/A-schede-dati).
