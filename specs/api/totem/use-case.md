# Use Case — totem

## Identificativo

UC-TM — Verifica accredito volontario tramite totem

---

## Contesto di sistema

Dispositivo totem fisico (kiosk) posizionato all'ingresso del campo. Permette al volontario di verificare autonomamente il proprio accredito e il codice della propria organizzazione senza assistenza della segreteria. Funziona anche in modalità offline (dati scaricati in anticipo).

---

## Goal

Consentire al volontario di verificare la propria presenza tra i preaccreditati e ottenere il codice organizzazione associato, tramite un'interfaccia self-service.

---

## Primary Actor

Volontario in arrivo al campo

---

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Volontario | Verificare rapidamente il proprio accredito senza code in segreteria |
| Operatore segreteria | Ridurre il carico di verifica manuale degli accrediti |
| Responsabile organizzazione | Conoscere il codice organizzazione per le operazioni di campo |

---

## Precondizioni

- La tabella `volontari-preaccreditati` contiene i dati dei volontari attesi.
- Il totem ha scaricato i codici organizzazione tramite `GET /totem/organization-codes`.

---

## Postcondizioni

- Il volontario ha visualizzato il proprio stato di accredito.
- Il volontario conosce il codice della propria organizzazione.

---

## Main Success Scenario

### Step 1 — Caricamento codici

1. Il totem chiama `GET /segreteria-campo/totem/organization-codes` all'avvio.
2. Scarica e memorizza localmente la lista `{org, cod}`.
3. I codici sono validi per tutta la sessione (deterministici: stessa org → stesso codice).

### Step 2 — Ricerca volontario

1. Il volontario inserisce nome/cognome o scansiona un QR.
2. Il totem cerca nella lista preaccreditati (locale o via API).

### Step 3 — Visualizzazione risultato

1. Se trovato: mostra nome, organizzazione e codice organizzazione.
2. Se non trovato: invita a rivolgersi alla segreteria.

---

## Extensions

### 1a. Totem offline
- I codici scaricati in precedenza vengono usati senza nuova chiamata API.
- I codici sono deterministici: non cambiano finché il nome organizzazione non cambia.

### 2a. Volontario non in lista
- Messaggio: "Non risulti tra i preaccreditati. Rivolgiti alla segreteria."
