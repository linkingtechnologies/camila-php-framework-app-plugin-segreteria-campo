<?php
require_once(CAMILA_VENDOR_DIR.'tinybutstrong/tinybutstrong/tbs_class.php');
require_once(CAMILA_DIR.'tbs/plugins/tbsdb_jladodb.php');

$camilaWT = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$conn = $_CAMILA['db'];
global $conn;

$template = 'gmap';
if (isset($_GET['mt']) && $_GET['mt']=='osm') {
	$template = 'osm';
}

function drawMap($template) {
	global $_CAMILA;
	global $camilaWT;
	global $mapName;
	
	$resourceTable1='VOLONTARI';
	$resourceTable2='MEZZI';
	$serviceTable = 'SERVIZI';
	$serviceColumn = 'SERVIZIO';
	$groupColumn = 'ORGANIZZAZIONE';

	$wtId1 = $camilaWT->getWorktableSheetId($resourceTable1);

	$mapName = 'temp';
	
	$lang = 'it';
	$camilaTemplate = new CamilaTemplate($lang);
	$params = $camilaTemplate->getParameters();

	if ($mapName != '')
	{
		$sub1 = '(SELECT count(*) FROM  ${'.$resourceTable1.'} WHERE ${'.$resourceTable1.'.'.$serviceColumn.'} = ${'.$serviceTable.'.NOME}) as tot';
		$sub2 = '(SELECT count(*) FROM  ${'.$resourceTable2.'} WHERE ${'.$resourceTable2.'.'.$serviceColumn.'} = ${'.$serviceTable.'.NOME}) as tot2';
		$queryList = 'SELECT id, ${'.$serviceTable.'.COLORE} AS COLORE,${'.$serviceTable.'.COMUNE}, ${'.$serviceTable.'.LATITUDINE},${'.$serviceTable.'.LONGITUDINE},${'.$serviceTable.'.DESCRIZIONE}, ${'.$serviceTable.'.NOME}, ${'.$serviceTable.'.LETTERA} as LETTERA, '.$sub1.', '.$sub2.' FROM ${'.$serviceTable.'} WHERE ${'.$serviceTable.'.LATITUDINE} ORDER BY ${'.$serviceTable.'.ORDINE}';

		$TBS = new clsTinyButStrong();
		$TBS->SetOption(array('render'=>TBS_OUTPUT));
		$TBS->SetOption('noerr', false);
		$TBS->SetVarRefItem('apikey', $params['chiave_mappa_google']);
		$TBS->SetVarRefItem('wtid1', $wtId1);
		$TBS->LoadTemplate(CAMILA_APP_PATH.'/plugins/'.basename(dirname(__FILE__)).'/templates/tbs/it/resources_'.$template.'.htm');
		$TBS->MergeBlock('res','adodb',$camilaWT->parseWorktableSqlStatement($queryList));
		$TBS->MergeBlock('res2','adodb',$camilaWT->parseWorktableSqlStatement($queryList));
		$_CAMILA['page']->add_userdefined(new CHAW_tbs($TBS, true));		
	}
	else
	{
		$camilaUI->insertLineBreak();
		$camilaUI->insertWarning('Nessun intervento in corso!');
	}
}
drawMap($template);
?>