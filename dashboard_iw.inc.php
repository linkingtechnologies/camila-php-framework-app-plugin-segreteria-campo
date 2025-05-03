<?php
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];
$lang = 'it';

$camilaUI->openBox();
$camilaUI->insertTitle('Importazione dati esempio','upload');

global $_CAMILA;
$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];

$relDir = '/examples/'.$lang;
$directory = CAMILA_APP_PATH . '/plugins/'.basename(dirname(__FILE__)).$relDir;

$result = $camilaWT->getWorktableSheets();

$arrNames = Array();
$arrCount = Array();

$wSheets = Array();
while (!$result->EOF) {
	$a = $result->fields;
	$id = $a['id'];
	$title = $a['short_title'];
	$wSheets[$id]=$title;
	$result->MoveNext();
}

foreach ($wSheets as $k=>$val)
{
	$count = $camilaWT->countWorktableRecords($k);
	$arrNames[$k] = $val;
	$arrCount[$k] = $count;
}


$arrFiles = Array();
if (is_dir($directory)) {
    if ($handle = opendir($directory)) {
        while (($file = readdir($handle)) !== false) {
            if ($file !== "." && $file !== "..") {
                $arrFiles[] = $file;
            }
        }
        closedir($handle);
    } else {
        echo "Impossibile aprire la directory.";
    }

	foreach ($arrFiles as $key => $fileName) {
		foreach ($arrNames as $k  => $name) {
			if (strpos($fileName, $name . "_") === 0) {	
				if ($arrCount[$k] == 0)
				{
					$position = strpos($fileName, "_") + 1;
					$camilaUI->insertButton('cf_worktable_wizard_step4.php?camila_custom='.$k .'&camila_iwfilepath='.urlencode('/plugins/'.basename(dirname(__FILE__)).$relDir.'/'.$fileName), 'IMPORTA ' . substr($fileName, $position), 'upload');
				}
				break;
			}
		}
	}
	
	
} else {
    echo "La directory specificata non esiste.";
}

$camilaUI->closeBox();
?>