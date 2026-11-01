# 1. Che cos'è Segreteria Campo {#top}

## 1.1 ProtezioNET e il suo ecosistema {#ecosistema}

Segreteria Campo è il nucleo di *ProtezioNET*, un progetto nato nel 2005 per standardizzare
e modernizzare le procedure dei volontari di protezione civile che svolgono la funzione di
segreteria, unendo la modulistica tradizionale e le tecnologie informatiche. Nasce da esigenze
reali degli interventi e delle esercitazioni, è cresciuto sul campo ed è distribuito come
software libero (open source) dal 2019.

Attorno al programma ci sono altri moduli, che condividono lo stesso patrimonio di dati
([Moduli e integrazioni](guide:manuale/C-moduli)):

- il portale per i **preaccreditamenti**, che parte dai database di volontari, mezzi e
  attrezzature;
- un'area riservata alle **organizzazioni** per condividere informazioni, preaccreditamenti e
  censimenti;
- il *geotracking*, per localizzare le squadre sul territorio con un'app sullo smartphone
  (modulo sperimentale);
- l'integrazione con la *radio*, per ricevere i messaggi in tempo reale;
- il *self-service su totem*, per le operazioni di arrivo e partenza fatte in autonomia
  (in sperimentazione).

## 1.2 Da fogli isolati a un sistema condiviso {#oltre-excel}

Il programma risponde a un limite pratico: tanti file Excel separati, con versioni che non si
allineano. Segreteria Campo permette di:

- condividere gli stessi dati fra più operatori di segreteria;
- riunire in un unico posto informazioni diverse (un *modello dati*) e collegarle alle
  procedure operative;
- rendere attività e decisioni tracciabili, con un solo sistema di riferimento.

Resta facile da usare: chi conosce un foglio di calcolo ritrova nelle schede dati lo stesso modo
di lavorare ([Le schede dati](guide:manuale/A-schede-dati)).

## 1.3 Il ciclo dell'evento {#ciclo}

La guida segue cinque fasi, nell'ordine in cui capitano:

| Fase | Cosa si fa | Capitolo |
|---|---|---|
| Preparare | configurare evento, servizi, magazzini e risorse attese | [3](guide:manuale/03-preparare) |
| Accreditare | registrare persone, mezzi e materiali che arrivano | [4](guide:manuale/04-accreditare) |
| Gestire | assegnare i servizi e movimentare le risorse | [5](guide:manuale/05-gestire) |
| Tracciare | conservare storico, richieste e comunicazioni | [6](guide:manuale/06-tracciare) |
| Rendicontare | produrre report, attestati ed esportazioni | [8](guide:manuale/08-chiudere) |

Se si ospitano civili si aggiunge il [campo di accoglienza](guide:manuale/07-accoglienza).

Le fasi non sono rigide: l'accreditamento prosegue per tutto l'evento, a ondate, mentre si
gestisce l'operatività. Per questo la pagina iniziale del programma è ordinata per *frequenza
d'uso* (prima ciò che si fa ogni giorno) e non per fase ([La pagina
iniziale](guide:manuale/02-primi-passi#home)).

## 1.4 Risorse registrate e squadre dichiarate {#squadre}

Il sistema conosce le risorse a due livelli di dettaglio, e rispondono alla stessa domanda: chi
c'è su un servizio.

| | Che cosa sono | Dove si gestiscono |
|---|---|---|
| **Risorse registrate** | i nominativi: una riga per volontario, mezzo o materiale | [Check-in massivo](guide:massive-check-in) e le schede dati |
| **Squadre dichiarate** | solo i conteggi, dichiarati dall'organizzazione | [Squadre dichiarate](guide:team-manager) |

Le squadre dichiarate servono quando i nominativi non ci sono: emergenze lampo senza campo di
ammassamento, squadre che operano da remoto, elenchi che arriveranno giorni dopo, o mai. Non
sono un ripiego: dove non c'è un campo sono l'unica registrazione che esisterà. Non passano dal
check-in e dal check-out.

Una squadra dichiarata e le sue risorse registrate si possono affiancare perché le risorse
portano il *nome* della squadra: dopo un check-in, il nome è la continuità fra le due fasi.
*Se le stesse persone sono contate sia come squadra sia come volontari singoli, ogni riepilogo le
conta due volte: decide l'organizzazione di quale delle due risoluzioni usare.*

## 1.5 Tre modi di lavorare {#scenari}

| Scenario | Come si lavora |
|---|---|
| *Evento con campo* | flusso completo: preparazione, check-in all'arrivo, movimentazione sui servizi, check-out alla partenza |
| *Intervento «lampo» senza campo* | niente check-in: si dichiarano le [squadre](guide:team-manager), si seguono gli [interventi](guide:intervention-manager) e le [richieste](guide:requests-board), si guarda sulle [mappe](guide:map-center) |
| *Evento con totem* | l'arrivo e la partenza le registrano gli stessi volontari in autonomia, su una postazione dedicata ([Registrazione in autonomia](guide:manuale/04-accreditare#totem)) |

Gli scenari si possono combinare. In ogni caso, se si ospitano civili, vale anche il
[capitolo sull'accoglienza](guide:manuale/07-accoglienza).

## 1.6 Cosa serve per usarlo {#requisiti}

Il programma è un'applicazione web: serve un browser (Microsoft Edge, Google Chrome, Mozilla
Firefox). Si usa su un solo computer o su una rete locale, *senza bisogno di Internet*, e più
operatori possono lavorare insieme dopo l'accesso con il proprio utente. Alcune funzioni, come le
carte geografiche delle [Mappe](guide:map-center), richiedono invece la connessione.

I dati sono organizzati in *schede* ([Le schede dati](guide:manuale/A-schede-dati)); le pagine del
programma sono pensate per non doverle toccare nell'uso di ogni giorno.
