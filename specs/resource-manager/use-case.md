# Use Case — resource-manager

## Identificativo

UC-RM1 — Consultare, correggere, completare ed esportare l'anagrafica permanente di volontari, mezzi e materiali (*Database risorse*)

---

## Contesto di sistema

Pagina del riquadro **Anagrafiche** della pagina iniziale, con tre pulsanti — *Database volontari*, *Database mezzi*, *Database materiali* — che aprono la stessa SPA sulla scheda corrispondente (`?tab=volontari|mezzi|materiali`). Senza `?tab=` (o con `?tab=riepilogo`) la SPA si apre sulla prima scheda, **Riepilogo**; con `?tab=mappa`, sulla **Mappa**.

Lavora sulle tabelle dell'anagrafica **permanente** `db-volontari`, `db-mezzi` e `db-materiali`: esistono prima dell'evento e sopravvivono dopo. Non sono l'elenco di chi e' presente a campo: quello lo scrive il [Check-in massivo](../massive-check-in/use-case.md) sulle tabelle di evento `volontari`, `mezzi` e `materiali`, che questa SPA non tocca.

---

## Goal

L'operatore trova una risorsa (per nome, codice, organizzazione), la corregge sul posto o nella scheda completa, ne aggiunge di nuove, e puo' scaricare in Excel la lista che sta guardando.

---

## Primary Actor

Operatore di segreteria (per la sola consultazione, anche senza permesso di scrittura).

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore | Ritrovare una risorsa in fretta e correggerla senza aprire la scheda completa |
| Responsabile dell'evento | Poter portare l'elenco fuori dal programma (invio, stampa, controlli in Excel) |
| Organizzazione di appartenenza | Che le sue risorse siano registrate con i dati giusti e sotto la propria organizzazione |
| Chi gestisce il sistema | Che l'ordine delle colonne segua la configurazione della scheda e che i permessi della scheda siano rispettati |

---

## Precondizioni

- L'utente ha la sessione aperta.
- Le tabelle `db-volontari`, `db-mezzi`, `db-materiali` esistono; `db-organizzazioni` e' l'anagrafica delle organizzazioni.
- Per scrivere: i permessi `create`/`update`/`delete` della scheda (`permissions()`); senza, la SPA e' in sola lettura.

---

## Postcondizioni — Successo

- Una correzione, una creazione o un'eliminazione sono scritte nella tabella `db-*` della scheda attiva; la lista si ricarica.
- Un'esportazione ha salvato sul computer dell'operatore un file `.xlsx` (Excel) o `.ods` (LibreOffice) con una riga per ogni risorsa della lista filtrata e le colonne che l'operatore vede. Non cambia nessun dato.

## Postcondizioni — Errore/Fallimento parziale

- Un salvataggio che non riesce lascia invariato il record e mostra il motivo dove l'operatore stava lavorando.
- Un'esportazione che non riesce non salva nessun file e lo dice accanto al pulsante; la lista a schermo resta com'era.
- Se i permessi non sono verificabili la SPA entra in sola lettura.

---

## Main Success Scenario

### Passo 0 — Il riepilogo

1. L'operatore apre la pagina senza scegliere una scheda, oppure preme la scheda **Riepilogo**: il sistema mostra tre riquadri — volontari, mezzi, materiali — con il numero di risorse registrate in `db-volontari`, `db-mezzi` e `db-materiali`.
2. L'operatore sceglie un'organizzazione (tendina o lente): i numeri diventano quelli di quell'organizzazione e sotto ciascuno compare «su N in totale». Il gruppo Camila dell'utente, se e' un codice di organizzazione (vedi 3b), e' la scelta iniziale.
3. L'operatore preme un riquadro: il sistema apre la scheda corrispondente, con lo stesso filtro per organizzazione.
4. Sotto i riquadri il sistema mostra «Per categoria e tipologia»: per mezzi e materiali, ogni categoria con il numero di risorse e, sotto, ogni tipologia con il suo numero, per la stessa organizzazione dei riquadri. Compaiono solo categorie e tipologie con almeno una risorsa, nell'ordine in cui la scheda le definisce; una risorsa con categoria definita ma senza tipologia sta sotto la sua categoria come «(tipologia non indicata)»; sotto «Fuori elenco» vanno solo i valori che la scheda non definisce (una categoria sconosciuta, o una tipologia che non e' fra quelle della categoria). Il tutto e' in un unico riquadro. I volontari non hanno categorie e non compaiono.
5. L'operatore preme il nome di una categoria o di una tipologia: il sistema apre la scheda Mezzi o Materiali con **Organizzazione**, **Categoria** e **Tipologia** gia' impostate su quella voce (la sola categoria, se ha premuto la categoria) e con il filtro per colonna azzerato, cosi' l'elenco contiene esattamente le risorse contate.

### Passo 0b — La mappa

1. L'operatore preme la scheda **Mappa** (o apre la pagina con `?tab=mappa`): il sistema legge le organizzazioni con le loro coordinate e le righe di `db-mezzi` e `db-materiali` (organizzazione, categoria, tipologia) e disegna sulla mappa un cerchio per luogo con il numero di risorse che rispettano i filtri.
2. L'operatore sceglie cosa contare con **Mostra** (mezzi, materiali o entrambi), **Categoria** e **Tipologia** (a cascata): la mappa si ridisegna subito, senza spostare la vista. Il cerchio e' blu per i mezzi, arancio per i materiali, viola per entrambi, e piu' grande quanto piu' alto e' il numero.
3. L'operatore sceglie con **Raggruppa per** il livello: **Organizzazione** (un cerchio per sede), **Comune** o **Provincia** (un cerchio per gruppo, nel punto medio delle sedi che ne fanno parte).
4. L'operatore preme un cerchio: il sistema mostra il totale, i mezzi e i materiali, e il dettaglio per categoria e tipologia. Raggruppando per organizzazione, la finestra ha i collegamenti ad aprire l'elenco mezzi o materiali di quell'organizzazione, filtrato anche per categoria e tipologia dove la scheda di arrivo le sa mostrare.
5. Sotto la mappa, **Elenco numerico** riporta gli stessi numeri in tabella.

### Passo 1 — L'elenco

1. L'operatore apre il database di una scheda; il sistema mostra la lista paginata (50 righe) ordinata sulla colonna predefinita della scheda.
2. L'operatore cerca nel campo di ricerca rapida (almeno due caratteri): il sistema cerca in tutte e tre le schede insieme, senza distinguere maiuscole e accenti, e mostra i primi dodici risultati; un clic apre la scheda della risorsa.
3. L'operatore restringe la lista con i filtri: organizzazione, categoria e tipologia (solo mezzi e materiali) e filtro per colonna; cambiare filtro, ordine o scheda riporta alla prima pagina. L'organizzazione si sceglie dalla tendina oppure con la lente accanto, che apre una finestra con la ricerca per denominazione o codice.
4. L'operatore ordina cliccando l'intestazione di una colonna, e con **Colonne** riordina o nasconde le colonne e sceglie la dimensione del carattere; queste scelte restano nel suo browser.
5. L'operatore corregge una cella con un doppio clic: *Invio* salva, *Esc* annulla.
6. L'operatore preme **Esporta in Excel** o **Esporta in ODS**: il sistema rilegge tutte le righe della lista, con gli stessi filtri e lo stesso ordine, e salva `database-<scheda>_<AAAA-MM-GG>.xlsx` (o `.ods`) con le colonne visibili nell'ordine in cui le vede, intestate con le etichette della scheda.
7. L'operatore apre la matita (modifica) o aggiunge una risorsa con **Aggiungi nuova risorsa nella categoria…**, scegliendo prima l'organizzazione.
9. Nelle schede Mezzi e Materiali, con il permesso di modifica e quello di inserimento sul registro, l'operatore preme l'icona **Trasferisci** di una riga: sceglie l'organizzazione di destinazione, scrive la **Motivazione** (obbligatoria) e conferma; il sistema cambia `organizzazione`, `codice-organizzazione` e `provincia` della risorsa e scrive una riga nel registro `trasferimenti-risorse`, con data, ora, utente, i dati della risorsa (targa o id materiale, categoria, tipologia, marca e modello, codice inventario, proprietario e, per i materiali, le note), organizzazione di partenza e di arrivo e motivazione.
8. Nelle schede Mezzi e Materiali l'operatore preme **Classificazioni**: il sistema mostra in una finestra le categorie e le tipologie di mezzi e materiali, come sono definite sulla scheda, ciascuna con il numero di risorse del database che la usano.

### Passo 2 — La scheda

1. Il sistema mostra tutti i campi della risorsa; organizzazione e provincia sono in sola lettura.
2. L'operatore compila i campi (quelli obbligatori vanno riempiti) e preme **Salva**, attivo solo se c'e' una modifica.
3. Il sistema scrive il record, torna all'elenco e mostra sopra la ricerca la conferma, per esempio «Materiale salvato: M101 (Alfa Volontari).» (volontario: cognome e nome; mezzo: targa; materiale: id materiale). La conferma resta finche' l'operatore non la chiude o non avvia un'altra operazione (nuova risorsa, modifica, cambio scheda).

---

## Extensions

### 1a. Permessi non verificabili o assenti
- Il sistema mostra l'avviso con **Riprova**, nasconde le azioni di scrittura e lascia consultazione ed esportazione.

### 1b. L'elenco non si carica
- Il sistema mostra l'errore con il motivo; se la sessione non e' piu' valida, il riquadro giallo con **Esci e rientra**.

### 2a. Meno di due caratteri, o nessun risultato
- Il sistema lo dice (*Almeno 2 caratteri.*, *Nessun risultato.*); se i cataloghi non si caricano, la ricerca e' segnalata come non disponibile o parziale.

### 0a. Conteggi non disponibili
- Se la lettura di una tabella fallisce, il suo riquadro mostra «—» e il sistema scrive «Non tutti i conteggi si sono caricati:» con il motivo e **Riprova**; gli altri riquadri restano leggibili. Con la sessione non valida compare il riquadro giallo con **Esci e rientra**.

### 5a. Voci senza collegamento
- «(tipologia non indicata)» e le voci di «Fuori elenco» non sono collegamenti: i menu **Categoria** e **Tipologia** non possono mostrare un valore che la scheda non definisce, e sembrerebbe «tutte». Si cercano dalla scheda dati con il filtro per colonna.

### 0d. Risorse non posizionabili
- Una risorsa la cui organizzazione non ha coordinate valide (vuote, fuori scala, o 0/0) o non e' in `db-organizzazioni` non e' sulla mappa: il sistema la conta a parte («non posizionabili») e la elenca per organizzazione sotto la mappa. Non e' mai scartata in silenzio.

### 0e. Mappa non disponibile
- Leaflet e' una copia locale (`camila/js/leaflet/`): senza internet la mappa si disegna con i cerchi su sfondo vuoto, e il sistema avverte che lo sfondo (OpenStreetMap) non si carica. Solo se i file della libreria mancano, il sistema dice «La mappa non e' disponibile» e apre l'**Elenco numerico**: i conteggi restano.

### 0f. Dati non caricati
- Se una lettura fallisce il sistema mostra quel che ha, scrive «Non tutti i dati si sono caricati:» con il motivo e **Riprova** (con **Esci e rientra** se la sessione non e' valida).

### 0g. Solo consultazione
- La mappa non scrive nulla e non offre il pulsante di aggiunta. La posizione e' quella della sede dell'organizzazione, non quella del mezzo in quel momento.

### 0c. Ripartizione non disponibile
- Se la lettura delle categorie fallisce, il sistema scrive «Ripartizione non disponibile:» con il motivo (con **Esci e rientra** se la sessione non e' valida); i riquadri dei conteggi restano com'erano.

### 0b. Sola consultazione
- La scheda non permette di aggiungere o modificare: nel riepilogo il pulsante «Aggiungi nuova risorsa» non c'e'.

### 3a. La lente per scegliere l'organizzazione
- La finestra elenca tutta l'anagrafica `db-organizzazioni` in ordine di denominazione; scrivendo, l'elenco si restringe (denominazione o codice, senza distinguere maiuscole e accenti) e **Tutte le organizzazioni** scompare. Un clic su una voce applica il filtro, chiude la finestra e riporta alla prima pagina; **Annulla**, la ✕ o un clic fuori la chiudono senza cambiare nulla. Senza risultati la finestra dice «Nessun risultato.»; se l'anagrafica non si carica lo dice, e la lista della scheda resta consultabile.

### 5a. Colonna non correggibile sul posto
- Provincia, organizzazione, codice organizzazione, id materiale e le colonne dichiarate in sola lettura dalla tabella non si correggono qui: la provincia segue l'organizzazione, che si sceglie una volta alla creazione.

### 5b. Salvataggio non riuscito
- Il messaggio compare sotto la cella e il valore precedente resta.

### 6a. Lista vuota
- Entrambi i pulsanti, **Esporta in Excel** ed **Esporta in ODS**, sono disattivati.

### 6b. Colonne nascoste
- Le colonne che l'operatore ha nascosto con **Colonne** non sono nel file; quelle tecniche (`id`, `uuid`, `id2`) non ci sono mai.

### 6c. La lista supera una pagina
- L'esportazione non e' limitata alla pagina a schermo: legge la lista a blocchi e la salva intera.

### 6d. Errore durante l'esportazione
- Se una lettura fallisce (rete, server, sessione) non si salva nessun file parziale: il pulsante torna attivo e il motivo compare accanto, con **Esci e rientra** se la sessione non e' valida.

### 6f. Le date
- Le colonne data arrivano in Excel come date vere, mostrate nel formato regionale di chi apre il file; un valore che non e' una data valida (formato sconosciuto, 31 febbraio, `0000-00-00`, prima del 1900) resta il testo che era, senza perdere l'informazione.

### 6e. Il file generato non supera il controllo
- Prima di offrirlo, il sistema rilegge il file contro i dati da cui nasce. Se qualcosa non torna (zip danneggiato, XML non ben formato, una riga persa) il file non viene salvato e il sistema lo dice accanto al pulsante.
- Il controllo non garantisce che Excel o LibreOffice aprano il file: trova gli errori di costruzione, non le severita' di quei programmi.

### 9a. Nessun permesso di inserimento sul registro, o registro assente
- Si trasferisce solo con il permesso di **inserimento** sulla scheda `trasferimenti-risorse`, oltre a quello di modifica sulla risorsa. Senza, l'icona **Trasferisci** e' disattivata e il suo suggerimento dice il motivo (nessun permesso, oppure registro non disponibile su questa installazione). Un trasferimento che non si puo' tracciare non si fa; nulla viene scritto.

### 9b. La riga di registro non si scrive
- Il sistema annulla il cambio di organizzazione appena fatto: la risorsa resta dov'era e l'operatore lo legge. Se anche l'annullamento fallisce, un avviso «ATTENZIONE» dice dove e' finita la risorsa e dove va riportata.

### 9c. Destinazione e motivazione
- **Trasferisci** e' disattivato finche' non sono scelte un'organizzazione di destinazione (diversa da quella attuale) e una motivazione di almeno tre caratteri.

### 9d. Sola lettura, sessione scaduta
- Senza permesso di modifica sulla risorsa l'icona e' disattivata (come per 9a). Con la sessione non piu' valida la finestra mostra il messaggio giallo con **Esci e rientra**.

### 8a. Valori fuori elenco
- Le coppie categoria/tipologia presenti nelle risorse ma non definite sulla scheda compaiono nel gruppo **Fuori elenco**, con la loro quantita'; un valore mancante e' indicato come «(categoria vuota)» o «(tipologia vuota)».

### 8b. I conteggi non si caricano
- La finestra mostra comunque la definizione e dice «Conteggi non disponibili» con il motivo (con **Esci e rientra** se la sessione non e' valida). Non scrive nulla e non e' offerta nella scheda Volontari.

### 7a. Eliminazione
- Il cestino chiede conferma con una finestra del browser; l'eliminazione e' definitiva.

### 7e. Salvataggio ripetuto o senza identificativo
- Un secondo clic su **Salva** (anche un doppio clic) non scrive una seconda volta: finche' un salvataggio e' in corso, e dopo che e' riuscito, il pulsante non fa nulla. Modificare una risorsa non puo' mai inserirne una nuova.
- Se la risorsa da modificare non ha identificativo il sistema non scrive nulla e dice «Risorsa senza identificativo: salvataggio annullato, nessun dato scritto.».

### 7c. Una nuova risorsa dopo averne salvata una
- La scheda parte sempre vuota, con la sola organizzazione scelta e, per i materiali, l'id successivo della sequenza: nessun campo della risorsa salvata prima (ne' il suo id materiale) viene riproposto. Lo stesso vale riaprendo una risorsa dopo **Annulla**: si rilegge dal database, senza le modifiche abbandonate.

### 3b. Il gruppo dell'utente e' un'organizzazione
- Se il gruppo Camila dell'utente (`users.grp`) coincide con il codice di un'organizzazione dell'anagrafica, e l'utente non e' amministratore, la pagina si apre con il filtro **Organizzazione** gia' su quella: la prima lista e' gia' filtrata, in tutte e tre le schede. L'operatore puo' scegliere **Tutte** o un'altra: il predefinito si applica una volta sola per pagina. Per un amministratore, per un gruppo che non e' un codice di organizzazione, per un gruppo vuoto o se il gruppo non si riesce a leggere non cambia nulla.
- Nello stesso caso **Aggiungi nuova risorsa** non apre la finestra di scelta dell'organizzazione: la scheda del passo 2 si apre direttamente con quella organizzazione (nome, codice, provincia), come se l'operatore l'avesse scelta. Chi ha un gruppo-organizzazione inserisce quindi sempre per la propria; l'amministratore e chi non ha un gruppo-organizzazione continuano a scegliere nella finestra.
- Il filtro e' un predefinito di consultazione, non un limite: chi non deve vedere le altre organizzazioni lo ottiene con la visibilita' per gruppo di Camila (opzione **VG** sulla colonna, utente con visibilita' per gruppo), che filtra anche la REST API.

### 7d. L'organizzazione dell'inserimento precedente
- Nella finestra di scelta dell'organizzazione, con la ricerca vuota, in cima compare **Ultima organizzazione usata** (la finestra non si apre per chi ha un gruppo-organizzazione, vedi 3b): l'organizzazione scelta per l'ultima nuova risorsa di questa sessione di lavoro (qualunque scheda), con codice e provincia. Un clic la sceglie; la scelta e' sempre dell'operatore, il sistema non la applica da solo. Scrivendo nella ricerca la voce sparisce, e non e' ripetuta nell'elenco sotto. Se l'organizzazione non e' piu' in anagrafica non viene offerta. Ricaricando la pagina la memoria si perde.

### 7b. Codice organizzazione fuori anagrafica
- La scheda avvisa che il codice non e' presente nell'anagrafica delle organizzazioni.
