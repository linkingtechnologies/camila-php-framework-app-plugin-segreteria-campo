<?php
$resourceType='MATERIALE';
$serviceColumn = 'SERVIZIO';
$groupColumn = 'ORGANIZZAZIONE';
$resourceTable = 'MATERIALI ATTESI';
$serviceTable = 'SERVIZI';
$brogliaccio = '';
$col1='TIPOLOGIA';
$col2='CODICE INVENTARIO';
$serviceEndServiceValue = "";

$titleText = 'Pianificazione ' . ucwords(strtolower($resourceTable));
$titleIcon = 'wrench';

require_once('plugins/'.basename(dirname(__FILE__)).'/resource_mover.inc.php');
?>