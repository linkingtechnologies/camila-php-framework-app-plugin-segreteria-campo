<?php
return [
    'GET /status' => function(array $params, ?array $body, array $path): array {
        return ['status' => 'ok'];
    },
];
