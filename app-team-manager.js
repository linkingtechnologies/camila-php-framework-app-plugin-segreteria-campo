// app-team-manager.js — Gestione squadre
//
// Entry point only. The shared bootstrap lives in app-boot.js and is imported
// dynamically with the version in the query string: mountMiniApp() emits this
// file's <script> tag without one, so the browser caches it forever and a
// static import would freeze app-boot.js with it.
const VERSION = window.APP_CONFIG?.version || Date.now();

import(`./app-boot.js?v=${VERSION}`).then(({ mountSpa }) =>
  mountSpa({ view: "team-manager", exportName: "TeamManager" })
);
