# Use Case — warehouse (Movimentazioni Consumabili)

## Attori

- **Operatore logistico**: registra movimentazioni durante l'evento.
- **Responsabile magazzino**: consulta giacenze e storico.

---

## UC-1 — Registrare una nuova movimentazione

**Precondizioni:** magazzini configurati in `magazzini`; SPA aperta sul tab Movimentazioni.

1. Clicca "+ Nuova movimentazione".
2. Si apre la modale. Il campo `data/ora` è precompilato con il timestamp corrente (read-only).
3. Seleziona `tipo`:
   - **CARICO** → disabilita `magazzino-origine`
   - **SCARICO** → disabilita `magazzino-destinazione`
   - **TRASFERIMENTO** → entrambi i magazzini abilitati e obbligatori
4. Digita `articolo` (con autocomplete dagli articoli già usati).
5. Inserisce `quantita` (intero positivo).
6. Inserisce `unita-di-misura` (con autocomplete).
7. Seleziona magazzino/i pertinenti.
8. Seleziona `servizio` (opzionale, tipicamente per SCARICO verso campo).
9. Inserisce `operatore` e `note` (opzionali).
10. Clicca "Conferma" → record creato in `mov-consumabili`, dataset ricaricato, giacenze aggiornate.

**Validazione:**
- `tipo`, `articolo`, `quantita > 0` obbligatori sempre
- `magazzino-destinazione` obbligatorio se tipo ≠ SCARICO
- `magazzino-origine` obbligatorio se tipo ≠ CARICO

---

## UC-2 — Consultare lo storico movimentazioni

1. Tab "Movimentazioni" attivo per default.
2. L'operatore usa i filtri: tipo, magazzino, articolo, ricerca testo libero.
3. Scorre la tabella paginata (default 50 righe/pagina).
4. Naviga tra le pagine con i controlli di paginazione.

**Nota:** le movimentazioni sono immutabili — non è possibile modificarle o eliminarle.

---

## UC-3 — Consultare le giacenze

1. Clicca tab "Giacenze".
2. La tabella articolo × magazzino è calcolata istantaneamente client-side.
3. Valori negativi (sotto-scorta o errore dati) sono evidenziati in rosso.
4. Non sono necessarie ulteriori chiamate API.

---

## UC-4 — Aggiornare i dati

1. Clicca "Aggiorna" in toolbar.
2. Ricarica `mov-consumabili`, `magazzini`, `servizi` in parallelo.
3. Storico e giacenze si aggiornano di conseguenza.
