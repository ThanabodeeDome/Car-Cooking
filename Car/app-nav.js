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
  .an-links a:focus-visible,.an-av:focus-visible,.an-tab:focus-visible,.an-mid:focus-visible{outline:2px solid #c4b5fd;outline-offset:2px}
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
    .an-mid{width:52px;height:52px;margin-top:-24px;border-radius:50%;background:#7c3aed;color:#fff;border:4px solid #0d0f16;box-sizing:content-box;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;text-decoration:none}
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


  // ป้ายประกาศลอย "รถยังไม่ได้คืน" ให้ทุกคนเห็นทุกหน้า — กด × / ปุ่มรับทราบ / แตะที่ไหนก็ได้ 1 ครั้ง / Esc เพื่อปิด
  // ปิดแล้วจะไม่เด้งซ้ำในแท็บนี้ 30 นาที (เว้นแต่รายการค้างเปลี่ยนไป)
  {
    const ps = document.createElement("style");
    ps.textContent = `
    .an-odp{position:fixed;inset:0;z-index:1500;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;background:radial-gradient(ellipse at 50% 40%,rgba(120,20,26,.35),rgba(4,6,10,.82) 70%);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);cursor:pointer;font-family:"Prompt","Sarabun",sans-serif;animation:odpFade .25s ease-out}
    .an-odp-card{position:relative;width:min(430px,100%);max-height:82vh;overflow:auto;box-sizing:border-box;padding:0 0 18px;background:#14161f;border:1px solid rgba(255,255,255,.1);border-radius:24px;color:#e8eaf2;box-shadow:0 40px 80px -24px rgba(0,0,0,.9),0 0 60px -10px rgba(229,37,42,.45);animation:odpPop .45s cubic-bezier(.2,.9,.3,1.25)}
    .an-odp-hd{position:relative;padding:30px 22px 22px;text-align:center;background:linear-gradient(160deg,#e5252a 0%,#9b1218 100%);overflow:hidden}
    .an-odp-hd::before,.an-odp-hd::after{content:"";position:absolute;border-radius:50%;background:rgba(255,255,255,.08)}
    .an-odp-hd::before{width:180px;height:180px;top:-90px;left:-50px}
    .an-odp-hd::after{width:120px;height:120px;bottom:-60px;right:-20px}
    .an-odp-tag{position:relative;display:inline-block;margin-bottom:10px;padding:3px 12px;border-radius:999px;background:rgba(0,0,0,.28);color:#ffe3e3;font-size:11.5px;font-weight:500;letter-spacing:.14em}
    .an-odp-ic{position:relative;width:190px;max-width:70%;margin:0 auto 6px;animation:odpFloat 3.2s ease-in-out infinite}
    .an-odp-ic svg{display:block;width:100%;height:auto;filter:drop-shadow(0 10px 14px rgba(0,0,0,.35))}.an-odp-ic .bd{transform-origin:162px 26px;animation:odpBadge 1.6s ease-in-out infinite}
    .an-odp h2{position:relative;margin:0;font-size:22px;font-weight:600;color:#fff}
    .an-odp-hd p{position:relative;margin:6px 0 0;font-size:13.5px;line-height:1.6;color:#ffe3e3}
    .an-odp-x{position:absolute;top:12px;right:12px;z-index:1;width:34px;height:34px;padding:0;border:none;border-radius:50%;background:rgba(0,0,0,.28);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
    .an-odp-x:hover{background:rgba(0,0,0,.45)}
    .an-odp-x svg{width:16px;height:16px}
    .an-odp ul{list-style:none;margin:0;padding:16px 16px 4px;display:grid;gap:10px}
    .an-odp li{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:center;padding:12px;background:#1c1f2b;border:1px solid rgba(255,255,255,.07);border-radius:16px}
    .an-odp .plate{grid-row:span 2;min-width:92px;text-align:center;padding:7px 10px;background:#fff;color:#14161f;border:2px solid #14161f;outline:2px solid #fff;border-radius:9px;font-size:17px;font-weight:700;letter-spacing:.5px;box-shadow:0 3px 8px rgba(0,0,0,.4)}
    .an-odp .who{font-size:15px;font-weight:600;color:#fff;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .an-odp .meta{display:flex;flex-wrap:wrap;gap:2px 10px;align-items:center;font-size:12.5px;color:#9aa0b3}
    .an-odp .late{display:inline-flex;align-items:center;gap:5px;color:#ff8a8a;font-weight:600}
    .an-odp .late svg{width:14px;height:14px}
    .an-odp .ct{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin-top:6px;padding-top:10px;border-top:1px solid rgba(255,255,255,.07)}
    .an-odp .av{flex:none;width:34px;height:34px;border-radius:50%;overflow:hidden;background:rgba(229,37,42,.16);border:1px solid #e5252a;color:#ff8a8a;display:flex;align-items:center;justify-content:center;font:500 14px "Prompt",sans-serif}
    .an-odp .av img{width:100%;height:100%;object-fit:cover;display:block}
    .an-odp .ct-t{flex:1;min-width:0;font-size:12px;color:#9aa0b3;line-height:1.4}
    .an-odp .ct-t b{display:block;color:#e8eaf2;font-size:13.5px;font-weight:500}
    .an-odp .tel{flex:none;display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:999px;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.5);color:#4ade80;font-size:13.5px;font-weight:600;text-decoration:none;white-space:nowrap}
    .an-odp .tel svg{width:15px;height:15px}
    .an-odp-ok{display:block;width:calc(100% - 32px);margin:14px 16px 0;padding:13px;border:none;border-radius:14px;background:linear-gradient(135deg,#ff5a5f,#e5252a);box-shadow:0 10px 22px -10px rgba(229,37,42,.8);color:#fff;font:600 15px "Prompt",sans-serif;cursor:pointer}
    .an-odp-hint{margin-top:9px;text-align:center;font-size:12px;color:#6f7589}
    .an-odp-card{display:flex;flex-direction:column;overflow:hidden;max-height:86vh}
    .an-odp-hd{flex:none}
    .an-odp ul{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.22) transparent}
    .an-odp ul::-webkit-scrollbar{width:6px}.an-odp ul::-webkit-scrollbar-thumb{background:rgba(255,255,255,.22);border-radius:6px}
    .an-odp-ok,.an-odp-hint{flex:none}
    .an-odp .ct{margin-top:4px;padding-top:9px}
    .an-odp .ct-lb{flex:1;min-width:0;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#9aa0b3}
    .an-odp .ct .av{width:28px;height:28px;font-size:12px}
    .an-odp.multi .an-odp-hd{padding:20px 20px 14px}
    .an-odp.multi .an-odp-ic{width:96px;margin-bottom:2px}
    .an-odp.multi .an-odp-hd p{display:none}
    .an-odp.multi h2{font-size:19px}
    .an-odp.multi ul{padding:12px 12px 4px;gap:8px}
    .an-odp.multi li{padding:10px 12px;border-radius:14px}
    .an-odp.multi .plate{min-width:78px;font-size:15px;padding:5px 8px}
    .an-odp.multi .who{font-size:14px}
    .an-odp.multi .tel{padding:6px 12px;font-size:13px}
    @keyframes odpFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}@keyframes odpBadge{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}
    @keyframes odpFade{from{opacity:0}to{opacity:1}}
    @keyframes odpPop{0%{opacity:0;transform:scale(.86) translateY(18px)}100%{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.an-odp,.an-odp-card,.an-odp-ic{animation:none}}`;
    document.head.appendChild(ps);
    const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    const dur = (m) => (m >= 1440 ? Math.floor(m / 1440) + " วัน " + Math.floor((m % 1440) / 60) + " ชม." : m >= 60 ? Math.floor(m / 60) + " ชม. " + (m % 60) + " นาที" : m + " นาที");
    const due = (s) => {
      const t = String(s || "");
      const same = t.slice(0, 10) === new Date().toLocaleDateString("sv-SE");
      return "กำหนดคืน " + (same ? "" : t.slice(8, 10) + "/" + t.slice(5, 7) + " ") + t.slice(11, 16) + " น.";
    };
    // แถวติดต่อ: รูปโปรไฟล์ + เบอร์โทร (ผู้ขับไม่มีบัญชี -> ใช้เบอร์ผู้จองแทน) แตะเบอร์เพื่อโทรได้ โดยไม่ปิดป้าย
    const phoneFmt = (p) => { const d = String(p || "").replace(/\D/g, ""); return d.length === 10 ? d.slice(0, 3) + "-" + d.slice(3, 6) + "-" + d.slice(6) : String(p || ""); };
    const telIc = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2"/></svg>';
    const contact = (o) => {
      const phone = o.DriverPhone || o.BookerPhone;
      if (!phone && !o.DriverAvatar) return "";
      const who = o.DriverPhone ? "" : o.BookerPhone ? "ผู้จอง: " + (o.BookerName || "") : "";
      const initial = esc(Array.from(String(o.DriverName || "?"))[0] || "?");
      const av = o.DriverAvatar ? '<img src="' + esc(o.DriverAvatar) + '" alt="" data-i="' + initial + '" onerror="this.parentNode.textContent=this.dataset.i">' : initial;
      const tel = phone ? '<a class="tel" href="tel:' + esc(String(phone).replace(/[^\d+]/g, "")) + '" onclick="event.stopPropagation()">' + telIc + esc(phoneFmt(phone)) + "</a>" : "";
      return '<span class="ct"><span class="av">' + av + '</span><span class="ct-lb">' + (who ? esc(who) : "ติดต่อผู้ขับ") + "</span>" + tel + "</span>";
    };
    const KEY = "od-dismissed";
    fetch("get_overdue_returns.php", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const all = (d && d.overdue) || [];
        if (!all.length) return;
        // จัดกลุ่มตามคน: รหัสพนักงาน (ไม่มี = ใช้ชื่อ) — หนึ่งป้ายต่อหนึ่งคน ป้ายเดียวมีหลายคันได้เมื่อเป็นคนเดียวกัน
        const groups = [];
        const byKey = {};
        all.forEach((o) => {
          const k = String(o.EmployeeID || o.DriverName || o.CarPlate);
          if (!byKey[k]) { byKey[k] = []; groups.push(byKey[k]); }
          byKey[k].push(o);
        });
        const force = /[?&]od=1(&|$)/.test(location.search); // ?od=1 = บังคับแสดง (ไว้ลองดู)
        let seen = {};
        try { seen = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {}; } catch (e) {}
        const queue = groups.filter((g) => {
          const sig = g.map((o) => o.CarPlate + o.DueAt).join("|");
          g.sig = sig;
          g.key = String(g[0].EmployeeID || g[0].DriverName || g[0].CarPlate);
          return force || !(seen[g.key] && seen[g.key].sig === sig && Date.now() - seen[g.key].at < 30 * 60000);
        });
        const next = () => { const g = queue.shift(); if (g) showGroup(g, next); };
        next();
      })
      .catch(() => {});

    // แสดงป้ายของคนหนึ่งคน; ปิดแล้วเรียก done() เพื่อขึ้นป้ายของคนถัดไป
    function showGroup(rows, done) {
        const sig = rows.sig;
        const clock = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
        const ov = document.createElement("div");
        ov.className = "an-odp" + (rows.length > 1 ? " multi" : "");
        ov.setAttribute("role", "alertdialog");
        ov.setAttribute("aria-label", "ประกาศรถเลยเวลาคืน");
        ov.innerHTML = `<div class="an-odp-card">
          <div class="an-odp-hd">
            <button type="button" class="an-odp-x" aria-label="ปิด"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
            <span class="an-odp-tag">ประกาศ</span>
            <div class="an-odp-ic" aria-hidden="true"><svg viewBox="0 0 200 100" fill="none" aria-hidden="true"><defs><linearGradient id="odb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9dce8"/></linearGradient><linearGradient id="odw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a5470"/><stop offset="1" stop-color="#1d2233"/></linearGradient></defs><ellipse cx="98" cy="88" rx="78" ry="6" fill="rgba(0,0,0,.28)"/><path d="M14 70 C14 59 22 54 33 52 L55 35 C59 32 64 30 70 30 H120 C128 30 135 33 140 38 L156 52 C170 54 184 58 184 69 V74 H14 Z" fill="url(#odb)"/><path d="M58 38 C60 36 63 35 67 35 H87 V52 H44 Z" fill="url(#odw)"/><path d="M93 35 H119 C124 35 128 37 131 40 L144 52 H93 Z" fill="url(#odw)"/><path d="M90 36 V72" stroke="#b9bdd0" stroke-width="2" stroke-linecap="round"/><rect x="100" y="58" width="11" height="3" rx="1.5" fill="#b0b4c6"/><path d="M176 58 H184 V65 H176 Z" fill="#ffd36b"/><path d="M14 60 H21 V67 H14 Z" fill="#ff5a5f"/><rect x="14" y="70" width="170" height="4" fill="#c3c7d8"/><circle cx="52" cy="74" r="15" fill="#171a26"/><circle cx="52" cy="74" r="7" fill="#cfd3e0"/><circle cx="52" cy="74" r="2.5" fill="#171a26"/><circle cx="146" cy="74" r="15" fill="#171a26"/><circle cx="146" cy="74" r="7" fill="#cfd3e0"/><circle cx="146" cy="74" r="2.5" fill="#171a26"/><g class="bd"><circle cx="162" cy="26" r="20" fill="#fff" stroke="#ffb347" stroke-width="4"/><circle cx="162" cy="26" r="20" stroke="#e5252a" stroke-width="2" stroke-dasharray="4 4" opacity=".55"/><path d="M162 14 V26 L170 31" stroke="#e5252a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></g></svg></div>
            <h2>${rows.length > 1 ? "รถเลยเวลาคืน " + rows.length + " คัน" : "รถเลยเวลาคืน"}</h2>
            <p>เลยกำหนดคืนแล้ว ผู้ขับกรุณาถ่ายรูปเลขไมล์<br>และกดคืนรถในระบบ เพื่อให้คนถัดไปใช้รถได้</p>
          </div>
          <ul>${rows.map((o) => `<li><span class="plate">${esc(o.CarPlate)}</span><span class="who">${esc(o.DriverName || "-")}</span><span class="meta"><span>${esc(due(o.DueAt))}</span><span class="late">${clock}เกิน ${dur(Number(o.OverdueMin) || 0)}</span></span>${contact(o)}</li>`).join("")}</ul>
          <button type="button" class="an-odp-ok">รับทราบ</button>
          <div class="an-odp-hint">แตะที่ไหนก็ได้เพื่อปิด</div>
        </div>`;
        const close = () => {
          ov.remove();
          document.removeEventListener("keydown", onKey);
          try {
            let m = {};
            try { m = JSON.parse(sessionStorage.getItem(KEY) || "{}") || {}; } catch (e2) {}
            m[rows.key] = { sig, at: Date.now() };
            sessionStorage.setItem(KEY, JSON.stringify(m));
          } catch (e) {}
          if (done) setTimeout(done, 250);
        };
        const onKey = (e) => e.key === "Escape" && close();
        ov.addEventListener("click", close);
        document.addEventListener("keydown", onKey);
        document.body.appendChild(ov);
        ov.querySelector(".an-odp-ok").focus({ preventScroll: true });
    }
  }

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
