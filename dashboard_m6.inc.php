<?php
/*  This File is part of Camila PHP Framework
    Copyright (C) 2006-2024 Umberto Bresciani

    Camila PHP Framework is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Camila PHP Framework is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Camila PHP Framework. If not, see <http://www.gnu.org/licenses/>. */


$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$rSheet = $camilaWT->getWorktableSheetId('REPORT');
$aSheet = $camilaWT->getWorktableSheetId('BROGLIACCIO');
$cSheet = $camilaWT->getWorktableSheetId('COMUNICAZIONI RADIO');

$fin = Array();

$query = 'SELECT MIN(${VOLONTARI.DATA/ORA REGISTRAZIONE}) FROM ${VOLONTARI}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
$noVols = true;
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'vp';
	if ($f[0]) {
		$fin[$key] = '[Segreteria] Registrazione primo volontario';
		$noVols = false;
	}
	$result->MoveNext();
}

$query = 'SELECT MAX(${VOLONTARI.DATA/ORA USCITA DEFINITIVA}) FROM ${VOLONTARI}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'vu';
	if ($f[0])
		$fin[$key] = '[Segreteria] Ultima uscita volontari';
	$result->MoveNext();
}

$query = 'SELECT ${BROGLIACCIO.DATA/ORA},ID,${BROGLIACCIO.DESCRIZIONE} FROM ${BROGLIACCIO} ORDER BY ${BROGLIACCIO.DATA/ORA}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'b';
	$fin[$key] = '[Segreteria] ' . $f[2];
	$result->MoveNext();
}

$query = 'SELECT ${COMUNICAZIONI RADIO.DATA/ORA},ID,${COMUNICAZIONI RADIO.CHIAMANTE},${COMUNICAZIONI RADIO.CHIAMATO},${COMUNICAZIONI RADIO.MESSAGGIO} FROM ${COMUNICAZIONI RADIO} ORDER BY ${COMUNICAZIONI RADIO.DATA/ORA}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'r';
	$fin[$key] = '[Com. radio] Da "' . $f[2] . '" a "'.$f[3] . '": "' . $f[4] . '"';
	$result->MoveNext();
}

ksort($fin);

$timestamp_inizio = strtotime(substr(array_key_first($fin),0,19));
$timestamp_fine = strtotime(substr(array_key_last($fin),0,19));

$last = '';
if (!$noVols) {
	for ($ts = $timestamp_inizio; $ts <= $timestamp_fine; $ts += 3600/2) {
		$subQuery = 'SELECT ${MOV. RISORSE.RISORSA} FROM ${MOV. RISORSE} WHERE ${MOV. RISORSE.TIPO RISORSA} = \'VOLONTARIO\' AND ${MOV. RISORSE.A} = \'USCITA DEFINITIVA\' AND ${MOV. RISORSE.DATA/ORA}<\''.date('Y-m-d H:i:s',$ts).'\'';
		$query = 'SELECT COUNT(DISTINCT ${MOV. RISORSE.RISORSA}) FROM ${MOV. RISORSE} WHERE ${MOV. RISORSE.TIPO RISORSA} = \'VOLONTARIO\' AND ${MOV. RISORSE.DA} = \'IN ATTESA DI SERVIZIO\' AND ${MOV. RISORSE.DATA/ORA}<\''.date('Y-m-d H:i:s',$ts).'\' and ${MOV. RISORSE.RISORSA} NOT IN ('.$subQuery.') ORDER BY ${MOV. RISORSE.DATA/ORA}';
		$result = $camilaWT->startExecuteQuery($query);
		$s = array();
		
		while (!$result->EOF) {
			$f = $result->fields;
			$key = date('Y-m-d H:i:s',$ts).'v';
			$text = '[Segreteria] Num. volontari: ' . $f[0];
			if ($last != $text) {
				$fin[$key] = $text;
				$last = $text;
			}
			$result->MoveNext();
		}
		
	}
}

ksort($fin);
$camilaUI->insertTitle('Ultime 20 attività','globe');

$latest = array_slice($fin, 0, 20);

if (!empty($latest)) {
	foreach ($latest as $key => $val) {
		$dateTime = new DateTime(substr($key,0,19));
		$txt = $dateTime->format('d/m/Y H:i:s') . " $val\n";
		$text = new CHAW_text($txt);
		$text->set_br(0);
		$_CAMILA['page']->add_text($text);   
	}
} else {
	$camilaUI->insertWarning('Non ci sono ancora attività!');
}

$camilaUI->insertTitle('Tutte le attività','globe');

if (!empty($fin)) {
	foreach ($fin as $key => $val) {
		$dateTime = new DateTime(substr($key,0,19));
		$txt = $dateTime->format('d/m/Y H:i:s') . " $val\n";
		$text = new CHAW_text($txt);
		$text->set_br(0);
		$_CAMILA['page']->add_text($text);   
	}
} else {
	$camilaUI->insertWarning('Non ci sono ancora attività!');
}
?>