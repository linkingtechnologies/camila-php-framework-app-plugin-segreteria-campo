// guide-links.js
//
// A discreet "?" next to the buttons of the PHP dashboards that open a SPA, when that
// SPA has a guide (docs/guide/guide.json). The "?" opens the same side panel the SPAs
// use, without leaving the page. The buttons are drawn by the framework
// (CamilaUserInterface::insertButton), so they are found here in the browser: no change
// to the framework and no list of buttons to keep.
//
// Loaded by dashboards.inc.php on every dashboard of the plugin. Optional: if anything
// is missing it does nothing, and it never touches content rendered by a SPA (#app).

const V = new URL(import.meta.url).searchParams.get("v") || Date.now();
const PAGES = "dashboards/";

async function main() {
  const res = await fetch(new URL(`./docs/guide/guide.json?v=${V}`, import.meta.url));
  if (!res.ok) return;
  const manifest = await res.json();
  // A guide is found by its view or, when the button points elsewhere, by its "dashboard"
  // alias (e.g. a button that points to a sibling plugin: "<plugin>--<dashboard>").
  // A guide for a PHP dashboard without a SPA lives in views/dashboards/<id>/ and its view is
  // "dashboards/<id>": the button's `dashboard=<id>` finds it without an alias.
  const guides = new Map();
  for (const g of manifest.guides) {
    guides.set(g.view, g);
    if (g.dashboard) guides.set(g.dashboard, g);
    if (g.view.startsWith(PAGES)) guides.set(g.view.slice(PAGES.length), g);
  }
  if (!guides.size) return;

  const totem = new URLSearchParams(window.location.search).get("totem") === "1";
  // The page we are on, if it is one of those dashboards: it gets the fixed "?" a SPA gets
  // from app-boot.js. SPAs are left alone (their "?" is theirs), and so is a page that
  // reloads itself (`floating: false`), where an open panel would vanish on every refresh.
  const here = guides.get(new URLSearchParams(window.location.search).get("dashboard"));
  const hereHasFab = !!here && here.view.startsWith(PAGES) && here.floating !== false && !totem;

  let drawer = null;
  async function getDrawer() {
    if (!drawer) {
      const [{ html, render }, mod] = await Promise.all([
        import("../../../../camila/js/lit-html/lit-html.js"),
        import(`./views/shared/guide.js?v=${V}`)
      ]);
      drawer = mod.createGuideDrawer({
        html, render, view: hereHasFab ? here.view : null, manifest, version: V,
        getAnchor: null, fab: hereHasFab
      });
    }
    return drawer;
  }
  async function openGuide(view) {
    (await getDrawer()).openGuide(view);
  }
  if (hereHasFab) await getDrawer();

  for (const a of document.querySelectorAll('a.button[href*="dashboard="]')) {
    if (a.closest("#app") || a.dataset.guideLinked) continue;
    const url = new URL(a.getAttribute("href"), window.location.href);
    if (url.searchParams.get("totem") === "1") continue;      // the kiosk has no guide
    const guide = guides.get(url.searchParams.get("dashboard"));
    if (!guide) continue;

    const help = document.createElement("button");
    help.type = "button";
    help.className = "sc-help";
    help.textContent = "?";
    help.title = `Guida: ${guide.title}`;
    help.setAttribute("aria-label", `Guida: ${guide.title}`);
    help.addEventListener("click", () => openGuide(guide.view));
    a.dataset.guideLinked = "1";
    a.after(help);
  }
}

main().catch(e => console.warn("guide-links:", e));
