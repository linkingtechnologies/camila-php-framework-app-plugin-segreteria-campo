# UC-010 — Gestione interventi

Compilazione e consultazione delle schede intervento, la versione digitale del
modulo cartaceo "INTERVENTI".

## Contesto di sistema

La tabella `servizi` contiene sia i servizi di campo (cucina, TLC, carraia…) sia
gli interventi sul territorio. Li distingue il campo `intervento`:

| `intervento` | Significato |
|---|---|
| `"SI"` | intervento sul territorio — **gestito da questa SPA** |
| `"NO"` | esplicitamente non un intervento (CCS, supporto VVF, non in servizio) |
| vuoto | servizio di campo ordinario |

Questa SPA lavora **solo** sui record con `intervento = "SI"`. Il catalogo dei
servizi — ordine, colore, lettera, posizione sulla mappa, strumenti massivi —
resta di competenza di [`service-manager`](../service-manager/), che opera sulla
stessa tabella ma su campi diversi.

## Goal

Un operatore di segreteria registra una segnalazione ricevuta, ne compila la
scheda (chi ha segnalato, dove, cosa, quando), annota il sopralluogo, le squadre
attivate e la cronologia degli eventi, e chiude l'intervento indicando inizio e
fine. La scheda sostituisce il modulo cartaceo e ne conserva la struttura.

## Primary Actor

Operatore di segreteria campo.

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore di segreteria | Compilare la scheda senza perdere dati, ritrovare un intervento passato |
| Responsabile SOP | Sapere quali interventi sono aperti e chi è stato attivato |
| Squadre sul campo | Essere assegnate a un intervento riconoscibile per nome |
| Ente segnalante (Sindaco, VVF) | Che la segnalazione sia tracciata con riferimento e contatti |

## Precondizioni

- L'operatore è autenticato.
- La tabella `servizi` è raggiungibile.

## Postcondizioni — Successo

- Il record esiste in `servizi` con `intervento = "SI"`.
- Il `nome` dell'intervento diventa un servizio assegnabile: compare nei menu a
  tendina di check-in, check-out, movimentazione risorse e mappe.
- I campi della scheda sono persistiti.

## Postcondizioni — Errore/Fallimento parziale

- Un salvataggio fallito lascia il record nello stato precedente; la bozza resta
  a schermo e l'errore è mostrato accanto al form.
- Se il recupero dei permessi fallisce, la SPA entra in sola lettura: nessun
  pulsante di creazione, modifica o eliminazione è attivo.

## Classificazione stati

Lo stato e' un campo scelto dall'operatore, con il vocabolario definito nella
colonna: **Segnalato**, **In corso**, **Concluso**.

Se non e' stato scelto, viene dedotto da `inizio` e `fine`:

| Condizione | Stato dedotto |
|---|---|
| `inizio` vuoto | Segnalato |
| `inizio` valorizzato, `fine` vuoto | In corso |
| `inizio` e `fine` valorizzati | Concluso |

Uno stato scelto esplicitamente prevale e non viene sovrascritto compilando
`inizio` o `fine`.

## Main Success Scenario

### Elenco interventi

1. L'operatore apre "Gestione interventi".
2. Il sistema carica da `servizi` i soli record con `intervento = "SI"` e li
   mostra in elenco, ordinati per data di segnalazione decrescente.
3. Ogni riga mostra nome, comune, data di segnalazione e lo stato derivato.
4. L'operatore può restringere l'elenco con la ricerca testuale o con il filtro
   di stato.

### Cambio rapido di stato (vista kanban)

1. L'operatore passa alla vista kanban dai pulsanti in intestazione.
2. Il sistema mostra una colonna per stato, con le schede distribuite secondo lo
   stato effettivo e il conteggio per colonna.
3. L'operatore trascina una scheda in un'altra colonna.
4. Il sistema sposta subito la scheda e registra il nuovo stato.
5. Un clic su una scheda riporta alla vista elenco con quell'intervento aperto.

### Registrazione di un nuovo intervento

1. L'operatore sceglie di creare un nuovo intervento.
2. Il sistema apre una finestra con i soli campi essenziali: nome, oggetto, data
   e ora della segnalazione (preimpostate al momento corrente), comune e
   provincia.
3. L'operatore inserisce almeno il nome, che è obbligatorio, e conferma.
4. Il sistema crea il record, ricarica l'elenco e apre la scheda completa
   sull'intervento appena creato.
5. L'operatore prosegue nella scheda con segnalante, sopralluogo, squadre, mappa
   e cronologia, e salva quando ha finito.

### Modifica di una scheda esistente

1. L'operatore seleziona un intervento dall'elenco.
2. Il sistema mostra la scheda compilata.
3. L'operatore modifica i campi.
4. Il sistema segnala che ci sono modifiche non salvate.
5. L'operatore salva, e il sistema aggiorna il record e ricarica l'elenco.

### Attivazione di una squadra non ancora registrata

1. Nel blocco Squadre e referente l'operatore non trova la squadra che gli serve.
2. L'operatore apre la creazione rapida e indica nome, organizzazioni e quante
   persone e mezzi porta.
3. Il sistema registra la squadra e la attiva subito su questo intervento.
4. Per completarne la scheda — mansione, caposquadra, periodo — l'operatore
   segue il collegamento a Gestione squadre.

### Scelta del referente

1. Nel blocco Referente l'operatore puo' digitare cognome, nome e telefono a
   mano, oppure aprire la ricerca in anagrafica.
2. Il sistema mostra l'elenco dei volontari registrati, filtrabile per cognome,
   nome, organizzazione o provincia.
3. L'operatore sceglie un nominativo.
4. Il sistema compila i tre campi con cognome, nome e cellulare di quel
   volontario, e chiude la ricerca.
5. I campi restano modificabili a mano dopo la scelta.

### Annotazione nel brogliaccio

1. Con un intervento salvato selezionato, l'operatore scrive una nota nel campo
   dedicato e conferma.
2. Il sistema registra un record nel `brogliaccio` con la data e l'ora correnti,
   la descrizione inserita e il campo `servizio` valorizzato col nome
   dell'intervento.
3. Il sistema ricarica l'elenco delle note e svuota il campo di inserimento.
4. Le note sono mostrate dalla piu' recente alla piu' vecchia.

### Richiesta collegata all'intervento

1. Con un intervento salvato selezionato, l'operatore apre il form di nuova
   richiesta.
2. Il sistema propone data odierna, tipo "Interna", priorita' "3 - Normale" e
   stato "A - Presa in carico".
3. L'operatore compila almeno richiedente e testo della richiesta, e salva.
4. Il sistema registra la richiesta con il campo `servizio` valorizzato col nome
   dell'intervento, e la mostra nell'elenco sottostante.
5. Per lavorare la richiesta, l'operatore segue il collegamento a Gestione
   richieste.

### Eliminazione

1. L'operatore chiede di eliminare l'intervento selezionato.
2. Il sistema verifica se volontari, mezzi o materiali hanno quel nome nel
   campo `servizio`.
3. Se nessuna risorsa lo referenzia, il sistema chiede conferma esplicita.
4. Alla conferma elimina il record e ricarica l'elenco.

## Extensions

**2a. Nessun intervento presente** — l'elenco mostra un messaggio di stato vuoto
e il pulsante di creazione resta disponibile.

**2b. Errore di caricamento** — viene mostrato il messaggio con un pulsante
"Riprova"; l'elenco resta vuoto ma la pagina è utilizzabile.

**2c. Permessi non recuperabili** — sola lettura: la scheda è consultabile, ogni
azione di scrittura è disabilitata con icona di lucchetto.

**3a. Nome mancante** — la creazione è rifiutata con un errore nella finestra; il
nome è la chiave funzionale referenziata dalle risorse e non può essere vuoto.
Lo stesso vale svuotandolo nella scheda.

**3b. Nome già esistente** — il sistema avvisa che esiste già un servizio con
quel nome, perché due servizi omonimi rendono ambigua l'assegnazione delle
risorse. L'operatore può comunque procedere.

**4a. Squadra fuori catalogo** — una squadra registrata in precedenza e non più
presente tra i valori correnti resta visibile e selezionata, non viene scartata
in silenzio.

**3b. Spostamento kanban fallito** — la scheda torna nella colonna di partenza,
viene mostrato l'errore e l'elenco e' ricaricato dal server.

**5a. Salvataggio fallito** — l'errore è mostrato accanto al form, la bozza non
viene persa e l'operatore può ritentare.

**4b. Anagrafica non raggiungibile** — il popup mostra l'errore e resta possibile
digitare i tre campi a mano: la scelta da elenco e' una comodita', non un
vincolo.

**3c. Campi obbligatori mancanti** — se richiedente o testo della richiesta sono
vuoti il salvataggio e' rifiutato con un errore in linea: in tabella sono
obbligatori insieme a data, tipo, priorita' e stato, che hanno pero' un valore
iniziale.

**6a. Nota su intervento non ancora salvato** — il riquadro delle note di
brogliaccio resta disabilitato con una spiegazione: l'aggancio avviene tramite il
nome, che deve gia' esistere.

**6b. Brogliaccio non scrivibile** — se i permessi sulla tabella `brogliaccio`
non consentono la creazione, l'elenco resta consultabile e l'inserimento e'
disabilitato, indipendentemente dai permessi su `servizi`.

**2d. Intervento referenziato da risorse** — l'eliminazione è bloccata e il
sistema indica quante risorse lo stanno usando, per categoria.

## Unknowns

Nessuno.

Due punti che lo erano in una prima stesura e non lo sono piu':

- **Campo `stato`** — il vocabolario e' definito nella colonna stessa
  (`string-listofvalues`: Segnalato, In corso, Concluso) e la scheda lo espone.
- **Cronologia** — ha due forme, le note libere sulla scheda e le note di
  brogliaccio, descritte in §Main Success Scenario.
