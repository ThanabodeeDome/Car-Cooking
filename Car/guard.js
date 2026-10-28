// หน้า รปภ.: จดเลขไมล์รถที่ขับกลับเข้ามา
(() => {
  const $ = (id) => document.getElementById(id);
  let outList = [];
  let current = null;
  let farConfirm = false;
  let busy = false;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const num = (n) => Number(n || 0).toLocaleString("en-US");
  const hhmm = (s) => (s ? String(s).slice(11, 16) : "-");
  const dayOf = (s) => (s ? String(s).slice(0, 10) : "");
  const today = () => {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  };
  const when = (s) => (dayOf(s) === today() ? hhmm(s) : String(s).slice(8, 10) + "/" + String(s).slice(5, 7) + " " + hhmm(s));
  const lateText = (m) => {
    m = Number(m);
    if (!(m > 0)) return "";
    if (m < 60) return "เลยกำหนด " + m + " นาที";
    if (m < 1440) return "เลยกำหนด " + Math.floor(m / 60) + " ชม.";
    return "ค้างมา " + Math.floor(m / 1440) + " วัน";
  };

  function toast(msg, kind) {
    const t = $("gd-toast");
    t.textContent = msg;
    t.className = "gd-toast " + (kind || "");
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 4200);
  }

  function render(data) {
    $("gd-who").textContent = data.guard || "รปภ.";
    outList = data.out || [];
    $("gd-count").textContent = outList.length;
    const box = $("gd-out");
    if (!outList.length) {
      box.innerHTML = '<p class="gd-empty"><i class="fa-solid fa-circle-check"></i> ไม่มีรถค้างอยู่ — รถทุกคันกลับมาแล้ว</p>';
    } else {
      box.innerHTML = outList
        .map((o, i) => {
          const late = lateText(o.OverdueMin);
          return `
        <button type="button" class="gd-card${late ? " late" : ""}" data-i="${i}">
          <span class="gd-plate">${esc(o.CarPlate)}</span>
          <span class="gd-card-main">
            <b>${esc((o.Brand || "") + " " + (o.Model || "")).trim() || "รถยนต์"}</b>
            <span>${esc(o.DriverName || "-")}${o.EmployeeID ? " • " + esc(o.EmployeeID) : ""}</span>
            <small>ออก ${esc(when(o.CheckInAt))}${o.DueAt ? " • กำหนดคืน " + esc(when(o.DueAt)) : ""}</small>
            ${late ? `<em>${esc(late)}</em>` : ""}
          </span>
          <span class="gd-go"><i class="fa-solid fa-pen-to-square"></i><span>จดไมล์</span></span>
        </button>`;
        })
        .join("");
    }
    const done = data.returned_today || [];
    $("gd-done-count").textContent = done.length;
    $("gd-done").innerHTML = done.length
      ? done
          .map(
            (d) => `
        <div class="gd-row">
          <span class="gd-plate sm">${esc(d.CarPlate)}</span>
          <span class="gd-row-main"><b>${esc(d.DriverName || "-")}</b><small>${esc(d.ReturnAt || "")} น. • ${num(d.EndMileage)} กม. (ใช้ ${num(Number(d.EndMileage) - Number(d.StartMileage))} กม.)</small></span>
        </div>`,
          )
          .join("")
      : '<p class="gd-empty small">ยังไม่มีรถที่คืนวันนี้</p>';
  }

  async function load(silent) {
    try {
      const r = await fetch("guard_api.php", { cache: "no-store" }).then((x) => x.json());
      if (r.code === "login") return (location.href = "/login");
      if (!r.success) return toast(r.message || "โหลดข้อมูลไม่สำเร็จ", "err");
      render(r);
    } catch {
      if (!silent) toast("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้", "err");
    }
  }

  // ---- แผ่นกรอกเลขไมล์ ----
  function openSheet(o) {
    current = o;
    farConfirm = false;
    $("gd-s-plate").textContent = o.CarPlate;
    $("gd-s-car").textContent = ((o.Brand || "") + " " + (o.Model || "")).trim() || "รถยนต์";
    $("gd-s-driver").textContent = (o.DriverName || "-") + (o.DriverPhone ? " • โทร " + o.DriverPhone : "");
    $("gd-s-start").textContent = num(o.StartMileage);
    $("gd-mile").value = "";
    $("gd-note").value = "";
    $("gd-calc").textContent = "";
    $("gd-err").textContent = "";
    $("gd-save").disabled = false;
    $("gd-sheet").hidden = false;
    document.body.classList.add("gd-lock");
    setTimeout(() => $("gd-mile").focus(), 60);
  }
  function closeSheet() {
    $("gd-sheet").hidden = true;
    document.body.classList.remove("gd-lock");
    current = null;
  }
  const mileVal = () => parseInt(($("gd-mile").value || "").replace(/,/g, ""), 10) || 0;

  $("gd-mile").addEventListener("input", (e) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 7);
    e.target.value = digits ? Number(digits).toLocaleString("en-US") : "";
    farConfirm = false;
    $("gd-err").textContent = "";
    const m = mileVal();
    const start = Number(current && current.StartMileage);
    const calc = $("gd-calc");
    if (!m) calc.textContent = "";
    else if (m <= start) calc.innerHTML = '<span class="bad">ต้องมากกว่า ' + num(start) + " กม.</span>";
    else calc.innerHTML = "ใช้ไป <b>" + num(m - start) + "</b> กม.";
  });

  $("gd-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy || !current) return;
    const m = mileVal();
    if (!m) return ($("gd-err").textContent = "กรุณากรอกเลขไมล์");
    busy = true;
    $("gd-save").disabled = true;
    try {
      const r = await fetch("guard_api.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "return", booking_id: current.BookingID, end_mile: m, note: $("gd-note").value, confirm_far: farConfirm }),
      }).then((x) => x.json());
      if (r.success) {
        closeSheet();
        toast("บันทึกแล้ว: " + r.plate + " • ใช้ไป " + num(r.distance) + " กม.", "ok");
        load(true);
      } else if (r.code === "far_distance") {
        farConfirm = true;
        $("gd-err").textContent = r.message + " — กด 'บันทึก' อีกครั้งถ้าเลขถูกต้อง";
        $("gd-save").disabled = false;
      } else {
        $("gd-err").textContent = r.message || "บันทึกไม่สำเร็จ";
        $("gd-save").disabled = false;
        if (r.code === "stale") load(true);
      }
    } catch {
      $("gd-err").textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
      $("gd-save").disabled = false;
    } finally {
      busy = false;
    }
  });

  $("gd-out").addEventListener("click", (e) => {
    const b = e.target.closest(".gd-card");
    if (b) openSheet(outList[Number(b.dataset.i)]);
  });
  $("gd-sheet").addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) closeSheet();
  });
  document.addEventListener("keydown", (e) => e.key === "Escape" && !$("gd-sheet").hidden && closeSheet());
  $("gd-refresh").addEventListener("click", () => load());
  $("gd-logout").addEventListener("click", () => {
    if (!confirm("ออกจากระบบใช่หรือไม่?")) return;
    fetch("../logout.php")
      .catch(() => {})
      .finally(() => (location.href = "/login"));
  });

  load();
  setInterval(() => $("gd-sheet").hidden && load(true), 30000); // รีเฟรชรายการอัตโนมัติ (ไม่รีเฟรชตอนกำลังกรอก)
})();
