<?php require_once 'guard_admin.php'; ?>
<!doctype html>
<html lang="th">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ตั้งจุดตรวจพิกัด - Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;600&display=swap" rel="stylesheet" />
    <style>
      body{margin:0;background:#0d0f16;color:#f1f2f6;font-family:"Prompt",sans-serif;padding:20px}
      .wrap{max-width:560px;margin:0 auto}
      a.back{color:#9ea3b3;text-decoration:none;font-size:14px}
      h1{font-size:22px;margin:10px 0 4px}
      p.sub{color:#9ea3b3;font-size:13.5px;margin:0 0 18px;line-height:1.55}
      .card{background:#15151b;border:.5px solid rgba(255,255,255,.1);border-radius:16px;padding:16px 18px;margin-bottom:14px}
      .card h2{font-size:15px;margin:0 0 12px}
      label{display:block;font-size:12.5px;color:#9ea3b3;margin:10px 0 5px}
      input{width:100%;box-sizing:border-box;height:44px;padding:0 12px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#1b1c25;color:#f1f2f6;font:inherit;font-size:15px}
      input:focus{outline:none;border-color:#ff6b6b;box-shadow:0 0 0 3px rgba(255,77,77,.16)}
      .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      button{font:inherit;cursor:pointer;border-radius:12px;border:none}
      .btn{width:100%;height:46px;margin-top:12px;background:#ff4d4d;color:#fff;font-weight:600;font-size:15px}
      .btn.ghost{background:rgba(255,255,255,.07);color:#e5e7eb;border:1px solid rgba(255,255,255,.14)}
      .site{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:.5px solid rgba(255,255,255,.08)}
      .site:last-child{border-bottom:none}
      .site b{display:block;font-size:14.5px}
      .site span{font-size:12.5px;color:#9ea3b3}
      .site .del{margin-left:auto;background:rgba(255,77,77,.14);color:#ff8a8a;padding:8px 12px;font-size:13px}
      .site a{color:#7cc4ff;font-size:12.5px}
      .msg{font-size:13px;margin-top:10px;min-height:18px}
      .empty{color:#9ea3b3;font-size:13.5px}
    </style>
  </head>
  <body>
    <div class="wrap">
      <a class="back" href="index.html">← กลับหน้าแอดมิน</a>
      <h1>ตั้งจุดตรวจพิกัดของบริษัท</h1>
      <p class="sub">
        ตอนเช็คอินและคืนรถ ระบบเทียบตำแหน่งมือถือผู้ขับกับจุดเหล่านี้ ถ้าอยู่นอกรัศมีหรือไม่มีพิกัด จะไม่บล็อก แต่ติดธงให้แอดมินเห็น
        ยังไม่ตั้งจุดใดเลย = ระบบบันทึกพิกัดอย่างเดียว ไม่ตัดสินผ่าน/ไม่ผ่าน
      </p>

      <div class="card">
        <h2>จุดที่ตั้งไว้แล้ว</h2>
        <div id="sites"><div class="empty">กำลังโหลด...</div></div>
      </div>

      <div class="card">
        <h2>เพิ่มจุดใหม่</h2>
        <button type="button" class="btn ghost" id="useHere" style="margin-top:0">ใช้ตำแหน่งปัจจุบันของเครื่องนี้</button>
        <div class="msg" id="hereMsg"></div>
        <label for="name">ชื่อจุด</label>
        <input id="name" placeholder="เช่น โรงงานหลัก" value="โรงงานหลัก" />
        <div class="row">
          <div><label for="lat">ละติจูด</label><input id="lat" inputmode="decimal" placeholder="13.xxxxxx" /></div>
          <div><label for="lng">ลองจิจูด</label><input id="lng" inputmode="decimal" placeholder="100.xxxxxx" /></div>
        </div>
        <label for="radius">รัศมีที่ยอมรับ (เมตร)</label>
        <input id="radius" inputmode="numeric" value="300" />
        <button type="button" class="btn" id="add">บันทึกจุดนี้</button>
        <div class="msg" id="addMsg"></div>
        <p class="sub" style="margin:10px 0 0;font-size:12.5px">
          หาพิกัดได้จาก Google Maps: กดค้างที่จุดลานจอดรถ แล้วคัดลอกตัวเลขสองตัวที่ขึ้น หรือเปิดหน้านี้บนมือถือขณะยืนอยู่ที่จุดนั้น แล้วกดปุ่ม "ใช้ตำแหน่งปัจจุบัน"
          (ต้องเปิดผ่าน HTTPS หรือ localhost เบราว์เซอร์ถึงจะยอมให้อ่านตำแหน่ง)
        </p>
      </div>
    </div>

    <script src="../Car/ui-dialog.js?v=1"></script>
    <script>
      const $ = (id) => document.getElementById(id);
      const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      function render(sites) {
        $("sites").innerHTML = sites.length
          ? sites.map((s, i) => `<div class="site"><div><b>${esc(s.name)}</b><span>${s.lat}, ${s.lng} · รัศมี ${s.radius} ม.</span><br><a target="_blank" rel="noopener" href="https://www.google.com/maps?q=${s.lat},${s.lng}">ดูบนแผนที่</a></div><button class="del" data-i="${i}">ลบ</button></div>`).join("")
          : '<div class="empty">ยังไม่มีจุด (ระบบบันทึกพิกัดอย่างเดียว)</div>';
      }
      function load() {
        fetch("geo_sites_api.php").then((r) => r.json()).then((d) => render(d.sites || []));
      }
      function post(body) {
        return fetch("geo_sites_api.php", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
      }
      $("sites").addEventListener("click", async (e) => {
        const b = e.target.closest(".del");
        if (!b) return;
        if (!(await AppDialog.confirm({ title: "ลบจุดนี้?", message: "ระบบจะไม่ใช้จุดนี้ตรวจพิกัดอีก", confirmText: "ลบ", danger: true }))) return;
        post({ action: "delete", index: Number(b.dataset.i) }).then((d) => (d.success ? render(d.sites) : alert(d.message)));
      });
      $("add").addEventListener("click", () => {
        $("addMsg").textContent = "";
        post({ action: "add", name: $("name").value, lat: $("lat").value, lng: $("lng").value, radius: $("radius").value }).then((d) => {
          if (d.success) {
            render(d.sites);
            $("addMsg").style.color = "#4ade80";
            $("addMsg").textContent = "บันทึกแล้ว";
          } else {
            $("addMsg").style.color = "#ff8a8a";
            $("addMsg").textContent = d.message || "บันทึกไม่สำเร็จ";
          }
        });
      });
      $("useHere").addEventListener("click", () => {
        $("hereMsg").style.color = "#9ea3b3";
        $("hereMsg").textContent = "กำลังอ่านตำแหน่ง...";
        if (!navigator.geolocation) {
          $("hereMsg").textContent = "เบราว์เซอร์นี้อ่านตำแหน่งไม่ได้";
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => {
            $("lat").value = p.coords.latitude.toFixed(6);
            $("lng").value = p.coords.longitude.toFixed(6);
            $("hereMsg").style.color = "#4ade80";
            $("hereMsg").textContent = "ได้ตำแหน่งแล้ว (คลาดเคลื่อนประมาณ " + Math.round(p.coords.accuracy) + " ม.) ตรวจแล้วกดบันทึก";
          },
          () => {
            $("hereMsg").style.color = "#ff8a8a";
            $("hereMsg").textContent = "อ่านตำแหน่งไม่ได้ (ไม่ได้อนุญาต หรือไม่ใช่ HTTPS)";
          },
          { enableHighAccuracy: true, timeout: 10000 },
        );
      });
      load();
    </script>
  </body>
</html>
