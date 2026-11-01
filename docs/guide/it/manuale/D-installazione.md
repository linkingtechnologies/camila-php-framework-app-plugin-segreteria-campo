# D. Installazione e architettura {#top}

*Argomento avanzato, per chi installa e mantiene il programma.*

## D.1 Dove gira {#dove}

Lo stesso programma gira in più ambienti (secondo la presentazione del progetto):

| Ambiente | Pila tecnologica | Note |
|---|---|---|
| PC Windows | PHP + SQLite | ambiente locale: si scompatta e si avvia ([Avviare il programma](guide:manuale/02-primi-passi#avvio)) |
| PC Linux | PHP + SQLite | ambiente locale |
| Server web Linux | PHP + MySQL | ambiente server, per più utenti e uso prolungato |
| Container Docker | PHP + MySQL | ambiente server |

Si usa un browser per accedere (interfaccia web); i componenti web parlano con il programma
attraverso un'interfaccia di programma (API). Non serve Internet per l'uso in rete locale.

## D.2 Come è fatto {#architettura}

- **Framework**: *Camila WorkTable*, che fornisce schede dati, autenticazione, importazione ed
  esportazione, modelli di stampa e interfaccia di programma;
- **Plugin**: *Segreteria Campo*, che aggiunge le pagine, i modelli e le procedure di questo manuale;
- *Pagine*: scritte in JavaScript, rendono nel browser e usano solo l'interfaccia di programma per
  leggere e scrivere i dati;
- **Dati**: SQLite per l'uso locale, MySQL per i server.

## D.3 Avvio e arresto (versione per Windows) {#avvio}

Si scompatta l'archivio (circa 140 MB), si avvia `avvia_server.bat` e si ferma con
`ferma_server.bat`. Gli indirizzi per collegare altre postazioni sono in
[Info Server](guide:dashboards/00).

## D.4 Backup e aggiornamento {#backup}

I dati dell'evento si salvano con i [backup](guide:manuale/08-chiudere#backup). Per aggiornare il
programma si scarica l'ultima versione e si ripete l'installazione: prima di farlo, fai un
[Backup applicazione](guide:dashboards/31). *La procedura di aggiornamento senza perdere i dati non è
descritta qui.* [DA VERIFICARE]

## D.5 Risorse utili {#risorse}

- Sito del progetto e download dell'ultima versione: https://www.protezionet.it
- Manuale e procedure operative online (lo stesso contenuto del programma): https://help.protezionet.it
- Repository principale e repository collegati (codice sorgente):
  https://github.com/linkingtechnologies/protezionet-segreteria-campo
