// app-massive-check-in.js

import { html, render } from "../../../../../camila/js/lit-html/lit-html.js";

/**
 * VERSIONE APP
 * - in prod: usa una versione di build (es. commit hash, timestamp)
 * - in dev: Date.now() evita SEMPRE cache
 */
const VERSION =
  window.APP_CONFIG?.version ||
  Date.now(); // fallback anti-cache totale

const root = document.getElementById("app");

/* ==========================
   Utils
========================== */

function showError(title, err) {
  render(
    html`
      <article class="message is-danger">
        <div class="message-header"><p>${title}</p></div>
        <div class="message-body">
          <pre style="white-space:pre-wrap">
${String(err && (err.stack || err.message || err))}
          </pre>
        </div>
      </article>
    `,
    root
  );
}

/* ==========================
   Sanity check
========================== */

if (typeof WorkTableClient !== "function") {
  showError(
    "WorkTableClient non definito",
    "Includi worktable-client.js prima di app-massive-check-in.js"
  );
  throw new Error("WorkTableClient non definito");
}

const client = WorkTableClient(window.APP_CONFIG || {});

/* ==========================
   State
========================== */

const state = {
  step: 1,
  org: { name: "", code: "" }
};

function goTo(step) {
  state.step = step;
  mount();
}

/* ==========================
   Dynamic loader (NO CACHE)
========================== */

async function loadStep(stepNumber) {
  return import(
    `./views/massive-check-in/step${stepNumber}.js?v=${VERSION}`
  );
}

/* ==========================
   Mount
========================== */

async function mount() {
  try {
    if (state.step === 1) {
      const { Step1 } = await loadStep(1);
      render(await Step1({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 2) {
      if (!state.org.name) {
        state.step = 1;
        const { Step1 } = await loadStep(1);
        render(await Step1({ state, client, goTo, html, render, root }), root);
        return;
      }

      const { Step2 } = await loadStep(2);
      render(await Step2({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 3) {
      const { Step3 } = await loadStep(3);
      render(await Step3({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 4) {
      const { Step4 } = await loadStep(4);
      render(await Step4({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 5) {
      const { Step5 } = await loadStep(5);
      render(await Step5({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 6) {
      const { Step6 } = await loadStep(6);
      render(await Step6({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 7) {
      const { Step7 } = await loadStep(7);
      render(await Step7({ state, client, goTo, html, render, root }), root);
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

/* ==========================
   Boot
========================== */

render(
  html`<div class="notification is-warning">App avviata ✅</div>`,
  root
);

mount();
