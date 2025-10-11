switch ($wt_short_title) {

	case 'VOLONTARI':
		$func = function($mode, $dbform) use ($wt_short_title) {
			global $_CAMILA;
			if (isset($dbform->fields['datainizioattestato']) && isset($dbform->fields['codicefiscale'])) {
				$data = Array();
				$data[0] = $dbform->fields['codicefiscale']->value;
				$data[1] = $dbform->fields['datainizioattestato']->value;
				$stmt = 'select * from ' . $dbform->table . ' where codicefiscale = ? and datainizioattestato = ?';
				$result = $_CAMILA['db']->Execute($stmt, $data);
				if ($result === false)
					camila_error_page(camila_get_translation('camila.sqlerror') . ' ' . $_CAMILA['db']->ErrorMsg());
				if ($result->RecordCount()>0) {
					camila_error_text("C'è già un volontario con stesso codice fiscale e data inizio attestato");
					return false;
				} else {
					$data = Array();
					$data[0] = $dbform->fields['codicefiscale']->value;
					$stmt = 'select * from ' . $dbform->table . ' where codicefiscale = ?';
					$result = $_CAMILA['db']->Execute($stmt, $data);
					if ($result === false)
						camila_error_page(camila_get_translation('camila.sqlerror') . ' ' . $_CAMILA['db']->ErrorMsg());
					if ($result->RecordCount()>0) {
						camila_warning_text("C'è già un volontario con stesso codice fiscale");
						return true;
					} else {
						return true;
					}
				}
			}
			
		};
		$form->customValidation = $func;
		break;

	case 'MEZZI':
		$func = function($mode, $dbform) use ($wt_short_title) {
			global $_CAMILA;
			if (isset($dbform->fields['datainizioattestato']) && isset($dbform->fields['targa'])) {
				$data = Array();
				$data[0] = $dbform->fields['targa']->value;
				$data[1] = $dbform->fields['datainizioattestato']->value;
				$stmt = 'select * from ' . $dbform->table . ' where targa = ? and datainizioattestato = ?';
				$result = $_CAMILA['db']->Execute($stmt, $data);
				if ($result === false)
					camila_error_page(camila_get_translation('camila.sqlerror') . ' ' . $_CAMILA['db']->ErrorMsg());
				if ($result->RecordCount()>0) {
					camila_error_text("C'è già un mezzo con stessa targa e data inizio attestato");
					return false;
				} else {
					$data = Array();
					$data[0] = $dbform->fields['targa']->value;
					$stmt = 'select * from ' . $dbform->table . ' where targa = ?';
					$result = $_CAMILA['db']->Execute($stmt, $data);
					if ($result === false)
						camila_error_page(camila_get_translation('camila.sqlerror') . ' ' . $_CAMILA['db']->ErrorMsg());
					if ($result->RecordCount()>0) {
						camila_warning_text("C'è già un mezzo con stessa targa");
						return true;
					} else {
						return true;
					}
				}
			}
			
		};
		$form->customValidation = $func;
		break;
}