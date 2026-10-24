<?php
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$_isTotemUser = strncasecmp($_CAMILA['user'] ?? '', 'totem', 5) === 0;

if (!$_isTotemUser):

$vSheet = $camilaWT->getWorktableSheetId('VOLONTARI');
$mSheet = $camilaWT->getWorktableSheetId('MEZZI');
$aSheet = $camilaWT->getWorktableSheetId('MATERIALI');

$camilaUI = new CamilaUserInterface();
$dir = __DIR__;
$pluginName = basename($dir);
$camilaUI->mountMiniApp($pluginName, '/app-smart-assistant.js', '/app.css');

// Ordine dei box: prima l'operativita', che in evento si usa di continuo;
// l'amministrativa in fondo, perche' si tocca a ondate (arrivi e partenze).
// Il primo box porta spa-title-box: si salda alla tab bar (vedi dashboard.css).
// sc-home: stile tonale dei bottoni secondari.
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box spa-title-box sc-home">'));
$camilaUI->insertTitle('Operatività', 'run');
// Cosa si fa ogni giorno con chi e' gia' dentro.
$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertButton('?dashboard=requests-board', 'Richieste', 'login-box');
			break;
		case 1:
			$camilaUI->insertButton('?dashboard=resource-board', 'Movimentazione risorse', 'route');
			$camilaUI->insertButton('?dashboard=intervention-manager', 'Interventi', 'first-aid-kit');
			break;
		case 2:
			$camilaUI->insertButton('?dashboard=stock-manager', 'Movimentazione consumabili', 'inbox');
			break;
	}
});
$camilaUI->closeBox();

// Monitoraggio: guardare, non agire. Qui i bottoni sono tutti secondari.
// `org-status` sta qui e non in amministrativa: la sua spec dice che non fa
// create, update ne' delete — e' una dashboard di sola lettura.
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box sc-home">'));
$camilaUI->insertTitle('Monitoraggio', 'eye');
$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertSecondaryButton('?dashboard=comms-feed', 'Comunicazioni live', 'signal-tower');
			$camilaUI->insertSecondaryButton('?dashboard=map-center', 'Mappe', 'map-2');
			break;
		case 1:
			$camilaUI->insertSecondaryButton('?dashboard=m1', 'Report situazione attuale', 'dashboard');
			break;
		case 2:
			$camilaUI->insertSecondaryButton('?dashboard=m1&report=02_Finale', 'Report situazione complessiva', 'dashboard');
			break;
	}
});
$camilaUI->closeBox();

// Accreditamento: i momenti legati all'arrivo e alla partenza di
// un'organizzazione. Episodici, quindi in fondo al flusso operativo.
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box sc-home">'));
$camilaUI->insertTitle('Accreditamento risorse', 'clipboard');
$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertButton('?dashboard=massive-check-in', 'Check-in massivo', 'login-box');
			break;
		case 1:
			$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-summary', 'Riepilogo preaccreditamenti', 'calendar-event');
			$camilaUI->insertSecondaryButton('?dashboard=org-status', 'Stato registrazione', 'file-list-3');
			break;
		case 2:
			$camilaUI->insertButton('?dashboard=massive-check-out', 'Check-out massivo', 'logout-box');
			break;
	}
});
$camilaUI->closeBox();

// Anagrafiche: dati di riferimento, si impostano a inizio evento e si
// ritoccano di rado. Le etichette sono sostantivi semplici: il titolo del box
// dice gia' che sono anagrafiche.
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box sc-home">'));
$camilaUI->insertTitle('Anagrafiche', 'book-2');
$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertButton('?dashboard=service-manager', 'Servizi', 'pushpin');
			break;
		case 1:
			$camilaUI->insertButton('?dashboard=warehouse-manager', 'Magazzini', 'home-gear');
			break;
		case 2:
			$camilaUI->insertButton('?dashboard=team-manager', 'Squadre dichiarate', 'group');
			break;
	}
});
$camilaUI->closeBox();

// sc-home-quiet: bottoni secondari in grigio tenue (vedi dashboard.css)
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box sc-home-quiet">'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Volontari', 'user');
$camilaUI->insertSecondaryButton('?dashboard=resource-manager&tab=volontari', 'Database volontari', 'database-2');
$camilaUI->insertSecondaryButton('cf_worktable'.$vSheet.'.php?camila_update=new', 'Registrazione volontario', 'plus');
$camilaUI->insertSecondaryButton('?dashboard=02', 'Movimentazione volontari', 'random');
$camilaUI->insertSecondaryButton('cf_worktable'.$vSheet.'.php', 'Elenco volontari', 'list');
$camilaUI->insertSecondaryButton('?dashboard=27', 'Attestati', 'duplicate');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Mezzi', 'plane');
$camilaUI->insertSecondaryButton('?dashboard=resource-manager&tab=mezzi', 'Database mezzi', 'database-2');
$camilaUI->insertSecondaryButton('cf_worktable'.$mSheet.'.php?camila_update=new', 'Registrazione mezzo', 'plus');
$camilaUI->insertSecondaryButton('?dashboard=04', 'Movimentazione mezzi', 'random');
$camilaUI->insertSecondaryButton('cf_worktable'.$mSheet.'.php', 'Elenco mezzi', 'list');
$camilaUI->insertSecondaryButton('?dashboard=28', 'Attestati', 'duplicate');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Materiali', 'wrench');
$camilaUI->insertSecondaryButton('?dashboard=resource-manager&tab=materiali', 'Database materiali', 'database-2');
$camilaUI->insertSecondaryButton('cf_worktable'.$aSheet.'.php?camila_update=new', 'Registrazione materiale', 'plus');
$camilaUI->insertSecondaryButton('?dashboard=03', 'Movimentazione materiali', 'random');
$camilaUI->insertSecondaryButton('cf_worktable'.$aSheet.'.php', 'Elenco materiali', 'list');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
//$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$camilaUI->closeBox();

else:

$camilaUI = new CamilaUserInterface();
$camilaUI->openBox();
$camilaUI->insertTitle('Check-in, Check-out e Stato registrazione', 'login-box');


$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertButton('?dashboard=massive-check-in&totem=1', 'Check-in massivo Organizzazione', 'login-box');
			break;
		case 1:
			$camilaUI->insertButton('?dashboard=org-status&totem=1', 'Stato registrazione Organizzazione', 'file-list-3');
			break;
		case 2:
			$camilaUI->insertButton('?dashboard=massive-check-out&totem=1', 'Check-out massivo Organizzazione', 'logout-box');
			break;
	}
});

$camilaUI->closeBox();

endif;

?>