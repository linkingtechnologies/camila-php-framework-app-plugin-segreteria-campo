// app-map-center.js — Centro Mappe
import { html, render } from "../../../../../camila/js/lit-html/lit-html.js";
import "./no-pull-refresh.js";

const VERSION = window.APP_CONFIG?.version || Date.now();
const root = document.getElementById("app");

function showError(title, err) {
  const msg = String(err?.payload || err?.message || err || "Errore sconosciuto");
  render(html`
    <section class="section">
      <div class="container">
        <article class="message is-danger">
          <div class="message-header"><p>${title}</p></div>
          <div class="message-body">
            <p>${msg}</p>
            <details class="mt-3">
              <summary>Dettagli tecnici</summary>
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
const state = {};

async function mount() {
  try {
    const { MapCenter } = await import(`./views/map-center/index.js?v=${VERSION}`);
    render(await MapCenter({ state, client, html, render, root }), root);
  } catch (e) {
    showError("Errore avvio app", e);
  }
}

render(html`<div></div>`, root);
mount();
