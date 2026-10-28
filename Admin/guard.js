// หน้า รปภ. (ธีม Admin): จดเลขไมล์รถที่ขับกลับเข้ามา + ถ่ายรูปรถ + แก้ไข/ยกเลิกที่จดผิด + ดูย้อนหลัง/พิมพ์สรุป
(() => {
  const $ = (id) => document.getElementById(id);
  const API = "../Car/guard_api.php";
  const MAX_PHOTOS = 5; // รูปรถต่อรายการ (ไม่บังคับถ่าย) — ต้องตรงกับ GD_MAX_PHOTOS ใน guard_api.php
  let outList = [];
  let doneList = [];
  let upcomingList = [];
  let doneDate = ""; // "" = วันนี้
  let busy = false;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (n) => Number(n || 0).toLocaleString("en-US");
  const hhmm = (s) => (s ? String(s).slice(11, 16) : "-");
  const ymd = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const today = () => ymd(new Date());
  const when = (s) => (!s ? "-" : String(s).slice(0, 10) === today() ? hhmm(s) : String(s).slice(8, 10) + "/" + String(s).slice(5, 7) + " " + hhmm(s));
  const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, "");
  const lateText = (m) => {
    m = Number(m);
    if (!(m > 0)) return "";
    if (m < 60) return "เลยกำหนด " + m + " นาที";
    if (m < 1440) return "เลยกำหนด " + Math.floor(m / 60) + " ชม.";
    return "ค้างมา " + Math.floor(m / 1440) + " วัน";
  };
  const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const THAI_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const thaiDate = (dk) => {
    const d = new Date(dk + "T00:00:00");
    return isNaN(d) ? dk : THAI_DAYS[d.getDay()] + " " + d.getDate() + " " + THAI_MON[d.getMonth()] + " " + (d.getFullYear() + 543);
  };
  // ปุ่มโทรหาผู้ขับ (มือถือกดแล้วโทรออกเลย)
  const callBtn = (phone) => {
    const p = String(phone || "").replace(/[^0-9+]/g, "");
    return p ? `<a class="gd-call" href="tel:${esc(p)}" aria-label="โทรหาผู้ขับ"><i class="fa-solid fa-phone"></i><span>${esc(phone)}</span></a>` : "";
  };

  // ตัวเลือกด่วนตอนรับรถคืน (ต้องตรงกับ GD_FUEL / GD_DAMAGE / GD_CLEAN ใน guard_api.php)
  const FUEL = { full: "เต็มถัง", half: "ครึ่งถัง", low: "ใกล้หมด" };
  const DAMAGE = { none: "ไม่มีรอยใหม่", new: "มีรอยใหม่" };
  const CLEAN = { ok: "สะอาด", dirty: "ควรล้างรถ" };
  const optBadges = (o) => {
    if (!o) return "";
    const b = [];
    if (o.fuel) b.push(`<span class="gd-b fuel-${o.fuel}"><i class="fa-solid fa-gas-pump"></i> ${FUEL[o.fuel]}</span>`);
    if (o.damage) b.push(`<span class="gd-b dmg-${o.damage}"><i class="fa-solid fa-car-burst"></i> ${DAMAGE[o.damage]}</span>`);
    if (o.clean) b.push(`<span class="gd-b cln-${o.clean}"><i class="fa-solid fa-broom"></i> ${CLEAN[o.clean]}</span>`);
    if (o.key) b.push(`<span class="gd-b key"><i class="fa-solid fa-key"></i> คืนกุญแจแล้ว</span>`);
    if (o.note) b.push(`<span class="gd-b note"><i class="fa-regular fa-comment"></i> ${esc(o.note)}</span>`);
    return b.length ? `<div class="gd-badges">${b.join("")}</div>` : "";
  };

  function toast(msg, ok) {
    if (window.AdminToast && window.AdminToast.show) return window.AdminToast.show(msg, ok ? "success" : "error");
    let t = $("gd-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "gd-toast";
      document.body.appendChild(t);
    }
    t.className = "gd-toast " + (ok ? "ok" : "err");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 4200);
  }

  // วันที่ของรายการจอง (YYYY-MM-DD) และหัวกลุ่ม "วันนี้ / เมื่อวาน / ค้างมา N วัน"
  const dayOf = (o) => String(o.BookingDate || o.CheckInAt || "").slice(0, 10);
  function dayHeader(dk, n) {
    const d = new Date(dk + "T00:00:00");
    if (isNaN(d)) return `<div class="gd-day"><b>ไม่ระบุวัน</b><span>${n} คัน</span></div>`;
    const diff = Math.round((new Date(today() + "T00:00:00") - d) / 86400000);
    const tag = diff === 0 ? "วันนี้" : diff === 1 ? "เมื่อวาน" : diff > 1 ? "ค้างมา " + diff + " วัน" : "ล่วงหน้า";
    return `<div class="gd-day${diff > 0 ? " old" : ""}"><b>${esc(thaiDate(dk))}</b><em>${tag}</em><span>${n} คัน</span></div>`;
  }

  // รูปรถที่ รปภ. ถ่ายไว้ (ช่อง ReturnPhotoPath เก็บหลายรูปคั่นด้วย |) — กดดูภาพเต็มในแท็บใหม่
  const photoList = (v) => String(v || "").split("|").filter((p) => /^uploads\/return\/[A-Za-z0-9_.-]+$/.test(p));
  const thumbs = (v) => {
    const list = photoList(v);
    return list.length
      ? '<div class="gd-thumbs">' + list.map((p) => `<a href="../Car/${esc(p)}" target="_blank" rel="noopener"><img src="../Car/${esc(p)}" alt="รูปรถ" loading="lazy" /></a>`).join("") + "</div>"
      : "";
  };

  let lastData = null;

  function render(data) {
    lastData = data;
    const sm = data.summary || {};
    const allOut = data.out || [];
    upcomingList = data.upcoming || [];
    doneList = data.returned || [];

    // ----- การ์ดสรุป + แถบเตือนรถเลยกำหนด -----
    $("gd-out-n").textContent = allOut.length;
    $("gd-up-n").textContent = upcomingList.length;
    $("gd-done-n").textContent = doneList.length;
    const od = allOut.filter((o) => Number(o.OverdueMin) > 60);
    const alertBox = $("gd-alert");
    if (od.length) {
      alertBox.hidden = false;
      alertBox.innerHTML =
        `<i class="fa-solid fa-triangle-exclamation"></i><div><b>มีรถเลยกำหนดคืนเกิน 1 ชั่วโมง ${od.length} คัน</b><span>` +
        od.slice(0, 6).map((o) => esc(o.CarPlate) + " (" + esc(lateText(o.OverdueMin).replace("เลยกำหนด ", "เกิน ").replace("ค้างมา ", "ค้าง ")) + ")").join(" • ") +
        (od.length > 6 ? " …" : "") +
        `</span></div><a href="#gd-out-panel" class="od-btn">ดูรายการ</a>`;
    } else alertBox.hidden = true;

    // ----- รถที่ยังไม่คืน (ค้นหา + แยกกลุ่มตามวัน) -----
    const q = norm($("gd-q").value).replace(/^#/, "");
    outList = q ? allOut.filter((o) => String(o.BookingID) === q || norm(o.CarPlate + " " + o.DriverName + " " + o.EmployeeID + " " + o.BookingNumber).includes(q)) : allOut;
    outList = [...outList].sort((a, b) => String(b.BookingDate).localeCompare(String(a.BookingDate)) || String(a.CheckInAt).localeCompare(String(b.CheckInAt)));
    const perDay = {};
    outList.forEach((o) => (perDay[dayOf(o)] = (perDay[dayOf(o)] || 0) + 1));
    let prevDay = null;
    $("gd-out").innerHTML = outList.length
      ? outList
          .map((o, i) => {
            const late = lateText(o.OverdueMin);
            const dk = dayOf(o);
            const head = dk !== prevDay ? dayHeader(dk, perDay[dk]) : "";
            prevDay = dk;
            return head + `
        <div class="od-row${late ? " od-stale" : ""}">
          <div class="gd-lead"><div class="od-plate">${esc(o.CarPlate)}</div><div class="gd-code">รหัสจอง <b>${Number(o.BookingID)}</b></div></div>
          <div class="od-info">
            <b>${esc(((o.Brand || "") + " " + (o.Model || "")).trim() || "รถยนต์")} <small>${esc(o.DriverName || "-")}${o.EmployeeID ? " #" + esc(o.EmployeeID) : ""}</small></b>
            <span>ออก ${esc(when(o.CheckInAt))}${o.DueAt ? " • กำหนดคืน " + esc(when(o.DueAt)) + " น." : ""} • ไมล์ตอนออก ${num(o.StartMileage)} กม.</span>
            ${callBtn(o.DriverPhone)}
          </div>
          <div class="od-late">${late ? '<i class="fa-regular fa-clock"></i> ' + esc(late) : ""}</div>
          <div class="od-actions"><button type="button" class="od-btn primary gd-go" data-i="${i}"><i class="fa-solid fa-pen-to-square"></i> จดเลขไมล์</button></div>
        </div>`;
          })
          .join("")
      : allOut.length
        ? '<p class="gd-empty"><i class="fa-solid fa-magnifying-glass"></i> ไม่พบรายการที่ตรงกับ "' + esc($("gd-q").value) + '"</p>'
        : '<p class="gd-empty"><i class="fa-solid fa-circle-check"></i> ไม่มีรถค้างอยู่ — รถทุกคันกลับมาแล้ว</p>';

    // ----- จองวันนี้ ยังไม่มารับรถ -----
    $("gd-up-panel").hidden = false;
    $("gd-up").innerHTML = upcomingList.length
      ? upcomingList
          .map((u) => {
            const m = u.MinutesToOut === null || u.MinutesToOut === undefined ? null : Number(u.MinutesToOut);
            const tag = m === null ? "" : m < 0 ? `<em class="late">เลยเวลานัด ${Math.abs(m) >= 60 ? Math.floor(Math.abs(m) / 60) + " ชม." : Math.abs(m) + " นาที"}</em>` : m <= 60 ? `<em class="soon">อีก ${m} นาที</em>` : "";
            return `
        <div class="od-row gd-up-row">
          <div class="gd-lead"><div class="od-plate">${esc(u.CarPlate)}</div><div class="gd-code">รหัสจอง <b>${Number(u.BookingID)}</b></div></div>
          <div class="od-info">
            <b>${esc(((u.Brand || "") + " " + (u.Model || "")).trim() || "รถยนต์")} <small>${esc(u.DriverName || "-")}${u.EmployeeID ? " #" + esc(u.EmployeeID) : ""}</small></b>
            <span>นัดรับ ${esc(String(u.OutTime || "").slice(0, 5))} น. • กำหนดคืน ${esc(u.PlannedReturn || "-")} น.${u.Destination ? " • " + esc(u.Destination) : ""}</span>
            ${callBtn(u.DriverPhone)}
          </div>
          <div class="gd-up-tag">${tag}</div>
        </div>`;
          })
          .join("")
      : '<p class="gd-empty">วันนี้ไม่มีรถที่จองแล้วยังไม่มารับ</p>';

    // ----- คืนแล้ว (ตามวันที่เลือก) + สรุป -----
    const isToday = data.is_today !== false;
    $("gd-done-title").textContent = isToday ? "คืนแล้ววันนี้" : "คืนแล้ว " + thaiDate(data.date);
    $("gd-date").value = data.date || today();
    $("gd-date-next").disabled = isToday;
    $("gd-date-today").hidden = isToday;
    $("gd-sum").innerHTML =
      `<span><b>${num(sm.returned)}</b> คัน</span><span>ระยะรวม <b>${num(sm.km)}</b> กม.</span>` + (sm.auto ? `<span>ระบบปิดให้ <b>${num(sm.auto)}</b> คัน</span>` : "") + (isToday ? `<span>ยังไม่คืน <b>${num(sm.out)}</b> คัน</span>` : "");
    $("gd-print-head").textContent = "สรุปการคืนรถ " + thaiDate(data.date || today()) + " • คืน " + num(sm.returned) + " คัน • ระยะรวม " + num(sm.km) + " กม. • จัดทำโดย " + (data.guard || "");
    $("gd-done").innerHTML = doneList.length
      ? doneList
          .map(
            (d, i) => `
        <div class="od-row gd-done-row">
          <div class="gd-lead"><div class="od-plate">${esc(d.CarPlate)}</div><div class="gd-code">รหัสจอง <b>${Number(d.BookingID)}</b></div></div>
          <div class="od-info"><b>${esc(((d.Brand || "") + " " + (d.Model || "")).trim() || "รถยนต์")} <small>${esc(d.DriverName || "-")}</small></b>
            ${
              d.auto_closed
                ? `<span>ปิดตอน ${esc(d.ReturnAt || "")} น. • ไม่มีบันทึกเลขไมล์</span><div class="gd-badges"><span class="gd-b auto"><i class="fa-solid fa-robot"></i> ระบบปิดอัตโนมัติ (ผู้ขับไม่ได้บันทึกคืน)</span></div>`
                : `<span>${esc(d.ReturnAt || "")} น. • เลขไมล์ ${num(d.EndMileage)} กม. (ใช้ ${num(Number(d.EndMileage) - Number(d.StartMileage))} กม.)</span>${optBadges(d.opts)}`
            }
          </div>
          ${d.editable ? `<div class="od-actions gd-noprint"><button type="button" class="od-btn gd-edit" data-i="${i}"><i class="fa-solid fa-pen"></i> แก้ไข</button></div>` : ""}
          ${thumbs(d.ReturnPhotoPath)}
        </div>`,
          )
          .join("")
      : '<p class="gd-empty">' + (isToday ? "ยังไม่มีรถที่คืนวันนี้" : "ไม่มีรายการคืนรถในวันนี้") + "</p>";
  }

  async function load(silent) {
    try {
      const r = await fetch(API + (doneDate ? "?date=" + encodeURIComponent(doneDate) : ""), { cache: "no-store" }).then((x) => x.json());
      if (r.code === "login") return (location.href = "../Car/index.html");
      if (!r.success) return toast(r.message || "โหลดข้อมูลไม่สำเร็จ", false);
      render(r);
    } catch {
      if (!silent) toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", false);
    }
  }

  // ================= หน้าต่างจดเลขไมล์ / แก้ไขรายการที่จดไว้ =================
  // mode "return": จดคืนรถ (o = รายการรถที่ยังไม่คืน)   mode "edit": แก้ไขที่จดไว้วันนี้ (o = รายการคืนแล้ว มี opts / EndMileage / ReturnPhotoPath)
  function openModal(o, mode) {
    const isEdit = mode === "edit";
    const start = Number(o.StartMileage);
    let farConfirm = false;
    const ov = document.createElement("div");
    ov.className = "od-modal";
    const chipRow = (key, label, map) =>
      `<div class="gd-chiprow" data-k="${key}"><span>${label}</span>` + Object.entries(map).map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join("") + "</div>";
    ov.innerHTML = `
      <form class="od-modal-card gd-modal" autocomplete="off">
        <div class="gd-m-top">
          <div class="gd-m-title"><span><i class="fa-solid ${isEdit ? "fa-pen" : "fa-gauge-high"}"></i></span> ${isEdit ? "แก้ไขรายการที่จดไว้" : "จดเลขไมล์รถคืน"}</div>
          <button type="button" class="gd-m-x" data-close aria-label="ปิด">&times;</button>
        </div>
        <div class="gd-m-body">
        <div class="gd-m-car">
          <div class="od-plate gd-m-plate">${esc(o.CarPlate)}</div>
          <div class="gd-m-info">
            <span class="gd-m-code">รหัสจอง ${Number(o.BookingID)}</span>
            <b>${esc(((o.Brand || "") + " " + (o.Model || "")).trim() || "รถยนต์")}</b>
            <small><i class="fa-regular fa-user"></i> ${esc(o.DriverName || "-")}</small>
            ${callBtn(o.DriverPhone)}
          </div>
        </div>
        <div class="gd-m-start"><i class="fa-solid fa-flag-checkered"></i> เลขไมล์ตอนออก <b>${num(start)}</b> กม.</div>
        <section class="gd-sec">
          <label for="gd-mile">เลขไมล์ตอนนี้ <small>พิมพ์ 3 ตัวท้ายก็ได้ ระบบต่อเลขเต็มให้</small></label>
          <input id="gd-mile" class="gd-mile" type="text" inputmode="numeric" placeholder="เช่น ${String(start + 150).slice(-3)}" required />
          <div class="gd-calc" id="gd-calc" aria-live="polite"></div>
        </section>
        <section class="gd-sec">
          <label>สภาพรถ <small>แตะเลือก • ไม่บังคับ</small></label>
          <div class="gd-opts" id="gd-opts">
            ${chipRow("fuel", "น้ำมัน", FUEL)}
            ${chipRow("damage", "รอยใหม่", DAMAGE)}
            ${chipRow("clean", "ความสะอาด", CLEAN)}
            <label class="gd-key"><input type="checkbox" id="gd-key" /> <i class="fa-solid fa-key"></i> คืนกุญแจแล้ว</label>
          </div>
        </section>
        <section class="gd-sec">
          <label for="gd-note">หมายเหตุ <small>ไม่บังคับ</small></label>
          <input id="gd-note" type="text" maxlength="150" placeholder="เช่น รถมีรอยถลอก" />
        </section>
        <div class="gd-photos">
          <div class="gd-photos-head"><b><i class="fa-solid fa-camera"></i> รูปรถ</b><span>ไม่บังคับ • สูงสุด ${MAX_PHOTOS} รูป</span><em id="gd-ph-count">0/${MAX_PHOTOS}</em></div>
          <div class="gd-ph-grid" id="gd-ph-grid"></div>
          <div class="gd-ph-btns">
            <button type="button" class="od-btn" id="gd-ph-cam"><i class="fa-solid fa-camera"></i> ถ่ายรูป</button>
            <button type="button" class="od-btn" id="gd-ph-pick"><i class="fa-regular fa-image"></i> เลือกรูปจากเครื่อง</button>
          </div>
          <input type="file" id="gd-in-cam" accept="image/*" capture="environment" hidden />
          <input type="file" id="gd-in-pick" accept="image/*" multiple hidden />
        </div>
        <div class="od-modal-err" id="gd-err" role="alert"></div>
        </div>
        <div class="gd-m-foot">
          ${isEdit ? '<button type="button" class="od-btn danger" id="gd-undo"><i class="fa-solid fa-rotate-left"></i> ยกเลิกการจด</button>' : '<button type="button" class="od-btn" data-close>ยกเลิก</button>'}
          <button type="submit" class="od-btn primary gd-save" id="gd-save"><i class="fa-solid fa-circle-check"></i> ${isEdit ? "บันทึกการแก้ไข" : "บันทึกรถคืนแล้ว"}</button>
        </div>
      </form>`;
    document.body.appendChild(ov);
    const mile = ov.querySelector("#gd-mile");
    // เลขไมล์ไม่มีวันลด: พิมพ์ 1–3 ตัวท้าย -> ต่อเป็นเลขเต็มที่ "น้อยที่สุดที่มากกว่าเลขตอนออก" และลงท้ายด้วยเลขนั้น
    // พิมพ์ 4 หลักขึ้นไป = เลขเต็ม ใช้ตามที่พิมพ์
    const digits = () => (mile.value || "").replace(/\D/g, "");
    const val = () => {
      const d = digits();
      if (!d) return 0;
      if (d.length > 3) return parseInt(d, 10);
      const mod = Math.pow(10, d.length);
      let m = start - (start % mod) + parseInt(d, 10);
      if (m <= start) m += mod;
      return m;
    };
    const close = () => ov.remove();
    const err = ov.querySelector("#gd-err");

    // ---- ตัวเลือกด่วน (กดซ้ำ = ยกเลิกที่เลือก) ----
    const opts = { fuel: "", damage: "", clean: "" };
    const paintOpts = () =>
      ov.querySelectorAll(".gd-chiprow").forEach((row) => row.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === opts[row.dataset.k])));
    ov.querySelectorAll(".gd-chiprow").forEach((row) =>
      row.addEventListener("click", (e) => {
        const b = e.target.closest("button");
        if (!b) return;
        opts[row.dataset.k] = opts[row.dataset.k] === b.dataset.v ? "" : b.dataset.v;
        paintOpts();
      }),
    );

    // ---- รูปรถ (ไม่บังคับ สูงสุด MAX_PHOTOS): ย่อรูปในเครื่องก่อน แล้วอัปโหลดทันทีที่เลือก/ถ่าย ----
    const photos = []; // { key, url, path, state: "up" | "ok" | "err" }
    let photoSeq = 0;
    const phGrid = ov.querySelector("#gd-ph-grid");
    const renderPhotos = () => {
      phGrid.innerHTML = photos
        .map(
          (p) => `
        <div class="gd-ph ${p.state}" data-k="${p.key}">
          <img src="${p.url}" alt="" />
          <span class="gd-ph-st">${p.state === "up" ? '<i class="fa-solid fa-spinner fa-spin"></i>' : p.state === "ok" ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-rotate-right"></i>'}</span>
          <button type="button" class="gd-ph-x" data-k="${p.key}" aria-label="ลบรูป">&times;</button>
        </div>`,
        )
        .join("");
      ov.querySelector("#gd-ph-count").textContent = photos.length + "/" + MAX_PHOTOS;
      const full = photos.length >= MAX_PHOTOS;
      ov.querySelector("#gd-ph-cam").disabled = full;
      ov.querySelector("#gd-ph-pick").disabled = full;
    };
    const shrink = (file) =>
      new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
          const c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url);
          c.toBlob((b) => resolve(b || file), "image/jpeg", 0.82);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(file);
        };
        img.src = url;
      });
    const uploadPhoto = async (p, blob) => {
      p.state = "up";
      renderPhotos();
      try {
        const fd = new FormData();
        fd.append("photo", blob, "car.jpg");
        fd.append("booking_id", o.BookingID);
        const r = await fetch(API, { method: "POST", body: fd }).then((x) => x.json());
        if (r.success) {
          p.path = r.photo_path;
          p.state = "ok";
        } else {
          p.state = "err";
          err.textContent = r.message || "อัปโหลดรูปไม่สำเร็จ";
        }
      } catch {
        p.state = "err";
        err.textContent = "อัปโหลดรูปไม่สำเร็จ (เน็ตมีปัญหา) แตะรูปเพื่อลองใหม่";
      }
      p._blob = blob;
      if (ov.isConnected) renderPhotos();
    };
    const addFiles = async (files) => {
      for (const f of Array.from(files || [])) {
        if (photos.length >= MAX_PHOTOS) break;
        if (!/^image\//.test(f.type)) continue;
        const blob = await shrink(f);
        const p = { key: ++photoSeq, url: URL.createObjectURL(blob), path: null, state: "up" };
        photos.push(p);
        uploadPhoto(p, blob);
      }
    };
    ov.querySelector("#gd-ph-cam").addEventListener("click", () => ov.querySelector("#gd-in-cam").click());
    ov.querySelector("#gd-ph-pick").addEventListener("click", () => ov.querySelector("#gd-in-pick").click());
    ["#gd-in-cam", "#gd-in-pick"].forEach((sel) =>
      ov.querySelector(sel).addEventListener("change", (e) => {
        addFiles(e.target.files);
        e.target.value = "";
      }),
    );
    phGrid.addEventListener("click", (e) => {
      const x = e.target.closest(".gd-ph-x");
      if (x) {
        const i = photos.findIndex((p) => String(p.key) === x.dataset.k);
        if (i >= 0) photos.splice(i, 1);
        return renderPhotos();
      }
      const t = e.target.closest(".gd-ph.err"); // แตะรูปที่อัปโหลดพลาด = ลองใหม่
      if (t) {
        const p = photos.find((q) => String(q.key) === t.dataset.k);
        if (p && p._blob) uploadPhoto(p, p._blob);
      }
    });

    mile.addEventListener("input", () => {
      const d = mile.value.replace(/\D/g, "").slice(0, 7);
      mile.value = d.length > 3 ? Number(d).toLocaleString("en-US") : d; // 3 ตัวท้าย: โชว์ตามที่พิมพ์ (รวมเลข 0 นำหน้า)
      farConfirm = false;
      err.textContent = "";
      const m = val();
      const c = ov.querySelector("#gd-calc");
      const short = digits().length <= 3;
      if (!m) c.innerHTML = "";
      else if (m <= start) c.innerHTML = '<span class="bad">ต้องมากกว่า ' + num(start) + " กม. (เลขไมล์ไม่ลดลง)</span>";
      else {
        const dist = m - start;
        c.innerHTML =
          (short ? 'เลขเต็ม <b class="gd-full">' + num(m) + "</b> กม. • " : "") +
          "ใช้ไป <b>" + num(dist) + "</b> กม." +
          (dist > 500 ? '<div class="warn"><i class="fa-solid fa-triangle-exclamation"></i> ไกลผิดปกติ — ถามผู้ขับว่า 3 ตัวท้ายถูกไหม</div>' : "");
      }
    });

    // ---- โหมดแก้ไข: เติมค่าเดิม ----
    if (isEdit) {
      mile.value = num(o.EndMileage);
      mile.dispatchEvent(new Event("input"));
      const po = o.opts || {};
      opts.fuel = po.fuel || "";
      opts.damage = po.damage || "";
      opts.clean = po.clean || "";
      ov.querySelector("#gd-key").checked = !!po.key;
      ov.querySelector("#gd-note").value = po.note || "";
      photoList(o.ReturnPhotoPath).forEach((p) => photos.push({ key: ++photoSeq, url: "../Car/" + p, path: p, state: "ok" }));
    }
    paintOpts();
    renderPhotos();
    setTimeout(() => mile.focus(), 50);
    ov.addEventListener("click", (e) => (e.target === ov || e.target.closest("[data-close]")) && close());

    async function post(body) {
      return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((x) => x.json());
    }

    // ---- ยกเลิกการจด (เฉพาะโหมดแก้ไข) ----
    if (isEdit) {
      ov.querySelector("#gd-undo").addEventListener("click", async () => {
        if (busy) return;
        if (!confirm("ยกเลิกการจดของ " + o.CarPlate + " ?\nรถจะกลับไปอยู่ในรายการ \"ยังไม่คืน\" และเลขไมล์ที่จดไว้จะถูกล้าง")) return;
        busy = true;
        try {
          const r = await post({ action: "undo_return", booking_id: o.BookingID });
          if (r.success) {
            close();
            toast(r.message || "ยกเลิกการจดแล้ว", true);
            load(true);
          } else {
            err.textContent = r.message || "ยกเลิกไม่สำเร็จ";
            if (r.code === "stale") load(true);
          }
        } catch {
          err.textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
        } finally {
          busy = false;
        }
      });
    }

    ov.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const m = val();
      if (!m) return (err.textContent = "กรุณากรอกเลขไมล์");
      if (photos.some((p) => p.state === "up")) return (err.textContent = "รออัปโหลดรูปให้เสร็จก่อนสักครู่");
      if (photos.some((p) => p.state === "err")) return (err.textContent = "มีรูปที่อัปโหลดไม่สำเร็จ แตะรูปเพื่อลองใหม่ หรือกด × เพื่อลบรูปนั้น");
      busy = true;
      const btn = ov.querySelector("#gd-save");
      btn.disabled = true;
      try {
        const r = await post({
          action: isEdit ? "edit_return" : "return",
          booking_id: o.BookingID,
          end_mile: m,
          note: ov.querySelector("#gd-note").value,
          fuel: opts.fuel,
          damage: opts.damage,
          clean: opts.clean,
          key_returned: ov.querySelector("#gd-key").checked,
          confirm_far: farConfirm,
          photos: photos.map((p) => p.path).filter(Boolean),
        });
        if (r.success) {
          close();
          toast((isEdit ? "แก้ไขแล้ว: " : "บันทึกแล้ว: ") + r.plate + " • ใช้ไป " + num(r.distance) + " กม.", true);
          load(true);
        } else if (r.code === "far_distance") {
          farConfirm = true;
          err.textContent = r.message + " — กด 'บันทึก' อีกครั้งถ้าเลขถูกต้อง";
          btn.disabled = false;
        } else {
          err.textContent = r.message || "บันทึกไม่สำเร็จ";
          btn.disabled = false;
          if (r.code === "stale") load(true);
        }
      } catch {
        err.textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
        btn.disabled = false;
      } finally {
        busy = false;
      }
    });
  }

  // ================= เหตุการณ์ในหน้า =================
  $("gd-out").addEventListener("click", (e) => {
    const b = e.target.closest(".gd-go");
    if (b) openModal(outList[Number(b.dataset.i)], "return");
  });
  $("gd-done").addEventListener("click", (e) => {
    const b = e.target.closest(".gd-edit");
    if (b) openModal(doneList[Number(b.dataset.i)], "edit");
  });
  $("gd-q").addEventListener("input", () => lastData && render(lastData));
  $("gd-refresh").addEventListener("click", () => load());

  // เลือกวันที่ดูย้อนหลัง (รายการคืนแล้ว + สรุป)
  const shiftDate = (n) => {
    const d = new Date((doneDate || today()) + "T00:00:00");
    d.setDate(d.getDate() + n);
    const v = ymd(d);
    if (v > today()) return;
    doneDate = v === today() ? "" : v;
    load();
  };
  $("gd-date").max = today();
  $("gd-date").addEventListener("change", (e) => {
    const v = e.target.value;
    if (!v || v > today()) return;
    doneDate = v === today() ? "" : v;
    load();
  });
  $("gd-date-prev").addEventListener("click", () => shiftDate(-1));
  $("gd-date-next").addEventListener("click", () => shiftDate(1));
  $("gd-date-today").addEventListener("click", () => {
    doneDate = "";
    load();
  });

  // พิมพ์สรุปประจำวัน: พิมพ์เฉพาะส่วน "คืนแล้ว" (ซ่อนเมนู/ปุ่ม/ส่วนอื่นด้วย CSS @media print)
  $("gd-print").addEventListener("click", () => {
    document.body.classList.add("gd-printing");
    window.print();
  });
  window.addEventListener("afterprint", () => document.body.classList.remove("gd-printing"));

  load();
  setInterval(() => !document.querySelector(".od-modal") && load(true), 30000);
})();
