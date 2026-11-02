# Use Case — resource-manager

## Identificativo

UC-RM1 — Consultare, correggere, completare ed esportare l'anagrafica permanente di volontari, mezzi e materiali (*Database risorse*)

---

## Contesto di sistema

Pagina del riquadro **Anagrafiche** della pagina iniziale, con tre pulsanti — *Database volontari*, *Database mezzi*, *Database materiali* — che aprono la stessa SPA sulla scheda corrispondente (`?tab=volontari|mezzi|materiali`).

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

### Passo 1 — L'elenco

1. L'operatore apre il database di una scheda; il sistema mostra la lista paginata (50 righe) ordinata sulla colonna predefinita della scheda.
2. L'operatore cerca nel campo di ricerca rapida (almeno due caratteri): il sistema cerca in tutte e tre le schede insieme, senza distinguere maiuscole e accenti, e mostra i primi dodici risultati; un clic apre la scheda della risorsa.
3. L'operatore restringe la lista con i filtri: organizzazione, categoria e tipologia (solo mezzi e materiali) e filtro per colonna; cambiare filtro, ordine o scheda riporta alla prima pagina.
4. L'operatore ordina cliccando l'intestazione di una colonna, e con **Colonne** riordina o nasconde le colonne e sceglie la dimensione del carattere; queste scelte restano nel suo browser.
5. L'operatore corregge una cella con un doppio clic: *Invio* salva, *Esc* annulla.
6. L'operatore preme **Esporta in Excel** o **Esporta in ODS**: il sistema rilegge tutte le righe della lista, con gli stessi filtri e lo stesso ordine, e salva `database-<scheda>_<AAAA-MM-GG>.xlsx` (o `.ods`) con le colonne visibili nell'ordine in cui le vede, intestate con le etichette della scheda.
7. L'operatore apre la matita (modifica) o aggiunge una risorsa con **Aggiungi nuova risorsa nella categoria…**, scegliendo prima l'organizzazione.

### Passo 2 — La scheda

1. Il sistema mostra tutti i campi della risorsa; organizzazione e provincia sono in sola lettura.
2. L'operatore compila i campi (quelli obbligatori vanno riempiti) e preme **Salva**, attivo solo se c'e' una modifica.
3. Il sistema scrive il record e torna all'elenco.

---

## Extensions

### 1a. Permessi non verificabili o assenti
- Il sistema mostra l'avviso con **Riprova**, nasconde le azioni di scrittura e lascia consultazione ed esportazione.

### 1b. L'elenco non si carica
- Il sistema mostra l'errore con il motivo; se la sessione non e' piu' valida, il riquadro giallo con **Esci e rientra**.

### 2a. Meno di due caratteri, o nessun risultato
- Il sistema lo dice (*Almeno 2 caratteri.*, *Nessun risultato.*); se i cataloghi non si caricano, la ricerca e' segnalata come non disponibile o parziale.

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

### 7a. Eliminazione
- Il cestino chiede conferma con una finestra del browser; l'eliminazione e' definitiva.

### 7b. Codice organizzazione fuori anagrafica
- La scheda avvisa che il codice non e' presente nell'anagrafica delle organizzazioni.
