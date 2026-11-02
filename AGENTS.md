# CAMILA WorkTable SPA Development Guide

## Purpose

This directory contains the **Segreteria Campo** plugin — a set of lightweight Single Page Applications for managing field operations (check-in, monitoring, and check-out of volunteers, vehicles, and materials).

The plugin is part of the **CAMILA WorkTable** ecosystem:

- **Framework**: [camila-php-framework](https://github.com/linkingtechnologies/camila-php-framework) — the PHP backend that provides the WorkTable API, authentication, and table management.
- **Plugin**: [camila-php-framework-app-plugin-segreteria-campo](https://github.com/linkingtechnologies/camila-php-framework-app-plugin-segreteria-campo) — this plugin, containing the SPAs in this directory.

The SPAs run entirely in the browser and communicate with the backend exclusively via `WorkTableClient`, which wraps the CAMILA WorkTable REST API.

AI agents working in this repository must generate and modify SPA modules that are deterministic, state-safe, backward-compatible, and easy to review.

The primary goal is to evolve existing administrative tools without introducing unnecessary framework complexity or speculative architecture changes.

## Operational context

The three main SPAs implement a coordinated field management workflow:

```
Check-in massivo  →  Stato organizzazione  →  Check-out massivo
(arrival)             (monitoring)              (departure)
```

1. **Check-in massivo**: registers the arrival of volunteers, vehicles, and materials for an organization. Sets `data-inizio-attestato = today`.
2. **Stato organizzazione**: real-time dashboard showing in-service and out-of-service resources per organization.
3. **Check-out massivo**: registers the departure. Sets `servizio = "USCITA DEFINITIVA"`, `data-fine-attestato = today`, `data/ora-uscita-definitiva`, and writes a movement record to `mov-risorse`.

### Risorse registrate e squadre dichiarate

Il sistema conosce le risorse a **due risoluzioni**, e rispondono alla stessa
domanda — chi c'e' su un servizio:

| | Dove | Cosa si sa |
|---|---|---|
| **Risorse registrate** | `volontari`, `mezzi`, `materiali` | i nominativi, uno per riga |
| **Squadre dichiarate** | `squadre-dichiarate` | solo i conteggi, dichiarati dall'organizzazione |

Le squadre dichiarate servono quando i nominativi non ci sono: emergenze "flash"
senza campo di ammassamento, squadre che operano da remoto, elenchi che
arriveranno a consuntivo giorni dopo — o mai.

**Non sono un ripiego temporaneo**: dove non c'e' un campo, sono l'unica
registrazione che esistera'. E **non passano dal check-in**, quindi non hanno
affatto le date di attestato: quelle due colonne sono state rimosse dalla
tabella, e le SPA che mostrano le squadre non applicano loro il filtro sulle
date usato per le risorse registrate.

**Una squadra dichiarata non ha date, punto**: sono state rimosse anche
`data/ora-registrazione` e `data/ora-uscita-definitiva`. A dire dov'e' una
squadra adesso e' `servizio`, con la convenzione `USCITA DEFINITIVA`. Quel che una squadra
dichiara e' la **finestra di disponibilita'**, `inizio-disponibilita` e
`fine-disponibilita`, che e' un'altra cosa: non quando e' arrivata, ma quando
c'e'.

Da non confondere: `volontari`, `mezzi` e `materiali` hanno eccome le colonne
`data/ora-registrazione` e `data/ora-uscita-definitiva`, scritte da check-in e
check-out. Stesso nome, altra tabella.

Il campo `squadra` su volontari, mezzi e materiali e' **l'altra faccia**: dopo un
check-in, le risorse portano il nome della squadra. Il nome e' la continuita' fra
le due fasi, e permette di affiancare *dichiarati* e *registrati* — vedere
`specs/team-manager/design.md` §Dichiarati e registrati.

---

## SPA Specifications

Each SPA has a dedicated specification directory under `specs/`. Read the relevant spec before modifying a SPA.

| SPA | Entry point | Views | Spec |
|---|---|---|---|
| Comunicazioni live | `app-comms-feed.js` | `views/comms-feed/` | [`specs/comms-feed/`](specs/comms-feed/) |
| Import Wizard | `app-import-wizard.js` | — (inline) | [`specs/import-wizard/`](specs/import-wizard/) |
| Mappe | `app-map-center.js` | `views/map-center/` | [`specs/map-center/`](specs/map-center/) |
| Massive Check-in | `app-massive-check-in.js` | `views/massive-check-in/` (7 step) | [`specs/massive-check-in/`](specs/massive-check-in/) |
| Massive Check-out | `app-massive-check-out.js` | `views/massive-check-out/` (4 step) | [`specs/massive-check-out/`](specs/massive-check-out/) |
| Org Status | `app-org-status.js` | `views/org-status/` (2 step) | [`specs/org-status/`](specs/org-status/) |
| Riepilogo preaccreditamenti | `app-pre-accreditations-summary.js` | `views/pre-accreditations-summary/` | [`specs/pre-accreditations-summary/`](specs/pre-accreditations-summary/) |
| Gestione richieste | `app-requests-board.js` | `views/requests-board/` | [`specs/requests-board/`](specs/requests-board/) |
| Movimentazione risorse | `app-resource-board.js` | `views/resource-board/` | [`specs/resource-board/`](specs/resource-board/) |
| Database risorse | `app-resource-manager.js` | `views/resource-manager/` (2 step) | [`specs/resource-manager/`](specs/resource-manager/) |
| Gestione interventi | `app-intervention-manager.js` | `views/intervention-manager/` | [`specs/intervention-manager/`](specs/intervention-manager/) |
| Gestione servizi/interventi | `app-service-manager.js` | `views/service-manager/` | [`specs/service-manager/`](specs/service-manager/) |
| Squadre dichiarate | `app-team-manager.js` | `views/team-manager/` | [`specs/team-manager/`](specs/team-manager/) |
| Smart Assistant | `app-smart-assistant.js` | `views/smart-assistant/` | [`specs/smart-assistant/`](specs/smart-assistant/) |
| Movimentazione consumabili | `app-stock-manager.js` | `views/stock-manager/` | [`specs/stock-manager/`](specs/stock-manager/) |
| Gestione magazzini | `app-warehouse-manager.js` | `views/warehouse-manager/` | [`specs/warehouse-manager/`](specs/warehouse-manager/) |
| Guide per pagina (infrastruttura, non una SPA) | `guide.php` | `views/shared/guide.js` | [`specs/guide/`](specs/guide/) |

I moduli condivisi fra piu' viste stanno in `views/shared/` e non hanno una SPA
propria: vedere §Moduli condivisi.

**Squadre dichiarate** si gestisce da un punto solo: il pulsante nel box
Anagrafiche. Da `intervention-manager` si **crea** soltanto, con la creazione
rapida del blocco «Squadre e referente». Era anche la terza vista di
`intervention-manager`: la vista e' stata tolta (specs/intervention-manager/
design.md §15), la fabbrica che la rendeva incorporabile e' rimasta — vedere
§Pannelli incorporabili.

Anche **Riepilogo preaccreditamenti** ha due ingressi: il pulsante nel box
Accreditamento della home e quello nella pagina d'ingresso del tab
PREACCREDITAMENTI. La SPA sta nelle `<pages>` di quel tab, non di `m0`, cosi' si
illumina il tab giusto da qualunque parte si arrivi.

Quel tab ha una **pagina d'ingresso propria**, `dashboard_pre-accreditations.inc.php`,
con i pulsanti verso il riepilogo e i tre pivot. Prima il tab apriva dritto sul
pivot dei volontari, e le altre viste si raggiungevano solo dalla sezione di
menu interna — che la SPA non stampa, perche' renderizza dentro `#app`. La
modulistica PDF e gli elenchi grezzi **non** sono duplicati li': si costruiscono
per turno da una query `DISTINCT` che gira in `pre-accreditations.inc.php`, e
restano sulle pagine dei pivot dove quella query gia' c'e'.

### Non confondere le due viste sui preaccreditati

| | `pre-accreditations-summary` (SPA) | `pre-accreditations*-by-*` (PHP) |
|---|---|---|
| Asse | organizzazione | organizzazione x turno (pivot) |
| Contenuto | conteggi di volontari, mezzi, materiali | il servizio, o il pernottamento, assegnato |
| Confronto con gli arrivati | si', e' il suo tratto distintivo | no |
| Modulistica PDF | no | si', complessiva e per turno |
| Come e' fatta | tre `list()`, tutto in memoria | SQL pivot + classe `report`, sola lettura |

Sono tre dashboard PHP (`by-service`, `vehicles-by-service`,
`by-overnight-stay`) servite dallo stesso `pre-accreditations.inc.php`, che si
distinguono leggendo `$_REQUEST['dashboard']`. Rispondono a "chi fa cosa e
quando"; la SPA risponde a "quanti ne aspetto e quanti ne sono arrivati".

Gli endpoint API del plugin hanno spec proprie sotto [`specs/api/`](specs/api/).

## Manuale utente

**Il pulsante *Manuale* del tab AIUTO apre ora `guide.php`**, cioe' la guida in Markdown
(§Guide per pagina, piu' sotto). **`docs/<lingua>/manual.odt` non e' piu' un sorgente: e' generato**
da `php docs/build-guide.php` a partire da quei Markdown, e sostituisce il vecchio manuale scritto a
mano (non si modifica: si rigenera). Quanto segue descrive il **vecchio flusso**, che serviva
quando il sorgente era l'`.odt`; resta documentato perche' `docs.php` e `html/` esistono ancora, ma
l'HTML in `docs/<lingua>/html/` e' quello del vecchio manuale e non e' piu' linkato dal programma.

Il vecchio manuale per gli operatori stava in `docs/<lingua>/`. **Il suo sorgente era
`manual.odt`** (LibreOffice); `html/manual.html` era l'esportazione che
`docs.php` serve. Si modificava l'`.odt` e si riesportava l'HTML: ritoccare solo l'HTML faceva
divergere i due file.

**Si rigenera con il CLI del framework**, non a mano:
`generate-plugin-docs segreteria-campo it` (i percorsi sono relativi alla
cartella che contiene `plugins/`). Cancella `html/` e la ricrea con la libreria
`lebedevsergey/odt2xhtml`, che sta nel `vendor`. L'export e' deterministico:
rigenerato dall'`.odt` del 12 luglio 2026 ridava HTML, CSS e icone **identici**
byte per byte. Due conseguenze: il CSS (`manual.css`) e' generato, quindi un
ritocco di presentazione va in `docs.php` (cosi' le didascalie "Table1" che la
libreria stampa sopra le tabelle sono nascoste li'); e un elenco annidato
eredita lo stile del genitore, perche' la libreria ignora quello dichiarato
sul livello interno.

Il manuale e' scritto per compiti dell'operatore (procedure P01-P24), non per
SPA, ma ogni SPA ha un capitolo sotto *Gestione evento*:

| SPA | Nel manuale |
|---|---|
| Massive Check-in | *Check-in massivo* |
| Org Status | *Stato registrazione* |
| Massive Check-out | *Check-out massivo* |
| Movimentazione risorse | *Movimentazione risorse*, procedura P05 |
| Gestione interventi | *Gestione interventi* |
| Squadre dichiarate | *Squadre dichiarate* (e il paragrafo *Squadre dichiarate sul kanban* in *Movimentazione risorse*) |
| Gestione richieste | *Richieste*, procedura P13 |
| Comunicazioni live | *Comunicazioni live* |
| Mappe | *Mappe* |
| Riepilogo preaccreditamenti | *Riepilogo preaccreditamenti* |
| Gestione servizi | *Gestione servizi*, procedura P05 |
| Movimentazione consumabili, Gestione magazzini | *Consumabili e magazzini* |
| Database risorse | *Database risorse* |
| Smart Assistant | *L'assistente intelligente* |
| modalita' totem | *Modalita' totem* |
| Import Wizard | una frase in *Dati di esempio* |

**Hanno gia' la guida Markdown** (§Guide per pagina): tutte le SPA con una vista
tranne Import Wizard, che renderizza inline e non ha una cartella sotto `views/`.
Per queste e' la guida `views/<spa>/guide.it.md` ad aggiornarsi per prima; il capitolo
dell'`.odt` resta finche' il manuale non viene ritirato. Le **dashboard PHP senza SPA**
hanno la guida in `views/dashboards/<id>/`: Report (`m1`) e Riepilogo ospiti (`01`),
Attestati (`27`, `28`), le quattro pagine dei preaccreditamenti, Controllo dati (`ic1`)
le mappe dei servizi (`12`, `12l`, e la pagina `m7` che le raccoglie) e le pagine di
configurazione e server (`05`, `06`, `00`, `30`, `31`).
`php docs/check-guides.php` elenca in fondo le altre dashboard raggiungibili che ne sono
prive: oggi `22`-`26` (pianificazione, il cui tab e' commentato in `menu.xml`), `iw`
(Import Wizard) e `gmap`/`omap` (GeoTracker, altra applicazione).

I capitoli del manuale in Markdown sono stati scritti dal vecchio manuale, dalle specifiche e dalle
guide delle pagine, **non verificati contro l'interfaccia in uso**: dove non c'e' certezza il testo
porta il segnaposto `[DA VERIFICARE]`, evidenziato in giallo. Il controllo di coerenza li conta
(`--release` li rifiuta): va risolto ciascuno prima di considerare il manuale pubblicabile.

### Guide e manuale (Markdown)

Il manuale e' fatto di **una guida per ogni pagina** (SPA, o dashboard PHP senza SPA), in
Markdown, scritta accanto al codice che descrive, e di capitoli che le collegano. Tutte le SPA con
una vista hanno la guida; il manuale `.odt` scritto a mano non c'e' piu'.

**La fonte unica e' il Markdown**: la guida generale (`generale.md`) e i capitoli in
`docs/guide/<lingua>/manuale/` raccontano l'evento per fasi — preparare, accreditare, gestire,
tracciare, rendicontare, piu' l'accoglienza solo per chi ospita civili — e rimandano con `guide:`
alle guide delle pagine. `.odt`, PDF o HTML sono **derivati** da produrre da `guide.json` e dai
Markdown (solo `.odt`, vedi [`specs/guide/`](specs/guide/)); non si modificano a mano. **Un comando
solo**: `php docs/build-guide.php` controlla le guide e poi scrive `docs/<lingua>/manual.odt`
(`--release` per una versione: nessun `[DA VERIFICARE]`, nessun avviso, numeri di pagina
nell'indice tramite LibreOffice). Se il controllo non passa, l'`.odt` non si genera.

| File | Cosa |
|---|---|
| `views/<spa>/guide.<lingua>.md` | la guida di quella SPA |
| `views/dashboards/<id>/guide.<lingua>.md` | la guida di una dashboard PHP senza SPA, una per id (`dashboard_<id>.inc.php`); nell'indice e' `"view": "dashboards/<id>"` |
| `docs/guide/<lingua>/generale.md` | la **radice** del manuale: come si legge e l'indice dei capitoli |
| `docs/guide/<lingua>/manuale/<capitolo>.md` | i capitoli (Parte I `01`-`02`, Parte II `03`-`09` (il 9 e' l'indice delle procedure per compito), Parte III `A`-`G`); nell'indice sono `"view": "manuale/<capitolo>"` con `file` |
| `docs/guide/guide.json` | l'indice: lingue, radice, capitoli e guide delle pagine, nell'ordine del manuale |
| `views/shared/guide.js` | parser Markdown, pannello «?», pagina del manuale (menu laterale, ricerca, «Apri la pagina») |
| `guide.php` | il manuale completo: tutte le guide in una pagina; lo apre il pulsante *Manuale* del tab AIUTO |
| `guide-links.js` | il piccolo «?» accanto ai pulsanti delle dashboard che aprono una pagina con guida, e il «?» fisso dentro le dashboard senza SPA |
| `docs/check-guides.php` | il controllo di coerenza |
| `docs/build-guide.php` | controllo + generazione di `docs/<lingua>/manual.odt` |

Una SPA elencata in `guide.json` riceve da `app-boot.js` un pulsante «?» in basso
a destra (mai in modalita' totem) che apre la guida in un pannello. In un wizard
il pannello si apre sul passo in cui si e' e lo segue quando si avanza. Nelle
dashboard, `guide-links.js` aggiunge accanto al pulsante che apre quella SPA un
«?» discreto che apre lo stesso pannello: lo trova dal browser, quindi basta
elencare la SPA in `guide.json`. Specifica in [`specs/guide/`](specs/guide/).

Per chi scrive una guida:

* **il grassetto e' testo come lo mostra l'interfaccia** (un pulsante, un campo,
  un messaggio): l'enfasi va in *corsivo*. `N` in un'etichetta vale per un numero
  o un'interpolazione (`Applica a N`);
* ogni passo di un wizard ha una sezione `{#passo-N}`: un identificativo stabile,
  uguale in tutte le lingue;
* si usa il sottoinsieme di Markdown che `guide.js` capisce (elencato in testa al
  file);
* cio' che non si e' potuto confermare porta `[DA VERIFICARE]`, evidenziato anche senza
  apici inversi; una versione (`build-guide.php --release`) non ne ammette;
* la pagina va aggiunta a `guide.json`, altrimenti non ha il pulsante; il suo **Apri la
  pagina** punta a `?dashboard=<id>` ricavato da `view` (o dal campo `page`);
* un capitolo che nomina una pagina la richiama con `guide:<vista>` invece di ripeterne la spiegazione.

`php docs/check-guides.php` verifica che ogni grassetto compaia nel codice della
SPA, che i wizard abbiano tutti i passi e che i collegamenti esistano. E' il
controllo che il manuale non poteva fare: vede i pulsanti *dentro* le SPA. Per una
guida di dashboard PHP il testo cercato e' `dashboard_<id>.inc.php` piu' i file del
campo `source` della voce in `guide.json`; un'etichetta composta a runtime va in
corsivo.

**Lingue.** `guide.<lingua>.md`, con ripiego sulla lingua predefinita
dell'indice. La guida italiana e' la fonte: le traduzioni si controllano sugli
identificativi, non sulle etichette, perche' l'interfaccia e' tutta in italiano.
La lingua della pagina non arriva ancora alle SPA (`APP_CONFIG` ha solo
`baseUrl` e i parametri dell'API): `guide.js` legge `APP_CONFIG.lang`, poi
`<html lang>`. Per valorizzare `APP_CONFIG.lang` serve una riga in
`mountMiniApp` (`camila/ui.class.inc.php`, framework).

### Regola di allineamento

Se una modifica cambia cio' che l'operatore **vede o fa** — un'etichetta, la
posizione di un pulsante, un passo di un wizard, un campo — si aggiornano nello
stesso intervento la specifica (`use-case.md`) **e** quel che la descrive per
l'operatore: la guida della pagina (`views/<spa>/guide.it.md` o
`views/dashboards/<id>/guide.it.md`) **e** i capitoli di `docs/guide/it/manuale/` che la
nominano o ne descrivono il comportamento (si cerca il nome della pagina). Una pagina nuova
va aggiunta alla tabella di copertura qui sopra e a `guide.json`, con la sua guida.

Prima di chiudere si lancia `php docs/build-guide.php` (il controllo di coerenza, poi la
generazione dell'`.odt`) e si riportano le voci che la modifica ha toccato. Il `.odt` e' un
derivato: si rigenera, non si modifica.

Se la guida non viene aggiornata — perche' manca la sezione, o perche' non si sa ancora come
si comporta l'interfaccia — **lo si dichiara in chiusura**, con la guida o il capitolo interessato
e il testo proposto, oppure si lascia un `[DA VERIFICARE]` nel punto. Non si lascia la guida
indietro in silenzio: e' la stessa regola di §Specification-Driven Development, applicata a un
terzo documento.

Le modifiche che non cambiano nulla per l'operatore (refactoring, prestazioni,
correzioni interne) non toccano le guide.

### Controllo di coerenza

`docs/check-guides.php` (lanciato da `docs/build-guide.php`, vedi sopra) verifica le guide in
Markdown contro il codice: ogni grassetto e' nel codice della pagina, i collegamenti e le pagine
esistono, i wizard hanno tutti i passi. E' di sola lettura ed esce con 1 se trova qualcosa.
Dice se un'etichetta c'e', **non** se la procedura e' descritta bene.

Il vecchio `docs/check-manual.php`, che confrontava il manuale `.odt` scritto a mano con
l'interfaccia, e la bozza `docs/it/manual-aggiornamento.md` sono stati tolti: non vedevano i
Markdown e il `.odt` e' ora generato.

Una spec directory contiene:
- `use-case.md` — comportamento atteso (il "cosa"): goal, attori, scenario principale, flussi alternativi in stile Cockburn
- `design.md` — scelte tecniche (il "come"): state shape, tabelle coinvolte, logica di merge/verifica, payload

**La copertura non è ancora completa.** Allo stato attuale:

- senza `use-case.md`: `import-wizard`, `map-center`, `requests-board`
- senza `design.md`: nessuna

Quando si modifica una SPA la cui spec manca, scrivere il file mancante seguendo la struttura in §Specification Style prima o insieme alla modifica.

If implementation and specification disagree, report the discrepancy. Do not silently change behavior.

---

## Specification Style

When writing specs for a new or existing SPA, follow this exact structure.

### use-case.md — il "cosa"

Cockburn-style use case with the following sections, in order:

1. **Identificativo** — short code (UC-XXX) and one-line description
2. **Contesto di sistema** — where this SPA fits in the operational workflow (skip if standalone)
3. **Goal** — one paragraph, user-facing outcome
4. **Primary Actor** — who operates it
5. **Stakeholders e interessi** — table: stakeholder | interest
6. **Precondizioni** — bullet list
7. **Postcondizioni — Successo** — what is true after success
8. **Postcondizioni — Errore/Fallimento parziale** — what happens on partial failure
9. **Classificazione stati** *(if applicable)* — table mapping data conditions to UI labels (e.g. in servizio / non in servizio / dati incompleti)
10. **Main Success Scenario** — one sub-section per wizard step or view, with numbered steps describing actor actions and system responses
11. **Extensions** — coded as `Na.` (step N, alternative a), covering: empty states, API errors, validation failures, navigation guards, partial failures

Rules:
- Steps describe observable behavior, not implementation details
- Do not mention lit-html, state variables, or JS internals
- Do mention WorkTable table names, field names, and business rules
- Keep each step to one sentence where possible

### design.md — il "come"

Technical reference for implementors, with sections:

1. **Struttura** — wizard steps or views with ASCII flow diagram
2. **State shape** — full JS object with all keys and their types/defaults
3. **Tabelle coinvolte** — table: operation | WorkTable table name
4. **Logica di merge** *(if applicable)* — merge key, priority rules, field resolution strategy
5. **Payload** — exact field names and values written to each table
6. **Logica di classificazione** *(if applicable)* — code-level rules for categorizing records
7. **Altre note tecniche** — anything else an agent needs to preserve: loading strategy (`allSettled` vs `all`), draft editing pattern, sequence API usage, filter strategy, non-obvious guard conditions

Rules:
- Use code blocks for state shape, payload examples, and classification logic
- Use tables for tabelle coinvolte
- Use WorkTable API field names (hyphenated, e.g. `data-fine-attestato`, not camelCase)
- Note divergences from the general patterns documented in this AGENTS.md

---

## Core Principles

### 1. Deterministic behavior

Generated code must behave predictably across reloads, repeated operations, pagination changes, filtering, sorting, and editing flows.

Avoid hidden state transitions and implicit side effects.

### 2. State safety

State must be explicit and reset when the active context changes.

Examples of context changes:

* selected table
* selected tab
* selected organization
* selected event
* selected record id
* editor mode
* wizard step

Do not reuse stale drafts or stale API responses across contexts.

### 3. Backward compatibility

Prefer additive changes.

Do not rename existing state keys, API fields, table names, or DOM assumptions unless explicitly instructed.

Do not remove existing behavior without a matching specification change.

### 4. No speculative refactors

Do not rewrite working code for style, abstraction, or framework preference.

Only refactor when required by the requested behavior or when explicitly instructed.

### 5. Explicit over generic

Prefer explicit mappings and configuration objects over generic magic.

Examples:

* explicit table names
* explicit field lists
* explicit label overrides
* explicit filterable columns
* explicit derived-field rules

---

# Frontend Runtime

## Rendering

Use `lit-html` templates.

Do not introduce:

* React
* Vue
* Angular
* Svelte
* Solid
* Alpine
* JSX build steps
* virtual DOM frameworks

Templates should be pure functions of state wherever possible.

## lit-html — `<select>` con valore dinamico

Il binding `.value` su un `<select>` **non è affidabile** in lit-html quando le opzioni sono dinamiche o caricate in modo asincrono. Il browser applica `.value` solo se l'opzione corrispondente esiste già nel DOM; se le opzioni arrivano dopo (es. fine chiamata API), il select ricade silenziosamente sul primo elemento.

**Regola:** usare sempre `?selected` su ogni `<option>`.

```js
// ❌ SBAGLIATO
html`<select .value=${current}>
  ${opts.map(o => html`<option value=${o}>${o}</option>`)}
</select>`

// ✅ CORRETTO
html`<select @change=${e => onChange(e.target.value)}>
  ${opts.map(o => html`<option value=${o} ?selected=${current === o}>${o}</option>`)}
</select>`
```

Questa regola si applica a tutti i `<select>` il cui valore o le cui opzioni dipendono da stato asincrono (servizi, mansioni, turni, categorie, ecc.).

**Eccezioni note**: due `<select>` con opzioni **statiche** usano ancora `.value`
e funzionano, perche' le opzioni sono gia' nel template quando lit-html applica
il valore: la tendina SI/NO di `massive-check-out/step2.js` (`siNoSelect`) e
quella "Per pagina" di `resource-manager/step1.js`. Il limite e' che lit-html
confronta con l'ultimo valore *applicato*, non con quello mostrato: un reset
dello stato verso quel valore, senza passare da uno diverso, lascerebbe la
tendina sulla scelta dell'utente. Se si aggiunge un reset o si rendono dinamiche
le opzioni, passare a `?selected`.

## Styling

Use:

* Bulma CSS
* Remix Icons

Do not introduce additional UI frameworks unless explicitly requested.

### Due fogli di stile, due ambiti

| File | Caricato da | Per cosa |
|---|---|---|
| `app.css` | `mountMiniApp()`, quindi solo dove c'e' una mini-app | stili delle SPA: tipografia ridotta sotto `#app`, righe selezionate, sola lettura |
| `dashboard.css` | `dashboards.inc.php`, quindi su **ogni** `?dashboard=` | cio' che vale anche per le pagine PHP senza SPA |

Una regola che deve valere anche fuori da `#app` va in `dashboard.css`: le
dashboard PHP non caricano `app.css`.

### `spa-title-box` — il primo box della pagina

Il primo box renderizzato va marcato `spa-title-box`: azzera gli spigoli
superiori e aggiunge un filetto, cosi' si salda alla tab bar che lo precede.

```html
<div class="box spa-title-box" style="padding:0;overflow:hidden;margin:0 0 1rem 0">
```

Vale per il primo box **effettivamente reso**, non per il primo che si incontra
nel sorgente: in un wizard e' il box di testata di ciascuno step. La regola sta
in `dashboard.css` perche' serve anche ai box emessi da `openBox()` nelle
dashboard PHP, che sono fratelli di `#app` e non discendenti — per questo il
selettore e' `#app .spa-title-box, .box.spa-title-box`.

**Eccezione**: `comms-feed`, `requests-board` e `smart-assistant` non hanno un
box di testata (usano un layout a flusso o a `card`), quindi non portano la
classe. Non e' una dimenticanza: la regola vale solo dove c'e' un box da
saldare alla tab bar.

### Gerarchia dei pulsanti nelle dashboard PHP

`insertButton()` rende un pulsante pieno (`is-primary`), `insertSecondaryButton()`
uno neutro. Il pieno marca le poche azioni che contano: con tutti i pulsanti
pieni non esiste un ordine di lettura.

La home e' divisa in **quattro** box, per criterio e non per tipo di oggetto.
**L'ordine segue la frequenza d'uso**, non il ciclo di vita: in evento si sta
quasi sempre nell'operativita', mentre arrivi e partenze arrivano a ondate.

| # | Box | Risponde a | Pulsanti |
|---|---|---|---|
| 1 | Operatività | cosa si fa ogni giorno | movimentazioni, interventi, richieste |
| 2 | Monitoraggio | come sta andando | comunicazioni live, mappe, report |
| 3 | Accreditamento risorse | chi entra e chi esce | check-in, riepilogo preaccreditamenti, stato registrazione, check-out, attestati |
| 4 | Anagrafiche | dati di riferimento | squadre dichiarate, i tre database risorse, servizi, magazzini |

**C'era un quinto box**, "Volontari / Mezzi / Materiali", con registrazione,
movimentazione ed elenco per ciascun tipo. E' stato rimosso: la registrazione la
fa il check-in massivo, la movimentazione ha la sua SPA in Operatività e ci
arrivano anche i link dei report (`?dashboard=02/03/04`), gli elenchi grezzi
restano raggiungibili dal WorkTable Explorer (plugin `worktable`). Non riaggiungerlo senza una ragione
nuova.

Nel box Anagrafiche le etichette sono **sostantivi semplici** — "Servizi", non
"Anagrafica servizi": il titolo del box lo dice gia'.

Nel box Monitoraggio i pulsanti sono **tutti secondari**: guardare non e' agire.
Il criterio e' il **flusso di lavoro dell'operatore**, non la natura tecnica
della SPA.

Gli **attestati** stanno sotto Check-out massivo perche' si producono alla
partenza: sono l'ultimo atto dell'arco, non una funzione dell'anagrafica. Li'
l'etichetta "Attestati" da sola non direbbe di chi, quindi sono "Attestati
volontari" e "Attestati mezzi". I materiali non ne hanno.

In Accreditamento stanno insieme le schermate dell'arco di
un'organizzazione — chi deve arrivare, chi e' arrivato, come sta messa, chi esce
— anche se due di esse (`pre-accreditations-summary` e `org-status`) sono di
sola lettura. La sola lettura decide semmai il **colore** del pulsante: sono
entrambe tonali.

Servizi, magazzini e squadre dichiarate scrivono eccome, ma sono dati di
riferimento: si impostano a inizio evento e si ritoccano di rado, quindi stanno
in Anagrafiche.

Dentro Anagrafiche l'ordine delle colonne e': squadre dichiarate a sinistra, i
tre database al centro, servizi e magazzini a destra.

Li' stanno anche i tre **Database risorse**, perche' `resource-manager` lavora
su `db-volontari`, `db-mezzi` e `db-materiali` — l'anagrafica permanente, che
esiste prima dell'evento e sopravvive dopo. Le tabelle di evento `volontari`,
`mezzi` e `materiali` le toccano check-in e check-out.

Sono gli unici pulsanti di Anagrafiche che **non** seguono la regola del
sostantivo semplice: "Database volontari", non "Volontari". In un box che
contiene anche "Squadre dichiarate", il solo "Volontari" si leggerebbe come i
volontari in campo — cioe' l'ambiguita' che lo spostamento serve a togliere.

Due classi sui box governano l'aspetto dei secondari:

| Classe | Resa | Dove |
|---|---|---|
| `sc-home` | tonale azzurro | box operativi |
| `sc-home-quiet` | grigio tenue | box di sola consultazione; oggi nessun box della home la usa (Anagrafiche resta `sc-home`) |

`openBox()` non accetta classi: il box si emette con `add_raw()`, come in
`dashboard_m0.inc.php`.

## Layout

Use responsive, non-fragile layouts.

Prefer:

* `flex-wrap`
* `min-width: 0`
* Bulma utility classes
* compact forms and tables for administrative screens

Avoid fixed widths unless needed for compact action columns.

## Module loading

SPA modules may be dynamically imported.

When the existing application uses cache-busting imports, preserve that behavior.

Example:

```js
import(`./views/my-module/step${n}.js?v=${VERSION}`)
```

`VERSION` must come from `window.APP_CONFIG?.version` with `Date.now()` as fallback:

```js
const VERSION = window.APP_CONFIG?.version || Date.now();
```

Do not introduce a bundler requirement unless explicitly requested.

## Moduli condivisi

Il codice usato da piu' viste sta in `views/shared/`. Oggi ci sono
`map-picker.js` (selettore di posizione su mappa, Leaflet + Nominatim),
`org-picker.js` (selezione multipla di organizzazioni con ricerca e filtro per
provincia) e `vocabularies.js` (elenchi di valori letti dalle colonne).
`spreadsheet.js` scrive file `.xlsx` e `.ods` dal browser, con il loro controllo (usato dall'esportazione
di `resource-manager`; vedi `specs/resource-manager/design.md` §7d).
`guide.js` rende le guide Markdown e il pannello «?» (vedi §Guide per pagina).

**Contratto**: un modulo condiviso non renderizza da se'. Esporta una fabbrica
che riceve `html` e un `rerender` dell'ospite, e restituisce un `template()`:

```js
export function createQualcosa({ client, html, rerender, onConfirm }) {
  let statoInterno = ...;
  function template(opzioni) { return html`…`; }
  return { template, load, /* … */ };
}
```

Cosi' lo stesso componente vive in viste diverse senza che due `render()`
si contendano la stessa radice.

Quando il componente deve agire **dopo** il render — montare una mappa, misurare
un nodo — espone un `afterRender()` che l'ospite chiama dentro il proprio
`rerender()`.

**Un modulo di soli dati** — `vocabularies.js` — non ha markup da comporre,
quindi non segue questa forma: esporta funzioni e tiene la propria cache. La
divergenza e' voluta e documentata in `specs/api/describe/design.md`.

**Non e' qui che sta lo scheletro delle SPA**: `app-boot.js` vive nella root del
plugin, accanto agli entry point che serve, perche' e' infrastruttura di avvio e
non un modulo che le viste importano. Vedere §SPA Entry Points.

**Cosa non mettere qui**: gli helper che ogni vista gia' duplica
(`getRecords`, `norm`, `normalizeApiError`, `userFriendlyErrorText`,
`withRetry`). La duplicazione e' la convenzione del plugin e un'estrazione
toccherebbe quindici file funzionanti.

### L'import deve essere dinamico

I moduli sotto `views/shared/` (e qualsiasi modulo importato da un'altra view)
vanno caricati **dinamicamente, con la versione in coda**:

```js
const VERSION = window.APP_CONFIG?.version || Date.now();

export async function MiaVista({ client, html, render, root }) {
  const { createMapPicker } = await import(`../shared/map-picker.js?v=${VERSION}`);
  ...
}
```

**Un `import` statico non funziona.** Il cache-busting del plugin vive nella
query string dell'`import()` dinamico che l'entry point usa per caricare la
view. Quella query **non si propaga**: le dipendenze importate staticamente
dalla view vengono richieste senza versione, il browser le mette in cache e le
modifiche smettono di comparire — anche dopo un refresh, perche' il file e'
tecnicamente lo stesso URL.

Il sintomo e' insidioso: la view si aggiorna, il modulo condiviso no, e si vede
codice vecchio in mezzo a codice nuovo.

Moduli che usano questo schema: `views/shared/map-picker.js`,
`views/shared/org-picker.js`, `views/resource-board/timeline.js` (la linea
temporale della disponibilita' delle squadre, usata da una sola vista ma tenuta
fuori da un `index.js` gia' enorme), e `views/team-manager/index.js` quando e'
incorporato in `intervention-manager`.

## Pannelli incorporabili

Una vista puo' vivere **sia come SPA a se' sia dentro un'altra**. Lo faceva
`team-manager`, che era la terza vista di `intervention-manager`; la vista e' stata
tolta ma la fabbrica `createTeamPanel` e' rimasta, ed e' lo schema da seguire.

Il file esporta due cose:

```js
// la fabbrica del pannello: non renderizza, compone
export async function createTeamPanel({ client, html, rerender, embedded = false }) {
  …
  return { template: view, start, reload };
}

// la SPA a se', che avvolge il pannello
export async function TeamManager({ client, html, render, root }) {
  let panel;
  const rerender = () => render(panel.template(), root);
  panel = await createTeamPanel({ client, html, rerender });
  await panel.start();
  return panel.template();
}
```

`embedded: true` omette box esterno e intestazione, che li mette gia' l'ospite.

**Avvio pigro**: l'ospite chiama `start()` alla prima apertura della vista, non
al mount, cosi' chi non la apre non paga le chiamate.

**Il pannello resta disaccoppiato** dal contesto che lo ospita: non legge ne'
scrive nulla dell'intervento aperto. E' cio' che permette di spostarlo o di
riattivarlo come pagina autonoma senza toccare il codice.

## Creazione in popup

Per le schede lunghe, la creazione avviene in una **finestra con i soli campi
essenziali**; il record nasce e viene subito selezionato nella scheda completa,
dove si prosegue.

Lo fanno `intervention-manager` (nome, oggetto, data segnalazione, comune,
provincia) e il pannello squadre (nome, organizzazioni, due conteggi).

Due conseguenze volute: non esiste uno stato "form in creazione", quindi la
scheda lavora sempre su un record salvato e il dirty check resta onesto; e la
popup va tenuta **minima**, perche' ogni campo aggiunto la riavvicina al form
completo da cui l'abbiamo separata.

## Si crea da dove serve, si gestisce dove appartiene

Quando da una scheda serve creare un oggetto che vive altrove, si offre la
**creazione**, non la gestione completa. La modifica resta nella SPA proprietaria,
raggiungibile da un collegamento.

| Da | Si crea | Si gestisce in |
|---|---|---|
| scheda intervento | nota di brogliaccio | `brogliaccio` (tabella) |
| scheda intervento | richiesta | `requests-board` |
| scheda intervento | squadra dichiarata | `team-manager` (Anagrafiche → Squadre dichiarate) |

Evita di avere due interfacce di modifica sugli stessi dati da tenere
allineate.

---

# SPA Entry Points

Each SPA lives in a single `app-<name>.js` file at the plugin root. **Il file e'
un guscio**: tutto il comportamento comune sta in `app-boot.js`.

```js
// app-comms-feed.js — Comunicazioni live
const VERSION = window.APP_CONFIG?.version || Date.now();

import(`./app-boot.js?v=${VERSION}`).then(({ mountSpa }) =>
  mountSpa({ view: "comms-feed", exportName: "CommsFeed" })
);
```

`mountSpa()` fa quello che prima ogni entry point copiava: trova `#app`,
verifica `WorkTableClient`, costruisce il client, importa la view con la
versione in coda, la renderizza, e mostra il box d'errore se qualcosa salta.
Importa anche `./no-pull-refresh.js`, quindi le SPA non devono piu' farlo.

| Opzione | Default | A cosa serve |
|---|---|---|
| `view` | — | cartella sotto `views/` |
| `exportName` | — | export nominale della view (vista singola) |
| `module` | `"index.js"` | file dentro quella cartella — serve a `smart-assistant`, che usa `home.js` |
| `steps` | `0` | numero di passi del wizard; `0` = vista singola |
| `state` | `{}` | stato iniziale, fuso su `{ step: 1 }` |
| `guards` | `{}` | `{ passo: (state) => boolean }`; falso rimanda al passo 1 |
| `loading` | `"blank"` | `"spinner"` per lo spinner al posto del div vuoto |

Un wizard carica `views/<view>/step<n>.js` e ne usa l'export `Step<n>`:

```js
mountSpa({
  view: "massive-check-out",
  steps: 4,
  state: { org: null },
  guards: { 2: (s) => !!s.org?.name, 3: (s) => !!s.org?.name },
});
```

**Le guardie si valutano a ogni render**, non solo nella transizione che porta
al passo: uno stato stantio o un reload non devono atterrare su un passo le cui
precondizioni non ci sono piu'.

### Perche' l'import di `app-boot.js` e' dinamico

`mountMiniApp()` emette `<script type="module" src="./plugins/<p>/app-<id>.js">`
**senza query string**: l'entry point e' l'unico file del plugin che il browser
cachea a tempo indeterminato. E' la ragione per cui questi file sono gusci e
tutto il resto passa da `import(...?v=VERSION)`. Un `import "./app-boot.js"`
statico erediterebbe quell'URL senza versione e congelerebbe anche il boot — la
stessa trappola descritta in §Moduli condivisi, qui con un piano in piu'.

Un `.then()` invece del `top-level await`: non c'e' un motivo di compatibilita'
forte, ma un TLA non supportato e' un errore di *parsing* che lascia la pagina
bianca senza passare dal guard-rail `<script nomodule>`, e i totem non sono
tutti uguali.

**Non convertito**: `app-import-wizard.js`, che renderizza inline e non ha una
view da caricare. E' l'unico entry point che tiene ancora il proprio
`showError`.

Una SPA non è raggiungibile finché non viene registrata lato PHP: vedere §SPA Registration (wiring PHP).

Single-view SPAs (no wizard) must not carry unused `step`, `org`, or wizard state.

---

# SPA Registration (wiring PHP)

Il modulo JS da solo non è raggiungibile. Per una SPA con id `<id>` servono quattro innesti PHP, tutti nella root del plugin.

**1. `<id>.inc.php` — mount del modulo**

```php
<?php
$camilaUI = new CamilaUserInterface();
$dir = __DIR__;
$pluginName = basename($dir);

$camilaUI->mountMiniApp($pluginName, '/app-<id>.js', '/app.css');
```

**2. `dashboard_<id>.inc.php` — voce di dashboard**

```php
<?php
require('<id>.inc.php');
```

**3. `conf/menu.xml` — aggiungere `<id>` all'elenco `<pages>` del tab che lo ospita**

Il routing vive in `dashboards.inc.php`, che **delega** al dispatcher condiviso
`camila/views/plugin_dashboards.inc.php`. Quello risolve `?dashboard=<id>`
provando prima `dashboard-<id>.inc.php` col trattino e poi
`dashboard_<id>.inc.php` con l'underscore, che e' la forma usata da tutti i file
di questo plugin. Il default e' il primo `<tab>` di `conf/menu.xml`, non `m0`
cablato, e un id `<plugin>--<dashboard>` punta a un altro plugin.

**4. `dashboard_m0.inc.php` — pulsante di accesso**

```php
$camilaUI->insertButton('?dashboard=<id>', 'Etichetta visibile', 'icona-remix');
```

L'ultimo argomento è un nome di icona Remix **senza** prefisso `ri-` e senza suffisso
(`login-box`, `file-list-3`, `route`, `inbox`, …).

## Eccezioni al wiring standard

Due SPA non seguono i quattro innesti:

* **Smart Assistant** non ha `.inc.php`, `dashboard_*` ne' voce in `menu.xml`:
  `dashboard_m0.inc.php` la monta direttamente con
  `mountMiniApp($pluginName, '/app-smart-assistant.js', '/app.css')`, perche'
  vive nella home e non ha una pagina propria.
* **Worktable Explorer** ha il pulsante in `dashboard_m2.inc.php` (tab
  CONFIGURAZIONE), non in `m0`, e punta con
  `?dashboard=worktable--worktable-explorer` all'explorer del plugin fratello
  `worktable`. **Questo plugin non ha piu' un proprio explorer**: file, specifica, guida e voce di
  `menu.xml` sono stati tolti. Per questo il pulsante non ha il «?» delle guide: la guida, se c'e', sta
  nel plugin `worktable`.

## Modalità totem

`dashboard_m0.inc.php` riconosce l'utente totem con (la soppressione del menu
di navigazione sta invece nel dispatcher condiviso `plugin_dashboards.inc.php`,
non in `dashboards.inc.php`):

```php
$_isTotemUser = strncasecmp($_CAMILA['user'] ?? '', 'totem', 5) === 0;
```

Per un utente totem il menu di navigazione non viene stampato e `dashboard_m0.inc.php`
mostra un ramo alternativo con i soli pulsanti kiosk, con `&totem=1` in query string.
Lato JS la modalità si legge così:

```js
const totemMode = new URLSearchParams(window.location.search).get("totem") === "1";
```

Aggiungere una SPA al ramo totem solo se richiesto esplicitamente.

---

# Navigation

Navigation is usually manual and state-driven.

Allowed patterns:

* wizard-style `state.step`
* tab-based `state.activeTab`
* explicit `goTo(step)`
* full reload when browser history consistency is at risk

Avoid introducing a router framework.

Prefer full reload over complex history manipulation when consistency matters.

---

# Data Access

All WorkTable data access must use `WorkTableClient`.

Allowed table-bound operations:

```js
client.table(tableName).list(query)
client.table(tableName).read(id)
client.table(tableName).create(payload)
client.table(tableName).update(id, payload)
client.table(tableName).remove(id)
client.table(tableName).describe(query)
client.table(tableName).permissions(query)
client.table(tableName).sequence(query)
client.table(tableName).distinct(column, query)
client.table(tableName).uploadAttachment(id, file)
client.table(tableName).fetchAttachment(id)
client.table(tableName).hasAttachment(id)
client.table(tableName).listAttachments()
client.table(tableName).deleteAttachment(id)
client.table(tableName).attachmentUrl(id)
```

Allowed public operations:

```js
client.list(tableName, query)
client.read(tableName, id)
client.create(tableName, payload)
client.update(tableName, id, payload)
client.remove(tableName, id)
client.describe(tableName, query)
client.permissions(tableName, query)
client.sequence(tableName, query)
client.distinct(tableName, column, query)
client.tables(query)
client.importTable(name, filepath, sheet)
client.importTableUpload(name, file, sheet)
client.call(method, path, body, query)
client.filter(column, operator, ...values)
client.negate(operator)
```

Do not introduce alternative API clients or abstraction layers unless explicitly requested.

## Endpoint custom del plugin

Gli endpoint non-CRUD vivono in `api/handlers.inc.php`, che ritorna una mappa
`"<VERB> /<path>" => handler`. Base path lato client:
`/app/segreteriacampo/cf_api.php/segreteria-campo`.

```php
// privato (sessione Camila)
'GET /status' => function(array $params, ?array $body, array $path): array {
    return ['status' => 'ok'];
},

// pubblico (auth propria, es. Basic Auth)
'POST /telegram/webhook' => [
    'public'  => true,
    'handler' => function(array $params, ?array $body, array $path): array { ... },
],
```

Regole:

* un handler ritorna sempre un array; `__status` imposta lo status HTTP
  (`['__status' => 500, 'message' => '...']`)
* `'public' => true` disattiva il controllo di sessione: l'handler deve allora
  implementare la propria autenticazione (vedere `/radio/*`, Basic Auth con
  credenziali da `var/segreteria-campo-*.json`)
* passare ogni testo libero in `sc_utf8_sanitize()` prima dell'insert: le colonne
  sono `utf8`, non `utf8mb4`, e i caratteri a 4 byte (emoji) fanno fallire la query
* accesso DB tramite `CamilaWorkTable` + `$_CAMILA['db']`; i nomi worktable nelle
  query SQL usano la sintassi `${NOME TABELLA.NOME COLONNA}`

Lato SPA si chiamano con `client.call()`:

```js
const res = await client.call("GET", "/segreteria-campo/totem/organization-codes");
```

Endpoint attuali: `/telegram/webhook`, `/totem/organization-codes`, `/radio/health`,
`/radio/messages`, `/import/examples`, `/status`. Spec in [`specs/api/`](specs/api/).

## Operazioni già in uso

Queste non sono estensioni da introdurre: fanno già parte della superficie esercitata dalle SPA esistenti.

| Operazione | Usata da |
|---|---|
| `sequence()` | `views/massive-check-in/step6.js`, `views/resource-manager/step2.js` — prefill di id progressivi |
| `call()` | lookup codice totem in check-in / check-out / org-status; `views/smart-assistant/home.js` |
| `importTable*`, `tables()` | `app-import-wizard.js` |
| `permissions()` | `views/resource-manager/step1.js` (unica SPA con read-only fallback) |

---

# WorkTable Query Rules

## Listing records

```js
client.table(tableName).list({
  include,    // string | string[]  — campi da restituire
  exclude,    // string | string[]  — campi da escludere
  filters,    // Array              — filtri AND (vedi §Filtering)
  orFilters,  // Object             — filtri OR (vedi §Filtering)
  order,      // Array              — ordinamento (vedi §Sorting)
  size,       // number             — max righe senza paginazione
  page,       // number | number[]  — paginazione (vedi §Pagination)
})
```

### include / exclude

```js
// array di nomi campo
client.table("servizi").list({ include: ["nome", "ordine", "colore"] })

// stringa separata da virgola (equivalente)
client.table("servizi").list({ include: "nome,ordine,colore" })

// escludere campi pesanti
client.table("servizi").list({ exclude: ["note", "descrizione"] })
```

### size

Usare `size` solo quando la paginazione non serve. Imposta il massimo di righe restituite in una sola chiamata.

```js
client.table("servizi").list({ size: 9999 })   // tutti i record
client.table("brogliaccio").list({ size: 1 })  // solo 1 record
```

## Sorting

Usare l'ordinamento server-side tramite il parametro `order`.

**Formato:** array di array `[campo, direzione]`

```js
// un solo campo
order: [["data/ora", "desc"]]

// più campi
order: [["cognome", "asc"], ["nome", "asc"]]
```

Direzioni supportate: `"asc"` | `"desc"`

**Esempio pratico — ultimo record inserito:**

```js
client.table("brogliaccio").list({
  include: ["data/ora"],
  size: 1,
  order: [["data/ora", "desc"]]
})
```

Se l'ordinamento server-side non è supportato dalla tabella, ordinare client-side con un sort stabile usando l'indice originale come tiebreaker.

## Filtering

Costruire filtri con `client.filter(column, operator, value)` che ritorna un array `[column, operator, value]`.

Passare i filtri come array al parametro `filters` (AND logico):

```js
client.table("volontari").list({
  filters: [client.filter("servizio", "eq", "TURNO A")]
})
```

**⚠️ IMPORTANTE:** usare sempre `filters: [...]` — la sintassi `filter: { campo: valore }` è silenziosamente ignorata dal client.

### Operatori confermati

| Operatore | Significato |
|---|---|
| `eq` | uguale |
| `neq` | diverso (`negate("eq")`) |
| `cs` | contiene stringa (case-sensitive) |
| `sw` / `ew` | inizia con / finisce con |
| `gt` / `gte` | maggiore di / maggiore o uguale |
| `lt` / `lte` | minore di / minore o uguale |
| `is` | IS NULL (`"null"`) / IS NOT NULL (`"notnull"`) |
| `in` | in lista (valori multipli) |
| `bt` | between (due valori) |

Per negare un operatore: `client.negate("eq")` → `"neq"`

In pratica le SPA esistenti usano **solo `eq`**. Gli altri operatori sono supportati
dal client ma non ancora esercitati contro queste tabelle: verificare il risultato
prima di darlo per acquisito.

Riferimento completo del client: [`specs/api/worktable-client.md`](specs/api/worktable-client.md).

### Filtri OR

Passare i filtri OR tramite il parametro `orFilters` (oggetto con chiavi `filter1`, `filter2`, ...):

```js
orFilters: {
  filter1: ["campo", "eq", "valoreA"],
  filter2: ["campo", "eq", "valoreB"],
}
```

## Pagination

```js
// pagina 1, 50 record per pagina → ?page=1,50
page: [1, 50]

// oppure solo numero di pagina
page: 2
```

**Risposta paginata attesa:**

```json
{
  "records": [...],
  "results": 150
}
```

`records` = record della pagina corrente. `results` = totale record senza paginazione.

Normalizzare sempre la risposta con:

```js
function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}
```

## Distinct values vs list with include

Usare `distinct()` per valori deduplicati su una singola colonna:

```js
client.table("volontari").distinct("codice-organizzazione", {
  include: "codice-organizzazione,organizzazione"
})
```

Usare `list()` con `include` e `size` quando serve unire sorgenti multiple o il distinct non espone tutti i campi necessari:

```js
client.table(tableName).list({
  include: ["organizzazione", "codice-organizzazione", "provincia"],
  size: 5000
})
```

When merging from multiple sources, use a `Map` keyed on a stable composite key to deduplicate:

```js
const map = new Map();
for (const row of rows) {
  const key = [norm(row.org), norm(row.code)].join("|");
  if (!map.has(key)) map.set(key, row);
}
```

Distinct values should be cached in state and reused across tabs or steps when appropriate.

## Parallel loading with partial fallback

When loading from multiple tables in parallel, use `Promise.allSettled` so that one failure does not block the other results:

```js
const results = await Promise.allSettled([
  withRetry(() => loadFromTableA(client)),
  withRetry(() => loadFromTableB(client))
]);

const dataA = results[0].status === "fulfilled" ? results[0].value : [];
const dataB = results[1].status === "fulfilled" ? results[1].value : [];

const failures = results.filter(r => r.status === "rejected");
if (failures.length) {
  error = normalizeApiError(failures[0].reason);
}
```

## Permissions

Use permissions to determine whether create, update, and delete actions are enabled.

Example response:

```json
{
  "table": "eventi",
  "id": "1",
  "can": {
    "create": true,
    "read": true,
    "update": true,
    "delete": true
  }
}
```

If the permissions request fails, the UI must enter read-only mode.

Create, edit, and delete actions must be disabled or hidden in read-only mode.

---

# Error Handling

Every API operation must handle failure.

At minimum:

* show an error message
* avoid corrupting state
* keep the UI usable when possible

## La sessione decaduta e' il caso piu' frequente

Un 403 con `code: 1012` e messaggio `Authentication failed for '<sessid>(1)'`
**non e' un guasto**: e' la sessione che non vale piu'.

Come funziona davvero, perche' la configurazione inganna: `cf_api_controller`
imposta `apiKeyDbAuth.apiKeyColumn = 'token'`, ma quando la richiesta porta
l'header `Authorization` — e le SPA lo portano sempre — il middleware **ignora
il valore dell'header**, fa `session_start()` e cerca l'utente la cui colonna
**`session_id`** vale `session_id()` (`api.include.php:4805`). Quella colonna
tiene **una sola sessione per utente** e viene scritta **al login**
(`header.php:234`), non a ogni pagina. Quindi un secondo accesso dello stesso
utente da un altro browser se la prende, e tutte le schede aperte prima
smettono di essere riconosciute.

Ne discende la cosa da dire all'operatore: **ricaricare non basta**, perche' il
reload non riscrive `session_id`. Serve rifare l'accesso (`cf_logout.php`), e
questo mette fuori l'altra postazione — e' un ping-pong, non una convivenza.

**Si riconosce dal codice API, non dallo status**: 1011 (*Authentication
required*) e 1012 (*Authentication failed*). Lo status non basta, perche' 403 e'
anche 1014 *Operation forbidden*, che e' un rifiuto di permessi e non una
sessione morta: dirgli "esci e rientra" farebbe girare a vuoto l'operatore. Lo
status resta solo come ripiego quando la risposta non ha un corpo JSON.

`app-boot.js` lo riconosce da solo e, al posto del box rosso, mostra un box
giallo che nomina la causa e offre **Esci e rientra** piu' un **Ricarica**
secondario.

Le viste che disegnano un **proprio** box d'errore lo dicono a parole, con la
stessa frase:

* nelle cinque copie di `userFriendlyErrorText`, il ramo `auth` sceglie fra la
  frase di sessione (codici 1011/1012) e *Permessi insufficienti per questa
  operazione.* (qualunque altro 401/403);
* in `map-center`, `resource-board`, `stock-manager`, `service-manager`,
  `warehouse-manager`, `resource-manager/step2` e `smart-assistant` un
  `errorText()` / `isSessionError()` locale fa lo
  stesso per il box *Errore caricamento*, e in caso di sessione morta aggiunge
  il pulsante **Esci e rientra** (`cf_logout.php`, relativo: le pagine stanno
  accanto a quel file) prima di *Riprova*, che da solo non riaggancia la
  sessione. Prima stampavano il messaggio grezzo dell'API
  (`Authentication failed for '…(1)'`), o addirittura `HTTP 403`.

**Ogni vista che chiama l'API conosce il caso sessione** (verificato con un
controllo sul codice 1011 in tutte le viste). Lo schema e' sempre lo stesso: un
`isSessionError()` locale che guarda `err.payload.code`, la frase
`SESSIONE_NON_VALIDA`, il box giallo (`is-warning`) al posto del rosso e il
pulsante **Esci e rientra**. Due varianti da conoscere:

* **errori per riga** — `massive-check-in` step 3, 5 e 7 scrivono un'operazione
  per riga, e se la sessione muore falliscono tutte. Ogni riga dice solo
  *Sessione non piu' valida* (`SESSIONE_BREVE`) e la frase completa con il
  pulsante compare **una volta** sopra i contatori;
* **errori che viaggiano come stringa** — l'editing inline di
  `resource-manager/step1` passa il testo e non l'oggetto, quindi riconosce il
  caso confrontando con la frase.

Quando si aggiunge una vista che chiama l'API, aggiungere il caso sessione con
lo stesso schema. Nessun entry point deve piu' stampare `String(err.payload)`:
e' `[object Object]`.

**Il corpo dell'errore sta in `err.payload`**, che e' il JSON dell'API
(`{ code, message }`), non una stringa: `String(err.payload)` stampa
`[object Object]`, ed e' il bug che il box mostrava. Il testo si legge da
`err.payload.message`, con `err.message` (`"HTTP 403"`) come ripiego.

## Error normalization

Normalize all API errors into a standard shape before using them in UI logic:

```js
function normalizeApiError(err) {
  const raw = err?.payload ?? err?.response ?? err;

  const status = raw?.status ?? raw?.statusCode ?? err?.status ?? err?.statusCode;
  const code = raw?.code ?? err?.code ?? raw?.error?.code;
  const message =
    raw?.message ?? err?.message ?? raw?.error?.message ??
    (typeof raw === "string" ? raw : "Errore sconosciuto");

  let kind = "unknown";
  if (status === 401 || status === 403) kind = "auth";
  else if (status === 404) kind = "not_found";
  else if (status === 429) kind = "rate_limit";
  else if (status >= 500) kind = "server";
  else if (code === "ETIMEDOUT" || code === "ECONNABORTED") kind = "timeout";
  else if (code === "ENETUNREACH" || code === "ECONNRESET") kind = "network";

  return { status, code, message, kind, raw };
}
```

`kind` values: `auth`, `not_found`, `rate_limit`, `server`, `timeout`, `network`, `unknown`.

Map `kind` to user-visible text in a dedicated helper:

```js
function userFriendlyErrorText(e) {
  switch (e.kind) {
    case "auth":    return "Sessione scaduta o permessi insufficienti.";
    case "rate_limit": return "Troppe richieste. Attendi e riprova.";
    case "timeout":
    case "network": return "Problema di connessione. Controlla la rete.";
    case "server":  return "Il server sta avendo problemi. Riprova tra poco.";
    case "not_found": return "Risorsa non trovata.";
    default:        return "Si è verificato un errore durante il caricamento.";
  }
}
```

Always show a retry button alongside error messages in load contexts.

## Retry with exponential backoff

Retry transient failures (network, timeout, server, rate_limit) with exponential backoff:

```js
const sleep = ms => new Promise(r => setTimeout(r, ms));

function shouldRetry(e) {
  return ["network", "timeout", "server", "rate_limit"].includes(e.kind);
}

async function withRetry(fn, { retries = 2, baseDelay = 400 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      last = normalizeApiError(err);
      if (attempt === retries || !shouldRetry(last)) throw last;
      await sleep(baseDelay * Math.pow(2, attempt) + Math.floor(Math.random() * 150));
    }
  }
  throw last;
}
```

Do not retry `auth` or `not_found` errors.

## Permission lookup failure

If the permissions request fails, fall back to read-only mode.

Catalog lookup failure should not block basic page rendering:

* show fallback option
* show error help text when useful

---

# Async render safety

When an async load is in-flight and the user navigates away or changes context, avoid re-rendering into a stale root.

Use a `cancelled` flag:

```js
let cancelled = false;

async function load() {
  // ...
  if (!cancelled) rerender();
}

// on context change or cleanup:
cancelled = true;
```

This prevents stale async callbacks from overwriting a new view.

---

# State Management

## General rules

Use plain JavaScript state objects.

Do not introduce:

* Redux
* Zustand
* MobX
* Pinia
* external state machines
* implicit global stores

## State shape

Define only the state properties that the SPA actually uses.

Preserve existing state shape across modifications.

Prefer additive properties.

Example:

```js
state.step1 ||= {};
state.step2 ||= {};
state.master ||= {};
```

## Context reset

Reset or invalidate state when context changes.

Examples:

* changing tab resets pagination page
* changing filter resets pagination page
* changing sort resets pagination page
* changing editor record resets draft
* saving a record invalidates list cache

## Draft editing

Editors must use a draft object separate from the persisted base row.

Example:

```js
state.step2.baseRow
state.step2.draftRow
```

Do not mutate persisted rows directly while editing.

## Dirty detection

Dirty state should compare base and draft deterministically.

Use stable serialization or explicit field comparison.

---

# UI Behavior

## Lists

List pages should support:

* loading state
* empty state
* error state
* pagination when needed
* sorting
* filtering
* permission-aware actions

Filters and pagination controls must remain visible even when no records are returned.

## Tables

Administrative tables should usually be compact.

Recommended Bulma classes:

```html
<table class="table is-small is-narrow is-fullwidth is-hoverable is-striped">
```

Action buttons may be placed in the first column.

Use icons consistently:

* edit: `ri-pencil-line`
* delete: `ri-delete-bin-6-line`
* add: `ri-add-line`
* save: `ri-save-line`
* back: `ri-arrow-left-line`
* read-only: `ri-lock-line`

## Forms

Forms must use controlled values.

Each visible field must read from state and write back to state.

Do not rely on uncontrolled DOM state.

## Derived fields

Derived fields must be explicit.

Example:

* user selects organization name
* frontend stores `organizzazione`
* frontend derives and stores `codice-organizzazione`

Derived fields must be kept synchronized in UI and before save.

If a selected value is no longer present in the catalog, render it as out-of-list rather than dropping it silently.

---

# Convenzioni sui dati

## Vocabolari: la fonte e' la colonna

Gli elenchi di valori (`stato`, `mansione`, `priorita`, `tipo`) sono definiti
nella worktable stessa, come `listbox_options` di una colonna
`string-listofvalues`. **E' quella la fonte**, non un elenco cablato in un'altra
SPA.

Prima di scrivere un vocabolario, leggerlo dalla definizione della tabella. Due
casi concreti di questa sessione: `servizi.stato` sembrava senza vocabolario
perche' nessuna SPA lo scriveva, e invece la colonna dichiarava
`,Segnalato,In corso,Concluso`; i tre vocabolari di `richieste` cablati in
`requests-board` combaciavano con la colonna, ma non c'era nulla che lo
garantisse.

Se un vocabolario va copiato in piu' punti, copiarlo **identico** e annotare da
dove viene: due elenchi divergenti danno due verita' sulla stessa colonna.

### Leggerlo, non copiarlo

Questi vocabolari **non** sono piu' copiati nelle viste: li legge
`views/shared/vocabularies.js` da `describe()`.

| Colonna | Chi la usa |
|---|---|
| `mezzi.categoria`, `.tipologia` | `massive-check-in/step4.js` |
| `materiali.categoria`, `.tipologia` | `massive-check-in/step6.js` |
| `db-mezzi.categoria`, `.tipologia` | `resource-manager` step 1 e 2 |
| `db-materiali.categoria`, `.tipologia` | `resource-manager` step 1 e 2 |
| `richieste.stato`, `.tipo-richiesta`, `.priorita` | `requests-board`, `intervention-manager` |
| `servizi.stato` | `intervention-manager` |
| `volontari.mansione` | `massive-check-in/step3.js`, `massive-check-out/step2.js` |
| `squadre-dichiarate.mansione-principale` | `team-manager` |
| `mov-consumabili.tipologia`, `.articolo`, `.unita-di-misura` | `stock-manager` |

E' la strada da seguire per i vocabolari nuovi.

Restano cablati, e non sono dimenticanze: `COLORI` e `LETTERE` (hanno accanto
una mappa di conversione in colore o un alfabeto per i marker, quindi non
basterebbe l'elenco), lo stato derivato di
`intervention-manager` — che il codice deduce da `inizio` e `fine` quando la
colonna `stato` e' vuota, e i tre nomi che la mappa dei colori usa per chiave.
Il vocabolario vero di `servizi.stato` lo legge comunque dal describe: cablati
sono solo i nomi usati come chiave. (`team-manager` non ha piu' nessuno stato
calcolato: quella classificazione e' stata rimossa.)

**Ogni tendina legge la colonna che poi scrive.** Offrire un valore che la
colonna di destinazione non ammette sarebbe sbagliato anche se un'altra tabella
lo ammette, quindi colonne omonime su tabelle diverse restano distinte e possono
legittimamente divergere:

* `volontari.mansione` e `squadre-dichiarate.mansione-principale`
* `mezzi.categoria` e `db-mezzi.categoria`, idem per i materiali — le tabelle di
  evento le scrivono check-in e check-out, le anagrafiche permanenti le scrive
  `resource-manager`

Nella riserva di `vocabularies.js` le coppie evento/anagrafica condividono **una
sola definizione** (`VOC_MEZZI`, `VOC_MATERIALI`) riferita da due chiavi: cosi'
non ci sono due copie da tenere allineate, ma a runtime ciascuno legge la
propria colonna.

**Come fa `describe()` a saperlo.** Di suo il controller `columns` di
php-crud-api riflette la tabella fisica — nome, tipo, lunghezza, nullabilita' —
e non conosce la configurazione Camila, dove gli elenchi vivono in
`CAMILA_TABLE_WORKC`. Il framework e' stato esteso perche' il describe **fonda
la configurazione dentro la colonna**: aggiunge cio' che manca e sovrascrive
cio' che c'e' gia'.

```json
{ "name": "tipologia", "type": "string-listofvalues", "dbType": "varchar",
  "length": 250, "nullable": true,
  "label": "TIPOLOGIA", "abbrev": "TIPOLOGIA", "sequence": 11,
  "required": false, "readonly": false, "unique": false, "visible": true,
  "maxlength": 255,
  "options": ["Non assegnata", "--VEICOLI", "AUTOCARRO", "…"] }
```

L'unica collisione reale e' `type`: per la riflessione e' il tipo SQL, per
Camila il tipo di campo. **Vince Camila**, ed e' il piu' informativo dei due; il
tipo SQL finisce in `dbType`, perche' serve a chi valida. `maxlength` e `length`
restano entrambi: il primo e' il massimo configurato, il secondo la dimensione
fisica della colonna.

La patch vive in `camila/api.include.php`, quindi nel framework e non qui.
Dettagli in [`specs/api/describe/`](specs/api/describe/).

Da sapere: nel describe esteso **`name` e' il nome pubblico** della colonna, e
il nome fisico non viene piu' esposto. Prima `name` era quello fisico e
`alias` quello pubblico — controintuitivo, e chi leggeva `alias` e `name`
dalla definizione vecchia (come faceva l'explorer, oggi in un altro plugin) leggeva i nomi
sbagliati.

Resta **una** copia di riserva, dentro `vocabularies.js`. Scatta se il describe
non risponde, o se risponde **senza** la configurazione — nessuna colonna con
`label` — perche' quello vuol dire "framework non esteso", non "nessun
vocabolario". Senza la riserva le tendine resterebbero vuote e l'operatore non
potrebbe classificare nulla.

Nel formato le categorie sono marcate `--Nome` dentro l'elenco delle tipologie,
e l'etichetta deve coincidere **carattere per carattere** con quella della
colonna `categoria`: l'associazione e' una `Map` esatta, quindi `--Veicoli`
contro `VEICOLI` lascia il filtro vuoto senza errori. Una virgola dentro un
valore lo spezza in due voci: e' il separatore e non c'e' escape.

## L'ordine delle colonne lo decide la worktable

Il describe esteso porta `sequence` su ogni colonna: e' l'ordine impostato sulla
scheda in Camila, ed e' **quello** a governare come le colonne compaiono nelle
tabelle delle SPA. Non un elenco cablato nel JS.

Lo fa oggi `resource-manager` (vedi `specs/resource-manager/design.md` §7c). Gli
elenchi cablati che restano — `PREFERRED_COLS` — valgono solo come riserva
quando il describe non e' esteso e come spareggio fra colonne con lo stesso
`sequence`.

Conseguenza pratica: **per cambiare l'ordine si tocca la configurazione, non il
codice**. E una colonna aggiunta alla worktable compare al posto giusto da sola,
invece di finire in coda in ordine alfabetico.

Corollario: se l'ordine configurato non e' quello che serve a chi guarda la
tabella — su `db-mezzi` i primi campi sono organizzazione e provincia, non la
targa — si sistema il `sequence` in Camila. Rimetterci un elenco nel JS
riporterebbe il problema dove stava.

L'utente puo' comunque riordinare e nascondere colonne per se': la preferenza
sta in `localStorage`, non sostituisce il default ma lo copre.

## Campi vuoti: `null`, non stringa vuota

Nei payload di `create` e `update`, un campo vuoto si invia come `null`:

```js
for (const k of EDITABLE) payload[k] = norm(form[k]) || null;
if (payload.ordine !== null) payload.ordine = parseInt(payload.ordine, 10) || null;
```

Ometterlo lascerebbe in tabella il valore precedente, quindi un campo svuotato
dall'operatore non si svuoterebbe mai. La stringa vuota su una colonna numerica
e' a rischio di rifiuto o di diventare zero.

**Eccezione per i campi obbligatori**: se vuoti, vanno omessi e non inviati a
`null`, altrimenti l'API li rifiuta. Vedere `requests-board`, dove solo
`assegnatario-richiesta`, `servizio` e `note` sono azzerabili.

## Chiavi funzionali per nome

Alcune relazioni passano per il **nome**, non per l'id:

| Chi referenzia | Cosa |
|---|---|
| `volontari.servizio`, `mezzi.servizio`, `materiali.servizio` | `servizi.nome` |
| `volontari.squadra`, `mezzi.squadra`, `materiali.squadra` | `squadre-dichiarate.nome` |
| `servizi.squadre-attivate` | nomi di squadre e organizzazioni |
| `brogliaccio.servizio`, `richieste.servizio` | `servizi.nome` |

Ne discende che il nome **non puo' essere vuoto**, che una rinomina **non si
propaga** — chi referenziava resta puntato al nome vecchio, e la SPA deve
avvisare — e che prima di eliminare va contato chi lo usa, bloccando se qualcuno
lo usa.

## Codici leggibili a voce

Un identificatore che un operatore dovra' dettare in radio o al telefono si
genera su un alfabeto **senza coppie confondibili**. Il codice intervento di
`intervention-manager` usa `ACDEFGHJKLMNPQRTUWXY3479` (24 simboli, 5
caratteri): fuori `B`/`8`, `I`/`1`, `O`/`0`, `S`/`5`, `Z`/`2`, `V`/`U`,
`6`/`G`.

Casuale, non sequenziale: un contatore rivela quante schede esistono e rende
indovinabile la prossima. L'unicita' si garantisce in due passi — un `Set` dei
valori gia' caricati, piu' una `list` filtrata sul codice candidato prima di
scrivere, per il caso di due operatori che creano nello stesso istante.

Se la verifica remota fallisce **si accetta comunque il codice**: l'elenco
locale ha gia' escluso le collisioni note e un errore di rete non deve impedire
la creazione del record.

## I file in `tables/xls/it/` non sono la fonte dei nomi di campo

Le worktable si modificano dall'interfaccia di Camila, quindi una colonna puo'
comparire dopo che la SPA e' stata scritta. I file in `tables/xls/it/` sono la
definizione **iniziale**, non lo stato corrente: `91_Servizi.xlsx` non ha ne' i
campi del referente ne' il codice intervento, che la tabella ha.

Prima di cablare il nome di un campo aggiunto di recente, **verificarlo contro
la tabella viva** — un `describe()`, o il payload di un record. Poi cablarlo
esplicitamente, come tutti gli altri (§Explicit over generic): una risoluzione a
runtime costa una chiamata a ogni mount e nasconde l'errore invece di mostrarlo.

Un campo che il sistema assegna e l'operatore non modifica va tenuto **fuori da
`EDITABLE`**, come gia' `id`:

```js
const CODE_FIELD = "codice-intervento";
const EDITABLE = FIELDS.filter(f =>
  f !== "id" && f !== "intervento" && f !== CODE_FIELD);
```

Altrimenti il ciclo `payload[k] = norm(form[k]) || null` di `save()` lo
azzererebbe a ogni salvataggio.

## Fotografia o riferimento

`mov-risorse` conserva `risorsa` e `gruppo` come **testo**, non come id: e' un
registro storico, non un collegamento. Un intervento di giugno deve continuare a
dire quale squadra fu attivata e con quali organizzazioni, anche se a settembre
quella squadra si e' ricomposta.

Quando un dato serve come **storia**, si copia il valore. Quando serve come
**stato corrente**, si legge la sorgente. Lo stesso oggetto puo' comparire in
entrambi i modi: `squadre-dichiarate.servizio` dice dov'e' adesso,
`servizi.squadre-attivate` dice chi ha lavorato li'.

La scrittura del movimento **non deve far fallire l'operazione principale**: se
fallisce, si avvisa e si tiene il salvataggio.

---

# CRUD Rules

## Create

Create actions must:

1. initialize a clean draft
2. populate required derived fields
3. call `create(payload)`
4. invalidate affected list cache
5. navigate back or refresh deterministically

## Update

Update actions must:

1. load the record by id
2. create a draft copy
3. save only after explicit user action
4. call `update(id, payload)`
5. invalidate affected list cache

## Delete

Delete actions must:

1. require explicit confirmation
2. call `remove(id)`
3. refresh or invalidate the list
4. handle empty page after deletion

Do not perform optimistic deletion.

---

# Security and Safety

Do not bypass permission checks in the frontend.

Frontend permissions are a UX guard only. Backend authorization remains authoritative.

Do not expose secrets or API keys in generated code.

Do not log sensitive payloads unless explicitly requested.

---

# Specification-Driven Development

Agents must consult project specifications before changing behavior.

Struttura effettiva:

```text
AGENTS.md
specs/
  <app-id>/
    use-case.md
    design.md
  api/
    worktable-client.md
    <endpoint-id>/
      use-case.md
      design.md
```

Use:

* `use-case.md` for product behavior (il "cosa")
* `design.md` for implementation decisions (il "come")

Il formato dei due file è definito in §Specification Style. In questo repository non
esistono `requirements.md`, `tasks.md` né `uispec/*.yaml`: non crearli e non cercarli.

If implementation and specification disagree, report the discrepancy.

Do not silently change behavior.

---

# Testing Expectations

For each generated or modified SPA page, verify:

* initial load
* empty list
* paginated list
* sorting
* filtering
* create permission
* update permission
* delete permission
* read-only fallback
* create flow
* edit flow
* delete flow
* API failure handling
* retry behavior
* derived field synchronization
* async render safety (no stale re-render after navigation)

Acceptance criteria should be derived from the SPA's `use-case.md` (sezioni Main Success Scenario ed Extensions) when available.

---

# Code Style

Prefer readable, explicit code.

Avoid excessive abstraction.

Use small helper functions for:

* response normalization (`getRecords`)
* error normalization (`normalizeApiError`)
* user-facing error text (`userFriendlyErrorText`)
* retry logic (`withRetry`)
* permission normalization
* pagination state
* stable sorting
* field derivation
* catalog loading

Keep helper behavior deterministic.

---

# Unknowns

Do not invent missing behavior.

If something is unknown:

* mark it as unknown in the specification
* ask for clarification when necessary
* otherwise implement the safest conservative behavior

Safe conservative defaults:

* read-only if permissions are unknown
* empty catalog if distinct lookup fails
* no mutation if record id is missing
* no destructive action without confirmation

---

# Non Goals

Do not introduce:

* frontend framework migrations
* global state managers
* optimistic sync
* speculative server validation
* hidden API conventions
* unrelated UI redesigns
* large-scale rewrites

without explicit instruction.
