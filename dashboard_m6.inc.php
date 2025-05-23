<?php
/*  This File is part of Camila PHP Framework
    Copyright (C) 2006-2025 Umberto Bresciani

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


$includeMov = false;
$includeLast = true;
$includeAll = false;
if (isset($_GET['t']) && $_GET['t'] == 'all') {
	$includeLast = false;
	$includeAll = true;
	$includeMov = true;
}
if (isset($_GET['t']) && $_GET['t'] == 'partial') {
	$includeLast = false;
	$includeAll = true;
	$includeMov = false;
}

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
	$fin[$key] = '[Sala radio] Da "' . $f[2] . '" a "'.$f[3] . '": "' . $f[4] . '"';
	$result->MoveNext();
}

ksort($fin);

if ($includeMov) {
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
}

$camilaUI->openBox();
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-8 column is-12-mobile is-8-desktop">'));

if ($includeLast) {
	$lNum = 20;
	$camilaUI->insertTitle('Ultime '.$lNum.' attività registrate','list-alt');
	$latest = array_slice($fin, -$lNum);
	krsort($latest);
	
	$last = '';

	if (!empty($latest)) {
		$t = new CHAW_table();

		foreach ($latest as $key => $val) {
			$r = new CHAW_row();
			 
			$currDT = new DateTime(substr($key,0,19));
			$curr = $currDT->format('d/m/Y');

			if ($curr != $last) {
				if ($last!='') {
					$r2 = new CHAW_row();
					$r2->add_column(new CHAW_text(''));
					$r2->add_column(new CHAW_text(''));
					$r2->add_column(new CHAW_text(''));
					$t->add_row($r2);					
				}				
				$r3 = new CHAW_row();
				$r3->add_column(new CHAW_text(''));
				$r3->add_column(new CHAW_text(''));
				$r3->add_column(new CHAW_text('Giornata ' . $curr, HAW_TEXTFORMAT_BOLD));
				$t->add_row($r3);
			}

			$dateTime = new DateTime(substr($key,0,19));			
			$r->add_column(new CHAW_text($dateTime->format('d/m/Y H:i:s')));			
			$res = splitMessage($val);
			$r->add_column(new CHAW_text($res[0]));
			$r->add_column(new CHAW_text($res[1]));
			$t->add_row($r);

			$last = $curr;
		}
		
		$_CAMILA['page']->add_table($t);
		
		$camilaUI->insertLineBreak();
		
		$camilaUI->insertButton('index.php?dashboard=m6&t=partial', 'Tutte le attività senza movimentazioni segreteria', 'list');
		$camilaUI->insertButton('index.php?dashboard=m6&t=all', 'Tutte le attività', 'list');
		
	} else {
		$camilaUI->insertWarning('Non ci sono ancora attività!');
	}
	
	$camilaUI->insertAutoRefresh(10000);
}

if ($includeAll) {
	$camilaUI->insertTitle('Tutte le attività','list-alt');

	if (!empty($fin)) {
		
		$last = '';

		foreach ($fin as $key => $val) {
			$currDT = new DateTime(substr($key,0,19));
			$curr = $currDT->format('d/m/Y');
			
			if ($curr != $last) {
				if ($last!='') {
					$text = new CHAW_text('');
					$text->set_br(2);
					$_CAMILA['page']->add_text($text);
				}
				$text = new CHAW_text('Giornata ' . $curr);
				$text->set_br(2);
				$_CAMILA['page']->add_text($text);
			}
			
			$dateTime = new DateTime(substr($key,0,19));
			$txt = $dateTime->format('d/m/Y H:i:s') . " $val\n";
			$text = new CHAW_text($txt);
			$text->set_br(0);
			$_CAMILA['page']->add_text($text);
			
			$last = $curr;
		}

	} else {
		$camilaUI->insertWarning('Non ci sono ancora attività!');
	}
}

function splitMessage($str) {
    if (preg_match('/\[(.*?)\]/', $str, $matches)) {
        $primaParte = $matches[1];        
        $secondaParte = preg_replace('/\[(.*?)\]/', '', $str);        
        $secondaParte = trim($secondaParte);
        return [$primaParte, $secondaParte];
    } else {
        return [null, $str];
    }
}

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));

$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4 column is-12-mobile is-4-desktop">'));
$camilaUI->insertTitle('Menu', 'list');
$camilaUI->insertButton('index.php?dashboard=m6&t=partial', 'Tutte le attività senza movimentazioni segreteria', 'list');
$camilaUI->insertButton('index.php?dashboard=m6&t=all', 'Tutte le attività', 'list');
$camilaUI->insertButton('cf_worktable'.$aSheet.'.php', 'Brogliaccio attività', 'list');
$camilaUI->insertButton('cf_worktable'.$cSheet.'.php', 'Comunicazioni radio', 'list');	
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
$camilaUI->closeBox();



?>