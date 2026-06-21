<?php

$camilaUI = new CamilaUserInterface();
$dir = __DIR__;
$pluginName = basename($dir);

$camilaUI->mountMiniApp($pluginName, '/app-pre-accreditations-summary.js', '/app.css');
?>
