<?php
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$vSheet = $camilaWT->getWorktableSheetId('VOLONTARI');
$mSheet = $camilaWT->getWorktableSheetId('MEZZI');
$aSheet = $camilaWT->getWorktableSheetId('MATERIALI');

$camilaUI = new CamilaUserInterface();
$dir = __DIR__;
$pluginName = basename($dir);
$camilaUI->mountMiniApp($pluginName, '/app-smart-assistant.js', '/app.css');

$camilaUI->openBox();
$camilaUI->insertTitle('Gestione Organizzazioni (beta)', 'team');
$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertButton('?dashboard=massive-check-in', 'Check-in massivo', 'login-box');
			break;
		case 1:
			$camilaUI->insertButton('?dashboard=org-status', 'Stato registrazione', 'file-list-3');
			break;
		case 2:
			$camilaUI->insertButton('?dashboard=massive-check-out', 'Check-out massivo', 'logout-box');
			break;

	}
});
$camilaUI->closeBox();
$camilaUI->openBox();
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Volontari', 'user');
$camilaUI->insertButton('cf_worktable'.$vSheet.'.php?camila_update=new', 'Registrazione volontario', 'plus');
$camilaUI->insertButton('?dashboard=02', 'Movimentazione volontari', 'random');
$camilaUI->insertButton('cf_worktable'.$vSheet.'.php', 'Elenco volontari', 'list');
$camilaUI->insertButton('?dashboard=27', 'Attestati', 'duplicate');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Mezzi', 'plane');
$camilaUI->insertButton('?dashboard=massive-check-in', 'Check-in massivo (beta)', 'team');
$camilaUI->insertButton('cf_worktable'.$mSheet.'.php?camila_update=new', 'Registrazione mezzo', 'plus');
$camilaUI->insertButton('?dashboard=04', 'Movimentazione mezzi', 'random');
$camilaUI->insertButton('cf_worktable'.$mSheet.'.php', 'Elenco mezzi', 'list');
$camilaUI->insertButton('?dashboard=28', 'Attestati', 'duplicate');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Materiali', 'wrench');
$camilaUI->insertButton('cf_worktable'.$aSheet.'.php?camila_update=new', 'Registrazione materiale', 'plus');
$camilaUI->insertButton('?dashboard=03', 'Movimentazione materiali', 'random');
$camilaUI->insertButton('cf_worktable'.$aSheet.'.php', 'Elenco materiali', 'list');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
//$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$camilaUI->closeBox();

?>