// views/shared/guide.js
//
// User guides: Markdown written for operators, rendered in the browser.
//
//   views/<spa>/guide.<lang>.md     one guide per SPA, next to the code it describes
//   docs/guide/guide.json           manifest: which SPAs have a guide, and in what order
//   docs/guide/<lang>/<general>.md  the general guide (see the manifest)
//
// Contract (AGENTS.md §Moduli condivisi): nothing here renders by itself. The
// host passes `html` and `render` (lit-html) and gets back a template or a
// controller. The module touches no DOM at import time, so the parser can be
// exercised from Node.
//
// Supported Markdown, on purpose a small subset:
//   # ... ####  headings, with an optional stable id:  ## Title {#passo-3}
//   paragraphs, `-` and `1.` lists (nested by indentation), tables with a header row,
//   > quotes, ---, **bold**, *italic*, `code`, [text](url), ![alt](img/file.png)
//   `[DA VERIFICARE]` is rendered highlighted: a fact nobody confirmed against the UI.
// Convention for authors: **bold is a label exactly as the interface shows it**
// (docs/check-guides.php looks for each one in the SPA's JS); emphasis is *italic*.
// Links: `guide:<view>#<id>` goes to another SPA's guide.

const ROOT = new URL("../../", import.meta.url);            // plugin root
const VIEWS = new URL("../", import.meta.url);              // views/
const SAFE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

/* =========================
   parsing
   ========================= */

const INLINE_RE =
  /\\([\\`*_{}\[\]()#+\-.!|>])|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`/;

// Plain text, with a bare `[DA VERIFICARE]` turned into a highlighted mark: authors write it
// with or without backticks, and a fact nobody confirmed must stand out either way.
const MARK_RE = /(\[DA VERIFICARE[^\]]*\])/;
function pushText(out, s) {
  s.split(MARK_RE).forEach((part, i) => {
    if (!part) return;
    out.push(i % 2 ? { t: "mark", v: part } : { t: "text", v: part });
  });
}

export function parseInline(src) {
  const out = [];
  const re = new RegExp(INLINE_RE.source, "g");
  let pos = 0;
  let m;
  while ((m = re.exec(src))) {
    if (m.index > pos) pushText(out, src.slice(pos, m.index));
    if (m[1] !== undefined) out.push({ t: "text", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "img", alt: m[2], src: m[3] });
    else if (m[4] !== undefined) out.push({ t: "a", href: m[5], c: parseInline(m[4]) });
    else if (m[6] !== undefined) out.push({ t: "b", c: parseInline(m[6]) });
    else if (m[7] !== undefined) out.push({ t: "i", c: parseInline(m[7]) });
    else if (m[8].startsWith("[DA VERIFICARE")) out.push({ t: "mark", v: m[8] });
    else out.push({ t: "code", v: m[8] });
    pos = re.lastIndex;
  }
  if (pos < src.length) pushText(out, src.slice(pos));
  return out;
}

export function plainText(nodes) {
  return nodes
    .map(n => (n.c ? plainText(n.c) : n.v ?? n.alt ?? ""))
    .join("");
}

function slug(s) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const HEADING_RE = /^(#{1,4})\s+(.*?)\s*(?:\{#([A-Za-z0-9_-]+)\})?\s*$/;
const ITEM_RE = /^(\s*)(-|\d+\.)\s+(.*)$/;

// Flat pass over the list lines (indentation gives the nesting), then a tree.
function parseList(lines) {
  const flat = [];
  const stack = [];
  for (const line of lines) {
    const m = ITEM_RE.exec(line);
    if (m) {
      const indent = m[1].length;
      while (stack.length && flat[stack[stack.length - 1]].indent >= indent) stack.pop();
      flat.push({
        ordered: m[2] !== "-",
        text: m[3],
        indent,
        parent: stack.length ? stack[stack.length - 1] : -1
      });
      stack.push(flat.length - 1);
    } else if (flat.length) {
      flat[flat.length - 1].text += " " + line.trim();   // continuation of the last item
    }
  }
  const build = parent => {
    const items = flat
      .map((it, i) => ({ it, i }))
      .filter(x => x.it.parent === parent)
      .map(({ it, i }) => ({ c: parseInline(it.text), children: build(i) }));
    return items.length
      ? { ordered: flat.find(x => x.parent === parent).ordered, items }
      : null;
  };
  return build(-1);
}

export function parseGuide(md) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  const ids = [];
  let title = "";

  const isBlockStart = l =>
    HEADING_RE.test(l) || l.trimStart().startsWith("|") || /^>/.test(l) ||
    ITEM_RE.test(l) || /^\s*---+\s*$/.test(l);

  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*---+\s*$/.test(line)) { i++; continue; }

    const h = HEADING_RE.exec(line);
    if (h) {
      const c = parseInline(h[2]);
      const id = h[3] || slug(plainText(c));
      if (h[1].length === 1 && !title) title = plainText(c);
      ids.push(id);
      blocks.push({ t: "h", level: h[1].length, id, c });
      i++;
      continue;
    }

    if (line.trimStart().startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trimStart().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map(s => s.trim());
        if (!cells.every(c => /^:?-{3,}:?$/.test(c))) rows.push(cells.map(parseInline));
        i++;
      }
      blocks.push({ t: "table", head: rows[0] || [], rows: rows.slice(1) });
      continue;
    }

    if (/^>/.test(line)) {
      const q = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, "").trim());
      blocks.push({ t: "quote", c: parseInline(q.join(" ")) });
      continue;
    }

    if (ITEM_RE.test(line)) {
      const block = [];
      while (i < lines.length) {
        const l = lines[i];
        if (l.trim() === "") {
          // a blank line stays inside the list only if the next text is indented
          let j = i + 1;
          while (j < lines.length && lines[j].trim() === "") j++;
          if (j < lines.length && /^\s{2,}\S/.test(lines[j])) { i++; continue; }
          break;
        }
        if (!ITEM_RE.test(l) && !/^\s+\S/.test(l)) break;
        block.push(l);
        i++;
      }
      blocks.push({ t: "list", list: parseList(block) });
      continue;
    }

    const p = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) {
      p.push(lines[i++].trim());
    }
    blocks.push({ t: "p", c: parseInline(p.join(" ")) });
  }

  return { title, blocks, ids };
}

/* =========================
   rendering (lit-html)
   ========================= */

function resolveUrl(href, base) {
  try {
    return new URL(href, base || undefined).href;
  } catch {
    return null;
  }
}

function schemeOf(href) {
  const m = /^([a-z][a-z0-9+.-]*:)/i.exec(href);
  return m ? m[1].toLowerCase() : "";
}

// ctx: { idPrefix, base, onAnchor(id), onGuideLink(view, id), guideHref(view, id) }
export function renderBlocks(html, blocks, ctx = {}) {
  const prefix = ctx.idPrefix ?? "g-";

  function link(n) {
    const href = n.href;
    const inner = inl(n.c);
    if (href.startsWith("#")) {
      const id = href.slice(1);
      return html`<a href=${"#" + prefix + id} @click=${e => {
        if (ctx.onAnchor) { e.preventDefault(); ctx.onAnchor(id); }
      }}>${inner}</a>`;
    }
    if (href.startsWith("guide:")) {
      const [view, id = ""] = href.slice(6).split("#");
      if (ctx.guideHref) return html`<a href=${ctx.guideHref(view, id)}>${inner}</a>`;
      return html`<a href="#" @click=${e => {
        e.preventDefault();
        ctx.onGuideLink?.(view, id);
      }}>${inner}</a>`;
    }
    const scheme = schemeOf(href);
    if (scheme && !SAFE_SCHEMES.has(scheme)) return inner;      // no javascript:, data:, ...
    const abs = scheme ? href : resolveUrl(href, ctx.base);
    if (!abs) return inner;
    return html`<a href=${abs} target="_blank" rel="noopener">${inner}</a>`;
  }

  function inlineNode(n) {
    switch (n.t) {
      case "text": return n.v;
      case "b": return html`<strong>${inl(n.c)}</strong>`;
      case "i": return html`<em>${inl(n.c)}</em>`;
      case "code": return html`<code>${n.v}</code>`;
      case "mark": return html`<mark>${n.v}</mark>`;
      case "a": return link(n);
      case "img": {
        const scheme = schemeOf(n.src);
        if (scheme && !SAFE_SCHEMES.has(scheme)) return "";
        const src = scheme ? n.src : resolveUrl(n.src, ctx.base);
        return src ? html`<img src=${src} alt=${n.alt} loading="lazy" />` : "";
      }
      default: return "";
    }
  }

  const inl = nodes => nodes.map(inlineNode);

  function list(l) {
    const items = l.items.map(
      it => html`<li>${inl(it.c)}${it.children ? list(it.children) : ""}</li>`
    );
    return l.ordered ? html`<ol>${items}</ol>` : html`<ul>${items}</ul>`;
  }

  function heading(b) {
    const id = prefix + b.id;
    switch (b.level) {
      case 1: return html`<h1 id=${id}>${inl(b.c)}</h1>`;
      case 2: return html`<h2 id=${id}>${inl(b.c)}</h2>`;
      case 3: return html`<h3 id=${id}>${inl(b.c)}</h3>`;
      default: return html`<h4 id=${id}>${inl(b.c)}</h4>`;
    }
  }

  return blocks.map(b => {
    switch (b.t) {
      case "h": return heading(b);
      case "p": return html`<p>${inl(b.c)}</p>`;
      case "quote": return html`<blockquote><p>${inl(b.c)}</p></blockquote>`;
      case "list": return list(b.list);
      case "table": return html`
        <div class="table-container">
          <table class="table is-bordered is-fullwidth">
            <thead><tr>${b.head.map(c => html`<th>${inl(c)}</th>`)}</tr></thead>
            <tbody>${b.rows.map(r => html`<tr>${r.map(c => html`<td>${inl(c)}</td>`)}</tr>`)}</tbody>
          </table>
        </div>`;
      default: return "";
    }
  });
}

/* =========================
   loading
   ========================= */

export function resolveLang(manifest, forced) {
  const langs = manifest.languages || [manifest.default || "it"];
  const wanted =
    forced ||
    window.APP_CONFIG?.lang ||
    document.documentElement.lang ||
    manifest.default;
  const short = String(wanted || "").slice(0, 2).toLowerCase();
  return langs.includes(short) ? short : manifest.default || "it";
}

export async function loadManifest(version) {
  const res = await fetch(new URL(`docs/guide/guide.json?v=${version}`, ROOT));
  if (!res.ok) throw new Error(`guide.json: HTTP ${res.status}`);
  return res.json();
}

async function fetchDoc(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return { ...parseGuide(await res.text()), base: url };
}

// The wanted language first, then the manifest's default: a missing translation
// must not leave the operator without a guide.
export async function loadGuide(view, lang, manifest, version) {
  const entry = manifest.guides?.find(g => g.view === view);
  const tries = [...new Set([lang, manifest.default])];
  for (const l of tries) {
    // An entry with `file` lives outside views/: the chapters of the manual itself
    // (docs/guide/{lang}/manuale/...). Every other entry is views/<view>/guide.<lang>.md.
    const url = entry?.file
      ? new URL(`${entry.file.replace("{lang}", l)}?v=${version}`, ROOT)
      : new URL(`${view}/guide.${l}.md?v=${version}`, VIEWS);
    const doc = await fetchDoc(url);
    if (doc) return { ...doc, lang: l };
  }
  return null;
}

export async function loadGeneral(lang, manifest, version) {
  const tries = [...new Set([lang, manifest.default])];
  for (const l of tries) {
    const path = manifest.general?.[l];
    if (!path) continue;
    const doc = await fetchDoc(new URL(`${path}?v=${version}`, ROOT));
    if (doc) return { ...doc, lang: l };
  }
  return null;
}

/* =========================
   drawer: the "?" button and the side panel inside an SPA
   ========================= */

// `view` is the SPA the drawer belongs to (null on a PHP dashboard); `fab: false` leaves out the
// floating button, for pages where something else opens the panel (openGuide).
export function createGuideDrawer({ html, render, view, manifest, version, getAnchor, fab = true }) {
  const host = document.createElement("div");
  host.className = "wt-guide-host";
  document.body.appendChild(host);

  const lang = resolveLang(manifest);
  const cache = new Map();
  const trail = [];            // guides left through a `guide:` link, to go back
  let isOpen = false;
  let loading = false;
  let missing = false;
  let doc = null;
  let current = { view, id: null };
  let pendingScroll = false;
  let token = 0;               // a slow load must not overwrite a newer one

  const titleOf = v => manifest.guides.find(g => g.view === v)?.title || v;

  function onKey(e) {
    if (e.key === "Escape") close();
  }

  async function show(target) {
    const my = ++token;
    current = target;
    loading = !cache.has(target.view);
    missing = false;
    rerender();
    let loaded = cache.get(target.view);
    if (!loaded) {
      try {
        loaded = await loadGuide(target.view, lang, manifest, version);
      } catch {
        loaded = null;
      }
      if (loaded) cache.set(target.view, loaded);
    }
    if (my !== token) return;
    loading = false;
    doc = loaded;
    missing = !loaded;
    pendingScroll = true;
    rerender();
  }

  function openGuide(v, id = null) {
    isOpen = true;
    trail.length = 0;
    document.addEventListener("keydown", onKey);
    show({ view: v, id });
  }

  function openPanel() {
    openGuide(view, getAnchor?.() ?? null);
  }

  function close() {
    isOpen = false;
    token++;
    document.removeEventListener("keydown", onKey);
    rerender();
  }

  function back() {
    const prev = trail.pop();
    if (prev) show(prev);
  }

  function goGuide(v, id) {
    if (!manifest.guides.some(g => g.view === v)) return;
    trail.push({ ...current });
    show({ view: v, id: id || null });
  }

  function scrollToId(id) {
    pendingScroll = false;
    const el = id ? document.getElementById("g-" + id) : null;
    if (el) el.scrollIntoView({ block: "start" });
    else host.querySelector(".wt-guide-body")?.scrollTo({ top: 0 });
  }

  // Called by the host after a render of its own: in a wizard the guide follows the step.
  function sync() {
    if (!isOpen || trail.length || current.view !== view) return;
    const id = getAnchor?.() ?? null;
    if (id === current.id) return;
    current = { view, id };
    pendingScroll = true;
    rerender();
  }

  function template() {
    const manualHref = new URL(
      `guide.php?view=${encodeURIComponent(current.view)}${current.id ? "#g-" + current.view + "-" + current.id : ""}`,
      ROOT
    ).href;

    return html`
      <style>
        /* the views' own dialogs use z-index up to 9000: the button sits under them, the panel over */
        .wt-guide-fab{position:fixed;right:16px;bottom:16px;z-index:900}
        .wt-guide-panel{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);z-index:9500;
          display:flex;flex-direction:column;background:#fff;box-shadow:-4px 0 24px rgba(0,0,0,.25)}
        .wt-guide-head{display:flex;align-items:center;gap:.5rem;padding:.6rem .8rem;border-bottom:1px solid #dbdbdb}
        .wt-guide-head strong{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .wt-guide-body{flex:1;overflow-y:auto;padding:1rem 1.2rem}
        .wt-guide-body h2,.wt-guide-body h3{scroll-margin-top:.5rem}
        .wt-guide-body mark{background:#fff3a3;font-weight:700;padding:0 .2em}
        .wt-guide-body img{max-width:100%;height:auto}
      </style>
      ${fab ? html`
        <div class="wt-guide-fab">
          <button class="button is-info is-rounded" title="Guida" aria-label="Guida" @click=${openPanel}>
            <span class="icon"><i class="ri-question-line"></i></span>
          </button>
        </div>` : ""}
      ${isOpen ? html`
        <aside class="wt-guide-panel" role="dialog" aria-label="Guida">
          <div class="wt-guide-head">
            ${trail.length
              ? html`<button class="button is-small is-light" @click=${back}>Indietro</button>`
              : ""}
            <strong>${doc?.title || titleOf(current.view)}</strong>
            <a class="button is-small is-light" href=${manualHref} target="_blank" rel="noopener"
               title="Apri il manuale completo">Manuale completo</a>
            <button class="button is-small is-light" aria-label="Chiudi" @click=${close}>
              <span class="icon"><i class="ri-close-line"></i></span>
            </button>
          </div>
          <div class="wt-guide-body content">
            ${loading ? html`<p class="has-text-grey">Caricamento…</p>` : ""}
            ${missing ? html`<p class="has-text-grey">Guida non disponibile per questa pagina.</p>` : ""}
            ${doc && !loading
              ? renderBlocks(html, doc.blocks, {
                  idPrefix: "g-",
                  base: doc.base,
                  onAnchor: scrollToId,
                  onGuideLink: goGuide
                })
              : ""}
          </div>
        </aside>` : ""}
    `;
  }

  function rerender() {
    render(template(), host);
    if (isOpen && pendingScroll && doc && !loading) scrollToId(current.id);
  }

  rerender();
  return {
    open: openPanel,
    openGuide,
    close,
    sync,
    destroy() {
      document.removeEventListener("keydown", onKey);
      host.remove();
    }
  };
}

/* =========================
   full manual: every guide in one page (guide.php)
   ========================= */

export async function renderManual({ html, render, root, version, lang: forced }) {
  const manifest = await loadManifest(version);
  const lang = resolveLang(manifest, forced);
  const [general, docs] = await Promise.all([
    loadGeneral(lang, manifest, version),
    Promise.all(manifest.guides.map(g => loadGuide(g.view, lang, manifest, version)))
  ]);

  const entries = manifest.guides.map((g, i) => ({ ...g, doc: docs[i] }));
  const groups = [...new Set(entries.map(e => e.group || ""))];
  const ctx = view => ({
    idPrefix: `g-${view}-`,
    base: null,
    guideHref: (v, id) => `#g-${v}-${id || ""}`.replace(/-$/, "")
  });

  // Where the page of a guide opens in the application. The view of a SPA guide is the dashboard id
  // (`?dashboard=<view>`), a "dashboards/<id>" view names it, `page` in the manifest overrides it
  // (or is false for none). The manual's own chapters have no page.
  const pageHref = e => {
    if (e.file || e.page === false) return null;
    const id = e.page || (e.view.startsWith("dashboards/") ? e.view.slice("dashboards/".length) : e.view);
    return new URL(`../../index.php?dashboard=${encodeURIComponent(id)}`, ROOT).href;
  };

  const toc = html`
    <nav class="manual-toc">
      <h2>Indice</h2>
      <ul>
        ${general ? html`<li><a href="#g-generale">${general.title || "Guida generale"}</a></li>` : ""}
        ${groups.map(group => html`
          <li>${group ? html`<strong>${group}</strong>` : ""}
            <ul>${entries.filter(e => (e.group || "") === group).map(e => html`
              <li><a href=${"#g-" + e.view}>${e.title}</a>${e.doc ? "" : html` <em>(guida non disponibile)</em>`}</li>`)}
            </ul>
          </li>`)}
      </ul>
    </nav>`;

  // Sticky side menu: every guide, and under each the `##` sections of its text. The part titles
  // (the manifest groups) are only labels. The current guide and section follow the scroll.
  const sectionsOf = doc => (doc?.blocks || []).filter(b => b.t === "h" && b.level === 2);
  const sideEntry = (id, title, doc) => html`
    <details class="side-entry">
      <summary><a href=${"#" + id} data-sec=${id}>${title}</a></summary>
      <ul>${sectionsOf(doc).map(b => html`
        <li><a href=${`#${id}-${b.id}`} data-sec=${`${id}-${b.id}`}>${plainText(b.c)}</a></li>`)}
      </ul>
    </details>`;
  const treeTemplate = () => html`
    ${general ? sideEntry("g-generale", general.title || "Guida generale", general) : ""}
    ${groups.map(group => html`
      ${group ? html`<div class="side-group">${group}</div>` : ""}
      ${entries.filter(e => (e.group || "") === group && e.doc)
        .map(e => sideEntry("g-" + e.view, e.title, e.doc))}`)}`;

  // ---- search: everything is already loaded, so the index is built in memory ----------------
  // One record per heading (any level) with the text that follows it up to the next heading.
  // `fold` lowercases and strips accents one character at a time, so a position in the folded
  // text is the same position in the original: that is what lets the snippet be highlighted.
  const fold = s => Array.from(String(s).toLowerCase().replace(/[’‘]/g, "'"), ch => {
    const b = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
    return b ? b[0] : " ";
  }).join("");
  const listText = l => (l ? l.items.map(it => plainText(it.c) + " " + listText(it.children)).join(" ") : "");
  const blockText = b => {
    switch (b.t) {
      case "p": case "quote": return plainText(b.c);
      case "list": return listText(b.list);
      case "table": return [...b.head, ...b.rows.flat()].map(plainText).join(" ");
      default: return "";
    }
  };
  const index = [];
  const indexDoc = (id, guide, doc, open = null) => {
    let rec = null;
    for (const b of doc?.blocks || []) {
      if (b.t === "h") {
        rec = { anchor: `${id}-${b.id}`, guide, section: plainText(b.c), text: "", open };
        index.push(rec);
      } else if (rec) {
        rec.text += " " + blockText(b);
      }
    }
  };
  if (general) indexDoc("g-generale", general.title || "Guida generale", general);
  entries.filter(e => e.doc).forEach(e => indexDoc("g-" + e.view, e.title, e.doc, pageHref(e)));
  index.forEach(r => {
    r.text = r.text.replace(/\s+/g, " ").trim();
    r.fsection = fold(r.section);
    r.fguide = fold(r.guide);
    r.ftext = fold(r.text);
  });

  const MAX_RESULTS = 40;
  const termsOf = q => fold(q).split(/[^a-z0-9']+/).filter(t => t.length >= 2);
  const count = (hay, t) => {
    let n = 0;
    for (let i = hay.indexOf(t); i !== -1 && n < 50; i = hay.indexOf(t, i + t.length)) n++;
    return n;
  };
  // Every term must appear somewhere in the record; a hit in the section title weighs most.
  const search = q => {
    const terms = termsOf(q);
    if (!terms.length) return null;
    const hits = [];
    index.forEach((r, order) => {
      let score = 0;
      for (const t of terms) {
        const s = count(r.fsection, t), g = count(r.fguide, t), x = count(r.ftext, t);
        if (!s && !g && !x) return;
        score += s * 6 + g * 2 + Math.min(x, 5);
      }
      hits.push({ r, score, order });
    });
    hits.sort((a, b) => b.score - a.score || a.order - b.order);
    return { terms, hits };
  };
  const snippetOf = (r, terms) => {
    let at = -1;
    for (const t of terms) {
      const i = r.ftext.indexOf(t);
      if (i !== -1 && (at === -1 || i < at)) at = i;
    }
    const start = at > 70 ? at - 60 : 0;
    const end = start + 150;
    return (start ? "…" : "") + r.text.slice(start, end) + (end < r.text.length ? "…" : "");
  };
  // Text with the matching terms wrapped in <mark> (as lit parts, never as HTML).
  const marked = (text, terms) => {
    const f = fold(text);
    const ranges = [];
    for (const t of terms) {
      for (let i = f.indexOf(t); i !== -1; i = f.indexOf(t, i + t.length)) ranges.push([i, i + t.length]);
    }
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push([...r]);
    }
    const out = [];
    let pos = 0;
    for (const [a, b] of merged) {
      if (a > pos) out.push(text.slice(pos, a));
      out.push(html`<mark>${text.slice(a, b)}</mark>`);
      pos = b;
    }
    if (pos < text.length) out.push(text.slice(pos));
    return out;
  };
  let query = "";
  const resultsTemplate = res => res.hits.length
    ? html`
      <div class="side-count">${res.hits.length} ${res.hits.length === 1 ? "risultato" : "risultati"}${
        res.hits.length > MAX_RESULTS ? `, i primi ${MAX_RESULTS}` : ""}</div>
      <ul class="side-results">${res.hits.slice(0, MAX_RESULTS).map(h => html`
        <li><a href=${"#" + h.r.anchor}>
          <span class="r-guide">${marked(h.r.guide, res.terms)}</span>
          <span class="r-sec">${marked(h.r.section, res.terms)}</span>
          <span class="r-snip">${marked(snippetOf(h.r, res.terms), res.terms)}</span>
        </a>${h.r.open
          ? html`<a class="r-open" href=${h.r.open} target="_blank" rel="noopener" title="Apri la pagina nel programma">↗</a>`
          : ""}</li>`)}
      </ul>`
    : html`<div class="side-count">Nessun risultato per «${query}».</div>`;

  const closeMenu = () => root.querySelector(".manual-layout")?.classList.remove("menu-open");
  const side = html`
    <nav class="manual-side" aria-label="Indice del manuale" @click=${e => { if (e.target.closest("a")) closeMenu(); }}>
      <div class="side-search">
        <input type="search" placeholder="Cerca nella guida…  ( / )" aria-label="Cerca nella guida" autocomplete="off">
      </div>
      <div class="side-body"></div>
    </nav>`;

  root.replaceChildren();   // lit renders next to whatever is already in the container ("Caricamento…")
  render(html`
    <button type="button" class="manual-menu-btn" aria-label="Indice del manuale"
      @click=${() => root.querySelector(".manual-layout")?.classList.toggle("menu-open")}>☰ Indice</button>
    <div class="manual-layout">
      ${side}
      <div class="manual-content">
        ${toc}
        ${general
          ? html`<section id="g-generale" class="manual-section">${renderBlocks(html, general.blocks, { ...ctx("generale"), base: general.base })}</section>`
          : ""}
        ${entries.filter(e => e.doc).map(e => html`
          <section id=${"g-" + e.view} class="manual-section">
            ${pageHref(e)
              ? html`<div class="manual-open"><a href=${pageHref(e)} target="_blank" rel="noopener"
                  title="Apre la pagina nel programma, in una nuova scheda">Apri la pagina ↗</a></div>`
              : ""}
            ${renderBlocks(html, e.doc.blocks, { ...ctx(e.view), base: e.doc.base })}
          </section>`)}
      </div>
    </div>
  `, root);

  // Scroll spy: highlight the guide and the section being read, open its entry, close the others.
  const sections = [...root.querySelectorAll("section.manual-section")];
  const sideEl = root.querySelector(".manual-side");
  const sideBody = root.querySelector(".side-body");
  const link = id => (id ? [...sideEl.querySelectorAll("a[data-sec]")].find(a => a.dataset.sec === id) : null);
  let ticking = false;
  const spy = () => {
    ticking = false;
    if (sideEl.classList.contains("is-searching")) return;   // the menu shows results, not the tree
    const line = 90;
    let cur = null;
    for (const s of sections) {
      if (s.getBoundingClientRect().top <= line) cur = s; else break;
    }
    cur = cur || sections[0];
    if (!cur) return;
    let sub = null;
    for (const h of cur.querySelectorAll("h2[id]")) {
      if (h.getBoundingClientRect().top <= line) sub = h; else break;
    }
    sideEl.querySelectorAll(".is-current").forEach(x => x.classList.remove("is-current"));
    const a = link(cur.id);
    const subLink = sub ? link(sub.id) : null;
    a?.classList.add("is-current");
    subLink?.classList.add("is-current");
    const det = a?.closest("details");
    sideEl.querySelectorAll("details[open]").forEach(d => { if (d !== det) d.removeAttribute("open"); });
    if (det) det.open = true;
    // keep the current line inside the menu's own scroll, without moving the page
    const mark = subLink || a;
    if (mark) {
      const r = mark.getBoundingClientRect();
      const s = sideEl.getBoundingClientRect();
      if (r.top < s.top + 30 || r.bottom > s.bottom - 30) sideEl.scrollTop += r.top - s.top - s.height / 3;
    }
  };
  window.addEventListener("scroll", () => {
    if (!ticking) { ticking = true; setTimeout(spy, 60); }   // a timer, not rAF: it also runs in a background tab
  }, { passive: true });

  // The menu body is its own lit root: the tree, or the results of the search box above it.
  const renderSide = () => {
    const res = search(query);
    sideEl.classList.toggle("is-searching", !!res);
    render(res ? resultsTemplate(res) : treeTemplate(), sideBody);
    if (res) sideEl.scrollTop = 0; else spy();
  };
  const input = sideEl.querySelector(".side-search input");
  let typing = null;
  input.addEventListener("input", () => {
    clearTimeout(typing);
    typing = setTimeout(() => { query = input.value.trim(); renderSide(); }, 120);
  });
  input.addEventListener("keydown", e => {
    if (e.key === "Escape") { input.value = ""; query = ""; renderSide(); }
  });
  // "/" jumps to the box, like on most documentation sites
  document.addEventListener("keydown", e => {
    if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^(input|textarea|select)$/i.test(e.target.tagName) || e.target.isContentEditable) return;
    e.preventDefault();
    input.focus();
    input.select();
  });
  renderSide();

  // `?view=<spa>` and a `#g-...` fragment point at a place in the page; the browser
  // looked for it before the content existed, so scroll once it is there.
  const wanted = location.hash.slice(1) || (new URLSearchParams(location.search).get("view") ? "g-" + new URLSearchParams(location.search).get("view") : "");
  if (wanted) document.getElementById(wanted)?.scrollIntoView();
}
