<?php
$camilaUI = new CamilaUserInterface();
$dir = __DIR__;
$pluginName = basename($dir);

$camilaUI->mountMiniApp($pluginName, '/app-warehouse-manager.js', '/app.css');
