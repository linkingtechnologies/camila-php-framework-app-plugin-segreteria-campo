# Database risorse {#top}

L'anagrafica *permanente* di volontari, mezzi e materiali: esiste prima
dell'evento e resta dopo. Qui la consulti, la correggi e la completi. Si apre da
*Anagrafiche*, con tre pulsanti — Database volontari, Database mezzi, Database
materiali — che aprono la stessa pagina sulla scheda corrispondente.

Non è l'elenco di chi è presente a campo: quello lo scrive il [Check-in
massivo](guide:massive-check-in) su altre tabelle. Qui le persone e i mezzi sono
registrati con l'organizzazione di appartenenza, a prescindere da un evento.

Sono due passi: l'elenco, poi la scheda di una risorsa.

## Passo 1 — L'elenco {#passo-1}

In alto, **Database Risorse** e il pulsante per aggiungere una risorsa. Subito
sotto, la ricerca rapida; poi le schede **Volontari**, **Mezzi** e **Materiali**; poi
i filtri e la tabella.

### Ricerca rapida {#ricerca}

Il campo *Cerca un volontario, un mezzo o un materiale…* cerca in tutte e tre le
schede insieme, senza dover scegliere prima quella giusta. Servono almeno due
caratteri (*Almeno 2 caratteri.*). La ricerca non distingue maiuscole e accenti:
«rossi» trova «ROSSI», «Nicolò» trova «NICOLO».

Cerca nei nomi, nei codici (codice fiscale, targa, codice inventario, id materiale),
nelle marche e nei modelli, nella categoria e nell'organizzazione. Ogni risultato
indica a quale scheda appartiene; un clic apre la scheda della risorsa (passo 2).
Si vedono i primi dodici risultati, poi **e altri N risultati — restringi la
ricerca**. Con nulla da mostrare vedi **Nessun risultato.**

Se un elenco non si carica vedi **Ricerca non disponibile: cataloghi non caricati.**;
se ne manca solo una parte **Alcuni cataloghi non si sono caricati: i risultati sono
parziali.**

### Filtri {#filtri}

Sotto le schede:

- **Organizzazione**: mostra solo le risorse di quell'organizzazione (**Tutte** le
  toglie il filtro).
- **Categoria** e **Tipologia**: solo nelle schede Mezzi e Materiali. La tipologia
  dipende dalla categoria scelta.
- **Filtro per colonna**: scegli una colonna e scrivi un testo (*contiene…*).
- **Per pagina**: quante righe mostrare (20, 25, 50, 100, 200).

Cambiare un filtro, l'ordine o la scheda riporta alla prima pagina. Sopra la
tabella vedi *Mostrati X–Y di T* e le frecce per cambiare pagina; senza risultati
**Nessun risultato.**

### La tabella {#tabella}

Un clic sull'intestazione di una colonna ordina (un secondo clic inverte l'ordine).
Il pulsante **Colonne** apre l'elenco delle colonne: con le frecce le sposti, con la
casella le nascondi o le mostri; **Ripristina ordine predefinito** torna all'ordine
iniziale. A fianco, **Carattere** con tre misure (S, M, L). Queste scelte sono tue:
restano memorizzate in questo browser e non cambiano nulla per gli altri.

L'ordine iniziale delle colonne è quello impostato sulla tabella in Camila. Una
colonna aggiunta alla tabella compare da sola al posto giusto.

### Esportare in Excel o in ODS {#esporta}

**Esporta in Excel** ed **Esporta in ODS**, accanto a **Colonne**, scaricano la lista che
stai guardando in un file, uno per scheda: `database-volontari_2026-11-02.xlsx` per Excel,
`database-volontari_2026-11-02.ods` per LibreOffice e OpenOffice, con la data di oggi. Il
contenuto è lo stesso: scegli il formato del programma che usi. (Excel apre anche gli ODS e
LibreOffice anche gli XLSX.)

- *Quali righe*: tutta la lista, non solo la pagina a schermo, con i filtri e l'ordine
  che hai scelto. Se filtri per un'organizzazione, nel file ci sono solo le sue risorse;
- *Quali colonne*: quelle che vedi, nell'ordine in cui le vedi. Le colonne che hai nascosto
  con **Colonne** non ci sono;
- l'intestazione porta i nomi completi delle colonne, in grassetto, con la prima riga
  bloccata e il filtro già attivo, così il foglio si ordina e si filtra subito;
- codici fiscali, cellulari, targhe e codici inventario arrivano come testo: non perdono
  gli zeri iniziali e non diventano numeri in notazione scientifica;
- le date (la data di nascita) arrivano come date vere: il programma le mostra nel formato del
  tuo computer (gg/mm/aaaa) e puoi ordinarle e filtrarle come date. Un valore che non è una
  data valida, per esempio un «31 febbraio» o un testo come «n.d.», resta scritto com'era.

Mentre scarica, il pulsante premuto dice **Esportazione…** e l'altro è fermo. Con una lista
vuota sono disattivati.
Si può usare anche in sola lettura: non cambia nessun dato. Non include le foto e non
sostituisce il backup.

Prima di offrirti il file, il programma lo rilegge e controlla che sia integro e che
contenga i dati della lista. Se qualcosa non va, il motivo compare accanto al pulsante e non
viene salvato nessun file a metà: se vedi **Il file generato non ha superato il controllo**,
riprova e, se si ripete, avvisa chi gestisce il sistema. Se la sessione non è più valida,
premi **Esci e rientra**.

### Correggere una cella {#cella}

Con un *doppio clic* su una cella la modifichi sul posto:

- *Invio* o un clic fuori salvano, *Esc* annulla;
- per la data di nascita compare il selettore di data;
- per la **categoria** e la **tipologia** di un mezzo o di un materiale si apre una
  finestra con le due tendine collegate (**Categoria**, **Tipologia**), con
  **Salva** e **Annulla**.

Non si correggono sul posto le colonne *Provincia*, *Organizzazione*, *Cod. Org.* e
*Id mat.*. La provincia segue l'organizzazione, che si
sceglie una volta sola quando la risorsa viene creata. Anche una colonna che la
tabella dichiara in sola lettura non si può cambiare qui.

Se il salvataggio non riesce, il messaggio compare sotto la cella.

### Aggiungere una risorsa {#nuova}

1. Premi *Aggiungi nuova risorsa nella categoria* con il nome della scheda attiva.
2. Si apre **Nuova risorsa**: scegli l'organizzazione cercandola per denominazione o
   codice (*Cerca per denominazione o codice…*). Vedi prima quelle già presenti nel
   database; senza nulla **Nessuna organizzazione trovata.**
3. Un clic sull'organizzazione apre il passo 2 con la scheda vuota.

**Annulla** o la ✕ chiudono senza creare nulla.

### Modificare ed eliminare {#modifica}

Nella prima colonna di ogni riga ci sono due pulsanti: la matita (**Modifica**) apre
la scheda completa; il cestino (**Elimina**) chiede conferma con una finestra del
browser (*Eliminare definitivamente…*). L'eliminazione è definitiva.

### Sola lettura {#sola-lettura}

Se non hai il permesso di scrivere, al posto del pulsante per aggiungere vedi **Sola
lettura**, e matita, cestino e correzione sul posto non ci sono o sono disattivati.
Se il programma non riesce a verificare i permessi vedi un avviso (**Permessi non
verificati su questa scheda: le azioni sono nascoste.**) con **Riprova**.

## Passo 2 — La scheda {#passo-2}

La scheda mostra tutti i campi della risorsa. In alto, **Nuovo** o **Modifica** con il
tipo di risorsa (volontario, mezzo, materiale) e, per una risorsa esistente, il suo
ID. **Indietro** torna all'elenco.

La riga dell'**Organizzazione** e la **Provincia** sono in sola lettura, e il lucchetto
lo ricorda: l'organizzazione si sceglie alla creazione e la provincia si ricava da
essa. Se il codice non è nell'anagrafica delle organizzazioni compare l'avviso
**Codice non presente in anagrafica organizzazioni.**

Gli altri campi dipendono dalla scheda:

- **Volontari**: dati anagrafici e di contatto.
- **Mezzi**: targa, codici inventario, **Categoria**, **Tipologia**, **Marca** (da
  elenco, oppure **Altra…** per scriverne una nuova), modello e note.
- **Materiali**: l'**ID** è proposto in automatico (se non è disponibile vedi un
  avviso e puoi scriverlo a mano), **Categoria**, **Tipologia**, marca, modello e
  note.

La tipologia offre solo i valori della categoria scelta. Con categoria «Non
assegnata» anche la tipologia è «Non assegnata».

I campi segnati **obbligatoria** vanno compilati: se manca qualcosa vedi **Campi
obbligatori non compilati:** con l'elenco di quelli che mancano.

**Salva** si attiva solo se ci sono modifiche (sotto vedi **Modifiche non salvate.**
oppure **Nessuna modifica da salvare.**). Dopo il salvataggio torni all'elenco.
**Annulla** e **Indietro** tornano all'elenco senza salvare.

## Se qualcosa non va {#problemi}

- Se l'elenco non si carica vedi un riquadro rosso *Errore render wizard* con il
  motivo: ricarica la pagina e, se continua, avvisa chi gestisce il sistema.
- Se il salvataggio non riesce vedi **Errore salvataggio** con il motivo e la scheda
  resta aperta.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e rientra**.
  Ricaricare la pagina non basta.
