# Movimentazione consumabili {#top}

Tiene traccia dei materiali di consumo (sacchi di sabbia, acqua, pasti…): registri
cosa entra, cosa esce e cosa si sposta fra i magazzini, e vedi le giacenze di ogni
magazzino e di ogni servizio. Si apre da *Operatività → Movimentazione
consumabili*.

I magazzini si creano e si gestiscono in [Magazzini](guide:warehouse-manager).

Le tre schede in alto sono **Movimentazioni**, **Giacenze** e **Mappa**.

## Movimentazioni {#movimentazioni}

È l'elenco delle movimentazioni registrate, con le colonne **Data/Ora**, **Tipo**,
**Articolo**, **Qtà**, **U.M.**, **Da**, **A**, **Servizio**, **Operatore** e
**Note**. Se ce ne sono più di 50, compaiono i comandi di pagina; in fondo vedi
quante sono.

I tipi sono tre:

- **CARICO**: la merce entra in un magazzino;
- **SCARICO**: la merce esce da un magazzino;
- **TRASF.** (trasferimento): la merce passa da un magazzino a un altro.

Sopra l'elenco ci sono i filtri: **Cerca…** (con la ✕ per svuotarlo), **Tutti i
tipi**, **Tutti i magazzini** e **Tutti gli articoli**. Gli ultimi due compaiono
solo se ci sono magazzini e articoli. Con filtri che non trovano nulla vedi
**Nessun risultato per i filtri selezionati.**; senza movimentazioni
**Nessuna movimentazione registrata.** Il pulsante con le frecce rilegge i dati.

### Registrare una movimentazione {#nuova}

1. Premi **Nuova movimentazione**.
2. **Data/Ora** è già quella di adesso; puoi cambiarla.
3. Scegli il **Tipo**. Il tipo decide quali magazzini servono: con **CARICO** si
   compila solo **Magazzino destinazione**, con **SCARICO** solo **Magazzino
   origine**, con **TRASFERIMENTO** tutti e due.
4. Scrivi l'**Articolo** (il campo suggerisce gli articoli già usati), la
   **Quantità** (un numero maggiore di zero) e l'unità di misura **U.M.**.
5. Se serve indica il **Servizio** a cui è destinata la merce (facoltativo), l'
   **Operatore** e le **Note**.
6. Premi **Conferma**.

I campi con l'asterisco sono obbligatori. Se manca qualcosa vedi un messaggio:
**Seleziona il tipo di movimentazione.**, **Il campo Articolo è obbligatorio.**,
**La quantità deve essere un numero positivo.**, **Seleziona il magazzino di
origine.** o **Seleziona il magazzino di destinazione.**

### Correggere o eliminare {#correggere}

*Dipende dai permessi della scheda* (di norma solo gli amministratori): chi non puo' modificare non vede la matita, chi non puo' eliminare non vede il cestino. Su ogni riga la matita (**Modifica**) apre **Modifica movimentazione** con gli
stessi campi: poi **Salva modifiche**. Il cestino (**Elimina**) chiede conferma
nella striscia in alto: **Eliminare questa movimentazione?** con **Sì, elimina** o
**Annulla**.

Le giacenze si ricalcolano da tutte le movimentazioni: correggere o togliere una
riga le aggiorna.

## Giacenze {#giacenze}

La scheda **Giacenze** calcola quanto resta, per articolo, in due tabelle:

- **Per magazzino**: **CARICO** aggiunge al magazzino di destinazione, **SCARICO**
  toglie da quello di origine, un trasferimento toglie dall'origine e aggiunge
  alla destinazione.
- **Per servizio**: quanta merce hanno ricevuto i servizi. Uno scarico verso un
  servizio la aumenta, un carico che indica quel servizio la diminuisce (la merce
  rientra al magazzino).

Ogni riga ha il **Totale** per articolo. I valori negativi sono in rosso e
indicano un possibile errore di inserimento. In fondo vedi su quante
movimentazioni sono calcolate. Senza dati vedi **Nessuna movimentazione con
magazzino registrata.** o **Nessuna movimentazione con servizio associato.**

## Mappa {#mappa}

La scheda **Mappa** mostra magazzini e servizi che hanno una posizione. A sinistra,
**Giacenze per location** elenca, per ogni magazzino (**MAG**) e servizio
(**SRV**), gli articoli presenti; un clic su una riga centra la mappa (**Centra sulla
mappa**). Senza dati vedi **Nessuna giacenza.**

In alto a destra:

- **Auto-refresh** diventa **Live** con un conto alla rovescia: la mappa si
  ricarica ogni minuto;
- **Schermo intero** (e **Esci da schermo intero**) porta la mappa a tutto
  schermo.

Il selettore sulla mappa cambia lo sfondo: **OpenStreetMap** o **Satellite**.

## Se qualcosa non va {#problemi}

- Se i dati non si caricano vedi **Errore caricamento** con **Riprova**.
- Se il salvataggio non riesce vedi il messaggio in alto nella finestra, che resta
  aperta.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
