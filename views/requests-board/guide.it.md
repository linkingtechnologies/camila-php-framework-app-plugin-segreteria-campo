# Richieste {#top}

Registra e segue le richieste: di risorse, di materiali, di documenti e così via,
fatte dall'interno o dall'esterno. Si apre da *Operatività → Richieste*.

Le richieste stanno su un *kanban*, cioè una lavagna a colonne, una per stato: una
richiesta cambia stato quando la sposti da una colonna all'altra.

## Il kanban {#kanban}

Ci sono tante colonne quanti sono gli stati, sempre presenti anche se vuote; se
non ci stanno tutte, scorri in orizzontale. Nell'intestazione di ogni colonna vedi
quante richieste contiene; una colonna senza richieste dice *vuota*. I nomi degli stati vengono dalla
scheda dati *richieste* (colonna *stato*) e di solito, da sinistra a destra, sono
*A - Presa in carico*, *B - In valutazione*, *C1 - In lavorazione*, *C2 - In
attesa di lavorazione*, *D1 - Eseguita* e *D2 - Respinta*.

Ogni scheda mostra il testo della richiesta, chi l'ha fatta, il servizio o
l'intervento collegato, la data, la priorità, il tipo e l'assegnatario. Il colore
del bordo a sinistra indica la priorità. In alto vedi quante richieste stai
guardando.

## Cambiare lo stato {#stato}

Trascina la scheda in un'altra colonna: lo stato cambia subito. Se il
salvataggio non riesce, il kanban si ricarica con lo stato di prima.

## Cercare e filtrare {#filtri}

Nel campo **Cerca…** scrivi parte del testo della richiesta o del richiedente.
Quattro menu restringono l'elenco: **Tutti i tipi**, **Tutte le priorità**,
**Tutti gli assegnatari** e **Tutti i servizi**. Gli ultimi due compaiono solo se
ci sono richieste con un assegnatario o un servizio.

**Aggiorna** rilegge le richieste dal server.

## Nuova richiesta {#nuova}

1. Premi **Nuova**: si apre **Nuova richiesta**.
2. Scrivi la **Richiesta**: è l'unico campo obbligatorio.
3. Se serve compila gli altri: **Richiedente**, **Data**, **Tipo**, **Priorità**,
   **Assegnatario**, **Servizio / intervento**, **Stato** e **Note**.
4. Premi **Crea**.

La **Data** è quella di oggi e **Tipo**, **Priorità** e **Stato** hanno già un
valore proposto. **Assegnatario** suggerisce i nomi di volontari e operatori;
**Servizio / intervento** suggerisce i servizi esistenti e serve a collegare la
richiesta a un intervento. Finché la **Richiesta** è vuota, **Crea** non si
attiva. **Annulla**, la ✕ o un clic fuori dalla finestra la chiudono senza
salvare.

## Modificare {#modifica}

Sulla scheda, la matita (**Modifica**) apre **Modifica richiesta**; poi **Salva**.
Per togliere un **Assegnatario**, un **Servizio / intervento** o le **Note**
basta svuotare il campo. Gli altri campi non si possono svuotare.

## Eliminare {#elimina}

Sulla scheda, il cestino (**Elimina**) chiede conferma: **Eliminare questa
richiesta?** La scheda sparisce subito; se l'eliminazione non riesce il kanban
si ricarica e la richiesta ricompare.

## Se qualcosa non va {#problemi}

- Se le richieste non si caricano vedi **Errore durante il caricamento.** e
  **Riprova**.
- Se il salvataggio non riesce vedi **Errore durante il salvataggio.** nella
  finestra, che resta aperta: puoi correggere e riprovare.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
