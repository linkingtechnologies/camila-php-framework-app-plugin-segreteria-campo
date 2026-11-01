<?php
declare(strict_types=1);

/*
 * One command for the guide: check the Markdown, then build the .odt.
 *
 *   php docs/build-guide.php             draft: the check lets [DA VERIFICARE] pass, no page numbers
 *   php docs/build-guide.php --release   release: [DA VERIFICARE] and any warning stop the build,
 *                                        and LibreOffice puts the page numbers in the index
 *
 * Other options go to docs/build-manual.php: --lang=it  --out=path.odt  --toc-depth=2
 * --update-index (a draft with page numbers), and --force to build even if the check fails.
 *
 * 1. docs/check-guides.php  every bold label is in the code, the links and the pages exist,
 *                           the wizards have all their steps; it stops here if something is wrong.
 * 2. docs/build-manual.php  writes docs/<lang>/manual.odt from docs/guide/guide.json and the Markdown.
 *
 * The .odt is a derived file: do not edit it, regenerate it. Only .odt is produced.
 *
 * Exit code: 0 = the .odt was built (and, in a release, it is clean), 1 = not built or not clean.
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

$opts = getopt('', ['release', 'lang::', 'out::', 'toc-depth::', 'update-index', 'force', 'help']);
if (isset($opts['help'])) {
    echo "php docs/build-guide.php [--release] [--lang=it] [--out=path.odt] [--toc-depth=2] [--update-index] [--force]\n";
    exit(0);
}
$release = isset($opts['release']);
$force = isset($opts['force']);

/** @return array{0:int,1:string[]} exit code and output lines of a PHP script next to this one */
function runScript(string $script, array $args): array
{
    $cmd = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/' . $script);
    foreach ($args as $a) {
        $cmd .= ' ' . escapeshellarg($a);
    }
    exec($cmd . ' 2>&1', $lines, $code);
    return [$code, $lines];
}

/* 1. check */
echo "1/2  Controllo delle guide" . ($release ? " (release: nessun [DA VERIFICARE])" : "") . "\n";
[$code, $lines] = runScript('check-guides.php', $release ? [] : ['--allow-markers']);
if ($code !== 0) {
    // only the lines that say what is wrong, each under the guide it belongs to
    $header = '';
    foreach ($lines as $l) {
        if (preg_match('/^\[/', $l)) {
            $header = $l;
        } elseif (preg_match('/^\s+(NON TROVATA|LINK|MANCA|ID DOPPIO|PASSO|PAGINA|TRADUZIONE|DA RISOLVERE)\b/', $l)) {
            if ($header !== '') {
                echo "  $header\n";
                $header = '';
            }
            echo "  $l\n";
        }
    }
    echo $force
        ? "     Il controllo non e' superato: si prosegue per --force.\n"
        : "     Il controllo non e' superato: l'.odt non e' stato generato.\n";
    if (!$force) {
        exit(1);
    }
} else {
    foreach ($lines as $l) {
        if (preg_match('/^(Nessuna incoerenza|Da guardare|\[DA VERIFICARE\]|SPA senza guida|Dashboard raggiungibili)/', $l)) {
            echo "     $l\n";
        }
    }
}

/* 2. build */
echo "2/2  Generazione dell'.odt\n";
$args = [];
foreach (['lang', 'out', 'toc-depth'] as $k) {
    if (isset($opts[$k]) && $opts[$k] !== false) {
        $args[] = "--$k=" . $opts[$k];
    }
}
if ($release || isset($opts['update-index'])) {
    $args[] = '--update-index';
}
[$code, $lines] = runScript('build-manual.php', $args);
foreach ($lines as $l) {
    echo "     $l\n";
}

if ($code === 3) {
    echo "Fatto, ma l'indice non ha i numeri di pagina: serve LibreOffice (vedi docs/build-manual.php).\n";
} elseif ($code === 1) {
    echo "Fatto, con avvisi (collegamenti non risolti).\n";
} elseif ($code !== 0) {
    echo "Generazione non riuscita (codice $code).\n";
} else {
    echo "Fatto.\n";
}
// a release must be clean: no warnings and the index complete
exit($code === 0 || (!$release && $code === 1) ? 0 : 1);
