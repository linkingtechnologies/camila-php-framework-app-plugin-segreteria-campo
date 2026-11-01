# 8. Chiudere e rendicontare {#top}

Questo capitolo copre due momenti: la **partenza** di una squadra durante l'evento, e la *chiusura*
dell'evento con i report, i controlli e le copie dei dati.

## 8.1 Chiusura del turno di una squadra {#turno}

Quando una squadra finisce il turno e lascia il campo (non resta a pernottare), a ognuna delle sue
risorse (volontari, mezzi, materiali) va assegnato il servizio **USCITA DEFINITIVA**: così il programma
compila la data e l'ora di uscita e la data di fine attestato. Se la risorsa torna per un nuovo
turno, si registra di nuovo.

Prima di registrare la partenza, controlla:

- i *chilometri alla partenza* dei mezzi;
- che *mansione, data inizio attestato e data fine attestato* siano compilate correttamente;
- eventuali rotture o danni ai materiali ([Danneggiamenti](guide:manuale/06-tracciare#danneggiamenti));
- se richiesto, di stampare gli attestati.

## 8.2 Registrare la partenza: Check-out massivo {#check-out}

Il [Check-out massivo](guide:massive-check-out) fa tutto in una volta per un'organizzazione: scegli
l'organizzazione e le risorse che partono, conferma, e il programma imposta il servizio **USCITA
DEFINITIVA**, la data di fine attestato e la data e ora di uscita, e registra il movimento. Va usato
anche per le risorse che vanno via senza il resto della squadra.

## 8.3 Attestati e modulo A {#attestati}

Gli attestati si producono alla partenza, dal riquadro **Accreditamento risorse**:
[Attestati volontari](guide:dashboards/27) e [Attestati mezzi](guide:dashboards/28). Compaiono solo le
risorse già in USCITA DEFINITIVA. L'aspetto (logo, testi) dipende dal modello scelto in
[Informazioni intervento](guide:dashboards/05).

Il *modulo A* per i mezzi si stampa applicando il modello alla scheda dei mezzi: in alcuni casi
vale come attestato del mezzo per la richiesta di rimborsi (art. 9, quando concesso). Verifica prima
che le informazioni del mezzo e i chilometri registrati siano corretti.

## 8.4 Report {#report}

I [Report](guide:dashboards/m1) riepilogano l'evento in tabelle e grafici. **Report situazione
attuale** fotografa il momento; **Report situazione complessiva** è il consuntivo. Si scaricano in
PDF o in Word dalla stessa pagina. Il [Riepilogo ospiti e risorse](guide:dashboards/01) aggiunge i
contatori su volontari e ospiti.

## 8.5 Controllo dati {#controllo}

Il [Controllo dati](guide:dashboards/ic1) (tab **VERIFICA DATI**) cerca errori e incongruenze:
codici fiscali mancanti, targhe doppie, uscite registrate a metà. Conviene lanciarlo prima di
stampare gli attestati e prima di chiudere l'evento, e ogni tanto durante.

## 8.6 Backup {#backup}

Si fa *almeno una volta al giorno*, e a ogni cambio turno. In *Configurazione*:

- [Backup schede dati](guide:dashboards/30): un file per scheda;
- [Backup applicazione](guide:dashboards/31): un archivio unico con i dati e le configurazioni.

I file contengono dati personali: conservali dove possono vederli solo le persone autorizzate.

## 8.7 Chiusura dell'evento {#chiusura}

A fine evento, nell'ordine:

1. registra le ultime partenze con il [Check-out massivo](guide:manuale/08-chiudere#check-out);
2. lancia il [Controllo dati](guide:manuale/08-chiudere#controllo) e correggi;
3. stampa attestati e report;
4. fai un [backup](guide:manuale/08-chiudere#backup) completo e conservalo;
5. solo dopo, se serve riportare il programma alla versione iniziale per un nuovo evento, un
   amministratore elimina i dati dalle schede ([Amministrazione](guide:manuale/B-amministrazione#azzerare)).

*L'eliminazione dei dati non si annulla.*
