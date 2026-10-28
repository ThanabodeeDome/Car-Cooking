// หน้า รปภ. (ธีม Admin): จดเลขไมล์รถที่ขับกลับเข้ามา
(() => {
  const $ = (id) => document.getElementById(id);
  const API = "../Car/guard_api.php";
  const MAX_PHOTOS = 5; // รูปรถต่อรายการ (ไม่บังคับถ่าย) — ต้องตรงกับ GD_MAX_PHOTOS ใน guard_api.php
  let outList = [];
  let busy = false;

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (n) => Number(n || 0).toLocaleString("en-US");
  const hhmm = (s) => (s ? String(s).slice(11, 16) : "-");
  const today = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  const when = (s) => (!s ? "-" : String(s).slice(0, 10) === today() ? hhmm(s) : String(s).slice(8, 10) + "/" + String(s).slice(5, 7) + " " + hhmm(s));
  const lateText = (m) => {
    m = Number(m);
    if (!(m > 0)) return "";
    if (m < 60) return "เลยกำหนด " + m + " นาที";
    if (m < 1440) return "เลยกำหนด " + Math.floor(m / 60) + " ชม.";
    return "ค้างมา " + Math.floor(m / 1440) + " วัน";
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
  const THAI_DAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];
  const THAI_MON = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  function dayHeader(dk, n) {
    const d = new Date(dk + "T00:00:00");
    if (isNaN(d)) return `<div class="gd-day"><b>ไม่ระบุวัน</b><span>${n} คัน</span></div>`;
    const diff = Math.round((new Date(today() + "T00:00:00") - d) / 86400000);
    const label = THAI_DAYS[d.getDay()] + " " + d.getDate() + " " + THAI_MON[d.getMonth()] + " " + (d.getFullYear() + 543);
    const tag = diff === 0 ? "วันนี้" : diff === 1 ? "เมื่อวาน" : diff > 1 ? "ค้างมา " + diff + " วัน" : "ล่วงหน้า";
    return `<div class="gd-day${diff > 0 ? " old" : ""}"><b>${esc(label)}</b><em>${tag}</em><span>${n} คัน</span></div>`;
  }

  // รูปรถที่ รปภ. ถ่ายไว้ (ช่อง ReturnPhotoPath เก็บหลายรูปคั่นด้วย |) — กดดูภาพเต็มในแท็บใหม่
  const thumbs = (v) => {
    const list = String(v || "").split("|").filter((p) => /^uploads\/return\/[A-Za-z0-9_.-]+$/.test(p));
    return list.length
      ? '<div class="gd-thumbs">' + list.map((p) => `<a href="../Car/${esc(p)}" target="_blank" rel="noopener"><img src="../Car/${esc(p)}" alt="รูปรถ" loading="lazy" /></a>`).join("") + "</div>"
      : "";
  };

  let allOut = [];
  let lastData = null;
  const norm = (s) => String(s ?? "").toLowerCase().replace(/\s+/g, "");

  function render(data) {
    lastData = data;
    allOut = data.out || [];
    $("gd-out-n").textContent = allOut.length;
    // ค้นหาด้วยรหัสจอง / ทะเบียน / ชื่อ / รหัสพนักงาน (พิมพ์รหัสจอง 345 หรือ #345 ก็ได้)
    const q = norm($("gd-q").value).replace(/^#/, "");
    outList = q
      ? allOut.filter((o) => String(o.BookingID) === q || norm(o.CarPlate + " " + o.DriverName + " " + o.EmployeeID + " " + o.BookingNumber).includes(q))
      : allOut;
    // แยกเป็นกลุ่มตามวันที่ของรายการจอง: วันล่าสุดขึ้นก่อน ในวันเดียวกันเรียงตามเวลาออก
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
          </div>
          <div class="od-late">${late ? '<i class="fa-regular fa-clock"></i> ' + esc(late) : ""}</div>
          <div class="od-actions"><button type="button" class="od-btn primary gd-go" data-i="${i}"><i class="fa-solid fa-pen-to-square"></i> จดเลขไมล์</button></div>
        </div>`;
          })
          .join("")
      : allOut.length
        ? '<p class="gd-empty"><i class="fa-solid fa-magnifying-glass"></i> ไม่พบรายการที่ตรงกับ "' + esc($("gd-q").value) + '"</p>'
        : '<p class="gd-empty"><i class="fa-solid fa-circle-check"></i> ไม่มีรถค้างอยู่ — รถทุกคันกลับมาแล้ว</p>';

    const done = data.returned_today || [];
    $("gd-done-n").textContent = done.length;
    $("gd-done").innerHTML = done.length
      ? done
          .map(
            (d) => `
        <div class="od-row gd-done-row">
          <div class="od-plate">${esc(d.CarPlate)}</div>
          <div class="od-info"><b>${esc(d.DriverName || "-")} <small>รหัสจอง ${Number(d.BookingID)}</small></b><span>${esc(d.ReturnAt || "")} น. • เลขไมล์ ${num(d.EndMileage)} กม. (ใช้ ${num(Number(d.EndMileage) - Number(d.StartMileage))} กม.)</span></div>
          ${thumbs(d.ReturnPhotoPath)}
        </div>`,
          )
          .join("")
      : '<p class="gd-empty">ยังไม่มีรถที่คืนวันนี้</p>';
  }

  async function load(silent) {
    try {
      const r = await fetch(API, { cache: "no-store" }).then((x) => x.json());
      if (r.code === "login") return (location.href = "../Car/index.html");
      if (!r.success) return toast(r.message || "โหลดข้อมูลไม่สำเร็จ", false);
      render(r);
    } catch {
      if (!silent) toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", false);
    }
  }

  // ---- หน้าต่างกรอกเลขไมล์ ----
  function openModal(o) {
    const start = Number(o.StartMileage);
    let farConfirm = false;
    const ov = document.createElement("div");
    ov.className = "od-modal";
    ov.innerHTML = `
      <form class="od-modal-card gd-modal" autocomplete="off">
        <div class="gd-m-top">
          <div class="gd-m-title"><span><i class="fa-solid fa-gauge-high"></i></span> จดเลขไมล์รถคืน</div>
          <button type="button" class="gd-m-x" data-close aria-label="ปิด">&times;</button>
        </div>
        <div class="gd-m-body">
        <div class="gd-m-car">
          <div class="od-plate gd-m-plate">${esc(o.CarPlate)}</div>
          <div class="gd-m-info">
            <span class="gd-m-code">รหัสจอง ${Number(o.BookingID)}</span>
            <b>${esc(((o.Brand || "") + " " + (o.Model || "")).trim() || "รถยนต์")}</b>
            <small><i class="fa-regular fa-user"></i> ${esc(o.DriverName || "-")}${o.DriverPhone ? " &nbsp;<i class='fa-solid fa-phone'></i> " + esc(o.DriverPhone) : ""}</small>
          </div>
        </div>
        <div class="gd-m-start"><i class="fa-solid fa-flag-checkered"></i> เลขไมล์ตอนออก <b>${num(start)}</b> กม.</div>
        <section class="gd-sec">
          <label for="gd-mile">เลขไมล์ตอนนี้ <small>พิมพ์ 3 ตัวท้ายก็ได้ ระบบต่อเลขเต็มให้</small></label>
          <input id="gd-mile" class="gd-mile" type="text" inputmode="numeric" placeholder="เช่น ${String(start + 150).slice(-3)}" required />
          <div class="gd-calc" id="gd-calc" aria-live="polite"></div>
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
          <button type="button" class="od-btn" data-close>ยกเลิก</button>
          <button type="submit" class="od-btn primary gd-save" id="gd-save"><i class="fa-solid fa-circle-check"></i> บันทึกรถคืนแล้ว</button>
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
          ov.querySelector("#gd-err").textContent = r.message || "อัปโหลดรูปไม่สำเร็จ";
        }
      } catch {
        p.state = "err";
        ov.querySelector("#gd-err").textContent = "อัปโหลดรูปไม่สำเร็จ (เน็ตมีปัญหา) แตะรูปเพื่อลองใหม่";
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
    renderPhotos();
    setTimeout(() => mile.focus(), 50);
    ov.addEventListener("click", (e) => (e.target === ov || e.target.closest("[data-close]")) && close());
    mile.addEventListener("input", () => {
      const d = mile.value.replace(/\D/g, "").slice(0, 7);
      mile.value = d.length > 3 ? Number(d).toLocaleString("en-US") : d; // 3 ตัวท้าย: โชว์ตามที่พิมพ์ (รวมเลข 0 นำหน้า)
      farConfirm = false;
      ov.querySelector("#gd-err").textContent = "";
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
    ov.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const m = val();
      const err = ov.querySelector("#gd-err");
      if (!m) return (err.textContent = "กรุณากรอกเลขไมล์");
      if (photos.some((p) => p.state === "up")) return (err.textContent = "รออัปโหลดรูปให้เสร็จก่อนสักครู่");
      if (photos.some((p) => p.state === "err")) return (err.textContent = "มีรูปที่อัปโหลดไม่สำเร็จ แตะรูปเพื่อลองใหม่ หรือกด × เพื่อลบรูปนั้น");
      busy = true;
      const btn = ov.querySelector("#gd-save");
      btn.disabled = true;
      try {
        const r = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "return", booking_id: o.BookingID, end_mile: m, note: ov.querySelector("#gd-note").value, confirm_far: farConfirm, photos: photos.map((p) => p.path).filter(Boolean) }),
        }).then((x) => x.json());
        if (r.success) {
          close();
          toast("บันทึกแล้ว: " + r.plate + " • ใช้ไป " + num(r.distance) + " กม.", true);
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

  $("gd-out").addEventListener("click", (e) => {
    const b = e.target.closest(".gd-go");
    if (b) openModal(outList[Number(b.dataset.i)]);
  });
  $("gd-q").addEventListener("input", () => lastData && render(lastData));
  $("gd-refresh").addEventListener("click", () => load());
  load();
  setInterval(() => !document.querySelector(".od-modal") && load(true), 30000);
})();
