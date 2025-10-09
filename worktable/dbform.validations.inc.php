switch ($wt_short_title) {

	case 'VOLONTARI':
		$func = function($mode, $dbform) use ($wt_short_title) {
			
			if (isset($dbform->fields['datainizioattestato']) && isset($dbform->fields['codicefiscale'])) {

				global $_CAMILA;
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
					return true;
				}
			}
			
		};
		$form->customValidation = $func;
		break;

}