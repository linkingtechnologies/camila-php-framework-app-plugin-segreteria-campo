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
sotto, la ricerca rapida; poi le schede **Riepilogo**, **Mappa**, **Volontari**, **Mezzi**
e **Materiali**; poi i filtri e la tabella.

### Riepilogo {#riepilogo}

La prima scheda dà il colpo d'occhio: quanti volontari, quanti mezzi e quanti materiali
sono registrati nell'anagrafica, in tre riquadri con il numero in grande. Si apre per
prima quando entri senza scegliere una scheda; i tre pulsanti *Database volontari*,
*Database mezzi* e *Database materiali* continuano ad aprire direttamente la loro.

- **Organizzazione**: la tendina e la lente sono le stesse delle altre schede. Scegliendo
  un'organizzazione i numeri sono i suoi, e sotto ciascuno vedi *su N in totale*. Se il
  tuo gruppo in Camila è il codice di un'organizzazione, parte già su quella.
- Un clic su un riquadro apre la scheda corrispondente, già filtrata sulla stessa
  organizzazione.
- Sotto i riquadri, **Per categoria e tipologia** elenca mezzi e materiali per categoria e,
  sotto ciascuna, per tipologia, con il numero di risorse. Compaiono solo le categorie e le
  tipologie che hanno almeno una risorsa (l'elenco completo, anche con gli zeri, è nella
  finestra **Classificazioni**). Una risorsa che ha la categoria ma non la tipologia sta sotto la sua
  categoria come *(tipologia non indicata)*; in **Fuori elenco** vanno solo i valori che la scheda non
  definisce.
- Il nome di una categoria o di una tipologia è un collegamento: apre la scheda Mezzi o
  Materiali già filtrata su quella voce, con **Categoria** e **Tipologia** impostate e la
  stessa organizzazione (la sola categoria, se premi la categoria). Il filtro per colonna
  viene azzerato, così l'elenco ha esattamente le risorse contate. *(tipologia non
  indicata)* e **Fuori elenco** non hanno il collegamento: i menu non possono mostrare un
  valore che la scheda non definisce. Segue la stessa organizzazione dei riquadri. I volontari non hanno
  categorie, quindi non compaiono. Se non si carica vedi **Ripartizione non disponibile:** con
  il motivo, e i riquadri restano.
- Se un conteggio non si carica vedi **—** al posto del numero e il messaggio **Non
  tutti i conteggi si sono caricati:** con **Riprova**; se la sessione non è più valida,
  il riquadro giallo con **Esci e rientra**. Gli altri conteggi restano leggibili.
- Nella scheda Riepilogo non c'è il pulsante per aggiungere: si aggiunge da Volontari,
  Mezzi o Materiali.

### Mappa {#mappa}

La seconda scheda mostra *quanti* mezzi e materiali ci sono nel territorio, come numeri su
una mappa. Non sono marker di singole risorse: le risorse non hanno una posizione propria,
hanno quella della sede della loro organizzazione (le coordinate della scheda dati delle
organizzazioni). Per ogni luogo vedi un cerchio con il numero di risorse che rispettano i
filtri; più il numero è grande, più il cerchio lo è. Il colore dice cosa stai contando: blu i
mezzi, arancio i materiali, viola entrambi.

- **Mostra**: scegli se contare i **Mezzi**, i **Materiali** o entrambi.
- **Categoria** e **Tipologia**: restringono ciò che si conta; la tipologia dipende dalla
  categoria scelta. Cambiare un filtro ridisegna subito la mappa, senza spostarla.
- **Raggruppa per**: **Organizzazione** (un cerchio per sede), **Comune** o **Provincia**. Un
  gruppo di organizzazioni sta nel punto medio delle loro sedi.
- Un clic sul cerchio apre una finestra con il dettaglio per categoria e tipologia. Se
  raggruppi per organizzazione, la finestra ha anche i collegamenti per aprire l'elenco dei suoi
  mezzi o dei suoi materiali, già filtrato su quell'organizzazione (e su categoria e tipologia,
  dove la scheda le può mostrare).
- Sopra la mappa una riga dice quante risorse vedi e in quanti punti. Sotto trovi
  **Elenco numerico**, la stessa informazione in tabella.
- Le risorse la cui organizzazione non ha coordinate, o non è in anagrafica, non si possono
  mettere sulla mappa: sono contate a parte (*non posizionabili*) e l'elenco dice quali sono.

Il punto è la sede dell'organizzazione, non dove si trova il mezzo in quel momento: non è una
posizione in tempo reale.

La libreria della mappa è installata con il programma, ma lo sfondo (OpenStreetMap) si carica da
internet. Senza connessione i cerchi con i numeri restano dove devono, su uno sfondo vuoto, e una
riga avverte che lo sfondo non si carica. Se manca la libreria stessa vedi **La mappa non è
disponibile** e i numeri restano nell'**Elenco numerico**. Se non tutti i dati si caricano vedi **Non
tutti i dati si sono caricati:** con **Riprova**; con la sessione scaduta il riquadro giallo con
**Esci e rientra**. Nella scheda Mappa non c'è il pulsante per aggiungere.

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
  toglie il filtro). Accanto alla tendina c'è la lente (*Cerca l'organizzazione*): apre
  una finestra dove scrivi parte del nome o del codice (*Cerca per denominazione o
  codice…*) e scegli dall'elenco. **Tutte le organizzazioni**, in cima, toglie il
  filtro; **Annulla** chiude senza cambiare nulla.
  Se il tuo gruppo in Camila è il codice di un'organizzazione (e non sei amministratore),
  la pagina si apre già filtrata su quella organizzazione: scegli **Tutte** per vedere il
  resto. È solo il punto di partenza; per non far vedere le altre organizzazioni serve la
  visibilità per gruppo di Camila, che imposta chi gestisce il sistema.
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

### Vedere le classificazioni {#classificazioni}

Nelle schede *Mezzi* e *Materiali*, **Classificazioni** (accanto a **Colonne**) apre una
finestra con le categorie e le tipologie di mezzi e materiali, come sono definite sulla
tabella. In due colonne, una per Mezzi e una per Materiali:

- ogni *categoria* è seguita dalle sue *tipologie*;
- il numero accanto a ciascuna è quante risorse del database la usano: serve a vedere
  subito quali classificazioni sono davvero in uso e quali no (un numero grigio, 0, vuol
  dire che nessuna risorsa la usa);
- sotto **Fuori elenco** compaiono le combinazioni che le risorse hanno ma che la tabella
  non prevede, per esempio una categoria rinominata o un campo lasciato vuoto: sono quelle
  da correggere.

I numeri si leggono quando apri la finestra, quindi sono sempre aggiornati. Se non si
caricano compare **Conteggi non disponibili** con il motivo, e l'elenco delle classificazioni
resta visibile. Si chiude con la ✕, con **Chiudi** o con un clic fuori dalla finestra.
Non cambia nessun dato, quindi si può usare anche in sola lettura.

### Trasferire a un'altra organizzazione {#trasferimento}

L'organizzazione di un mezzo o di un materiale non si cambia con la correzione sul posto:
la sceglie chi lo registra. Se la risorsa passa davvero a un'altra organizzazione, nelle
schede *Mezzi* e *Materiali* usa l'icona **Trasferisci** della riga (le due frecce).

1. Nella finestra vedi la risorsa e l'organizzazione attuale. In **Organizzazione di
   destinazione** scrivi almeno due lettere del nome o del codice (*Cerca per denominazione o
   codice…*) e scegli dall'elenco. L'organizzazione attuale non è offerta; se non c'è
   nulla vedi **Nessuna organizzazione trovata.**
2. Scrivi la **Motivazione**: è obbligatoria (da tre a 255 caratteri) e resta nel registro.
3. **Trasferisci** si attiva solo quando destinazione e motivazione ci sono. Cambiano
   insieme l'organizzazione, il codice organizzazione e la provincia (quella della nuova
   organizzazione). **Annulla** chiude senza cambiare nulla.

A fatto avvenuto la finestra conferma e la lista si aggiorna: se stavi guardando le risorse
della vecchia organizzazione, quella risorsa sparisce dall'elenco. **Chiudi** la chiude.

Ogni trasferimento è scritto nel registro *Trasferimenti risorse* (una scheda dati, in
sola aggiunta): data e ora, chi lo ha fatto, la risorsa (targa o id materiale, categoria,
tipologia, marca e modello, codice inventario, proprietario e, per i materiali, le note),
l'organizzazione di prima e quella di dopo, e la motivazione. I nomi restano scritti com'erano anche se un'organizzazione viene
poi rinominata.

Per trasferire serve il permesso di *inserimento* sulla scheda *Trasferimenti risorse*,
oltre a quello di modifica sulla risorsa: senza, l'icona è disattivata e, passandoci sopra,
dice il motivo. Lo stesso accade se la scheda non è stata ancora aggiunta all'installazione:
un trasferimento che non si può registrare non si fa, e chi gestisce il sistema deve
aggiungere la scheda o darti il permesso. Se il registro rifiuta la riga, il cambio viene
annullato e la risorsa resta dov'era; se anche l'annullamento fallisce compare
**ATTENZIONE** con l'organizzazione a cui riportarla a mano.

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
   codice (*Cerca per denominazione o codice…*). L'elenco è l'anagrafica delle
   organizzazioni, in ordine alfabetico, anche per chi non ha ancora volontari
   registrati; se l'anagrafica è vuota vedi **Nessuna organizzazione trovata.**
   Se il tuo gruppo in Camila è il codice di un'organizzazione (e non sei amministratore)
   questa finestra non compare: la scheda si apre direttamente con la tua organizzazione.
   Altrimenti, se hai già aggiunto una risorsa in questa sessione, in cima trovi **Ultima
   organizzazione usata**: un clic e prosegui con la stessa, senza cercarla di nuovo. Scrivendo nella
   ricerca quel riquadro sparisce e vedi i risultati; il programma non sceglie mai al
   posto tuo.
3. Un clic sull'organizzazione apre il passo 2 con la scheda vuota. Ogni nuova risorsa
   riparte da zero: non vengono riproposti i dati di quella salvata prima, e per i
   materiali l'ID è il successivo.

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
oppure **Nessuna modifica da salvare.**). Dopo il salvataggio torni all'elenco e sopra
la ricerca vedi in verde la conferma, per esempio *Materiale salvato: M101 (nome
dell'organizzazione).* con l'identificativo della risorsa (cognome e nome per i
volontari, targa per i mezzi, ID per i materiali). La conferma resta finché non la
chiudi con la ✕ o non fai altro: aggiungi o apri un'altra risorsa, cambi scheda.
**Annulla** e **Indietro** tornano all'elenco senza salvare.

## Se qualcosa non va {#problemi}

- Se l'elenco non si carica vedi un riquadro rosso *Errore render wizard* con il
  motivo: ricarica la pagina e, se continua, avvisa chi gestisce il sistema.
- Se il salvataggio non riesce vedi **Errore salvataggio** con il motivo e la scheda
  resta aperta.
- Se vedi **Risorsa senza identificativo: salvataggio annullato, nessun dato scritto.**
  la risorsa che stavi modificando non ha un identificativo nel database: non è stato
  scritto nulla. Torna all'elenco e avvisa chi gestisce il sistema.
- **Salva** si preme una volta sola: un secondo clic subito dopo non fa nulla, e non può
  mai creare una copia della risorsa che stai modificando. Se dopo un salvataggio ne vedi
  due uguali, sono state create prima di questa correzione: elimina quella in più.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e rientra**.
  Ricaricare la pagina non basta.
