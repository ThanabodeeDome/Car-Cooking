window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let currentPlate = "";
let selectedCheckinPhoto = null;
let selectedReturnPhoto = null;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  currentPlate = params.get("plate") || "";

  const loadingEl = document.getElementById("checkin-loading");
  const errorEl = document.getElementById("checkin-error");
  const titleEl = document.getElementById("scan-page-title");

  if (!currentPlate) {
    loadingEl.classList.add("hidden");
    errorEl.classList.remove("hidden");
    errorEl.innerText = "ไม่พบทะเบียนรถใน QR โปรดสแกนใหม่อีกครั้ง";
    return;
  }

  fetch(`get_booking_by_plate.php?plate=${encodeURIComponent(currentPlate)}`)
    .then((res) => res.json())
    .then((data) => {
      loadingEl.classList.add("hidden");

      if (!data.success) {
        errorEl.classList.remove("hidden");
        errorEl.innerText = data.message || "ไม่พบข้อมูลการจองสำหรับรถคันนี้";
        return;
      }

      const b = data.booking;

      if (data.mode === "checkin") {
        titleEl.innerText = "เช็คอินรับรถ";
        renderCheckinMode(b);
      } else {
        titleEl.innerText = "คืนรถ";
        renderReturnMode(b);
      }
    })
    .catch((err) => {
      loadingEl.classList.add("hidden");
      errorEl.classList.remove("hidden");
      errorEl.innerText = "ติดต่อ Server ไม่ได้ กรุณาลองใหม่";
      console.error("scan lookup error:", err);
    });
});

// ================= โหมดเช็คอิน =================
function renderCheckinMode(b) {
  document.getElementById("ci-plate").value = b.CarPlate || "";
  document.getElementById("ci-driver").value = b.DriverName || "";
  document.getElementById("ci-empid").value = b.EmployeeID || "";
  document.getElementById("ci-dept").value = b.Department || "";
  document.getElementById("ci-passengers").value = b.Passengers || "-";
  document.getElementById("ci-datetime").value =
    `${b.BookingDate || ""} (${b.TimeSlot || ""})`;
  document.getElementById("ci-mileage").value = b.StartMileage || "0";
  document.getElementById("ci-destination").value = b.Destination || "-";

  document.getElementById("mode-checkin").classList.remove("hidden");
  startLiveClock();

  const photoInput = document.getElementById("ci-photo-input");
  photoInput.addEventListener("change", function () {
    selectedCheckinPhoto = this.files[0] || null;
    if (!selectedCheckinPhoto) return;
    previewPhoto(selectedCheckinPhoto, "ci-photo-preview");
  });
}

function startLiveClock() {
  const clockEl = document.getElementById("ci-live-clock");
  if (!clockEl) return;
  function tick() {
    clockEl.innerText = new Date().toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  }
  tick();
  setInterval(tick, 1000);
}

function confirmCheckin() {
  const btn = document.getElementById("ci-confirm-btn");
  btn.disabled = true;
  btn.innerText = "กำลังเช็คอิน...";

  const uploadPromise = selectedCheckinPhoto
    ? uploadPhoto(selectedCheckinPhoto, "upload_checkin_photo.php")
    : Promise.resolve(null);

  uploadPromise
    .then((photoPath) =>
      fetch("confirm_checkin.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: currentPlate, photo_path: photoPath }),
      }),
    )
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        showToast("success", result.message || "เช็คอินสำเร็จ!");
        setTimeout(() => (window.location.href = "car-status.html"), 1500);
      } else {
        showToast("error", result.message || "เช็คอินไม่สำเร็จ");
        btn.disabled = false;
        btn.innerText = "ยืนยันเช็คอิน / รับรถ";
      }
    })
    .catch((err) => {
      showToast("error", "ติดต่อ Server ไม่ได้");
      btn.disabled = false;
      btn.innerText = "ยืนยันเช็คอิน / รับรถ";
      console.error("confirm checkin error:", err);
    });
}

// ================= โหมดคืนรถ =================
function renderReturnMode(b) {
  document.getElementById("rt-plate").value = b.CarPlate || "";
  document.getElementById("rt-driver").value = b.DriverName || "";
  document.getElementById("rt-start-mile").value = b.StartMileage || "0";

  document.getElementById("mode-return").classList.remove("hidden");

  const photoInput = document.getElementById("rt-photo-input");
  photoInput.addEventListener("change", function () {
    selectedReturnPhoto = this.files[0] || null;
    if (!selectedReturnPhoto) return;
    previewPhoto(selectedReturnPhoto, "rt-photo-preview");
    runOcrOnPhoto(selectedReturnPhoto);
  });
}

// 🌟 OCR อ่านเลขไมล์จากรูป ด้วย Tesseract.js (รันในเบราว์เซอร์ผู้ใช้เอง)
// ผลลัพธ์แค่ "เติมให้อัตโนมัติ" ผู้ใช้ต้องตรวจสอบ/แก้เลขในช่องก่อนกดยืนยันเสมอ ไม่ auto-submit ตรงๆ
function runOcrOnPhoto(file) {
  const statusEl = document.getElementById("rt-ocr-status");
  const endMileInput = document.getElementById("rt-end-mile");
  statusEl.innerText = "กำลังอ่านเลขไมล์จากรูป...";

  Tesseract.recognize(file, "eng", {
    tessedit_char_whitelist: "0123456789",
  })
    .then(({ data: { text } }) => {
      const digitsOnly = text.replace(/[^0-9]/g, "");
      if (digitsOnly.length >= 3) {
        endMileInput.value = digitsOnly;
        statusEl.innerText = `OCR อ่านได้: ${digitsOnly} (กรุณาตรวจสอบตัวเลขให้ตรงกับรูปก่อนกดยืนยัน)`;
        statusEl.style.color = "#4ade80";
      } else {
        statusEl.innerText = "OCR อ่านเลขไม่ชัดเจน กรุณากรอกเลขไมล์เองด้วยมือ";
        statusEl.style.color = "#facc15";
      }
    })
    .catch((err) => {
      console.error("OCR error:", err);
      statusEl.innerText = "OCR อ่านไม่สำเร็จ กรุณากรอกเลขไมล์เองด้วยมือ";
      statusEl.style.color = "#facc15";
    });
}

function confirmReturn() {
  const btn = document.getElementById("rt-confirm-btn");
  const endMile = document.getElementById("rt-end-mile").value;
  const remark = document.getElementById("rt-remark").value;

  if (!selectedReturnPhoto) {
    return showToast("warning", "กรุณาถ่ายรูปเลขไมล์ก่อนยืนยันคืนรถ");
  }
  if (!endMile || Number(endMile) <= 0) {
    return showToast("warning", "กรุณากรอกเลขไมล์ตอนคืนให้ถูกต้อง");
  }

  btn.disabled = true;
  btn.innerText = "กำลังบันทึก...";

  uploadPhoto(selectedReturnPhoto, "upload_return_photo.php")
    .then((photoPath) => {
      if (!photoPath) {
        throw new Error("อัปโหลดรูปไม่สำเร็จ");
      }
      return fetch("confirm_return.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plate: currentPlate,
          end_mile: endMile,
          photo_path: photoPath,
          return_remark: remark,
        }),
      });
    })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        showToast("success", result.message || "คืนรถสำเร็จ!");
        setTimeout(() => (window.location.href = "car-status.html"), 1500);
      } else {
        showToast("error", result.message || "คืนรถไม่สำเร็จ");
        btn.disabled = false;
        btn.innerText = "ยืนยันคืนรถ";
      }
    })
    .catch((err) => {
      showToast("error", err.message || "ติดต่อ Server ไม่ได้");
      btn.disabled = false;
      btn.innerText = "ยืนยันคืนรถ";
      console.error("confirm return error:", err);
    });
}

// ================= ฟังก์ชันใช้ร่วมกัน =================
function previewPhoto(file, imgElId) {
  const preview = document.getElementById(imgElId);
  const reader = new FileReader();
  reader.onload = (e) => {
    preview.src = e.target.result;
    preview.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function uploadPhoto(file, endpoint) {
  const formData = new FormData();
  formData.append("photo", file);

  return fetch(endpoint, { method: "POST", body: formData })
    .then((res) => res.json())
    .then((result) => (result.success ? result.photo_path : null))
    .catch(() => null);
}
