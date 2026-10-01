<?php
// Background worker: sends the booking confirmation email so the booking request returns immediately.
// Started by save_booking.php:  php mail_job.php <base64(json)>
if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/mailer.php';

$payload = json_decode((string)base64_decode($argv[1] ?? '', true), true);
if (!is_array($payload) || empty($payload['booking_number'])) exit(1);
mail_booking_confirmation($conn, $payload);
