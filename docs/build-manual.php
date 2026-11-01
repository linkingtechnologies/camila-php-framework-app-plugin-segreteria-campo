<?php
declare(strict_types=1);

/*
 * Builds the printable manual as an .odt from the Markdown guides.
 *
 *   php docs/build-manual.php [--lang=it] [--out=path.odt] [--toc-depth=2] [--update-index]
 *
 * The source of truth is Markdown: docs/guide/<lang>/generale.md and, in the order of
 * docs/guide/guide.json, every chapter and every page guide. The .odt is a *derived*
 * file: do not edit it by hand, regenerate it.
 *
 * What it does
 *   - reads guide.json (same file the browser uses) and loads each guide, falling back to
 *     the default language when a translation is missing;
 *   - parses the same Markdown subset as views/shared/guide.js (headings with {#id},
 *     paragraphs, lists, tables, quotes, **bold**, *italic*, `code`, links);
 *   - writes a standalone .odt: title page, table of contents, one outline level per
 *     part / chapter / section, a page break before each chapter, a footer with the page
 *     number. `guide:view#id` and `#id` become links to bookmarks inside the document.
 *
 * The table of contents is written with its entries and links but without page numbers
 * (PHP cannot paginate). Either open the file in LibreOffice and update the indexes
 * (Tools > Update > All Indexes), or pass --update-index: LibreOffice is then started
 * headless, updates them and the file is saved in place.
 *
 * Only .odt is produced, no HTML or PDF. A `[DA VERIFICARE]` in the text is highlighted
 * and counted at the end: the manual is not ready to publish while there are some.
 *
 * Exit code: 0 = done, 1 = done but with warnings (a missing guide, a broken link),
 * 3 = --update-index was asked and the index could not be updated.
 * docs/build-guide.php runs the check first and then this.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$plugin = dirname(__DIR__);
$opts = getopt('', ['lang::', 'out::', 'toc-depth::', 'update-index', 'help']);
if (isset($opts['help'])) {
    echo "php docs/build-manual.php [--lang=it] [--out=path.odt] [--toc-depth=2] [--update-index]\n";
    exit(0);
}

$manifestFile = "$plugin/docs/guide/guide.json";
$manifest = json_decode((string)@file_get_contents($manifestFile), true);
if (!is_array($manifest) || empty($manifest['guides'])) {
    fwrite(STDERR, "Indice non leggibile: $manifestFile\n");
    exit(2);
}
$default = (string)($manifest['default'] ?? 'it');
$lang = preg_replace('/[^a-z]/', '', strtolower((string)($opts['lang'] ?? $default)));
if (!in_array($lang, $manifest['languages'] ?? [$default], true)) {
    $lang = $default;
}
$tocDepth = max(1, min(3, (int)($opts['toc-depth'] ?? 2)));   // 2 = parts and chapters; 3 adds the sections
$out = isset($opts['out']) && $opts['out'] !== false
    ? (string)$opts['out']
    : "$plugin/docs/$lang/manual.odt";

/* =========================
   Markdown (port of views/shared/guide.js)
   ========================= */

function slugify(string $s): string
{
    $map = ['à' => 'a', 'á' => 'a', 'â' => 'a', 'ä' => 'a', 'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i', 'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u'];
    $s = strtr(mb_strtolower($s, 'UTF-8'), $map);
    return trim((string)preg_replace('/[^a-z0-9]+/', '-', $s), '-');
}

function pushText(array &$out, string $s): void
{
    $parts = preg_split('/(\[DA VERIFICARE[^\]]*\])/', $s, -1, PREG_SPLIT_DELIM_CAPTURE);
    foreach ($parts as $i => $part) {
        if ($part === '' || $part === false) {
            continue;
        }
        $out[] = $i % 2 ? ['t' => 'mark', 'v' => $part] : ['t' => 'text', 'v' => $part];
    }
}

function parseInline(string $src): array
{
    $re = <<<'RE'
~\\([\\`*_{}\[\]()#+\-.!|>])|!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`~u
RE;
    $out = [];
    $pos = 0;
    preg_match_all($re, $src, $all, PREG_SET_ORDER | PREG_OFFSET_CAPTURE | PREG_UNMATCHED_AS_NULL);
    foreach ($all as $m) {
        $start = $m[0][1];
        if ($start > $pos) {
            pushText($out, substr($src, $pos, $start - $pos));
        }
        if ($m[1][0] !== null) {
            $out[] = ['t' => 'text', 'v' => $m[1][0]];
        } elseif ($m[2][0] !== null) {
            $out[] = ['t' => 'img', 'alt' => $m[2][0], 'src' => $m[3][0]];
        } elseif ($m[4][0] !== null) {
            $out[] = ['t' => 'a', 'href' => $m[5][0], 'c' => parseInline($m[4][0])];
        } elseif ($m[6][0] !== null) {
            $out[] = ['t' => 'b', 'c' => parseInline($m[6][0])];
        } elseif ($m[7][0] !== null) {
            $out[] = ['t' => 'i', 'c' => parseInline($m[7][0])];
        } elseif (str_starts_with($m[8][0], '[DA VERIFICARE')) {
            $out[] = ['t' => 'mark', 'v' => $m[8][0]];
        } else {
            $out[] = ['t' => 'code', 'v' => $m[8][0]];
        }
        $pos = $start + strlen($m[0][0]);
    }
    if ($pos < strlen($src)) {
        pushText($out, substr($src, $pos));
    }
    return $out;
}

function plainText(array $nodes): string
{
    $s = '';
    foreach ($nodes as $n) {
        $s .= isset($n['c']) ? plainText($n['c']) : ($n['v'] ?? $n['alt'] ?? '');
    }
    return $s;
}

const HEADING_RE = '/^(#{1,4})\s+(.*?)\s*(?:\{#([A-Za-z0-9_-]+)\})?\s*$/';
const ITEM_RE = '/^(\s*)(-|\d+\.)\s+(.*)$/';

/** Flat pass over the list lines (indentation gives the nesting), then a tree. */
function parseList(array $lines): ?array
{
    $flat = [];
    $stack = [];
    foreach ($lines as $line) {
        if (preg_match(ITEM_RE, $line, $m)) {
            $indent = strlen($m[1]);
            while ($stack && $flat[$stack[count($stack) - 1]]['indent'] >= $indent) {
                array_pop($stack);
            }
            $flat[] = ['ordered' => $m[2] !== '-', 'text' => $m[3], 'indent' => $indent,
                'parent' => $stack ? $stack[count($stack) - 1] : -1];
            $stack[] = count($flat) - 1;
        } elseif ($flat) {
            $flat[count($flat) - 1]['text'] .= ' ' . trim($line);
        }
    }
    $build = function (int $parent) use (&$build, $flat): ?array {
        $items = [];
        $ordered = false;
        foreach ($flat as $i => $it) {
            if ($it['parent'] === $parent) {
                if (!$items) {
                    $ordered = $it['ordered'];
                }
                $items[] = ['c' => parseInline($it['text']), 'children' => $build($i)];
            }
        }
        return $items ? ['ordered' => $ordered, 'items' => $items] : null;
    };
    return $build(-1);
}

/** @return array{title: string, blocks: array, ids: string[]} */
function parseGuide(string $md): array
{
    $lines = explode("\n", str_replace(["\r\n", "\r"], "\n", $md));
    $n = count($lines);
    $blocks = [];
    $ids = [];
    $title = '';
    $isBlockStart = fn(string $l) => preg_match(HEADING_RE, $l) || str_starts_with(ltrim($l), '|')
        || str_starts_with($l, '>') || preg_match(ITEM_RE, $l) || preg_match('/^\s*---+\s*$/', $l);

    for ($i = 0; $i < $n;) {
        $line = $lines[$i];
        if (trim($line) === '' || preg_match('/^\s*---+\s*$/', $line)) {
            $i++;
            continue;
        }
        if (preg_match(HEADING_RE, $line, $h)) {
            $c = parseInline($h[2]);
            $id = ($h[3] ?? '') !== '' ? $h[3] : slugify(plainText($c));
            if (strlen($h[1]) === 1 && $title === '') {
                $title = plainText($c);
            }
            $ids[] = $id;
            $blocks[] = ['t' => 'h', 'level' => strlen($h[1]), 'id' => $id, 'c' => $c];
            $i++;
            continue;
        }
        if (str_starts_with(ltrim($line), '|')) {
            $rows = [];
            while ($i < $n && str_starts_with(ltrim($lines[$i]), '|')) {
                $cells = array_map('trim', explode('|', preg_replace('/^\||\|$/', '', trim($lines[$i]))));
                $isRule = true;
                foreach ($cells as $c) {
                    if (!preg_match('/^:?-{3,}:?$/', $c)) {
                        $isRule = false;
                        break;
                    }
                }
                if (!$isRule) {
                    $rows[] = array_map('parseInline', $cells);
                }
                $i++;
            }
            $blocks[] = ['t' => 'table', 'head' => $rows[0] ?? [], 'rows' => array_slice($rows, 1)];
            continue;
        }
        if (str_starts_with($line, '>')) {
            $q = [];
            while ($i < $n && str_starts_with($lines[$i], '>')) {
                $q[] = trim((string)preg_replace('/^>\s?/', '', $lines[$i++]));
            }
            $blocks[] = ['t' => 'quote', 'c' => parseInline(implode(' ', $q))];
            continue;
        }
        if (preg_match(ITEM_RE, $line)) {
            $block = [];
            while ($i < $n) {
                $l = $lines[$i];
                if (trim($l) === '') {
                    $j = $i + 1;
                    while ($j < $n && trim($lines[$j]) === '') {
                        $j++;
                    }
                    if ($j < $n && preg_match('/^\s{2,}\S/', $lines[$j])) {
                        $i++;
                        continue;
                    }
                    break;
                }
                if (!preg_match(ITEM_RE, $l) && !preg_match('/^\s+\S/', $l)) {
                    break;
                }
                $block[] = $l;
                $i++;
            }
            $blocks[] = ['t' => 'list', 'list' => parseList($block)];
            continue;
        }
        $p = [];
        while ($i < $n && trim($lines[$i]) !== '' && !$isBlockStart($lines[$i])) {
            $p[] = trim($lines[$i++]);
        }
        $blocks[] = ['t' => 'p', 'c' => parseInline(implode(' ', $p))];
    }
    return ['title' => $title, 'blocks' => $blocks, 'ids' => $ids];
}

/* =========================
   ODT writing
   ========================= */

function e(string $s): string
{
    $s = (string)preg_replace('/[^\x{9}\x{A}\x{D}\x{20}-\x{D7FF}\x{E000}-\x{FFFD}\x{10000}-\x{10FFFF}]/u', '', $s);
    return htmlspecialchars($s, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

/** A bookmark name for a guide (view) and a section id; "" is the start of the guide. */
function bm(string $view, string $id = ''): string
{
    return 'g_' . trim((string)preg_replace('/[^A-Za-z0-9]+/', '_', $view . '__' . $id), '_');
}

$warnings = [];

function linkXml(array $n, array $ctx): string
{
    global $warnings;
    $href = (string)$n['href'];
    $inner = inlineXml($n['c'], $ctx);
    $target = null;
    if (str_starts_with($href, '#')) {
        $target = bm($ctx['view'], substr($href, 1));
        if (!isset($ctx['known'][$target])) {
            $warnings[] = "{$ctx['view']}: collegamento #" . substr($href, 1) . " non trovato";
            return $inner;
        }
    } elseif (str_starts_with($href, 'guide:')) {
        [$v, $id] = array_pad(explode('#', substr($href, 6), 2), 2, '');
        $target = bm($v, $id);
        if (!isset($ctx['known'][$target])) {
            $target = bm($v, '');
            if (!isset($ctx['known'][$target])) {
                $warnings[] = "{$ctx['view']}: guida $v non nell'indice";
                return $inner;
            }
            if ($id !== '') {
                $warnings[] = "{$ctx['view']}: guide:$v#$id, id non trovato (si va all'inizio della guida)";
            }
        }
    }
    if ($target !== null) {
        return '<text:a xlink:type="simple" xlink:href="#' . e($target) . '" text:style-name="Internal_20_Link"'
            . ' text:visited-style-name="Internal_20_Link">' . $inner . '</text:a>';
    }
    if (preg_match('~^(https?:|mailto:)~i', $href)) {
        return '<text:a xlink:type="simple" xlink:href="' . e($href) . '" text:style-name="Internet_20_link"'
            . ' text:visited-style-name="Visited_20_Internet_20_Link">' . $inner . '</text:a>';
    }
    return $inner;
}

function inlineXml(array $nodes, array $ctx): string
{
    $o = '';
    foreach ($nodes as $n) {
        switch ($n['t']) {
            case 'text':
                $o .= e($n['v']);
                break;
            case 'b':
                $o .= '<text:span text:style-name="Strong">' . inlineXml($n['c'], $ctx) . '</text:span>';
                break;
            case 'i':
                $o .= '<text:span text:style-name="Emphasis">' . inlineXml($n['c'], $ctx) . '</text:span>';
                break;
            case 'code':
                $o .= '<text:span text:style-name="Source_20_Text">' . e($n['v']) . '</text:span>';
                break;
            case 'mark':
                $o .= '<text:span text:style-name="Mark">' . e($n['v']) . '</text:span>';
                break;
            case 'a':
                $o .= linkXml($n, $ctx);
                break;
            case 'img':
                // the guides carry no images today; the alt text keeps the place
                $o .= '<text:span text:style-name="Emphasis">[' . e($n['alt']) . ']</text:span>';
                break;
        }
    }
    return $o;
}

function listXml(array $list, array $ctx): string
{
    $style = $list['ordered'] ? 'LNum' : 'LBul';
    $x = '<text:list text:style-name="' . $style . '">';
    foreach ($list['items'] as $it) {
        $nodes = $it['c'];
        // "- [ ] task" in the source becomes an empty box
        if ($nodes && $nodes[0]['t'] === 'text' && str_starts_with($nodes[0]['v'], '[ ] ')) {
            $nodes[0]['v'] = "\u{2610} " . substr($nodes[0]['v'], 4);
        }
        $x .= '<text:list-item><text:p text:style-name="List_20_Contents">' . inlineXml($nodes, $ctx) . '</text:p>'
            . ($it['children'] ? listXml($it['children'], $ctx) : '') . '</text:list-item>';
    }
    return $x . '</text:list>';
}

$autoStyles = '';
$tableCount = 0;

function tableXml(array $b, array $ctx): string
{
    global $autoStyles, $tableCount;
    $tableCount++;
    $name = 'Tbl' . $tableCount;
    $cols = max(1, count($b['head']));
    foreach ($b['rows'] as $r) {
        $cols = max($cols, count($r));
    }
    // column widths follow the longest text of each column, kept within sensible bounds
    $w = array_fill(0, $cols, 6);
    foreach (array_merge([$b['head']], $b['rows']) as $r) {
        foreach ($r as $c => $cell) {
            $w[$c] = max($w[$c], min(60, mb_strlen(plainText($cell), 'UTF-8')));
        }
    }
    $sum = array_sum($w);
    $autoStyles .= '<style:style style:name="' . $name . '" style:family="table"><style:table-properties'
        . ' style:width="17cm" table:align="margins" fo:margin-top="0.15cm" fo:margin-bottom="0.35cm"/></style:style>';
    $x = '<table:table table:name="' . $name . '" table:style-name="' . $name . '">';
    for ($c = 0; $c < $cols; $c++) {
        $cn = $name . '.' . chr(65 + ($c % 26)) . intdiv($c, 26);
        $autoStyles .= '<style:style style:name="' . $cn . '" style:family="table-column"><style:table-column-properties'
            . ' style:column-width="' . round(17 * $w[$c] / $sum, 2) . 'cm"/></style:style>';
        $x .= '<table:table-column table:style-name="' . $cn . '"/>';
    }
    $row = function (array $cells, bool $head) use ($cols, $ctx): string {
        $r = '<table:table-row>';
        for ($c = 0; $c < $cols; $c++) {
            $r .= '<table:table-cell table:style-name="' . ($head ? 'TblHeadCell' : 'TblCell') . '" office:value-type="string">'
                . '<text:p text:style-name="' . ($head ? 'Table_20_Heading' : 'Table_20_Contents') . '">'
                . inlineXml($cells[$c] ?? [], $ctx) . '</text:p></table:table-cell>';
        }
        return $r . '</table:table-row>';
    };
    $x .= '<table:table-header-rows>' . $row($b['head'], true) . '</table:table-header-rows>';
    foreach ($b['rows'] as $r) {
        $x .= $row($r, false);
    }
    return $x . '</table:table>';
}

/* =========================
   load every guide, in manifest order
   ========================= */

function loadMd(string $file): ?array
{
    if (!is_file($file)) {
        return null;
    }
    $raw = (string)file_get_contents($file);
    $doc = parseGuide($raw);
    $doc['markers'] = substr_count($raw, '[DA VERIFICARE');   // anywhere in the text, tables and lists included
    return $doc;
}

$pathFor = function (array $g, string $l) use ($plugin): string {
    return isset($g['file'])
        ? "$plugin/" . str_replace('{lang}', $l, $g['file'])
        : "$plugin/views/{$g['view']}/guide.$l.md";
};

$docs = [];     // in order: ['view','title','group','doc']
$known = [];    // bookmark => true
$rootPath = $manifest['general'][$lang] ?? $manifest['general'][$default] ?? null;
$rootDoc = $rootPath ? loadMd("$plugin/$rootPath") : null;
if ($rootDoc === null) {
    $warnings[] = 'manca la guida generale (' . ($rootPath ?? 'non indicata nell\'indice') . ')';
} else {
    foreach ($rootDoc['ids'] as $id) {
        $known[bm('generale', $id)] = true;
    }
    $known[bm('generale', '')] = true;
}
foreach ($manifest['guides'] as $g) {
    $doc = loadMd($pathFor($g, $lang)) ?? ($lang !== $default ? loadMd($pathFor($g, $default)) : null);
    if ($doc === null) {
        $warnings[] = "manca la guida {$g['view']}";
        continue;
    }
    $known[bm($g['view'], '')] = true;
    foreach ($doc['ids'] as $id) {
        $known[bm($g['view'], $id)] = true;
    }
    $docs[] = ['view' => $g['view'], 'title' => $g['title'] ?? $g['view'], 'group' => $g['group'] ?? '', 'doc' => $doc];
}

/* =========================
   body + outline
   ========================= */

$body = '';
$outline = [];      // level, text, bookmark: feeds the table of contents
$marks = ($rootDoc['markers'] ?? 0) + array_sum(array_map(fn($d) => $d['doc']['markers'], $docs));

/**
 * Renders one guide. $offset shifts the heading levels (a chapter's "#" is outline level 2,
 * under its part); $firstOfPart makes that first chapter share the page of the part title.
 */
$renderDoc = function (string $view, array $doc, int $offset, bool $noBreakFirst) use (&$body, &$outline, $known): void {
    $ctx = ['view' => $view, 'known' => $known];
    $first = true;
    foreach ($doc['blocks'] as $b) {
        switch ($b['t']) {
            case 'h':
                $level = min(6, $b['level'] + $offset);
                $style = 'Heading_20_' . $level;
                if ($noBreakFirst && $first && $level === 2) {
                    $style = 'H2NoBreak';
                }
                if ($view === 'generale' && $level === 2) {
                    $style = 'H2NoBreak';        // sections of the introduction do not start a page
                }
                $bms = '<text:bookmark text:name="' . bm($view, $b['id']) . '"/>';
                if ($first) {
                    $bms = '<text:bookmark text:name="' . bm($view, '') . '"/>' . $bms;
                }
                $body .= '<text:h text:style-name="' . $style . '" text:outline-level="' . $level . '">' . $bms
                    . inlineXml($b['c'], $ctx) . '</text:h>';
                if ($level <= 3) {
                    $outline[] = [$level, plainText($b['c']), bm($view, $b['id'])];
                }
                $first = false;
                break;
            case 'p':
                $body .= '<text:p text:style-name="Text_20_body">' . inlineXml($b['c'], $ctx) . '</text:p>';
                break;
            case 'quote':
                $body .= '<text:p text:style-name="Quotations">' . inlineXml($b['c'], $ctx) . '</text:p>';
                break;
            case 'list':
                if ($b['list']) {
                    $body .= listXml($b['list'], $ctx);
                }
                break;
            case 'table':
                $body .= tableXml($b, $ctx);
                break;
        }
    }
};

if ($rootDoc !== null) {
    $renderDoc('generale', $rootDoc, 0, false);
}
$lastGroup = null;
foreach ($docs as $d) {
    $first = false;
    if ($d['group'] !== '' && $d['group'] !== $lastGroup) {
        $first = true;
        $partBm = bm('parte', $d['group']);
        $body .= '<text:h text:style-name="Heading_20_1" text:outline-level="1"><text:bookmark text:name="' . $partBm . '"/>'
            . e($d['group']) . '</text:h>';
        $outline[] = [1, $d['group'], $partBm];
    }
    $lastGroup = $d['group'];
    $renderDoc($d['view'], $d['doc'], 1, $first);
}

/* =========================
   front matter and table of contents
   ========================= */

$stamp = date('d/m/Y');
$front = '<text:p text:style-name="Title">Segreteria Campo</text:p>'
    . '<text:p text:style-name="Subtitle">Guida all\'uso</text:p>'
    . '<text:p text:style-name="Subtitle">Versione del ' . e($stamp) . '</text:p>';

$tocEntries = '';
foreach ($outline as [$level, $text, $bookmark]) {
    if ($level > $tocDepth) {
        continue;
    }
    $tocEntries .= '<text:p text:style-name="Contents_20_' . $level . '"><text:a xlink:type="simple" xlink:href="#'
        . e($bookmark) . '" text:style-name="Index_20_Link" text:visited-style-name="Index_20_Link">' . e($text)
        . '</text:a></text:p>';
}
$entryTemplates = '';
for ($l = 1; $l <= $tocDepth; $l++) {
    $entryTemplates .= '<text:table-of-content-entry-template text:outline-level="' . $l . '" text:style-name="Contents_20_' . $l . '">'
        . '<text:index-entry-link-start text:style-name="Index_20_Link"/><text:index-entry-chapter/><text:index-entry-text/>'
        . '<text:index-entry-tab-stop style:type="right" style:leader-char="."/><text:index-entry-page-number/>'
        . '<text:index-entry-link-end/></text:table-of-content-entry-template>';
}
$toc = '<text:table-of-content text:protected="false" text:name="Indice">'
    . '<text:table-of-content-source text:outline-level="' . $tocDepth . '">'
    . '<text:index-title-template text:style-name="Contents_20_Heading">Indice</text:index-title-template>'
    . $entryTemplates . '</text:table-of-content-source>'
    . '<text:index-body><text:index-title text:name="Indice_Title">'
    . '<text:p text:style-name="Contents_20_Heading">Indice</text:p></text:index-title>'
    . $tocEntries . '</text:index-body></text:table-of-content>';

/* =========================
   package
   ========================= */

$NS = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"'
    . ' xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"'
    . ' xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"'
    . ' xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"'
    . ' xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"'
    . ' xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"'
    . ' xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:dc="http://purl.org/dc/elements/1.1/"'
    . ' xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"';

$cellBorder = 'fo:padding="0.08cm" fo:border="0.5pt solid #9aa3b2"';
$content = '<?xml version="1.0" encoding="UTF-8"?>'
    . '<office:document-content ' . $NS . ' office:version="1.2">'
    . '<office:automatic-styles>'
    . '<style:style style:name="H2NoBreak" style:family="paragraph" style:parent-style-name="Heading_20_2">'
    . '<style:paragraph-properties fo:break-before="auto"/></style:style>'
    . '<style:style style:name="TblCell" style:family="table-cell"><style:table-cell-properties ' . $cellBorder . '/></style:style>'
    . '<style:style style:name="TblHeadCell" style:family="table-cell"><style:table-cell-properties ' . $cellBorder
    . ' fo:background-color="#e4ebf7"/></style:style>'
    . $autoStyles
    . '</office:automatic-styles>'
    . '<office:body><office:text>' . $front . $toc . $body . '</office:text></office:body></office:document-content>';

$font = 'style:font-name="Liberation Sans"';
$para = function (string $name, string $parent, string $paraProps, string $textProps = '', string $extra = ''): string {
    return '<style:style style:name="' . $name . '" style:family="paragraph"'
        . ($parent !== '' ? ' style:parent-style-name="' . $parent . '"' : '') . $extra . '>'
        . ($paraProps !== '' ? '<style:paragraph-properties ' . $paraProps . '/>' : '')
        . ($textProps !== '' ? '<style:text-properties ' . $textProps . '/>' : '') . '</style:style>';
};
$listLevels = function (bool $ordered): string {
    $x = '';
    for ($i = 1; $i <= 6; $i++) {
        $pos = round(0.6 * $i, 2);
        $props = '<style:list-level-properties text:list-level-position-and-space-mode="label-alignment">'
            . '<style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="' . $pos . 'cm"'
            . ' fo:text-indent="-0.5cm" fo:margin-left="' . $pos . 'cm"/></style:list-level-properties>';
        if ($ordered) {
            $x .= '<text:list-level-style-number text:level="' . $i . '" style:num-suffix="." style:num-format="'
                . ($i % 2 ? '1' : 'a') . '">' . $props . '</text:list-level-style-number>';
        } else {
            $x .= '<text:list-level-style-bullet text:level="' . $i . '" text:bullet-char="' . ($i % 2 ? "\u{2022}" : "\u{2013}") . '">'
                . $props . '</text:list-level-style-bullet>';
        }
    }
    return $x;
};

$styles = '<?xml version="1.0" encoding="UTF-8"?>'
    . '<office:document-styles ' . $NS . ' office:version="1.2">'
    . '<office:font-face-decls>'
    . '<style:font-face style:name="Liberation Sans" svg:font-family="\'Liberation Sans\'" style:font-family-generic="swiss"/>'
    . '<style:font-face style:name="Liberation Mono" svg:font-family="\'Liberation Mono\'" style:font-family-generic="modern"/>'
    . '</office:font-face-decls>'
    . '<office:styles>'
    . '<style:default-style style:family="paragraph"><style:paragraph-properties fo:hyphenation-ladder-count="no-limit"/>'
    . '<style:text-properties ' . $font . ' fo:font-size="10.5pt" fo:language="it" fo:country="IT"/></style:default-style>'
    . $para('Standard', '', '', '', ' style:class="text"')
    . $para('Text_20_body', 'Standard', 'fo:margin-top="0cm" fo:margin-bottom="0.22cm" fo:line-height="125%" fo:orphans="2" fo:widows="2"',
        '', ' style:display-name="Text body" style:class="text"')
    . $para('Heading', 'Standard', 'fo:margin-top="0.5cm" fo:margin-bottom="0.25cm" fo:keep-with-next="always"',
        'fo:font-weight="bold" fo:color="#1e3a8a"', ' style:class="text"')
    . $para('Heading_20_1', 'Heading', 'fo:margin-top="0cm" fo:margin-bottom="0.5cm" fo:break-before="page"',
        'fo:font-size="24pt"', ' style:display-name="Heading 1" style:default-outline-level="1" style:class="text"')
    . $para('Heading_20_2', 'Heading', 'fo:margin-top="0cm" fo:margin-bottom="0.4cm" fo:break-before="page"',
        'fo:font-size="18pt"', ' style:display-name="Heading 2" style:default-outline-level="2" style:class="text"')
    . $para('Heading_20_3', 'Heading', 'fo:margin-top="0.55cm" fo:margin-bottom="0.2cm"',
        'fo:font-size="13.5pt"', ' style:display-name="Heading 3" style:default-outline-level="3" style:class="text"')
    . $para('Heading_20_4', 'Heading', 'fo:margin-top="0.4cm" fo:margin-bottom="0.15cm"',
        'fo:font-size="11.5pt"', ' style:display-name="Heading 4" style:default-outline-level="4" style:class="text"')
    . $para('Heading_20_5', 'Heading', '', 'fo:font-size="10.5pt"', ' style:display-name="Heading 5" style:default-outline-level="5"')
    . $para('Heading_20_6', 'Heading', '', 'fo:font-size="10.5pt"', ' style:display-name="Heading 6" style:default-outline-level="6"')
    . $para('Title', 'Standard', 'fo:margin-top="7cm" fo:margin-bottom="0.4cm" fo:text-align="center"',
        'fo:font-size="34pt" fo:font-weight="bold" fo:color="#1e3a8a"', ' style:class="chapter"')
    . $para('Subtitle', 'Standard', 'fo:margin-bottom="0.3cm" fo:text-align="center"', 'fo:font-size="15pt" fo:color="#475569"')
    . $para('List_20_Contents', 'Text_20_body', 'fo:margin-bottom="0.1cm"', '', ' style:display-name="List Contents"')
    . $para('Table_20_Contents', 'Standard', 'fo:margin-top="0.04cm" fo:margin-bottom="0.04cm"', 'fo:font-size="9.5pt"',
        ' style:display-name="Table Contents"')
    . $para('Table_20_Heading', 'Table_20_Contents', '', 'fo:font-weight="bold"', ' style:display-name="Table Heading"')
    . $para('Quotations', 'Text_20_body', 'fo:margin-left="0.8cm" fo:border-left="2pt solid #94a3b8" fo:padding-left="0.3cm"',
        'fo:font-style="italic" fo:color="#475569"')
    . $para('Contents_20_Heading', 'Heading', 'fo:margin-top="0cm" fo:break-before="page"', 'fo:font-size="22pt"',
        ' style:display-name="Contents Heading"')
    . $para('Contents_20_1', 'Standard', 'fo:margin-top="0.25cm" fo:margin-bottom="0.05cm"', 'fo:font-weight="bold"',
        ' style:display-name="Contents 1"')
    . $para('Contents_20_2', 'Standard', 'fo:margin-left="0.6cm" fo:margin-bottom="0.03cm"', '', ' style:display-name="Contents 2"')
    . $para('Contents_20_3', 'Standard', 'fo:margin-left="1.2cm" fo:margin-bottom="0.02cm"', 'fo:font-size="9.5pt"',
        ' style:display-name="Contents 3"')
    . $para('Footer', 'Standard', 'fo:text-align="center"', 'fo:font-size="9pt" fo:color="#64748b"')
    . '<style:style style:name="Strong" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>'
    . '<style:style style:name="Emphasis" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>'
    . '<style:style style:name="Source_20_Text" style:family="text" style:display-name="Source Text">'
    . '<style:text-properties style:font-name="Liberation Mono" fo:font-size="9.5pt" fo:background-color="#f1f5f9"/></style:style>'
    . '<style:style style:name="Mark" style:family="text"><style:text-properties fo:font-weight="bold"'
    . ' fo:background-color="#fff3a3"/></style:style>'
    . '<style:style style:name="Internet_20_link" style:family="text" style:display-name="Internet link">'
    . '<style:text-properties fo:color="#1d4ed8" style:text-underline-style="solid" style:text-underline-width="auto"'
    . ' style:text-underline-color="font-color"/></style:style>'
    . '<style:style style:name="Visited_20_Internet_20_Link" style:family="text" style:display-name="Visited Internet Link">'
    . '<style:text-properties fo:color="#1d4ed8" style:text-underline-style="solid" style:text-underline-width="auto"'
    . ' style:text-underline-color="font-color"/></style:style>'
    . '<style:style style:name="Index_20_Link" style:family="text" style:display-name="Index Link"/>'
    // a link to another place of the manual: coloured, not underlined, so a printed page stays quiet
    . '<style:style style:name="Internal_20_Link" style:family="text" style:display-name="Internal Link">'
    . '<style:text-properties fo:color="#1d4ed8"/></style:style>'
    . '<text:list-style style:name="LBul">' . $listLevels(false) . '</text:list-style>'
    . '<text:list-style style:name="LNum">' . $listLevels(true) . '</text:list-style>'
    . '</office:styles>'
    . '<office:automatic-styles>'
    . '<style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm"'
    . ' fo:margin-top="2cm" fo:margin-bottom="1.5cm" fo:margin-left="2cm" fo:margin-right="2cm"/>'
    . '<style:footer-style><style:header-footer-properties fo:min-height="0.6cm" fo:margin-top="0.4cm"/></style:footer-style>'
    . '</style:page-layout>'
    . '</office:automatic-styles>'
    . '<office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1">'
    . '<style:footer><text:p text:style-name="Footer">Segreteria Campo — Guida · pagina <text:page-number text:select-page="current">1'
    . '</text:page-number></text:p></style:footer></style:master-page></office:master-styles>'
    . '</office:document-styles>';

$meta = '<?xml version="1.0" encoding="UTF-8"?>'
    . '<office:document-meta ' . $NS . ' office:version="1.2"><office:meta>'
    . '<meta:generator>docs/build-manual.php</meta:generator><dc:title>Segreteria Campo — Guida</dc:title>'
    . '<dc:language>' . e($lang) . '</dc:language><meta:creation-date>' . gmdate('Y-m-d\TH:i:s') . '</meta:creation-date>'
    . '</office:meta></office:document-meta>';

$manifestXml = '<?xml version="1.0" encoding="UTF-8"?>'
    . '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">'
    . '<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>'
    . '<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>'
    . '<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'
    . '<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>'
    . '</manifest:manifest>';

// every part must be well-formed XML before it goes into the archive
foreach (['content.xml' => $content, 'styles.xml' => $styles, 'meta.xml' => $meta, 'manifest.xml' => $manifestXml] as $name => $xml) {
    $dom = new DOMDocument();
    libxml_use_internal_errors(true);
    if (!$dom->loadXML($xml)) {
        $err = libxml_get_last_error();
        fwrite(STDERR, "XML non valido in $name: " . ($err ? trim($err->message) . ' (riga ' . $err->line . ')' : '') . "\n");
        exit(2);
    }
    libxml_clear_errors();
}

if (!is_dir(dirname($out))) {
    mkdir(dirname($out), 0777, true);
}
if (is_file($out)) {
    unlink($out);
}
$zip = new ZipArchive();
if ($zip->open($out, ZipArchive::CREATE) !== true) {
    fwrite(STDERR, "Impossibile scrivere $out\n");
    exit(2);
}
$zip->addFromString('mimetype', 'application/vnd.oasis.opendocument.text');
$zip->setCompressionName('mimetype', ZipArchive::CM_STORE);   // the mimetype entry must be stored, first
$zip->addFromString('content.xml', $content);
$zip->addFromString('styles.xml', $styles);
$zip->addFromString('meta.xml', $meta);
$zip->addFromString('META-INF/manifest.xml', $manifestXml);
$zip->close();

printf("Scritto %s (%d guide, %d tabelle, %d voci d'indice, %d KB)\n", $out, count($docs) + ($rootDoc ? 1 : 0),
    $tableCount, count($outline), (int)round(filesize($out) / 1024));

/* =========================
   optional: page numbers in the index, through LibreOffice
   ========================= */

$indexFailed = false;
if (isset($opts['update-index'])) {
    $py = getenv('LIBREOFFICE_PYTHON') ?: 'C:\\Program Files\\LibreOffice\\program\\python.exe';
    $helper = __DIR__ . '/odt-update-index.py';
    if (!is_file($py) || !is_file($helper)) {
        $indexFailed = true;
        fwrite(STDERR, "Indici non aggiornati: serve LibreOffice (variabile LIBREOFFICE_PYTHON) e docs/odt-update-index.py.\n"
            . "Apri il file in LibreOffice e usa Strumenti > Aggiorna > Tutti gli indici.\n");
    } else {
        $tmp = $out . '.tmp.odt';
        $cmd = escapeshellarg($py) . ' ' . escapeshellarg($helper) . ' ' . escapeshellarg($out) . ' ' . escapeshellarg($tmp);
        exec($cmd . ' 2>&1', $lines, $code);
        echo implode("\n", $lines) . "\n";
        if ($code === 0 && is_file($tmp)) {
            rename($tmp, $out);
            echo "Indice aggiornato con i numeri di pagina.\n";
        } else {
            @unlink($tmp);
            $indexFailed = true;
            fwrite(STDERR, "Aggiornamento dell'indice non riuscito (codice $code).\n");
        }
    }
}

if ($marks > 0) {
    echo "Attenzione: $marks [DA VERIFICARE] nel testo.\n";
}
foreach (array_unique($warnings) as $w) {
    echo "AVVISO  $w\n";
}
exit($indexFailed ? 3 : ($warnings ? 1 : 0));
