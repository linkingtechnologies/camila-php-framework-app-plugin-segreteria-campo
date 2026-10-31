// app-boot.js — shared bootstrap for the SPA entry points of this plugin.
//
// Every app-<id>.js was a copy of the same 46 lines: find #app, check that
// WorkTableClient is there, build it, dynamically import the view, render it,
// show an error box if anything fails. Eight of them differed from each other
// by exactly two lines. That skeleton lives here now.
//
// WHY THIS FILE IS IMPORTED DYNAMICALLY, AND WITH A VERSION
//
// mountMiniApp() emits `<script type="module" src="./plugins/<p>/app-<id>.js">`
// with no query string, so the browser caches the entry point indefinitely.
// That is why entry points are thin shells and all the real code sits behind
// versioned `import(...?v=VERSION)` calls. A static `import "./app-boot.js"`
// from an entry point would inherit that same cacheless URL and freeze this
// file in the browser too - the exact trap AGENTS.md describes for
// views/shared. Entry points must therefore do:
//
//   import(`./app-boot.js?v=${VERSION}`).then(({ mountSpa }) => mountSpa({...}))
//
// Not converted: app-import-wizard.js, which renders inline and has no view
// module to load.
import { html, render } from "../../../../camila/js/lit-html/lit-html.js";
import "./no-pull-refresh.js";

const VERSION = window.APP_CONFIG?.version || Date.now();

const LOADING_SPINNER = html`
  <style>
    .spa-boot-spin {
      animation: spa-boot-spin 1s linear infinite;
    }
    @keyframes spa-boot-spin {
      to {
        transform: rotate(360deg);
      }
    }
  </style>
  <div
    style="display:flex;align-items:center;justify-content:center;gap:.75rem;margin-top:2rem"
  >
    <span class="icon spa-boot-spin"><i class="ri-loader-4-line ri-lg"></i></span>
    <span class="has-text-grey">Caricamento…</span>
  </div>
`;

// php-crud-api error codes (ErrorCode in api.include.php).
const ERR_AUTH_REQUIRED = 1011;
const ERR_AUTH_FAILED = 1012;

// The client throws Error("HTTP <status>") with .status and .payload, where
// payload is the API's JSON body: { code, message }. Reading .payload with
// String() is what printed "[object Object]" in the box.
function describeApiError(err) {
  const payload = err?.payload;
  const fromPayload =
    typeof payload === "string"
      ? payload
      : typeof payload?.message === "string"
      ? payload.message
      : "";

  return {
    status: err?.status,
    code: typeof payload?.code === "number" ? payload.code : undefined,
    message: fromPayload || err?.message || String(err || "Errore sconosciuto"),
  };
}

// The session died, rather than something being broken. In this app it has one
// cause above all others: when the request carries an Authorization header the
// API ignores its value, starts the PHP session and looks for a user row whose
// `session_id` column equals session_id() (api.include.php:4805). That column
// holds ONE session per user and is written AT LOGIN (header.php:234), so a
// second login by the same user from another browser or device takes it over
// and every earlier tab stops being recognised.
function isSessionError({ status, code }) {
  // 403 is also "Operation forbidden" (1014), a permission refusal and not a
  // dead session, so when the API gave a code the code decides. The status
  // is only a fallback for answers that carry no JSON body.
  if (typeof code === "number") {
    return code === ERR_AUTH_REQUIRED || code === ERR_AUTH_FAILED;
  }
  return status === 401 || status === 403;
}

function technicalDetails(err) {
  return html`
    <details class="mt-3">
      <summary class="is-size-7">Dettagli tecnici</summary>
      <pre style="white-space:pre-wrap;margin:.5rem 0 0">
${JSON.stringify(err, null, 2)}</pre
      >
    </details>
  `;
}

// Single error box for every SPA. The entry points had two variants of it,
// differing only in the wording of the <details> summary.
function showError(root, title, err) {
  const info = describeApiError(err);

  if (isSessionError(info)) {
    render(
      html`
        <section class="section">
          <div class="container">
            <article class="message is-warning">
              <div class="message-header"><p>Sessione non più valida</p></div>
              <div class="message-body">
                <p>
                  Questa pagina non è più collegata al tuo accesso, quindi non
                  riesce a leggere i dati.
                </p>
                <p class="mt-2">
                  Succede quasi sempre quando <strong>lo stesso utente entra da
                  un altro browser o da un altro dispositivo</strong>: vale solo
                  l'accesso più recente, e le schede aperte prima smettono di
                  funzionare.
                </p>
                <p class="mt-2">
                  Per riprendere da qui devi <strong>rifare l'accesso</strong>:
                  è l'accesso che riaggancia la sessione a questa scheda.
                  Ricaricare da solo non basta. Tieni presente che rientrando da
                  qui sarà l'altra postazione a restare fuori.
                </p>
                <div class="buttons mt-4">
                  <a class="button is-primary" href="cf_logout.php">
                    <span class="icon"><i class="ri-login-box-line"></i></span>
                    <span>Esci e rientra</span>
                  </a>
                  <button
                    class="button is-light"
                    @click=${() => window.location.reload()}
                  >
                    <span class="icon"><i class="ri-refresh-line"></i></span>
                    <span>Ricarica la pagina</span>
                  </button>
                </div>
                <p class="is-size-7 has-text-grey">
                  Ricaricare serve solo se nel frattempo l'accesso è stato
                  rifatto in questa scheda.
                </p>
                ${technicalDetails(err)}
              </div>
            </article>
          </div>
        </section>
      `,
      root
    );
    return;
  }

  render(
    html`
      <section class="section">
        <div class="container">
          <article class="message is-danger">
            <div class="message-header"><p>${title}</p></div>
            <div class="message-body">
              <p>${info.message}</p>
              ${technicalDetails(err)}
            </div>
          </article>
        </div>
      </section>
    `,
    root
  );
}

/**
 * Mounts a SPA of this plugin into #app.
 *
 * Single view:
 *   mountSpa({ view: "comms-feed", exportName: "CommsFeed" })
 *
 * Wizard (views/<view>/step1.js … stepN.js, each exporting Step<n>):
 *   mountSpa({
 *     view: "massive-check-out",
 *     steps: 4,
 *     state: { org: null },
 *     guards: { 2: (s) => !!s.org?.name },
 *   })
 *
 * @param {Object}   o
 * @param {string}   o.view        directory under views/
 * @param {string}  [o.exportName] named export of the view module (single view)
 * @param {string}  [o.module]     file inside that directory, default index.js
 * @param {number}  [o.steps]      number of wizard steps; 0 = single view
 * @param {Object}  [o.state]      initial state, merged over { step: 1 }
 * @param {Object}  [o.guards]     { step: (state) => boolean }; false sends back to step 1
 * @param {string}  [o.loading]    "blank" (default) or "spinner"
 */
export function mountSpa({
  view,
  exportName,
  module = "index.js",
  steps = 0,
  state: initialState = {},
  guards = {},
  loading = "blank",
} = {}) {
  const root = document.getElementById("app");

  if (typeof WorkTableClient !== "function") {
    showError(root, "Errore inizializzazione", "WorkTableClient non disponibile");
    throw new Error("WorkTableClient non disponibile");
  }

  const client = WorkTableClient(window.APP_CONFIG || {});
  const state = { step: 1, ...initialState };

  // Wizard steps are guarded on every render, not only on the transition that
  // leads to them: a reload or a stale state must not land on a step whose
  // preconditions are gone (AGENTS.md §SPA Entry Points).
  function resolveStep() {
    let n = Number(state.step) || 1;
    if (n < 1 || n > steps) n = 1;
    const guard = guards[n];
    if (typeof guard === "function" && !guard(state)) n = 1;
    return n;
  }

  async function mountWizard() {
    const n = resolveStep();
    state.step = n;
    const mod = await import(`./views/${view}/step${n}.js?v=${VERSION}`);
    const Step = mod[`Step${n}`];
    if (typeof Step !== "function") {
      throw new Error(`views/${view}/step${n}.js non esporta Step${n}`);
    }
    render(await Step({ state, client, goTo, html, render, root }), root);
  }

  async function mountView() {
    const mod = await import(`./views/${view}/${module}?v=${VERSION}`);
    const View = mod[exportName];
    if (typeof View !== "function") {
      throw new Error(`views/${view}/${module} non esporta ${exportName}`);
    }
    render(await View({ state, client, html, render, root }), root);
  }

  async function mount() {
    try {
      await (steps > 0 ? mountWizard() : mountView());
    } catch (e) {
      showError(root, steps > 0 ? "Errore render wizard" : "Errore avvio", e);
    }
  }

  function goTo(step) {
    state.step = step;
    mount();
  }

  render(loading === "spinner" ? LOADING_SPINNER : html`<div></div>`, root);
  mount();

  return { state, goTo, mount };
}
