# Squadre dichiarate {#top}

Le squadre registrate come risorsa **aggregata**: sai da quali organizzazioni
vengono, quante persone e quanti mezzi portano, ma non (o non ancora) i nominativi.
Serve nelle emergenze lampo, per le squadre che lavorano da remoto, quando gli
elenchi arrivano giorni dopo o mai. Si apre da *Anagrafiche → Squadre dichiarate*.

*Una regola da ricordare: o l'aggregato o il dettaglio.* Se le stesse persone
sono registrate sia come squadra dichiarata sia come volontari singoli, ogni
riepilogo le conta due volte. Il programma non lo impedisce: decide
l'organizzazione.

Le squadre dichiarate non passano dal check-in e dal check-out. Dove si trovano lo
dice la Movimentazione risorse (vedi [Movimentazione
risorse](guide:resource-board)), non questa pagina.

## L'elenco {#elenco}

A sinistra c'è l'elenco, a destra la scheda della squadra scelta. Un clic su una
squadra la apre; con nessuna squadra scelta vedi **Seleziona una squadra
dall'elenco.**

- **Cerca…** filtra per nome, organizzazioni, referente, servizio e mansione
  prevalente.
- **Nuova squadra** apre la finestra di creazione.
- **Ricarica** rilegge i dati.
- Sopra l'elenco vedi i totali delle squadre visibili: quante sono, quanti
  volontari e mezzi sono **dichiarati**, quanti **registrati** (cioè con i nominativi)
  e, se mancano, quanti nominativi.

Ogni riga mostra il nome, le organizzazioni, i numeri dichiarati e il servizio in
cui si trova la squadra; un'etichetta dice a che punto è il confronto con i
nominativi: *nessun nominativo*, *N/M nominativi* oppure *nominativi completi*.
Senza squadre vedi **Nessuna squadra registrata.**, con una ricerca che non
trova nulla **Nessun risultato.**

## Registrare una nuova squadra {#nuova}

1. Premi **Nuova squadra**: si apre **Nuova squadra dichiarata**.
2. Scrivi il **Nome squadra** (obbligatorio: è il valore con cui la squadra viene
   riconosciuta altrove) e scegli le **Organizzazioni** da cui proviene.
3. Indica **N. volontari** e **N. mezzi**.
4. Premi **Crea**.

Si apre la scheda completa, dove continui con la mansione, il referente, le
attrezzature e le note. **Annulla**, la ✕ o un clic fuori dalla finestra chiudono
senza salvare. Se esiste già una squadra con quel nome il programma avvisa e ti
lascia procedere.

## La scheda {#scheda}

La scheda è divisa in blocchi:

- **Squadra**: il **Nome** e la **Mansione prevalente**.
- **Disponibilità**: **Inizio** e **Fine** (data e ora). Non sono le date di arrivo,
  ma la finestra in cui la squadra si è dichiarata disponibile.
- **Provenienza**: le organizzazioni da cui viene.
- **Consistenza**: **N. volontari** e **N. mezzi** dichiarati. Sotto, una tabella
  confronta i **Dichiarati** con i **Registrati**, cioè le risorse che portano il
  nome della squadra nel campo squadra, e dice quanti mancano. Le
  **Attrezzature** sono un testo libero (per esempio «2 motopompe, 1 gruppo
  elettrogeno»), non un conteggio.
- **Referente**: **Cognome**, **Nome** e **Cellulare**.
- **Note**.

**Salva** è attivo solo se ci sono modifiche (compare **Modifiche non
salvate**), poi vedi **Modifiche salvate.** Passando a un'altra squadra con
modifiche in sospeso il programma chiede conferma (**Ci sono modifiche non
salvate. Scartarle?**). **Nuova** apre una finestra di creazione.

Se non hai i permessi per modificare compare **Sola lettura**.

### Rinominare una squadra {#rinominare}

Il nome è il riferimento fra le squadre e le risorse. Se lo cambi, il programma
avvisa: le risorse che la referenziano continueranno a puntare al nome precedente
e non verranno aggiornate.

## Eliminare una squadra {#elimina}

**Elimina** controlla prima se volontari, mezzi o materiali portano il nome della
squadra (**Verifica risorse collegate…**).

- Se ce ne sono vedi **Non eliminabile** con quante risorse la usano, per
  categoria: non si elimina.
- Altrimenti chiede conferma (**Nessuna risorsa collegata. Confermi?**): **Sì,
  elimina** o **Annulla**.

Se il controllo non riesce l'eliminazione resta bloccata per sicurezza.

## Se qualcosa non va {#problemi}

- Se le squadre non si caricano vedi un messaggio con **Riprova** e **Dettagli
  tecnici**.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
