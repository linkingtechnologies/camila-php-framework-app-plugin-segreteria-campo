// app-massive-check-out.js — Check-out massivo
//
// Entry point only. The shared bootstrap lives in app-boot.js and is imported
// dynamically with the version in the query string: mountMiniApp() emits this
// file's <script> tag without one, so the browser caches it forever and a
// static import would freeze app-boot.js with it.
const VERSION = window.APP_CONFIG?.version || Date.now();

import(`./app-boot.js?v=${VERSION}`).then(({ mountSpa }) =>
  mountSpa({
    view: "massive-check-out",
    steps: 4,
    state: {
      org: null, // { name, code, province }, picked at step 1
      step2SelectedCFs: [],
      step3SelectedMezziIds: [],
    },
    guards: {
      2: (s) => !!s.org?.name,
      3: (s) => !!s.org?.name,
      4: (s) => !!s.org?.name,
    },
  })
);
