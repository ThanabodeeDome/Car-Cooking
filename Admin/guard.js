// หน้า รปภ. (ธีม Admin): จดเลขไมล์รถที่ขับกลับเข้ามา
(() => {
  const $ = (id) => document.getElementById(id);
  const API = "../Car/guard_api.php";
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

  function render(data) {
    outList = data.out || [];
    $("gd-out-n").textContent = outList.length;
    $("gd-out").innerHTML = outList.length
      ? outList
          .map((o, i) => {
            const late = lateText(o.OverdueMin);
            return `
        <div class="od-row${late ? " od-stale" : ""}">
          <div class="od-plate">${esc(o.CarPlate)}</div>
          <div class="od-info">
            <b>${esc(((o.Brand || "") + " " + (o.Model || "")).trim() || "รถยนต์")} <small>${esc(o.DriverName || "-")}${o.EmployeeID ? " #" + esc(o.EmployeeID) : ""}</small></b>
            <span>ออก ${esc(when(o.CheckInAt))}${o.DueAt ? " • กำหนดคืน " + esc(when(o.DueAt)) + " น." : ""} • ไมล์ตอนออก ${num(o.StartMileage)} กม.</span>
          </div>
          <div class="od-late">${late ? '<i class="fa-regular fa-clock"></i> ' + esc(late) : ""}</div>
          <div class="od-actions"><button type="button" class="od-btn primary gd-go" data-i="${i}"><i class="fa-solid fa-pen-to-square"></i> จดเลขไมล์</button></div>
        </div>`;
          })
          .join("")
      : '<p class="gd-empty"><i class="fa-solid fa-circle-check"></i> ไม่มีรถค้างอยู่ — รถทุกคันกลับมาแล้ว</p>';

    const done = data.returned_today || [];
    $("gd-done-n").textContent = done.length;
    $("gd-done").innerHTML = done.length
      ? done
          .map(
            (d) => `
        <div class="od-row gd-done-row">
          <div class="od-plate">${esc(d.CarPlate)}</div>
          <div class="od-info"><b>${esc(d.DriverName || "-")}</b><span>${esc(d.ReturnAt || "")} น. • เลขไมล์ ${num(d.EndMileage)} กม. (ใช้ ${num(Number(d.EndMileage) - Number(d.StartMileage))} กม.)</span></div>
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
        <h3><i class="fa-solid fa-gauge-high"></i> จดเลขไมล์รถคืน</h3>
        <div class="gd-m-head"><span class="od-plate">${esc(o.CarPlate)}</span>
          <div><b>${esc(((o.Brand || "") + " " + (o.Model || "")).trim() || "รถยนต์")}</b><small>${esc(o.DriverName || "-")}${o.DriverPhone ? " • โทร " + esc(o.DriverPhone) : ""}</small></div></div>
        <div class="gd-m-start">เลขไมล์ตอนออก <b>${num(start)}</b> กม.</div>
        <label for="gd-mile">เลขไมล์ตอนนี้ (จากหน้าปัดรถ)</label>
        <input id="gd-mile" class="gd-mile" type="text" inputmode="numeric" placeholder="เช่น ${num(start + 50)}" required />
        <div class="gd-calc" id="gd-calc" aria-live="polite"></div>
        <label for="gd-note">หมายเหตุ (ไม่บังคับ)</label>
        <input id="gd-note" type="text" maxlength="150" placeholder="เช่น รถมีรอยถลอก" />
        <div class="od-modal-err" id="gd-err" role="alert"></div>
        <div class="od-modal-btns">
          <button type="button" class="od-btn" data-close>ยกเลิก</button>
          <button type="submit" class="od-btn primary gd-save" id="gd-save"><i class="fa-solid fa-circle-check"></i> บันทึกรถคืนแล้ว</button>
        </div>
      </form>`;
    document.body.appendChild(ov);
    const mile = ov.querySelector("#gd-mile");
    const val = () => parseInt((mile.value || "").replace(/,/g, ""), 10) || 0;
    const close = () => ov.remove();
    setTimeout(() => mile.focus(), 50);
    ov.addEventListener("click", (e) => (e.target === ov || e.target.closest("[data-close]")) && close());
    mile.addEventListener("input", () => {
      const d = mile.value.replace(/\D/g, "").slice(0, 7);
      mile.value = d ? Number(d).toLocaleString("en-US") : "";
      farConfirm = false;
      ov.querySelector("#gd-err").textContent = "";
      const m = val();
      const c = ov.querySelector("#gd-calc");
      c.innerHTML = !m ? "" : m <= start ? '<span class="bad">ต้องมากกว่า ' + num(start) + " กม.</span>" : "ใช้ไป <b>" + num(m - start) + "</b> กม.";
    });
    ov.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      const m = val();
      const err = ov.querySelector("#gd-err");
      if (!m) return (err.textContent = "กรุณากรอกเลขไมล์");
      busy = true;
      const btn = ov.querySelector("#gd-save");
      btn.disabled = true;
      try {
        const r = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "return", booking_id: o.BookingID, end_mile: m, note: ov.querySelector("#gd-note").value, confirm_far: farConfirm }),
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
  $("gd-refresh").addEventListener("click", () => load());
  load();
  setInterval(() => !document.querySelector(".od-modal") && load(true), 30000);
})();
