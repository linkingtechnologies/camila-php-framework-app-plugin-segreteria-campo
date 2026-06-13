# Use Case — warehouse-manager

## Attori

- **Organizzatore / Logista**: configura l'anagrafica dei magazzini prima e durante l'evento.

## UC-1 — Creare un nuovo magazzino

**Precondizioni:** utente nella SPA warehouse-manager.

1. Clicca "+ Nuovo magazzino" (pulsante `ri-add-line` in toolbar lista).
2. Compila Nome (obbligatorio), Ordine, Colore, Lettera, Descrizione.
3. Imposta posizione: inserisce indirizzo manualmente oppure clicca "Scegli sulla mappa".
4. Compila Operatori a supporto e Note (opzionali).
5. Clicca "Crea magazzino" → record creato in `magazzini`.

**Eccezioni:**
- Nome vuoto → errore bloccante.
- Nome duplicato → avviso non bloccante (⚠️), salvataggio avviene comunque.

---

## UC-2 — Modificare un magazzino esistente

1. Seleziona il magazzino dalla lista.
2. Modifica i campi desiderati nel pannello dettaglio.
3. Clicca "Salva modifiche".

**Comportamento dirty form:** se tenta di selezionare un altro magazzino o creare nuovo con modifiche non salvate, compare banner di conferma "Scarta e continua" / "Rimani qui".

---

## UC-3 — Eliminare un magazzino

1. Seleziona il magazzino.
2. Clicca "Elimina".
3. La SPA verifica se il magazzino è usato in `mov-consumabili` (come origine o destinazione).
   - **Usato** → blocco con messaggio esplicito. Eliminazione non disponibile.
   - **Non usato** → chiede conferma testuale, poi elimina.

---

## UC-4 — Riordinare i magazzini

1. Trascina un magazzino nella lista (handle ⠿) in una nuova posizione.
2. La SPA riscrive il campo `ordine` su tutti i record riordinati.

---

## UC-5 — Clonare un magazzino

1. Seleziona il magazzino.
2. Clicca "Clona".
3. Viene creata una copia con nome `"X (copia)"` e ordine massimo + 1.
4. La copia viene selezionata automaticamente per la modifica immediata del nome.

---

## UC-6 — Impostare la posizione tramite mappa

1. Nel form dettaglio, clicca "Scegli sulla mappa".
2. Si apre la modale Leaflet con eventuale posizione pre-caricata dai campi lat/lon del form.
3. Cerca un indirizzo tramite Nominatim oppure clicca direttamente sulla mappa.
4. Il marker è draggable per affinare la posizione.
5. Il reverse geocoding popola automaticamente comune, provincia, indirizzo.
6. Clicca "Conferma posizione" → i campi del form vengono aggiornati.

---

## UC-7 — Copiare e incollare coordinate tra magazzini

1. Con un magazzino selezionato e le coordinate impostate, apre il dropdown "Copia coordinate".
2. Sceglie "Solo coordinate" o "Coordinate + indirizzo".
3. Seleziona un altro magazzino.
4. Clicca "Incolla" → le coordinate (e opzionalmente l'indirizzo) vengono copiati nel form.
