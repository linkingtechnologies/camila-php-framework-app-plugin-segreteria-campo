<?php
$camilaIntegrity = new CamilaIntegrity('plugins/'.basename(dirname(__FILE__)).'/conf/integrity.xml');

$checks = $camilaIntegrity->getChecks();

global $_CAMILA;

if ($_REQUEST['camila_custom']!='')
{

	if (array_key_exists('fix', $_REQUEST)) {
		$camilaUI->openBox();
		$camilaUI->insertTitle('Problema sui dati', 'warning-sign');
		$camilaWT  = new CamilaWorkTable();
		$camilaWT->db = $_CAMILA['db'];

		$fix = $_REQUEST['fix'];
		if (str_starts_with($fix,'uscita-definitiva-')) {
			$resourceTable = strtoupper(substr($fix,strrpos($fix,'-')+1));
			$now = $_CAMILA['db']->BindTimeStamp(date("Y-m-d H:i:s", time()));
			$query = 'update ${' . $resourceTable . '}';
			$query.= ' set last_upd=' . $camilaWT->db->qstr($now);
			$query.= ', last_upd_by=' . $camilaWT->db->qstr($_CAMILA['user']);
			$query.= ', last_upd_src=' . $camilaWT->db->qstr('application');
			$query.= ', last_upd_by_surname=' . $camilaWT->db->qstr($_CAMILA['user_surname']);
			$query.= ', last_upd_by_name=' . $camilaWT->db->qstr($_CAMILA['user_name']);
			$query.= ',${' .$resourceTable. '.DATA/ORA USCITA DEFINITIVA}=last_upd';
			$query.= ',mod_num = mod_num + 1';
			$query.= ' WHERE ${'.$resourceTable.'.servizio} = \'USCITA DEFINITIVA\' AND (${' .$resourceTable. '.DATA/ORA USCITA DEFINITIVA} IS NULL OR ${' .$resourceTable. '.DATA/ORA USCITA DEFINITIVA} = \'\') ';
			$result = $camilaWT->startExecuteQuery($query,false);

			if ($result === false) {
				camila_error_text('Non è stato possibile sistemare il problema!');
			} else {
				$camilaUI->insertSuccess('Il problema dovrebbe essere risolto ora.');				
			}		
		}

		if (str_starts_with($fix,'movimentazione-risorse-')) {
			$resourceTable = strtoupper(substr($fix,strrpos($fix,'-')+1));
			$resourceType = 'VOLONTARIO';
			if ($resourceTable == 'MEZZI')
				$resourceType = 'MEZZO';
			$query = 'SELECT id,${'.$resourceTable.'.cognome} || \' \' || ${'.$resourceTable.'.nome},${'.$resourceTable.'.ORGANIZZAZIONE},${' .$resourceTable. '.DATA/ORA USCITA DEFINITIVA} FROM ${'.$resourceTable.'} WHERE ${'.$resourceTable.'.servizio} = \'USCITA DEFINITIVA\' AND (${' .$resourceTable. '.DATA/ORA USCITA DEFINITIVA} IS NOT NULL) AND (${'.$resourceTable.'.cognome} || \' \' || ${'.$resourceTable.'.nome}) NOT IN (SELECT ${mov. risorse.risorsa} FROM ${mov. risorse} WHERE ${mov. risorse.a} = \'USCITA DEFINITIVA\' AND ${mov. risorse.tipo risorsa} = \'VOLONTARIO\')';
			if ($resourceTable == 'MEZZI')
				$query = 'SELECT id,${'.$resourceTable.'.targa},${'.$resourceTable.'.ORGANIZZAZIONE},${' .$resourceTable. '.DATA/ORA USCITA DEFINITIVA} FROM ${'.$resourceTable.'} WHERE ${'.$resourceTable.'.servizio} = \'USCITA DEFINITIVA\' AND (${' .$resourceTable. '.DATA/ORA USCITA DEFINITIVA} IS NOT NULL ) AND (${'.$resourceTable.'.targa}) NOT IN (SELECT TRIM(${mov. risorse.risorsa}) FROM ${mov. risorse} WHERE ${mov. risorse.a} = \'USCITA DEFINITIVA\' AND ${mov. risorse.tipo risorsa} = \'MEZZO\')';

			$result = $camilaWT->startExecuteQuery($query);
			
			$count = 0;
			while (!$result->EOF) {
				$count++;
				$f = $result->fields;
				$from = 'TBD';

				$subQuery = 'SELECT ${MOV. RISORSE.A} FROM ${MOV. RISORSE} WHERE TRIM(${MOV. RISORSE.RISORSA}) = '.$camilaWT->db->qstr($f[1]).' ORDER BY ${MOV. RISORSE.DATA/ORA} DESC LIMIT 1';
				$subResult = $camilaWT->startExecuteQuery($subQuery);
				$cnt = 0;

				while (!$subResult->EOF) {
					$cnt++;
					$f2 = $subResult->fields;
					$from = $f2[0];
					$subResult->MoveNext();
				}
				if ($cnt == 0) {
					$from = 'IN ATTESA DI SERVIZIO';
				}
				if ($from != 'TBD' AND $from != 'USCITA DEFINITIVA') {
					$to = 'USCITA DEFINITIVA';

					$now = $_CAMILA['db']->BindTimeStamp(date("Y-m-d H:i:s", time()));
					$fields = Array('DATA/ORA','RISORSA','TIPO RISORSA','GRUPPO','DA','A');
					$values = Array($f[3],$f[1],$resourceType,$f[2],$from,$to);

					$fields2 = Array();
					$fields2[]='id';
					$fields2[]='last_upd';
					$fields2[]='last_upd_by';
					$fields2[]='last_upd_src';
					$fields2[]='last_upd_by_surname';
					$fields2[]='last_upd_by_name';

					$values[]=$_CAMILA['db']->GenID(CAMILA_APPLICATION_PREFIX.'worktableseq', 100000);
					$values[]=$now;
					$values[]=$_CAMILA['user'];
					$values[]='application';
					$values[]=$_CAMILA['user_surname'];
					$values[]=$_CAMILA['user_name'];

					$query = 'INSERT INTO ${MOV. RISORSE} (';
					$count = 0;
					foreach($fields as $val) {
						if ($count>0)
							$query .= ',';
						$query .= '${MOV. RISORSE.' . $val .'}' ;
						$count++;
					}
					foreach($fields2 as $val) {
						$query .= ',' . $val;
					}
					$query .= ') VALUES (';
					$count = 0;
					foreach($values as $val) {
						if ($count>0)
							$query .= ',';
						$query .= $camilaWT->db->qstr($val);
						$count++;
					}
					$query .= ')';

					$resultRes = $camilaWT->startExecuteQuery($query,false);
					if ($resultRes === false) {
						camila_error_text('Errore nell\'inserimento della movimentazione.');
					} else {
						$camilaUI->insertText('Inserita movimentazione per ' . $f[1] . ' ('. $f[2] .')');
					}
				}
				$result->MoveNext();
			}
			if ($count == 0) {
				$camilaUI->insertWarning('Non ho trovato informazioni sufficienti...');
			}
			
			$camilaUI->insertSuccess('Tentativo di sistemazione dati terminato!');
		}
		
		$camilaUI->closeBox();
		

	} else {
		$camilaUI->openBox();
		
		$camilaUI->openButtonBar();
		$camilaUI->insertButton('?dashboard='.$_REQUEST['dashboard'],'TORNA INDIETRO','chevron-left',false);

		foreach ($checks as $k => $v) {
			$arr = $v->check;
			for ($i=0; $i<count($arr);$i++)
			{
				$item = $arr[$i];
				if($item->id == $_REQUEST['camila_custom'])
				{
					$camilaWT  = new CamilaWorkTable();
					$camilaWT->db = $_CAMILA['db'];
					
					$fix = $item->fix;
					
					$oSheet = $camilaWT->getWorktableSheetId(strtoupper($item->object));
					$camilaUI->insertButton('cf_worktable'.$oSheet.'.php', 'SCHEDA '.strtoupper($item->object), 'list');
					$camilaUI->closeButtonBar();

					$camilaUI->insertTitle($item->title, 'warning-sign');
					
					//$camilaUI->insertDivider();

					$title = $_REQUEST['error'];
					
					$stmt = $camilaWT->parseWorktableSqlStatement($item->query);
					$orderBy = '';
					$orderDir = '';

					$report = new report($stmt, $title, $orderBy, $orderDir);
					$report->drawfilterbox = false;
					$report->process();
					$report->draw();
					
					if ($fix != '')
						$camilaUI->insertButton('index.php?dashboard=ic1&camila_custom='.$_REQUEST['camila_custom'].'&fix='.$fix, 'FIX', 'wrench');


					$_CAMILA['page']->camila_export_enabled = true;
				}
			}
		}
		$camilaUI->closeBox();
	}

} else {
	$camilaUI->openBox();
	$camilaUI->insertTitle('Controllo dati', 'warning-sign');
	//$camilaUI->insertDivider();

	$camilaIntegrity->camilaWT = new CamilaWorkTable();
	$camilaIntegrity->camilaWT->wtTable = CAMILA_TABLE_WORKT;
	$camilaIntegrity->camilaWT->wtColumn = CAMILA_TABLE_WORKC;
	$camilaIntegrity->camilaWT->db = $_CAMILA['db'];

	foreach ($checks as $k => $v) {
		$arr = $v->check;
		for ($i=0; $i<count($arr);$i++)
		{
			$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));	
			$item = $arr[$i];
			$check = $camilaIntegrity->check($item);	
			if ($check->code == 'success') {
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-6 column is-full-mobile is-half-desktop">'));
				$camilaUI->insertSuccess($item->title);
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-6 column is-full-mobile is-half-desktop">'));
				$camilaUI->insertSubTitle('OK', 'thumbs-up');
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
			} else if ($check->code == 'queryerror') {
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-6 column is-full-mobile is-half-desktop">'));
				$camilaUI->insertWarning($check->message);
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-6 column is-full-mobile is-half-desktop">'));
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
			} 
			else {
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-6 column is-full-mobile is-half-desktop">'));
				$camilaUI->insertWarning($check->message);
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-6 column is-full-mobile is-half-desktop">'));
				$camilaUI->insertButton('?dashboard=ic1&camila_custom='.$item->id.'&error='.urlencode($check->message), 'Visualizza','list',false,$check->count);
				$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
			}
			$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
		}
		$camilaUI->insertDivider();
	}
	
	$camilaUI->closeBox();

}

?>