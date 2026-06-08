# Design: Massive Check-in

## Struttura wizard

7 step numerati, navigazione via `state.step` + `goTo(n)`.

```
step 1  →  Selezione organizzazione
step 2  →  Selezione volontari
step 3  →  Inserimento volontari
step 4  →  Selezione mezzi
step 5  →  Inserimento mezzi
step 6  →  Selezione materiali
step 7  →  Inserimento materiali
```

Percorso minimo: 1 → 2 → 3 → 4 → 5 → 6 → 7.
Salti permessi dal codice: 2 → 4, 2 → 6, 4 → 6.

---

## State shape

```js
state = {
  step: 1,
  org: { name, code, province },       // impostato in step 1

  // step 2 — volontari
  step2Selected: [],                    // array di codici fiscali
  preTurnoFilter: "",
  preSearch: "",
  attSearch: "",

  // step 3 — passaggio a step 3
  checkinSelection: {
    org: { name, code, province },
    volunteers: [{ cf, cognome, nome, turni }]
  },

  // step 4 — mezzi
  step4Selected: [],                    // array di targhe
  preMezziSearch: "",
  attMezziSearch: "",
  loadAllAttesi: false,
  step4TurnoFilter: "",

  // step 5 — passaggio a step 5
  mezziSelection: {
    org: { name, code, province },
    mezzi: [{ targa, categoria, tipologia, marca, modello, note, turniOptions, turni, ... }]
  },

  // step 6 — materiali
  step6Selected: [],                    // array di id-materiale
  preMaterialiSearch: "",
  attMaterialiSearch: "",
  loadAllMaterialiDb: false,
  step6TurnoFilter: "",

  // step 7 — passaggio a step 7
  materialiSelection: {
    org: { name, code, province },
    materiali: [{ "id-materiale", categoria, tipologia, ... }]
  }
}
```

---

## Tabelle coinvolte

| Operazione | Tabella |
|---|---|
| Caricamento organizzazioni | `volontari-preaccreditati`, `db-volontari` |
| Caricamento volontari | `volontari-preaccreditati`, `db-volontari` |
| Aggiunta volontario (modale) | `volontari-preaccreditati` |
| Verifica esistenza volontario | `volontari` |
| Inserimento volontario | `volontari` |
| Caricamento servizi | `servizi` |
| Caricamento mezzi | `mezzi-preaccreditati`, `db-mezzi` |
| Aggiunta mezzo (modale) | `mezzi-preaccreditati` |
| Verifica esistenza mezzo | `mezzi` |
| Inserimento mezzo | `mezzi` |
| Caricamento materiali | `materiali-preaccreditati`, `db-materiali` |
| Aggiunta materiale (modale) | `materiali-preaccreditati` |
| Sequence ID materiale | `materiali-preaccreditati` (`.sequence()`) |
| Verifica esistenza materiale | `materiali` |
| Inserimento materiale | `materiali` |

---

## Logica di merge (step 1, 2, 4, 6)

Ogni selezione coinvolge due tabelle (preaccreditati + database).

**Chiave di merge:**
- Volontari: `codice-fiscale`
- Mezzi: `targa` (normalizzata UPPERCASE)
- Materiali: `id-materiale`
- Organizzazioni: `organizzazione|codice-organizzazione|provincia`

**Priorità sezione:** chi appare nei preaccreditati → sezione "Preaccreditati". Chi appare solo nel database → sezione "Database". Campi mancanti completati dall'altro lato con `mergeField` (non sovrascrive se già valorizzato).

**Turni:** aggregati con `Set` su tutti i record della stessa chiave.

---

## Logica di verifica esistenza (step 3, 5, 7)

Un record è considerato "già presente oggi" se:
- `data-inizio-attestato === oggi`, oppure
- `data-inizio-attestato < oggi` AND `data-fine-attestato` è vuota

La verifica avviene record per record (no batch), con re-render dopo ogni CF/targa/id per feedback progressivo.

Errore di verifica → il record rimane `pending` e il sistema prova comunque l'inserimento.

---

## Payload di inserimento

Campi comuni a tutti i tipi di record:

```js
{
  "data/ora-registrazione": "YYYY-MM-DD HH:mm:ss",  // formato sv-SE
  "data-inizio-attestato": "YYYY-MM-DD",
  organizzazione, "codice-organizzazione", provincia
}
```

Campi opzionali inclusi solo se valorizzati (no stringa vuota nel payload).

**Servizio:** sempre valorizzato, default `"IN ATTESA DI SERVIZIO"`.

**Benefici di legge:** `num-gg-ben-legge` incluso solo se `benefici-di-legge === "SI"`.

---

## Categoria / Tipologia (mezzi e materiali)

Dizionario hardcoded in formato CSV con header di gruppo `--NomeGruppo`.

Regole:
- Scegliere tipologia → categoria impostata automaticamente
- Scegliere categoria → tipologia filtrata alla categoria
- Cambiare categoria → tipologia incompatibile resettata
- Categoria selezionata + tipologia mancante → errore di validazione modale

---

## ID materiale (step 6 — modale)

Precompilazione automatica: `MAT` + valore restituito da `Pre.sequence()`.

Formato risposta confermato: `{ table, id }` → usa `res.id`.

Se la chiamata fallisce, il campo rimane vuoto e l'operatore inserisce manualmente.

---

## Navigazione da step 3 a step 4

Il pulsante **Check-in mezzi** è bloccato se esistono record in stato `pending` o se `loadingExisting` è attivo. Messaggio esplicito con conteggio dei pendenti.

---

## Salto diretto a materiali (step 2, step 5)

L'operatore può saltare la selezione di mezzi (step 4/5) e andare direttamente ai materiali (step 6). Non è richiesto aver completato step 5.

---

## Pre-popolamento servizio dai preaccreditati

Il campo `servizio` viene letto dalla tabella preaccreditati e propagato fino agli step di inserimento.

**Catena di propagazione:**

| Step | Operazione |
|---|---|
| Step 2 — caricamento | `include` contiene `"servizio"`, `"benefici-di-legge"`, `"n-giorni-benefici-legge"`, `"cellulare"`, `"email"`, `"note"` da `volontari-preaccreditati` |
| Step 2 — merge | `mergeByCF` raccoglie tutti i campi nell'entry di `preMap`; non sovrascrive se già valorizzato |
| Step 2 → 3 | `doCheckin()` passa `servizio`, `beneficiLegge`, `numGgBenefici`, `cellulare`, `email`, `note` nel payload `checkinSelection.volunteers` |
| Step 3 — init righe | tutti i campi usano `safe(v.campo) \|\| default`; default `"NO"` per i SI/NO, `""` per i testi |

⚠️ **Nomi campo diversi tra tabelle**: `volontari-preaccreditati` usa `n-giorni-benefici-legge`; la tabella operativa `volontari` usa `num-gg-ben-legge`. La mappatura avviene internamente nella variabile `numGgBenefici`.

**Campi pre-popolati da `volontari-preaccreditati` → step3:**

| Campo preaccreditati | Variabile interna | Campo in `volontari` |
|---|---|---|
| `servizio` | `servizio` | `servizio` |
| `benefici-di-legge` | `beneficiLegge` | `benefici-di-legge` |
| `n-giorni-benefici-legge` | `numGgBenefici` | `num-gg-ben-legge` |
| `cellulare` | `cellulare` | `cellulare` |
| `email` | `email` | `email` |
| `note` | `note` | `note` |
| `responsabile` | `responsabile` | `responsabile` |
| `autista` | `autista` | `autista` |
| `pernottamento` | `pernottamento` | `pernottamento` |
| `pranzo` | `pranzo` | `pranzo` |
| `cena` | `cena` | `cena` |
| `intolleranze` | `intolleranze` | `intolleranze` |
| Step 4 — caricamento | `include` contiene `"servizio"` in `mezzi-preaccreditati` |
| Step 4 — merge | `mergeByTarga` propaga `servizio` con `mergeField` |
| Step 4 → 5 | `doCheckinMezzi()` passa `servizio` nel payload `mezziSelection.mezzi` |
| Step 5 — init righe | `servizio: safe(m.servizio) \|\| DEFAULT_SERVIZIO` |
| Step 6 — caricamento | `include` contiene `"servizio"` in `materiali-preaccreditati` |
| Step 6 — merge | `mergeById` propaga `servizio` con `mergeField` |
| Step 6 → 7 | `doCheckinMateriali()` passa `servizio` nel payload `materialiSelection.materiali` |
| Step 7 — init righe | `servizio: safe(m.servizio) \|\| DEFAULT_SERVIZIO` |

Se il preaccreditato non ha `servizio` valorizzato si usa il default `IN ATTESA DI SERVIZIO`. Il valore è sempre modificabile dall'operatore prima dell'inserimento.

**Guard "valore non in lista":** se il servizio del preaccreditato non è nella tabella `servizi` attiva, viene aggiunto come opzione extra nella select così non scompare silenziosamente (stessa logica in step 3, 5, 7).

---

## Pattern lit-html — `<select>` con valore dinamico

### Problema

In lit-html il binding `.value` su un `<select>` **non è affidabile** quando le opzioni sono dinamiche o caricate in modo asincrono. Il browser applica `.value` solo se l'opzione corrispondente è già nel DOM in quel momento; se le opzioni vengono aggiunte dopo (es. al termine di una chiamata API), il select ricade sul primo elemento senza errori visibili.

### Soluzione

Usare sempre `?selected` su ogni `<option>` invece di `.value` sul `<select>`:

```js
// ❌ SBAGLIATO — fragile con opzioni dinamiche
html`<select .value=${current}>
  ${opts.map(o => html`<option value=${o}>${o}</option>`)}
</select>`

// ✅ CORRETTO
html`<select @change=${e => onchange(e.target.value)}>
  ${opts.map(o => html`<option value=${o} ?selected=${current === o}>${o}</option>`)}
</select>`
```

Questa regola si applica a **tutti i `<select>` le cui opzioni o il cui valore selezionato dipendono da stato asincrono** (servizi, mansioni, turni, ecc.).
