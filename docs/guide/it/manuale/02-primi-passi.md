# 2. Primi passi {#top}

## 2.1 Avviare il programma {#avvio}

Il programma non si installa: basta scompattare. Dal sito https://www.protezionet.it si scarica
l'ultima versione, un file `.zip`.

1. Scompatta il file in una cartella a piacere: servono circa 140 MB di spazio libero.
2. Nella cartella, fai doppio clic su `avvia_server.bat`.
3. Si apre il browser predefinito sulla pagina di accesso.
4. *Prendi nota dell'indirizzo* nella barra degli indirizzi: ti servirà se chiudi per sbaglio
   il browser e per collegare altre postazioni della stessa rete.

Il programma è un server che gira sul computer in cui l'hai avviato: chiudere il browser non lo
ferma. Per riaprire il programma scrivi di nuovo l'indirizzo nel browser (rilanciare
`avvia_server.bat` è sconsigliato). Per fermarlo, avvia `ferma_server.bat` nella stessa cartella.

### Collegare altre postazioni {#rete}

Altri computer, tablet o telefoni sulla stessa rete aprono lo stesso indirizzo nel loro browser. La
pagina [Info Server](guide:dashboards/00) (*Configurazione*) mostra gli indirizzi con cui il
computer si raggiunge dalla rete.

## 2.2 Accedere {#accesso}

Per entrare servono sempre un nome utente e una password: il programma può essere usato da più
utenti contemporaneamente. Ci sono due tipi di utente:

- *normale* (predefinito): per l'uso di ogni giorno;
- *amministratore*: per le operazioni particolari ([Amministrazione](guide:manuale/B-amministrazione)).

Nell'installazione di base gli utenti preconfigurati sono `oper1` (password `oper1`) e `admin1`
(password `admin1`, amministratore).

Regole d'uso:

- l'amministratore si usa solo quando serve, non per il lavoro di tutti i giorni;
- ogni utente, al primo accesso, cambia la propria password da *Preferenze* (in alto a destra) e
  poi *CAMBIA PASSWORD DI ACCESSO*;
- a fine sessione si esce con *Esci*, sempre in alto a destra;
- *un utente alla volta per postazione.* Se lo stesso utente entra da un altro browser o
  dispositivo, l'ultimo accesso toglie il posto agli altri, che vedranno il messaggio di sessione
  non valida ([Problemi frequenti](guide:manuale/G-problemi#sessione)). Meglio un utente per
  postazione.

## 2.3 La pagina iniziale {#home}

Dopo l'accesso si arriva alla pagina iniziale, nel tab **GESTIONE EVENTO**. È divisa in quattro
riquadri, *ordinati per frequenza d'uso*: in evento si sta quasi sempre nell'operatività,
mentre arrivi e partenze vengono a ondate.

| Riquadro | Risponde a | Pagine |
|---|---|---|
| **Operatività** | cosa si fa ogni giorno | [Richieste](guide:requests-board), [Movimentazione risorse](guide:resource-board), [Gestione interventi](guide:intervention-manager), [Movimentazione consumabili](guide:stock-manager) |
| **Monitoraggio** | come sta andando | [Report](guide:dashboards/m1) (**Report situazione attuale** e **Report situazione complessiva**), [Comunicazioni live](guide:comms-feed), [Mappe](guide:map-center) |
| **Accreditamento risorse** | chi entra e chi esce | [Check-in massivo](guide:massive-check-in), [Riepilogo preaccreditamenti](guide:pre-accreditations-summary), [Stato registrazione](guide:org-status), [Check-out massivo](guide:massive-check-out), gli attestati ([volontari](guide:dashboards/27), [mezzi](guide:dashboards/28)) |
| **Anagrafiche** | dati di riferimento | [Squadre dichiarate](guide:team-manager), i database di [volontari, mezzi e materiali](guide:resource-manager), [Servizi](guide:service-manager), [Magazzini](guide:warehouse-manager) |

In cima alla pagina iniziale può comparire l'**Assistente intelligente**, un riquadro che segnala
quando manca qualcosa di essenziale (nessun servizio, evento non configurato, brogliaccio fermo) e
propone il passo da fare ([L'assistente intelligente](guide:smart-assistant)).

### Gli altri tab {#tab}

Sotto il nome dell'applicazione ci sono i tab:

- **PREACCREDITAMENTI**: l'[ingresso](guide:dashboards/pre-accreditations) con il riepilogo e le
  tabelle per turno;
- **VERIFICA DATI**: il [Controllo dati](guide:dashboards/ic1);
- **CONFIGURAZIONE**: [Informazioni intervento](guide:dashboards/05), [Carica
  loghi](guide:dashboards/06), il **Worktable Explorer** (uno strumento tecnico, che sta nel plugin
  *Worktable*), [Info Server](guide:dashboards/00) e i due backup ([schede](guide:dashboards/30),
  [applicazione](guide:dashboards/31));
- **AIUTO**: il pulsante **Manuale**, **Importa dati esempio** e la versione del programma.

### La modalità totem {#totem}

Un utente il cui nome inizia per `totem` vede una pagina iniziale diversa, con i soli pulsanti
**Check-in**, **Stato registrazione** e **Check-out** (ne parla [Registrazione in
autonomia](guide:manuale/04-accreditare#totem)). In questa modalità non compaiono il menu dei tab
né i pulsanti **?**.

## 2.4 Leggere le guide {#leggere}

- Il **?** grigio accanto a un pulsante della pagina iniziale apre la guida di quella pagina.
- Dentro una pagina, il **?** in basso a destra apre il pannello della guida; nelle procedure a
  passi si apre sul passo in cui ti trovi.
- **Manuale completo** (nel pannello) apre tutta la guida in una pagina stampabile.
- Per sapere se manca qualcosa di essenziale prima di cominciare guarda in cima alla pagina
  iniziale: l'[assistente intelligente](guide:smart-assistant) lo segnala.

## 2.5 Preferenze e aspetto {#preferenze}

In alto a destra compare il nome dell'operatore al lavoro (per esempio OPER 1). *Preferenze*
permette di cambiare la password e il tipo e la dimensione dei caratteri usati nel programma. Le
tabelle di alcune pagine (per esempio il [Database risorse](guide:resource-manager)) hanno inoltre
la propria dimensione del carattere, ricordata da quel browser.
