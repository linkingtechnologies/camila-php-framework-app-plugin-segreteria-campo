# Design — warehouse-manager

**Pulsante dashboard:** "Gestione magazzini"

## 1. Struttura

Clone di `service-manager` adattato per la tabella `magazzini`. Single-view SPA (nessun wizard). Dati caricati al mount e ricaricati dopo ogni scrittura.

```
[Lista magazzini — pannello sinistro 320px, scroll verticale]
  ⠿ ● Nome magazzino                    📍? N
[Form dettaglio — pannello destro, scroll verticale]
  Nome* | Ordine | Lettera | Colore | Descrizione
  Posizione: Indirizzo | Comune | Provincia | Lat | Lon
  Operatori a supporto | Note
[Modale mappa Leaflet]
```

## 2. Differenze rispetto a service-manager

| Aspetto | service-manager | warehouse-manager |
|---|---|---|
| Tabella | `servizi` | `magazzini` |
| Campi extra | `inizio`, `fine` | — (non presenti) |
| Bulk tools | Importa da preaccreditati, inserisci obbligatori, cancella tutto | — (non presenti) |
| Record protetti | `IN ATTESA DI SERVIZIO`, `USCITA DEFINITIVA` | — (nessuno) |
| Check uso prima di eliminare | `volontari`, `mezzi`, `materiali` | `mov-consumabili` (origine + destinazione) |
| Prefissi CSS | `sm-` | `wm-` |
| Export function | `ServiceManager` | `WarehouseManager` |
| Icona placeholder | `ri-list-check-2` | `ri-home-gear-line` |

## 3. Campi

```js
INCLUDE = [
  "id", "nome", "ordine", "lettera", "colore", "descrizione",
  "latitudine", "longitudine", "comune", "provincia", "indirizzo",
  "operatori-a-supporto", "note"
]
```

Nessun campo `inizio`/`fine`.

## 4. State shape

```js
{
  loading:        Boolean,
  error:          Any | null,
  magazzini:      Array,          // ordinati per ordine ASC, poi nome
  search:         String,

  selected:       Object | null,  // magazzino selezionato
  form:           FormObject,
  formMode:       "new" | "edit" | null,
  formBusy:       Boolean,
  formError:      String | null,
  formSuccess:    String | null,

  deleteConfirm:  Boolean,
  deleteBusy:     Boolean,
  deleteUsage:    null | { checking: true } | { tot: Number },
  deleteBlocked:  Boolean,

  dragId:         String | null,
  dragOverId:     String | null,

  coordClipboard: null | { latitudine, longitudine } | { latitudine, longitudine, comune, provincia, indirizzo },

  colorDropOpen:  Boolean,
  formDirty:      Boolean,
  pendingSelect:  Object | "new" | null,

  // mappa
  showMap:        Boolean,
  mapSearch:      String,
  mapResults:     Array,
  mapSearching:   Boolean,
  mapReversing:   Boolean,
  mapLat:         Number | null,
  mapLon:         Number | null,
  mapAddress:     { comune, provincia, indirizzo },
}
```

## 5. Tabelle coinvolte

| Operazione | Tabella |
|---|---|
| Lettura magazzini | `magazzini` |
| Creazione magazzino | `magazzini` (`.create()`) |
| Aggiornamento magazzino | `magazzini` (`.update(id, payload)`) |
| Eliminazione magazzino | `magazzini` (`.remove(id)`) |
| Check uso prima di eliminare | `mov-consumabili` (filtro su `magazzino-origine` e `magazzino-destinazione`) |

## 6. Logica di eliminazione

⚠️ La tabella `magazzini` non supporta il flag `{ _delete: true }` — usare `.remove(id)`.



Prima di mostrare il pulsante di conferma eliminazione, la SPA verifica se il magazzino è referenziato in `mov-consumabili` (come origine o destinazione). Se almeno una movimentazione lo usa, l'eliminazione è bloccata con messaggio esplicito.

```js
// check uso
const [ro, rd] = await Promise.all([
  client.table("mov-consumabili").list({ filters: [filter("magazzino-origine", nome)],      include: ["id"], size: 1 }),
  client.table("mov-consumabili").list({ filters: [filter("magazzino-destinazione", nome)], include: ["id"], size: 1 }),
]);
deleteBlocked = (getRecords(ro).length + getRecords(rd).length) > 0;
```

## 7. Mappa (Leaflet)

Identica al service-manager:
- Leaflet caricato lazy da CDN (`unpkg.com/leaflet@1.9.4`)
- Geocoding: Nominatim (OpenStreetMap)
- Click sulla mappa → reverse geocoding → popola comune, provincia, indirizzo
- Marker draggable → stessa logica
- Copia/incolla coordinate tra magazzini tramite `coordClipboard`

## 8. Altre note tecniche

- **Drag & drop riordino**: tutti i magazzini sono draggable (nessun record protetto). Drop su un altro magazzino riscrive `ordine` sequenziale (1…N) su tutti i record riordinati.
- **Dirty form**: banner giallo se ci sono modifiche non salvate e l'utente tenta di cambiare selezione o creare nuovo. Offre "Scarta e continua" / "Rimani qui".
- **Duplicato nome**: il salvataggio non è bloccato ma avvisa con ⚠️ se esiste già un magazzino con lo stesso nome.
- **Clona**: crea una copia con nome `"X (copia)"` e ordine massimo + 1.
- **Prefissi CSS `wm-`**: separati da `sm-` del service-manager per evitare conflitti quando entrambe le SPA sono montate nello stesso documento.
