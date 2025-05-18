<?php
$camilaUI->openBox();

$camilaUI->insertTitle('Verifica integrità dati', 'check');
//$camilaUI->insertDivider();

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row">'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));

$camilaUI->insertButton('?dashboard=ic1', 'Controllo dati','warning-sign');

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));


$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div><br/><br/><br/><br/><br/><br/>'));

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));

$camilaUI->closeBox();
?>