<?php
$_isTotemUser = strncasecmp($_CAMILA['user'] ?? '', 'totem', 5) === 0;

if (!$_isTotemUser):


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
			$camilaUI->insertButton('?dashboard=intervention-manager', 'Gestione interventi', 'first-aid-kit');
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
			$camilaUI->insertSecondaryButton('?dashboard=m1', 'Report situazione attuale', 'dashboard');
			break;
		case 1:
			$camilaUI->insertSecondaryButton('?dashboard=comms-feed', 'Comunicazioni live', 'signal-tower');
			$camilaUI->insertSecondaryButton('?dashboard=map-center', 'Mappe', 'map-2');
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
			// Gli attestati si producono alla partenza: stanno con il check-out,
			// non nei box per tipo di risorsa. Fuori da quel contesto l'etichetta
			// "Attestati" da sola non direbbe di chi.
			$camilaUI->insertSecondaryButton('?dashboard=27', 'Attestati volontari', 'duplicate');
			$camilaUI->insertSecondaryButton('?dashboard=28', 'Attestati mezzi', 'duplicate');
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
			$camilaUI->insertButton('?dashboard=team-manager', 'Squadre dichiarate', 'group');
			break;
		case 1:
			// `resource-manager` lavora su db-volontari/db-mezzi/db-materiali,
			// cioe' l'anagrafica permanente: sta qui e non fra i pulsanti
			// operativi per tipo di risorsa, che agiscono sulle tabelle di
			// evento. L'etichetta tiene "Database" apposta: in questo box
			// "Volontari" si confonderebbe con i volontari in campo.
			$camilaUI->insertSecondaryButton('?dashboard=resource-manager&tab=volontari', 'Database volontari', 'database-2');
			$camilaUI->insertSecondaryButton('?dashboard=resource-manager&tab=mezzi', 'Database mezzi', 'database-2');
			$camilaUI->insertSecondaryButton('?dashboard=resource-manager&tab=materiali', 'Database materiali', 'database-2');
			break;
		case 2:
			$camilaUI->insertButton('?dashboard=service-manager', 'Servizi', 'pushpin');
			$camilaUI->insertButton('?dashboard=warehouse-manager', 'Magazzini', 'home-gear');
			break;
	}
});
$camilaUI->closeBox();

else:

// Totem/kiosk user: only the three SPAs that have a ?totem=1 mode, in the order
// of the arrival -> monitoring -> departure workflow. The tab bar is already
// suppressed for these users by the shared dispatcher (plugin_dashboards.inc.php).
$camilaUI = new CamilaUserInterface();
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box spa-title-box sc-home">'));
$camilaUI->insertTitle('Totem', 'qr-scan-2');
$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertButton('?dashboard=massive-check-in&totem=1', 'Check-in', 'login-box');
			break;
		case 1:
			$camilaUI->insertSecondaryButton('?dashboard=org-status&totem=1', 'Stato registrazione', 'file-list-3');
			break;
		case 2:
			$camilaUI->insertButton('?dashboard=massive-check-out&totem=1', 'Check-out', 'logout-box');
			break;
	}
});
$camilaUI->closeBox();

endif;

?>