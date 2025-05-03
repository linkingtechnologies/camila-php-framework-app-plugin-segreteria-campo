<?php

$resourceType='MEZZO';
$serviceColumn = 'SERVIZIO';
$groupColumn = 'ORGANIZZAZIONE';
$resourceTable = 'MEZZI';
$serviceTable = 'SERVIZI';
$brogliaccio = 'MOV. RISORSE';
$col1='MARCA';
$col2='TARGA';
$col3='MODELLO';

$serviceEndServiceValue = "USCITA DEFINITIVA";

$titleText = 'Movimentazione ' . ucwords(strtolower($resourceTable));
$titleIcon = 'plane';

require_once('plugins/'.basename(dirname(__FILE__)).'/resource_mover.inc.php');

?>