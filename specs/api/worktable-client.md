# Guida alle API — WorkTableClient

`WorkTableClient` è il client JavaScript browser che espone le API REST del framework Camila (basate su php-crud-api). Gestisce autenticazione, timeout, filtri e allegati. Tutte le chiamate restituiscono `Promise`.

---

## Inizializzazione

```js
var api = new WorkTableClient({
  baseUrl:          "/app/segreteriacampo/cf_api.php",
  apiKeyHeaderName: "X-API-Key",   // opzionale
  apiKeyHeaderValue: "mytoken",    // opzionale
  timeoutMs:        20000          // default 20s
});
```

Se si usa la sessione Camila (cookie), non serve l'API key.

---

## Nomi tabella e colonna

Le tabelle e le colonne Camila hanno nomi con spazi e maiuscole (es. `"Volontari Preaccreditati"`, `"Data Inizio"`). Nell'API vengono convertiti in kebab-case minuscolo (es. `volontari-preaccreditati`, `data-inizio`).

---

## CRUD — operazioni di base

### Leggi un record

```js
api.read("volontari", "uuid-del-record")
  .then(function(record) { console.log(record); });
```

### Lista record

```js
api.list("volontari", { size: 50 })
  .then(function(result) { console.log(result.records); });
```

### Crea un record

```js
api.create("volontari", {
  "cognome": "Rossi",
  "nome": "Mario",
  "organizzazione": "Croce Rossa"
}).then(function(id) { console.log("creato:", id); });
```

### Aggiorna un record

```js
api.update("volontari", "uuid-del-record", {
  "servizio": "Logistica"
});
```

### Elimina un record

```js
api.remove("volontari", "uuid-del-record");
```

---

## Sintassi table-bound (alternativa)

```js
var t = api.table("volontari");

t.list({ size: 10 });
t.read("uuid");
t.create({ "nome": "Mario" });
t.update("uuid", { "servizio": "A" });
t.remove("uuid");
```

---

## Filtri

### AND (tutti devono corrispondere)

```js
api.list("volontari", {
  filters: [
    api.filter("organizzazione", "eq", "Croce Rossa"),
    api.filter("data-fine-attestato", "is", "null")
  ]
});
```

### Operatori disponibili

| Operatore | Significato |
|---|---|
| `eq` | uguale |
| `neq` | diverso |
| `lt` / `lte` | minore / minore o uguale |
| `gt` / `gte` | maggiore / maggiore o uguale |
| `cs` | contiene stringa |
| `sw` | inizia con |
| `ew` | finisce con |
| `is` | IS NULL (`"null"`) / IS NOT NULL (`"notnull"`) |
| `in` | in lista (valori multipli) |
| `bt` | between (due valori) |

Prefisso `n` per negare: `api.negate("eq")` → `"neq"`.

### OR filter

```js
api.list("volontari", {
  orFilters: {
    "filter1": api.filter("organizzazione", "eq", "CRI"),
    "filter2": api.filter("organizzazione", "eq", "PC")
  }
});
```

---

## Ordinamento e paginazione

```js
api.list("com-digitali", {
  order:   [["received-date", "desc"]],
  size:    100,
  page:    1
});
```

---

## Colonne — includi / escludi

```js
api.list("volontari", {
  include: ["cognome", "nome", "organizzazione"]
});

api.list("volontari", {
  exclude: ["payload", "note-interne"]
});
```

---

## Valori distinti

```js
api.distinct("volontari", "organizzazione")
  .then(function(result) { console.log(result.records); });
```

---

## Schema tabella

```js
api.describe("volontari")
  .then(function(schema) { console.log(schema.columns); });

// oppure table-bound:
api.table("volontari").describe();
```

---

## Permessi

```js
api.permissions("volontari")
  .then(function(p) { console.log(p); });
```

---

## Allegati

### Carica un file

```js
var file = document.querySelector("input[type=file]").files[0];
api.uploadAttachment("volontari", "uuid", file)
  .then(function(res) { console.log(res.url); });
```

### Controlla se esiste

```js
api.hasAttachment("volontari", "uuid")
  .then(function(info) {
    if (!info) console.log("nessun allegato");
    else console.log(info.mime, info.ext);
  });
```

### Scarica come blob (per visualizzazione inline)

```js
api.fetchAttachment("volontari", "uuid")
  .then(function(res) {
    var url = URL.createObjectURL(res.blob);
    document.querySelector("img").src = url;
  });
```

### URL diretto (forza download)

```js
var url = api.attachmentUrl("volontari", "uuid");
window.open(url);
```

### Lista allegati per tabella

```js
api.listAttachments("volontari")
  .then(function(res) { console.log(res.ids); });
// → [{id, mime, ext}, ...]
```

### Elimina allegato

```js
api.deleteAttachment("volontari", "uuid");
```

---

## Endpoint custom (plugin)

Per chiamare endpoint aggiuntivi del plugin (es. webhook, health check, codici totem) si usa `call()`. L'autenticazione viene applicata automaticamente.

```js
// GET con query string
api.call("GET", "/segreteria-campo/status")
  .then(function(res) { console.log(res.status); });

// GET con parametri
api.call("GET", "/segreteria-campo/totem/organization-codes")
  .then(function(res) { console.log(res.data); });

// PUT con body JSON
api.call("PUT", "/segreteria-campo/radio/messages", {
  messagesPayload: [
    { id: "MSG-001", timestamp: 1726087976, from: "Squadra A", to: "Centrale", text: "In posizione" }
  ]
}).then(function(res) { console.log(res.inserted_count); });
```

**Firma:** `call(method, path, body?, query?)`
- `method` — `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"`
- `path` — path completo a partire dalla radice (es. `"/segreteria-campo/status"`)
- `body` — oggetto JavaScript, serializzato come JSON (opzionale)
- `query` — oggetto chiave/valore → query string (opzionale)

---

## Gestione errori

```js
api.list("volontari")
  .then(function(result) { /* ok */ })
  .catch(function(err) {
    console.error(err.status);   // es. 401, 403, 500
    console.error(err.payload);  // corpo della risposta di errore
  });
```

Errori di rete o timeout producono un `Error` senza `status`.

---

## Tabelle disponibili

```js
api.tables()
  .then(function(res) { console.log(res.tables); });
```
