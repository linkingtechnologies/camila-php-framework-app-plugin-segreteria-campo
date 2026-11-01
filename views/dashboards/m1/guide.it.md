# Report {#top}

I report mostrano, in tabelle e grafici, la situazione dell'evento: quanti volontari e
mezzi ci sono, da dove vengono, cosa stanno facendo. Si aprono dal riquadro
*Monitoraggio* della pagina iniziale con **Report situazione attuale** e **Report
situazione complessiva**.

Sono pagine di sola lettura: i numeri vengono calcolati al momento dalle tabelle di
evento, quindi per cambiarli si correggono i dati alla fonte (per esempio con il
[Check-in massivo](guide:massive-check-in) o la [Movimentazione
risorse](guide:resource-board)).

*La pagina si ricarica da sola ogni 30 secondi*: non serve aggiornarla a mano per
seguire l'evento.

## La pagina {#pagina}

A sinistra c'è il report scelto, con il suo titolo. A destra, il riquadro **Report**
elenca i report disponibili:

- il pulsante col nome del report lo apre a schermo;
- il pulsante con *(in PDF)* lo scarica in PDF;
- il pulsante con *(in .docx)* lo scarica come documento Word.

PDF e Word hanno in testa il logo, il nome dell'evento, il comune e il nome del
campo, presi dai dati dell'evento (*Configurazione → Informazioni intervento* e
*Carica loghi*).

Sotto, **Altre risorse** porta a due pagine collegate:

- **Report operativi**: la tabella dei report operativi (REPORT) dell'applicazione;
- **Riepilogo ospiti e risorse**: un elenco di collegamenti, uno per ogni segnalibro
  dell'applicazione, ciascuno con il suo contatore.

## I due report {#report}

Nella versione base ci sono due report. Il loro contenuto è definito dai file in
`reports/it/` e può essere diverso in un'installazione personalizzata: se l'elenco
sulla pagina non corrisponde a quanto scritto qui, vale la pagina. Se l'elenco è
vuoto, nell'installazione non ci sono report configurati.

### Situazione attuale {#attuale}

È il report che si apre da **Report situazione attuale**. Per i volontari «in
servizio» vuol dire con un servizio assegnato diverso da USCITA DEFINITIVA e da quelli
«non in servizio». Contiene:

- volontari in servizio, per servizio, per organizzazione e per provincia;
- volontari registrati e volontari unici per provincia;
- mezzi registrati e mezzi unici per provincia, e chilometri percorsi in servizio;
- organizzazioni in servizio e per provincia;
- volontari attesi e volontari di cucina per provincia;
- tende e posti per gli ospiti, ospiti per fascia di età, informazioni sugli ospiti;
- stima dell'utilizzo dei benefici di legge e attività.

«Unici» significa che ciascuno è contato una sola volta anche se compare più volte.

### Finale {#finale}

È il report che si apre da **Report situazione complessiva**: i conteggi complessivi
dell'evento, raggruppati per giorno, organizzazione e provincia. Contiene:

- organizzazioni accreditate, anche per provincia;
- volontari accreditati e volontari unici, per organizzazione, per giorno e per
  provincia;
- mezzi accreditati e mezzi unici, per giorno;
- interventi e servizi per data;
- gli elenchi dei volontari accreditati e dei visitatori;
- le segnalazioni di danneggiamenti e le attività registrate.

Le tabelle di conteggio hanno una riga con il totale.
