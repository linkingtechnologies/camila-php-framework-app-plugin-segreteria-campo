# Use Case — whoami

## Identificativo

UC-WHO — Conoscere l'utente Camila che sta usando la SPA, e il suo gruppo

---

## Contesto di sistema

Le SPA ricevono dalla pagina solo l'indirizzo dell'API (`APP_CONFIG`) e la REST API non espone la tabella degli utenti di Camila. Senza questo endpoint il browser non ha modo di sapere a quale gruppo appartiene chi lavora. Il gruppo (`users.grp`) e' il dato con cui Camila governa visibilita' e valori predefiniti; qui serve per usarlo come predefinito dei filtri e degli inserimenti quando coincide con il codice di un'organizzazione.

---

## Goal

Restituire, per l'utente della sessione, nome utente, gruppo, se e' amministratore, livello e tipo di visibilita'.

---

## Primary Actor

Una SPA del plugin (oggi `resource-manager`), per conto dell'operatore.

---

## Precondizioni

- Sessione Camila valida (l'endpoint e' privato).

---

## Postcondizioni — Successo

- La SPA conosce `group` e `isAdmin` e puo' decidere un predefinito. Nulla viene scritto.

## Postcondizioni — Errore

- Senza risposta (rete, sessione, framework senza l'endpoint) la SPA non applica nessun predefinito e funziona come prima.

---

## Main Success Scenario

1. La SPA chiama `GET /whoami` (endpoint del framework) la prima volta che serve il gruppo.
2. Il sistema risponde con i dati dell'utente della sessione.
3. La SPA ricorda la risposta per tutta la vita della pagina.

---

## Extensions

### 2a. Amministratore
- `isAdmin` e' vero: il gruppo e' vuoto o coincide con il gruppo amministratore. La SPA non applica predefiniti basati sul gruppo.

### 2b. Dati non disponibili
- I campi che il sistema non conosce tornano vuoti (`""`, `null`) e `isAdmin` e' falso: nel dubbio l'utente non e' amministratore, ma nemmeno ha un gruppo da usare.
