<?php
declare(strict_types=1);
$outDir    = './docs/it/html';
$outFile   = $outDir . '/manual.html';
$embedCss  = true;

// 3) Load generated HTML
$html = (string)file_get_contents($outFile);

// 4) Rewrite relative asset paths (images, CSS, srcset) to asset.php proxy
$assetBase = rtrim(dirname($_SERVER['SCRIPT_NAME']), '/') . '/asset.php?f=';

// <img src="...">
$html = preg_replace_callback(
    '#(<img\s[^>]*\bsrc=["\'])(?!https?://|data:|/)([^"\']+)(["\'])#i',
    fn($m) => $m[1] . $assetBase . rawurlencode($m[2]) . $m[3],
    $html
);

// <link href="..."> (external CSS files if any)
$html = preg_replace_callback(
    '#(<link\s[^>]*\bhref=["\'])(?!https?://|data:|/)([^"\']+)(["\'])#i',
    fn($m) => $m[1] . $assetBase . rawurlencode($m[2]) . $m[3],
    $html
);

// srcset="img1 1x, img2 2x"
$html = preg_replace_callback(
    '#\bsrcset=["\']([^"\']+)["\']#i',
    function ($m) use ($assetBase) {
        $parts = preg_split('/\s*,\s*/', $m[1]);
        foreach ($parts as &$p) {
            if (preg_match('#^(https?://|data:|/)#i', $p)) continue;
            if (preg_match('#^([^ \t]+)(\s+.+)?$#', $p, $pm)) {
                $p = $assetBase . rawurlencode($pm[1]) . ($pm[2] ?? '');
            }
        }
        return 'srcset="' . implode(', ', $parts) . '"';
    },
    $html
);

// 5) Start output buffer (gzip if possible)
$useGzip = !headers_sent() && extension_loaded('zlib') && !ini_get('zlib.output_compression');
if ($useGzip) ob_start('ob_gzhandler'); else ob_start();

?>
<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Manuale — Segreteria Campo</title>

<!-- ========= Extra CSS styling for better readability ========= -->
<style>
  :root {
    --bg: #ffffff;
    --fg: #1f2937;
    --muted: #6b7280;
    --link: #0ea5e9;
    --border: #e5e7eb;
    --accent: #111827;
    --code-bg: #0b1020;
    --code-fg: #e5e7eb;
  }
  html, body {
    background: var(--bg);
    color: var(--fg);
    font: 16px/1.6 system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, "Noto Sans", "Helvetica Neue", Arial, "Apple Color Emoji","Segoe UI Emoji";
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 980px;
    margin: 24px auto 80px;
    padding: 0 16px;
  }
  header.site {
    margin-bottom: 24px;
    border-bottom: 1px solid var(--border);
    padding-bottom: 12px;
  }
  header.site h1 {
    margin: 0 0 4px 0;
    font-size: 26px;
    color: var(--accent);
    letter-spacing: 0.2px;
  }
  header.site .meta {
    font-size: 13px;
    color: var(--muted);
  }
  /* Converted document styles */
  .doc :where(h1,h2,h3,h4) {
    color: var(--accent);
    line-height: 1.25;
    margin: 1.5em 0 0.5em;
  }
  .doc h1 { font-size: 32px; }
  .doc h2 { font-size: 26px; }
  .doc h3 { font-size: 20px; }
  .doc h4 { font-size: 18px; }
  .doc p { margin: 0.8em 0; }
  .doc a { color: var(--link); text-decoration: none; }
  .doc a:hover { text-decoration: underline; }
  .doc img {
    max-width: 100%;
    height: auto;
    display: block;
    margin: 12px auto;
  }
  .doc figure { margin: 16px 0; }
  .doc figcaption { text-align: center; color: var(--muted); font-size: 0.95em; }
  .doc ul, .doc ol { padding-left: 1.4em; margin: 0.6em 0; }
  .doc blockquote {
    border-left: 4px solid var(--border);
    padding: 8px 12px;
    margin: 16px 0;
    color: var(--muted);
    background: #fafafa;
  }
  .doc table {
    width: 100%;
    border-collapse: collapse;
    margin: 16px 0;
    font-size: 0.98em;
  }
  .doc th, .doc td {
    border: 1px solid var(--border);
    padding: 8px 10px;
    vertical-align: top;
  }
  .doc thead th {
    background: #f8fafc;
    color: #111827;
  }
  .doc code, .doc pre code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  }
  .doc pre {
    background: var(--code-bg);
    color: var(--code-fg);
    border-radius: 8px;
    padding: 14px;
    overflow: auto;
    margin: 16px 0;
  }
  .doc hr {
    border: 0;
    border-top: 1px solid var(--border);
    margin: 28px 0;
  }
  .doc strong { color: #111827; }
  .doc em { color: #374151; }

/* -------- TOC outline formatting -------- */
.doc .toc_outline_level_1,
.doc .toc_outline_level_2,
.doc .toc_outline_level_3,
.doc .toc_outline_level_4 {
  margin: 0.25em 0;
  line-height: 1.4;
}

.doc .toc_outline_level_1 {
  font-weight: 600;
  font-size: 1.05em;
  margin-top: 0.7em;
  text-indent: 0;
}

.doc .toc_outline_level_2 {
  font-weight: 500;
  font-size: 0.98em;
  text-indent: 1.5em;
}

.doc .toc_outline_level_3 {
  font-weight: 400;
  font-size: 0.95em;
  text-indent: 3em;
}

.doc .toc_outline_level_4 {
  font-weight: 400;
  font-size: 0.9em;
  text-indent: 4.5em;
}

/* TOC links */
.doc .toc_outline_level_1 a,
.doc .toc_outline_level_2 a,
.doc .toc_outline_level_3 a,
.doc .toc_outline_level_4 a {
  color: var(--link);
  text-decoration: none;
}

.doc .toc_outline_level_1 a:hover,
.doc .toc_outline_level_2 a:hover,
.doc .toc_outline_level_3 a:hover,
.doc .toc_outline_level_4 a:hover {
  text-decoration: underline;
}

.doc .toc_outline_level_1:first-child {
  margin-top: 1em;
}

.doc .toc_outline_level_1:first-child::before {
  content: "Table of Contents";
  display: block;
  font-weight: 700;
  font-size: 1.2em;
  margin-bottom: 0.4em;
  border-bottom: 2px solid var(--border);
  padding-bottom: 4px;
}

.doc p[class^="toc_outline_level_"] {
  background: #fafafa;
  padding: 0.3em 0.5em;
  border-radius: 4px;
}

/* --- Responsive base layout --- */
@media (max-width: 900px) {
  .container { max-width: 720px; }
  .doc h1 { font-size: 28px; }
  .doc h2 { font-size: 22px; }
  .doc h3 { font-size: 18px; }
}

/* Tables: enable horizontal scrolling on small screens */
.doc table {
  display: block;
  width: 100%;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-spacing: 0;
}
.doc thead th, .doc tbody td {
  white-space: nowrap; /* prevent column collapse */
}

/* --- TOC outline levels --- */
.doc .toc_outline_level_1,
.doc .toc_outline_level_2,
.doc .toc_outline_level_3,
.doc .toc_outline_level_4 {
  margin: .25em 0;
  line-height: 1.4;
}

.doc .toc_outline_level_1 {
  font-weight: 600;
  font-size: 1.05em;
  margin-top: .7em;
  text-indent: 0;
}
.doc .toc_outline_level_2 {
  font-weight: 500;
  font-size: .98em;
  text-indent: 1.5em;
}
.doc .toc_outline_level_3 {
  font-weight: 400;
  font-size: .95em;
  text-indent: 3em;
}
.doc .toc_outline_level_4 {
  font-weight: 400;
  font-size: .90em;
  text-indent: 4.5em;
}

/* TOC links */
.doc .toc_outline_level_1 a,
.doc .toc_outline_level_2 a,
.doc .toc_outline_level_3 a,
.doc .toc_outline_level_4 a {
  color: var(--link);
  text-decoration: none;
}
.doc .toc_outline_level_1 a:hover,
.doc .toc_outline_level_2 a:hover,
.doc .toc_outline_level_3 a:hover,
.doc .toc_outline_level_4 a:hover {
  text-decoration: underline;
}

/* On small screens, reduce indent spacing */
@media (max-width: 600px) {
  .doc .toc_outline_level_2 { text-indent: 1em; }
  .doc .toc_outline_level_3 { text-indent: 2em; }
  .doc .toc_outline_level_4 { text-indent: 3em; }
}

/* --- Collapsible TOC wrapper --- */
.toc-wrap {
  margin: 12px 0 20px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: #fafafa;
}
.toc-toggle {
  width: 100%;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 10px 12px;
  font-weight: 700;
  cursor: pointer;
}
.toc-toggle:after { content: '▾'; float: right; }
.toc-wrap.collapsed .toc-toggle:after { content: '▸'; }
.toc-content {
  padding: 8px 12px 12px;
  border-top: 1px solid var(--border);
}
.toc-wrap.collapsed .toc-content { display: none; }

/* Always open on desktop, collapsible on mobile */
@media (max-width: 900px) {
  .toc-wrap { display: block; }
}

/* Scroll offset for anchor links (so headers aren’t hidden under nav bars) */
:target { scroll-margin-top: 80px; }
@media (max-width: 600px) {
  :target { scroll-margin-top: 60px; }
}



</style>
</head>
<body>
  <div class="container">
    <header class="site">
      <h1>Manuale — Segreteria Campo</h1>
    </header>

    <main id="manuale" class="doc">
      <?= $html ?>
    </main>
  </div>
<script>
/**
 * This script automatically finds the first contiguous group of TOC paragraphs
 * (p.toc_outline_level_*) and wraps them inside a collapsible container.
 */
(function () {
  const doc = document.querySelector('.doc');
  if (!doc) return;

  const nodes = Array.from(doc.children);
  const isTOC = el => el.matches && el.matches('p.toc_outline_level_1, p.toc_outline_level_2, p.toc_outline_level_3, p.toc_outline_level_4');

  let start = -1, end = -1;
  for (let i = 0; i < nodes.length; i++) {
    if (isTOC(nodes[i])) { start = i; break; }
  }
  if (start === -1) return;
  end = start;
  for (let i = start + 1; i < nodes.length; i++) {
    if (!isTOC(nodes[i])) break;
    end = i;
  }

  const group = nodes.slice(start, end + 1);
  if (!group.length) return;

  // Create wrapper elements
  const wrap = document.createElement('div');
  wrap.className = 'toc-wrap'; // visible by default on desktop
  const btn  = document.createElement('button');
  btn.className = 'toc-toggle';
  btn.type = 'button';
  btn.textContent = 'Table of Contents';
  const content = document.createElement('div');
  content.className = 'toc-content';

  // Insert wrapper before the first TOC paragraph
  doc.insertBefore(wrap, group[0]);
  wrap.appendChild(btn);
  wrap.appendChild(content);
  group.forEach(n => content.appendChild(n));

  // Collapse automatically on mobile viewports
  const mq = window.matchMedia('(max-width: 900px)');
  const apply = () => { wrap.classList.toggle('collapsed', mq.matches); };
  apply();
  mq.addEventListener('change', apply);

  // Toggle visib

</body>
</html>
<?php
// 6) Finish output buffer and send
$out = ob_get_clean();

// small horizontal whitespace cleanup
$out = preg_replace('/[ \t]{2,}/', ' ', $out);

if (!headers_sent()) {
    header('Content-Type: text/html; charset=UTF-8');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
}
echo $out;


?>