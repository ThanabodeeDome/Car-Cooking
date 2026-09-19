<?php
// GPS stamp at check-in / return.
// Sites (company points) live in Car/geo_sites.json — set from the admin page (Admin/geo-setup.php), no DB needed.
// Results are stored in CarBookings.{CheckIn|Return}{Lat,Lng,Acc,Geo,Dist} when those columns exist
// (migrations/2026-09-18_new-features.sql); on a DB without them everything below silently no-ops.

function geo_sites_file(): string {
    return __DIR__ . '/geo_sites.json';
}

// [{name, lat, lng, radius}]
function geo_sites(): array {
    $f = geo_sites_file();
    if (!is_file($f)) return [];
    $j = json_decode((string)file_get_contents($f), true);
    if (!is_array($j)) return [];
    $out = [];
    foreach ($j as $s) {
        if (isset($s['lat'], $s['lng']) && is_numeric($s['lat']) && is_numeric($s['lng'])) {
            $out[] = [
                'name'   => (string)($s['name'] ?? 'จุดบริษัท'),
                'lat'    => (float)$s['lat'],
                'lng'    => (float)$s['lng'],
                'radius' => max(50, min(5000, (int)($s['radius'] ?? 300))),
            ];
        }
    }
    return $out;
}

function geo_distance_m(float $lat1, float $lng1, float $lat2, float $lng2): float {
    $r = 6371000.0;
    $p1 = deg2rad($lat1); $p2 = deg2rad($lat2);
    $dp = $p2 - $p1; $dl = deg2rad($lng2 - $lng1);
    $a = sin($dp / 2) ** 2 + cos($p1) * cos($p2) * sin($dl / 2) ** 2;
    return 2 * $r * asin(min(1, sqrt($a)));
}

// $geo = ['lat'=>, 'lng'=>, 'acc'=>] or null. Returns ['geo'=>ok|far|none|nosite, 'dist'=>int|null, 'lat','lng','acc']
function geo_evaluate($geo): array {
    $lat = is_array($geo) && isset($geo['lat']) && is_numeric($geo['lat']) ? (float)$geo['lat'] : null;
    $lng = is_array($geo) && isset($geo['lng']) && is_numeric($geo['lng']) ? (float)$geo['lng'] : null;
    $acc = is_array($geo) && isset($geo['acc']) && is_numeric($geo['acc']) ? (int)round($geo['acc']) : null;
    if ($lat === null || $lng === null || abs($lat) > 90 || abs($lng) > 180 || ($lat == 0 && $lng == 0)) {
        return ['geo' => 'none', 'dist' => null, 'lat' => null, 'lng' => null, 'acc' => null];
    }
    $res = ['geo' => 'nosite', 'dist' => null, 'lat' => round($lat, 6), 'lng' => round($lng, 6), 'acc' => $acc];
    $sites = geo_sites();
    if (!$sites) return $res;

    $best = null;
    foreach ($sites as $s) {
        $d = geo_distance_m($lat, $lng, $s['lat'], $s['lng']);
        if ($best === null || $d < $best['d']) $best = ['d' => $d, 's' => $s];
    }
    // GPS is fuzzy indoors: allow the reported accuracy (capped) on top of the radius
    $allow = $best['s']['radius'] + min($acc ?? 0, 200);
    $res['dist'] = (int)round($best['d']);
    $res['geo'] = $best['d'] <= $allow ? 'ok' : 'far';
    return $res;
}

function geo_columns_ok(PDO $conn): bool {
    static $ok = null;
    if ($ok === null) {
        try {
            $ok = (int)$conn->query("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('CarBookings') AND name IN ('CheckInLat','ReturnLat')")->fetchColumn() === 2;
        } catch (Throwable $e) {
            $ok = false;
        }
    }
    return $ok;
}

// $prefix: 'CheckIn' | 'Return'
function geo_store(PDO $conn, int $bookingId, string $prefix, array $ev): void {
    if (!geo_columns_ok($conn) || !in_array($prefix, ['CheckIn', 'Return'], true)) return;
    try {
        $conn->prepare("UPDATE CarBookings SET {$prefix}Lat = :a, {$prefix}Lng = :b, {$prefix}Acc = :c, {$prefix}Geo = :d, {$prefix}Dist = :e WHERE BookingID = :id")
             ->execute([':a' => $ev['lat'], ':b' => $ev['lng'], ':c' => $ev['acc'], ':d' => $ev['geo'], ':e' => $ev['dist'], ':id' => $bookingId]);
    } catch (Throwable $e) {
        error_log('geo_store: ' . $e->getMessage());
    }
}

// short note appended to the success message shown to the user
function geo_user_note(array $ev, string $what): string {
    switch ($ev['geo']) {
        case 'ok':   return ' (ยืนยันพิกัดแล้ว)';
        case 'far':  return " (ตำแหน่งอยู่ห่างจากจุด{$what} — แจ้งแอดมินให้ทราบแล้ว)";
        case 'none': return ' (ไม่ได้ยืนยันพิกัด — แจ้งแอดมินให้ทราบแล้ว)';
        default:     return '';
    }
}
