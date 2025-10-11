<?php
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$r1Sheet = $camilaWT->getWorktableSheetId('VOLONTARI PREACCREDITATI');
$r2Sheet = $camilaWT->getWorktableSheetId('MEZZI PREACCREDITATI');

$camilaWT = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$sql = "SELECT DISTINCT \${VOLONTARI PREACCREDITATI.TURNO} FROM \${VOLONTARI PREACCREDITATI} ORDER BY \${VOLONTARI PREACCREDITATI.TURNO}";
$r = $camilaWT->queryWorktableDatabase($sql);

$camilaUI->openBox();

$turniCsv = implode(',',array_keys($r));

$camilaUI->openMenuSection('Preaccreditamenti');

$camilaUI->addItemToMenuSection('?dashboard=pre-accreditations-by-service','Volontari');
$camilaUI->addItemToMenuSection('?dashboard=pre-accreditations-vehicles-by-service','Mezzi');
$camilaUI->closeMenuSection();

$camilaUI->insertDivider();

if ($_REQUEST['dashboard'] == 'pre-accreditations-by-service') {
	$mapping = '';
	$title = 'Volontari preaccreditati per turno ' . $_REQUEST['custom'];
	$camilaUI->insertTitle($title, 'user');
	$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-by-service', 'Riepilogo per turno', 'tools', false);
	foreach($r as $k => $v) {
		$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-by-service&custom='.urlencode($k), $k, 'calendar', false);
	}
	$camilaUI->insertLineBreak();
	$stmt = build_pivot_sql('SERVIZIO',$turniCsv);
	$stmt = $camilaWT->parseWorktableSqlStatement($stmt);
	$report = new report($stmt, '', 'organizzazione', '', $mapping);
	$report->canupdate = false;
	$report->candelete = false;
	$report->drawfilterbox = false;
	$report->drawapplytemplate = false;
	$report->process();
	$report->draw();
} else if ($_REQUEST['dashboard'] == 'pre-accreditations-by-overnight-stay') {
	$mapping = '';
	$title = 'Pernottamenti per turno ' . $_REQUEST['custom'];
	$camilaUI->insertTitle($title, 'user');
	$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-by-overnight-stay', 'Riepilogo per turno', 'tools', false);
	foreach($r as $k => $v) {
		$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-by-overnight-stay&custom='.urlencode($k), $k, 'calendar', false);
	}
	$camilaUI->insertLineBreak();
	$stmt = build_pivot_sql('PERNOTTAMENTO',$turniCsv);
	$stmt = $camilaWT->parseWorktableSqlStatement($stmt);
	$report = new report($stmt, '', 'organizzazione', '', $mapping);
	$report->canupdate = false;
	$report->candelete = false;
	$report->drawfilterbox = false;
	$report->drawapplytemplate = false;
	$report->process();
	$report->draw();
} else if ($_REQUEST['dashboard'] == 'pre-accreditations-vehicles-by-service') {
	$mapping = '';
	$title = 'Mezzi preaccreditati per turno ' . $_REQUEST['custom'];
	$camilaUI->insertTitle($title, 'truck');
	$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-vehicles-by-service', 'Riepilogo per turno', 'tools', false);
	foreach($r as $k => $v) {
		$camilaUI->insertSecondaryButton('?dashboard=pre-accreditations-vehicles-by-service&custom='.urlencode($k), $k, 'calendar', false);
	}
	$camilaUI->insertLineBreak();
	$stmt = build_pivot_sql_2('SERVIZIO',$turniCsv);
	$stmt = $camilaWT->parseWorktableSqlStatement($stmt);
	$report = new report($stmt, '', 'organizzazione', '', $mapping);
	$report->canupdate = false;
	$report->candelete = false;
	$report->drawfilterbox = false;
	$report->drawapplytemplate = false;
	$report->process();
	$report->draw();
}



$camilaUI->addGridSection(3, function ($colIndex) use ($camilaUI, $r, $r1Sheet, $r2Sheet) {
	switch ($colIndex) {
		case 0:
			$camilaUI->insertTitle('Pernottamenti', 'moon');
			$camilaUI->insertButton('?dashboard=pre-accreditations-by-overnight-stay', 'Riepilogo per turno', 'moon');
			foreach($r as $k => $v) {
				$camilaUI->insertButton('?dashboard=pre-accreditations-by-overnight-stay&custom='.urlencode($k), $k, 'calendar');
			}
			$camilaUI->insertLineBreak();
			break;
		case 1:
			$camilaUI->insertTitle('Elenchi', 'user');
			$camilaUI->insertButton('cf_worktable'.$r1Sheet.'.php','Elenco', 'user');
			foreach($r as $k => $v) {
				$camilaUI->insertButton('cf_worktable'.$r1Sheet.'.php?camila_w1f=_C_turno&camila_w1c=eq&camila_w1v='.urlencode($k),$k, 'calendar');
			}
			break;
		case 2:
			$camilaUI->insertTitle('Elenchi', 'truck');
			$camilaUI->insertButton('cf_worktable'.$r2Sheet.'.php','Elenco', 'truck');
			foreach($r as $k => $v) {
				$camilaUI->insertButton('cf_worktable'.$r2Sheet.'.php?camila_w1f=_C_turno&camila_w1c=eq&camila_w1v='.urlencode($k),$k, 'calendar');
			}
			break;
	}
});

$_CAMILA['page']->camila_export_enabled = true;

$camilaUI->closeBox();



/** Make a safe backticked alias from the raw shift label */
function backtick_alias(string $label): string {
  // Escape any backticks inside the label by doubling them, then wrap in backticks.
  $escaped = str_replace('`', '``', $label);
  return '`' . $escaped . '`';
}

function build_pivot_sql(string $colVal, $turniCsv): string {
  global $_CAMILA;
  $select = '';
  if (isset ($turniCsv)) {
	  $turni = array_filter(array_map('trim', explode(',', $turniCsv)), fn($v) => $v !== '');
	  if (empty($turni)) {
		throw new InvalidArgumentException('No valid shifts found in CSV string.');
	  }

	  $caseCols = [];
	  if (isset($_REQUEST['custom'])) {
		  $t = $_REQUEST['custom'];
		  $lit = $_CAMILA['db']->qStr($t);
		  $alias = backtick_alias($colVal);
		  $caseCols[] = "MAX(CASE WHEN \${VOLONTARI PREACCREDITATI.TURNO} = $lit THEN \${VOLONTARI PREACCREDITATI.$colVal} ELSE '' END) AS $alias";
	  } else {
		foreach ($turni as $t) {
			$lit = $_CAMILA['db']->qStr($t);
			$alias = backtick_alias($t);
			$caseCols[] = "MAX(CASE WHEN \${VOLONTARI PREACCREDITATI.TURNO} = $lit THEN \${VOLONTARI PREACCREDITATI.$colVal} ELSE '' END) AS $alias";
		}
	  }

	  $select = ','.implode(",\n  ", $caseCols);
  }
  
  $fields = '';
  
  if (isset($_REQUEST['custom'])) {
	$fields .= "\${VOLONTARI PREACCREDITATI.TURNO},";
  }

  $fields .= "\${VOLONTARI PREACCREDITATI.ORGANIZZAZIONE},\${VOLONTARI PREACCREDITATI.CODICE FISCALE},\${VOLONTARI PREACCREDITATI.COGNOME},\${VOLONTARI PREACCREDITATI.NOME}";
  
  $orderBy = "\${VOLONTARI PREACCREDITATI.ORGANIZZAZIONE},\${VOLONTARI PREACCREDITATI.COGNOME},\${VOLONTARI PREACCREDITATI.NOME}";

  $sql = "SELECT {$fields}";
  
  if (isset($_REQUEST['custom']))
	$sql.= " ,CASE WHEN EXISTS (SELECT 1 FROM \${VOLONTARI} WHERE \${VOLONTARI.CODICE FISCALE} = \${VOLONTARI PREACCREDITATI.CODICE FISCALE}) THEN 'REGISTRATO' ELSE 'Non registrato' END AS `REGISTRAZIONE`";
  
  $sql .= "{$select} FROM \${VOLONTARI PREACCREDITATI} ";
  if (isset($_REQUEST['custom']))
	  $sql .= " WHERE \${VOLONTARI PREACCREDITATI.TURNO}=" . $_CAMILA['db']->qStr($_REQUEST['custom']);
  $sql .= " GROUP BY {$fields} ";

  return $sql;
}

function build_pivot_sql_2(string $colVal, $turniCsv): string {
  global $_CAMILA;
  $select = '';
  if (isset ($turniCsv)) {
	  $turni = array_filter(array_map('trim', explode(',', $turniCsv)), fn($v) => $v !== '');
	  if (empty($turni)) {
		throw new InvalidArgumentException('No valid shifts found in CSV string.');
	  }

	  $caseCols = [];
	  if (isset($_REQUEST['custom'])) {
		  $t = $_REQUEST['custom'];
		  $lit = $_CAMILA['db']->qStr($t);
		  $alias = backtick_alias($colVal);
		  $caseCols[] = "MAX(CASE WHEN \${MEZZI PREACCREDITATI.TURNO} = $lit THEN \${MEZZI PREACCREDITATI.$colVal} ELSE '' END) AS $alias";
	  } else {
		foreach ($turni as $t) {
			$lit = $_CAMILA['db']->qStr($t);
			$alias = backtick_alias($t);
			$caseCols[] = "MAX(CASE WHEN \${MEZZI PREACCREDITATI.TURNO} = $lit THEN \${MEZZI PREACCREDITATI.$colVal} ELSE '' END) AS $alias";
		}
	  }

	  $select = ','.implode(",\n  ", $caseCols);
  }
  
  $fields = '';
  
  if (isset($_REQUEST['custom'])) {
	$fields .= "\${MEZZI PREACCREDITATI.TURNO},";
  }

  $fields .= "\${MEZZI PREACCREDITATI.ORGANIZZAZIONE},\${MEZZI PREACCREDITATI.TARGA},\${MEZZI PREACCREDITATI.MARCA},\${MEZZI PREACCREDITATI.MODELLO}";
  
  $orderBy = "\${MEZZI PREACCREDITATI.ORGANIZZAZIONE},\${MEZZI PREACCREDITATI.TARGA},\${MEZZI PREACCREDITATI.MARCA}";

  $sql = "SELECT {$fields}";
  
  if (isset($_REQUEST['custom']))
	$sql.= " ,CASE WHEN EXISTS (SELECT 1 FROM \${MEZZI} WHERE \${MEZZI.TARGA} = \${MEZZI PREACCREDITATI.TARGA}) THEN 'REGISTRATO' ELSE 'Non registrato' END AS `REGISTRAZIONE`";
  
  $sql .= "{$select} FROM \${MEZZI PREACCREDITATI} ";
  if (isset($_REQUEST['custom']))
	  $sql .= " WHERE \${MEZZI PREACCREDITATI.TURNO}=" . $_CAMILA['db']->qStr($_REQUEST['custom']);
  $sql .= " GROUP BY {$fields} ";

  return $sql;
}

?>