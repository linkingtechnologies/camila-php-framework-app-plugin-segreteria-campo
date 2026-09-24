# Design: Smart Assistant

**Posizione:** non ha un pulsante di dashboard proprio. È montato in cima alla home
(`dashboard_m0.inc.php`) e appare sopra i box "Risorse", "Attività" e le colonne
Volontari / Mezzi / Materiali.

---

## Struttura

Vista singola, nessun wizard. Tre controlli indipendenti vengono eseguiti al
caricamento; ognuno che risulti positivo produce una card di suggerimento.

```
Home (views/smart-assistant/home.js)
  ├── header collassabile  ("Assistente intelligente" + badge N)
  ├── card: brogliaccio fermo da oltre 2 ore   → apre modale inserimento
  ├── card: evento non configurato             → link a ?dashboard=m2
  ├── card: nessun servizio in tabella         → link a ?dashboard=iw / service-manager
  └── modale: inserimento messaggio brogliaccio
```

---

## Montaggio — divergenza dal wiring standard

A differenza di ogni altra SPA del plugin, lo Smart Assistant **non ha**
`smart-assistant.inc.php` né `dashboard_smart-assistant.inc.php`, e non compare in
`conf/menu.xml`. È montato direttamente dentro la home:

```php
// dashboard_m0.inc.php, ramo non-totem
$camilaUI->mountMiniApp($pluginName, '/app-smart-assistant.js', '/app.css');
```

Conseguenze da tenere presenti:

* `#app` sulla home contiene l'assistente, **non** i box della dashboard, che sono
  markup PHP emesso dopo e quindi fratelli di `#app`.
* L'assistente è l'unico contenuto di `#app` che può renderizzare il vuoto: per
  questo non porta la classe `spa-title-box` (vedi §Render vuoto).
* Il ramo totem di `dashboard_m0.inc.php` non lo monta affatto.

---

## State shape

Tutto lo stato vive nella closure di `Home()`. `app-smart-assistant.js` passa un
`state = {}` che la vista **non usa**: non c'è stato da preservare tra render,
perché la SPA non ha né step né tab.

```js
let loading            = true;   // true finche' i tre controlli non sono conclusi
let hasServizi         = false;  // almeno un record in `servizi`
let brogliaccioAlert   = false;  // nessun record nelle ultime 2 ore
let brogliaccioLastTs  = null;   // Date dell'ultimo record, null se tabella vuota
let comuneUnconfigured = false;  // template "comune" ancora al valore di default
let error              = null;   // errore del blocco di caricamento
let collapsed          = false;  // da localStorage["smart-assistant-collapsed"]

// modale brogliaccio
let showModal  = false;
let msgText    = "";
let msgBusy    = false;
let msgError   = null;
let msgSuccess = false;
```

`collapsed` è l'unico stato persistito: `localStorage` con chiave
`smart-assistant-collapsed` (`"1"` = collassato).

---

## Tabelle coinvolte

| Operazione | Tabella / endpoint |
|---|---|
| Verifica presenza servizi | `servizi` (`list`, `size: 1`) |
| Ultima voce brogliaccio | `brogliaccio` (`list`, `size: 1`, `order: [["data/ora","desc"]]`) |
| Valore comune configurato | `GET /templates/comune` — endpoint **di framework** (`camila/api/cf_handlers.inc.php`), non del plugin |
| Inserimento messaggio | `brogliaccio` (`create`) |

---

## Payload

Unica scrittura della SPA, dalla modale:

```js
client.table("brogliaccio").create({
  "data/ora":    "YYYY-MM-DD HH:mm:ss",  // generato client-side da nowDbFormat()
  "descrizione": msgText.trim()
})
```

Dopo il salvataggio lo stato locale viene riallineato senza ricaricare
(`brogliaccioLastTs = new Date(); brogliaccioAlert = false`) e la modale si chiude
dopo 1 secondo via `setTimeout`.

---

## Logica di classificazione

```js
const BROGLIACCIO_ALERT_HOURS = 2;
const COMUNE_DEFAULT_VALUE    = "Ornate";

// 1. servizi
hasServizi = getRecords(resServizi).length > 0;

// 2. brogliaccio
if (ultimo record esiste) {
  brogliaccioLastTs = new Date(valore.replace(" ", "T"));
  brogliaccioAlert  = (Date.now() - brogliaccioLastTs) > 2h;
} else {
  brogliaccioLastTs = null;
  brogliaccioAlert  = false;   // brogliaccio mai usato: nessun alert
}

// 3. evento
comuneUnconfigured = resComune?.value === COMUNE_DEFAULT_VALUE;

// badge
count = [brogliaccioAlert, comuneUnconfigured, !error && !hasServizi].filter(Boolean).length;
```

Il terzo addendo porta `!error`: se il caricamento fallisce non si afferma che i
servizi manchino, si mostra invece la notifica di errore.

---

## Render vuoto — niente flicker

```js
if (loading || count === 0) return "";
```

L'header **non** viene renderizzato durante il caricamento. La versione precedente
lo mostrava (`if (!loading && count === 0)`), col risultato che sulla home appariva
per la durata delle tre chiamate e poi spariva ogni volta che non c'erano
suggerimenti, facendo saltare il layout. Tutte le card erano già subordinate a
`!loading`, quindi l'header era l'unico elemento incoerente.

Conseguenza: a regime — evento configurato, brogliaccio aggiornato, servizi
presenti — `#app` sulla home resta **completamente vuoto**. È il motivo per cui la
classe `spa-title-box` non è applicata a questa SPA: il box comparirebbe a
intermittenza sotto la tab bar.

---

## Altre note tecniche

* **`Promise.all`, non `allSettled`** — divergenza consapevole dal pattern in
  AGENTS.md: se una delle tre chiamate fallisce, `error` viene valorizzato e tutte
  le card sono soppresse. Non c'è fallback parziale per singolo controllo. La sola
  chiamata protetta è `/templates/comune`, con un `.catch(() => null)` in linea che
  la degrada a "comune configurato".
* **Nessun `withRetry`, nessun `normalizeApiError`** — a differenza delle altre SPA
  questa non usa gli helper di normalizzazione ed errore: `error` conserva l'oggetto
  grezzo e viene reso con un testo fisso. Accettabile perché l'assistente è
  accessorio e non deve trattenere l'operatore sulla home, ma è una divergenza da
  sapere prima di estenderla.
* **Nessun `permissions()`** — la SPA non ha fallback read-only. Il pulsante di
  inserimento brogliaccio è sempre offerto e un eventuale rifiuto emerge solo come
  errore della `create`.
* **Nessun flag `cancelled`** — la home non cambia contesto sotto l'assistente, non
  c'è navigazione interna, quindi non esiste il rischio di render su root stale.
* **Doppio render al boot** — `load()` chiama `rerender()` e subito dopo `Home()`
  ritorna `view()`, che il chiamante renderizza a sua volta. Innocuo (entrambi i
  render sono a `loading = true`, che ora non produce markup), ma è la ragione per
  cui non va aggiunta logica con effetti collaterali dentro `view()`.
