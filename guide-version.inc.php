<?php
declare(strict_types=1);

/*
 * Cache-busting version of everything the guides are made of: the newest mtime
 * among the Markdown files, the index and the scripts. A changed guide is fetched
 * again, an unchanged one is not. Used by guide.php and by dashboards.inc.php.
 */
function sc_guide_version(): string
{
    $files = array_merge(
        glob(__DIR__ . '/views/*/guide.*.md') ?: [],
        glob(__DIR__ . '/views/dashboards/*/guide.*.md') ?: [],
        glob(__DIR__ . '/docs/guide/*.json') ?: [],
        glob(__DIR__ . '/docs/guide/*/*.md') ?: [],
        glob(__DIR__ . '/docs/guide/*/manuale/*.md') ?: [],
        [__DIR__ . '/views/shared/guide.js', __DIR__ . '/guide-links.js']
    );
    return (string)max(array_map(fn($f) => is_file($f) ? filemtime($f) : 0, $files));
}
