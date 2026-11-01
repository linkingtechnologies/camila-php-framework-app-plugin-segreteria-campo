# B. Amministrazione {#top}

*Argomento avanzato, per chi amministra il sistema.* Gli utenti normali non ne hanno bisogno.

## B.1 L'utente amministratore {#admin}

L'utente amministratore (nell'installazione base `admin1`) ha in più queste funzioni:

- importare elenchi da file Excel, per esempio banche dati preesistenti;
- modificare la struttura delle schede dati, per esempio creando campi nuovi;
- aggiornare dati che gli operatori non possono modificare, come la data e ora di uscita definitiva;
- eliminare tutti i dati dalle schede, riportando il programma alla versione iniziale al termine
  dell'evento.

Normalmente è sconsigliato usarlo se non per queste operazioni. *Cambia la password predefinita
subito* ([Accedere](guide:manuale/02-primi-passi#accesso)).

## B.2 Importare da Excel {#importare}

L'importazione carica in una scheda dati il contenuto di un file Excel (*IMPORTA DATI* nella scheda).
La prima riga del file deve contenere le intestazioni, uguali ai nomi dei campi della scheda.

Il modo più sicuro per avere un file corretto è *esportare prima la scheda* in Excel, compilare il
file ottenuto e reimportarlo. Si usa per:

- i **preaccreditamenti**: le schede Volontari, Mezzi e Materiali preaccreditati ([Preparare
  l'evento](guide:manuale/03-preparare#preaccreditamenti));
- il *database delle risorse*: Organizzazioni, Volontari, Mezzi, Materiali, anche non
  preaccreditati ([Le anagrafiche](guide:manuale/03-preparare#anagrafiche)).

I dati e i servizi di esempio si caricano con **Importa dati esempio** nel tab **AIUTO**.

## B.3 Cambiare la struttura delle schede {#struttura}

Le schede si possono modificare «a caldo» dall'interfaccia: aggiungere un campo, cambiarne l'ordine
o l'elenco dei valori ammessi. Le pagine del programma leggono le definizioni dalle schede, quindi
un campo aggiunto o un elenco cambiato compare nelle pagine senza altri interventi: per esempio gli
elenchi di categoria e tipologia dei mezzi, o lo stato delle richieste.

Il **Worktable Explorer** (pulsante in *Configurazione*, ma è del plugin *Worktable*) permette di
guardare e correggere righe di qualunque tabella, senza controlli di coerenza.

## B.4 I modelli di stampa {#modelli}

I modelli PDF (badge, attestati, moduli di accreditamento, avvisi…) sono file nella cartella dei
modelli dell'applicazione. Quale modello usare per attestati e moduli di accreditamento si sceglie in
[Informazioni intervento](guide:dashboards/05): i campi *modelloattestatovolontari*,
*modelloattestatomezzi*, *modelloaccreditamentovolontari* e simili contengono il nome del modello,
senza l'estensione `.xml`. I loghi si caricano da [Carica loghi](guide:dashboards/06).

## B.5 Personalizzare report e controlli {#personalizzare}

- I [Report](guide:dashboards/m1) sono file XML nella cartella `reports/it/` del plugin: ogni file è
  un report (il nome dopo il trattino basso è il titolo che compare), con le interrogazioni e i
  grafici.
- Il [Controllo dati](guide:dashboards/ic1) legge l'elenco dei controlli da `conf/integrity.xml`.

Sono configurazioni, non programmi: chi li modifica deve conoscere la struttura delle schede.

## B.6 Strumenti di servizio {#strumenti}

- [Info Server](guide:dashboards/00): indirizzi e stato del computer che ospita il programma;
- [Backup schede dati](guide:dashboards/30) e [Backup applicazione](guide:dashboards/31);
- [Controllo dati](guide:dashboards/ic1).

## B.7 Azzerare i dati a fine evento {#azzerare}

Al termine dell'evento, e solo dopo aver fatto un [backup completo](guide:manuale/08-chiudere#backup),
l'amministratore può eliminare i dati dalle schede e riportare il programma alla versione iniziale.
*Non si può annullare.* La procedura esatta non è descritta qui. [DA VERIFICARE]
