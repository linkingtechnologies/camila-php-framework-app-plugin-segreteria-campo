<?php

$resourceType='MATERIALE';
$serviceColumn = 'SERVIZIO';
$groupColumn = 'ORGANIZZAZIONE';
$resourceTable = 'MATERIALI';
$serviceTable = 'SERVIZI';
$brogliaccio = 'MOV. RISORSE';
$col1='TIPOLOGIA';
$col2='NOTE';
$col3='CODICE INVENTARIO';
$serviceEndServiceValue = "USCITA DEFINITIVA";

$titleText = 'Movimentazione ' . ucwords(strtolower($resourceTable));
$titleIcon = 'wrench';

require_once('plugins/'.basename(dirname(__FILE__)).'/resource_mover.inc.php');
?>