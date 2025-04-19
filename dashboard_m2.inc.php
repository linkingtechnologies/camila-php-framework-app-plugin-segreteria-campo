<?php
/*  This File is part of Camila PHP Framework
    Copyright (C) 2006-2025 Umberto Bresciani

    Camila PHP Framework is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Camila PHP Framework is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have rece0ived a copy of the GNU General Public License
    along with Camila PHP Framework. If not, see <http://www.gnu.org/licenses/>. */

$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$sSheet = $camilaWT->getWorktableSheetId('SERVIZI');

$camilaUI->openBox();
$camilaUI->insertTitle('Evento', 'cog');
	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row">'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
$camilaUI->insertButton('?dashboard=05', 'Informazioni intervento','calendar');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
$camilaUI->insertButton('cf_worktable'.$sSheet.'.php', 'Elenco servizi', 'list');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
$camilaUI->insertButton('?dashboard=06', 'Carica loghi','upload');
$camilaUI->insertButton('?dashboard=iw', 'Dati esempio','upload');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div><br/>'));


$camilaUI->insertTitle('Server', 'hdd');

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row">'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
$camilaUI->insertButton('?dashboard=00', camila_get_translation('camila.serveraddress'),'globe');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
$camilaUI->insertButton('?dashboard=30', 'Backup schede dati','download');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
$camilaUI->insertButton('?dashboard=31', 'Backup applicazione','download');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$camilaUI->closeBox();


?>