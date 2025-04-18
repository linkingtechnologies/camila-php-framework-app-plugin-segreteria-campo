<?php
$camilaUI->insertTitle('Backup applicazione','download');

global $_CAMILA;
if ($_CAMILA['db']->databaseType == 'sqlite3')
{
	$camilaUI->insertButton('?dashboard='.$_REQUEST['dashboard'].'&download=yes', 'BACKUP INTERO DATABASE (solo db sqlite3)', 'hdd');
}

$camilaUI->insertButton('?dashboard='.$_REQUEST['dashboard'].'&download2=yes', 'BACKUP DATABASE E CONFIGURAZIONI', 'hdd');

if (isset($_REQUEST['download'])) {

	$file = CAMILA_VAR_ROOTDIR.'/db/camila.db';

	if (file_exists($file)) {
		header('Content-Description: File Transfer');
		header('Content-Type: application/octet-stream');
		header('Content-Disposition: attachment; filename="'.basename($file).'"');
		header('Expires: 0');
		header('Cache-Control: must-revalidate');
		header('Pragma: public');
		header('Content-Length: ' . filesize($file));
		readfile($file);
		exit;
	}
}

if (isset($_REQUEST['download2'])) {

	$db = $_CAMILA['db'];
	$db->SetFetchMode(ADODB_FETCH_ASSOC);

	$prefix = CAMILA_APPLICATION_PREFIX;

	// === Temporary folder for CSVs ===
	$tmpDir = sys_get_temp_dir() . '/adodb_csv_' . uniqid();
	mkdir($tmpDir);

	// === Get tables with the given prefix ===
	$tables = [];

	$stmt = "SHOW TABLES LIKE '$prefix%'";
	if ($_CAMILA['db']->databaseType == 'sqlite3') {
		$stmt = "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '{$prefix}%'";
	}

	$rs = $db->Execute($stmt);
	while (!$rs->EOF) {
		$tables[] = array_values($rs->fields)[0];
		$rs->MoveNext();
	}

	// === Export each table to a .csv file ===
	foreach ($tables as $table) {
		$csvFile = fopen("$tmpDir/$table.csv", 'w');

		$rs = $db->Execute("SELECT * FROM `$table`");

		// Write headers
		if (!$rs->EOF) {
			fputcsv($csvFile, array_keys($rs->fields));
		}

		// Write rows
		while (!$rs->EOF) {
			fputcsv($csvFile, array_values($rs->fields));
			$rs->MoveNext();
		}

		fclose($csvFile);
	}

	// === Create ZIP file ===
	$zipFilename = 'backup_' . CAMILA_APPLICATION_PREFIX . '_' . date('Ymd_His') . '.zip';
	$zipPath = "$tmpDir/$zipFilename";
	$zip = new ZipArchive();
	$zip->open($zipPath, ZipArchive::CREATE);
	foreach (glob("$tmpDir/*.csv") as $file) {
		$zip->addFile($file, basename($file));
	}
	
	if (defined('CAMILA_TMPL_DIR') && is_dir(CAMILA_TMPL_DIR)) {
		addDirToZip(CAMILA_TMPL_DIR, $zip, 'templates/');
	}
	// Add .txt files from external directory
	$zip->close();

	// === Download ZIP file ===
	header('Content-Description: File Transfer');
	header('Content-Type: application/zip');
	header('Content-Disposition: attachment; filename="' . basename($zipPath) . '"');
	header('Expires: 0');
	header('Cache-Control: must-revalidate');
	header('Content-Length: ' . filesize($zipPath));
	readfile($zipPath);

	// === Cleanup ===
	foreach (glob("$tmpDir/*.csv") as $file) {
		unlink($file);
	}
	unlink($zipPath);
	rmdir($tmpDir);
	exit;
}

function addDirToZip($dir, $zip, $base = '') {
    $files = scandir($dir);
    foreach ($files as $file) {
        if (in_array($file, ['.', '..'])) continue;
        $fullPath = $dir . DIRECTORY_SEPARATOR . $file;
        $localPath = $base . $file;
        if (is_dir($fullPath)) {
            $zip->addEmptyDir($localPath); // crea la directory nello zip
            addDirToZip($fullPath, $zip, $localPath . '/'); // chiama se stessa -> ricorsione
        } else {
            $zip->addFile($fullPath, $localPath); // aggiunge file singolo
        }
    }
}

?>