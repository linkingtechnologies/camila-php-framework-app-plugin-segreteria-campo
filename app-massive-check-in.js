// app-massive-check-in.js
import { html, render } from "../../../../../camila/js/lit-html/lit-html.js";
import { Step1 } from "./views/massive-check-in/step1.js";
import { Step2 } from "./views/massive-check-in/step2.js";
import { Step3 } from "./views/massive-check-in/step3.js";

const root = document.getElementById("app");

function showError(title, err) {
  render(html`
    <article class="message is-danger">
      <div class="message-header"><p>${title}</p></div>
      <div class="message-body">
        <pre style="white-space:pre-wrap">${String(err && (err.stack || err.message || err))}</pre>
      </div>
    </article>
  `, root);
}

if (typeof WorkTableClient !== "function") {
  showError("WorkTableClient non definito", "Includi worktable-client.js prima di app.js");
  throw new Error("WorkTableClient non definito");
}

const client = WorkTableClient(window.APP_CONFIG || {});

const state = {
  step: 1,
  org: { name: "", code: "" }
};

function goTo(step) {
  state.step = step;
  mount();
}

async function mount() {
  try {
    if (state.step === 1) {
      render(await Step1({ state, client, goTo, html, render, root }), root);
      return;
    }

    if (state.step === 2) {
      if (!state.org.name) {
        state.step = 1;
        render(await Step1({ state, client, goTo, html, render, root }), root);
        return;
      }
      render(await Step2({ state, client, goTo, html, render, root }), root);
      return;
    }
	
    if (state.step === 3) {
		render(await Step3({ state, client, goTo, html, render, root }), root);
		return;
	}

    // fallback
    state.step = 1;
    render(await Step1({ state, client, goTo, html, render, root }), root);
  } catch (e) {
    showError("Errore render wizard", e);
  }
}

// Boot
render(html`<div class="notification is-warning">App avviata ✅</div>`, root);
mount();
