function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

function nowDbFormat() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const BROGLIACCIO_ALERT_HOURS = 2;
const COMUNE_DEFAULT_VALUE = "Ornate";
const LS_KEY = "smart-assistant-collapsed";

export async function Home({ client, html, render, root }) {
  let loading = true;
  let hasServizi = false;
  let brogliaccioAlert = false;   // true se nessun record nelle ultime 2 ore
  let brogliaccioLastTs = null;   // timestamp ultimo record (Date) o null se tabella vuota
  let comuneUnconfigured = false; // true se template comune ha ancora il valore default
  let error = null;
  let collapsed = localStorage.getItem(LS_KEY) === "1";

  // popup brogliaccio
  let showModal  = false;
  let msgText    = "";
  let msgBusy    = false;
  let msgError   = null;
  let msgSuccess = false;

  async function load() {
    loading = true;
    error = null;
    rerender();

    try {
      const [resServizi, resBrogliaccio, resComune] = await Promise.all([
        client.table("servizi").list({ size: 1 }),
        client.table("brogliaccio").list({ include: ["data/ora"], size: 1, order: [["data/ora", "desc"]] }),
        client.call("GET", "/templates/comune").catch(() => null),
      ]);

      hasServizi = getRecords(resServizi).length > 0;

      const rows = getRecords(resBrogliaccio);
      const lastVal = rows.length > 0 ? rows[0]["data/ora"] : null;
      if (lastVal) {
        brogliaccioLastTs = new Date(lastVal.replace(" ", "T"));
        const diffMs = Date.now() - brogliaccioLastTs.getTime();
        brogliaccioAlert = diffMs > BROGLIACCIO_ALERT_HOURS * 60 * 60 * 1000;
      } else {
        brogliaccioLastTs = null;
        brogliaccioAlert = false;  // brogliaccio vuoto: nessun alert
      }

      comuneUnconfigured = resComune?.value === COMUNE_DEFAULT_VALUE;
    } catch (e) {
      error = e;
    } finally {
      loading = false;
      rerender();
    }
  }

  function openModal() {
    msgText = ""; msgError = null; msgSuccess = false; msgBusy = false;
    showModal = true;
    rerender();
  }

  function closeModal() {
    showModal = false;
    rerender();
  }

  async function submitMsg() {
    if (!msgText.trim()) { msgError = "Il messaggio non può essere vuoto."; rerender(); return; }
    msgBusy = true; msgError = null; rerender();
    try {
      await client.table("brogliaccio").create({ "data/ora": nowDbFormat(), descrizione: msgText.trim() });
      msgSuccess = true;
      msgBusy = false;
      rerender();
      // aggiorna stato alert dopo salvataggio
      brogliaccioLastTs = new Date();
      brogliaccioAlert = false;
      // chiude il modal dopo 1 secondo
      setTimeout(() => { showModal = false; rerender(); }, 1000);
    } catch (e) {
      msgError = String(e?.payload || e?.message || e || "Errore durante il salvataggio.");
      msgBusy = false;
      rerender();
    }
  }

  function toggle() {
    collapsed = !collapsed;
    localStorage.setItem(LS_KEY, collapsed ? "1" : "0");
    rerender();
  }

  function view() {
    return html`
      <div>

        <!-- Header collassabile -->
        ${(() => {
          const count = !loading ? [brogliaccioAlert, comuneUnconfigured, !error && !hasServizi].filter(Boolean).length : 0;
          if (!loading && count === 0) return "";
          return html`
            <div
              style="display:flex;align-items:center;gap:.5rem;cursor:pointer;user-select:none;padding:.25rem 0 .75rem"
              @click=${toggle}
            >
              <span class="icon has-text-grey-light" style="transition:transform .2s;transform:rotate(${collapsed ? "-90deg" : "0deg"})">
                <i class="ri-arrow-down-s-line"></i>
              </span>
              <span class="is-size-7 has-text-grey">Assistente intelligente</span>
              ${count > 0 ? html`<span class="tag is-primary is-rounded" style="font-size:.65rem;height:1.2rem;padding:0 .45rem">${count}</span>` : ""}
            </div>
          `;
        })()}

        ${!collapsed ? html`

          ${error ? html`
            <div class="notification is-danger is-light is-small">
              <i class="ri-error-warning-line mr-1"></i>
              Errore nel controllo della tabella <code>servizi</code>
            </div>
          ` : ""}

          ${!loading && brogliaccioAlert ? html`
            <div class="card mb-4">
              <div class="card-content py-4">
                <div class="media is-align-items-center">
                  <div class="media-left">
                    <span class="icon has-text-primary">
                      <i class="ri-magic-line ri-lg"></i>
                    </span>
                  </div>
                  <div class="media-content">
                    <p class="is-size-6 mb-1">
                      <strong>Nessuna voce nel brogliaccio nelle ultime ${BROGLIACCIO_ALERT_HOURS} ore.</strong>
                    </p>
                    <p class="is-size-7 has-text-grey">
                      ${brogliaccioLastTs
                        ? `Ultima registrazione: ${brogliaccioLastTs.toLocaleString("it-IT")}`
                        : "Il brogliaccio è vuoto."}
                    </p>
                  </div>
                  <div class="media-right">
                    <button class="button is-primary is-light is-small" @click=${e => { e.stopPropagation(); openModal(); }}>
                      <span class="icon"><i class="ri-edit-line"></i></span>
                      <span>Inserisci messaggio</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ` : ""}

          ${!loading && comuneUnconfigured ? html`
            <div class="card mb-4">
              <div class="card-content py-4">
                <div class="media is-align-items-center">
                  <div class="media-left">
                    <span class="icon has-text-primary">
                      <i class="ri-magic-line ri-lg"></i>
                    </span>
                  </div>
                  <div class="media-content">
                    <p class="is-size-6 mb-1">
                      <strong>Evento non configurato.</strong>
                    </p>
                    <p class="is-size-7 has-text-grey">
                      Il nome del comune è ancora impostato al valore predefinito ("${COMUNE_DEFAULT_VALUE}"). Configura l'evento prima di utilizzare le altre funzioni.
                    </p>
                  </div>
                  <div class="media-right">
                    <a href="./index.php?dashboard=m2" class="button is-primary is-light is-small">
                      <span class="icon"><i class="ri-calendar-line"></i></span>
                      <span>Configura evento</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ` : ""}

          ${!loading && !error && !hasServizi ? html`
            <div class="card mb-4">
              <div class="card-content py-4">
                <div class="media is-align-items-center">
                  <div class="media-left">
                    <span class="icon has-text-primary">
                      <i class="ri-magic-line ri-lg"></i>
                    </span>
                  </div>
                  <div class="media-content">
                    <p class="is-size-6 mb-1">
                      <strong>Nessun servizio trovato</strong>
                    </p>
                    <p class="is-size-7 has-text-grey">
                      Importa un file con i servizi di esempio per iniziare più velocemente
                    </p>
                  </div>
                  <div class="media-right" style="display:flex;gap:.5rem">
                    <a href="./index.php?dashboard=iw" class="button is-primary is-small">
                      <span class="icon"><i class="ri-upload-2-line"></i></span>
                      <span>Importa servizi di esempio</span>
                    </a>
                    <a href="./index.php?dashboard=service-manager" class="button is-primary is-light is-small">
                      <span class="icon"><i class="ri-pushpin-line"></i></span>
                      <span>Gestione servizi</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ` : ""}

        ` : ""}

        <!-- MODAL inserisci messaggio brogliaccio -->
        ${showModal ? html`
          <div class="modal is-active">
            <div class="modal-background" @click=${closeModal}></div>
            <div class="modal-card" style="max-width:480px;width:90%">
              <header class="modal-card-head">
                <p class="modal-card-title" style="font-size:1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                  <span class="icon mr-2"><i class="ri-edit-line"></i></span>
                  Inserisci messaggio nel brogliaccio
                </p>
                <button class="delete" ?disabled=${msgBusy} @click=${closeModal}></button>
              </header>
              <section class="modal-card-body">
                ${msgSuccess ? html`
                  <div class="notification is-success is-light">
                    <i class="ri-check-line mr-1"></i> Messaggio salvato.
                  </div>
                ` : html`
                  ${msgError ? html`
                    <div class="notification is-danger is-light is-small mb-3">
                      <i class="ri-error-warning-line mr-1"></i> ${msgError}
                    </div>
                  ` : ""}
                  <div class="field">
                    <label class="label">Messaggio</label>
                    <div class="control">
                      <textarea class="textarea" rows="4"
                        placeholder="Scrivi qui il messaggio da registrare…"
                        ?disabled=${msgBusy}
                        .value=${msgText}
                        @input=${e => { msgText = e.target.value; }}
                        @keydown=${e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submitMsg(); }}
                      ></textarea>
                    </div>
                    <p class="help has-text-grey">La data/ora verrà impostata automaticamente. Ctrl+Invio per salvare.</p>
                  </div>
                `}
              </section>
              <footer class="modal-card-foot" style="justify-content:flex-end;gap:.5rem">
                <button class="button" ?disabled=${msgBusy} @click=${closeModal}>Annulla</button>
                <button class="button is-primary ${msgBusy ? 'is-loading' : ''}"
                  ?disabled=${msgBusy || msgSuccess} @click=${submitMsg}>
                  <span class="icon"><i class="ri-save-line"></i></span>
                  <span>Salva</span>
                </button>
              </footer>
            </div>
          </div>
        ` : ""}

      </div>
    `;
  }

  function rerender() {
    render(view(), root);
  }

  load();
  return view();
}
