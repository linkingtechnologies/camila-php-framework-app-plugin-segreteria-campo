# Info Server {#top}

Una pagina di sola lettura con lo stato del computer su cui gira il programma: serve a
chi gestisce il server, e a chi deve collegare un altro dispositivo. Si apre da
*Configurazione → Info Server*.

## Gli indirizzi {#indirizzi}

In cima ci sono uno, due o tre collegamenti: sono gli indirizzi con cui l'applicazione
si raggiunge dalla rete, per nome del computer e per indirizzo IP, con la porta. Per
collegare un tablet o un altro PC alla stessa rete, scrivi uno di questi indirizzi nel
suo browser.

Ne compaiono meno se alcuni coincidono o se il sistema non fornisce il nome del
computer.

## Le informazioni {#informazioni}

Sotto, un elenco di righe di testo:

- **Versione PHP** e **Limite memoria PHP (memory_limit)**: la versione del
  motore su cui gira il programma e la memoria che può usare uno script;
- **Memoria usata dallo script** e **Memoria picco usata dallo script**: quanta ne
  ha usata questa stessa pagina;
- **Spazio libero su disco (root)** e **Spazio totale disco (root)**: il disco
  principale del server;
- **RAM totale server** e **RAM disponibile**, e **CPU load**: compaiono solo se il
  sistema li fornisce (su Windows dipende dagli strumenti installati), con «N/D»
  per ciò che manca;
- **Ambiente containerizzato**: **Sì** se il programma gira in un container (Docker e
  simili), altrimenti **No**.

Sono numeri istantanei: la pagina non si aggiorna da sola, ricaricala per vederli di nuovo.

## A cosa serve in evento {#evento}

Prima di aprire il campo, un'occhiata allo spazio libero sul disco; durante l'evento,
se il programma rallenta, RAM e CPU dicono se il server è sotto sforzo. Per salvare
i dati usa invece i [backup](guide:dashboards/31).
