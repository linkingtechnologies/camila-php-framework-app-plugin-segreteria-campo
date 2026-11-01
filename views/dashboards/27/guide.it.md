# Attestati volontari {#top}

Produce gli attestati di partecipazione dei volontari che hanno concluso il servizio.
Si apre da *Accreditamento risorse*, con **Attestati volontari**, sotto il
[Check-out massivo](guide:massive-check-out): gli attestati sono l'ultimo atto dopo la
partenza.

Per gli attestati dei mezzi vedi [Attestati mezzi](guide:dashboards/28): la pagina è
la stessa, su un'altra tabella.

## Quali volontari compaiono {#chi}

La pagina considera solo i volontari con servizio **USCITA DEFINITIVA**, cioè quelli
per cui il check-out è stato fatto. Chi è ancora in servizio non compare finché non
parte.

Per ogni coppia provincia–organizzazione di quei volontari trovi un pulsante, con un
nome del tipo *Attestati volontari (USCITA DEFINITIVA) PROVINCIA ORGANIZZAZIONE*,
ordinati per provincia e organizzazione.

Se nessun volontario è ancora uscito vedi **Nessun dato disponibile!**

## Produrre gli attestati {#produrre}

1. Individua la riga dell'organizzazione (la provincia è nel nome del pulsante).
2. Premi il pulsante: il programma prepara un PDF con i volontari di quella
   organizzazione in USCITA DEFINITIVA, usando il modello degli attestati.
3. Il file si chiama come l'organizzazione e va stampato o inviato.

Un'organizzazione i cui volontari non sono tutti usciti avrà l'attestato solo per
quelli già usciti: ripeti l'operazione dopo l'ultima partenza se serve l'elenco
completo.

## Il modello {#modello}

L'aspetto dell'attestato (logo, testi, impaginazione) dipende dal modello
indicato dal parametro `modelloattestatovolontari`. Si cambia in *Configurazione →
Informazioni intervento* (la pagina **Dati intervento**): scrivi il nome del modello
nel campo con quel nome e premi **Aggiorna**. I loghi si caricano in *Configurazione
→ Carica loghi*.

Nell'installazione base i modelli per i volontari sono quattro: con il logo 1 o il
logo 2, con o senza la mansione. Il valore è il nome del modello, senza l'estensione
`.xml`.
