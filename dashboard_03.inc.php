<?php

$resourceType='MATERIALE';
$serviceColumn = 'SERVIZIO';
$groupColumn = 'ORGANIZZAZIONE';
$resourceTable = 'MATERIALI';
$serviceTable = 'SERVIZI';
$brogliaccio = 'MOV. RISORSE';
$col1='MATERIALE';
$col2='ATTREZZATURA';
$col3='MATRICOLA';
$serviceEndServiceValue = "USCITA DEFINITIVA";

$titleText = 'Movimentazione ' . ucwords(strtolower($resourceTable));
$titleIcon = 'wrench';

require_once('plugins/'.basename(dirname(__FILE__)).'/resource_mover.inc.php');
?>