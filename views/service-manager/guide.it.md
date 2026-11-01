# Servizi {#top}

L'elenco dei servizi a cui si assegnano volontari, mezzi e materiali: cucina,
segreteria, campo base e così via. Qui li crei, li modifichi, li riordini, dai a
ciascuno un colore, una lettera e una posizione sulla mappa. Si apre da
*Anagrafiche → Servizi*.

I servizi compaiono nei menu di check-in, check-out, movimentazione e mappe, e
ogni colonna della lavagna di Movimentazione risorse è uno di essi.

## La lista {#lista}

A sinistra c'è l'elenco, a destra la scheda del servizio scelto. Un clic su un
servizio lo apre; con nessun servizio scelto vedi **Seleziona un servizio dalla
lista** oppure creane uno nuovo.

- **Cerca…** filtra l'elenco; senza risultati vedi **Nessun risultato**, con
  l'elenco vuoto **Nessun servizio**.
- **Nuovo servizio** (il pulsante con il «+») apre la scheda vuota, **Aggiorna**
  rilegge l'elenco.
- Il pulsante **Solo servizi** / **Con interventi** decide se vedere anche gli
  interventi sul territorio. Per default sono nascosti: si gestiscono in
  [Gestione interventi](guide:intervention-manager) e qui compaiono solo se li
  chiedi.
- **Strumenti** apre il menu degli strumenti massivi (vedi sotto).

Ogni riga ha un pallino con il colore del servizio, il nome e il numero d'ordine.
Se non ha una posizione vedi un segno di mappa grigio (**Coordinate non
impostate**). Con modifiche non salvate sul servizio aperto, accanto al nome c'è
un pallino arancione (**Modifiche non salvate**).

**Riordinare**: *trascina* una riga con la maniglia (**Trascina per
riordinare**) nella nuova posizione. L'ordine è quello con cui i servizi compaiono
nei menu.

## I servizi obbligatori {#obbligatori}

*IN ATTESA DI SERVIZIO* e *USCITA DEFINITIVA* servono al funzionamento del
programma. Sono marcati **protetto**: non si eliminano, non si riordinano e il nome
non si cambia.

## La scheda {#scheda}

Premendo **Nuovo servizio** compili:

- **Nome**: obbligatorio (**Il campo Nome è obbligatorio.**). Le risorse vi fanno
  riferimento per nome.
- **Ordine**: il numero con cui si ordina l'elenco.
- **Intervento**: vuoto, **SI** oppure **NO**. **SI** lo fa gestire come intervento
  sul territorio, **NO** dice che non lo è.
- **Colore** e **Lettera**: il colore e la lettera del segno sulla mappa.
- **Descrizione**, **Inizio** e **Fine** (data e ora), **Operatori a supporto** e
  **Note**.
- **Posizione**: vedi sotto.

**Crea servizio** lo registra (**Servizio creato.**); su un servizio esistente il
pulsante è **Salva modifiche** (**Servizio aggiornato.**). Passando a un altro
servizio con modifiche in sospeso compare **Hai modifiche non salvate. Vuoi
scartarle e continuare?** con **Scarta e continua** e **Rimani qui**.

Altri pulsanti sulla scheda di un servizio esistente:

- **Clona** crea una copia, «nome (copia)», con l'ordine dopo l'ultimo: **Servizio
  clonato — modifica il nome e salva.** Non c'è sui servizi protetti (*IN ATTESA DI SERVIZIO* e
  *USCITA DEFINITIVA*): non si clonano.
- **Nuovo** apre una scheda vuota.
- **Elimina**: vedi sotto.

## La posizione {#posizione}

La **Posizione** si compila a mano (**Indirizzo**, **Comune**, **Provincia**,
**Latitudine**, **Longitudine**) oppure con **Scegli sulla mappa**: cerchi un
indirizzo o clicchi sul punto, e comune, provincia e indirizzo si compilano da
soli. Il servizio compare così sulle mappe.

Per dare a un servizio la posizione di un altro:

1. sul primo apri **Copia coordinate** e scegli **Solo coordinate** oppure
   **Coordinate + indirizzo**;
2. apri l'altro servizio e premi **Incolla**: il pulsante mostra le coordinate
   copiate.

## Eliminare un servizio {#elimina}

**Elimina** controlla prima se volontari, mezzi o materiali sono assegnati a quel
servizio (**Verifica…**).

- Se lo sono vedi **Non eliminabile** con quante risorse lo usano, per categoria:
  non si elimina. Prima spostale con Movimentazione risorse.
- Altrimenti chiede conferma (**Nessuna risorsa assegnata. Confermi
  l'eliminazione?**): **Sì, elimina** o **Annulla**.

Se il controllo non riesce vedi **Impossibile verificare l'utilizzo del servizio —
procedi con cautela.**

## Gli strumenti {#strumenti}

Il menu **Strumenti** ha quattro voci. Dopo ognuna vedi l'esito sopra l'elenco.

- **Importa servizi da preaccreditati**: aggiunge i servizi usati nei volontari,
  mezzi e materiali preaccreditati e non ancora in elenco.
- **Inserisci servizi obbligatori**: aggiunge *IN ATTESA DI SERVIZIO* e *USCITA
  DEFINITIVA* se mancano.
- **Importa servizi da accreditati**: come la prima, ma dai volontari, mezzi e
  materiali già registrati con il check-in.
- **Elimina tutti i servizi non obbligatori**: chiede conferma (**Eliminare tutti i
  servizi tranne quelli obbligatori? L'operazione è irreversibile.**) e li elimina
  tutti salvo i due obbligatori.

L'esito dice **Inseriti:** seguito dai nomi, **Nessun nuovo elemento inserito.**,
quanti erano **già presenti**, oppure **Eliminati** con il numero e **Nessun
servizio da eliminare.**

## Se qualcosa non va {#problemi}

- Se i servizi non si caricano vedi **Errore caricamento** con **Riprova**.
- Se il salvataggio non riesce vedi il messaggio sopra la scheda.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
