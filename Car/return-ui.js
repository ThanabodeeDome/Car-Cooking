// ส่วนแสดงผลของหน้าคืนรถ: ติ๊กขั้นตอนที่ทำแล้ว, แถบความคืบหน้า, ระยะทางที่ใช้ไป (ไม่แตะตรรกะบันทึกใน return_scan.js)
(function () {
  const $ = (id) => document.getElementById(id);
  function update() {
    const start = Number($("rt-start-mile").value) || 0;
    const end = Number($("rt-end-mile").value) || 0;
    const odoFile = $("rt-odometer-input").files.length > 0;
    const carFile = $("rt-condition-input").files.length > 0;
    const mileOk = odoFile && end > start;

    $("rt-step-1").classList.toggle("done", mileOk);
    $("rt-step-2").classList.toggle("done", carFile);
    $("rt-odometer-input").closest(".rt-snap").classList.toggle("has-img", odoFile);
    $("rt-condition-input").closest(".rt-snap").classList.toggle("has-img", carFile);

    const left = (mileOk ? 0 : 1) + (carFile ? 0 : 1);
    $("rt-bar-fill").style.width = ((2 - left) / 2) * 100 + "%";
    const pg = $("rt-progress-text");
    pg.textContent = left ? "เหลืออีก " + left + " ขั้นตอน" : "พร้อมยืนยันการคืนรถแล้ว";
    pg.parentElement.classList.toggle("ok", !left);

    const dist = $("rt-dist");
    dist.className = "rt-dist";
    if (end && end <= start) {
      dist.textContent = "เลขไมล์ต้องมากกว่าตอนออก (" + start + ")";
      dist.classList.add("bad");
    } else if (end > start) {
      dist.textContent = "ใช้รถไปประมาณ " + (end - start).toLocaleString("th-TH") + " กม.";
      dist.classList.add("ok");
    } else {
      dist.textContent = "ถ้าอ่านเลขไม่ตรง แก้ตัวเลขเองได้";
    }

    const btn = $("rt-confirm-btn");
    if (!btn.disabled) {
      btn.classList.toggle("ready", !left);
      btn.classList.toggle("wait", !!left);
    }
  }
  document.addEventListener("DOMContentLoaded", function () {
    ["change", "input"].forEach((ev) => document.addEventListener(ev, update, true));
    setInterval(update, 400); // OCR ใส่ค่าให้ช่องเลขไมล์ด้วยโค้ด ไม่มี event
    update();
  });
})();
