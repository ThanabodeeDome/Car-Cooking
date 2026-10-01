window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let currentPlate = "";
if (window.prefetchGeo) window.prefetchGeo(); // ขอสิทธิ์ตำแหน่งตั้งแต่เปิดหน้า
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
    b.OutTime && b.PlannedReturnTime
      ? `${b.BookingDate || ""} ${b.OutTime}-${b.PlannedReturnTime} น.`
      : `${b.BookingDate || ""}${b.TimeSlot ? " (" + b.TimeSlot + ")" : ""}`;
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
    ? uploadPhoto(selectedCheckinPhoto, "upload_checkin_photo.php").catch((err) => {
        throw new Error("ขั้นตอนอัปโหลดรูป: " + err.message);
      })
    : Promise.resolve(null);

  uploadPromise
    .then((photoPath) =>
      (window.getGeo ? window.getGeo() : Promise.resolve(null)).then((geo) =>
        fetch("confirm_checkin.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plate: currentPlate, photo_path: photoPath, geo }),
        }).catch((err) => {
          throw new Error("ขั้นตอนเชื่อมต่อ server: " + err.message);
        }),
      ),
    )
    .then((res) =>
      res.text().then((text) => {
        // 🩹 FIX: เดิม res.json() ตรงๆ — ถ้า confirm_checkin.php ตอบไม่ใช่ JSON ล้วนๆ (PHP warning/error
        // หลุดปนมาก่อน JSON) Safari จะ throw "The string did not match the expected pattern"
        // ซึ่งเป็นข้อความที่งงมาก ไม่บอกอะไรเลยว่าเกิดอะไรขึ้นจริง — จับไว้ตรงนี้ให้ชัดเจนแทน
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error("confirm_checkin.php response ไม่ใช่ JSON:", text);
          throw new Error("เซิร์ฟเวอร์ตอบกลับผิดปกติ (ไม่ใช่ JSON) — อาจมี error ฝั่ง server กรุณาแจ้งผู้ดูแลระบบพร้อม log");
        }
      }),
    )
    .then((result) => {
      if (result.success) {
        showToast("success", result.message || "เช็คอินสำเร็จ!");
        setTimeout(() => (window.location.href = "booking-details.html?plate=" + encodeURIComponent(currentPlate)), 1800);
      } else {
        showToast("error", result.message || "เช็คอินไม่สำเร็จ");
        btn.disabled = false;
        btn.innerText = "ยืนยันเช็คอิน / รับรถ";
      }
    })
    .catch((err) => {
      // 🌟 ใส่ tag ขั้นตอนไว้แล้วด้านบน ครั้งหน้าถ้าพังอีกจะรู้ทันทีว่าพังตรงไหน ไม่ใช่แค่ error ดิบสั้นๆ
      showToast("error", err.message || "ติดต่อ Server ไม่ได้");
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
    .then((res) =>
      res.text().then((text) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error("confirm_return.php response ไม่ใช่ JSON:", text);
          throw new Error("เซิร์ฟเวอร์ตอบกลับผิดปกติ (ไม่ใช่ JSON) — อาจมี error ฝั่ง server กรุณาแจ้งผู้ดูแลระบบพร้อม log");
        }
      }),
    )
    .then((result) => {
      if (result.success) {
        showToast("success", result.message || "คืนรถสำเร็จ!");
        setTimeout(() => (window.location.href = "booking-details.html?plate=" + encodeURIComponent(currentPlate)), 1800);
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

// 🌟 บีบรูปให้เล็กลงก่อนส่งเสมอ (มือถือถ่ายรูปได้ 3-8MB ง่ายๆ แต่ php.ini บาง server จำกัดแค่ ~2MB)
// ย่อด้านยาวสุดไม่เกิน 1600px + re-encode เป็น JPEG คุณภาพ 0.75 ลดขนาดไฟล์ลงมาก โดยยังชัดพออ่าน OCR/เห็นสภาพรถ
function compressImage(file, maxDim = 1600, quality = 0.75) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/")) return resolve(file);
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file); // เผื่อ toBlob พังในบางเบราว์เซอร์เก่า ใช้ไฟล์เดิมแทน
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          },
          "image/jpeg",
          quality,
        );
      };
      img.onerror = () => resolve(file); // อ่านรูปไม่ได้ ก็ส่งไฟล์เดิมไปแทนดีกว่าพังเงียบๆ
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function uploadPhoto(file, endpoint) {
  return compressImage(file)
    .catch((err) => {
      throw new Error("ขั้นตอนบีบอัดรูป: " + err.message);
    })
    .then((compressed) => {
    const formData = new FormData();
    formData.append("photo", compressed);

    return fetch(endpoint, { method: "POST", body: formData })
      .then((res) =>
        res.text().then((text) => {
          let result;
          try {
            result = JSON.parse(text);
          } catch (e) {
            // 🩹 FIX: ถ้า server ตอบไม่ใช่ JSON ล้วนๆ (เช่น PHP warning หลุดปน) เดิม res.json() จะ throw
            // เป็น error งงๆ ของเบราว์เซอร์ (Safari: "The string did not match the expected pattern")
            // จับไว้ตรงนี้ ให้ error message อ่านรู้เรื่องแทน
            console.error("Upload response ไม่ใช่ JSON:", text);
            throw new Error("เซิร์ฟเวอร์ตอบกลับผิดปกติ กรุณาลองใหม่ หรือแจ้งผู้ดูแลระบบ");
          }
          // 🩹 FIX: เดิมถ้า server ตอบ success:false (เช่นไฟล์ถูกปฏิเสธ, mime เพี้ยน) จะ return null เงียบๆ
          // เหมือน "อัปโหลดสำเร็จแต่ไม่มีรูป" ทั้งที่จริงคือ "อัปโหลดพัง" — โยน error ให้ผู้เรียกจัดการแทน
          if (!result.success) {
            throw new Error(result.message || "อัปโหลดรูปไม่สำเร็จ");
          }
          return result.photo_path;
        }),
      );
  });
  // 🩹 เอา .catch(() => null) เดิมออก — ปล่อยให้ error หลุดไปให้โค้ดที่เรียกจัดการ (แสดง toast + หยุดขั้นตอน)
  // แทนที่จะกลืนเงียบแล้วเดินหน้าบันทึกข้อมูลต่อทั้งที่ไม่มีรูปจริง
}