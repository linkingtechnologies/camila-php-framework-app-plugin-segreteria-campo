// app-massive-check-out.js
import { html, render } from "../../../../../camila/js/lit-html/lit-html.js";

const VERSION = window.APP_CONFIG?.version || Date.now();
const root = document.getElementById("app");

function showError(title, err) {
  const msg = String(err?.payload || err?.message || err || "Errore sconosciuto");
  render(
    html`
      <section class="section">
        <div class="container">
          <article class="message is-danger">
            <div class="message-header">
              <p>${title}</p>
            </div>
            <div class="message-body">
              <pre style="white-space:pre-wrap; word-break:break-word; margin:0;">${msg}</pre>
            </div>
          </article>
        </div>
      </section>
    `,
    root
  );
}

if (typeof WorkTableClient !== "function") {
  showError("Errore inizializzazione", "WorkTableClient non disponibile");
  throw Error("WorkTableClient non disponibile");
}

const client = WorkTableClient(window.APP_CONFIG || {});

const state = {
  step: 1,

  // Selected organization from step1
  org: null, // { name, code, province }

  // Step2 volunteer selection
  step2SelectedCFs: [],

  // Step3 mezzi selection (by id)
  step3SelectedMezziIds: []
};

function goTo(step) {
  state.step = step;
  mount();
}

async function loadStep(n) {
  return import(`./views/massive-check-out/step${n}.js?v=${VERSION}`);
}

async function mount() {
  try {
    if (state.step === 1) {
      const { Step1 } = await loadStep(1);
      render(await Step1({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 2) {
      // Guard: must have org
      if (!state.org || !state.org.name) {
        state.step = 1;
        return mount();
      }

      const { Step2 } = await loadStep(2);
      render(await Step2({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 3) {
      // Guard: must have org
      if (!state.org || !state.org.name) {
        state.step = 1;
        return mount();
      }

      const { Step3 } = await loadStep(3);
      render(await Step3({ state, client, goTo, html, render, root }), root);
      return;
    }

    // Fallback
    state.step = 1;
    const { Step1 } = await loadStep(1);
    render(await Step1({ state, client, goTo, html, render, root }), root);
  } catch (e) {
    showError("Errore render wizard", e);
  }
}

// BOOT
render(html`<div class="notification is-warning">App avviata ✅</div>`, root);
mount();
