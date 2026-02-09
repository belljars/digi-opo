<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$payload = [
    'palvelu' => 'digi-opo',
    'kieli' => 'php',
    'tila' => 'ok',
    'aikaleima' => gmdate('c'),
];

echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
