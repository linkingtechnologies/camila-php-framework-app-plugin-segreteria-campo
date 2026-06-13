# Design: Massive Check-out

**Pulsante dashboard:** "Check-out massivo Organizzazione"

## Struttura wizard

4 step numerati, navigazione via `state.step` + `goTo(n)`.

```
step 1  →  Selezione organizzazione
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
  "km-inizio-missione", "km-all'arrivo", "km-alla-partenza"
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
  "risorsa": identificativo (nome+cognome / targa+marca / id-materiale),
  "tipo-risorsa": "VOLONTARIO" | "MEZZO" | "MATERIALE",
  "da": servizio precedente,
  "a": "USCITA DEFINITIVA"
}
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
