# Use Case: Smart Assistant

## Identificativo

UC-SA — Assistente di configurazione iniziale del campo

---

## Goal

Guidare l'operatore nella configurazione iniziale del campo, segnalando le condizioni minime non soddisfatte che bloccherebbero il funzionamento delle altre SPA.

---

## Primary Actor

Amministratore / Operatore di segreteria campo (primo accesso)

---

## Precondizioni

- L'operatore è autenticato.

---

## Postcondizioni — Successo

- L'operatore è informato sullo stato di configurazione e guidato verso l'azione correttiva.

---

## Main Success Scenario

### Home — Verifica configurazione

Il sistema esegue in parallelo tutti i controlli al mount e mostra i relativi avvisi.

```js
Promise.all([
  client.table("servizi").list({ size: 1 }),
  client.table("brogliaccio").list({ include: ["data/ora"], size: 1, order: [["data/ora", "desc"]] }),
  client.call("GET", "/templates/comune").catch(() => null),
])
```

#### Controllo 1 — Tabella `servizi`

1. Il sistema verifica se la tabella `servizi` contiene almeno un record (`list({ size: 1 })`).
2. **Caso A — Servizi presenti:** nessun avviso mostrato.
3. **Caso B — Servizi assenti:** il sistema mostra una card con:
   - Titolo: "Nessun servizio trovato"
   - Descrizione: suggerimento di importare i servizi di esempio
   - CTA primaria → `?dashboard=iw` (Importa servizi di esempio)
   - CTA secondaria → `?dashboard=service-manager` (Gestione servizi, icona `ri-pushpin-line`)

#### Controllo 2 — Attività brogliaccio

1. Il sistema legge l'ultimo record della tabella `brogliaccio` ordinando per `data/ora` discendente (`size: 1, order: [["data/ora", "desc"]]`).
2. Confronta il timestamp con l'ora corrente.
3. **Caso A — Ultima voce recente (< 2 ore):** nessun avviso mostrato.
4. **Caso B — Ultima voce vecchia (≥ 2 ore):** il sistema mostra una card con:
   - Titolo: "Nessuna voce nel brogliaccio nelle ultime 2 ore."
   - Sottotesto: data/ora dell'ultima registrazione (formato locale italiano)
   - CTA → pulsante **Inserisci messaggio** (apre modal brogliaccio)
5. **Caso C — Brogliaccio vuoto:** nessun alert mostrato. L'alert scatta solo se il brogliaccio è stato utilizzato almeno una volta.

La soglia è configurabile tramite la costante `BROGLIACCIO_ALERT_HOURS` (default: `2`).

#### Controllo 3 — Template comune

1. Il sistema chiama `client.call("GET", "/templates/comune")`.
2. **Caso A — `value` diverso da `"Ornate"`:** nessun avviso mostrato.
3. **Caso B — `value === "Ornate"` (valore predefinito):** il sistema mostra una card con:
   - Titolo: "Evento non configurato."
   - Descrizione: il nome del comune è ancora al valore predefinito
   - CTA → `?dashboard=m2` (Configura evento, icona `ri-calendar-line`)
4. **Caso C — Errore endpoint:** la chiamata è silenziosa (`.catch(() => null)`); `comuneUnconfigured` resta `false`.

Il valore sentinella è configurabile tramite la costante `COMUNE_DEFAULT_VALUE` (default: `"Ornate"`).

#### Azione — Inserimento messaggio nel brogliaccio

1. L'operatore clicca **Inserisci messaggio** (da card o da pulsante discreto).
2. Si apre una modale con un campo textarea libero.
3. L'operatore scrive il messaggio e clicca **Salva** (oppure usa Ctrl+Invio).
4. Il sistema crea un record nella tabella `brogliaccio` con:
   - `data/ora`: timestamp corrente (formato `YYYY-MM-DD HH:MM:SS`)
   - `descrizione`: testo inserito dall'operatore
5. Alla conferma del salvataggio:
   - Viene mostrato il messaggio "Messaggio salvato."
   - La modale si chiude automaticamente dopo 1 secondo
   - Lo stato dell'alert viene aggiornato (`brogliaccioAlert = false`, `brogliaccioLastTs = now`)

---

## Struttura UI

### Sezione "Assistente intelligente"

La sezione è collassabile. Lo stato (espanso/collassato) è persistito in `localStorage` con chiave `smart-assistant-collapsed`.

```
[ ▾ Assistente intelligente  [badge N] ]   ← header cliccabile
  [ card suggerimento 1 ]
  [ card suggerimento 2 ]
  [ ... ]
```

- Il **badge** mostra il numero di suggerimenti attivi (`brogliaccioAlert + comuneUnconfigured + !hasServizi`). Visibile solo se `count > 0`.
- L'intera sezione (header incluso) **non viene renderizzata** se il caricamento è completato e non ci sono suggerimenti attivi (`count === 0`).
- Durante il caricamento (`loading = true`) la sezione rimane visibile (badge assente).
- La freccia nell'header ruota di −90° quando la sezione è collassata.

### Card suggerimento (layout uniforme)

Tutte le card seguono lo stesso schema Bulma `.card > .card-content > .media`:

```
[ icona ri-magic-line (has-text-primary) ]  [ titolo bold / sottotesto is-size-7 has-text-grey ]  [ CTA button/link ]
```

La CTA "Configura evento" usa `ri-calendar-line`; l'icona della card è `ri-magic-line` come per tutte le altre.

### Costanti

```js
const BROGLIACCIO_ALERT_HOURS = 2;
const COMUNE_DEFAULT_VALUE    = "Ornate";
const LS_KEY                  = "smart-assistant-collapsed";
```

### State shape

```js
{
  loading:             Boolean,
  hasServizi:          Boolean,
  brogliaccioAlert:    Boolean,
  brogliaccioLastTs:   Date | null,
  comuneUnconfigured:  Boolean,
  error:               any | null,
  collapsed:           Boolean,   // inizializzato da localStorage

  // modal brogliaccio
  showModal:   Boolean,
  msgText:     String,
  msgBusy:     Boolean,
  msgError:    String | null,
  msgSuccess:  Boolean,
}
```

---

## Extensions

### 1a. Errore di verifica

- Il sistema mostra un avviso discreto: "Errore nel controllo della tabella servizi".
- Non blocca l'utente: può comunque navigare manualmente.

### 2a. Messaggio vuoto

- Se l'operatore tenta di salvare un messaggio vuoto, viene mostrato un errore in linea nella modale: "Il messaggio non può essere vuoto."

### 2b. Errore di salvataggio nel brogliaccio

- Viene mostrato un messaggio di errore in linea nella modale. La modale rimane aperta per consentire un nuovo tentativo.

### 3a. Errore endpoint `/templates/comune`

- La chiamata usa `.catch(() => null)` dentro `Promise.all` — un errore non blocca gli altri controlli e `comuneUnconfigured` resta `false`.

---

## Note

Questa SPA è un punto di partenza espandibile. I controlli attuali coprono la tabella `servizi`, l'attività del brogliaccio e la configurazione del template comune. Controlli futuri (es. presenza di organizzazioni, configurazione squadre) possono essere aggiunti come ulteriori card nella stessa home, senza modificare il flusso esistente — basta incrementare il conteggio del badge.
