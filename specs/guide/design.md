# Design — guide

## 1. Struttura

Infrastruttura condivisa, non una SPA: nessuna voce in `menu.xml`, nessun
`dashboard_*`.

```
views/<spa>/guide.<lingua>.md      guida di una SPA, accanto al suo codice
views/<spa>/guide/img/…            schermate di quella SPA (riferite con percorso relativo)
views/dashboards/<id>/guide.<lingua>.md   guida di una dashboard PHP senza SPA (`dashboard_<id>.inc.php`)
docs/guide/<lingua>/generale.md    la radice del manuale: come si legge e indice dei capitoli
docs/guide/<lingua>/manuale/*.md   i capitoli (Parte I `01`-`02`, Parte II `03`-`08`, Parte III `A`-`H`)
docs/guide/guide.json              indice: radice, capitoli e guide delle pagine, nell'ordine del manuale
views/shared/guide.js              parser + renderer + pannello + pagina del manuale (menu laterale, ricerca)
guide.php                          shell del manuale completo (nessuna sessione, come docs.php)
docs/build-guide.php               controllo + generazione dell'.odt, un comando solo
docs/build-manual.php              scrive docs/<lingua>/manual.odt da guide.json e dai Markdown
docs/odt-update-index.py           aiuto di --update-index: numeri di pagina nell'indice, tramite LibreOffice
docs/it/manual.odt                 il manuale generato (derivato: non si modifica a mano)
app-boot.js                        crea il pannello se la SPA e' nell'indice
guide-links.js                     il "?" accanto ai pulsanti delle dashboard
guide-version.inc.php              versione per la cache (usata da guide.php e dashboards.inc.php)
dashboard.css                      stile `.sc-help` del "?"
docs/check-guides.php              controllo di coerenza
```

```
mountSpa() ──> setupGuide() ──> fetch guide.json ──> la SPA e' elencata? ──> import guide.js
                                                                              │
                                              createGuideDrawer({ html, render, view, manifest,
                                                                  version, getAnchor })
```

## 2. Indice (`docs/guide/guide.json`)

```json
{
  "default": "it",
  "languages": ["it"],
  "general": { "it": "docs/guide/it/generale.md" },
  "guides": [
    { "view": "massive-check-in", "title": "Check-in massivo", "group": "Accreditamento risorse" }
  ]
}
```

L'ordine di `guides` e' l'ordine del manuale; `group` raggruppa le voci
dell'indice. Cinque campi facoltativi per voce:

| Campo | Effetto |
|---|---|
| `file` | percorso di una guida che non sta in `views/`, dalla radice del plugin, con `{lang}` al posto della lingua. Lo usano i **capitoli del manuale** (`docs/guide/{lang}/manuale/…`): il caricatore, il controllo e la versione lo conoscono. Senza `file` la guida e' `views/<view>/guide.<lingua>.md` |
| `source` | solo per le guide di dashboard PHP (`"view": "dashboards/<id>"`): file, dalla radice del plugin e con `*` ammesso, in cui `check-guides.php` cerca le etichette in grassetto oltre a `dashboard_<id>.inc.php`. Per esempio `reports/it/*.xml`, dove stanno i titoli dei report |
| `page` | dove si apre la pagina nel programma, per il pulsante **Apri la pagina** del manuale (`guide.php`). Se manca vale l'id della dashboard ricavato da `view` (`<view>` per una SPA, `<id>` per `dashboards/<id>`); `"page": "m0"` lo sposta (l'assistente vive nella home), `false` lo toglie. I capitoli (`file`) non l'hanno |
| `dashboard` | alias di `view` per `guide-links.js`, quando il pulsante della home non punta a `?dashboard=<view>`. Oggi non lo usa nessuna voce (lo usava il Worktable Explorer, il cui pulsante `?dashboard=worktable--worktable-explorer` punta al plugin fratello) |
| `"floating": false` | la SPA ha la guida (nel manuale e dietro i collegamenti) ma non il «?» fisso in basso a destra. Oggi lo usa `smart-assistant`, che vive nella home: un «?» li' si leggerebbe come aiuto di tutta la home |

E' scritto a mano (§Explicit over generic): una SPA che non e'
elencata non ha il pulsante, anche se il file esiste.

**Il manuale e' una guida generale piu' dei capitoli.** La fonte unica e' Markdown:
`docs/guide/<lingua>/generale.md` e' la radice (come si legge, indice dei capitoli) e i capitoli
stanno in `docs/guide/<lingua>/manuale/` — Parte I (`01`, `02`), Parte II (`03`…`08`, con
l'accoglienza `07` solo per chi ospita civili), Parte III (appendici `A`…`H`). Nell'indice sono
le prime voci di `guides`, con `view: "manuale/<nome>"` e `file`, e `group` "Parte …"; le guide
delle pagine seguono con `group` "Riferimento · …". Un capitolo racconta *quando e perche'* e
rimanda con `guide:` alla guida della pagina per il *come*. L'ordine dell'indice e' l'ordine del
manuale stampato.

Il formato `.odt` (o PDF, o HTML) e' un **derivato**: lo si produce da `guide.json` e dai Markdown,
con `docs/build-manual.php`, e non si modifica a mano. **Il file prodotto e' `docs/<lingua>/manual.odt`, lo stesso nome del vecchio manuale scritto a mano, che sostituisce** (una copia del vecchio e' stata tenuta fuori dal plugin). L'HTML in `docs/<lingua>/html/` che `docs.php` serviva viene dal vecchio manuale e non e' rigenerato: non e' piu' linkato. Il pulsante **Manuale** del tab AIUTO
(`dashboard_m4.inc.php`) apre `guide.php`; `docs.php`, con il vecchio `.odt`, resta ma non e' piu'
linkato.

**Il menu laterale di `guide.php`.** `renderManual` affianca al testo un menu `position: sticky` con
tutte le guide: le parti (i `group` del manifesto) come etichette, sotto ogni guida i suoi titoli di
secondo livello (`##`), chiusi a meno che la guida sia quella in lettura. Il testo scorre con la
pagina: la guida e la sezione correnti si evidenziano, la guida corrente si apre e le altre si
chiudono, e il menu scorre da solo se la voce evidenziata ne esce. Il calcolo e' un debounce di 60 ms
sull'evento `scroll` (un timer e non `requestAnimationFrame`, che non gira nelle schede in
background). Sotto i 960 px il menu e' un cassetto dietro il pulsante «Indice», che si chiude quando
si sceglie una voce; l'indice in testa al testo si vede solo in quel caso e in stampa. In stampa il
menu non c'e'.

**Il collegamento alla pagina.** Ogni guida di pagina, nel manuale, ha in alto a destra **Apri la
pagina ↗**, che apre `../../index.php?dashboard=<id>` (relativo alla radice del plugin, quindi vale per
qualunque indirizzo del server) in una nuova scheda; lo stesso ↗ sta nei risultati della ricerca. Non c'e'
nelle guide generale e nei capitoli, ne' in stampa, ne' nell'`.odt`. Se non c'e' una sessione aperta il
programma passa dal login e poi non riporta alla pagina richiesta. Il Database risorse si apre sulla scheda
predefinita (volontari); le altre si raggiungono dai pulsanti della home. `check-guides.php` verifica che
`dashboard_<id>.inc.php` esista (segnala `PAGINA`), tranne per gli id `<plugin>--<id>`.

**La ricerca nel menu laterale.** In cima al menu c'e' un campo; mentre c'e' del testo, al posto
dell'albero il menu mostra i risultati (`.is-searching`), e svuotando il campo (o con `Esc`) torna
l'albero. Il tasto `/` porta nel campo. Non serve nessun indice generato: tutte le guide sono gia'
in memoria, e `renderManual` ne ricava un indice con **un record per titolo** (di qualunque livello:
titolo, guida, testo fino al titolo successivo).

* La ricerca parte da termini di almeno 2 caratteri, dopo 120 ms dall'ultimo tasto. Ignora
  maiuscole e accenti (`fold`: una lettera alla volta, quindi una posizione nel testo ripiegato e'
  la stessa nell'originale) e vuole **tutti** i termini nello stesso record.
* Il punteggio pesa molto il titolo della sezione (x6), poco il titolo della guida (x2) e il testo
  (al massimo 5); a parita' vale l'ordine del manuale. Si mostrano i primi 40.
* Ogni risultato porta il nome della guida, il titolo della sezione e un frammento di circa 150
  caratteri attorno alla prima occorrenza, con i termini in `<mark>`. Le evidenziazioni sono parti
  di lit (`html`), mai HTML; **non** si evidenzia nel testo della pagina, che e' disegnato da lit e non
  va modificato a mano.
* La ricerca vede il testo delle guide, non le etichette delle pagine dell'applicazione, e non
  conosce i sinonimi.
* Il corpo del menu e' una radice lit propria (`.side-body`): albero o risultati si disegnano li',
  senza ridisegnare le guide. Lo scroll spy si ferma mentre si mostrano i risultati.

**Un comando per tutto: `docs/build-guide.php`.** Esegue in ordine `check-guides.php` e
`build-manual.php` e si ferma al primo se qualcosa non torna (`--force` per proseguire).

```bash
php docs/build-guide.php             # bozza: i [DA VERIFICARE] sono ammessi, indice senza numeri di pagina
php docs/build-guide.php --release   # versione: nessun [DA VERIFICARE], nessun avviso, indice con i numeri
```

In bozza il controllo gira con `--allow-markers` (i segnaposto sono contati ma non bloccano); in
`--release` no, e `build-manual.php` parte con `--update-index`. Se il controllo non passa, stampa le
righe che dicono cosa non va, ciascuna sotto la sua guida, e non scrive l'`.odt`. In `--release`, avvisi di
collegamenti non risolti o un indice senza numeri (uscita 3 di `build-manual.php`) danno uscita 1.
`build-manual.php` si puo' lanciare anche da solo:

```bash
php docs/build-manual.php                 # scrive docs/<lingua>/manual.odt
php docs/build-manual.php --update-index  # in piu' fa mettere i numeri di pagina a LibreOffice
php docs/build-manual.php --toc-depth=3   # indice con anche le sezioni dei capitoli
```

Lo script produce **solo `.odt`** (niente HTML ne' PDF). Rilegge `guide.json` e i Markdown con lo
stesso sottoinsieme di `guide.js` (titoli con `{#id}`, elenchi, tabelle, grassetto, corsivo, codice,
collegamenti) e scrive un pacchetto ODF a mano, senza librerie: pagina del titolo, indice, un livello
di struttura per parte/capitolo/sezione, interruzione di pagina a ogni capitolo, pie' di pagina con il
numero. I collegamenti `guide:vista#id` e `#id` diventano collegamenti ai segnalibri del documento; un
collegamento che non si risolve e un `[DA VERIFICARE]` vengono riportati in fondo (uscita 1 solo per i
collegamenti rotti). **L'indice esce senza numeri di pagina**: PHP non impagina. Si aggiorna da
LibreOffice (Strumenti > Aggiorna > Tutti gli indici) oppure con `--update-index`, che avvia LibreOffice
senza interfaccia tramite `docs/odt-update-index.py` (variabile `LIBREOFFICE_PYTHON` per indicarne
il Python; su Windows il percorso predefinito e' `C:\Program Files\LibreOffice\program\python.exe`).

**Dashboard PHP senza SPA.** Una pagina che sta in `dashboard_<id>.inc.php` e non ha
una view JS (Report, Attestati…) ha la guida in `views/dashboards/<id>/guide.<lingua>.md`,
una per id. La voce dell'indice ha `"view": "dashboards/<id>"`: il caricatore
costruisce `views/<view>/guide.<lingua>.md` e il percorso funziona senza altro;
`guide-links.js` associa anche `<id>` a quella voce, quindi il pulsante
`?dashboard=<id>` trova la guida senza `dashboard`. I collegamenti fra guide sono
`guide:dashboards/<id>`. Le pagine che compongono piu' id simili (27 e 28) hanno un
file ciascuno e si rimandano l'un l'altra.

Nel manuale completo la sezione ha id `g-dashboards/<id>` (la barra e' lecita in un
id HTML e in un frammento).

## 3. Markdown ammesso

Un sottoinsieme, perche' non c'e' una libreria Markdown (nel framework non ce n'e' una; niente CDN, i kiosk possono essere offline) e il renderer e' un file solo:

* titoli `#`–`####`, con identificativo `{#passo-3}` (altrimenti si ricava dal testo);
* paragrafi; elenchi `-` e `1.` annidati per rientro; tabelle con riga d'intestazione; citazioni `>`; `---`;
* `**grassetto**`, `*corsivo*`, `` `codice` ``, `[testo](url)`, `![alt](img/file.png)`, escape con `\`;
* `[DA VERIFICARE]`, con o senza apici inversi, e' reso evidenziato (un fatto che nessuno ha confermato sull'interfaccia deve vedersi comunque).

Collegamenti: `#id` (nella stessa guida), `guide:<view>#<id>` (un'altra guida),
`http(s)`, `mailto`. Altri schemi vengono tolti. Il testo e' sempre legato come
testo (lit-html), mai come HTML.

**Convenzione per gli autori: il grassetto e' testo come lo mostra
l'interfaccia** (pulsante, campo, messaggio). Cio' che e' solo enfasi va in
corsivo. E' quello che rende possibile il controllo.

## 4. Stato del pannello (`createGuideDrawer`)

```js
{
  isOpen: false,
  loading: false,
  missing: false,                     // guida assente o non caricabile
  doc: null,                          // { title, blocks, ids, base, lang }
  current: { view, id: null },        // cosa si sta leggendo e a che punto
  trail: [],                          // guide lasciate con un link guide:, per "Indietro"
  pendingScroll: false,
  token: 0                            // un caricamento lento non sovrascrive uno piu' recente
}
```

Il pannello vive in un proprio nodo (`.wt-guide-host`, figlio di `body`), non
dentro `#app`: due `render()` non si contendono la stessa radice. Le guide
caricate si tengono in una `Map` per la durata della pagina.

API restituita: `open()`, `close()`, `sync()`, `destroy()`. `sync()` la chiama
`app-boot.js` dopo ogni passo reso: se il pannello e' aperto sulla propria SPA
(non su una guida raggiunta da un link) scorre alla sezione `passo-<n>`.

## 5. Caricamento e lingua

* Percorsi da `import.meta.url` (`views/shared/guide.js`): `../<view>/guide.<lingua>.md`, `../../docs/guide/guide.json`; per una voce con `file` (i capitoli) il percorso del campo, dalla radice del plugin, con `{lang}` sostituito. `guide-version.inc.php` guarda anche `views/dashboards/*/` e `docs/guide/*/manuale/`.
* Versione in coda (`?v=VERSION`), come ogni import del plugin. In `guide.php` la versione e' l'mtime piu' recente tra i file delle guide.
* Lingua: `window.APP_CONFIG.lang`, poi `<html lang>`, poi `default`; se non e' in `languages`, `default`. Se manca la guida in quella lingua si prova `default`.
* **La lingua non arriva ancora alle SPA**: `APP_CONFIG` contiene solo `baseUrl` e i parametri dell'API. Per valorizzarlo serve una riga in `mountMiniApp` (`camila/ui.class.inc.php`, framework). Fino ad allora vale `<html lang>`.

## 6. Identificativi

Nel pannello gli `id` delle sezioni sono `g-<id>`; nel manuale `g-<spa>-<id>`
(le stesse sezioni compaiono in piu' guide: `passo-1` non e' unico nella
pagina). Un wizard con N passi ha le sezioni `passo-1` … `passo-N`: e' il
contratto con `getAnchor()` (`passo-${state.step}`).

## 7. Controllo (`docs/check-guides.php`)

| Verifica | Esito |
|---|---|
| guida elencata ma assente (lingua predefinita) | errore |
| **grassetto** non presente in `views/<spa>/*.js` o `views/shared/*.js` (per una dashboard PHP: in `dashboard_<id>.inc.php` e nei file di `source`) | errore |
| un wizard senza `{#passo-N}`, o con un passo oltre l'ultimo | errore |
| id doppi, `#id` o `guide:` che non esistono | errore |
| traduzione con id diversi dalla lingua predefinita | errore |
| la pagina di una guida (`?dashboard=<id>` derivato da `view`, o `page`) senza `dashboard_<id>.inc.php` | errore (`PAGINA`); non per gli id `<plugin>--<id>` ne' per `"page": false` |
| `[DA VERIFICARE]` | da risolvere; con `--allow-markers` sono contati ma non bloccano (e' la bozza di `build-guide.php`; `--release` no) |
| SPA con cartella in `views/` e senza guida | informazione |
| dashboard raggiungibile (`dashboard=<id>` in un `dashboard_*.inc.php` o in `menu.xml`) e senza guida | informazione. Esclusi gli hub dei tab `m0`…`m9`, descritti dalla guida generale, e gli id `plugin--dashboard`. L'elenco e' largo: conta anche i riferimenti dentro altre pagine |

Un'etichetta che il PHP compone a runtime (il titolo `Attestati volontari (USCITA
DEFINITIVA) PROVINCIA ORGANIZZAZIONE`, i titoli dei report presi dal nome del file) non
si puo' ritrovare nel codice: in quel caso va in *corsivo*, non in grassetto.

Le interpolazioni restano nel testo del codice: molte etichette stanno dentro
un'espressione (`${busy ? "…" : "Salva"}`). `N` in un'etichetta vale per un
numero o per `${…}` (`Applica a N`).

## 8. Il "?" sulle dashboard (`guide-links.js`)

I pulsanti delle dashboard li disegna il framework (`insertButton`:
`<a class="button is-small …">`), quindi il "?" si aggiunge **dal browser**, non
dal PHP: nessuna modifica al framework e nessun elenco di pulsanti da tenere.

* `dashboards.inc.php` carica `guide-links.js?v=<versione>` come modulo, su ogni dashboard del plugin.
* Lo script legge `guide.json` e, per ogni `a.button` il cui `href` ha `dashboard=<view>` con `<view>` nell'indice, inserisce subito dopo un `<button class="sc-help">?</button>`. E' un fratello del link, non un figlio: il clic sul pulsante non cambia.
* Salta: `totem=1`, i link dentro `#app` (li disegna una SPA), i link gia' trattati (`data-guide-linked`).
* Apre lo stesso pannello delle SPA: `createGuideDrawer({ view: null, fab: false })` e `openGuide(<view>)`. Il pannello nasce al primo clic (lit-html e `guide.js` si caricano allora, non prima).
* **Dentro la pagina di una dashboard con guida** (`?dashboard=<id>` con voce `dashboards/<id>`) lo stesso script crea il pulsante fisso in basso a destra che le SPA ricevono da `app-boot.js` (`fab: true`, `view` = la guida della pagina). Non lo crea per `totem=1`, per le SPA (hanno il loro) e per le voci con `"floating": false`. Lo usa `dashboards/m1` (Report): la pagina si ricarica da sola ogni 30 secondi (`insertAutoRefresh`) e un pannello aperto sparirebbe a ogni ricarica, quindi li' resta solo il «?» accanto al pulsante della home.
* Stile: cerchietto grigio di 1.2rem, `vertical-align: top` con margine superiore calcolato per centrarlo sul pulsante `is-small` (30px); non e' un `.button`, quindi non eredita i colori tonali dei box `.sc-home`. Lo spazio fra i pulsanti non cambia.

## 9. Altre note tecniche

* **Divergenza dal modello "guida nel box di testata"**: il pulsante sta in `app-boot.js` e non in ciascuna testata, perche' ogni passo dei wizard disegna la propria; cosi' non si tocca nessuna vista e il passo corrente lo conosce gia' il boot.
* Il pulsante e' `position:fixed`, `z-index:900`; il pannello `z-index:9500`. Le finestre e gli overlay delle viste usano 1000 (richieste, consumabili), 1200 (scanner QR) e 9000 (selettore di posizione su mappa, `views/shared/map-picker.js`): il pulsante sta sotto di loro, il pannello sopra, cosi' una finestra aperta mentre la guida e' visibile non la copre.
* `VERSION` in `app-boot.js` e' `window.APP_CONFIG?.version || Date.now()` e `APP_CONFIG` non ha `version`: oggi vale sempre `Date.now()`, quindi la cache del browser non aiuta. E' un comportamento preesistente.
* **Distribuzione**: `install-camila-app-plugin.sh` clona il repository GitHub del plugin e copia tutto (`cp -r repo/*`), quindi guide, `guide.php` e `docs/` arrivano nel pacchetto senza altri passaggi. Ne segue che il lavoro va portato nel repository del plugin (non nella copia installata) prima di una versione, e che `docs/it/manual.odt` viaggia solo se e' stato committato.
