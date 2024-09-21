<?php
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$lang = 'it';
$camilaTemplate = new CamilaTemplate($lang);
$params = $camilaTemplate->getParameters();

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
if (isset($params['chiave_mappa_google']) && $params['chiave_mappa_google'] != '') {
	$camilaUI->insertTitle('Mappe', 'globe');
}

$camilaUI->insertButton('?dashboard=12', 'Mappa servizi', 'map-marker');
if (isset($params['host_geotracker']) && $params['host_geotracker'] != '') {
	$camilaUI->insertButton('https://'.$params['host_geotracker'].'/app/geotracker/?dashboard=map', 'GeoTracker', 'map-marker', true, '', '_blank');
}
$camilaUI->insertButton('?dashboard=12l', 'Mappa servizi (locale)', 'map-marker');

$camilaUI->insertDivider();

if (isset($params['URL_geotracker']) && $params['URL_geotracker'] != '') {
	$camilaUI->insertText($params['URL_geotracker']);
	$camilaUI->insertDivider();
	$camilaUI->insertImage('../../lib/qrcode/image.php?msg='.urlencode($params['URL_geotracker']));
	$camilaUI->insertDivider();
	$camilaUI->insertSuccess('URL GeoTracker configurato!');	
} else {
	$camilaUI->insertWarning('URL GeoTracker non configurato!');
}

if (isset($params['chiave_mappa_google']) && $params['chiave_mappa_google'] != '') {
	$camilaUI->insertSuccess('Chiave per mappa Google configurata!');
} else {
	$camilaUI->insertWarning('Chiave per mappa Google non configurata!');
}

if (isset($params['host_geotracker']) && $params['host_geotracker'] != '') {
	$camilaUI->insertSuccess('Host GeoTracker configurato!');
} else {
	$camilaUI->insertWarning('Host GeoTracker non configurato!');
}

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));

?>