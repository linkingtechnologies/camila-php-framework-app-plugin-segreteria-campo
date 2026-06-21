# Design: Org Status

**Pulsante dashboard:** "Stato registrazione Organizzazione"

## Modalità operative

| Modalità | URL | Step 1 |
|---|---|---|
| **Standard** | (nessun parametro) | Lista organizzazioni con ricerca testuale |
| **Totem** | `?totem=1` | Inserimento codice numerico (o scansione QR) |

Lo step 2 è identico in entrambe le modalità.

---

## Step 1 — UI comune

Entrambe le modalità mostrano in cima allo step 1 il titolo:

```html
<h3 class="title is-4">
  <span class="icon is-medium"><i class="ri-building-line ri-lg"></i></span>
  Stato organizzazione
</h3>
```

---

## Step 1 — Modalità totem

Identica alla modalità totem del check-in massivo (stesso jsQR, stesso endpoint, stesso scanner). Al match trovato chiama `select()` che imposta `state.org` e avanza a step 2.

Vedere `specs/massive-check-in/design.md` §"Step 1 — Modalità totem" per il dettaglio completo.

---

## Pulsante "Fine" (step 2)

Il pulsante **Fine** (`is-success is-small`, icona `ri-check-double-line`) è visibile nella toolbar di step 2 affiancato a "Cambia organizzazione" e "Ricarica". Non ha condizioni di visibilità aggiuntive.

Al click azzera lo state (`for (const key of Object.keys(state)) delete state[key]`) e chiama `goTo(1)`, riportando alla selezione organizzazione con lo state pulito.

---

## Struttura

2 step: selezione organizzazione → dashboard presenti.

```
step 1  →  Selezione organizzazione  (modalità standard)
           — oppure —
           Inserimento codice totem  (modalità totem)
step 2  →  Dashboard: KPI card + 6 tabelle (3 categorie × in/non in servizio)
```

---

## State shape

```js
state = {
  step: 1,
  org: { name, code, province },

  // ricerche persistite nello step 2
  s2_v_q: "",    // ricerca volontari
  s2_m_q: "",    // ricerca mezzi
  s2_a_q: ""     // ricerca materiali (attrezzature)
}
```

---

## Tabelle coinvolte

| Operazione | Tabella |
|---|---|
| Caricamento organizzazioni | `volontari-preaccreditati`, `db-volontari` |
| Volontari | `volontari` |
| Mezzi | `mezzi` |
| Materiali | `materiali` |

---

## Classificazione in/non in servizio

```js
if (row.inizio && !row.fine) → "in servizio"
else                          → "non in servizio"
// record senza data-inizio → scartati silenziosamente (no avviso visibile nell'org-status)
```

Nota: a differenza del check-out, l'org-status non ha la terza categoria "dati incompleti" con avviso — i record senza `data-inizio-attestato` vengono semplicemente ignorati.

---

## Loading parallelo

I tre dataset vengono caricati con `Promise.all`. Se uno fallisce, tutta la dashboard mostra l'errore. Non c'è fallback parziale per categoria (differenza rispetto al check-in step 1 che usa `Promise.allSettled`).

---

## KPI card

Tre card affiancate (layout `columns is-multiline`), una per categoria.

Ciascuna mostra:
- Icona categoria
- Contatore "In servizio" (grande)
- Contatore "Non in servizio" (grande)

---

## Filtro dati per organizzazione

Filtro triplo in `AND`: `organizzazione eq`, `codice-organizzazione eq`, `provincia eq`.

Tutti e tre i campi devono corrispondere. Questo è più restrittivo del check-in (che filtra solo per nome), ma necessario per evitare ambiguità tra organizzazioni con lo stesso nome in province diverse.

---

## Sola lettura

Questa SPA non esegue `create`, `update` o `delete`. Nessuna modifica ai dati operativi.
