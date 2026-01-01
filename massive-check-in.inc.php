<?php

/*$camilaAuth = new CamilaAuth();
$sessionId = $camilaAuth->getSessionId();*/

$scheme = is_https() ? 'https' : 'http';
$host = $_SERVER['HTTP_HOST'];
$dir = __DIR__;
$pluginName = basename($dir);

$config = [
    'baseUrl' => $scheme.'://'.$host.'/app/'.CAMILA_APP_DIR.'/cf_api.php'
];

global $_CAMILA;
$refrCode = "<script src='../../camila/js/worktable-client.js'></script>";
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, $refrCode));

$refrCode = "<script>window.APP_CONFIG = ".json_encode($config, JSON_UNESCAPED_SLASHES)."</script>";
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, $refrCode));


$html = <<<HTML
<style>
/* === Kiosk-friendly selected row (custom, no Bulma blue) === */
.table tr.row-selected td {
  background-color: rgba(72, 199, 116, 0.14); /* soft green */
  color: inherit;
}

/* Left accent bar for clear selection feedback */
.table tr.row-selected td:first-child {
  box-shadow: inset 6px 0 0 rgba(72, 199, 116, 0.55);
}

/* Softer hover to avoid contrast clash */
.table.is-hoverable tbody tr:hover td {
  background-color: rgba(0, 0, 0, 0.04);
}

/* Prevent text selection on touch screens */
.table td,
.table th {
  user-select: none;
}

tr.is-readonly {
  opacity: 0.75;
}
tr.is-readonly select,
tr.is-readonly input {
  cursor: not-allowed;
}


</style>
<section class="section">
  <div class="container">
    <div id="app">
	</div>
  </div>
</section>

<!-- Guard-rail: browser NON compatibili -->
<script nomodule>
  document.body.innerHTML = `
    <section class="section">
      <div class="container">
        <article class="message is-danger">
          <div class="message-header">
            <p>Browser non supportato</p>
          </div>
          <div class="message-body">
            Questa applicazione richiede un browser moderno.<br>
            Usa <strong>Chrome</strong> o <strong>Edge</strong> aggiornati
            (anche su mobile).
          </div>
        </article>
      </div>
    </section>
  `;
</script>

<!-- App -->
<script type="module" src="./plugins/segreteria-campo/app-massive-check-in.js"></script>
HTML;

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, $html));

function is_https(): bool
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }

    if (
        !empty($_SERVER['HTTP_X_FORWARDED_PROTO']) &&
        $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https'
    ) {
        return true;
    }

    if (
        !empty($_SERVER['HTTP_X_FORWARDED_SSL']) &&
        $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on'
    ) {
        return true;
    }

    return false;
}

?>