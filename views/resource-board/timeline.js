// views/resource-board/timeline.js
//
// Availability timeline of the declared squads: one row per squad, one bar per
// availability window (`inizio-disponibilita` .. `fine-disponibilita`).
//
// Follows the shared-module contract of AGENTS.md: it never renders by itself.
// It exports a factory that receives `html` and the host's `rerender`, and
// returns a `template()`. The host imports it dynamically with the version in
// the query string, otherwise the browser would serve a stale copy.

const DAY = 24 * 60 * 60 * 1000;
// The two sizes below are mirrored by literals in the <style> block at the end
// of the file: interpolations inside <style> are not reliable in lit-html.
const LABEL_W = 240;      // px, sticky label column
const HEAD_H = 34;        // px, sticky axis header (only used by the CSS)

// px per day for the fixed zoom levels; "fit" stretches to the container.
const ZOOMS = [
  { key: "fit",  label: "Tutto" },
  { key: "week", label: "Settimana", ppd: 140 },
  { key: "3d",   label: "3 giorni",  ppd: 320 },
  { key: "day",  label: "Giorno",    ppd: 900 }
];

// Bar colours by state. Grey is darkened so white text stays readable.
const COLORS = {
  now:    "#48c78e",
  future: "#3e8ed0",
  past:   "#8a8a8a"
};

function norm(v) { return String(v ?? "").trim(); }
function nInt(v) { return parseInt(v, 10) || 0; }

/**
 * Parses a DB timestamp (`YYYY-MM-DD HH:MM:SS`) into a local Date.
 * A value with no time part is a whole day: as the END of a window it means
 * the end of that day, otherwise the last day would be cut at midnight.
 */
export function parseDb(v, asEnd = false) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(norm(v));
  if (!m) return null;
  const hasTime = m[4] !== undefined;
  const d = hasTime
    ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0))
    : new Date(+m[1], +m[2] - 1, +m[3], asEnd ? 23 : 0, asEnd ? 59 : 0, asEnd ? 59 : 0);
  return isNaN(d.getTime()) ? null : d;
}

function two(n) { return String(n).padStart(2, "0"); }

export function fmtDateTime(d) {
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** Short availability text for a squad record, or "" when it has no dates. */
export function fmtDisponibilita(sq) {
  const a = parseDb(sq?.["inizio-disponibilita"]);
  const b = parseDb(sq?.["fine-disponibilita"], true);
  if (a && b) return `${fmtDateTime(a)} → ${fmtDateTime(b)}`;
  if (a) return `dal ${fmtDateTime(a)}`;
  if (b) return `fino al ${fmtDateTime(b)}`;
  return "";
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
}

// ---- classification ---------------------------------------------------------

function classify(sq, now) {
  const a = parseDb(sq["inizio-disponibilita"]);
  const b = parseDb(sq["fine-disponibilita"], true);

  if (!a && !b) return { kind: "nodates", sq };
  // An end before the start cannot be drawn truthfully: it goes to the list of
  // records to fix instead of being guessed at.
  if (a && b && b < a) return { kind: "incoherent", sq, a, b };

  const state = b && b < now ? "past" : (a && a > now ? "future" : "now");
  return { kind: "bar", sq, a, b, state };
}

export function createTimeline({ html, rerender }) {
  let zoom = "fit";

  function setZoom(key) {
    zoom = key;
    rerender();
  }

  function label(item) {
    const sq = item.sq;
    const nV = nInt(sq["n-volontari"]);
    const nM = nInt(sq["n-mezzi"]);
    const orgs = norm(sq.organizzazioni);
    const servizio = norm(sq.servizio);
    return html`
      <div class="gor-tl-label" title=${norm(sq.nome)}>
        <div class="gor-tl-name">${norm(sq.nome) || "(senza nome)"}</div>
        <div class="gor-tl-sub">
          <span><i class="ri-user-line"></i> ${nV}</span>
          <span><i class="ri-truck-line"></i> ${nM}</span>
          ${orgs ? html`<span class="gor-tl-orgs">${orgs}</span>` : ""}
        </div>
        ${servizio ? html`<div class="gor-tl-sub"><i class="ri-map-pin-line"></i> ${servizio}</div>` : ""}
      </div>
    `;
  }

  function barTitle(item) {
    const sq = item.sq;
    const parts = [norm(sq.nome)];
    const orgs = norm(sq.organizzazioni);
    if (orgs) parts.push(orgs);
    parts.push(fmtDisponibilita(sq));
    parts.push(`${nInt(sq["n-volontari"])} volontari, ${nInt(sq["n-mezzi"])} mezzi`);
    return parts.filter(Boolean).join("\n");
  }

  /**
   * @param {Object}   o
   * @param {Object[]} o.squadre  squad records, already filtered by the host
   * @param {Date}    [o.now]
   */
  function template({ squadre, now = new Date() }) {
    const items = squadre.map(sq => classify(sq, now));
    const bars = items.filter(i => i.kind === "bar");
    const noDates = items.filter(i => i.kind === "nodates");
    const incoherent = items.filter(i => i.kind === "incoherent");

    // Earliest start first; squads that only have an end come before those
    // that start later, since they are available from the beginning.
    bars.sort((x, y) => {
      const ax = (x.a || new Date(0)).getTime();
      const ay = (y.a || new Date(0)).getTime();
      return ax - ay || norm(x.sq.nome).localeCompare(norm(y.sq.nome), "it");
    });

    const legend = html`
      <span class="gor-tl-legend"><i style=${`background:${COLORS.now}`}></i> In corso</span>
      <span class="gor-tl-legend"><i style=${`background:${COLORS.future}`}></i> Da iniziare</span>
      <span class="gor-tl-legend"><i style=${`background:${COLORS.past}`}></i> Terminata</span>
      <span class="gor-tl-legend"><i class="gor-tl-legend-now"></i> Adesso</span>
    `;

    const zoomButtons = html`
      <div class="field has-addons mb-0">
        ${ZOOMS.map(z => html`
          <p class="control">
            <button class="button is-small ${zoom === z.key ? "is-info" : ""}"
              @click=${() => setZoom(z.key)}>${z.label}</button>
          </p>`)}
      </div>
    `;

    const header = html`
      <div class="gor-tl-toolbar">
        ${zoomButtons}
        <div class="gor-tl-legends">${legend}</div>
      </div>
    `;

    if (bars.length === 0) {
      return html`
        ${styles}
        ${header}
        <div class="gor-tl-empty">
          ${squadre.length === 0
            ? "Nessuna squadra dichiarata."
            : "Nessuna squadra ha indicato una finestra di disponibilità."}
        </div>
        ${footer(noDates, incoherent)}
      `;
    }

    // ---- time range: every date that matters, plus "now" ----
    const stamps = [now.getTime()];
    for (const i of bars) {
      if (i.a) stamps.push(i.a.getTime());
      if (i.b) stamps.push(i.b.getTime());
    }
    const start = startOfDay(new Date(Math.min(...stamps)));
    const end = addDays(startOfDay(new Date(Math.max(...stamps))), 1);
    const span = end.getTime() - start.getTime();
    const days = Math.max(1, Math.round(span / DAY));
    const pos = t => ((t.getTime() - start.getTime()) / span) * 100;

    const fixed = ZOOMS.find(z => z.key === zoom && z.ppd);
    // Estimated pixels per day, to decide how dense the axis labels can be.
    const ppd = fixed ? fixed.ppd : 900 / days;
    const trackW = fixed ? `${LABEL_W + days * fixed.ppd}px` : "100%";

    const labelEvery = Math.max(1, Math.ceil(70 / ppd));
    const dayLines = [];
    for (let i = 0; i <= days; i++) {
      const t = addDays(start, i);
      dayLines.push({ t, labelled: i < days && i % labelEvery === 0 });
    }

    // 6-hour minor lines, only when there is room for them.
    const hourLines = [];
    if (ppd >= 400) {
      for (let i = 0; i < days; i++) {
        for (const h of [6, 12, 18]) {
          const t = addDays(start, i);
          t.setHours(h, 0, 0, 0);
          hourLines.push({ t, text: ppd >= 600 ? `${two(h)}:00` : "" });
        }
      }
    }

    const fmtDay = t => t.toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" });

    // Each day label sits in a cell as wide as the days it covers and sticks to
    // the left edge of the viewport inside that cell, so when the grid is zoomed
    // in and scrolled you still read which day you are looking at.
    const dayCells = dayLines.filter(l => l.labelled).map(l => {
      const i = dayLines.indexOf(l);
      const next = dayLines[Math.min(i + labelEvery, days)].t;
      return { t: l.t, w: pos(next) - pos(l.t) };
    });

    const axis = html`
      <div class="gor-tl-head">
        <div class="gor-tl-corner">Squadra</div>
        <div class="gor-tl-axis">
          ${dayCells.map(c => html`
            <div class="gor-tl-daycell" style=${`left:${pos(c.t)}%;width:${c.w}%`}>
              <span class="gor-tl-daylabel">${fmtDay(c.t)}</span>
            </div>`)}
          ${hourLines.filter(l => l.text).map(l => html`
            <span class="gor-tl-tick gor-tl-tick-minor" style=${`left:${pos(l.t)}%`}>${l.text}</span>`)}
        </div>
      </div>
    `;

    const rows = bars.map(item => {
      const left = item.a ? pos(item.a) : 0;
      const right = item.b ? pos(item.b) : 100;
      const openStart = !item.a;
      const openEnd = !item.b;
      const text = `${nInt(item.sq["n-volontari"])} vol · ${nInt(item.sq["n-mezzi"])} mezzi`;
      return html`
        <div class="gor-tl-row">
          ${label(item)}
          <div class="gor-tl-track">
            <div class="gor-tl-bar"
              title=${barTitle(item)}
              style=${`left:${left}%;width:${Math.max(0.4, right - left)}%;background:${COLORS[item.state]}`}>
              ${openStart ? html`<span class="gor-tl-open">‹</span>` : ""}
              <span class="gor-tl-bartext">${text}</span>
              ${openEnd ? html`<span class="gor-tl-open gor-tl-open-end">›</span>` : ""}
            </div>
          </div>
        </div>
      `;
    });

    return html`
      ${styles}
      ${header}
      <div class="gor-tl-scroll">
        <div class="gor-tl-inner" style=${`width:${trackW};min-width:${LABEL_W + 600}px`}>
          ${axis}

          <!-- vertical guides: one layer for the whole grid, not one per cell -->
          <div class="gor-tl-guides">
            ${dayLines.map(l => html`<i class="gor-tl-line" style=${`left:${pos(l.t)}%`}></i>`)}
            ${hourLines.map(l => html`<i class="gor-tl-line gor-tl-line-minor" style=${`left:${pos(l.t)}%`}></i>`)}
          </div>
          <div class="gor-tl-guides gor-tl-guides-now">
            <i class="gor-tl-now" style=${`left:${pos(now)}%`} title="Adesso"></i>
          </div>

          ${rows}
        </div>
      </div>
      ${footer(noDates, incoherent)}
    `;
  }

  function footer(noDates, incoherent) {
    if (noDates.length === 0 && incoherent.length === 0) return "";
    const chipBody = item => html`
      ${norm(item.sq.nome) || "(senza nome)"}
      <span class="gor-tl-chipcount">· ${nInt(item.sq["n-volontari"])}<i class="ri-user-line"></i> ${nInt(item.sq["n-mezzi"])}<i class="ri-truck-line"></i></span>`;
    // A team with an id opens in Squadre dichiarate, in a new tab so the
    // timeline keeps its zoom and scroll position
    const chip = (item, warn) => {
      const cls = warn ? "is-warning is-light" : "is-light";
      const id = norm(item.sq.id);
      if (!id) return html`<span class="tag ${cls}" title=${norm(item.sq.organizzazioni)}>${chipBody(item)}</span>`;
      const href = `./index.php?dashboard=team-manager&squadra=${encodeURIComponent(id)}`;
      return html`
        <a class="tag gor-tl-chiplink ${cls}" href=${href} target="_blank" rel="noopener"
           title=${`${norm(item.sq.organizzazioni)} — apri la squadra per impostare la disponibilità`}>
          ${chipBody(item)}<i class="ri-external-link-line" style="margin-left:4px"></i>
        </a>`;
    };
    return html`
      <div class="gor-tl-footer">
        ${incoherent.length ? html`
          <div class="gor-tl-foot-block">
            <p class="is-size-7 has-text-weight-semibold mb-1">
              Date incoerenti: la fine è prima dell'inizio (${incoherent.length})
            </p>
            <div class="tags">${incoherent.map(i => chip(i, true))}</div>
          </div>` : ""}
        ${noDates.length ? html`
          <div class="gor-tl-foot-block">
            <p class="is-size-7 has-text-weight-semibold mb-1">
              Senza finestra di disponibilità (${noDates.length})
            </p>
            <div class="tags">${noDates.map(i => chip(i, false))}</div>
          </div>` : ""}
      </div>
    `;
  }

  // Styles live with the template: no extra stylesheet to cache-bust.
  const styles = html`
    <style>
      .gor-tl-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:12px; padding:8px 1.25rem; }
      .gor-tl-legends { display:flex; flex-wrap:wrap; gap:12px; font-size:.75rem; color:#666; margin-left:auto; }
      .gor-tl-legend { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
      .gor-tl-legend i { display:inline-block; width:12px; height:12px; border-radius:3px; }
      .gor-tl-legend i.gor-tl-legend-now { width:2px; height:14px; border-radius:0; background:#f14668; }

      .gor-tl-scroll { overflow:auto; max-height:calc(100vh - 330px); min-height:160px;
        margin:0 1.25rem; border:1px solid #dbdbdb; border-radius:6px; background:#fff; }
      .gor-tl-inner { position:relative; }

      .gor-tl-head { display:flex; position:sticky; top:0; z-index:5; height:34px;
        background:#fafafa; border-bottom:1px solid #dbdbdb; }
      .gor-tl-corner { flex:none; width:240px; position:sticky; left:0; z-index:6; background:#fafafa;
        border-right:1px solid #dbdbdb; padding:8px 10px; font-size:.75rem; font-weight:600; color:#666; }
      .gor-tl-axis { position:relative; flex:1; }
      .gor-tl-daycell { position:absolute; top:0; height:20px; }
      /* left:244px = the 240px label column + 4px: sticky offsets are measured
         from the scroll container, not from the axis */
      .gor-tl-daylabel { position:sticky; left:244px; display:inline-block; padding-top:9px;
        font-size:.7rem; color:#555; white-space:nowrap; }
      .gor-tl-tick { position:absolute; top:9px; padding-left:4px; font-size:.7rem; color:#555; white-space:nowrap; }
      .gor-tl-tick-minor { top:20px; font-size:.6rem; color:#999; }

      .gor-tl-guides { position:absolute; left:240px; right:0; top:34px; bottom:0; pointer-events:none; z-index:0; }
      .gor-tl-guides-now { z-index:3; }
      .gor-tl-line { position:absolute; top:0; bottom:0; width:1px; background:#e8e8e8; }
      .gor-tl-line-minor { background:#f3f3f3; }
      .gor-tl-now { position:absolute; top:0; bottom:0; width:2px; margin-left:-1px; background:#f14668; }

      .gor-tl-row { display:flex; position:relative; border-bottom:1px solid #f0f0f0; min-height:48px; }
      .gor-tl-label { flex:none; width:240px; position:sticky; left:0; z-index:4; background:#fff;
        border-right:1px solid #dbdbdb; padding:6px 10px; min-width:0; }
      .gor-tl-name { font-size:.8rem; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .gor-tl-sub { display:flex; gap:8px; font-size:.7rem; color:#777; min-width:0; overflow:hidden; white-space:nowrap; }
      .gor-tl-orgs { overflow:hidden; text-overflow:ellipsis; }
      .gor-tl-track { position:relative; flex:1; }

      .gor-tl-bar { position:absolute; top:10px; height:28px; border-radius:5px; z-index:2; color:#fff;
        display:flex; align-items:center; gap:4px; padding:0 6px; overflow:hidden; cursor:default;
        box-shadow:0 1px 2px rgba(0,0,0,.15); }
      .gor-tl-bartext { font-size:.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .gor-tl-open { font-weight:700; opacity:.85; }
      .gor-tl-open-end { margin-left:auto; }

      .gor-tl-empty { padding:2rem 1.25rem; text-align:center; color:#888; font-size:.85rem; }
      .gor-tl-footer { padding:10px 1.25rem 14px; display:flex; flex-direction:column; gap:10px; }
      .gor-tl-chipcount { opacity:.7; margin-left:4px; }
      .gor-tl-chiplink:hover { filter:brightness(.93); text-decoration:none; }
    </style>
  `;

  return { template, setZoom };
}
