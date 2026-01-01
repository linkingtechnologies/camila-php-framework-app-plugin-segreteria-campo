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
        <div class="message-header">
          <p>${title}</p>
        </div>
        <div class="message-body">
          <pre style="white-space: pre-wrap">
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
    "Includi worktable-client.js prima di avviare l'App!"
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
    `./views/smart-assistant/home.js?v=${VERSION}`
  );
}

/* ==========================
   Mount
========================== */

async function mount() {
  try {
    const { Home } = await loadStep(state.step);
    render(
      await Home({ state, client, goTo, html, render, root }),
      root
    );
  } catch (e) {
    showError("Errore render wizard", e);
  }
}

/* ==========================
   Boot
========================== */

mount();
