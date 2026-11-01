# Magazzini {#top}

I magazzini dei materiali di consumo (sacchi di sabbia, acqua, pasti…): qui li
crei, li modifichi, li riordini e dai a ciascuno una posizione sulla mappa. Si
apre da *Anagrafiche → Magazzini*.

I magazzini sono i punti fra cui si spostano i consumabili: li usa la
[Movimentazione consumabili](guide:stock-manager) per caricare, scaricare e
trasferire, e compaiono sulla scheda *Consumabili* delle mappe.

## La lista {#lista}

A sinistra c'è l'elenco, a destra la scheda del magazzino scelto. Un clic su un
magazzino lo apre; con nessun magazzino scelto vedi **Seleziona un magazzino dalla
lista** oppure creane uno nuovo.

- **Cerca…** filtra l'elenco; senza risultati vedi **Nessun risultato**, con
  l'elenco vuoto **Nessun magazzino**.
- **Nuovo magazzino** (il pulsante con il «+») apre la scheda vuota, **Aggiorna**
  rilegge l'elenco.

Ogni riga ha un pallino con il colore, il nome e il numero d'ordine. Se non ha una
posizione vedi un segno di mappa grigio (**Coordinate non impostate**); con
modifiche non salvate, un pallino arancione (**Modifiche non salvate**).

**Riordinare**: *trascina* una riga con la maniglia (**Trascina per
riordinare**). L'ordine è quello dei menu.

## La scheda {#scheda}

Compili:

- **Nome**: obbligatorio (**Il campo Nome è obbligatorio.**). Le movimentazioni vi
  fanno riferimento per nome.
- **Ordine**, **Colore** e **Lettera**: come compare il magazzino nelle liste e
  nel segno sulla mappa.
- **Descrizione**, **Operatori a supporto** e **Note**.
- **Posizione**: vedi sotto.

**Crea magazzino** lo registra (**Magazzino creato.**); su un magazzino esistente
il pulsante è **Salva modifiche** (**Magazzino aggiornato.**). Passando a un altro
magazzino con modifiche in sospeso compare **Hai modifiche non salvate. Vuoi
scartarle e continuare?** con **Scarta e continua** e **Rimani qui**.

Altri pulsanti su un magazzino esistente:

- **Clona** crea una copia, «nome (copia)», con l'ordine dopo l'ultimo: **Magazzino
  clonato — modifica il nome e salva.**
- **Nuovo** apre una scheda vuota.
- **Elimina**: vedi sotto.

## La posizione {#posizione}

La **Posizione** si compila a mano (**Indirizzo**, **Comune**, **Provincia**,
**Latitudine**, **Longitudine**) oppure con **Scegli sulla mappa**, che apre
**Seleziona posizione**:

1. scrivi un indirizzo in *Ricerca indirizzo…* (per esempio «Via Roma 1, Milano») e
   premi **Cerca indirizzo**, oppure clicca direttamente sulla mappa e, se serve,
   trascina il segno per affinare il punto;
2. a lato vedi **Lat:**, **Lon:**, **Comune:**, **Prov.:** e **Indirizzo:** del
   punto scelto; finché non c'è un punto vedi **Nessuna posizione selezionata**;
3. **Conferma posizione** copia i valori nella scheda, **Annulla** chiude senza
   salvare.

Per dare a un magazzino la posizione di un altro, apri **Copia coordinate** e
scegli **Solo coordinate** oppure **Coordinate + indirizzo**; poi apri l'altro
magazzino e premi **Incolla**.

## Eliminare un magazzino {#elimina}

**Elimina** controlla prima se il magazzino è usato in qualche movimentazione di
consumabili, come origine o come destinazione (**Verifica…**).

- Se lo è vedi **Non eliminabile** con il numero di movimentazioni: non si
  elimina, perché lo storico perderebbe il riferimento.
- Altrimenti chiede conferma (**Nessuna movimentazione associata. Confermi
  l'eliminazione?**): **Sì, elimina** o **Annulla**.

Se il controllo non riesce vedi **Impossibile verificare l'utilizzo del magazzino —
procedi con cautela.**

## Se qualcosa non va {#problemi}

- Se i magazzini non si caricano vedi **Errore caricamento** con **Riprova**.
- Se il salvataggio non riesce vedi il messaggio sopra la scheda.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
