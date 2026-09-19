<?php
// Basic CSRF guard for form posts: if the browser sent an Origin (or Referer), its host must equal our Host.
// Requests with neither header (curl, old browsers) pass, so nothing legit breaks.
function require_same_origin(): void {
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return;
    $srcHost = parse_url($src, PHP_URL_HOST);
    $srcPort = parse_url($src, PHP_URL_PORT);
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? ($_SERVER['HTTP_HOST'] ?? '');
    $host = strtolower(trim(explode(',', $host)[0]));
    $cmp = strtolower((string)$srcHost) . ($srcPort ? ':' . $srcPort : '');
    if ($cmp !== $host && strtolower((string)$srcHost) !== preg_replace('/:\d+$/', '', $host)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'คำขอไม่ถูกต้อง (cross-site)']);
        exit;
    }
}
