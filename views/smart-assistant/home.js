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

export async function Home({ client, html, render, root }) {
  let loading = true;
  let hasServizi = false;
  let brogliaccioAlert = false;   // true se nessun record nelle ultime 2 ore
  let brogliaccioLastTs = null;   // timestamp ultimo record (Date) o null se tabella vuota
  let error = null;

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
      const [resServizi, resBrogliaccio] = await Promise.all([
        client.table("servizi").list({ size: 1 }),
        client.table("brogliaccio").list({ include: ["data/ora"], size: 1, order: [["data/ora", "desc"]] }),
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
        brogliaccioAlert = true;
      }
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

  function view() {
    return html`
      <div>

        ${error
          ? html`
              <div class="notification is-danger is-light is-small">
                <i class="ri-error-warning-line mr-1"></i>
                Errore nel controllo della tabella <code>servizi</code>
              </div>
            `
          : ""}

        ${!loading && brogliaccioAlert ? html`
          <div class="notification is-warning" style="display:flex;align-items:center;gap:.75rem">
            <span class="icon is-medium" style="flex-shrink:0">
              <i class="ri-alarm-warning-line ri-lg"></i>
            </span>
            <div style="flex:1">
              <strong>Nessuna voce nel brogliaccio nelle ultime ${BROGLIACCIO_ALERT_HOURS} ore.</strong>
              ${brogliaccioLastTs
                ? html`<br><span class="is-size-7">Ultima registrazione: ${brogliaccioLastTs.toLocaleString("it-IT")}</span>`
                : html`<br><span class="is-size-7">Il brogliaccio è vuoto.</span>`
              }
            </div>
            <button class="button is-warning is-small" @click=${openModal}>
              <span class="icon"><i class="ri-edit-line"></i></span>
              <span>Inserisci messaggio</span>
            </button>
          </div>
        ` : html`
          <div class="is-flex is-justify-content-flex-end mb-4">
            <button class="button is-light is-small" @click=${openModal}>
              <span class="icon"><i class="ri-edit-line"></i></span>
              <span>Inserisci messaggio nel brogliaccio</span>
            </button>
          </div>
        `}

        ${!loading && !error && !hasServizi
          ? html`
              <div class="card">
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

                    <div class="media-right">
                      <a
                        href="./index.php?dashboard=iw"
                        class="button is-primary is-small"
                      >
                        <i class="ri-upload-2-line mr-1"></i>
                        Importa servizi di esempio
                      </a>
                    </div>

                  </div>
                </div>
              </div>
            `
          : ""}

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
