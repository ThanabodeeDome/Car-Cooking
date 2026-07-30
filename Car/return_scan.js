window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let currentPlate = "";
let currentBookingId = null;
let startMileage = 0;
let odometerFile = null;
let conditionFile = null;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  currentPlate = params.get("plate") || "";

  const loadingEl = document.getElementById("return-loading");
  const errorEl = document.getElementById("return-error");
  const contentEl = document.getElementById("return-content");

  if (!currentPlate) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorEl.innerText = "ไม่พบทะเบียนรถใน QR โปรดสแกนใหม่อีกครั้ง";
    return;
  }

  // 🌟 ขอ booking ที่สถานะ 'ขาไป' (กำลังใช้งานอยู่) ของทะเบียนนี้ ต่างจากหน้าเช็คอินที่ขอ 'จองแล้ว'
  fetch(
    `get_booking_by_plate.php?plate=${encodeURIComponent(currentPlate)}&status=ขาไป`,
  )
    .then((res) => res.json())
    .then((data) => {
      loadingEl.classList.add("hidden");

      if (!data.success) {
        errorEl.classList.remove("hidden");
        errorEl.innerText =
          data.message || "ไม่พบข้อมูลการใช้งานสำหรับรถคันนี้";
        return;
      }

      const b = data.booking;
      currentBookingId = b.BookingID;
      startMileage = Number(b.StartMileage || 0);

      document.getElementById("rt-plate").value = b.CarPlate || "";
      document.getElementById("rt-driver").value = b.DriverName || "";
      document.getElementById("rt-start-mile").value = startMileage;
      document.getElementById("rt-end-mile").min = startMileage + 1;

      contentEl.classList.remove("hidden");
    })
    .catch((err) => {
      loadingEl.classList.add("hidden");
      errorEl.classList.remove("hidden");
      errorEl.innerText = "ติดต่อ Server ไม่ได้ กรุณาลองใหม่";
      console.error("return lookup error:", err);
    });

  // 🌟 เลือกรูปเลขไมล์ -> พรีวิว + รัน OCR ทันที (Tesseract.js ทำงานฝั่ง browser ล้วนๆ)
  const odometerInput = document.getElementById("rt-odometer-input");
  odometerInput.addEventListener("change", function () {
    odometerFile = this.files[0] || null;
    if (!odometerFile) return;

    const preview = document.getElementById("rt-odometer-preview");
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(odometerFile);

    runOcrOnOdometer(odometerFile);
  });

  // 🌟 เลือกรูปสภาพรถ -> แค่พรีวิว ไม่ต้อง OCR
  const conditionInput = document.getElementById("rt-condition-input");
  conditionInput.addEventListener("change", function () {
    conditionFile = this.files[0] || null;
    if (!conditionFile) return;

    const preview = document.getElementById("rt-condition-preview");
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      preview.classList.remove("hidden");
    };
    reader.readAsDataURL(conditionFile);
  });
});

// 🌟 OCR อ่านเลขไมล์จากรูป — auto-fill ให้ แต่ยังต้องให้คนกดยืนยันตัวเลขเองก่อนส่ง (กันอ่านผิด)
function runOcrOnOdometer(file) {
  const statusEl = document.getElementById("rt-ocr-status");
  const endMileInput = document.getElementById("rt-end-mile");
  statusEl.innerText = "กำลังอ่านเลขไมล์จากรูป (OCR)...";
  endMileInput.value = "";

  Tesseract.recognize(file, "eng", {
    // tessedit_char_whitelist จำกัดให้อ่านแค่ตัวเลข ลดโอกาสอ่านตัวอักษรมั่ว
  })
    .then(({ data: { text } }) => {
      // 🌟 ดึงกลุ่มตัวเลขที่ยาวที่สุดในรูป (มักจะเป็นเลขไมล์หลัก ไม่ใช่เลขจุกจิกอื่นบนหน้าปัด)
      const numbers = text.match(/\d+/g) || [];
      const longest = numbers.reduce(
        (a, b) => (b.length > a.length ? b : a),
        "",
      );

      if (longest) {
        endMileInput.value = longest;
        statusEl.innerText =
          "อ่านได้: " + longest + " กรุณาตรวจสอบตัวเลขให้ตรงก่อนกดยืนยัน";
        statusEl.style.color = "#4ade80";
      } else {
        statusEl.innerText = "อ่านเลขไมล์จากรูปไม่ได้ กรุณากรอกเองด้านล่าง";
        statusEl.style.color = "#ff4d4d";
      }
    })
    .catch((err) => {
      console.error("OCR error:", err);
      statusEl.innerText = "OCR ทำงานผิดพลาด กรุณากรอกเลขไมล์เอง";
      statusEl.style.color = "#ff4d4d";
    });
}

function confirmReturn() {
  const endMile = Number(document.getElementById("rt-end-mile").value);
  const remark = document.getElementById("rt-remark").value || "-";

  if (!odometerFile) {
    return showToast("warning", "กรุณาถ่ายรูปเลขไมล์ก่อน");
  }
  if (!conditionFile) {
    return showToast("warning", "กรุณาถ่ายรูปสภาพรถก่อนคืน");
  }
  if (!endMile || endMile <= startMileage) {
    return showToast(
      "warning",
      `เลขไมล์ตอนคืน (${endMile || 0}) ต้องมากกว่าเลขไมล์ตอนออก (${startMileage})`,
    );
  }

  const btn = document.getElementById("rt-confirm-btn");
  btn.disabled = true;
  btn.innerText = "กำลังบันทึกการคืนรถ...";

  Promise.all([
    uploadReturnPhoto(odometerFile, "odometer"),
    uploadReturnPhoto(conditionFile, "condition"),
  ])
    .then(([odometerPath, conditionPath]) => {
      const now = new Date();
      const returnDate = now.toISOString().split("T")[0];
      const returnTime =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

      return fetch("save_return.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: currentBookingId,
          return_date: returnDate,
          return_time: returnTime,
          end_mile: endMile,
          return_remark: remark,
          odometer_photo_path: odometerPath,
          condition_photo_path: conditionPath,
        }),
      });
    })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        showToast("success", "บันทึกการคืนรถสำเร็จ!");
        setTimeout(() => (window.location.href = "car-status.html"), 1500);
      } else {
        showToast("error", result.message || "เกิดข้อผิดพลาด");
        btn.disabled = false;
        btn.innerText = "ยืนยันการคืนรถ";
      }
    })
    .catch((err) => {
      showToast("error", "ติดต่อ Server ไม่ได้");
      btn.disabled = false;
      btn.innerText = "ยืนยันการคืนรถ";
      console.error("confirm return error:", err);
    });
}

function uploadReturnPhoto(file, type) {
  const formData = new FormData();
  formData.append("photo", file);
  formData.append("type", type);

  return fetch("upload_return_photo.php", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then((result) => (result.success ? result.photo_path : null))
    .catch(() => null);
}
