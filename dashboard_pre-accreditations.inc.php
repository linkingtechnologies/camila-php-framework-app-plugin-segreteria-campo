<?php
// Landing page of the PREACCREDITAMENTI tab.
//
// The tab used to open straight onto the volunteers pivot, which left the other
// three views reachable only from the in-page menu section - and not at all from
// the summary SPA, which renders inside #app and does not print that menu.
//
// Modulistica (PDF) and the raw lists are NOT duplicated here: they are built
// per shift from a DISTINCT query in pre-accreditations.inc.php, and they live
// on the pivot pages where that query already runs.

$camilaUI = new CamilaUserInterface();

// First box of the page: welds to the tab bar (see .spa-title-box in
// dashboard.css). sc-home: tonal styling for the secondary buttons.
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="box spa-title-box sc-home">'));
$camilaUI->insertTitle('Preaccreditamenti', 'calendar-event');

$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI) {
	switch ($colIndex) {
		case 0:
			// The summary answers "how many do I expect, how many arrived" and is
			// the only view that compares pre-accreditations with actual arrivals.
			// Also reachable from the home button in "Accreditamento risorse".
			$camilaUI->insertButton('?dashboard=pre-accreditations-summary', 'Riepilogo preaccreditamenti', 'calendar-event');
			break;
		case 1:
			// Pivot organizzazione x turno: who does what, and when.
			$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-by-service', 'Volontari per turno', 'user');
			$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-vehicles-by-service', 'Mezzi per turno', 'truck');
			break;
		case 2:
			$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-by-overnight-stay', 'Pernottamenti per turno', 'moon');
			break;
	}
});
$camilaUI->closeBox();
