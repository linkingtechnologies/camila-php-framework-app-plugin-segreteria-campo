<?php
/*  This File is part of Camila PHP Framework
    Copyright (C) 2006-2026 Umberto Bresciani

    Camila PHP Framework is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Camila PHP Framework is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Camila PHP Framework. If not, see <http://www.gnu.org/licenses/>. */

$camilaUI = new CamilaUserInterface();

$_CAMILA['page']->camila_export_enabled = false;

$_isTotemUser = strncasecmp($_CAMILA['user'] ?? '', 'totem', 5) === 0;
$_menuXml = CAMILA_HOMEDIR.'/plugins/'.basename(dirname(__FILE__)).'/conf/menu.xml';
$_pluginBase = 'plugins/'.basename(dirname(__FILE__));

if (isset($_REQUEST['dashboard'])) {
	if (!$_isTotemUser)
		$currentTab = $camilaUI->printHomeMenu($_menuXml);
    require($_pluginBase . '/dashboard_' . $_REQUEST['dashboard'] . '.inc.php');
} else {
	$defaultId = 'm0';
	if (!$_isTotemUser)
		$currentTab = $camilaUI->printHomeMenu($_menuXml, $defaultId);
	require($_pluginBase . '/dashboard_' . $defaultId . '.inc.php');
}

?>