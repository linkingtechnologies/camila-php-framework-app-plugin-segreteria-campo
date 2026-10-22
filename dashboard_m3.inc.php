<?php
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$vSheet = $camilaWT->getWorktableSheetId('VOLONTARI PREACCREDITATI');
$mSheet = $camilaWT->getWorktableSheetId('MEZZI PREACCREDITATI');
$aSheet = $camilaWT->getWorktableSheetId('MATERIALI PREACCREDITATI');

// primo box della pagina: attaccato alla tab bar (vedi .spa-title-box in dashboard.css)
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box spa-title-box">'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Volontari', 'user');
$camilaUI->insertButton('?dashboard=22', 'Assegnazione servizi', 'random');
$camilaUI->insertButton('cf_worktable'.$vSheet.'.php', 'Elenco volontari preaccreditati', 'list');
$camilaUI->insertButton('?dashboard=25', 'Moduli accreditamento', 'barcode');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Mezzi', 'plane');
$camilaUI->insertButton('?dashboard=24', 'Assegnazione mezzi', 'random');
$camilaUI->insertButton('cf_worktable'.$mSheet.'.php', 'Elenco materiali preaccreditati', 'list');
$camilaUI->insertButton('?dashboard=26', 'Moduli accreditamento', 'barcode');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Materiali', 'wrench');
$camilaUI->insertButton('?dashboard=23', 'Assegnazione servizi', 'random');
$camilaUI->insertButton('cf_worktable'.$aSheet.'.php', 'Elenco materiali preaccreditati', 'list');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
//$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$camilaUI->closeBox();


?>