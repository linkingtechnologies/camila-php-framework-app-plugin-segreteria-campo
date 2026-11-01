<?php
declare(strict_types=1);

/*
 * Drift check for the Markdown guides (views/<spa>/guide.<lang>.md).
 *
 *   php docs/check-guides.php [--allow-markers]
 *
 * `--allow-markers` counts the [DA VERIFICARE] left in the text but does not treat them as
 * a problem: for a draft build. docs/build-guide.php --release runs it without.
 *
 * Read-only. By convention **bold** in a guide is text exactly as the interface
 * shows it, so each bold label must appear in the JS of that SPA (or in
 * views/shared). That is the check the old manual could not make: it sees the
 * buttons *inside* the SPAs, not only the ones on the home page.
 *
 * What it reports:
 *   - a guide listed in docs/guide/guide.json that does not exist (default language)
 *   - a **bold** label that is not in the SPA's code
 *   - a wizard without a section {#passo-N} for each of its steps
 *   - duplicate ids, broken in-page links and broken guide: links
 *   - a translation whose ids differ from the default language's
 *   - [DA VERIFICARE] left in the text
 * and, for information, the SPAs, and the dashboards reachable from a button or the
 * menu, that have no guide yet.
 *
 * A guide for a PHP dashboard without a SPA lives in views/dashboards/<id>/ (view
 * "dashboards/<id>" in the manifest). Its bold labels are looked for in
 * dashboard_<id>.inc.php and in the files of the entry's "source" (paths from the
 * plugin root, `*` allowed).
 *
 * Exit code: 0 = nothing to report, 1 = something to look at.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$plugin = dirname(__DIR__);
$manifestFile = "$plugin/docs/guide/guide.json";
$manifest = json_decode((string)@file_get_contents($manifestFile), true);
if (!is_array($manifest) || empty($manifest['guides'])) {
    fwrite(STDERR, "Indice non leggibile: $manifestFile\n");
    exit(2);
}
$default = $manifest['default'] ?? 'it';
$langs = $manifest['languages'] ?? [$default];

$problems = 0;
$allowMarkers = isset(getopt('', ['allow-markers'])['allow-markers']);
$markerCount = 0;
$line = str_repeat('-', 72);

function norm(string $s): string
{
    $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $s = str_replace(['’', "\xC2\xA0"], ["'", ' '], $s);
    return mb_strtolower(trim((string)preg_replace('/\s+/u', ' ', $s)), 'UTF-8');
}

/** @return array{ids: string[], links: string[], guideLinks: string[], bold: array<int,array{0:int,1:string}>, markers: int[]} */
function readGuide(string $file): array
{
    $ids = [];
    $links = [];
    $guideLinks = [];
    $bold = [];
    $markers = [];
    // Bold is looked for in a whole paragraph, because a label may wrap onto the
    // next line (the renderer joins the lines of a paragraph). A list item or a
    // table row starts a new one.
    $buf = '';
    $bufLine = 0;
    $flush = function () use (&$buf, &$bufLine, &$bold) {
        if ($buf !== '') {
            // `code` spans are not labels: drop them before looking for bold
            $plain = (string)preg_replace('/`[^`]*`/', '', $buf);
            if (preg_match_all('/\*\*(.+?)\*\*/u', $plain, $bm)) {
                foreach ($bm[1] as $label) {
                    $bold[] = [$bufLine, trim($label)];
                }
            }
        }
        $buf = '';
    };
    foreach (preg_split('/\R/u', (string)file_get_contents($file)) as $i => $l) {
        if (preg_match('/^(#{1,4})\s+(.*?)\s*(?:\{#([A-Za-z0-9_-]+)\})?\s*$/', $l, $m)) {
            $flush();
            $ids[] = $m[3] !== '' ? $m[3] : trim((string)preg_replace('/[^a-z0-9]+/', '-', strtolower($m[2])), '-');
            continue;
        }
        if (trim($l) === '') {
            $flush();
            continue;
        }
        if (str_contains($l, '[DA VERIFICARE')) {
            $markers[] = $i + 1;
        }
        if (preg_match('/^\s*(-|\d+\.)\s+/', $l) || str_starts_with(ltrim($l), '|') || str_starts_with($l, '>')) {
            $flush();
        }
        if ($buf === '') {
            $bufLine = $i + 1;
        }
        $buf .= ' ' . trim($l);
        if (preg_match_all('/\]\((#[A-Za-z0-9_-]+|guide:[^)\s]+)\)/', $l, $lm)) {
            foreach ($lm[1] as $target) {
                if (str_starts_with($target, '#')) {
                    $links[] = substr($target, 1);
                } else {
                    $guideLinks[] = substr($target, 6);
                }
            }
        }
    }
    $flush();
    return compact('ids', 'links', 'guideLinks', 'bold', 'markers');
}

/**
 * Normalised text of the SPA's JS (its own folder and views/shared). The `${...}` are
 * left in: many labels sit inside an expression, e.g. `${busy ? "..." : "Salva"}`.
 */
function jsText(string $plugin, string $view, array $entry = []): string
{
    $t = '';
    if (isset($entry['file'])) {
        // a chapter of the manual: it names buttons of the home page, menu tabs and whatever
        // the entry's "source" lists
        $files = [];
        foreach ($entry['source'] ?? [] as $pattern) {
            $files = array_merge($files, glob("$plugin/$pattern") ?: []);
        }
    } elseif (str_starts_with($view, 'dashboards/')) {
        // a PHP dashboard: its own file and whatever else draws what the page shows
        $files = glob("$plugin/dashboard_" . substr($view, 11) . ".inc.php") ?: [];
        foreach ($entry['source'] ?? [] as $pattern) {
            $files = array_merge($files, glob("$plugin/$pattern") ?: []);
        }
    } else {
        $files = array_merge(glob("$plugin/views/$view/*.js") ?: [], glob("$plugin/views/shared/*.js") ?: []);
    }
    foreach ($files as $f) {
        $t .= "\n" . file_get_contents($f);
    }
    return norm($t);
}

/** A label may contain the placeholder N, which in the code is an interpolation or a number. */
function labelRegex(string $label): string
{
    $label = rtrim(trim($label), '.:;,!?');
    $parts = preg_split('/\bN\b/u', $label);
    // spaces next to the placeholder matter ("applica a ${n}"), so the parts are not trimmed
    $keep = fn($p) => mb_strtolower(str_replace('’', "'", (string)preg_replace('/\s+/u', ' ', $p)), 'UTF-8');
    return '/' . implode('(?:\$\{[^}]*\}|\d+)', array_map(fn($p) => preg_quote($keep($p), '/'), $parts)) . '/u';
}

/**
 * Where an entry's guide lives: its "file" (the manual's chapters, `{lang}` replaced) or
 * views/<view>/guide.<lang>.md.
 */
function guideFile(string $plugin, array $g, string $lang): string
{
    return isset($g['file'])
        ? "$plugin/" . str_replace('{lang}', $lang, $g['file'])
        : "$plugin/views/{$g['view']}/guide.$lang.md";
}

$guideIds = [];       // view => ids of the default language, for guide: links
foreach ($manifest['guides'] as $g) {
    $f = guideFile($plugin, $g, $default);
    if (is_file($f)) {
        $guideIds[$g['view']] = readGuide($f)['ids'];
    }
}

echo "Guide (" . count($manifest['guides']) . " nell'indice, lingue: " . implode(', ', $langs) . ")\n$line\n";

foreach ($manifest['guides'] as $g) {
    $view = $g['view'];
    echo "[$view]\n";
    $defFile = guideFile($plugin, $g, $default);
    if (!is_file($defFile)) {
        echo "  MANCA        " . substr($defFile, strlen($plugin) + 1) . "\n";
        $problems++;
        continue;
    }
    $gd = readGuide($defFile);

    // the "Apri la pagina" button of the manual points at ?dashboard=<id>: the dashboard must exist
    // (same derivation as pageHref() in views/shared/guide.js; a "<plugin>--<id>" page is another plugin's)
    if (!isset($g['file']) && ($g['page'] ?? null) !== false) {
        $page = $g['page'] ?? (str_starts_with($view, 'dashboards/') ? substr($view, 11) : $view);
        if (!str_contains((string)$page, '--') && !is_file("$plugin/dashboard_$page.inc.php")) {
            echo "  PAGINA       ?dashboard=$page: manca dashboard_$page.inc.php\n";
            $problems++;
        }
    }

    // ids: unique, and one {#passo-N} per step of a wizard
    foreach (array_keys(array_filter(array_count_values($gd['ids']), fn($n) => $n > 1)) as $dup) {
        echo "  ID DOPPIO    $dup\n";
        $problems++;
    }
    $steps = isset($g['file']) ? 0 : count(glob("$plugin/views/$view/step*.js") ?: []);
    if ($steps > 0) {
        for ($n = 1; $n <= $steps; $n++) {
            if (!in_array("passo-$n", $gd['ids'], true)) {
                echo "  PASSO        manca la sezione {#passo-$n}\n";
                $problems++;
            }
        }
        foreach ($gd['ids'] as $id) {
            if (preg_match('/^passo-(\d+)$/', $id, $m) && (int)$m[1] > $steps) {
                echo "  PASSO        {#$id}: il wizard ha $steps passi\n";
                $problems++;
            }
        }
    }

    // bold labels against the code
    $js = jsText($plugin, $view, $g);
    $checked = 0;
    foreach ($gd['bold'] as [$ln, $label]) {
        $checked++;
        // literally first ("N. volontari" is a real label), then with N as a placeholder ("Applica a N")
        $literal = '/' . preg_quote(norm(rtrim(trim($label), '.:;,!?')), '/') . '/u';
        if (!preg_match($literal, $js) && !preg_match(labelRegex($label), $js)) {
            echo "  NON TROVATA  riga $ln: **$label**\n";
            $problems++;
        }
    }

    foreach ($gd['links'] as $id) {
        if (!in_array($id, $gd['ids'], true)) {
            echo "  LINK         #$id non esiste in questa guida\n";
            $problems++;
        }
    }
    foreach ($gd['guideLinks'] as $target) {
        [$tv, $tid] = array_pad(explode('#', $target, 2), 2, '');
        if (!isset($guideIds[$tv])) {
            echo "  LINK         guide:$target: la guida '$tv' non è nell'indice\n";
            $problems++;
        } elseif ($tid !== '' && !in_array($tid, $guideIds[$tv], true)) {
            echo "  LINK         guide:$target: l'id '$tid' non esiste\n";
            $problems++;
        }
    }
    foreach ($gd['markers'] as $ln) {
        $markerCount++;
        if ($allowMarkers) {
            echo "  segnaposto   riga $ln: [DA VERIFICARE] (ammesso)\n";
        } else {
            echo "  DA RISOLVERE riga $ln: [DA VERIFICARE]\n";
            $problems++;
        }
    }

    // translations: same ids as the default language
    foreach ($langs as $lang) {
        if ($lang === $default) {
            continue;
        }
        $tf = guideFile($plugin, $g, $lang);
        if (!is_file($tf)) {
            echo "  TRADUZIONE   manca " . basename($tf) . " (si usa $default)\n";
            continue;
        }
        $gt = readGuide($tf);
        foreach (array_diff($gd['ids'], $gt['ids']) as $id) {
            echo "  TRADUZIONE   $lang: manca {#$id}\n";
            $problems++;
        }
        foreach (array_diff($gt['ids'], $gd['ids']) as $id) {
            echo "  TRADUZIONE   $lang: {#$id} non esiste in $default\n";
            $problems++;
        }
    }

    printf("  %d sezioni, %d etichette controllate%s\n", count($gd['ids']), $checked, $steps ? ", $steps passi" : '');
}

// general guide per language
foreach ($langs as $lang) {
    $path = $manifest['general'][$lang] ?? null;
    if ($path === null || !is_file("$plugin/$path")) {
        echo "[generale]\n  " . ($lang === $default ? "MANCA        " : "TRADUZIONE   manca ") . "la guida generale ($lang)\n";
        if ($lang === $default) {
            $problems++;
        }
        continue;
    }
    $gg = readGuide("$plugin/$path");
    foreach ($gg['markers'] as $ln) {
        $markerCount++;
        if ($allowMarkers) {
            echo "[generale $lang]\n  segnaposto   riga $ln: [DA VERIFICARE] (ammesso)\n";
        } else {
            echo "[generale $lang]\n  DA RISOLVERE riga $ln: [DA VERIFICARE]\n";
            $problems++;
        }
    }
}

// SPAs with a views/ folder and no guide: information only
$listed = array_column($manifest['guides'], 'view');
$without = [];
foreach (glob("$plugin/views/*", GLOB_ONLYDIR) ?: [] as $d) {
    $v = basename($d);
    if ($v !== 'shared' && $v !== 'dashboards' && !in_array($v, $listed, true)) {
        $without[] = $v;
    }
}
echo "\nSPA senza guida (" . count($without) . "): " . ($without ? implode(', ', $without) : 'nessuna') . "\n";

// PHP dashboards reachable from a button or from the menu, with no guide: information only.
// A dashboard is covered by its own guide, by a SPA's guide or by a "dashboard" alias.
$covered = [];
foreach ($manifest['guides'] as $g) {
    $covered[] = $g['view'];
    if (!empty($g['dashboard'])) {
        $covered[] = $g['dashboard'];
    }
    if (str_starts_with($g['view'], 'dashboards/')) {
        $covered[] = substr($g['view'], 11);
    }
}
$reachable = [];
foreach (array_merge(glob("$plugin/dashboard_*.inc.php") ?: [], ["$plugin/conf/menu.xml"]) as $f) {
    if (preg_match_all('/dashboard=([A-Za-z0-9_-]+)/', (string)file_get_contents($f), $m)) {
        $reachable = array_merge($reachable, $m[1]);
    }
}
$bare = [];
foreach (array_unique($reachable) as $id) {
    // m0..m9 are the tab hubs, described by the general guide; "a--b" belongs to another plugin
    if (!in_array($id, $covered, true) && !preg_match('/^m[0-9]$/', $id) && !str_contains($id, '--')) {
        $bare[] = $id;
    }
}
sort($bare);
echo "Dashboard raggiungibili senza guida (" . count($bare) . "): " . ($bare ? implode(', ', $bare) : 'nessuna') . "\n";

echo "\n" . ($problems ? "Da guardare: $problems voci.\n" : "Nessuna incoerenza rilevata.\n");
if ($markerCount) {
    echo "[DA VERIFICARE] nel testo: $markerCount" . ($allowMarkers ? " (ammessi)" : "") . "\n";
}
exit($problems ? 1 : 0);
