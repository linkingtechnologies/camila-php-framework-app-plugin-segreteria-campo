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

require(CAMILA_LIB_DIR.'/fpdf/fpdf.php');

$fin = Array();


$query = 'SELECT MIN(${VOLONTARI.DATA/ORA REGISTRAZIONE}) FROM ${VOLONTARI}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'vp';
	$fin[$key] = 'Registrazione primo volontario';
	$result->MoveNext();
}

$query = 'SELECT MAX(${VOLONTARI.DATA/ORA USCITA DEFINITIVA}) FROM ${VOLONTARI}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'vu';
	$fin[$key] = 'Ultima uscita volontari';
	$result->MoveNext();
}

$query = 'SELECT ${BROGLIACCIO.DATA/ORA},ID,${BROGLIACCIO.DESCRIZIONE} FROM ${BROGLIACCIO} ORDER BY ${BROGLIACCIO.DATA/ORA}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'b';
	$fin[$key] = 'Brogliaccio: ' . $f[2];
	$result->MoveNext();
}

$query = 'SELECT ${COMUNICAZIONI RADIO.DATA/ORA},ID,${COMUNICAZIONI RADIO.MESSAGGIO} FROM ${COMUNICAZIONI RADIO} ORDER BY ${COMUNICAZIONI RADIO.DATA/ORA}';
$result = $camilaWT->startExecuteQuery($query);
$s = array();
while (!$result->EOF) {
	$f = $result->fields;
	$key = $f[0].'r';
	$fin[$key] = 'Com. radio: ' . $f[2];
	$result->MoveNext();
}

ksort($fin);
/*foreach ($fruits as $key => $val) {
    echo "$key = $val\n";
}*/

//print_r($fin);
$timestamp_inizio = strtotime(substr(array_key_first($fin),0,19));
$timestamp_fine = strtotime(substr(array_key_last($fin),0,19));

// Ciclo for per generare i timestamp distanziati di un'ora
for ($ts = $timestamp_inizio; $ts <= $timestamp_fine; $ts += 3600/2) {
    //echo date('Y-m-d H:i:s', $ts) . "\n";
	
	$subQuery = 'SELECT ${MOV. RISORSE.RISORSA} FROM ${MOV. RISORSE} WHERE ${MOV. RISORSE.TIPO RISORSA} = \'VOLONTARIO\' AND ${MOV. RISORSE.A} = \'USCITA DEFINITIVA\' AND ${MOV. RISORSE.DATA/ORA}<\''.date('Y-m-d H:i:s',$ts).'\'';

	$query = 'SELECT COUNT(DISTINCT ${MOV. RISORSE.RISORSA}) FROM ${MOV. RISORSE} WHERE ${MOV. RISORSE.TIPO RISORSA} = \'VOLONTARIO\' AND ${MOV. RISORSE.DA} = \'IN ATTESA DI SERVIZIO\' AND ${MOV. RISORSE.DATA/ORA}<\''.date('Y-m-d H:i:s',$ts).'\' and ${MOV. RISORSE.RISORSA} NOT IN ('.$subQuery.')';
	//echo $query;
	$result = $camilaWT->startExecuteQuery($query);
	$s = array();
	while (!$result->EOF) {
		$f = $result->fields;
		//echo date('Y-m-d H:i:s',$ts).': '.$f[0] . ' | ';
		$key = date('Y-m-d H:i:s',$ts).'v';
		$fin[$key] = 'Num. volontari: ' . $f[0];
		$result->MoveNext();
	}
	
}

ksort($fin);

foreach ($fin as $key => $val) {
    echo "$key = $val<br/>\n";
}




/*
foreach($data as $key => $val) {
	$final[']
}*/


class PDF extends FPDF {

	function Header()
	{
		$t = new CamilaTemplate('it');
		$this->SetFont('Arial','B',15);
		$this->Cell(0,10,'Intervento "' . $t->getParameters()['evento'] . '"',0,0,'C');
		$this->Ln(20);
	}

	function Footer()
	{
		$this->SetY(-15);
		$this->SetFont('Arial','I',8);
		$this->Cell(0,10,CAMILA_APPLICATION_NAME . ' - Report del '.date('m/d/Y') . ' ore ' . date('H:i').' - Pagina '.$this->PageNo(),0,0,'C');
	}

	function ImprovedTable2($obj, $data)
	{
		$this->Write(10,$obj->title);
		$w = array(90, 30);
		$this->Ln();
		$sum = $obj->sum;
		$total = 0;
		foreach($data as $k=>$v)
		{
			$this->Cell($w[0],6,$k,1);
			$this->Cell($w[1],6,$v,1,1);
			if ($sum != '')
			{
				$total += $v;
			}
		}

		if ($total>0) {
			$this->Cell($w[0],6,'',1);
			$this->Cell($w[1],6,$total,1,1);
		}	
	}

}

$camilaReport = new CamilaReport($_CAMILA['db']);
$reports = $camilaReport->loadXmlFromFile(CAMILA_HOMEDIR.'/plugins/'.basename(dirname(__FILE__)).'/conf/reports.xml');

if (isset($_REQUEST['gid'])) {
	foreach ($reports as $k => $v) {
		if ($_REQUEST['rid']== ($v->id)) {
			$query = $v->query;
			$data = $camilaReport->camilaWT->queryWorktableDatabase($query);

			foreach ($v->graphs as $k2 => $v2) {
				if ($_REQUEST['gid'] == $v2->graph->id) {
					if (count($data)>0)
						$camilaReport->createGraph($v2->graph->id, $v2->graph, $data);
				}
			}
		}
	}
	exit;
}


if (!isset($_REQUEST['export'])) {
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row">'));
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-9">'));
	
	$camilaUI->insertTitle('Situazione attuale', 'signal');
	
	foreach ($reports as $k => $v) {
		$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row">'));	
		$query = $v->query;
		$data = $camilaReport->camilaWT->queryWorktableDatabase($query);

		$arr = $v->graphs->graph;
		for ($i=0; $i<count($arr);$i++)
		{
			$v3 = $arr[$i];
			if ($v3->type == 'pie' || $v3->type == 'bar') {
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-8">'));
				$image1 = new HAW_image("?dashboard=m1&rid=".$v2->id.'&gid='.$v3->id, "?dashboard=m1&rid=".$v->id.'&gid='.$v3->id, ":-)");
				$image1->set_br(1);
				if (count($data)>0)
				{
					$_CAMILA['page']->add_image($image1);
				}
				else
				{
					$camilaUI->insertWarning($v3->title . ' - Nessun dato!');
				}
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
			}
			if ($v3->type == 'table') {
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-4">'));
				$myDiv = new HAW_raw(HAW_HTML, $camilaReport->createTable($v3->id, $v3, $data));
				$_CAMILA['page']->add_raw($myDiv);
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
			}
		}
		$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
		
		$camilaUI->insertDivider();
	}
	
	
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
	
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-3">'));
	$camilaUI->insertTitle('Menu', 'list');
	$camilaUI->insertButton('?dashboard=m1&export=pdf', 'Situazione attuale (PDF)', 'file');
	$camilaUI->insertButton('cf_worktable'.$aSheet.'.php', 'Brogliaccio attività', 'list');
	$camilaUI->insertButton('cf_worktable'.$rSheet.'.php', 'Report operativi', 'list');	
	$camilaUI->insertButton('cf_worktable'.$cSheet.'.php', 'Comunicazioni radio', 'list');	
	$camilaUI->insertButton('?dashboard=12', 'Mappa servizi', 'map-marker');
	$camilaUI->insertButton('?dashboard=12l', 'Mappa servizi (locale)', 'map-marker');
	$camilaUI->insertButton('?dashboard=01', 'Riepilogo ospiti e risorse', 'list-alt');
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
	
	$refrCode = "<script>function refreshPage() {window.location.reload();};setInterval(refreshPage, 30000);</script>";
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, $refrCode));

}
else
{
	/*ini_set('display_errors', 1);
	ini_set('display_startup_errors', 1);
	error_reporting(E_ALL);*/

	$pdf = new PDF();
	$pdf->SetFont('Arial','',10);	
	$pageAdded = false;

	foreach ($reports as $k => $v) {
		$query = $v->query;
		$data = $camilaReport->camilaWT->queryWorktableDatabase($query);

		$arr = $v->graphs->graph;
		for ($i=0; $i<count($arr);$i++)
		{
			$v3 = $arr[$i];
			if ($v3->type == 'pie' || $v3->type == 'bar') {
				
				if (count($data)>0) {
					$pdf->AddPage();
					$pageAdded = true;
					$f = CAMILA_TMP_DIR.'/g'.$v->id.'_'.$v3->id.'.png';
					$camilaReport->createGraph($v3->id, $v3, $data, $f);

					$pdf->Image($f,null,null,null,null,'PNG');
				}
			}
			if ($v3->type == 'table') {
				if (count($data)>0) {
					if (!$pageAdded) {
						$pdf->AddPage();
						$pageAdded = true;
					}
					$pdf->ImprovedTable2($v3,$data);
					$pdf->Ln();
				}
			}
		}
	}
	$date = $_CAMILA['db']->UserDate(date('Y-m-d'), camila_get_locale_date_adodb_format());
	$pdf->SetTitle('Report '.$date.'.pdf');
	$pdf->Output('I', 'Report '.$date.'.pdf');
	exit;
}

?>