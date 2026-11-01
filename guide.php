<?php
declare(strict_types=1);

/*
 * The full manual: every Markdown guide in one page, in the order of
 * docs/guide/guide.json. Like docs.php it needs no Camila session: the guides
 * hold no data. The page is a shell; views/shared/guide.js loads and renders.
 *
 *   guide.php                       the whole manual
 *   guide.php?view=massive-check-in scrolls to that SPA's guide
 *   guide.php?lang=en               a language of the manifest (falls back to the default)
 */

require __DIR__ . '/guide-version.inc.php';
$version = sc_guide_version();
$lang = preg_replace('/[^a-z]/', '', strtolower((string)($_GET['lang'] ?? '')));
?>
<!doctype html>
<html lang="<?= $lang !== '' ? htmlspecialchars($lang) : 'it' ?>">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Guida — Segreteria Campo</title>
<style>
  :root { --fg:#1f2937; --muted:#6b7280; --accent:#1e3a8a; --border:#e5e7eb; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px 16px 64px; color:var(--fg); background:#fff;
         font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif; }
  main { max-width: 1240px; margin: 0 auto; }
  /* side menu (sticky) + text; on a narrow screen the menu is a drawer behind the "Indice" button */
  .manual-layout { display:grid; grid-template-columns: 290px minmax(0, 1fr); gap:2rem; align-items:start; }
  .manual-content { min-width:0; max-width:880px; }
  .manual-side { position:sticky; top:12px; max-height:calc(100vh - 24px); overflow-y:auto; padding:0 .6rem 1rem 0;
                 font-size:14px; line-height:1.35; border-right:1px solid var(--border); overscroll-behavior:contain; }
  .side-search { position:sticky; top:0; z-index:2; background:#fff; padding:.1rem 0 .6rem; }
  .side-search input { width:100%; padding:.45em .7em; font:inherit; border:1px solid #cbd5e1; border-radius:6px; }
  .side-search input:focus { outline:2px solid #93c5fd; border-color:#3b82f6; }
  .side-count { margin:.2em 0 .6em; font-size:12px; color:var(--muted); }
  .side-results { list-style:none; margin:0; padding:0; }
  .side-results li { position:relative; }
  .side-results a { display:block; padding:.5rem .45rem; border-radius:6px; border-bottom:1px solid #f1f5f9; }
  .side-results a.r-open { position:absolute; top:.35rem; right:.2rem; padding:.1rem .45rem; border:0; font-size:14px;
                           color:#1d4ed8; background:#fff; }
  .side-results a.r-open:hover { background:#eef2ff; }
  .manual-open { float:right; margin:1.4rem 0 0 1rem; }
  .manual-open a { display:inline-block; padding:.3em .8em; border:1px solid #bfdbfe; border-radius:6px; background:#eff6ff;
                   color:#1d4ed8; text-decoration:none; font-size:14px; font-weight:600; }
  .manual-open a:hover { background:#dbeafe; }
  .side-results a:hover { background:#f1f5f9; }
  .side-results .r-guide { display:block; font-size:11px; letter-spacing:.03em; text-transform:uppercase; color:var(--muted); }
  .side-results .r-sec { display:block; font-weight:600; color:var(--accent); }
  .side-results .r-snip { display:block; margin-top:.15em; font-size:13px; color:#475569; }
  .manual-side mark { background:#fde68a; color:inherit; padding:0 .1em; border-radius:2px; font-weight:inherit; }
  .manual-side a { color:var(--fg); text-decoration:none; }
  .manual-side a:hover { color:#1d4ed8; }
  .side-group { margin:1.1em 0 .3em; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase;
                color:var(--accent); }
  .side-entry summary { cursor:pointer; padding:.22em .3em; border-radius:4px; }
  .side-entry summary:hover { background:#f3f4f6; }
  .side-entry summary > a { font-weight:600; }
  .side-entry ul { list-style:none; margin:.1em 0 .5em .9em; padding:0 0 0 .6em; border-left:2px solid var(--border); }
  .side-entry li a { display:block; padding:.18em .3em; border-radius:4px; color:var(--muted); }
  .side-entry li a.is-current { color:var(--accent); background:#eef2ff; font-weight:600; }
  .side-entry summary > a.is-current { color:var(--accent); }
  .side-entry[open] > summary { background:#f8fafc; }
  .manual-menu-btn { display:none; position:fixed; top:8px; left:8px; z-index:60; padding:.4em .8em; font:inherit;
                     border:1px solid var(--border); border-radius:6px; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.15); }
  @media screen and (min-width: 960px) { .manual-toc { display:none; } }
  @media screen and (max-width: 959px) {
    .manual-layout { display:block; }
    .manual-menu-btn { display:block; }
    .manual-side { display:none; }
    .menu-open .manual-side { display:block; position:fixed; z-index:50; top:0; bottom:0; left:0; width:min(88vw, 340px);
                              max-height:none; padding:3.2rem .8rem 1rem; background:#fff; border-right:0;
                              box-shadow:4px 0 24px rgba(0,0,0,.3); }
    body { padding-top:48px; }
  }
  h1,h2,h3,h4 { color:var(--accent); line-height:1.25; margin:1.4em 0 .5em; }
  h1 { font-size:30px; } h2 { font-size:24px; } h3 { font-size:19px; } h4 { font-size:17px; }
  p { margin:.7em 0; }
  ul, ol { padding-left:1.4em; margin:.6em 0; }
  a { color:#1d4ed8; }
  code { background:#f3f4f6; padding:.05em .3em; border-radius:4px; }
  mark { background:#fff3a3; font-weight:700; padding:0 .2em; }
  blockquote { margin:1em 0; padding:.4em 1em; border-left:4px solid var(--border); color:var(--muted); background:#fafafa; }
  img { max-width:100%; height:auto; }
  .table-container { overflow-x:auto; }
  table { width:100%; border-collapse:collapse; margin:1em 0; }
  th, td { border:1px solid var(--border); padding:6px 9px; vertical-align:top; text-align:left; }
  th { background:#f9fafb; }
  .manual-toc { border:1px solid var(--border); border-radius:8px; padding:4px 18px 12px; margin-bottom:2em; }
  .manual-toc h2 { margin-top:.6em; }
  .manual-toc ul { list-style:none; padding-left:1em; }
  .manual-toc > ul { padding-left:0; }
  .manual-section { margin-top:2.5em; padding-top:1em; border-top:2px solid var(--border); }
  @media print {
    .manual-side, .manual-menu-btn, .manual-open { display:none !important; }
    .manual-layout { display:block; }
    .manual-section { break-before: page; border-top: 0; }
    .manual-toc { break-after: page; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head>
<body>
<main id="guide"><p style="color:var(--muted)">Caricamento…</p></main>
<script type="module">
import { html, render } from "../../../../camila/js/lit-html/lit-html.js";
import { renderManual } from "./views/shared/guide.js?v=<?= $version ?>";

const root = document.getElementById("guide");
renderManual({ html, render, root, version: "<?= $version ?>", lang: <?= json_encode($lang !== '' ? $lang : null) ?> })
  .catch(e => { root.textContent = "Guida non disponibile: " + e.message; });
</script>
</body>
</html>
