# Design — requests-board

**Pulsante dashboard:** "Richieste"
**Icona toolbar:** `ri-kanban-view-2` (giallo `#f59e0b`)

## 1. Struttura

SPA a singolo step, nessun wizard. Tutti i record vengono caricati al mount (size 2000) e ricaricati integralmente dopo ogni operazione di scrittura.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  🟡 Richieste  [Cerca…]  [Tipo ▼]  [Priorità ▼]  [Assegnatario ▼]  N   │  ← toolbar (#1e293b)
│                                                          [🔄]  [+ Nuova] │
├──────────────────────────────────────────────────────────────────────────┤
│  [spinner centrato "Caricamento…"]   ← solo durante loading             │
│  ─────────────────────────────────────────────────────── scroll →        │
│  [ A - Presa in carico ]  [ B - In valutazione ]  [ C1 - In lavorazione ]  …
│    card                     card                    card
│    card                                             card
│                                                     card
│  [ C2 - In attesa ]  [ D1 - Eseguita ]  [ D2 - Respinta ]
│    card                card               card
└──────────────────────────────────────────────────────────────────────────┘
```

6 colonne fisse (sempre presenti anche se vuote), scroll orizzontale. Altezza board: `calc(100vh - 46px)` (49px con progress bar visibile).

---

## 2. State shape

```js
records:        Array          // record da tabella `richieste`, caricati al mount
loading:        Boolean        // true durante load() e reload dopo salvataggio
error:          Any | null     // errore API grezzo

// filtri toolbar (client-side)
filterTipo:     String         // "" | "Interna" | "Esterna"
filterPrio:     String         // "" | "1 - Urgente" | "2 - Alta" | …
filterAss:      String         // "" | nome assegnatario da valori distinti in records
search:         String         // ricerca libera su `richiesta` e `richiedente`

// drag & drop
dragId:         String | null  // id del record in trascinamento
dropTarget:     String | null  // valore `stato` della colonna sotto il cursore

// modale crea/modifica
modal:          ModalState | null

// autocomplete assegnatario
volontariNames: Array<String>  // nomi "Cognome Nome" da volontari + operatori, ordinati
```

```js
// ModalState
{
  mode:      "create" | "edit",
  draft:     {
    data:                     String,  // YYYY-MM-DD (default: oggi su create)
    richiedente:              String,
    richiesta:                String,  // campo obbligatorio per abilitare Salva/Crea
    "tipo-richiesta":         String,  // default: "Interna"
    priorita:                 String,  // default: "3 - Normale"
    "assegnatario-richiesta": String,
    stato:                    String,  // default: STATI[0] su create
    note:                     String
  },
  saving:    Boolean,
  error:     Any | null,
  recordId:  String | null   // null su create
}
```

---

## 3. Colonne Kanban

| Valore `stato`              | Colore intestazione |
|-----------------------------|---------------------|
| A - Presa in carico         | `#6366f1` (indigo)  |
| B - In valutazione          | `#f59e0b` (amber)   |
| C1 - In lavorazione         | `#10b981` (green)   |
| C2 - In attesa di lavorazione | `#8b5cf6` (violet) |
| D1 - Eseguita               | `#22c55e` (lime)    |
| D2 - Respinta               | `#ef4444` (red)     |

I record con `stato` non riconosciuto ricadono in `STATI[0]` (A - Presa in carico).

---

## 4. Colori priorità

| Valore `priorita`  | Border-left card | Badge bg    | Badge text  |
|--------------------|-----------------|-------------|-------------|
| 1 - Urgente        | `#ef4444`       | `#fef2f2`   | `#b91c1c`   |
| 2 - Alta           | `#f97316`       | `#fff7ed`   | `#c2410c`   |
| 3 - Normale        | `#6b7280`       | `#f9fafb`   | `#374151`   |
| 4 - Bassa          | `#3b82f6`       | `#eff6ff`   | `#1d4ed8`   |
| 5 - Molto bassa    | `#d1d5db`       | `#f9fafb`   | `#9ca3af`   |

Il badge mostra solo la parte testuale (es. "Urgente", "Alta") senza il prefisso numerico.

---

## 5. Tabelle coinvolte

| Operazione | Tabella WorkTable |
|---|---|
| Lettura richieste | `richieste` |
| Autocomplete assegnatario | `volontari` (cognome, nome) + `operatori` (cognome, nome) |
| Aggiornamento stato (drag) | `richieste` (`.update(id, { stato })`) |
| Creazione richiesta | `richieste` (`.create({...})`) |
| Modifica richiesta | `richieste` (`.update(id, {...})`) |
| Eliminazione richiesta | `richieste` (`.remove(id)`) |

---

## 6. Caricamento dati

### `load()` — richieste

```js
Table.list({
  include: ["id", "data", "richiedente", "richiesta", "tipo-richiesta",
            "priorita", "assegnatario-richiesta", "stato", "note"],
  size: 2000
})
```

Chiamata al mount e dopo ogni salvataggio modale. Durante il caricamento mostra spinner centrato nel board (non le colonne vuote).

### `loadVolontari()` — autocomplete

```js
Promise.allSettled([
  client.table("volontari").list({ include: ["cognome", "nome"], size: 5000 }),
  client.table("operatori").list({ include: ["cognome", "nome"], size: 1000 })
])
```

Chiamata in parallelo con `load()` al mount. Usa `Promise.allSettled` per tollerare il fallimento di una delle due tabelle. I risultati vengono uniti, deduplicati per nome `"Cognome Nome"` e ordinati alfabeticamente in `volontariNames`. Dopo il caricamento chiama `rerender()` per aggiornare la datalist.

---

## 7. Filtri toolbar (client-side)

| Filtro | Campo | Comportamento |
|---|---|---|
| Cerca | `richiesta`, `richiedente` | `toLowerCase().includes(q)` |
| Tipo | `tipo-richiesta` | match esatto normalizzato |
| Priorità | `priorita` | match esatto normalizzato |
| Assegnatario | `assegnatario-richiesta` | match esatto; opzioni da `distinct` sui `records` già caricati |

Il dropdown assegnatari appare solo se ci sono valori distinti nei record. Il contatore "N richieste" in toolbar riflette sempre il numero di record dopo i filtri.

---

## 8. Drag & Drop

HTML5 native DnD API, senza librerie esterne.

- `dragstart`: imposta `dragId = r.id`; `effectAllowed = "move"`
- `dragover`: imposta `dropTarget = stato` della colonna; chiama `rerender()` per mostrare il bordo colorato
- `dragleave`: azzera `dropTarget` se corrisponde alla colonna che si sta lasciando
- `drop`: chiama `moveCard(dragId, stato)`, azzera `dragId` e `dropTarget`
- `dragend`: azzera `dragId` e `dropTarget` (cleanup se il drop avviene fuori da un target valido)

**Aggiornamento ottimistico**: `rec.stato` viene aggiornato in memoria prima della chiamata API. In caso di errore viene eseguito un `load()` completo per ripristinare lo stato server.

Il card trascinata viene resa con `opacity: 0.4` durante il drag. La colonna di destinazione attiva mostra un `border: 2px solid <coloreColonna>`.

---

## 9. Modale crea/modifica

Aperta da:
- Pulsante "+ Nuova" in toolbar → `openCreate()` (mode: "create")
- Icona matita su card → `openEdit(r)` (mode: "edit")

Chiusa da:
- Pulsante "Annulla" o tasto `✕`
- Click sull'overlay esterno
- Salvataggio completato con successo

**Campi modale:**

| Campo | Tipo | Note |
|---|---|---|
| Richiesta | textarea (3 righe) | Obbligatorio: abilita Crea/Salva |
| Richiedente | text | — |
| Data | date | Default: data odierna (`new Date().toISOString().slice(0,10)`) su create |
| Tipo | select | Interna / Esterna; default: Interna |
| Priorità | select | 5 opzioni; default: 3 - Normale |
| Assegnatario | text + datalist | Autocomplete da `volontari` + `operatori`; valore libero |
| Stato | select | 6 opzioni; default: A - Presa in carico su create |
| Note | textarea (2 righe) | — |

Header e footer sono `position: sticky` per restare visibili su modali con contenuto alto. Il payload di salvataggio include solo i campi con valore non vuoto (dopo `norm()`).

---

## 10. Autocomplete assegnatario

Implementato con `<input list="rb-assignees">` + `<datalist id="rb-assignees">`.

La datalist è renderizzata nel `view()` principale (non dentro la modale) così è sempre nel DOM. Il campo ha `autocomplete="off"` per evitare sovrapposizioni con il browser history. Accetta valori liberi non presenti nella lista.

---

## 11. Spinner iniziale

Durante `loading === true`, il board area mostra uno spinner centrato al posto delle colonne:

```
⟳  Caricamento…
```

Implementato con un `div` a `display:flex; align-items:center; justify-content:center; height:100%` contenente un cerchio animato (`border-top-color:#6366f1; animation: rb-spin .9s linear infinite`) e il testo "Caricamento…". Il `@keyframes rb-spin` è iniettato una volta via `<style>` nel template.

La progress bar orizzontale (3px, `is-primary`) rimane visibile sopra il board anche durante il loading iniziale.

---

## 12. File

| File | Ruolo |
|---|---|
| `app-requests-board.js` | Entry point: carica lit-html, WorkTableClient, importa e monta la view |
| `views/requests-board/index.js` | Intera logica e template; export `RequestsBoard` |
| `requests-board.inc.php` | Mount PHP tramite `CamilaUserInterface::mountMiniApp` |
| `dashboard_requests-board.inc.php` | Alias PHP per dashboard (`require 'requests-board.inc.php'`) |
| `conf/menu.xml` | `requests-board` aggiunto alle `pages` del tab `m0` (GESTIONE EVENTO) |
