<?php
// Dashboard tab dispatch — delegated to the shared camila-core implementation
// so all plugins in this app get the same sanitized routing and cross-plugin
// "<plugin>--<dashboard>" namespacing. See camila/views/plugin_dashboards.inc.php.
$_camilaPluginDir = __DIR__;

// Stili comuni a ogni dashboard del plugin, SPA e pagine PHP (vedi dashboard.css).
// Va prima del dispatch: le dashboard iniziano a emettere markup appena incluse.
$_CAMILA['page']->camila_add_js(
    "<link href=\"plugins/" . basename(__DIR__) . "/dashboard.css\" rel=\"stylesheet\">\n"
);

require_once(CAMILA_DIR . '/views/plugin_dashboards.inc.php');
