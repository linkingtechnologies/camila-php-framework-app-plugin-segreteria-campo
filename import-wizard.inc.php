<?php
global $_CAMILA;

$camilaUI = new CamilaUserInterface();
$scheme   = $camilaUI->isHttps() ? 'https' : 'http';
$host     = $_SERVER['HTTP_HOST'];
$config   = [
    'baseUrl'           => $scheme . '://' . $host . '/app/' . CAMILA_APP_DIR . '/cf_api.php',
    'apiKeyHeaderName'  => 'Authorization',
    'apiKeyHeaderValue' => 'PHPSESSID',
];

// Legge il file lang del plugin e torna un array chiave => valore
function sc_iw_load_lang(string $langDir, string $lang): array {
    $file = $langDir . '/' . $lang . '.lang.php';
    if (!is_file($file)) {
        $file = $langDir . '/it.lang.php';
    }
    if (!is_file($file)) {
        return [];
    }
    $map = [];
    foreach (file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (ltrim($line)[0] === '/') continue;
        $parts = explode(' = ', $line, 2);
        if (count($parts) === 2) {
            $map[trim($parts[0])] = trim($parts[1]);
        }
    }
    return $map;
}

$pluginLang = sc_iw_load_lang(__DIR__ . '/lang', $_CAMILA['lang'] ?? 'it');

$iwI18N = [
    'iw.title'         => $pluginLang['camila.iw.title']         ?? '',
    'iw.loading'       => $pluginLang['camila.iw.loading']       ?? '',
    'iw.error'         => $pluginLang['camila.iw.error']         ?? '',
    'iw.error.load'    => $pluginLang['camila.iw.error.load']    ?? '',
    'iw.error.unknown' => $pluginLang['camila.iw.error.unknown'] ?? '',
    'iw.empty'         => $pluginLang['camila.iw.empty']         ?? '',
    'iw.col.sheet'     => $pluginLang['camila.iw.col.sheet']     ?? '',
    'iw.col.file'      => $pluginLang['camila.iw.col.file']      ?? '',
    'iw.col.status'    => $pluginLang['camila.iw.col.status']    ?? '',
    'iw.btn.import'    => $pluginLang['camila.iw.btn.import']    ?? '',
    'iw.imported'      => $pluginLang['camila.iw.imported']      ?? '',
    'iw.records'       => $pluginLang['camila.iw.records']       ?? '',
    'iw.warn.nonempty' => $pluginLang['camila.iw.warn.nonempty'] ?? '',
];

$refrCode  = "<script src='../../camila/js/worktable-client.js'></script>";
$refrCode .= "<script>window.APP_CONFIG = " . json_encode($config,  JSON_UNESCAPED_SLASHES) . "</script>";
$refrCode .= "<script>window.I18N = "       . json_encode($iwI18N, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "</script>";
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, $refrCode));

$html = <<<HTML
<div id="app"></div>
<script nomodule>
  document.body.innerHTML = `
    <section class="section"><div class="container">
      <article class="message is-danger">
        <div class="message-header"><p>Browser non supportato</p></div>
        <div class="message-body">
          Questa applicazione richiede un browser moderno.<br>
          Usa <strong>Chrome</strong> o <strong>Edge</strong> aggiornati.
        </div>
      </article>
    </div></section>`;
</script>
HTML;

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, $html));
$_CAMILA['page']->camila_add_js("<link href=\"plugins/segreteria-campo/app.css\" rel=\"stylesheet\">\n");
$_CAMILA['page']->camila_add_js('<script type="module" src="./plugins/segreteria-campo/app-import-wizard.js"></script>');
?>
