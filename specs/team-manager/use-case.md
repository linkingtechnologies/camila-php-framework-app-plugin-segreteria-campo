# UC-011 — Gestione squadre

Registrazione delle squadre come risorsa aggregata, quando non si dispone del
dettaglio di volontari, mezzi e attrezzature.

## Contesto di sistema

Il sistema tratta tre tipi di risorsa registrati singolarmente — `volontari`,
`mezzi`, `materiali` — ciascuno con la propria identità (codice fiscale, targa,
id materiale). Capita però che un'organizzazione metta a disposizione una squadra
senza che la segreteria abbia, o voglia registrare, il dettaglio di chi e cosa la
compone.

La squadra diventa allora una **quarta risorsa**, la cui identità è il nome e la
cui consistenza è espressa da conteggi.

### Regola: o l'aggregato o il dettaglio

Una squadra registrata qui e i volontari registrati singolarmente **si escludono
a vicenda**. Se le stesse persone comparissero in entrambi i modi, ogni
riepilogo le conterebbe due volte.

Nulla nel modello dati impedisce la sovrapposizione: è una regola organizzativa,
non un vincolo tecnico. Il posto naturale per accorgersene è `conf/integrity.xml`,
che ospita già controlli di coerenza di questo genere.

## Goal

Un operatore di segreteria registra una squadra indicando da quali organizzazioni
proviene, quante persone e quanti mezzi porta, chi la guida e a quale servizio è
assegnata, senza dover registrare le singole risorse.

## Primary Actor

Operatore di segreteria campo.

## Stakeholders e interessi

| Stakeholder | Interesse |
|---|---|
| Operatore di segreteria | Registrare in fretta una squadra senza il dettaglio |
| Responsabile SOP | Sapere quante persone e mezzi ci sono su ciascun servizio |
| Caposquadra | Essere reperibile e associato alla propria squadra |
| Organizzazioni | Vedere riconosciuto il proprio apporto anche in squadra congiunta |

## Precondizioni

- L'operatore è autenticato.
- La tabella `squadre-dichiarate` è raggiungibile.

## Postcondizioni — Successo

- Il record esiste in `squadre-dichiarate`.
- Il nome della squadra è utilizzabile come valore del campo `squadra` sulle
  altre risorse e come squadra attivabile su un intervento.

## Postcondizioni — Errore/Fallimento parziale

- Un salvataggio fallito lascia il record nello stato precedente; la bozza resta
  a schermo e l'errore è mostrato accanto al form.
- Se il recupero dei permessi fallisce, la SPA entra in sola lettura.

## Classificazione stati

Derivata dalle date, come in `org-status`:

| Condizione | Etichetta |
|---|---|
| `data-inizio-attestato` valorizzata, `data-fine-attestato` vuota | In servizio |
| entrambe valorizzate | Non in servizio |
| `data-inizio-attestato` vuota | Da registrare |

## Main Success Scenario

### Elenco squadre

1. L'operatore apre Gestione interventi e passa alla vista Squadre.
2. Il sistema carica le squadre e le mostra in elenco con nome, organizzazioni,
   consistenza e stato.
3. L'operatore può restringere l'elenco con la ricerca testuale o con i filtri
   di stato e servizio.
4. In testa all'elenco il sistema mostra i totali delle squadre filtrate:
   quante squadre, quante persone, quanti mezzi, quante attrezzature.

### Registrazione di una nuova squadra

1. L'operatore sceglie di creare una nuova squadra.
2. Il sistema apre una finestra con i campi essenziali: nome, organizzazioni,
   numero di volontari e mezzi.
3. L'operatore inserisce almeno il nome, che è obbligatorio, e conferma.
4. Il sistema crea il record e apre la scheda completa sulla squadra creata.
5. L'operatore completa la scheda con mansione prevalente, caposquadra, servizio
   e periodo.

### Modifica

1. L'operatore seleziona una squadra dall'elenco.
2. Il sistema mostra la scheda compilata e segnala le modifiche non salvate.
3. L'operatore salva, e il sistema aggiorna il record e ricarica l'elenco.

### Eliminazione

1. L'operatore chiede di eliminare la squadra selezionata.
2. Il sistema verifica se volontari, mezzi o materiali hanno quel nome nel campo
   `squadra`.
3. Se nessuna risorsa la referenzia, il sistema chiede conferma esplicita.
4. Alla conferma elimina il record e ricarica l'elenco.

## Extensions

**2a. Nessuna squadra registrata** — l'elenco mostra uno stato vuoto e il
pulsante di creazione resta disponibile.

**2b. Errore di caricamento** — messaggio con pulsante "Riprova"; la pagina
resta utilizzabile.

**2c. Permessi non recuperabili** — sola lettura: la scheda è consultabile, ogni
azione di scrittura è disabilitata.

**3a. Nome mancante** — la creazione è rifiutata con un errore nella finestra: il
nome identifica la squadra ed è il valore con cui viene referenziata altrove.

**3b. Nome già esistente** — il sistema avvisa che esiste già una squadra con
quel nome; l'operatore può comunque procedere.

**5a. Organizzazione fuori catalogo** — un'organizzazione registrata in
precedenza e non più presente fra i valori correnti resta visibile e
selezionata, non viene scartata in silenzio.

**5b. Salvataggio fallito** — l'errore è mostrato accanto al form, la bozza non
viene persa.

**2d. Squadra referenziata da risorse** — l'eliminazione è bloccata e il sistema
indica quante risorse la stanno usando, per categoria.

## Fuori ambito, per ora

- **Check-in e check-out massivi.** Le squadre non compaiono nei flussi massivi:
  le date si compilano a mano sulla scheda. I campi
  `data/ora-registrazione` e `data/ora-uscita-definitiva` esistono comunque, così
  l'integrazione futura non richiederà di modificare la tabella.
- **`org-status` e report.** Le squadre non sono conteggiate nella dashboard per
  organizzazione né nei report: vedere `design.md` §Agganci mancanti.
