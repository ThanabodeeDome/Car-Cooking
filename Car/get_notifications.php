<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require_once 'db_connect.php';
require_once __DIR__ . '/auto_cancel_noshows.php';
autoReleaseNoShows($conn);
require_once 'notify_lib.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'not logged in']);
    exit;
}

try {
    $stmt = $conn->prepare("SELECT employee_id FROM Users WHERE id = :id");
    $stmt->execute([':id' => $_SESSION['user_id']]);
    $emp = $stmt->fetchColumn();
    if (!$emp) {
        echo json_encode(['success' => false, 'message' => 'user not found']);
        exit;
    }

    $adminIds = require __DIR__ . '/../admin_whitelist.php';
    $isAdmin = ($_SESSION['role'] ?? '') === 'admin' && in_array((int)$_SESSION['user_id'], $adminIds, true);

    echo json_encode(['success' => true, 'items' => nt_collect_for_user($conn, $emp, $isAdmin)], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log('get_notifications error: ' . $e->getMessage());
    echo json_encode(['success' => false, 'message' => 'error']);
}
