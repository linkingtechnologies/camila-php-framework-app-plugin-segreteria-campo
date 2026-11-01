# Backup applicazione {#top}

Una copia unica dei dati e delle configurazioni dell'applicazione, in un solo file. Si
apre da *Configurazione → Backup applicazione*.

## I due pulsanti {#pulsanti}

- **BACKUP DATABASE E CONFIGURAZIONI** produce un archivio `.zip` chiamato
  `backup_<prefisso>_<data>_<ora>.zip`. Dentro trovi un file `.csv` per ogni
  tabella dell'applicazione e la cartella `templates/` con i parametri dell'evento
  (quelli di [Informazioni intervento](guide:dashboards/05)) e le immagini dei
  loghi. Funziona con i database MySQL e SQLite.
- **BACKUP INTERO DATABASE (solo db sqlite3)** compare soltanto se l'applicazione usa
  un database SQLite: scarica il file `camila.db` così com'è.

Se il database è un altro, il secondo pulsante non c'è: è normale.

## Cosa non contiene {#limiti}

L'archivio contiene i dati e i parametri dell'evento, ma non il programma. Il
[Backup schede dati](guide:dashboards/30) è invece un file per scheda.

## Quando farlo {#quando}

Prima di cambiare le configurazioni, prima di un aggiornamento del programma, a fine
giornata durante l'evento e a fine evento. I dati personali sono dentro l'archivio: conservalo in un posto sicuro.

Come si ripristina un backup non è descritto qui. [DA VERIFICARE]
