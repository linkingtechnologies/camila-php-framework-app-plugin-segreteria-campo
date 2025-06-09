<?php
require_once(CAMILA_VENDOR_DIR . '/autoload.php');

use PhpOffice\PhpWord\PhpWord;

$camilaWT  = new CamilaWorkTable();
$camilaWT->db = $_CAMILA['db'];
$lang = 'it';

$rSheet = $camilaWT->getWorktableSheetId('REPORT');

$camilaReport = new CamilaReport($lang, $camilaWT, CAMILA_HOMEDIR.'/plugins/'.basename(dirname(__FILE__)).'/reports', $_GET['report']);
$camilaReport->shouldGenerateToc = true;
$camilaReport->shouldGenerateHeader = true;
$camilaReport->shouldGenerateFooter = true;

if (isset($_REQUEST['gid'])) {	
	$camilaReport->outputImageToBrowser($_REQUEST['rid'], $_REQUEST['gid'], $_REQUEST['report']);
	exit;
}


if (!isset($_REQUEST['format'])) {
	$camilaUI->openBox();
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div class="row columns">'));
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="row columns">'));
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-9 column is-12-mobile is-9-desktop">'));
	$camilaUI->insertTitle($camilaReport->getCurrentReportTitle(), 'dashboard');
	$camilaReport->outputHtmlToBrowser();
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '<div class="col-xs-12 col-md-3 column is-12-mobile is-3-desktop">'));
	$camilaUI->insertTitle('Report', 'dashboard');
	foreach ($camilaReport->getReports() as $k => $v) {
		if ($k == $camilaReport->getCurrentReportName()) {
			$camilaUI->insertButton('?dashboard=m1&report='.$_GET['report'], $camilaReport->getCurrentReportTitle(), 'dashboard');
			$camilaUI->insertSecondaryButton('?dashboard=m1&format=pdf&report='.$_GET['report'], $camilaReport->getCurrentReportTitle().' (in PDF)', 'file');
			$camilaUI->insertSecondaryButton('?dashboard=m1&format=docx&report='.$_GET['report'], $camilaReport->getCurrentReportTitle().' (in .docx)', 'file');
		} else {
			$camilaUI->insertButton('?dashboard=m1&report='.$k, $v, 'dashboard');
			$camilaUI->insertSecondaryButton('?dashboard=m1&format=pdf&report='.$k, $v. ' (in PDF)', 'file');
			$camilaUI->insertSecondaryButton('?dashboard=m1&format=docx&report='.$k, $v. ' (in .docx)', 'file');
		}
	}
	$camilaUI->insertTitle('Altre risorse', 'list');
	$camilaUI->insertButton('cf_worktable'.$rSheet.'.php', 'Report operativi', 'list');	
	$camilaUI->insertButton('?dashboard=01', 'Riepilogo ospiti e risorse', 'list-alt');
	$_CAMILA['page']->add_raw(new HAW_raw(HAW_HTML, '</div>'));
	$camilaUI->closeBox();
	
	$camilaUI->insertAutoRefresh(30000);
}

if (isset($_GET['format'])) {
	$t = new CamilaTemplate($lang);
	$params = $t->getParameters();
	$logoPath = CAMILA_TMPL_DIR . '/images/'.$lang.'/'.$params['logo'];
	$evento = htmlspecialchars($params['evento']);
	$comune = htmlspecialchars($params['comune']);
	$segreteria = htmlspecialchars($params['segreteriacampo'] . ' ' . $params['nomecampo']);
	$headerHtml = '
	<table width="100%" style="border:none;">
	  <tr>
		<td width="13%" style="vertical-align: middle;">
		  <img src="' . $logoPath . '" style="width: 55px; height: auto">
		</td>
		<td width="87%" style="vertical-align: middle; font-size: 12pt; padding-left: 10px;">
		  <div><strong>' . $evento . '</strong></div>
		  <div><strong>' . $comune . '</strong></div>
		  <div style="color: red;"><strong>' . $segreteria . '</strong></div>
		</td>
	  </tr>
	  <tr>
	  	<div style="height: 10px;"></div>
	  </tr>
	</table>';

	if ($_GET['format'] == 'pdf') {
		$camilaReport->headerHtml = $headerHtml;		
		$camilaReport->outputPdfToBrowser();
	} elseif ($_GET['format'] == 'docx') {
		$camilaReport->headerHtml = $headerHtml;
		$camilaReport->outputDocxToBrowser();
	} elseif ($_GET['format'] == 'odt') {
		$camilaReport->outputOdtToBrowser();
	}
}

?>