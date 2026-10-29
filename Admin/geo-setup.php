<?php require_once 'guard_admin.php'; ?>
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>จุดตรวจพิกัด - Admin Dashboard</title>
    <link rel="icon" type="image/png" sizes="48x48" href="../Car/assets/image/favicon-48.png?v=2" />
    <link rel="icon" type="image/png" sizes="192x192" href="../Car/assets/image/pwa-192.png?v=2" />
    <link rel="apple-touch-icon" href="../Car/assets/image/apple-touch-icon.png?v=2" />
    <link
      href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Prompt:wght@300;400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link
      rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
    />
    <link rel="stylesheet" href="style.css?v=34" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
    <link rel="stylesheet" href="../Car/form-ios-zoom.css?v=3" />
    <style>
      .gs-intro { display: flex; gap: 14px; align-items: flex-start; padding: 14px 18px; margin-bottom: 18px; background: #fff; border: 1px solid #e8eaf1; border-radius: 16px; box-shadow: 0 2px 10px rgba(21, 25, 38, 0.05); }
      .gs-intro i { flex: none; width: 38px; height: 38px; border-radius: 12px; background: #fee2e2; color: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 17px; }
      .gs-intro p { margin: 0; font-size: 14px; line-height: 1.7; color: #475569; }
      .gs-intro b { color: #151926; }
      .gs-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(330px, 1fr); gap: 20px; align-items: start; }
      .gs-mapcard { background: #fff; border: 1px solid #e8eaf1; border-radius: 18px; padding: 12px; box-shadow: 0 2px 10px rgba(21, 25, 38, 0.05); position: sticky; top: 20px; }
      .gs-map { height: calc(100vh - 210px); min-height: 460px; border-radius: 12px; overflow: hidden; background: #f1f5f9; z-index: 0; }
      .gs-map-fallback { height: 100%; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 14px; text-align: center; padding: 0 20px; }
      .gs-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 10px 4px 2px; font-size: 12.5px; color: #64748b; }
      .gs-legend span::before { content: ""; display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
      .lg-site::before { background: #ef4444; } .lg-new::before { background: #16a34a; } .lg-me::before { background: #2563eb; }

      .gs-side { display: flex; flex-direction: column; gap: 16px; }
      .gs-card { background: #fff; border: 1px solid #e8eaf1; border-radius: 18px; padding: 16px; box-shadow: 0 2px 10px rgba(21, 25, 38, 0.05); }
      .gs-card h2 { margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #151926; display: flex; align-items: center; gap: 8px; }
      .gs-card h2 i { color: var(--accent); }
      .gs-head-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 12px; }
      .gs-head-row h2 { margin: 0; }
      .gs-add { border: 1px dashed #cbd5e1; background: #f8fafc; color: #334155; border-radius: 10px; padding: 7px 12px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
      .gs-add:hover { border-color: var(--accent); color: var(--accent); background: #fff5f5; }
      .gs-sites { display: grid; gap: 8px; }
      .gs-site { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; padding: 10px 12px; border: 1px solid #e8eaf1; border-radius: 14px; background: #fff; font: inherit; cursor: pointer; transition: border-color .15s, background .15s; }
      .gs-site:hover { border-color: #f3b3b5; background: #fffafa; }
      .gs-site.sel { border-color: var(--accent); background: #fff5f5; box-shadow: 0 0 0 3px rgba(229, 37, 42, 0.1); }
      .gs-site .ic { flex: none; width: 38px; height: 38px; border-radius: 11px; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; }
      .gs-site b { display: block; font-size: 14.5px; color: #111827; }
      .gs-site small { font-size: 12.5px; color: #64748b; }
      .gs-empty { color: #94a3b8; font-size: 13.5px; padding: 6px 2px; }

      .gs-steps { display: flex; gap: 6px; margin: 0 0 12px; font-size: 12px; color: #94a3b8; flex-wrap: wrap; }
      .gs-steps span { padding: 3px 9px; border-radius: 999px; background: #f1f3f8; }
      .gs-field { display: block; margin-bottom: 12px; }
      .gs-field > span { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #374151; }
      .gs-field input[type="text"], .gs-manual input { width: 100%; height: 44px; padding: 0 12px; border: 1px solid #d9dde8; border-radius: 10px; font: inherit; font-size: 15px; background: #fff; }
      .gs-field input:focus, .gs-manual input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(229, 37, 42, 0.15); }
      .gs-search { display: flex; gap: 8px; }
      .gs-search input { flex: 1; min-width: 0; }
      .gs-btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 16px; border: 1px solid #d9dde8; border-radius: 10px; background: #fff; color: #374151; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .15s; }
      .gs-btn:hover { background: #f3f4f8; }
      .gs-btn.primary { border: none; background: linear-gradient(135deg, #ee3b40, #d71f25); color: #fff; box-shadow: 0 4px 14px rgba(229, 37, 42, 0.28); }
      .gs-btn.primary:hover { background: linear-gradient(135deg, #e5252a, #b91c1c); }
      .gs-btn.danger { color: #b91c1c; border-color: #fecaca; background: #fff5f5; }
      .gs-btn.danger:hover { background: #dc2626; color: #fff; }
      .gs-btn:disabled { opacity: .55; cursor: default; }
      .gs-btn[hidden] { display: none; }
      .gs-results { margin: 8px 0 0; padding: 0; list-style: none; border: 1px solid #e8eaf1; border-radius: 12px; overflow: hidden; }
      .gs-results[hidden] { display: none; }
      .gs-results li button { display: block; width: 100%; text-align: left; padding: 9px 12px; border: none; border-bottom: 1px solid #f1f3f8; background: #fff; font: inherit; font-size: 13px; color: #374151; cursor: pointer; }
      .gs-results li:last-child button { border-bottom: none; }
      .gs-results li button:hover { background: #f8f9fc; }
      .gs-range { width: 100%; accent-color: #e5252a; }
      .gs-radius-row { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; }
      .gs-radius-row b { font-size: 20px; color: #151926; }
      .gs-hint { margin: 4px 0 0; font-size: 12.5px; color: #64748b; line-height: 1.6; }
      .gs-coord { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-radius: 10px; background: #f8f9fc; font-size: 13px; color: #475569; margin-bottom: 12px; }
      .gs-coord i { color: #16a34a; }
      .gs-coord.none i { color: #cbd5e1; }
      .gs-coord a { color: var(--accent); }
      .gs-msg { min-height: 20px; margin: 4px 2px 10px; font-size: 13px; line-height: 1.6; }
      .gs-msg.ok { color: #16a34a; } .gs-msg.bad { color: #dc2626; } .gs-msg.mute { color: #64748b; } .gs-msg.warn { color: #d97706; }
      .gs-actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
      .gs-actions .primary { flex: 1; min-width: 160px; }
      details.gs-manual { margin: 2px 0 12px; font-size: 13px; color: #64748b; }
      details.gs-manual summary { cursor: pointer; padding: 4px 0; }
      .gs-manual .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 8px; }
      .gs-gps-row { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; }
      .gs-gps-row .gs-btn { height: 38px; font-size: 13px; }
      @media (max-width: 1050px) {
        .gs-layout { grid-template-columns: 1fr; }
        .gs-mapcard { position: static; }
        .gs-map { height: 55vh; min-height: 340px; }
      }
    </style>
  </head>
  <body>
    <!-- 📱 แถบบนสำหรับจอเล็ก: ปุ่มเมนู (เมนูซ้ายกลายเป็นลิ้นชักเลื่อนออกมา) -->
    <header class="adm-topbar">
      <button type="button" class="adm-burger" id="adm-burger" aria-label="เปิดเมนู" aria-expanded="false"><i class="fa-solid fa-bars"></i></button>
      <span class="adm-topbar-title">CH Car Booking <small>Admin</small></span>
    </header>
    <div class="nav-backdrop" id="nav-backdrop"></div>
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
        <a href="guard.html" class="menu-link"><i class="fa-solid fa-gauge-high"></i> <span>จดเลขไมล์รถคืน</span></a>
        <a href="index.html#reports-tab" class="menu-link"><i class="fa-solid fa-chart-column"></i> <span>รายงาน</span></a>
        <a href="index.html#log-tab" class="menu-link"><i class="fa-solid fa-clock-rotate-left"></i> <span>บันทึกระบบ</span></a>
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
      <div class="gs-intro">
        <i class="fa-solid fa-location-crosshairs"></i>
        <p>
          <b>จุดตรวจพิกัดใช้ทำอะไร:</b> ตอนผู้ใช้เช็คอิน/คืนรถ ระบบอ่านตำแหน่งมือถือแล้วเทียบกับวงกลมสีแดงด้านล่าง
          ถ้าอยู่นอกวง <b>เช็คอินยังทำได้</b> แต่ขึ้นธงเตือนให้แอดมินเห็นในรายงานและรายละเอียดการจอง ส่วน <b>การคืนรถจะถูกบล็อก</b>
          (ผู้ใช้ขออนุมัติคืนรถจากแอดมินได้ และแอดมินคืนแทนได้)
        </p>
      </div>

      <div class="gs-layout">
        <div class="gs-mapcard">
          <div id="map" class="gs-map"><div class="gs-map-fallback">กำลังโหลดแผนที่...</div></div>
          <div class="gs-legend">
            <span class="lg-site">จุดที่บันทึกแล้ว (กดเพื่อแก้ไข)</span>
            <span class="lg-new">จุดที่กำลังเพิ่ม/แก้ (ลากหมุด หรือกดบนแผนที่เพื่อย้าย)</span>
            <span class="lg-me">ตำแหน่ง GPS ของเครื่องนี้</span>
          </div>
        </div>

        <div class="gs-side">
          <section class="gs-card">
            <div class="gs-head-row">
              <h2><i class="fa-solid fa-location-dot"></i> จุดที่ตั้งไว้แล้ว</h2>
              <button type="button" class="gs-add" id="newBtn"><i class="fa-solid fa-plus"></i> เพิ่มจุดใหม่</button>
            </div>
            <div id="sites" class="gs-sites"><div class="gs-empty">กำลังโหลด...</div></div>
          </section>

          <section class="gs-card" id="editor">
            <h2><i class="fa-solid fa-pen-to-square"></i> <span id="edTitle">เพิ่มจุดใหม่</span></h2>
            <div class="gs-steps"><span>① เลือกตำแหน่ง</span><span>② ตั้งชื่อ + รัศมี</span><span>③ บันทึก</span></div>

            <label class="gs-field">
              <span>ค้นหาที่ตั้ง</span>
              <div class="gs-search">
                <input type="text" id="q" placeholder="ชื่อสถานที่ / ลิงก์ Google Maps / พิกัด เช่น 13.69, 100.72" autocomplete="off" />
                <button type="button" class="gs-btn" id="qBtn"><i class="fa-solid fa-magnifying-glass"></i> ค้นหา</button>
              </div>
            </label>
            <ul class="gs-results" id="results" hidden></ul>
            <div class="gs-msg mute" id="qMsg">หรือกดบนแผนที่เพื่อปักหมุดได้เลย</div>

            <div class="gs-coord none" id="coord"><i class="fa-solid fa-circle-dot"></i> <span id="coordTxt">ยังไม่ได้เลือกตำแหน่ง</span></div>

            <label class="gs-field">
              <span>ชื่อจุด</span>
              <input type="text" id="name" placeholder="เช่น โรงงานหลัก" maxlength="60" />
            </label>

            <div class="gs-field">
              <div class="gs-radius-row"><span style="font-size:13px;font-weight:600;color:#374151">รัศมีที่ยอมรับ</span><b><span id="rVal">100</span> ม.</b></div>
              <input type="range" class="gs-range" id="radius" min="50" max="1000" step="10" value="100" />
              <p class="gs-hint">วงกลมบนแผนที่ขยายตามที่เลื่อน — GPS มือถือคลาดได้ 20–50 ม. แนะนำไม่ต่ำกว่า 60 ม. ถ้าครอบคลุมทั้งลานจอดรถยิ่งดี</p>
            </div>

            <div class="gs-gps-row">
              <button type="button" class="gs-btn" id="gpsBtn"><i class="fa-solid fa-crosshairs"></i> ใช้ตำแหน่งของเครื่องนี้</button>
            </div>
            <div class="gs-msg mute" id="gpsMsg">ใช้ได้แม่นเมื่อเปิดจากมือถือขณะยืนกลางลานจอด (ที่โล่ง) — คอมตั้งโต๊ะมักคลาดเป็นร้อยเมตร</div>

            <details class="gs-manual">
              <summary>ใส่พิกัดเอง (ละติจูด / ลองจิจูด)</summary>
              <div class="row">
                <input type="text" id="lat" inputmode="decimal" placeholder="13.xxxxxx" />
                <input type="text" id="lng" inputmode="decimal" placeholder="100.xxxxxx" />
              </div>
            </details>

            <div class="gs-msg" id="saveMsg"></div>
            <div class="gs-actions">
              <button type="button" class="gs-btn primary" id="save"><i class="fa-solid fa-floppy-disk"></i> <span id="saveTxt">บันทึกจุดนี้</span></button>
              <button type="button" class="gs-btn danger" id="del" hidden><i class="fa-solid fa-trash"></i> ลบ</button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <script src="../Car/ui-dialog.js?v=3"></script>
    <script src="admin-toast.js?v=1"></script>
    <script>
      // 📱 เมนูซ้ายแบบลิ้นชักบนจอเล็ก (≤ 900px): กดปุ่ม ☰ เปิด / กดพื้นหลังหรือเลือกเมนูแล้วปิด
      (function () {
        const b = document.getElementById("adm-burger");
        const bd = document.getElementById("nav-backdrop");
        if (!b || !bd) return;
        const set = (open) => {
          document.body.classList.toggle("nav-open", open);
          b.setAttribute("aria-expanded", String(open));
        };
        b.addEventListener("click", () => set(!document.body.classList.contains("nav-open")));
        bd.addEventListener("click", () => set(false));
        document.querySelectorAll(".sidebar .menu-link").forEach((l) => l.addEventListener("click", () => set(false)));
        document.addEventListener("keydown", (e) => e.key === "Escape" && set(false));
      })();
    </script>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
    <script>
      const $ = (id) => document.getElementById(id);
      const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const hasMap = typeof L !== "undefined";

      let map, meMarker, meCircle;
      let sites = []; // จุดที่บันทึกแล้ว
      let siteObjs = []; // {marker, circle} ต่อจุด
      let editing = null; // index ของจุดที่กำลังแก้ | null = เพิ่มจุดใหม่
      let work = null; // {lat,lng} ตำแหน่งที่กำลังทำงานอยู่
      let newMarker = null, newCircle = null;

      const pin = (color) =>
        L.divIcon({
          className: "",
          html: `<svg width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
          iconSize: [28, 40],
          iconAnchor: [14, 40],
          popupAnchor: [0, -36],
        });

      function say(id, cls, text) {
        $(id).className = "gs-msg " + cls;
        $(id).textContent = text;
      }
      const radiusVal = () => Math.max(50, Math.min(1000, parseInt($("radius").value, 10) || 100));

      // ---------- แผนที่ ----------
      if (hasMap) {
        $("map").innerHTML = "";
        map = L.map("map", { zoomControl: true }).setView([13.736717, 100.523186], 6);
        const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
        const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagery &copy; Esri" });
        L.control.layers({ "แผนที่": street, "ดาวเทียม": sat }, null, { position: "topright" }).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);
        // กดบนแผนที่ = ย้ายหมุดที่กำลังทำงานอยู่ (หรือปักจุดใหม่)
        map.on("click", (e) => setWork(e.latlng.lat, e.latlng.lng, false));
      } else {
        $("map").innerHTML = '<div class="gs-map-fallback">โหลดแผนที่ไม่ได้ (เครื่องนี้อาจเข้าอินเทอร์เน็ตภายนอกไม่ได้) — ยังใส่พิกัดเองด้านขวาได้ตามปกติ</div>';
      }

      // ---------- ตำแหน่งที่กำลังทำงาน ----------
      function showCoord() {
        const el = $("coord");
        if (!work) {
          el.className = "gs-coord none";
          $("coordTxt").textContent = "ยังไม่ได้เลือกตำแหน่ง";
          return;
        }
        el.className = "gs-coord";
        $("coordTxt").innerHTML = `${work.lat.toFixed(6)}, ${work.lng.toFixed(6)} · <a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${work.lat},${work.lng}">Google Maps</a>`;
        $("lat").value = work.lat.toFixed(6);
        $("lng").value = work.lng.toFixed(6);
      }

      function currentLayers() {
        return editing !== null && siteObjs[editing] ? siteObjs[editing] : newMarker ? { marker: newMarker, circle: newCircle } : null;
      }

      function setWork(lat, lng, pan) {
        lat = Number(lat);
        lng = Number(lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
        work = { lat, lng };
        showCoord();
        if (hasMap) {
          const ll = [lat, lng];
          if (editing !== null && siteObjs[editing]) {
            siteObjs[editing].marker.setLatLng(ll);
            siteObjs[editing].circle.setLatLng(ll).setRadius(radiusVal());
          } else {
            if (!newMarker) {
              newMarker = L.marker(ll, { icon: pin("#16a34a"), draggable: true, zIndexOffset: 1000 }).addTo(map).bindTooltip("จุดใหม่ (ลากเพื่อปรับ)");
              newCircle = L.circle(ll, { radius: radiusVal(), color: "#16a34a", weight: 2, fillOpacity: 0.14 }).addTo(map);
              newMarker.on("drag", (e) => {
                const p = e.target.getLatLng();
                newCircle.setLatLng(p);
                work = { lat: p.lat, lng: p.lng };
                showCoord();
              });
            } else {
              newMarker.setLatLng(ll);
              newCircle.setLatLng(ll).setRadius(radiusVal());
            }
          }
          if (pan) map.setView(ll, Math.max(map.getZoom(), 17));
        }
      }

      function clearNew() {
        if (newMarker) {
          map.removeLayer(newMarker);
          map.removeLayer(newCircle);
        }
        newMarker = newCircle = null;
      }

      // ---------- เปลี่ยนโหมด: เพิ่มจุดใหม่ / แก้จุดเดิม ----------
      function newMode() {
        editing = null;
        work = null;
        if (hasMap) clearNew();
        $("name").value = "";
        $("radius").value = 100;
        $("rVal").textContent = 100;
        $("edTitle").textContent = "เพิ่มจุดใหม่";
        $("saveTxt").textContent = "บันทึกจุดนี้";
        $("del").hidden = true;
        $("q").value = "";
        $("results").hidden = true;
        say("qMsg", "mute", "หรือกดบนแผนที่เพื่อปักหมุดได้เลย");
        say("saveMsg", "", "");
        showCoord();
        applySelection();
      }

      function selectSite(i) {
        const s = sites[i];
        if (!s) return;
        if (hasMap) clearNew();
        editing = i;
        work = { lat: Number(s.lat), lng: Number(s.lng) };
        $("name").value = s.name;
        $("radius").value = Number(s.radius);
        $("rVal").textContent = Number(s.radius);
        $("edTitle").textContent = "แก้ไขจุด: " + s.name;
        $("saveTxt").textContent = "บันทึกการแก้ไข";
        $("del").hidden = false;
        say("qMsg", "mute", "ลากหมุดสีเขียว หรือกดบนแผนที่เพื่อย้ายตำแหน่ง");
        say("saveMsg", "", "");
        showCoord();
        applySelection();
        if (hasMap) map.setView([work.lat, work.lng], Math.max(map.getZoom(), 17));
        $("editor").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }

      // หมุดของจุดที่เลือก = ลากได้ + สีเขียว ; จุดอื่น = สีแดงนิ่ง
      function applySelection() {
        document.querySelectorAll(".gs-site").forEach((b) => b.classList.toggle("sel", Number(b.dataset.i) === editing));
        if (!hasMap) return;
        siteObjs.forEach((o, i) => {
          const on = i === editing;
          o.marker.setIcon(pin(on ? "#16a34a" : "#ef4444"));
          o.circle.setStyle({ color: on ? "#16a34a" : "#ef4444", fillOpacity: on ? 0.14 : 0.08 });
          on ? o.marker.dragging.enable() : o.marker.dragging.disable();
        });
      }

      // ---------- รายการจุด ----------
      function render(list, fit) {
        sites = list;
        $("sites").innerHTML = sites.length
          ? sites
              .map(
                (s, i) =>
                  `<button type="button" class="gs-site" data-i="${i}"><span class="ic"><i class="fa-solid fa-industry"></i></span><span><b>${esc(s.name)}</b><small>รัศมี ${Number(s.radius)} ม. · ${Number(s.lat).toFixed(5)}, ${Number(s.lng).toFixed(5)}</small></span></button>`,
              )
              .join("")
          : '<div class="gs-empty">ยังไม่มีจุด — ค้นหาที่ตั้งหรือกดบนแผนที่ แล้วบันทึกด้านล่าง (ถ้าไม่มีจุด ระบบจะบันทึกพิกัดอย่างเดียว ไม่ตรวจว่าอยู่นอกวงหรือไม่)</div>';
        if (!hasMap) return;
        siteObjs.forEach((o) => {
          map.removeLayer(o.marker);
          map.removeLayer(o.circle);
        });
        siteObjs = sites.map((s, i) => {
          const ll = [Number(s.lat), Number(s.lng)];
          const circle = L.circle(ll, { radius: Number(s.radius), color: "#ef4444", weight: 2, fillOpacity: 0.08 }).addTo(map);
          const marker = L.marker(ll, { icon: pin("#ef4444"), draggable: false }).addTo(map).bindTooltip(`${esc(s.name)} · รัศมี ${Number(s.radius)} ม.`);
          marker.on("click", () => selectSite(i));
          marker.on("drag", (e) => {
            const p = e.target.getLatLng();
            circle.setLatLng(p);
            work = { lat: p.lat, lng: p.lng };
            showCoord();
          });
          return { marker, circle };
        });
        if (fit && sites.length) map.fitBounds(L.latLngBounds(sites.map((s) => [Number(s.lat), Number(s.lng)])).pad(0.3), { maxZoom: 17 });
        applySelection();
      }

      function load() {
        fetch("geo_sites_api.php")
          .then((r) => r.json())
          .then((d) => render(d.sites || [], true))
          .catch(() => ($("sites").innerHTML = '<div class="gs-empty">โหลดรายการไม่สำเร็จ</div>'));
      }
      function post(body) {
        return fetch("geo_sites_api.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      }

      $("sites").addEventListener("click", (e) => {
        const b = e.target.closest(".gs-site");
        if (b) selectSite(Number(b.dataset.i));
      });
      $("newBtn").addEventListener("click", newMode);

      // ---------- รัศมี / พิกัดที่พิมพ์เอง ----------
      $("radius").addEventListener("input", () => {
        $("rVal").textContent = radiusVal();
        const l = currentLayers();
        if (l) l.circle.setRadius(radiusVal());
      });
      const fromInputs = () => {
        const lat = parseFloat($("lat").value),
          lng = parseFloat($("lng").value);
        if (Number.isFinite(lat) && Number.isFinite(lng)) setWork(lat, lng, true);
      };
      $("lat").addEventListener("change", fromInputs);
      $("lng").addEventListener("change", fromInputs);

      // ---------- บันทึก / ลบ ----------
      $("save").addEventListener("click", () => {
        say("saveMsg", "", "");
        if (!work) return say("saveMsg", "bad", "ยังไม่ได้เลือกตำแหน่ง — ค้นหาที่ตั้ง หรือกดบนแผนที่ก่อน");
        const name = $("name").value.trim();
        if (!name) return say("saveMsg", "bad", "กรุณาตั้งชื่อจุด");
        const body = editing === null
          ? { action: "add", name, lat: work.lat, lng: work.lng, radius: radiusVal() }
          : { action: "update", index: editing, name, lat: work.lat, lng: work.lng, radius: radiusVal() };
        $("save").disabled = true;
        post(body)
          .then((d) => {
            if (d.success) {
              const wasNew = editing === null;
              const idx = editing;
              if (hasMap) clearNew();
              render(d.sites);
              if (wasNew) {
                newMode();
                say("saveMsg", "ok", "บันทึกจุดใหม่แล้ว");
              } else {
                selectSite(idx);
                say("saveMsg", "ok", "บันทึกการแก้ไขแล้ว");
              }
            } else say("saveMsg", "bad", d.message || "บันทึกไม่สำเร็จ");
          })
          .catch(() => say("saveMsg", "bad", "ติดต่อเซิร์ฟเวอร์ไม่ได้"))
          .finally(() => ($("save").disabled = false));
      });

      $("del").addEventListener("click", async () => {
        if (editing === null) return;
        if (!(await AppDialog.confirm({ title: "ลบจุดนี้?", message: "ระบบจะไม่ใช้จุดนี้ตรวจพิกัดอีก", confirmText: "ลบ", danger: true }))) return;
        post({ action: "delete", index: editing }).then((d) => {
          if (d.success) {
            render(d.sites);
            newMode();
          } else AppDialog.alert(d.message || "ลบไม่สำเร็จ", { type: "error" });
        });
      });

      // ---------- ค้นหาที่ตั้ง: พิกัด / ลิงก์ Google Maps / ชื่อสถานที่ ----------
      function parseCoordsOrLink(q) {
        const g = q.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || q.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || q.match(/[?&](?:q|ll|query)=(-?\d+\.\d+)(?:,|%2C)(-?\d+\.\d+)/i);
        const m = g || q.match(/^\s*(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)\s*$/);
        if (!m) return null;
        const lat = parseFloat(m[1]),
          lng = parseFloat(m[2]);
        return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
      }

      function doSearch() {
        const q = $("q").value.trim();
        $("results").hidden = true;
        if (!q) return;
        const direct = parseCoordsOrLink(q);
        if (direct) {
          setWork(direct.lat, direct.lng, true);
          return say("qMsg", "ok", "ปักหมุดตามพิกัดแล้ว — ตรวจตำแหน่งบนแผนที่ (สลับเป็นดาวเทียมได้) แล้วกดบันทึก");
        }
        if (/^https?:\/\/(maps\.app\.goo\.gl|goo\.gl)/i.test(q)) {
          return say("qMsg", "warn", "ลิงก์แบบย่อ (maps.app.goo.gl) อ่านพิกัดไม่ได้ — เปิดลิงก์ใน Google Maps แล้วคัดลอก URL เต็มจากแถบที่อยู่ หรือคลิกขวาที่จุดแล้วคัดลอกพิกัดมาวาง");
        }
        say("qMsg", "mute", "กำลังค้นหา...");
        fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=th&countrycodes=th&q=" + encodeURIComponent(q))
          .then((r) => r.json())
          .then((list) => {
            if (!list.length) return say("qMsg", "warn", "ไม่พบสถานที่นี้ — ลองคำค้นอื่น หรือกดบนแผนที่เอง");
            say("qMsg", "mute", "เลือกผลลัพธ์ที่ตรงที่สุด:");
            $("results").innerHTML = list.map((r, i) => `<li><button type="button" data-i="${i}">${esc(r.display_name)}</button></li>`).join("");
            $("results").hidden = false;
            $("results").onclick = (e) => {
              const b = e.target.closest("button");
              if (!b) return;
              const r = list[Number(b.dataset.i)];
              setWork(parseFloat(r.lat), parseFloat(r.lon), true);
              $("results").hidden = true;
              say("qMsg", "ok", "ปักหมุดแล้ว — ตรวจตำแหน่งบนแผนที่ แล้วปรับหมุดให้ตรงลานจอดก่อนบันทึก");
            };
          })
          .catch(() => say("qMsg", "bad", "ค้นหาไม่สำเร็จ (เครื่องนี้อาจเข้าอินเทอร์เน็ตภายนอกไม่ได้) — กดบนแผนที่หรือใส่พิกัดเองแทนได้"));
      }
      $("qBtn").addEventListener("click", doSearch);
      $("q").addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault(), doSearch()));

      // ---------- GPS ของเครื่องนี้: อ่านต่อเนื่อง 15 วินาที เก็บค่าที่คลาดน้อยที่สุด ----------
      function showMe(p) {
        if (!hasMap) return;
        const ll = [p.coords.latitude, p.coords.longitude];
        if (!meMarker) {
          meCircle = L.circle(ll, { radius: p.coords.accuracy, color: "#2563eb", weight: 1, fillOpacity: 0.12 }).addTo(map);
          meMarker = L.circleMarker(ll, { radius: 7, color: "#fff", weight: 2, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map).bindTooltip("ตำแหน่งเครื่องนี้");
        } else {
          meMarker.setLatLng(ll);
          meCircle.setLatLng(ll).setRadius(p.coords.accuracy);
        }
      }
      let gpsWatch = null;
      $("gpsBtn").addEventListener("click", () => {
        if (!navigator.geolocation) return say("gpsMsg", "bad", "เบราว์เซอร์นี้อ่านตำแหน่งไม่ได้");
        if (gpsWatch !== null) return;
        let best = null;
        const t0 = Date.now();
        $("gpsBtn").disabled = true;
        const finish = () => {
          if (gpsWatch === null) return;
          navigator.geolocation.clearWatch(gpsWatch);
          gpsWatch = null;
          $("gpsBtn").disabled = false;
          if (!best) return say("gpsMsg", "bad", "อ่านตำแหน่งไม่ได้ (ไม่ได้อนุญาต / ไม่มีสัญญาณ GPS / ไม่ใช่ HTTPS)");
          const a = Math.round(best.coords.accuracy);
          setWork(best.coords.latitude, best.coords.longitude, true);
          say("gpsMsg", a <= 20 ? "ok" : a <= 50 ? "warn" : "bad", `ปักหมุดจาก GPS แล้ว (คลาดเคลื่อนประมาณ ${a} ม.)` + (a > 50 ? " — คลาดมาก ควรใช้มือถือในที่โล่ง หรือลากหมุดให้ตรงลานจอดบนภาพดาวเทียม" : a > 20 ? " — ตรวจตำแหน่งบนภาพดาวเทียมอีกครั้ง" : ""));
        };
        gpsWatch = navigator.geolocation.watchPosition(
          (p) => {
            if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
            showMe(best);
            say("gpsMsg", "mute", `กำลังจับสัญญาณ... ดีที่สุดตอนนี้ ±${Math.round(best.coords.accuracy)} ม. (${Math.round((Date.now() - t0) / 1000)} วินาที)`);
            if (best.coords.accuracy <= 8) finish();
          },
          (err) => {
            if (!best && gpsWatch !== null) {
              navigator.geolocation.clearWatch(gpsWatch);
              gpsWatch = null;
              $("gpsBtn").disabled = false;
              say("gpsMsg", "bad", err.code === 1 ? "ไม่ได้อนุญาตให้อ่านตำแหน่ง (ตั้งค่าเบราว์เซอร์ > อนุญาตตำแหน่ง)" : "อ่านตำแหน่งไม่ได้ (ไม่มีสัญญาณ GPS หรือไม่ใช่ HTTPS)");
            }
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        );
        setTimeout(finish, 15000);
      });

      load();
    </script>
    <script src="profile-menu.js?v=1"></script>
  </body>
</html>
