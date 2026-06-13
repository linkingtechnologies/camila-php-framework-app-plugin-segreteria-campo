# Design: Org Status

**Pulsante dashboard:** "Stato registrazione Organizzazione"

## Struttura

2 step: selezione organizzazione → dashboard presenti.

```
step 1  →  Selezione organizzazione
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
