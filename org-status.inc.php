<?php

/*$camilaAuth = new CamilaAuth();
$sessionId = $camilaAuth->getSessionId();*/

$camilaUI = new CamilaUserInterface();
$dir = __DIR__;
$pluginName = basename($dir);

$camilaUI->mountMiniApp($pluginName, '/app-org-status.js', '/app.css');
?>