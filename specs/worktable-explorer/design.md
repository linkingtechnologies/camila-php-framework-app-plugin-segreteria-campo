# Design — worktable-explorer

**Pulsante dashboard:** "Esploratore WorkTable"

## 1. Struttura

Single-view SPA. Nessun wizard, nessuna navigazione multi-step.

```
[Toolbar: seleziona tabella · page size · — · Modifica · Nuovo · Aggiorna]
[Banner success / error (auto-dismiss)]
[Barra filtro (gialla, opzionale)]
[Paginazione: Pagina X di Y · N record · ‹ [input] ›]
[Tabella records — scroll orizzontale]
  [ intestazioni con icone sort (clic per ordinare) ]
  [ riga nuova (se creating)         ]   ← verde
  [ riga record (view / edit mode)   ]   ← doppio clic → overlay
[Paginazione (ripetuta in fondo)]
[Overlay record            (fixed, z-index 1000)]
[Lightbox immagine         (fixed, z-index 1100)]
[Modal fotocamera          (fixed, z-index 1200)]
[Modal crop fototessera    (fixed, z-index 1300)]
```

## 2. State shape

```js
{
  // tabelle
  tables:        Array<String>,
  tablesLoading: Boolean,
  tablesError:   String | null,

  // tabella selezionata
  selectedTable: String,          // "" = nessuna
  columns:       Array<String>,   // tutti i campi (incluso id, uuid)
  editableCols:  Array<String>,   // columns senza READONLY_COLS

  // records
  records:       Array<Object>,
  total:         Number | null,   // totale da res.results
  page:          Number,          // 1-based
  pageSize:      Number,          // 10 | 20 | 50 | 100

  // caricamento
  loading:       Boolean,
  error:         String | null,
  successMsg:    String | null,

  // edit mode (tabella inline)
  editMode:      Boolean,
  drafts:        { [id]: { [col]: value } },
  busyIds:       Set<id>,

  // creazione
  creating:      Boolean,
  createDraft:   Object,
  busyCreate:    Boolean,

  // eliminazione
  deleteTarget:  id | null,
  busyDelete:    Set<id>,

  // sort
  sortCol:  String | null,   // default "id"
  sortDir:  "asc"|"desc"|null,  // default "asc"

  // filter
  filterCol:    String,   // colonna selezionata
  filterOp:     String,   // operatore corrente (default "cs")
  filterVal:    String,   // valore libero
  filterActive: Boolean,  // true = filtro applicato alla query corrente

  // allegati (aggiornato dopo ogni loadRecords)
  attachmentMap: Map<String, { mime: String, ext: String }>,
  // chiave = String(id); presente se il record ha un allegato

  // lightbox
  attachmentPreview: Boolean,  // true = lightbox aperto

  // crop fototessera (modulo-level, non dentro overlay)
  cropState: {
    blob:           Blob,
    mimeType:       String,
    imageEl:        HTMLImageElement,
    canvasW:        Number,       // larghezza canvas display (max 520px)
    canvasH:        Number,       // altezza canvas display (max 390px)
    scaleX:         Number,       // px immagine naturale / px canvas
    scaleY:         Number,
    box:            { x, y, w, h },  // riquadro crop in px canvas
    dragging:       Boolean,
    dragOffX:       Number,
    dragOffY:       Number,
    eventsAttached: Boolean,      // true dopo il primo initCropCanvas()
  } | null,

  // overlay
  overlay: {
    record:                  Object,          // copia del record all'apertura
    drafts:                  { [col]: value },
    editing:                 Boolean,
    busy:                    Boolean,
    confirmDelete:           Boolean,
    attachmentBusy:          Boolean,
    confirmDeleteAttachment: Boolean,
    attachmentBlobUrl:       String | null,   // Object URL blob autenticato
    cameraOpen:              Boolean,
    cameraStream:            MediaStream | null,
    cameraDevices:           Array<MediaDeviceInfo>,
    cameraDeviceId:          String,
  } | null,
}
```

### Costanti

```js
const READONLY_COLS = ["id", "uuid"];   // mai inclusi in patch o createDraft
const FOTO_W = 35, FOTO_H = 45;        // mm, ratio 7:9
```

## 3. Tabelle coinvolte

| Operazione | Metodo client |
|---|---|
| Lista tabelle disponibili | `client.tables()` → `GET /tables` |
| Lettura records paginata + sort + filter | `client.table(t).list({ order, size, page, filters })` |
| Schema colonne (fallback se 0 records) | `client.table(t).describe()` → `GET /columns/{t}` |
| Creazione record | `client.table(t).create(data)` |
| Aggiornamento record | `client.table(t).update(id, patch)` |
| Eliminazione record | `client.table(t).remove(id)` |
| Lista allegati (con MIME ed estensione) | `client.table(t).listAttachments()` → `GET /attachments/{t}` |
| Upload allegato | `client.table(t).uploadAttachment(id, file)` → `POST /attachments/{t}/{id}` |
| Scarica allegato (autenticato) | `client.table(t).fetchAttachment(id)` → `GET /attachments/{t}/{id}` → `{ blob, mime, ext }` |
| Elimina allegato | `client.table(t).deleteAttachment(id)` → `DELETE /attachments/{t}/{id}` |

## 4. Logica principale

### Caricamento tabelle

`loadTables()` alla prima mount. Risposta normalizzata a `Array<String>`. Ordinata alfabeticamente.

### Caricamento records

`loadRecords(resetPage?)`:

- Se `resetPage = true`: resetta `page = 1`, `sortCol = "id"`, `sortDir = "asc"`, `filterCol/Op/Val = ""`, `filterActive = false`.
- Resetta sempre: `editMode`, `drafts`, `creating`, `createDraft`, `deleteTarget`.
- **Sort**: `order: [[sortCol, sortDir]]` — omesso se `sortDir === null`.
- **Filter**: `filters: [client.filter(filterCol, filterOp, ...value)]` — omesso se `!filterActive`. Per `is`/`nis` il valore non viene passato.
- **Colonne**: da `Object.keys(records[0])`; se tabella vuota → fallback `describe()`.
- **Allegati**: dopo il caricamento, `listAttachments()` in background popola `attachmentMap`. Silente in caso di errore.

### Ordinamento

`toggleSort(col)`: ciclo asc → desc → null. Resetta `page = 1` e ricarica.

### Filtro

`renderFilterRow()` — barra gialla sotto la toolbar. Operatori: `cs` contiene · `eq` uguale · `sw` inizia · `ew` finisce · `is` vuoto · `nis` non vuoto. Per `is`/`nis` il campo valore è nascosto.

### Badge allegato nella tabella

Se `attachmentMap.has(String(r.id))`, la riga mostra `<i class="ri-attachment-2">` con `title` impostato all'estensione.

### Edit mode (tabella inline)

Ogni cella editabile diventa `<input>`. Salvataggio invia solo i campi modificati. "Nuovo" aggiunge riga verde con input per tutti i campi eccetto `READONLY_COLS`.

### Eliminazione (tabella inline)

Click "Elimina" → `deleteTarget = id` (sfondo arancione, pulsanti ✓/✕). Conferma: `remove(id)` → splice in-place + `total--`. Nessun reload.

### Overlay record (doppio click)

`@dblclick` apre l'overlay con stato iniziale:

```js
overlay = {
  record: Object.assign({}, r),
  drafts: {}, editing: false, busy: false,
  confirmDelete: false,
  attachmentBusy: false, confirmDeleteAttachment: false,
  attachmentBlobUrl: null,
  cameraOpen: false, cameraStream: null,
  cameraDevices: [], cameraDeviceId: ""
}
```

Se il record ha un allegato, parte subito `fetchAttachment()` in background → `URL.createObjectURL(blob)` salvato in `overlay.attachmentBlobUrl`.

**Struttura overlay:**
- **Header**: badge tabella + badge id · pulsanti "Modifica" + cestino (solo in view mode e non `confirmDelete`) · pulsante ✕
- **Corpo** (scroll): tabella nome/valore per tutti i campi. `READONLY_COLS` → badge "Sola lettura" + `<pre>`. Editabili in view mode → `<pre>` grigio. In edit mode → `<textarea>` (riga gialla se draft ≠ originale).
- **Sezione allegato**: vedi §4a
- **Footer**: `confirmDelete` → sfondo arancione + "Elimina" rosso · `editing` → Annulla + "Salva modifiche" · altrimenti vuoto

**`closeOverlay()`**: pulisce `cropState`, ferma `cameraStream`, revoca `attachmentBlobUrl`, poi `overlay = null`, `attachmentPreview = false`, `rerender()`.

**`saveOverlay()`**: calcola `patch` confrontando drafts con valori originali. Se nessuna differenza esce da edit mode senza chiamata API.

### 4a. Sezione allegato nell'overlay

**Stato conferma eliminazione** (`confirmDeleteAttachment = true`):
Avvertimento + "Annulla" + "Elimina" (rosso) → `deleteAttachment()` → `attachmentMap.delete(id)` → revoca e azzera `attachmentBlobUrl`.

**Stato normale:**

| Condizione | UI |
|---|---|
| Immagine + `attachmentBlobUrl` pronto | Thumbnail + occhio (lightbox) + download + cestino |
| Immagine + blob in caricamento | Spinner "caricamento…" + download + cestino |
| File non-immagine | Tag icona + estensione/MIME + download + cestino |
| Nessun allegato | "Nessun allegato" + pulsante upload + pulsante fotocamera |

**Upload file**: se l'`<input type=file>` riceve un'immagine → `startCrop(file, file.type)` (modal crop). Se file non-immagine → upload diretto senza crop.

**Download**: `fetchAttachment()` → blob → `createObjectURL` → `<a download>.click()` → `revokeObjectURL` dopo 1s.

**Thumbnail e lightbox**: usano `overlay.attachmentBlobUrl` (Object URL locale). Nessuna richiesta non autenticata all'API.

### 4b. Modal fotocamera (`renderCameraModal()`, z-index 1200)

Attivato dal pulsante `ri-camera-line` nella sezione allegato → `openCamera()`:

1. `enumerateDevices()` → filtra `videoinput` → salva in `overlay.cameraDevices`
2. `getUserMedia({ video: { deviceId: { exact: ... } } })` → `overlay.cameraStream`
3. `overlay.cameraOpen = true` → `rerender()`
4. `rerender()` assegna `srcObject` al `<video id="wt-camera-preview">` se `!v.srcObject`

**Contenuto modal:**
- `<select>` per scegliere fotocamera (visibile solo se `cameraDevices.length > 1`); cambio → `openCamera()` con nuovo `deviceId`
- `<video autoplay playsinline muted>` — preview live
- Pulsante **"Scatta"** → `capturePhoto()`
- Pulsante **"Annulla"** → `stopCamera()`

**`capturePhoto()`**: disegna il frame su canvas offscreen → `toBlob(jpeg, 0.92)` → `stopCamera()` → `startCrop(blob, "image/jpeg")`.

**`stopCamera()`**: ferma tutti i track, `cameraStream = null`, `cameraOpen = false`.

### 4c. Modal crop fototessera (`renderCropModal()`, z-index 1300)

Attivato da `startCrop(blob, mimeType)` — sia da `capturePhoto()` che da file `<input>` con immagine.

**`startCrop(blob, mimeType)`**:
1. `URL.createObjectURL(blob)` → carica `HTMLImageElement` → revoca URL
2. Scala l'immagine per stare in max 520×390px display
3. Inizializza `cropState.box` centrato, altezza 70% del canvas, ratio `FOTO_W/FOTO_H` (7:9)
4. `rerender()` → `initCropCanvas()` si occupa del resto

**`initCropCanvas()`** (chiamata da `rerender()` ogni volta):
- Imposta `canvas.width/height`, chiama `drawCropCanvas()`
- Attacca pointer events una volta sola (`eventsAttached` flag):
  - `pointerdown`: se il click è dentro il box → inizia drag, `setPointerCapture`
  - `pointermove`: sposta `box.x/y` clampati ai bordi canvas, `drawCropCanvas()`
  - `pointerup`: termina drag

**`drawCropCanvas()`**:
1. Disegna l'immagine intera sul canvas
2. Overlay scuro `rgba(0,0,0,0.58)` sull'intera area
3. Ridisegna l'immagine nella sola regione del box (porzione corretta via `scaleX/scaleY`)
4. Bordo bianco 2px sul box
5. Griglie dei terzi `rgba(255,255,255,0.35)`

**Pulsanti modal:**
- **"Ritaglia e carica"** → `confirmCrop()`: canvas offscreen 350×450px → `toBlob(jpeg, 0.92)` → upload → aggiorna `attachmentMap` + `attachmentBlobUrl`
- **"Carica originale"** → `skipCrop()`: upload del blob originale senza modifiche
- **"Annulla"** → `cancelCrop()`: `cropState = null`

### Lightbox (`renderAttachmentPreview()`, z-index 1100)

Reso quando `attachmentPreview = true` e `overlay.attachmentBlobUrl` non è null. Sfondo `rgba(0,0,0,0.85)`. `<img>` a max 90vw/90vh. Click backdrop o ✕ → `attachmentPreview = false`.

### Notifiche

`flash(msg, isError?)` — `successMsg` auto-dismiss 3s, `error` auto-dismiss 5s.

## 5. Metodo `tables()` nel client

Opzioni di configurazione: `options.tablesPath` (default `"/tables"`), `options.attachmentsPath` (default `"/attachments"`).

## 6. Note tecniche

- **`READONLY_COLS`**: `["id", "uuid"]` — esclusi da edit inline, `createDraft`, payload update.
- **Stack modal**: overlay 1000 → lightbox 1100 → camera 1200 → crop 1300. Ogni livello superiore è non-interattivo con quelli inferiori.
- **`<img src>` mai punta all'API**: thumbnail e lightbox usano `overlay.attachmentBlobUrl`. Il browser non invia mai richieste non autenticate.
- **Gestione memoria blob**: ogni `createObjectURL` è accoppiato al suo `revokeObjectURL` — chiusura overlay, delete allegato, download (dopo 1s), `startCrop` (subito dopo `img.onload`).
- **`cropState.eventsAttached`**: impedisce di registrare i pointer listener multipli volte dato che `initCropCanvas()` viene chiamato ad ogni `rerender()`.
- **Canvas output crop**: sempre 350×450px JPEG — corrisponde a ~100px/cm a 3.5×4.5cm (fototessera standard italiana).
- **Selezione fotocamera**: se `cameraDevices.length > 1`, il `<select>` nel modal mostra i label dei dispositivi (o "Fotocamera N" se il label è vuoto — browser richiedono il permesso prima di esporre i label).
- **`listAttachments()` silente**: se fallisce, `attachmentMap` resta vuota. Nessun errore mostrato.
- **Cache busting**: `VERSION = window.APP_CONFIG?.version || Date.now()` — import dinamico della view.
- **Paginazione doppia**: `renderPagination()` sopra e sotto `renderTable()`.
- **Eliminazione ottimistica**: `remove` → splice in-place + `total--`, senza reload.
