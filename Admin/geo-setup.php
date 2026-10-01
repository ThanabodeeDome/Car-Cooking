<?php require_once 'guard_admin.php'; ?>
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>จุดตรวจพิกัด - Admin Dashboard</title>
    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Prompt:wght@300;400;600&display=swap"
      rel="stylesheet"
    />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
    />
    <link rel="stylesheet" href="style.css?v=5" />
    <style>
      .geo-wrap { max-width: 720px; margin: 0 auto; }
      .geo-wrap .page-title { text-align: center; margin-bottom: 26px; }
      .geo-lead { color: #64748b; font-size: 14px; line-height: 1.7; margin: -14px 0 24px; }
      .site-row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid #eef0f4; }
      .site-row:last-child { border-bottom: none; padding-bottom: 0; }
      .site-row:first-child { padding-top: 0; }
      .site-ic { flex: none; width: 42px; height: 42px; border-radius: 12px; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 18px; }
      .site-info b { display: block; font-size: 15px; color: #111827; }
      .site-info span { font-size: 13px; color: #64748b; }
      .site-info a { font-size: 13px; color: var(--blue, #2563eb); text-decoration: none; margin-left: 8px; }
      .site-info a:hover { text-decoration: underline; }
      .site-del { margin-left: auto; border: 1px solid #fecaca; background: #fff5f5; color: #dc2626; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 13px; cursor: pointer; transition: all .15s; }
      .site-del:hover { background: #dc2626; color: #fff; border-color: #dc2626; }
      .geo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      .geo-f label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin: 0 0 6px; }
      .geo-f { margin-bottom: 14px; }
      .here-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px; padding: 12px; border-radius: 10px; border: 1.5px dashed #93c5fd; background: #eff6ff; color: #1d4ed8; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .15s; }
      .here-btn:hover { background: #dbeafe; border-color: #3b82f6; }
      .msg { font-size: 13px; min-height: 20px; margin: 8px 2px 14px; }
      .msg.ok { color: #16a34a; } .msg.bad { color: #dc2626; } .msg.mute { color: #64748b; }
      .geo-note { font-size: 13px; color: #64748b; line-height: 1.7; background: #f8fafc; border-radius: 10px; padding: 12px 14px; margin-top: 6px; }
      .empty-hint { color: #9ca3af; }
      @media (max-width: 900px) { .geo-grid { grid-template-columns: 1fr; } }
    </style>
  </head>
  <body>
    <aside class="sidebar">
      <div class="sidebar-menu-group">
        <div class="sidebar-brand" style="margin-bottom: 25px; text-align: center">
          <img src="../Car/assets/image/CHR-Logo1.png" alt="Logo" style="max-width: 80%; height: auto" />
        </div>
        <a href="index.html#dashboard" class="menu-link"><i class="fa-solid fa-chart-pie"></i> <span>หน้าหลัก (Dashboard)</span></a>
        <a href="index.html#cars" class="menu-link"><i class="fa-solid fa-car"></i> <span>จัดการข้อมูลรถยนต์</span></a>
        <a href="index.html#calendar-tab" class="menu-link"><i class="fa-solid fa-calendar-days"></i> <span>ปฏิทินงานวิ่งรถ</span></a>
        <a href="index.html#bookings-tab" class="menu-link"><i class="fa-solid fa-clipboard-list"></i> <span>จัดการการจอง</span></a>
        <a href="index.html#users-tab" class="menu-link"><i class="fa-solid fa-users"></i> <span>บัญชีผู้ใช้</span></a>
        <a href="geo-setup.php" class="menu-link active"><i class="fa-solid fa-location-crosshairs"></i> <span>จุดตรวจพิกัด</span></a>
        <a href="index.html#reports-tab" class="menu-link"><i class="fa-solid fa-chart-column"></i> <span>รายงาน</span></a>
      </div>
      <div class="sidebar-logout-wrapper">
        <div class="sidebar-identity">
          <div class="sidebar-identity-name">
            <i class="fa-solid fa-user-shield"></i>
            <?= htmlspecialchars($_SESSION['first_name'] ?? $_SESSION['username'] ?? '-', ENT_QUOTES, 'UTF-8') ?>
          </div>
          <div class="sidebar-identity-meta">
            @<?= htmlspecialchars($_SESSION['username'] ?? '-', ENT_QUOTES, 'UTF-8') ?> &middot; Admin
          </div>
        </div>
        <a href="../logout.php" class="btn-sidebar-logout">
          <i class="fa-solid fa-right-from-bracket" style="color: #ef4444; font-size: 16px"></i>
          <span>ออกจากระบบ</span>
        </a>
      </div>
    </aside>

    <div class="main-content">
      <div class="geo-wrap">
        <h1 class="page-title">จุดตรวจพิกัด <span>Geofence</span></h1>

        <div class="dash-panel">
          <h2 class="panel-title"><i class="fa-solid fa-location-dot"></i> จุดที่ตั้งไว้แล้ว</h2>
          <div id="sites"><div class="empty-hint">กำลังโหลด...</div></div>
        </div>

        <div class="dash-panel">
          <h2 class="panel-title"><i class="fa-solid fa-plus"></i> เพิ่มจุดใหม่</h2>
          <button type="button" class="here-btn" id="useHere">
            <i class="fa-solid fa-crosshairs"></i> ใช้ตำแหน่งปัจจุบันของเครื่องนี้
          </button>
          <div class="msg mute" id="hereMsg"></div>

          <div class="geo-f">
            <label for="name">ชื่อจุด</label>
            <input id="name" class="ctrl-input" placeholder="เช่น โรงงานหลัก" value="โรงงานหลัก" />
          </div>
          <div class="geo-grid">
            <div class="geo-f">
              <label for="lat">ละติจูด</label>
              <input id="lat" class="ctrl-input" inputmode="decimal" placeholder="13.xxxxxx" />
            </div>
            <div class="geo-f">
              <label for="lng">ลองจิจูด</label>
              <input id="lng" class="ctrl-input" inputmode="decimal" placeholder="100.xxxxxx" />
            </div>
          </div>
          <div class="geo-f">
            <label for="radius">รัศมีที่ยอมรับ (เมตร)</label>
            <input id="radius" class="ctrl-input" inputmode="numeric" value="300" />
          </div>
          <button type="button" class="btn-primary" id="add" style="width: 100%; padding: 13px; border: none; border-radius: 10px; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer">
            <i class="fa-solid fa-floppy-disk"></i> บันทึกจุดนี้
          </button>
          <div class="msg" id="addMsg"></div>

          <div class="geo-note">
            <i class="fa-solid fa-circle-info"></i>
            หาพิกัดจาก Google Maps: กดค้างที่จุดลานจอดรถ แล้วคัดลอกตัวเลขสองตัวที่ขึ้น หรือเปิดหน้านี้บนมือถือขณะยืนอยู่ที่จุดนั้น
            แล้วกด "ใช้ตำแหน่งปัจจุบัน" (เบราว์เซอร์อ่านตำแหน่งได้เฉพาะ HTTPS หรือ localhost)
          </div>
        </div>
      </div>
    </div>

    <script src="../Car/ui-dialog.js?v=3"></script>
    <script>
      const $ = (id) => document.getElementById(id);
      const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      function render(sites) {
        $("sites").innerHTML = sites.length
          ? sites.map((s, i) => `<div class="site-row"><div class="site-ic"><i class="fa-solid fa-industry"></i></div><div class="site-info"><b>${esc(s.name)}</b><span>${s.lat}, ${s.lng} · รัศมี ${s.radius} ม.</span><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${s.lat},${s.lng}"><i class="fa-solid fa-up-right-from-square"></i> ดูบนแผนที่</a></div><button type="button" class="site-del" data-i="${i}"><i class="fa-solid fa-trash"></i> ลบ</button></div>`).join("")
          : '<div class="empty-hint">ยังไม่มีจุด (ระบบบันทึกพิกัดอย่างเดียว)</div>';
      }
      function load() {
        fetch("geo_sites_api.php").then((r) => r.json()).then((d) => render(d.sites || []));
      }
      function post(body) {
        return fetch("geo_sites_api.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      }
      function say(id, cls, text) {
        $(id).className = "msg " + cls;
        $(id).textContent = text;
      }
      $("sites").addEventListener("click", async (e) => {
        const b = e.target.closest(".site-del");
        if (!b) return;
        if (!(await AppDialog.confirm({ title: "ลบจุดนี้?", message: "ระบบจะไม่ใช้จุดนี้ตรวจพิกัดอีก", confirmText: "ลบ", danger: true }))) return;
        post({ action: "delete", index: Number(b.dataset.i) }).then((d) => (d.success ? render(d.sites) : AppDialog.alert(d.message || "ลบไม่สำเร็จ", { type: "error" })));
      });
      $("add").addEventListener("click", () => {
        say("addMsg", "mute", "");
        post({ action: "add", name: $("name").value, lat: $("lat").value, lng: $("lng").value, radius: $("radius").value }).then((d) => {
          if (d.success) {
            render(d.sites);
            say("addMsg", "ok", "บันทึกแล้ว");
          } else {
            say("addMsg", "bad", d.message || "บันทึกไม่สำเร็จ");
          }
        });
      });
      $("useHere").addEventListener("click", () => {
        say("hereMsg", "mute", "กำลังอ่านตำแหน่ง...");
        if (!navigator.geolocation) return say("hereMsg", "bad", "เบราว์เซอร์นี้อ่านตำแหน่งไม่ได้");
        navigator.geolocation.getCurrentPosition(
          (p) => {
            $("lat").value = p.coords.latitude.toFixed(6);
            $("lng").value = p.coords.longitude.toFixed(6);
            say("hereMsg", "ok", "ได้ตำแหน่งแล้ว (คลาดเคลื่อนประมาณ " + Math.round(p.coords.accuracy) + " ม.) ตรวจแล้วกดบันทึก");
          },
          () => say("hereMsg", "bad", "อ่านตำแหน่งไม่ได้ (ไม่ได้อนุญาต หรือไม่ใช่ HTTPS)"),
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
      load();
    </script>
  </body>
</html>
