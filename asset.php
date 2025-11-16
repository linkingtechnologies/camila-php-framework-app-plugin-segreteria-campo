<?php
declare(strict_types=1);

$outDir    = './docs/it/html';

if (!isset($_GET['f'])) {
    http_response_code(400); exit('missing f');
}
$rel = str_replace("\0", '', (string)$_GET['f']);            // niente byte nulli
$rel = ltrim($rel, '/');                                      // normalizza

// NO traversal
$path = realpath($outDir . DIRECTORY_SEPARATOR . $rel);
if ($path === false || strpos($path, realpath($outDir)) !== 0 || !is_file($path)) {
    http_response_code(404); exit('not found');
}

// MIME type
$mime = mime_content_type($path) ?: 'application/octet-stream';

// Cache HTTP (regola a piacere)
$mtime = filemtime($path) ?: time();
header('Content-Type: ' . $mime);
header('Content-Length: ' . (string)filesize($path));
header('Last-Modified: ' . gmdate('D, d M Y H:i:s', $mtime) . ' GMT');
header('Cache-Control: public, max-age=31536000, immutable');

readfile($path);
