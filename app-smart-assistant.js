// app-smart-assistant.js

import { html, render } from "../../../../../camila/js/lit-html/lit-html.js";
import "./no-pull-refresh.js";

const VERSION = window.APP_CONFIG?.version || Date.now();
const root = document.getElementById("app");

function showError(title, err) {
  const msg = String(err?.payload || err?.message || err || "Errore sconosciuto");
  render(
    html`
      <article class="message is-danger">
        <div class="message-header">
          <p>${title}</p>
        </div>
        <div class="message-body">
          <pre style="white-space: pre-wrap">
${msg}
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
    "Includi worktable-client.js prima di avviare l'App!"
  );
  throw new Error("WorkTableClient non definito");
}

const client = WorkTableClient(window.APP_CONFIG || {});

const state = {};

async function mount() {
  try {
    const { Home } = await import(`./views/smart-assistant/home.js?v=${VERSION}`);
    render(await Home({ state, client, html, render, root }), root);
  } catch (e) {
    showError("Errore render", e);
  }
}

mount();
