<?php
$camilaUI->openBox();
$camilaUI->insertTitle('Info Server', 'globe');

/**
 * Format bytes into a human readable string (e.g. 1.23 GB)
 */
function human_filesize($bytes, $decimals = 2) {
    if ($bytes <= 0 || !is_numeric($bytes)) {
        return '0 B';
    }

    $sizes  = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    $factor = floor((strlen((string)$bytes) - 1) / 3);

    return sprintf("%.{$decimals}f %s", $bytes / pow(1024, $factor), $sizes[$factor]);
}

/**
 * Detect OS family in a consistent way.
 */
function getOsFamily() {
    if (defined('PHP_OS_FAMILY')) {
        return PHP_OS_FAMILY; // 'Windows', 'Linux', 'Darwin', etc.
    }

    // Fallback for older PHP versions
    if (stripos(PHP_OS, 'WIN') === 0) {
        return 'Windows';
    }
    if (stripos(PHP_OS, 'LINUX') === 0) {
        return 'Linux';
    }

    return PHP_OS; // generic string
}

/**
 * Check if a function is disabled in php.ini (disable_functions).
 */
function isFunctionDisabled($functionName) {
    $disabled = ini_get('disable_functions');
    if (empty($disabled)) {
        return false;
    }
    $list = array_map('trim', explode(',', $disabled));
    return in_array($functionName, $list, true);
}

/**
 * Get server memory info (total and available) in bytes.
 * - On Linux: reads /proc/meminfo
 * - On Windows: uses "wmic OS" if available
 * - On other OS: returns null values
 */
function getServerMemoryInfo() {
    $osFamily = getOsFamily();
    $info = [
        'total'     => null,
        'available' => null,
    ];

    // Linux implementation using /proc/meminfo
    if ($osFamily === 'Linux' && is_readable('/proc/meminfo')) {
        $data = @file('/proc/meminfo');
        if (is_array($data)) {
            foreach ($data as $line) {
                if (strpos($line, 'MemTotal:') === 0) {
                    $info['total'] = (int)filter_var($line, FILTER_SANITIZE_NUMBER_INT) * 1024; // kB -> B
                } elseif (strpos($line, 'MemAvailable:') === 0) {
                    $info['available'] = (int)filter_var($line, FILTER_SANITIZE_NUMBER_INT) * 1024;
                }
            }
        }
        return $info;
    }

    // Windows implementation using WMIC
    if ($osFamily === 'Windows' && function_exists('shell_exec') && !isFunctionDisabled('shell_exec')) {
        $output = @shell_exec('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /Value');
        if (!empty($output)) {
            $lines = preg_split('/\r\n|\r|\n/', trim($output));
            $mem = [];
            foreach ($lines as $line) {
                if (strpos($line, '=') !== false) {
                    list($key, $value) = explode('=', $line, 2);
                    $mem[trim($key)] = (int)trim($value);
                }
            }

            // Values are in kilobytes
            if (isset($mem['TotalVisibleMemorySize'])) {
                $info['total'] = $mem['TotalVisibleMemorySize'] * 1024;
            }
            if (isset($mem['FreePhysicalMemory'])) {
                // "available" approximated as free physical memory
                $info['available'] = $mem['FreePhysicalMemory'] * 1024;
            }
        }
    }

    return $info;
}

/**
 * Get CPU load information.
 *
 * Returns:
 *  - ['type' => 'loadavg', 'values' => [1min, 5min, 15min]] on Unix-like systems, if sys_getloadavg is available
 *  - ['type' => 'percent', 'value' => X] on Windows if WMIC is available
 *  - null if no information can be retrieved
 */
function getCpuLoad() {
    $osFamily = getOsFamily();

    // Unix-like: use sys_getloadavg if available
    if ($osFamily !== 'Windows' && function_exists('sys_getloadavg')) {
        $load = @sys_getloadavg();
        if ($load !== false && is_array($load) && count($load) >= 3) {
            return [
                'type'   => 'loadavg',
                'values' => $load, // [1, 5, 15]
            ];
        }
    }

    // Windows: approximate CPU load using WMIC
    if ($osFamily === 'Windows' && function_exists('shell_exec') && !isFunctionDisabled('shell_exec')) {
        $output = @shell_exec('wmic cpu get LoadPercentage /Value');
        if (!empty($output)) {
            if (preg_match('/LoadPercentage=(\d+)/', $output, $matches)) {
                return [
                    'type'  => 'percent',
                    'value' => (int)$matches[1],
                ];
            }
        }
    }

    return null;
}

/**
 * Try to detect if running inside a container (Docker/Kubernetes/containerd).
 * This only makes sense on Linux; always returns false on Windows.
 */
function isContainerized() {
    $osFamily = getOsFamily();

    if ($osFamily !== 'Linux') {
        return false;
    }

    // Classic Docker
    if (file_exists('/.dockerenv')) {
        return true;
    }

    // Podman / other runtimes
    if (file_exists('/run/.containerenv')) {
        return true;
    }

    // Check cgroups for container-related keywords
    if (is_readable('/proc/1/cgroup')) {
        $cgroup = @file_get_contents('/proc/1/cgroup');
        if ($cgroup && preg_match('/docker|kubepods|containerd/i', $cgroup)) {
            return true;
        }
    }

    return false;
}

/* ------------------- ACCESS URLS ------------------- */

$url = '';
if (getenv('COMPUTERNAME') != '') {
	$url  = 'http://' . getenv('COMPUTERNAME') . ':' . $_SERVER['SERVER_PORT'] . '/app/' . CAMILA_APP_DIR;
	$link = new CHAW_link($url, $url);
	$_CAMILA['page']->add_link($link);
}

$url2 = '';
if (!empty($_SERVER['SERVER_ADDR'])) {
	$url2  = 'http://' . $_SERVER['SERVER_ADDR'] . ':' . $_SERVER['SERVER_PORT'] . '/app/' . CAMILA_APP_DIR;
	$link = new CHAW_link($url2, $url2);
	if ($url2 != $url)
		$_CAMILA['page']->add_link($link);
}

$localIP = getHostByName(getHostName());
if ($localIP != '') {
	$url3  = 'http://' . $localIP . ':' . $_SERVER['SERVER_PORT'] . '/app/' . CAMILA_APP_DIR;
	$link = new CHAW_link($url3, $url3);
	if ($url3 != $url && $url3 != $url2)
	$_CAMILA['page']->add_link($link);
}

$text = new CHAW_text('');
$_CAMILA['page']->add_text($text);

/* ------------------- PHP INFO ------------------- */

$text = new CHAW_text('Versione PHP: ' . phpversion());
$_CAMILA['page']->add_text($text);

$text = new CHAW_text('Limite memoria PHP (memory_limit): ' . ini_get('memory_limit'));
$_CAMILA['page']->add_text($text);

$text = new CHAW_text('Memoria usata dallo script: ' . human_filesize(memory_get_usage(true)));
$_CAMILA['page']->add_text($text);

$text = new CHAW_text('Memoria picco usata dallo script: ' . human_filesize(memory_get_peak_usage(true)));
$_CAMILA['page']->add_text($text);

/* ------------------- DISK INFO ------------------- */

$text = new CHAW_text('Spazio libero su disco (root): ' . human_filesize(@disk_free_space('/')));
$_CAMILA['page']->add_text($text);

$text = new CHAW_text('Spazio totale disco (root): ' . human_filesize(@disk_total_space('/')));
$_CAMILA['page']->add_text($text);

/* ------------------- SERVER MEMORY INFO ------------------- */

$mem = getServerMemoryInfo();
if ($mem['total'] !== null) {
    $text = new CHAW_text(
        'RAM totale server: ' . human_filesize($mem['total']) .
        ' | RAM disponibile: ' . ($mem['available'] !== null ? human_filesize($mem['available']) : 'N/D')
    );
    $_CAMILA['page']->add_text($text);
}

/* ------------------- CPU INFO ------------------- */

$cpu = getCpuLoad();
if ($cpu !== null) {
    if ($cpu['type'] === 'loadavg') {
        $values = $cpu['values'];
        $text = new CHAW_text(sprintf(
            'CPU load average (1/5/15 min): %.2f / %.2f / %.2f',
            $values[0], $values[1], $values[2]
        ));
        $_CAMILA['page']->add_text($text);
    } elseif ($cpu['type'] === 'percent') {
        $text = new CHAW_text('CPU load (approx): ' . $cpu['value'] . '%');
        $_CAMILA['page']->add_text($text);
    }
}

/* ------------------- CONTAINER INFO ------------------- */

$text = new CHAW_text('Ambiente containerizzato: ' . (isContainerized() ? 'Sì' : 'No'));
$_CAMILA['page']->add_text($text);

$camilaUI->closeBox();
?>
