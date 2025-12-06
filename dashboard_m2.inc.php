<?php
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$sSheet = $camilaWT->getWorktableSheetId('SERVIZI');

$camilaUI->openBox();
$camilaUI->insertTitle('Evento', 'cog');

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('?dashboard=05', 'Informazioni intervento','calendar');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('cf_worktable'.$sSheet.'.php', 'Elenco servizi', 'list');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('?dashboard=06', 'Carica loghi','upload');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div><br/>'));


$camilaUI->insertTitle('Server', 'hdd');

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('?dashboard=00', 'Info Server','globe');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('?dashboard=30', 'Backup schede dati','download');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('?dashboard=31', 'Backup applicazione','download');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$camilaUI->closeBox();
?>
