// app-resource-manager.js

import { html, render } from "../../../../../camila/js/lit-html/lit-html.js";

const VERSION =
  window.APP_CONFIG?.version ||
  Date.now();

const root = document.getElementById("app");

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

if (typeof WorkTableClient !== "function") {
  showError(
    "WorkTableClient non definito",
    "Includi worktable-client.js prima di app-resource-manager.js"
  );
  throw new Error("WorkTableClient non definito");
}

const client = WorkTableClient(window.APP_CONFIG || {});

const state = {
  step: 1
};

function goTo(step) {
  state.step = step;
  mount();
}

async function loadStep(stepNumber) {
  return import(
    `./views/resource-manager/step${stepNumber}.js?v=${VERSION}`
  );
}

async function mount() {
  try {
    if (state.step === 1) {
      const { Step1 } = await loadStep(1);
      render(await Step1({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 2) {
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

render(html`
  <style>.rm-spin{animation:rm-spin 1s linear infinite}@keyframes rm-spin{to{transform:rotate(360deg)}}</style>
  <div style="display:flex;align-items:center;justify-content:center;gap:.75rem;margin-top:2rem">
    <span class="icon rm-spin"><i class="ri-loader-4-line ri-lg"></i></span>
    <span class="has-text-grey">Caricamento…</span>
  </div>
`, root);

mount();
