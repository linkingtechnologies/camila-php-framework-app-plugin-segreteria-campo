# Informazioni intervento {#top}

Qui si impostano i dati dell'evento che il programma ripete nelle stampe e nei moduli:
il nome dell'intervento, il comune, il nome del campo, il logo, i modelli PDF da usare.
Si apre da *Configurazione → Informazioni intervento*; la pagina si chiama **Dati
intervento**. È una pagina da compilare *una volta, prima dell'evento*: cambiare un
valore cambia tutte le stampe che lo usano, da quel momento in poi.

## Come si usa {#come}

La pagina è un modulo con un campo per ogni parametro. Scrivi o correggi i valori e
premi **Aggiorna**: compare **I dati sono stati aggiornati correttamente!** Non c'è un
tasto per annullare: se ti sei sbagliato, correggi il campo e premi di nuovo
**Aggiorna**.

I campi dipendono dalla configurazione dell'installazione: la pagina mostra un campo
per ogni parametro presente. Nell'installazione base sono questi:

| Parametro | A cosa serve |
|---|---|
| *evento* | nome dell'intervento, in testa ai report in PDF e Word |
| *comune* | comune dell'evento, nella stessa intestazione |
| *segreteriacampo* e *nomecampo* | la dicitura «Segreteria Campo» e il nome del campo, uniti nell'intestazione dei report |
| *logo* e *logo2* | i loghi: li scegli fra le immagini già caricate (vedi [Carica loghi](guide:dashboards/06)); *logo* va in testa ai report |
| *modelloattestatovolontari* e *modelloattestatomezzi* | il modello PDF degli attestati ([volontari](guide:dashboards/27), [mezzi](guide:dashboards/28)) |
| *modelloaccreditamentovolontari* e *modelloaccreditamentomezzi* | il modello dei moduli di accreditamento |
| *modellouscitavolontaripermissione* | il modello del modulo di uscita per missione dei volontari |
| *prefissocodiceabarre* | il prefisso che apre il codice del badge proposto per le nuove registrazioni |

I campi dei modelli vogliono il *nome di un modello esistente*, senza l'estensione
`.xml` (per esempio «volontari_Attestati (logo 1)»). Un nome sbagliato non dà errore
qui: il guaio si vede quando provi a stampare.

Se l'installazione usa il GeoTracker o le mappe di Google compaiono anche *Host
geotracker*, *URL geotracker* e *Chiave mappa google*: i dati per collegare quei
servizi.

## Prima di toccare qualcosa {#cautela}

- Salva in un punto sicuro i valori attuali (una schermata basta) o fai prima un
  [backup dell'applicazione](guide:dashboards/31): le configurazioni sono incluse.
- Non cambiare i modelli a evento in corso se non serve: i documenti già stampati e
  quelli nuovi avrebbero un aspetto diverso.
