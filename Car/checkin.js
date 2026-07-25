window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let currentPlate = "";
let selectedPhotoFile = null;

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  currentPlate = params.get("plate") || "";

  const loadingEl = document.getElementById("checkin-loading");
  const errorEl = document.getElementById("checkin-error");
  const contentEl = document.getElementById("checkin-content");

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
      document.getElementById("ci-plate").value = b.CarPlate || "";
      document.getElementById("ci-driver").value = b.DriverName || "";
      document.getElementById("ci-empid").value = b.EmployeeID || "";
      document.getElementById("ci-dept").value = b.Department || "";
      document.getElementById("ci-passengers").value = b.Passengers || "-";
      document.getElementById("ci-datetime").value =
        `${b.BookingDate || ""} (${b.TimeSlot || ""})`;
      document.getElementById("ci-mileage").value = b.StartMileage || "0";
      document.getElementById("ci-destination").value = b.Destination || "-";

      contentEl.classList.remove("hidden");
      startLiveClock();
    })
    .catch((err) => {
      loadingEl.classList.add("hidden");
      errorEl.classList.remove("hidden");
      errorEl.innerText = "ติดต่อ Server ไม่ได้ กรุณาลองใหม่";
      console.error("checkin lookup error:", err);
    });

  // 🌟 พรีวิวรูปทันทีที่เลือกไฟล์ (ยังไม่อัปโหลดจนกว่าจะกดยืนยันเช็คอิน)
  const photoInput = document.getElementById("ci-photo-input");
  if (photoInput) {
    photoInput.addEventListener("change", function () {
      selectedPhotoFile = this.files[0] || null;
      if (!selectedPhotoFile) return;

      const preview = document.getElementById("ci-photo-preview");
      const reader = new FileReader();
      reader.onload = (e) => {
        preview.src = e.target.result;
        preview.classList.remove("hidden");
      };
      reader.readAsDataURL(selectedPhotoFile);
    });
  }
});

// 🌟 นาฬิกาสด อัปเดตทุกวินาที ให้เห็นว่าเวลาไหนจะถูกบันทึกตอนกดปุ่ม
function startLiveClock() {
  const clockEl = document.getElementById("ci-live-clock");
  if (!clockEl) return;

  function tick() {
    const now = new Date();
    const formatted = now.toLocaleString("th-TH", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
    clockEl.innerText = formatted;
  }

  tick();
  setInterval(tick, 1000);
}

function confirmCheckin() {
  const btn = document.getElementById("ci-confirm-btn");
  btn.disabled = true;
  btn.innerText = "กำลังเช็คอิน...";

  // 🌟 ถ้ามีรูปเลือกไว้ ต้องอัปโหลดก่อน แล้วค่อยแนบ path ไปตอนยืนยันเช็คอิน
  const uploadPromise = selectedPhotoFile
    ? uploadCheckinPhoto(selectedPhotoFile)
    : Promise.resolve(null);

  uploadPromise
    .then((photoPath) => {
      return fetch("confirm_checkin.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate: currentPlate, photo_path: photoPath }),
      });
    })
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

function uploadCheckinPhoto(file) {
  const formData = new FormData();
  formData.append("photo", file);

  return fetch("upload_checkin_photo.php", {
    method: "POST",
    body: formData,
  })
    .then((res) => res.json())
    .then((result) => {
      if (!result.success) {
        showToast("error", "อัปโหลดรูปไม่สำเร็จ: " + (result.message || ""));
        return null; // ยังให้เช็คอินต่อได้ แม้รูปอัปโหลดพลาด (ไม่บังคับ)
      }
      return result.photo_path;
    })
    .catch(() => null);
}
