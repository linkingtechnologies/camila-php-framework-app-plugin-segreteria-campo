<?php

$camilaUI->openBox();
$camilaUI->insertTitle(CAMILA_APPLICATION_NAME, 'question-sign');

$camilaUI->insertText('Versione del ' . date('d-m-Y', strtotime(CamilaPlugins::getRepositoryInformation(basename(dirname(__FILE__)))['pushed_at'])));

$camilaUI->insertLineBreak();
$camilaUI->insertLineBreak();

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('plugins/segreteria-campo/docs/it/html/manual.html', 'Manuale','globe');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertButton('?dashboard=iw', 'Importa dati esempio','upload');
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div><br/>'));

$camilaUI->insertDivider();

$camilaUI->insertText('Powered by Camila PHP Framework - Copyright (C) 2006-2025 Umberto Bresciani');
$camilaUI->insertText('Programma rilasciato sotto licenza GNU GPL');
//$camilaUI->insertButton('https://it.wikipedia.org/wiki/GNU_General_Public_License', 'Licenza d\'uso','globe');

$camilaUI->closeBox();

?>