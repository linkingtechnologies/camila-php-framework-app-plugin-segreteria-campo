# Check-in massivo {#top}

Registra in un'unica sessione l'arrivo di volontari, mezzi e materiali di *una*
organizzazione. Si apre da *Accreditamento risorse → Check-in massivo*.

Sono sette passi, ma puoi fermarti o saltare quelli che non ti servono: per
esempio, registrare solo i mezzi.

| Passo | Cosa fai |
|---|---|
| 1 | scegli l'organizzazione |
| 2 | scegli i volontari da registrare |
| 3 | controlli i loro dati e li inserisci |
| 4 | scegli i mezzi |
| 5 | controlli i dati dei mezzi e li inserisci |
| 6 | scegli i materiali |
| 7 | controlli i dati dei materiali e li inserisci |

Chi è già presente non viene registrato due volte. Le risorse nuove ricevono come
*data inizio attestato* la data di oggi.

## Passo 1 — Organizzazione {#passo-1}

Scegli l'organizzazione dall'elenco. Puoi cercare per nome, codice o provincia nel
campo *Cerca organizzazione…*. L'elenco unisce le organizzazioni dei
preaccreditati e quelle del database.

Se una delle due sorgenti non si carica vedi le organizzazioni dell'altra e un
avviso: **Riprova** ripete il caricamento. Se la ricerca non trova nulla vedi
**Nessun risultato**.

### Con il totem {#passo-1-totem}

Nella modalità totem l'organizzazione non si sceglie dall'elenco ma con il suo
codice: lo scrivi in *Codice organizzazione* e premi **Conferma**, oppure premi
**Scansiona QR code** e inquadri il QR con la fotocamera. **Annulla** chiude la
scansione.

Se il codice non è riconosciuto vedi **Codice non riconosciuto. Verifica e
riprova.** e puoi riprovare. Se la fotocamera non è disponibile resta la
digitazione. `[DA VERIFICARE]` da dove arriva il QR dell'organizzazione.

## Passo 2 — Scegli i volontari {#passo-2}

Vedi due sezioni: **Volontari preaccreditati** e **Database Volontari**. Chi
compare in entrambe è mostrato una sola volta, tra i preaccreditati, con i turni
uniti (il confronto è sul codice fiscale).

- Per filtrare per turno usa i pulsanti dei turni; **Tutti i turni** toglie il filtro.
  Il filtro vale solo tra i preaccreditati.
- Cerca per codice fiscale, cognome, nome o turno nel campo di ricerca.
- **Seleziona preaccreditati visibili** sceglie tutti quelli che vedi dopo i
  filtri; **Deseleziona tutto** annulla la scelta.
- **Aggiungi volontario** registra tra i preaccreditati una persona che non è in
  elenco. Servono **Codice fiscale** (16 caratteri), **Cognome** e **Nome**;
  **Turno (opzionale)** propone i turni esistenti o ne accetta uno nuovo. Poi
  **Salva**.

**Check-in volontari selezionati** porta al passo 3. Se non devi registrare
volontari, **Passa direttamente a Check-in mezzi** o **Passa direttamente a
Check-in materiali** saltano i passi che non servono. **Indietro** torna alla
scelta dell'organizzazione.

## Passo 3 — Controlla e inserisci i volontari {#passo-3}

Ogni volontario scelto è una riga, e la colonna **Esito** dice a che punto è:
**Da inserire**, **Inserito**, **Già presente** o **Errore**. Chi risulta già
presente oggi, o è arrivato nei giorni scorsi e non è ancora uscito, è in sola
lettura e viene saltato.

Per i volontari da inserire puoi correggere, riga per riga:

- in **Mansione / Servizio**: **Mansione**, **Servizio**, **Responsabile** e **Autista**
- in **Dati aggiuntivi**: **Pernottamento**, **Pranzo**, **Cena**, **Intolleranze**,
  **Cellulare** ed **Email**
- in **Benefici / Num. gg**: **Benefici** e **Num. gg**

### Imposta per tutti {#imposta-per-tutti}

Sopra la tabella, **Imposta per tutti** serve quando molti volontari hanno la
stessa mansione o lo stesso servizio: scegli il valore e premi **Applica a N**. Il
valore *sostituisce* quello di tutte le N righe ancora da inserire (da inserire o
in errore); le righe già inserite o già presenti restano come sono. Dopo, puoi
correggere le singole righe.

### Inserimento {#passo-3-inserimento}

**Inserisci volontari** li registra uno alla volta e mostra l'esito di ogni riga.
Se qualcuno fallisce, **Riprova solo quelli in errore**: non si ricomincia da
capo. Quando tutti sono inseriti o già presenti si abilita **Check-in mezzi**.

Se i servizi non si caricano vedi un avviso e resta disponibile solo
*IN ATTESA DI SERVIZIO*.

## Passo 4 — Scegli i mezzi {#passo-4}

Come il passo 2, ma il confronto è sulla targa. Le sezioni sono **Mezzi
preaccreditati** e **Database mezzi**. **Carica tutti i mezzi presenti nel
database** mostra anche quelli non legati all'organizzazione.

**Aggiungi mezzo preaccreditato** apre il modulo di un mezzo nuovo: **Targa**,
**Marca** e **Modello** sono obbligatori. **Categoria** e **Tipologia** devono
essere coerenti: scegliere la tipologia imposta la categoria, e cambiare
categoria azzera una tipologia che non le appartiene. Una targa già presente
viene rifiutata.

**Check-in mezzi** porta al passo 5; **Passa direttamente a Check-in materiali**
salta i mezzi.

## Passo 5 — Controlla e inserisci i mezzi {#passo-5}

Come il passo 3, per i mezzi. Oltre a **Servizio** puoi indicare i **Km
(inizio/arrivo/partenza)**, il **Referente (nome / tel.)** e la **Provenienza**;
**Filtro turno** restringe l'elenco. **Inserisci mezzi** li registra; se qualcuno
fallisce, **Riprova solo quelli in errore**.

Quando tutti i mezzi sono inseriti o già presenti, **Inserimento materiali** porta
ai materiali.

## Passo 6 — Scegli i materiali {#passo-6}

Come i passi 2 e 4, con le sezioni **Materiali preaccreditati** e **Database
materiali**. **Aggiungi materiale preaccreditato** propone l'**ID materiale** in
automatico (`MAT` seguito da un numero); se la proposta non è disponibile lo
scrivi tu. Un ID già presente viene rifiutato.

**Check-in materiali** porta al passo 7. **Fine** conclude la sessione senza
registrare materiali.

## Passo 7 — Controlla e inserisci i materiali {#passo-7}

Come il passo 3, per i materiali: correggi il **Servizio** e il turno, poi
**Inserisci materiali**. Se qualcuno fallisce, **Riprova solo quelli in errore**.
**Indietro** torna alla scelta dei materiali.

Al termine, **Fine** azzera la sessione e torna alla scelta dell'organizzazione,
pronta per una nuova.

## Se qualcosa non va {#problemi}

- Un errore su una riga non ferma le altre: la riga resta in **Errore** e puoi
  ritentarla.
- Se la sessione di lavoro scade vedi un riquadro giallo: premi **Esci e
  rientra**. Ricaricare la pagina non basta.
