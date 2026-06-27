# Design: Massive Check-out

**Pulsante dashboard:** "Check-out massivo Organizzazione"

## Modalità operative

| Modalità | URL | Step 1 |
|---|---|---|
| **Standard** | (nessun parametro) | Lista organizzazioni con ricerca testuale |
| **Totem** | `?totem=1` | Inserimento codice numerico (o scansione QR) |

Gli step 2-4 sono identici in entrambe le modalità.

---

## Step 1 — UI comune

Entrambe le modalità mostrano in cima allo step 1 il titolo:

```html
<div class="box">
  <h3 class="title is-4">
    <span class="icon is-medium" style="vertical-align:middle;margin-right:.4rem">
      <i class="ri-logout-box-line ri-lg"></i>
    </span>Check-out
  </h3>
</div>
```

**Loader iniziale (step 1, modalità normale):** quando `loading === true`, al posto del box di ricerca viene mostrata una section centrata identica a quella del resource-board:

```html
<section class="section">
  <div class="container has-text-centered">
    <p class="has-text-grey mb-2">Caricamento…</p>
    <progress class="progress is-primary" style="max-width:400px;margin:0 auto"></progress>
  </div>
</section>
```

---

## Step 1 — Modalità totem

Identica alla modalità totem del check-in massivo (stesso jsQR, stesso endpoint, stesso scanner). Differenze:

- Al match trovato chiama `select({ org, code, provincia: "" })` che imposta `state.org` e resetta `step2SelectedIds` / `checkoutSelection` prima di `goTo(2)`.
- Titolo con icona `ri-logout-box-line` invece di `ri-login-box-line`.

Vedere `specs/massive-check-in/design.md` §"Step 1 — Modalità totem" per il dettaglio completo (flusso jsQR, stato scanner, overlay).

---

## Pulsante "Fine" (step 3 e step 4)

Il pulsante **Fine** (`is-success is-small`, icona `ri-check-double-line`) è presente in:

- **Step 3** — sempre visibile nella toolbar (disabilitato solo durante `busyCheckout`). Permette di concludere senza fare il check-out dei materiali.
- **Step 4** — visibile quando `!loading && !busyCheckout`.

Al click azzera lo state (`for (const key of Object.keys(state)) delete state[key]`) e chiama `goTo(1)`.

---

## Struttura wizard

4 step numerati, navigazione via `state.step` + `goTo(n)`.

```
step 1  →  Selezione organizzazione  (modalità standard)
           — oppure —
           Inserimento codice totem  (modalità totem)
step 2  →  Check-out volontari
step 3  →  Check-out mezzi
step 4  →  Check-out materiali
```

---

## State shape

```js
state = {
  step: 1,
  org: { name, code, province },

  // step 2
  step2SelectedIds: [],            // id interni record volontari (non CF)
  s2_search_in: "",
  s2_search_non: "",
  step2Draft: {                    // modifiche per riga prima del checkout
    [recordId]: { mansione, responsabile, autista, cellulare, beneficiLegge, numGgBenefici }
  },

  // step 3
  step3SelectedMezziIds: [],       // id interni record mezzi
  s3_search_in: "",
  s3_search_non: "",
  step3Draft: {
    [recordId]: { kmInizioMissione, kmAllArrivo, kmAllaPartenza }
  },

  // step 4
  step4SelectedMaterialiIds: [],   // id interni record materiali
  s4_search_in: "",
  s4_search_non: ""
}
```

---

## Tabelle coinvolte

| Operazione | Tabella |
|---|---|
| Caricamento organizzazioni | `volontari-preaccreditati`, `db-volontari` |
| Caricamento volontari | `volontari` |
| Aggiornamento check-out volontario | `volontari` (`update`) |
| Caricamento mezzi | `mezzi` |
| Aggiornamento check-out mezzo | `mezzi` (`update`) |
| Caricamento materiali | `materiali` |
| Aggiornamento check-out materiale | `materiali` (`update`) |
| Tracciamento movimento | `mov-risorse` (`create`) |

---

## Payload di aggiornamento (comune a tutte le categorie)

```js
{
  "data-fine-attestato": "YYYY-MM-DD",
  "data/ora-uscita-definitiva": "YYYY-MM-DD HH:mm:ss",
  "servizio": "USCITA DEFINITIVA"
}
```

Campi aggiuntivi per **volontari**:
```js
{
  "mansione", "responsabile", "autista", "cellulare",
  "benefici-di-legge", "num-gg-ben-legge"
}
```

Campi aggiuntivi per **mezzi**:
```js
{
  "km-inizio-missione", "km-all-arrivo", "km-alla-partenza"
}
```

I valori numerici km sono normalizzati a stringa numerica (virgola → punto, caratteri non numerici rimossi).

---

## Tracciamento mov-risorse

Dopo ogni `update` riuscito, viene inserito un record in `mov-risorse`:

```js
{
  "data/ora": dateTime,
  "gruppo": org.name,
  "risorsa": identificativo (vedi sotto),
  "tipo-risorsa": "VOLONTARIO" | "MEZZO" | "MATERIALE",
  "da": servizio precedente,
  "a": "USCITA DEFINITIVA"
}
```

```js
// risorsa:
//   volontario → "nome cognome"
//   mezzo      → "targa marca"
//   materiale  → "id-materiale - tipologia (codice-inventario)"
//                tipologia e codice-inventario inclusi solo se valorizzati
```

Il movimento non è in transazione con l'update: se `create` su `mov-risorse` fallisce dopo un `update` già riuscito, il record operativo è comunque aggiornato.

---

## Classificazione in/non in servizio

```js
const hasInizio = !!row.dataInizio;
const hasFine = !!row.dataFine;

if (hasInizio && !hasFine) → "in servizio"   // selezionabile
if (hasInizio && hasFine)  → "non in servizio" // sola lettura
// else → "dati incompleti", avviso, non mostrato
```

---

## Differenza chiave con Check-in

Nel **check-in** si usa la chiave di dominio (CF, targa, id-materiale) per cercare duplicati prima di inserire.

Nel **check-out** si usa l'`id` interno del record (`r.id` / `r._id` / `r.ID`) per aggiornare il record corretto, poiché possono esistere più attestati per lo stesso soggetto in periodi diversi.

---

## Draft editing

Prima del check-out l'operatore può modificare alcuni campi per riga. Le modifiche sono salvate in `state.step2Draft[recordId]` e `state.step3Draft[recordId]` e applicate al momento del submit tramite `applyDraft(row)`. Non vengono scritte nel database prima della conferma.

Il campo `servizio` è in sola lettura nell'editor (sarà sempre sovrascritto con `"USCITA DEFINITIVA"` al check-out).

---

## Guard di navigazione

Ogni step da 2 in poi controlla che `state.org` sia impostato (`state.org.name` non vuoto). Se mancante, redirige allo Step 1.
