// แถบโปรไฟล์ล่างเมนูข้าง: กดฟันเฟืองแล้วมีเมนู "ออกจากระบบ" เด้งขึ้นมา (ใช้ร่วมกันทุกหน้า Admin)
(function () {
  const wrap = document.querySelector(".sidebar-logout-wrapper");
  const box = wrap && wrap.querySelector(".sidebar-identity");
  const logout = wrap && wrap.querySelector(".btn-sidebar-logout");
  if (!wrap || !box || !logout) return;

  // ข้อความชื่อ/บทบาท -> กล่องซ้าย, ฟันเฟือง -> ขวา
  const text = document.createElement("div");
  text.className = "sp-text";
  while (box.firstChild) text.appendChild(box.firstChild);
  const gear = document.createElement("button");
  gear.type = "button";
  gear.className = "sp-gear";
  gear.setAttribute("aria-label", "เมนูโปรไฟล์");
  gear.setAttribute("aria-haspopup", "menu");
  gear.setAttribute("aria-expanded", "false");
  gear.innerHTML = '<i class="fa-solid fa-gear"></i>';
  box.classList.add("sp-on");
  box.appendChild(text);
  box.appendChild(gear);

  // ปุ่มออกจากระบบเดิม -> ย้ายเข้าเมนูที่เด้งขึ้น
  const menu = document.createElement("div");
  menu.className = "sp-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  logout.setAttribute("role", "menuitem");
  menu.appendChild(logout);
  wrap.classList.add("sp-wrap");
  wrap.appendChild(menu);

  const set = (open) => {
    menu.hidden = !open;
    gear.setAttribute("aria-expanded", String(open));
    box.classList.toggle("sp-open", open);
  };
  gear.addEventListener("click", (e) => {
    e.stopPropagation();
    set(menu.hidden);
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !wrap.contains(e.target)) set(false);
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && set(false));
})();
