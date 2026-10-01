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
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
    <style>
      .geo-wrap { max-width: 980px; margin: 0 auto; }
      .geo-map { height: 460px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; background: #f1f5f9; z-index: 0; }
      .geo-map-fallback { height: 100%; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 14px; text-align: center; padding: 0 20px; }
      .map-legend { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: #475569; margin-top: 10px; }
      .map-legend span::before { content: ""; display: inline-block; width: 11px; height: 11px; border-radius: 50%; margin-right: 6px; vertical-align: -1px; }
      .lg-site::before { background: #ef4444; } .lg-new::before { background: #16a34a; } .lg-me::before { background: #2563eb; }
      .gps-bar { display: flex; align-items: center; gap: 10px; margin-top: 10px; font-size: 13px; }
      .gps-bar .acc { font-weight: 600; }
      .acc.good { color: #16a34a; } .acc.ok { color: #d97706; } .acc.poor { color: #dc2626; }
      .gps-stop { border: 1px solid #cbd5e1; background: #fff; border-radius: 8px; padding: 6px 12px; font: inherit; font-size: 13px; cursor: pointer; }
      .site-row { cursor: pointer; }
      .site-row.is-focus { background: #fef2f2; border-radius: 10px; }
      .site-save { margin-left: auto; border: 1px solid #bbf7d0; background: #f0fdf4; color: #15803d; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 13px; cursor: pointer; }
      .site-save + .site-del { margin-left: 8px; }
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
          <h2 class="panel-title"><i class="fa-solid fa-map-location-dot"></i> แผนที่ GPS</h2>
          <div id="map" class="geo-map"><div class="geo-map-fallback">กำลังโหลดแผนที่...</div></div>
          <div class="map-legend">
            <span class="lg-site">จุดที่บันทึกแล้ว (ลากหมุดเพื่อย้ายได้)</span>
            <span class="lg-new">จุดใหม่ที่จะเพิ่ม (คลิกบนแผนที่เพื่อปักหมุด)</span>
            <span class="lg-me">ตำแหน่ง GPS ของเครื่องนี้ + วงความคลาดเคลื่อน</span>
          </div>
        </div>

        <div class="dash-panel">
          <h2 class="panel-title"><i class="fa-solid fa-location-dot"></i> จุดที่ตั้งไว้แล้ว</h2>
          <div id="sites"><div class="empty-hint">กำลังโหลด...</div></div>
        </div>

        <div class="dash-panel">
          <h2 class="panel-title"><i class="fa-solid fa-plus"></i> เพิ่มจุดใหม่</h2>
          <button type="button" class="here-btn" id="useHere">
            <i class="fa-solid fa-crosshairs"></i> ใช้ตำแหน่งปัจจุบันของเครื่องนี้ (อ่าน GPS หลายครั้ง เลือกค่าที่แม่นที่สุด)
          </button>
          <div class="gps-bar" id="gpsBar" hidden>
            <span id="gpsText">กำลังจับสัญญาณ GPS...</span>
            <button type="button" class="gps-stop" id="gpsStop">ใช้ค่านี้เลย</button>
          </div>
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
            วิธีที่แม่นที่สุด: เปิดหน้านี้บนมือถือขณะยืนอยู่กลางลานจอดรถ (ที่โล่ง) กด "ใช้ตำแหน่งปัจจุบัน" แล้วรอจนความคลาดเคลื่อนเป็นสีเขียว (≤ 20 ม.)
            จากนั้นสลับเป็นภาพ "ดาวเทียม" ตรวจว่าหมุดเขียวอยู่ตรงลานจอดจริง ถ้าเพี้ยนให้ลากหมุดไปวางให้ตรง แล้วกดบันทึก
            (เบราว์เซอร์อ่านตำแหน่งได้เฉพาะ HTTPS หรือ localhost) — หรือคลิกบนแผนที่ / กรอกพิกัดจาก Google Maps เองก็ได้
          </div>
        </div>
      </div>
    </div>

    <script src="../Car/ui-dialog.js?v=3"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
    <script>
      const $ = (id) => document.getElementById(id);
      const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      let sites = [];

      // ---------- แผนที่ (Leaflet + OpenStreetMap / ภาพดาวเทียม Esri) ----------
      // ถ้าโหลดไลบรารีแผนที่ไม่ได้ (เน็ตบล็อก CDN) หน้านี้ยังกรอกพิกัดเอง/ใช้ GPS ได้เหมือนเดิม
      const hasMap = typeof L !== "undefined";
      let map, siteLayer, newMarker, newCircle, meMarker, meCircle;
      const pin = (color) =>
        L.divIcon({
          className: "",
          html: `<svg width="28" height="40" viewBox="0 0 28 40"><path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z" fill="${color}" stroke="#fff" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="#fff"/></svg>`,
          iconSize: [28, 40],
          iconAnchor: [14, 40],
          popupAnchor: [0, -36],
        });

      if (hasMap) {
        $("map").innerHTML = "";
        map = L.map("map", { zoomControl: true }).setView([13.736717, 100.523186], 6);
        const street = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }).addTo(map);
        const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
          maxZoom: 19,
          attribution: "Imagery &copy; Esri",
        });
        L.control.layers({ "แผนที่": street, "ดาวเทียม": sat }, null, { position: "topright" }).addTo(map);
        L.control.scale({ imperial: false }).addTo(map);
        siteLayer = L.layerGroup().addTo(map);
        // คลิกบนแผนที่ = ปักหมุดจุดใหม่ตรงนั้น
        map.on("click", (e) => setNewPoint(e.latlng.lat, e.latlng.lng, true));
      } else {
        $("map").innerHTML = '<div class="geo-map-fallback">โหลดแผนที่ไม่ได้ (เครื่องนี้อาจเข้าอินเทอร์เน็ตภายนอกไม่ได้) — ยังกรอกพิกัดเองหรือใช้ GPS ด้านล่างได้ตามปกติ</div>';
      }

      function radiusVal() {
        return Math.max(50, Math.min(5000, parseInt($("radius").value, 10) || 300));
      }

      // หมุดเขียว = จุดใหม่ที่กำลังจะเพิ่ม (ลากปรับตำแหน่งได้, วงกลม = รัศมีที่จะยอมรับ)
      function setNewPoint(lat, lng, fromMap) {
        $("lat").value = Number(lat).toFixed(6);
        $("lng").value = Number(lng).toFixed(6);
        if (!hasMap) return;
        const ll = [Number(lat), Number(lng)];
        if (!newMarker) {
          newMarker = L.marker(ll, { icon: pin("#16a34a"), draggable: true, zIndexOffset: 1000 }).addTo(map).bindTooltip("จุดใหม่ (ลากเพื่อปรับ)");
          newCircle = L.circle(ll, { radius: radiusVal(), color: "#16a34a", weight: 2, fillOpacity: 0.12 }).addTo(map);
          newMarker.on("drag", (e) => {
            const p = e.target.getLatLng();
            newCircle.setLatLng(p);
            $("lat").value = p.lat.toFixed(6);
            $("lng").value = p.lng.toFixed(6);
          });
        } else {
          newMarker.setLatLng(ll);
          newCircle.setLatLng(ll);
        }
        newCircle.setRadius(radiusVal());
        if (!fromMap) map.setView(ll, Math.max(map.getZoom(), 17));
      }

      function syncFromInputs() {
        const lat = parseFloat($("lat").value),
          lng = parseFloat($("lng").value);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) setNewPoint(lat, lng, false);
      }
      $("lat").addEventListener("change", syncFromInputs);
      $("lng").addEventListener("change", syncFromInputs);
      $("radius").addEventListener("input", () => newCircle && newCircle.setRadius(radiusVal()));

      // ---------- รายการจุด + หมุดแดงบนแผนที่ ----------
      function render(list, fit) {
        sites = list;
        $("sites").innerHTML = sites.length
          ? sites
              .map(
                (s, i) =>
                  `<div class="site-row" data-i="${i}"><div class="site-ic"><i class="fa-solid fa-industry"></i></div><div class="site-info"><b>${esc(s.name)}</b><span>${Number(s.lat).toFixed(6)}, ${Number(s.lng).toFixed(6)} · รัศมี ${Number(s.radius)} ม.</span><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${Number(s.lat)},${Number(s.lng)}"><i class="fa-solid fa-up-right-from-square"></i> Google Maps</a></div><button type="button" class="site-save" data-i="${i}" hidden><i class="fa-solid fa-floppy-disk"></i> บันทึกตำแหน่งใหม่</button><button type="button" class="site-del" data-i="${i}"><i class="fa-solid fa-trash"></i> ลบ</button></div>`,
              )
              .join("")
          : '<div class="empty-hint">ยังไม่มีจุด (ระบบบันทึกพิกัดอย่างเดียว)</div>';
        if (!hasMap) return;
        siteLayer.clearLayers();
        const bounds = [];
        sites.forEach((s, i) => {
          const ll = [Number(s.lat), Number(s.lng)];
          const circle = L.circle(ll, { radius: Number(s.radius), color: "#ef4444", weight: 2, fillOpacity: 0.1 }).addTo(siteLayer);
          const m = L.marker(ll, { icon: pin("#ef4444"), draggable: true })
            .addTo(siteLayer)
            .bindTooltip(`${esc(s.name)} · รัศมี ${Number(s.radius)} ม.`);
          // ลากหมุดแดง = ย้ายจุดเดิม (ต้องกด "บันทึกตำแหน่งใหม่" ในรายการก่อนถึงจะมีผล)
          m.on("drag", (e) => circle.setLatLng(e.target.getLatLng()));
          m.on("dragend", (e) => {
            const p = e.target.getLatLng();
            s._moved = { lat: p.lat, lng: p.lng };
            const btn = document.querySelector(`.site-save[data-i="${i}"]`);
            if (btn) btn.hidden = false;
            const span = document.querySelector(`.site-row[data-i="${i}"] .site-info span`);
            if (span) span.textContent = `${p.lat.toFixed(6)}, ${p.lng.toFixed(6)} · รัศมี ${Number(s.radius)} ม. (ยังไม่บันทึก)`;
          });
          bounds.push(ll);
        });
        if (fit && bounds.length) map.fitBounds(L.latLngBounds(bounds).pad(0.3), { maxZoom: 17 });
      }

      function load() {
        fetch("geo_sites_api.php")
          .then((r) => r.json())
          .then((d) => render(d.sites || [], true))
          .catch(() => ($("sites").innerHTML = '<div class="empty-hint">โหลดรายการไม่สำเร็จ</div>'));
      }
      function post(body) {
        return fetch("geo_sites_api.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      }
      function say(id, cls, text) {
        $(id).className = "msg " + cls;
        $(id).textContent = text;
      }

      $("sites").addEventListener("click", async (e) => {
        const del = e.target.closest(".site-del");
        const save = e.target.closest(".site-save");
        if (del) {
          if (!(await AppDialog.confirm({ title: "ลบจุดนี้?", message: "ระบบจะไม่ใช้จุดนี้ตรวจพิกัดอีก", confirmText: "ลบ", danger: true }))) return;
          post({ action: "delete", index: Number(del.dataset.i) }).then((d) => (d.success ? render(d.sites) : AppDialog.alert(d.message || "ลบไม่สำเร็จ", { type: "error" })));
          return;
        }
        if (save) {
          const s = sites[Number(save.dataset.i)];
          if (!s || !s._moved) return;
          post({ action: "update", index: Number(save.dataset.i), lat: s._moved.lat, lng: s._moved.lng }).then((d) =>
            d.success ? render(d.sites) : AppDialog.alert(d.message || "บันทึกไม่สำเร็จ", { type: "error" }),
          );
          return;
        }
        // คลิกที่แถว = เลื่อนแผนที่ไปที่จุดนั้น
        const row = e.target.closest(".site-row");
        if (row && hasMap && !e.target.closest("a")) {
          const s = sites[Number(row.dataset.i)];
          document.querySelectorAll(".site-row").forEach((r) => r.classList.toggle("is-focus", r === row));
          map.setView([Number(s.lat), Number(s.lng)], 17);
          $("map").scrollIntoView({ behavior: "smooth", block: "center" });
        }
      });

      $("add").addEventListener("click", () => {
        say("addMsg", "mute", "");
        post({ action: "add", name: $("name").value, lat: $("lat").value, lng: $("lng").value, radius: $("radius").value }).then((d) => {
          if (d.success) {
            render(d.sites);
            if (newMarker) {
              map.removeLayer(newMarker);
              map.removeLayer(newCircle);
              newMarker = newCircle = null;
            }
            say("addMsg", "ok", "บันทึกแล้ว");
          } else {
            say("addMsg", "bad", d.message || "บันทึกไม่สำเร็จ");
          }
        });
      });

      // ---------- GPS: อ่านต่อเนื่องสูงสุด 20 วินาที เก็บค่าที่ "คลาดเคลื่อนน้อยที่สุด" ----------
      // GPS มือถือครั้งแรกมักคลาด 50-100 ม. ถ้ารอสักพักจะแม่นขึ้นเหลือ 5-15 ม. จึงไม่ใช้ค่าแรกที่ได้
      let watchId = null,
        best = null,
        gpsTimer = null;
      function accClass(a) {
        return a <= 20 ? "good" : a <= 50 ? "ok" : "poor";
      }
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
      function stopGps(useBest) {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(gpsTimer);
        watchId = null;
        $("gpsBar").hidden = true;
        if (!useBest) return;
        if (!best) return say("hereMsg", "bad", "อ่านตำแหน่งไม่ได้ (ไม่ได้อนุญาต, ไม่มีสัญญาณ GPS หรือไม่ใช่ HTTPS)");
        const a = Math.round(best.coords.accuracy);
        setNewPoint(best.coords.latitude, best.coords.longitude, false);
        say(
          "hereMsg",
          a <= 20 ? "ok" : "bad",
          `ปักหมุดจาก GPS แล้ว (คลาดเคลื่อนประมาณ ${a} ม.)` +
            (a > 20 ? " — ค่อนข้างคลาด แนะนำออกไปที่โล่งแล้วลองใหม่ หรือลากหมุดเขียวให้ตรงลานจอดบนภาพดาวเทียม" : " ตรวจตำแหน่งบนแผนที่แล้วกดบันทึก"),
        );
      }
      $("gpsStop").addEventListener("click", () => stopGps(true));
      $("useHere").addEventListener("click", () => {
        if (!navigator.geolocation) return say("hereMsg", "bad", "เบราว์เซอร์นี้อ่านตำแหน่งไม่ได้");
        if (watchId !== null) return;
        best = null;
        say("hereMsg", "mute", "");
        $("gpsBar").hidden = false;
        $("gpsText").textContent = "กำลังจับสัญญาณ GPS...";
        const started = Date.now();
        watchId = navigator.geolocation.watchPosition(
          (p) => {
            if (!best || p.coords.accuracy < best.coords.accuracy) best = p;
            showMe(best);
            const a = Math.round(best.coords.accuracy);
            $("gpsText").innerHTML = `ดีที่สุดตอนนี้: คลาดเคลื่อน <span class="acc ${accClass(a)}">±${a} ม.</span> · อ่านไปแล้ว ${Math.round((Date.now() - started) / 1000)} วินาที`;
            if (a <= 8) stopGps(true); // แม่นพอแล้ว ไม่ต้องรอ
          },
          (err) => {
            if (!best) {
              stopGps(false);
              say("hereMsg", "bad", err.code === 1 ? "ไม่ได้อนุญาตให้อ่านตำแหน่ง (ตั้งค่าเบราว์เซอร์ > อนุญาตตำแหน่ง)" : "อ่านตำแหน่งไม่ได้ (ไม่มีสัญญาณ GPS หรือไม่ใช่ HTTPS)");
            }
          },
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        );
        gpsTimer = setTimeout(() => stopGps(true), 20000);
      });

      load();
    </script>
  </body>
</html>
