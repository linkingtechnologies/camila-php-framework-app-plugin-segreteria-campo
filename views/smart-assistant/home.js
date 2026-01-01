function getRecords(res) {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray(res.records)) return res.records;
  return [];
}

export async function Home({ client, html, render, root }) {
  let loading = true;
  let hasServizi = false;
  let error = null;

  async function load() {
    loading = true;
    error = null;
    rerender();

    try {
      // basta 1 record per sapere se la tabella contiene dati
      const res = await client
        .table("servizi")
        .list({ size: 1 });

      const rows = getRecords(res);
      hasServizi = rows.length > 0;
    } catch (e) {
      error = e;
    } finally {
      loading = false;
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

      </div>
    `;
  }

  function rerender() {
    render(view(), root);
  }

  load();
  return view();
}
