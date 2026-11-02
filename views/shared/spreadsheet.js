// views/shared/spreadsheet.js
//
// Minimal spreadsheet writers: .xlsx (Excel) and .ods (LibreOffice / OpenOffice),
// each with its self-check. One sheet, a bold header row, text, number and date
// cells, a frozen header and a filter on every column.
// They exist so the browser can hand an operator a spreadsheet without a library
// and without a server round trip: the SPA already holds the rows it fetched
// through WorkTableClient, so nothing new reaches the API and nothing leaves
// the browser.
//
// An .xlsx and an .ods are both a zip of a few XML parts. The zip is written
// "stored" (no compression): the files are small, and a stored zip needs only a
// CRC-32. (An .ods wants its first entry, `mimetype`, stored: that is the rule.)
//
// Cells are written as text unless the caller marks the column numeric or a
// date. That is deliberate: codes, phone numbers and fiscal codes must reach
// Excel as typed, not as numbers that lose their leading zeros or turn into
// 3.3E+11. A date column is written as a real Excel date, shown in the
// regional format of whoever opens the file, so it sorts and filters as a date.
//
// `verifyXlsx()` and `verifyOds()` re-read a file made here against the data it
// was made from. They find the writer's own mistakes; they cannot say whether
// Excel or LibreOffice will accept the file (see their comment).
//
// Pure module: no DOM, no state. `saveBytes()` is the only browser call, and the
// self-checks use DOMParser when there is one.

const enc = new TextEncoder();

// Characters are built from code points on purpose: a character class made of
// escapes in the source is easy to damage when the file is edited by a tool.
const chr = (n) => String.fromCharCode(n);

// ---- zip (stored) ---------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Fixed DOS date/time (2026-01-01 00:00): the content is what matters, and a
// fixed stamp makes the output reproducible.
const DOS_TIME = 0;
const DOS_DATE = ((2026 - 1980) << 9) | (1 << 5) | 1;

function zip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff];
  const u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    // version 20, flag bit 11 = UTF-8 names, method 0 = stored
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameBytes.length), ...u16(0)];

    const local = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...common]);
    chunks.push(local, nameBytes, data);

    central.push({ nameBytes, common, offset });
    offset += local.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  for (const { nameBytes, common, offset: off } of central) {
    // central header: signature, version made by (20), the shared fields,
    // comment length, disk, internal and external attributes, local offset
    const head = new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...common,
      ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]);
    chunks.push(head, nameBytes);
    offset += head.length + nameBytes.length;
  }

  const eocd = new Uint8Array([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0),
    ...u16(central.length), ...u16(central.length), ...u32(offset - centralStart), ...u32(centralStart), ...u16(0)]);
  chunks.push(eocd);

  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
  let p = 0;
  for (const c of chunks) { out.set(c, p); p += c.length; }
  return out;
}

// ---- spreadsheet XML ------------------------------------------------------

// XML 1.0 does not allow most control characters, not even escaped: drop them
// (everything below U+0020 except tab, line feed and carriage return, and the
// two noncharacters U+FFFE and U+FFFF).
const BAD_XML = new RegExp(
  "[" + [[0x00, 0x08], [0x0b, 0x0c], [0x0e, 0x1f], [0xfffe, 0xffff]].map(([a, b]) => chr(a) + "-" + chr(b)).join("") + "]",
  "g"
);

// A lone surrogate (half of an emoji, say) cannot be written as UTF-8: it would
// come back as U+FFFD, and the self-check would read that as a changed value.
// The writer and the check both go through this, so they agree on what a value
// turns into.
const SURROGATES = new RegExp(
  "[" + chr(0xd800) + "-" + chr(0xdbff) + "][" + chr(0xdc00) + "-" + chr(0xdfff) + "]|[" + chr(0xd800) + "-" + chr(0xdfff) + "]",
  "g"
);
const wellFormed = (s) => s.replace(SURROGATES, (m) => (m.length === 2 ? m : chr(0xfffd)));

// what a value turns into once written
const sanitize = (v) => wellFormed(String(v)).replace(BAD_XML, "");

function esc(v) {
  return sanitize(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// 0 -> A, 25 -> Z, 26 -> AA
function colName(i) {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// A sheet name is at most 31 characters and cannot hold  [ ] : * ? / \
function safeSheetName(name) {
  const s = String(name || "").replace(/[\[\]:*?/\\]/g, " ").trim().slice(0, 31);
  return s || "Dati";
}

const NUMBER_RE = /^-?(0|[1-9]\d*)(\.\d+)?$/;

// ISO ("2026-11-02", "2026-11-02 09:30:00", with a T too) and Italian ("02/11/2026").
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;
const IT_DATE_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

/**
 * A date written as text, as { y, mo, d, h, mi, se, time }, or null when it is
 * not a date: not in a known format, impossible (31 February), the zero date of
 * a database ("0000-00-00"), or a year before 1000. `time` says whether the text
 * carried a time of day. A null leaves the value as the text it was.
 */
function parseDate(v) {
  const s = String(v).trim();
  let m, y, mo, d, h, mi, se;
  if ((m = ISO_DATE_RE.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); se = +(m[6] || 0); }
  else if ((m = IT_DATE_RE.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; h = +(m[4] || 0); mi = +(m[5] || 0); se = +(m[6] || 0); }
  else return null;

  if (y < 1000 || mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || se > 59) return null;
  const back = new Date(Date.UTC(y, mo - 1, d));
  if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return { y, mo, d, h, mi, se, time: m[4] !== undefined };
}

/**
 * The Excel serial number of a date written as text, or null when Excel cannot
 * hold it: not a date (see parseDate), or before 1 March 1900 - Excel's 1900
 * system counts a 29 February 1900 that never existed, so earlier serials would
 * be off by one. The day is a whole number; a time of day is the fraction.
 */
function toSerial(v) {
  const p = parseDate(v);
  if (!p) return null;
  const ms = Date.UTC(p.y, p.mo - 1, p.d);
  if (ms < Date.UTC(1900, 2, 1)) return null;

  const days = (ms - Date.UTC(1899, 11, 30)) / 86400000;
  const frac = (p.h * 3600 + p.mi * 60 + p.se) / 86400;
  return frac ? +(days + frac).toFixed(10) : days;
}

/**
 * @param {Object}      o
 * @param {string}     [o.sheetName]  tab name
 * @param {string[]}    o.headers     one label per column
 * @param {Array[]}     o.rows        one array per row, same length as headers
 * @param {boolean[]}  [o.numeric]    per column: write numeric-looking values as numbers
 * @param {boolean[]}  [o.dates]      per column: write dates as Excel dates (anything else stays text)
 * @returns {Uint8Array} the .xlsx file
 */
export function buildXlsx({ sheetName = "Dati", headers, rows, numeric = [], dates = [] }) {
  const sheet = safeSheetName(sheetName);
  const ncol = headers.length;
  const lastCol = colName(Math.max(ncol, 1) - 1);
  const lastRow = rows.length + 1;

  // widths from the content, capped so a long note does not make a huge column
  const widths = headers.map((h) => String(h).length);
  for (const r of rows) {
    for (let c = 0; c < ncol; c++) {
      const len = r[c] == null ? 0 : String(r[c]).length;
      if (len > widths[c]) widths[c] = len;
    }
  }
  const cols = widths
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(w + 2, 8), 50)}" customWidth="1"/>`)
    .join("");

  const text = (ref, v, style = "") =>
    `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;

  let body = `<row r="1">${headers.map((h, c) => text(colName(c) + "1", h, ' s="1"')).join("")}</row>`;
  rows.forEach((r, i) => {
    const n = i + 2;
    let cells = "";
    for (let c = 0; c < ncol; c++) {
      const v = r[c];
      if (v == null || v === "") continue;
      const ref = colName(c) + n;
      const s = String(v);
      const serial = dates[c] ? toSerial(s) : null;
      if (serial !== null) {
        // style 2 = date, 3 = date and time
        cells += `<c r="${ref}" s="${Number.isInteger(serial) ? 2 : 3}"><v>${serial}</v></c>`;
      } else {
        cells += numeric[c] && NUMBER_RE.test(s) ? `<c r="${ref}"><v>${s}</v></c>` : text(ref, s);
      }
    }
    body += `<row r="${n}">${cells}</row>`;
  });

  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const REL = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
  const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

  const parts = {
    "[Content_Types].xml": `${HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
      + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
      + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
      + "</Types>",

    "_rels/.rels": `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
      + "</Relationships>",

    "xl/workbook.xml": `${HEAD}<workbook ${NS} ${REL}><sheets><sheet name="${esc(sheet)}" sheetId="1" r:id="rId1"/></sheets>`
      + `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${esc(sheet).replace(/'/g, "''")}'!$A$1:$${lastCol}$${lastRow}</definedName></definedNames>`
      + "</workbook>",

    "xl/_rels/workbook.xml.rels": `${HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
      + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
      + "</Relationships>",

    // style 0 = default, 1 = bold header on a light grey fill, 2 = date, 3 = date and time.
    // numFmtId 14 and 22 are Excel's own short date and date-time: they follow the
    // regional settings of whoever opens the file (dd/mm/yyyy on an Italian PC).
    "xl/styles.xml": `${HEAD}<styleSheet ${NS}>`
      + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
      + '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
      + '<fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills>'
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + '<cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
      + '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'
      + '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
      + '<xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>'
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + "</styleSheet>",

    // header row frozen, filter on every column
    "xl/worksheets/sheet1.xml": `${HEAD}<worksheet ${NS}>`
      + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
      + '<selection pane="bottomLeft"/></sheetView></sheetViews>'
      + `<sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${body}</sheetData>`
      + `<autoFilter ref="A1:${lastCol}${lastRow}"/></worksheet>`,
  };

  return zip(Object.entries(parts).map(([name, xml]) => ({ name, data: enc.encode(xml) })));
}

// ---- self-check ------------------------------------------------------------

const REQUIRED_PARTS = [
  "[Content_Types].xml", "_rels/.rels", "xl/workbook.xml",
  "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml",
];

// Above this size the sheet is not handed to the DOM parser: a few hundred
// thousand cells would cost far more memory than the check is worth. The
// counting checks below still run on the text.
const DOM_LIMIT = 4000000;

const colIndex = (letters) => [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

const unesc = (v) => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

// The zip: end record, every central entry, and for each one the local header
// it points to, the stored size and the CRC-32 of the data.
function readZip(bytes, problems) {
  const parts = new Map();
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (end < 0 || dv.getUint32(end, true) !== 0x06054b50) {
    problems.push("zip: end record not found");
    return parts;
  }
  const count = dv.getUint16(end + 10, true);
  const dirSize = dv.getUint32(end + 12, true);
  let p = dv.getUint32(end + 16, true);
  if (p + dirSize !== end) problems.push("zip: central directory does not end where the end record starts");

  const dec = new TextDecoder("utf-8", { fatal: true });
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || dv.getUint32(p, true) !== 0x02014b50) {
      problems.push(`zip: bad central header #${i + 1}`);
      break;
    }
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    let name;
    try { name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen)); } catch (_) { name = `#${i + 1}`; }

    if (off + 30 > end || dv.getUint32(off, true) !== 0x04034b50) {
      problems.push(`zip: bad local header for ${name}`);
    } else {
      const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
      if (method !== 0) problems.push(`zip: ${name} is compressed, the writer stores`);
      if (dv.getUint32(off + 22, true) !== size) problems.push(`zip: ${name}: sizes of the two headers differ`);
      if (start + size > end) {
        problems.push(`zip: ${name} runs past the end of the file`);
      } else {
        const data = bytes.subarray(start, start + size);
        if (crc32(data) !== crc) problems.push(`zip: ${name}: CRC-32 does not match`);
        parts.set(name, data);
      }
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (parts.size !== count) problems.push(`zip: ${count} entries declared, ${parts.size} readable`);
  return parts;
}

// An XML part must be well formed. Where there is no DOMParser (not a browser) this check is skipped.
function checkXml(name, text, problems) {
  if (typeof DOMParser === "undefined") return;
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) problems.push(`${name}: XML is not well formed`);
}

// The cells of row `n` of the sheet text, as [column index, text] pairs.
function rowCells(sheet, n) {
  const a = sheet.indexOf(`<row r="${n}">`);
  if (a < 0) return null;
  const z = sheet.indexOf("</row>", a);
  const cells = [];
  const re = /<c r="([A-Z]+)\d+"[^>]*>(?:<is><t[^>]*>([\s\S]*?)<\/t><\/is>|<v>([^<]*)<\/v>)<\/c>/g;
  const chunk = sheet.slice(a, z);
  for (let m; (m = re.exec(chunk));) cells.push([colIndex(m[1]), unesc(m[2] ?? m[3] ?? "")]);
  return cells;
}

/**
 * Checks a file made by buildXlsx() against the data it was made from. It finds
 * the writer's own mistakes - a damaged zip, an XML part that is not well formed,
 * a lost row, a cell in the wrong place, a filter that does not cover the data.
 * It does NOT tell whether Excel will accept the file: Excel is stricter than any
 * check made here, and only opening the file in it proves that.
 *
 * @param {Uint8Array} bytes
 * @param {Object}     o
 * @param {string[]}   o.headers  same as given to buildXlsx
 * @param {Array[]}    o.rows     same as given to buildXlsx
 * @param {boolean[]} [o.dates]   same as given to buildXlsx
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function verifyXlsx(bytes, { headers, rows, dates = [] }) {
  const problems = [];
  const parts = readZip(bytes, problems);

  for (const name of REQUIRED_PARTS) if (!parts.has(name)) problems.push(`missing part ${name}`);
  if (problems.length) return { ok: false, problems };

  const text = {};
  const dec = new TextDecoder("utf-8", { fatal: true });
  for (const name of REQUIRED_PARTS) {
    try { text[name] = dec.decode(parts.get(name)); } catch (_) { problems.push(`${name}: not valid UTF-8`); }
  }
  if (problems.length) return { ok: false, problems };

  for (const name of REQUIRED_PARTS) {
    if (name !== "xl/worksheets/sheet1.xml" || text[name].length <= DOM_LIMIT) checkXml(name, text[name], problems);
  }

  const sheet = text["xl/worksheets/sheet1.xml"];
  const ncol = headers.length;
  const lastCol = colName(Math.max(ncol, 1) - 1);
  const lastRow = rows.length + 1;

  BAD_XML.lastIndex = 0;
  if (BAD_XML.test(sheet)) problems.push("sheet: characters not allowed in XML");
  BAD_XML.lastIndex = 0;

  // every opening tag has its closing one
  for (const [open, close] of [["<row ", "</row>"], ["<c ", "</c>"], ["<is>", "</is>"], ["<t ", "</t>"]]) {
    const o = sheet.split(open).length - 1, c = sheet.split(close).length - 1;
    if (o !== c) problems.push(`sheet: ${o} ${open.trim()} against ${c} ${close}`);
  }

  // rows 1..lastRow in order, cells inside their row, columns increasing, none past the last
  let row = 0, lastCi = -1, nRows = 0, nData = 0, nHead = 0;
  for (const m of sheet.matchAll(/<row r="(\d+)">|<c r="([A-Z]+)(\d+)"/g)) {
    if (m[1]) {
      nRows++;
      row = Number(m[1]);
      lastCi = -1;
      if (row !== nRows) problems.push(`sheet: row ${nRows} is numbered ${row}`);
    } else {
      const ci = colIndex(m[2]);
      if (Number(m[3]) !== row) problems.push(`sheet: cell ${m[2]}${m[3]} sits in row ${row}`);
      if (ci <= lastCi) problems.push(`sheet: cell ${m[2]}${m[3]} is out of order`);
      if (ci >= ncol) problems.push(`sheet: cell ${m[2]}${m[3]} is past the last column`);
      lastCi = ci;
      if (row === 1) nHead++; else nData++;
    }
  }
  if (nRows !== lastRow) problems.push(`sheet: ${nRows} rows, expected ${lastRow}`);
  if (nHead !== ncol) problems.push(`sheet: ${nHead} header cells, expected ${ncol}`);

  // empty values are left out of the file: count what should be there
  let expected = 0;
  for (const r of rows) for (let c = 0; c < ncol; c++) if (r[c] != null && r[c] !== "") expected++;
  if (nData !== expected) problems.push(`sheet: ${nData} data cells, expected ${expected}`);

  if ((sheet.match(/<col /g) || []).length !== ncol) problems.push("sheet: column widths do not match the columns");
  if (!sheet.includes(`<autoFilter ref="A1:${lastCol}${lastRow}"/>`)) problems.push("sheet: filter does not cover the data");
  if (!text["xl/workbook.xml"].includes(`$A$1:$${lastCol}$${lastRow}</definedName>`)) problems.push("workbook: filter name does not cover the data");

  // content of the first, second and last rows, cell by cell
  const sample = [[1, headers]];
  if (rows.length) sample.push([2, rows[0]], [lastRow, rows[rows.length - 1]]);
  for (const [n, values] of sample) {
    const got = rowCells(sheet, n);
    if (!got) { problems.push(`sheet: row ${n} not found`); continue; }
    const byCol = new Map(got);
    for (let c = 0; c < ncol; c++) {
      let want = values[c] == null || values[c] === "" ? undefined : sanitize(values[c]);
      // a date cell holds the serial number of the date, not its text
      const serial = want !== undefined && dates[c] ? toSerial(want) : null;
      if (serial !== null) want = String(serial);
      const have = byCol.get(c);
      // a numeric cell is written as the number: same digits, so same text
      if (want !== have) {
        problems.push(`sheet: row ${n}, column ${colName(c)}: expected ${JSON.stringify(want)}, found ${JSON.stringify(have)}`);
        break;
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

// ---- .ods (OpenDocument spreadsheet) ----------------------------------------

const ODS_NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" '
  + 'xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" '
  + 'xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" '
  + 'xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" '
  + 'xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" '
  + 'xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" '
  + 'xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0" '
  + 'xmlns:ooo="http://openoffice.org/2004/office" '
  + 'xmlns:calcext="urn:org:documentfoundation:names:experimental:calc:xmlns:calcext:1.0"';

const pad2 = (n) => String(n).padStart(2, "0");
const isoOf = (p) => `${String(p.y).padStart(4, "0")}-${pad2(p.mo)}-${pad2(p.d)}` + (p.time ? `T${pad2(p.h)}:${pad2(p.mi)}:${pad2(p.se)}` : "");
const shownOf = (p) => `${pad2(p.d)}/${pad2(p.mo)}/${String(p.y).padStart(4, "0")}` + (p.time ? ` ${pad2(p.h)}:${pad2(p.mi)}:${pad2(p.se)}` : "");

// Text of a cell. In ODF a line break, a tab and a run of spaces are elements, not
// characters: written as plain characters they would collapse into one space.
function odsText(v) {
  return esc(String(v).replace(/\r\n?/g, "\n"))
    .replace(/\n/g, "<text:line-break/>")
    .replace(/\t/g, "<text:tab/>")
    .replace(/^ /, "<text:s/>")
    .replace(/ {2,}/g, (m) => ` <text:s text:c="${m.length - 1}"/>`)
    .replace(/ $/, "<text:s/>");
}

/**
 * Same contract as buildXlsx(), for an .ods file.
 * Dates are written as ODF dates (`office:date-value`, ISO), shown in the order
 * day-month-year of the locale of whoever opens the file; a value that is not a
 * valid date stays text. Unlike Excel, ODF has no problem with years before 1900.
 *
 * @returns {Uint8Array} the .ods file
 */
export function buildOds({ sheetName = "Dati", headers, rows, numeric = [], dates = [] }) {
  const sheet = safeSheetName(sheetName);
  const ncol = headers.length;
  const lastCol = colName(Math.max(ncol, 1) - 1);
  const lastRow = rows.length + 1;

  const widths = headers.map((h) => String(h).length);
  for (const r of rows) {
    for (let c = 0; c < ncol; c++) {
      const len = r[c] == null ? 0 : String(r[c]).length;
      if (len > widths[c]) widths[c] = len;
    }
  }
  // about 0.2 cm per character, with the same limits as the .xlsx
  const colStyles = widths
    .map((w, i) => `<style:style style:name="co${i + 1}" style:family="table-column"><style:table-column-properties style:column-width="${(Math.min(Math.max(w + 2, 8), 50) * 0.2).toFixed(2)}cm"/></style:style>`)
    .join("");
  const colDefs = widths.map((_, i) => `<table:table-column table:style-name="co${i + 1}"/>`).join("");

  const cell = (v, c) => {
    if (v == null || v === "") return "<table:table-cell/>";
    const s = String(v);
    const p = dates[c] ? parseDate(s) : null;
    if (p) {
      return `<table:table-cell table:style-name="${p.time ? "ceDT" : "ceD"}" office:value-type="date" office:date-value="${isoOf(p)}" calcext:value-type="date"><text:p>${shownOf(p)}</text:p></table:table-cell>`;
    }
    if (numeric[c] && NUMBER_RE.test(s)) {
      return `<table:table-cell office:value-type="float" office:value="${s}" calcext:value-type="float"><text:p>${s}</text:p></table:table-cell>`;
    }
    return `<table:table-cell office:value-type="string" calcext:value-type="string"><text:p>${odsText(s)}</text:p></table:table-cell>`;
  };

  const headCell = (h) =>
    `<table:table-cell table:style-name="ceH" office:value-type="string" calcext:value-type="string"><text:p>${odsText(h)}</text:p></table:table-cell>`;

  let body = `<table:table-row>${headers.map(headCell).join("")}</table:table-row>`;
  for (const r of rows) {
    let cells = "";
    for (let c = 0; c < ncol; c++) cells += cell(r[c], c);
    body += `<table:table-row>${cells}</table:table-row>`;
  }

  const q = "'" + esc(sheet).replace(/'/g, "''") + "'";
  const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';

  const dateParts = '<number:day number:style="long"/><number:text>/</number:text><number:month number:style="long"/>'
    + '<number:text>/</number:text><number:year number:style="long"/>';

  const parts = {
    // must be the first entry, stored, and say nothing else
    "mimetype": "application/vnd.oasis.opendocument.spreadsheet",

    "META-INF/manifest.xml": `${HEAD}<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">`
      + '<manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>'
      + '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
      + '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'
      + '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>'
      + '<manifest:file-entry manifest:full-path="settings.xml" manifest:media-type="text/xml"/>'
      + "</manifest:manifest>",

    "meta.xml": `${HEAD}<office:document-meta ${ODS_NS} office:version="1.2"><office:meta><meta:generator xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0">views/shared/spreadsheet.js</meta:generator></office:meta></office:document-meta>`,

    "styles.xml": `${HEAD}<office:document-styles ${ODS_NS} office:version="1.2"><office:styles><style:default-style style:family="table-cell"/></office:styles></office:document-styles>`,

    // The frozen header row: a view setting of the first (only) sheet. LibreOffice reads
    // it only with the `ooo` namespace declared and the (empty) configuration-settings
    // set next to the view settings; without them the row is simply not frozen.
    "settings.xml": `${HEAD}<office:document-settings ${ODS_NS} office:version="1.2"><office:settings>`
      + '<config:config-item-set config:name="ooo:view-settings"><config:config-item-map-indexed config:name="Views"><config:config-item-map-entry>'
      + '<config:config-item config:name="ViewId" config:type="string">view1</config:config-item>'
      + '<config:config-item config:name="ActiveTable" config:type="string">' + esc(sheet) + '</config:config-item>'
      + '<config:config-item-map-named config:name="Tables"><config:config-item-map-entry config:name="' + esc(sheet) + '">'
      + '<config:config-item config:name="CursorPositionX" config:type="int">0</config:config-item>'
      + '<config:config-item config:name="CursorPositionY" config:type="int">0</config:config-item>'
      + '<config:config-item config:name="HorizontalSplitMode" config:type="short">0</config:config-item>'
      + '<config:config-item config:name="VerticalSplitMode" config:type="short">2</config:config-item>'
      + '<config:config-item config:name="HorizontalSplitPosition" config:type="int">0</config:config-item>'
      + '<config:config-item config:name="VerticalSplitPosition" config:type="int">1</config:config-item>'
      + '<config:config-item config:name="ActiveSplitRange" config:type="short">2</config:config-item>'
      + '<config:config-item config:name="PositionLeft" config:type="int">0</config:config-item>'
      + '<config:config-item config:name="PositionRight" config:type="int">0</config:config-item>'
      + '<config:config-item config:name="PositionTop" config:type="int">0</config:config-item>'
      + '<config:config-item config:name="PositionBottom" config:type="int">1</config:config-item>'
      + "</config:config-item-map-entry></config:config-item-map-named>"
      + "</config:config-item-map-entry></config:config-item-map-indexed></config:config-item-set>"
      + '<config:config-item-set config:name="ooo:configuration-settings"/></office:settings></office:document-settings>',

    "content.xml": `${HEAD}<office:document-content ${ODS_NS} office:version="1.2"><office:automatic-styles>`
      + colStyles
      + `<number:date-style style:name="NDate" number:automatic-order="true">${dateParts}</number:date-style>`
      + `<number:date-style style:name="NDateTime" number:automatic-order="true">${dateParts}<number:text> </number:text>`
      + '<number:hours number:style="long"/><number:text>:</number:text><number:minutes number:style="long"/></number:date-style>'
      + '<style:style style:name="ceH" style:family="table-cell"><style:table-cell-properties fo:background-color="#e8eef7"/><style:text-properties fo:font-weight="bold"/></style:style>'
      + '<style:style style:name="ceD" style:family="table-cell" style:data-style-name="NDate"/>'
      + '<style:style style:name="ceDT" style:family="table-cell" style:data-style-name="NDateTime"/>'
      + "</office:automatic-styles><office:body><office:spreadsheet>"
      + `<table:table table:name="${esc(sheet)}">${colDefs}${body}</table:table>`
      + `<table:database-ranges><table:database-range table:name="__Anonymous_Sheet_DB__0" table:target-range-address="${q}.A1:${q}.${lastCol}${lastRow}" table:display-filter-buttons="true" table:contains-header="true"/></table:database-ranges>`
      + "</office:spreadsheet></office:body></office:document-content>",
  };

  return zip(Object.entries(parts).map(([name, text]) => ({ name, data: enc.encode(text) })));
}

const ODS_REQUIRED = ["mimetype", "META-INF/manifest.xml", "content.xml", "styles.xml", "meta.xml", "settings.xml"];

// The cells of the `n`th row of content.xml (1 = header), as [column index, kind, value] triples.
function odsRowCells(content, rowStarts, n) {
  const a = rowStarts[n - 1];
  if (a === undefined) return null;
  const z = n < rowStarts.length ? rowStarts[n] : content.indexOf("</table:table>", a);
  const cells = [];
  const chunks = content.slice(a, z).split("<table:table-cell").slice(1);
  chunks.forEach((chunk, i) => {
    const type = /office:value-type="([a-z]+)"/.exec(chunk)?.[1];
    if (!type) return cells.push([i, "empty", ""]);
    if (type === "date") return cells.push([i, "date", /office:date-value="([^"]*)"/.exec(chunk)?.[1] ?? ""]);
    if (type === "float") return cells.push([i, "float", /office:value="([^"]*)"/.exec(chunk)?.[1] ?? ""]);
    const inner = /<text:p>([\s\S]*?)<\/text:p>/.exec(chunk)?.[1] ?? "";
    const text = inner
      .replace(/<text:line-break\/>/g, "\n")
      .replace(/<text:tab\/>/g, "\t")
      .replace(/<text:s text:c="(\d+)"\/>/g, (_, k) => " ".repeat(Number(k)))
      .replace(/<text:s\/>/g, " ");
    cells.push([i, "string", unesc(text)]);
  });
  return cells;
}

/**
 * Same contract as verifyXlsx(), for a file made by buildOds(): the zip (and that
 * `mimetype` is the first entry and says the right thing), the XML parts, the
 * number of rows and cells, the filter range, and the content of the first, the
 * second and the last row cell by cell. It does NOT tell whether LibreOffice or
 * Excel will accept the file; opening it there is the only proof.
 *
 * @returns {{ ok: boolean, problems: string[] }}
 */
export function verifyOds(bytes, { headers, rows, numeric = [], dates = [] }) {
  const problems = [];
  const parts = readZip(bytes, problems);

  for (const name of ODS_REQUIRED) if (!parts.has(name)) problems.push(`missing part ${name}`);
  if (problems.length) return { ok: false, problems };

  const dec = new TextDecoder("utf-8", { fatal: true });
  const text = {};
  for (const name of ODS_REQUIRED) {
    try { text[name] = dec.decode(parts.get(name)); } catch (_) { problems.push(`${name}: not valid UTF-8`); }
  }
  if (problems.length) return { ok: false, problems };

  // the first entry of the zip is `mimetype`, and it is exactly the media type
  const first = new TextDecoder().decode(bytes.subarray(30, 38));
  if (first !== "mimetype") problems.push("zip: the first entry is not mimetype");
  if (text["mimetype"] !== "application/vnd.oasis.opendocument.spreadsheet") problems.push("mimetype: wrong content");

  for (const name of ODS_REQUIRED) {
    if (name === "mimetype") continue;
    if (name !== "content.xml" || text[name].length <= DOM_LIMIT) checkXml(name, text[name], problems);
  }

  const content = text["content.xml"];
  const ncol = headers.length;
  const lastCol = colName(Math.max(ncol, 1) - 1);
  const lastRow = rows.length + 1;

  BAD_XML.lastIndex = 0;
  if (BAD_XML.test(content)) problems.push("content: characters not allowed in XML");
  BAD_XML.lastIndex = 0;

  const rowStarts = [...content.matchAll(/<table:table-row[ >]/g)].map((m) => m.index);
  if (rowStarts.length !== lastRow) problems.push(`content: ${rowStarts.length} rows, expected ${lastRow}`);
  const nCells = content.split("<table:table-cell").length - 1;
  if (nCells !== lastRow * ncol) problems.push(`content: ${nCells} cells, expected ${lastRow * ncol}`);
  for (const [open, close] of [["<table:table-row>", "</table:table-row>"], ["<text:p>", "</text:p>"]]) {
    const o = content.split(open).length - 1, c = content.split(close).length - 1;
    if (o !== c) problems.push(`content: ${o} ${open} against ${c} ${close}`);
  }
  if ((content.match(/<table:table-column /g) || []).length !== ncol) problems.push("content: column definitions do not match the columns");

  const sheet = /<table:table table:name="([^"]*)"/.exec(content)?.[1] ?? "";
  const range = `table:target-range-address="'${sheet.replace(/'/g, "''")}'.A1:'${sheet.replace(/'/g, "''")}'.${lastCol}${lastRow}"`;
  if (!content.includes(range)) problems.push("content: filter does not cover the data");

  const sample = [[1, headers]];
  if (rows.length) sample.push([2, rows[0]], [lastRow, rows[rows.length - 1]]);
  for (const [n, values] of sample) {
    const got = odsRowCells(content, rowStarts, n);
    if (!got) { problems.push(`content: row ${n} not found`); continue; }
    if (got.length !== ncol) { problems.push(`content: row ${n} has ${got.length} cells, expected ${ncol}`); continue; }
    for (let c = 0; c < ncol; c++) {
      const [, kind, have] = got[c];
      const raw = values[c];
      let wantKind = "empty", want = "";
      if (raw != null && raw !== "") {
        const s = String(raw);
        const p = n > 1 && dates[c] ? parseDate(s) : null;
        if (p) { wantKind = "date"; want = isoOf(p); }
        else if (n > 1 && numeric[c] && NUMBER_RE.test(s)) { wantKind = "float"; want = s; }
        else { wantKind = "string"; want = sanitize(s).replace(/\r\n?/g, "\n"); }
      }
      if (kind !== wantKind || have !== want) {
        problems.push(`content: row ${n}, column ${colName(c)}: expected ${wantKind} ${JSON.stringify(want)}, found ${kind} ${JSON.stringify(have)}`);
        break;
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const ODS_MIME = "application/vnd.oasis.opendocument.spreadsheet";

/** Offers `bytes` to the user as a download named `filename`. */
export function saveBytes(bytes, filename, mime = XLSX_MIME) {
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // the download has been handed to the browser; the URL can go a moment later
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
