# Use Case — guide

## Identificativo

UC-GD — Consultare la guida di una pagina e il manuale completo

---

## Contesto di sistema

La documentazione per chi usa il programma e' **Markdown**, in un'unica fonte, e si
legge in tre modi:

* in un **pannello** dentro la pagina, mentre si lavora (il «?»);
* nel **manuale completo** (`guide.php`), una pagina sola con menu laterale e ricerca,
  che si apre dal pulsante **Manuale** del tab AIUTO;
* in un **`.odt`** stampabile (`docs/<lingua>/manual.odt`), *derivato* dagli stessi
  Markdown e non scritto a mano.

La fonte e' fatta di una **guida generale** (la radice: come si legge, indice dei
capitoli), di **capitoli** che raccontano l'evento per fasi — preparare, accreditare,
gestire, tracciare, rendicontare, piu' l'accoglienza solo per chi ospita civili — e di
una **guida per ogni pagina** (SPA, o dashboard PHP senza SPA) scritta accanto al codice.
I capitoli dicono *quando e perche'* e rimandano alle guide delle pagine per il *come*.

Il manuale `.odt` scritto a mano e' stato sostituito (vedi AGENTS.md §Manuale utente).

---

## Goal

L'operatore trova la spiegazione della pagina in cui si trova senza uscirne, gia'
posizionata sul passo che sta eseguendo; sa come procede un evento dall'inizio alla
fine; trova un argomento cercandolo; e puo' stampare l'intero manuale quando serve.

---

## Primary Actor

Operatore di segreteria campo. Per il punto D, chi mantiene il plugin.

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore | Capire cosa fare e cosa significa ogni pulsante, senza perdere il lavoro in corso |
| Chi gestisce l'evento | Una guida che segue le fasi dell'evento e non l'organizzazione dei dati |
| Chi mantiene il plugin | Che la guida segua il codice: se un'etichetta cambia, un controllo lo segnala; un solo comando produce l'`.odt` |
| Traduttore | Una struttura stabile (identificativi) su cui allineare le lingue |

---

## Precondizioni

- La guida e' elencata in `docs/guide/guide.json`: una voce di SPA con `views/<spa>/guide.<lingua>.md`, una di dashboard con `views/dashboards/<id>/guide.<lingua>.md`, un capitolo con il suo `file`.
- La pagina non e' aperta in modalita' totem (`?totem=1`), per il «?».
- Per **Apri la pagina**: esiste la dashboard (`dashboard_<id>.inc.php`).

---

## Postcondizioni — Successo

- La guida e' visibile, aperta sul punto giusto; la pagina sottostante non ha perso lo stato.
- Il manuale e' consultabile per intero e per ricerca; l'`.odt` si puo' rigenerare da zero.

## Postcondizioni — Errore/Fallimento parziale

- Se la guida non si carica, la pagina funziona come prima: la guida e' sempre un di piu'.
- Se il controllo delle guide non passa, l'`.odt` non viene generato.

---

## Main Success Scenario

### A. Nella pagina

1. In basso a destra compare il pulsante **?** se la pagina ha una guida. Per una SPA lo crea l'avvio della SPA; per una dashboard PHP, lo script dei collegamenti.
2. L'operatore lo preme: si apre un pannello a destra con la guida di quella pagina.
3. In una procedura a passi il pannello si apre sulla sezione del passo corrente.
4. L'operatore avanza o torna indietro nella procedura: il pannello, rimasto aperto, scorre alla sezione del nuovo passo.
5. Un collegamento a un'altra guida la apre nello stesso pannello; **Indietro** torna a quella di prima.
6. **Manuale completo** apre la pagina del manuale, gia' sulla sezione che si sta leggendo.
7. Il pannello si chiude con la ✕ o con Esc.

### B. Dalla pagina iniziale, prima di aprire la pagina

1. Accanto al pulsante che apre una pagina con guida (nella home, nell'ingresso dei preaccreditamenti, ovunque compaia) c'e' un piccolo **?** grigio.
2. L'operatore lo preme: il pannello laterale si apre sulla guida di quella pagina, senza lasciare la pagina in cui si trova.
3. Il pulsante accanto e' intatto: lo stesso clic sul pulsante apre la pagina come prima.

### C. Il manuale completo

1. L'operatore preme **Manuale** nel tab AIUTO (o apre `guide.php`): la pagina si apre in una nuova scheda.
2. Il sistema mostra la guida generale, i capitoli (Parte I, II, III) e le guide delle pagine («Riferimento»), nell'ordine dell'indice `guide.json`.
3. A sinistra un menu fisso elenca tutte le guide e, sotto ciascuna, le sue sezioni. Mentre l'operatore scorre il testo, la guida e la sezione in lettura si evidenziano e la guida corrente si apre.
4. Sotto i 960 px il menu e' un cassetto dietro il pulsante **Indice**; scegliere una voce lo chiude.
5. Scrivendo almeno due caratteri nel campo di ricerca (o premendo `/` per raggiungerlo) il menu mostra i risultati: guida, titolo della sezione e un frammento con le parole trovate. Non contano maiuscole e accenti; servono tutti i termini. Un clic porta alla sezione.
6. In alto a destra di ogni guida di pagina c'e' **Apri la pagina ↗**, che apre la pagina nel programma in una nuova scheda; lo stesso ↗ sta nei risultati.
7. Con `?view=<guida>` o un frammento `#g-<guida>-<id>` la pagina si posiziona su quella sezione.
8. Dal browser l'operatore stampa: ogni guida comincia su una pagina nuova e il menu non si stampa.

### D. Produrre il manuale stampabile (chi mantiene il plugin)

1. Esegue `php docs/build-guide.php`: il sistema controlla le guide (etichette, collegamenti, pagine, passi) e poi scrive `docs/<lingua>/manual.odt`.
2. In bozza i `[DA VERIFICARE]` sono ammessi e contati; con `--release` bloccano, e LibreOffice mette i numeri di pagina nell'indice.
3. Se il controllo non passa, il sistema elenca cosa non va sotto la guida a cui appartiene e non genera l'`.odt`.

---

## Extensions

### A1a. Pagina aperta in modalita' totem
- Nessun pulsante: il kiosk non offre la guida.

### A1b. Pagina non elencata nell'indice, o indice non raggiungibile
- Nessun pulsante, nessun errore visibile. Un avviso resta nella console.

### A1c. Pagina che si ricarica da sola (Report)
- Nessun **?** fisso: un pannello aperto sparirebbe a ogni ricarica. Resta il «?» accanto al pulsante della home.

### B1a. Pulsante senza guida
- Nessun **?**: compare solo dove la pagina e' nell'indice. Non compare sui pulsanti in modalita' totem (`totem=1`), su quelli che non aprono una pagina con guida (per esempio **Worktable Explorer**, che e' di un altro plugin) e su cio' che una SPA disegna dentro `#app`.

### A2a. Guida non disponibile nella lingua dell'utente
- Si usa la lingua predefinita dell'indice (italiano).

### A2b. Guida assente o non caricabile
- Il pannello dice "Guida non disponibile per questa pagina."

### A3a. Nessuna sezione per il passo corrente
- Il pannello si apre in cima alla guida.

### A5a. Collegamento a una guida che non e' nell'indice
- Il collegamento non fa nulla.

### C5a. Nessun risultato
- Il menu dice «Nessun risultato per …».

### C5b. Meno di due caratteri
- Resta l'albero del menu: nessuna ricerca.

### C6a. Capitolo, guida generale o pagina senza dashboard
- Nessun **Apri la pagina**: i capitoli e la guida generale non hanno una pagina, e una voce puo' toglierlo con `"page": false`.

### C6b. Nessuna sessione aperta
- Il programma passa dal login e non riporta alla pagina richiesta.

### D3a. Un `[DA VERIFICARE]` nel testo, in bozza
- La generazione prosegue e lo segnala; nell'`.odt` il segnaposto e' evidenziato.

### D3b. `--release` con segnaposto, collegamenti non risolti o indice senza numeri
- Uscita con errore: la versione non e' pulita.

### *a. Collegamenti e immagini non sicuri
- Un collegamento con schema diverso da `http`, `https`, `mailto` (per esempio `javascript:`) perde il collegamento e resta testo. Il testo della guida non e' mai interpretato come HTML.
