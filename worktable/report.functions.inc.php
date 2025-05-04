switch ($wt_short_title) {

	case 'VOLONTARI':
		$funzioniCustom = [
			'servizio' => function($row, $val, $record) {
				$firstLabel = (is_array($row->column[0])) ? $row->column[0][array_key_first($row->column[0])]->label : $row->column[0]->label;

				if ($firstLabel == 'SCHEDA') {
					$url = (is_array($row->column[0])) ? $row->column[0][array_key_first($row->column[0])]->url : $row->column[0]->url;
					$parsed_url = parse_url($url);
					parse_str($parsed_url['query'], $params);
					$camila_update = urldecode($params['camila_update']);
					$data = unserialize($camila_update);
					$camilakey_id = $data['camilakey_id'] ?? null;
					
					$service = $row->column[($row->number_of_columns)-1]->text;
					$link = "index.php?dashboard=02&service=".urlencode($service).'&id='.urlencode($camilakey_id);
					$l = new CHAW_link('Movimenta', $link);
					if (is_array($row->column[0]))
						$row->column[0][] = $l;
					else
						$row->column[0] =[$row->column[0],$l];
				}
			}
		];
		$report->customFunctions = $funzioniCustom;
		break;

	case 'MEZZI':
		$funzioniCustom = [
			'servizio' => function($row, $val, $record) {
				$firstLabel = (is_array($row->column[0])) ? $row->column[0][array_key_first($row->column[0])]->label : $row->column[0]->label;

				if ($firstLabel == 'SCHEDA') {
					$url = (is_array($row->column[0])) ? $row->column[0][array_key_first($row->column[0])]->url : $row->column[0]->url;
					$parsed_url = parse_url($url);
					parse_str($parsed_url['query'], $params);
					$camila_update = urldecode($params['camila_update']);
					$data = unserialize($camila_update);
					$camilakey_id = $data['camilakey_id'] ?? null;
					
					$service = $row->column[($row->number_of_columns)-1]->text;
					$link = "index.php?dashboard=04&service=".urlencode($service).'&id='.urlencode($camilakey_id);
					$l = new CHAW_link('Movimenta', $link);
					if (is_array($row->column[0]))
						$row->column[0][] = $l;
					else
						$row->column[0] =[$row->column[0],$l];
				}
			}
		];
		$report->customFunctions = $funzioniCustom;
		break;

	case 'MATERIALI':
		$funzioniCustom = [
			'servizio' => function($row, $val, $record) {
				$firstLabel = (is_array($row->column[0])) ? $row->column[0][array_key_first($row->column[0])]->label : $row->column[0]->label;

				if ($firstLabel == 'SCHEDA') {
					$url = (is_array($row->column[0])) ? $row->column[0][array_key_first($row->column[0])]->url : $row->column[0]->url;
					$parsed_url = parse_url($url);
					parse_str($parsed_url['query'], $params);
					$camila_update = urldecode($params['camila_update']);
					$data = unserialize($camila_update);
					$camilakey_id = $data['camilakey_id'] ?? null;
					
					$service = $row->column[($row->number_of_columns)-1]->text;
					$link = "index.php?dashboard=03&service=".urlencode($service).'&id='.urlencode($camilakey_id);
					$l = new CHAW_link('Movimenta', $link);
					if (is_array($row->column[0]))
						$row->column[0][] = $l;
					else
						$row->column[0] =[$row->column[0],$l];
				}
			}
		];
		$report->customFunctions = $funzioniCustom;
		break;
}