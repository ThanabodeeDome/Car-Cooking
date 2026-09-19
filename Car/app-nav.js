/* app-nav.js — แถบเมนูใหม่ทุกหน้าของผู้ใช้ (แทน <nav class="nav-bar"> เดิม)
   - คอม: แคปซูลลอยด้านบน โลโก้ซ้าย เมนูกลาง กระดิ่ง+โปรไฟล์ขวา
   - มือถือ: แถบบน (โลโก้/กระดิ่ง/โปรไฟล์) + แถบล่าง 5 ปุ่ม ปุ่มจองเด่นตรงกลาง
   ต้องโหลดก่อน notify-bell.js (กระดิ่งจะไปเกาะที่ #an-bell-slot) */
(function () {
  "use strict";
  if (document.getElementById("an-top")) return;

  const LINKS = [
    { href: "homepage.html", label: "หน้าหลัก", match: ["homepage"] },
    { href: "booking.html", label: "จองรถ", match: ["booking", "checkin", "return_scan"] },
    { href: "car-status.html", label: "เช็กคิว", match: ["car-status"] },
    { href: "booking-details.html", label: "การจองของฉัน", match: ["booking-details"] },
  ];
  const page = (location.pathname.split("/").pop() || "").replace(/\.(html|php)$/, "");
  const isOn = (l) => l.match.includes(page);
  const profileActive = page === "profile" || page === "car-details";

  if (page === "homepage") document.body.classList.add("an-nopad");
  const old = document.querySelector("nav.nav-bar");
  if (old) old.remove();

  const style = document.createElement("style");
  style.textContent = `
  body{padding-top:36px}
  body.an-nopad{padding-top:0}
  .an-top{position:fixed;top:8px;left:50%;transform:translateX(-50%);width:min(1180px,calc(100% - 24px));height:52px;z-index:1000;box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 8px 0 18px;background:rgba(23,26,36,.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:.5px solid rgba(255,255,255,.12);border-radius:999px;font-family:"Prompt","Sarabun",sans-serif}
  .an-logo{display:flex;align-items:center;flex:none}
  .an-logo img{height:28px;width:auto;display:block}
  .an-links{display:flex;gap:2px;list-style:none;margin:0;padding:0}
  .an-links a{display:block;padding:8px 16px;border-radius:999px;color:#b4b8c6;font-size:14px;text-decoration:none;transition:background .15s,color .15s;white-space:nowrap}
  .an-links a:hover{background:rgba(255,255,255,.07);color:#fff}
  .an-links a.on{background:rgba(229,37,42,.16);color:#ff6b6b}
  .an-links a:focus-visible,.an-av:focus-visible,.an-tab:focus-visible,.an-mid:focus-visible{outline:2px solid #ff6b6b;outline-offset:2px}
  .an-right{display:flex;align-items:center;gap:4px;flex:none}
  .an-av{width:36px;height:36px;border-radius:50%;background:rgba(229,37,42,.16);border:1px solid #e5252a;color:#ff8a8a;font:500 14px "Prompt",sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0}
  .an-av[aria-expanded="true"]{background:rgba(229,37,42,.3)}
  .an-av{overflow:hidden}
  .an-av img{width:100%;height:100%;object-fit:cover;display:block}
  .an-menu{position:fixed;top:66px;right:max(12px,calc((100% - 1180px)/2 + 8px));width:220px;background:#171a24;border:.5px solid rgba(255,255,255,.14);border-radius:14px;padding:6px;box-shadow:0 20px 50px -12px rgba(0,0,0,.7);z-index:1200;font-family:"Prompt","Sarabun",sans-serif}
  .an-menu[hidden]{display:none}
  .an-who{padding:8px 10px 10px;border-bottom:.5px solid rgba(255,255,255,.1);margin-bottom:4px}
  .an-who b{display:block;font-size:14px;font-weight:500;color:#fff}
  .an-who span{font-size:12px;color:#9aa0b3}
  .an-mi{display:flex;align-items:center;gap:10px;width:100%;box-sizing:border-box;padding:10px;border:none;background:none;border-radius:8px;color:#d7dae6;font:inherit;font-size:13.5px;text-align:left;text-decoration:none;cursor:pointer}
  .an-mi:hover{background:rgba(255,255,255,.07)}
  .an-mi svg{width:17px;height:17px;flex:none;color:#9aa0b3}
  .an-mi.out,.an-mi.out svg{color:#ff8a8a}
  .an-bottom{display:none}
  @media (max-width:768px){
    .an-links{display:none}
    .an-top{padding:0 6px 0 16px}
    body{padding-bottom:88px}
    .an-bottom{display:flex;position:fixed;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom));width:min(520px,calc(100% - 20px));height:56px;box-sizing:border-box;align-items:center;justify-content:space-around;padding:0 6px;background:rgba(23,26,36,.94);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:.5px solid rgba(255,255,255,.12);border-radius:999px;z-index:1000;font-family:"Prompt","Sarabun",sans-serif}
    .an-tab{display:flex;flex-direction:column;align-items:center;gap:1px;width:56px;color:#9aa0b3;font-size:11px;text-decoration:none;background:none;border:none;padding:4px 0;cursor:pointer;font-family:inherit}
    .an-tab svg{width:22px;height:22px}
    .an-tab.on{color:#ff6b6b}
    .an-mid{width:52px;height:52px;margin-top:-24px;border-radius:50%;background:#e5252a;color:#fff;border:4px solid #0d0f16;box-sizing:content-box;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;text-decoration:none}
    .an-mid svg{width:26px;height:26px}
    .an-mid:active{transform:scale(.95)}
    #fab-add{display:none!important}
    .an-menu{right:12px}
  }
  @media (prefers-reduced-motion:reduce){.an-links a{transition:none}}`;
  document.head.appendChild(style);

  const I = {
    home: '<path d="M5 12l-2 0l9 -9l9 9l-2 0"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>',
    queue: '<path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4"/><path d="M18 18m-4 0a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M15 3v4"/><path d="M7 3v4"/><path d="M3 11h16"/><path d="M18 16.496v1.504l1 1"/>',
    plus: '<path d="M12 5l0 14"/><path d="M5 12l14 0"/>',
    history: '<path d="M12 8l0 4l2 2"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>',
    list: '<path d="M13 5h8"/><path d="M13 9h5"/><path d="M13 15h8"/><path d="M13 19h5"/><path d="M3 4m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/><path d="M3 14m0 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1z"/>',
    user: '<path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>',
    car: '<path d="M5 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M5 17h-2v-6l2 -5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 0v-5"/>',
    out: '<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3"/><path d="M18 15l3 -3"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[k]}</svg>`;

  const top = document.createElement("header");
  top.id = "an-top";
  top.className = "an-top";
  top.innerHTML = `
    <a class="an-logo" href="homepage.html" aria-label="หน้าหลัก"><img src="assets/image/CH2.png" alt="CH" /></a>
    <ul class="an-links">${LINKS.map((l) => `<li><a href="${l.href}"${isOn(l) ? ' class="on" aria-current="page"' : ""}>${l.label}</a></li>`).join("")}</ul>
    <div class="an-right">
      <span id="an-bell-slot" style="display:flex"></span>
      <button type="button" class="an-av" id="an-av" aria-label="เมนูผู้ใช้" aria-expanded="false" aria-haspopup="true">?</button>
    </div>`;

  const menu = document.createElement("div");
  menu.id = "an-menu";
  menu.className = "an-menu";
  menu.hidden = true;
  menu.innerHTML = `
    <div class="an-who"><b id="an-name">ผู้ใช้</b><span id="an-emp"></span></div>
    <a class="an-mi" href="profile.html">${svg("user")}ข้อมูลผู้ใช้</a>
    <a class="an-mi" href="car-details.html">${svg("car")}รายละเอียดรถยนต์</a>
    <button type="button" class="an-mi out" id="an-logout">${svg("out")}ออกจากระบบ</button>`;

  const bottom = document.createElement("nav");
  bottom.className = "an-bottom";
  bottom.setAttribute("aria-label", "เมนูหลัก");
  const tab = (href, icon, label, on) =>
    `<a class="an-tab${on ? " on" : ""}" href="${href}"${on ? ' aria-current="page"' : ""}>${svg(icon)}${label}</a>`;
  bottom.innerHTML =
    tab("homepage.html", "home", "หน้าหลัก", page === "homepage") +
    tab("car-status.html", "queue", "เช็กคิว", page === "car-status") +
    `<a class="an-mid" id="an-mid" href="booking.html" aria-label="จองรถ">${svg("plus")}</a>` +
    tab("booking-details.html", "history", "ประวัติ", page === "booking-details") +
    tab("profile.html", "user", "ฉัน", profileActive);

  document.body.prepend(top);
  document.body.append(menu, bottom);

  // ปุ่มจองกลาง: หน้าจองมีฟอร์มแบบ modal อยู่แล้ว เปิดได้เลย ไม่ต้องโหลดหน้าใหม่
  const mid = bottom.querySelector("#an-mid");
  mid.addEventListener("click", (e) => {
    if (typeof window.openQuickBooking === "function") {
      e.preventDefault();
      window.openQuickBooking();
    }
  });

  const av = top.querySelector("#an-av");
  const setMenu = (open) => {
    menu.hidden = !open;
    av.setAttribute("aria-expanded", String(open));
  };
  av.addEventListener("click", (e) => {
    e.stopPropagation();
    setMenu(menu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !menu.contains(e.target)) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      setMenu(false);
      av.focus();
    }
  });

  menu.querySelector("#an-logout").addEventListener("click", async () => {
    setMenu(false);
    const ok = window.AppDialog
      ? await window.AppDialog.confirm({ title: "ออกจากระบบ", message: "คุณต้องการออกจากระบบใช่หรือไม่?", confirmText: "ออกจากระบบ", cancelText: "อยู่ต่อ" })
      : confirm("คุณต้องการออกจากระบบใช่หรือไม่?");
    if (!ok) return;
    fetch("../logout.php")
      .catch(() => {})
      .finally(() => (window.location.href = "index.html"));
  });

  fetch("get_current_user.php", { cache: "no-store" })
    .then((r) => r.json())
    .then((u) => {
      if (!u || !u.success) return;
      const name = u.first_name || "ผู้ใช้";
      window.setNavAvatar = (path) => {
        if (path) {
          av.textContent = "";
          const img = document.createElement("img");
          img.alt = "";
          img.src = path + (path.indexOf("?") < 0 ? "?t=" + Date.now() : "");
          img.onerror = () => { av.textContent = Array.from(name)[0].toUpperCase(); };
          av.appendChild(img);
        } else {
          av.textContent = Array.from(name)[0].toUpperCase();
        }
      };
      window.setNavAvatar(u.avatar_path);
      menu.querySelector("#an-name").textContent = name;
      menu.querySelector("#an-emp").textContent = u.employee_id ? "รหัส " + u.employee_id : "";
    })
    .catch(() => {});
})();
