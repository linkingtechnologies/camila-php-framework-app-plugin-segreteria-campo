// app-org-status.js
import { html, render } from "../../../../../camila/js/lit-html/lit-html.js";

const VERSION = window.APP_CONFIG?.version || Date.now();
const root = document.getElementById("app");

function showError(title, err) {
  const msg = String(err?.payload || err?.message || err || "Errore sconosciuto");
  render(html`
    <section class="section">
      <div class="container">
        <article class="message is-danger">
          <div class="message-header">
            <p>${title}</p>
          </div>
          <div class="message-body">
            <p>${msg}</p>
            <details class="mt-3">
              <summary>Dettagli</summary>
              <pre style="white-space:pre-wrap;margin:0">${JSON.stringify(err, null, 2)}</pre>
            </details>
          </div>
        </article>
      </div>
    </section>
  `, root);
}

if (typeof WorkTableClient !== "function") {
  showError("Errore inizializzazione", "WorkTableClient non disponibile");
  throw new Error("WorkTableClient non disponibile");
}

const client = WorkTableClient(window.APP_CONFIG || {});

const state = {
  step: 1,
  org: null
};

function goTo(step) {
  state.step = step;
  mount();
}

async function loadStep(n) {
  return import(`./views/org-status/step${n}.js?v=${VERSION}`);
}

async function mount() {
  try {
    if (state.step === 1) {
      const { Step1 } = await loadStep(1);
      render(await Step1({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 2) {
      // guard: serve org selezionata
      if (!state.org || !state.org.name) {
        state.step = 1;
        mount();
        return;
      }

      const { Step2 } = await loadStep(2);
      render(await Step2({ state, client, goTo, html, render, root }), root);
      return;
    }

    // fallback
    state.step = 1;
    const { Step1 } = await loadStep(1);
    render(await Step1({ state, client, goTo, html, render, root }), root);
  } catch (e) {
    showError("Errore render wizard", e);
  }
}

render(html`<div class="notification is-warning">App avviata ✅</div>`, root);
mount();
