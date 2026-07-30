window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let btnCheckout, btnReturn, plateSelect, checkoutFields, returnFields;
let dbCarData = []; // เก็บข้อมูลรถที่ดึงมาจาก DB
let pendingReturnsMap = {}; // 🌟 เก็บ StartMileage ผูกกับ BookingID

document.addEventListener("DOMContentLoaded", () => {
  // ผูกตัวแปร
  btnCheckout = document.getElementById("btn-checkout");
  btnReturn = document.getElementById("btn-return");
  plateSelect = document.getElementById("car-plate-select");
  checkoutFields = document.getElementById("checkout-fields");
  returnFields = document.getElementById("return-fields");

  // --- 1. ตั้งค่า วันที่/เวลา ปัจจุบัน ---
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const time =
    now.getHours().toString().padStart(2, "0") +
    ":" +
    now.getMinutes().toString().padStart(2, "0");

  if (document.getElementById("use-date"))
    document.getElementById("use-date").value = today;
  if (document.getElementById("out-time"))
    document.getElementById("out-time").value = time;
  if (document.getElementById("return-date"))
    document.getElementById("return-date").value = today;
  if (document.getElementById("return-time"))
    document.getElementById("return-time").value = time;

  // --- 2. โหลดทะเบียนรถจาก Database ---
  loadAvailableCars();

  // ปุ่มสลับหน้า
  if (btnCheckout) btnCheckout.addEventListener("click", showCheckout);
  if (btnReturn) btnReturn.addEventListener("click", showReturn);
});

// 🩹 หมายเหตุ: เดิมมีการเช็ค hasPendingReturn() ก่อนอนุญาตสลับแท็บ/จอง
// (บล็อกทันทีถ้ามี booking ค้าง 'ขาไป' อยู่ ไม่ว่าจะคนละช่วงเวลาแค่ไหน)
// เอาออกแล้ว เพราะตอนนี้อนุญาตให้จองหลาย slot ต่างเวลากันในวันเดียวกันได้ล่วงหน้า
// การกันชนเวลาจริงๆ ทำฝั่ง server (save_booking.php) ด้วยการเทียบช่วงเวลาแทน

function loadAvailableCars() {
  fetch("get_cars.php")
    .then((res) => res.json())
    .then((allData) => {
      const data = allData.filter((car) => car.RealStatus === "ว่าง"); // 🌟 กรองเฉพาะรถว่างจริง (คำนวณสด)
      dbCarData = data;
      if (plateSelect) {
        plateSelect.innerHTML =
          '<option value="" disabled selected>เลือกทะเบียนรถ</option>';
        data.forEach((car) => {
          const opt = new Option(`${car.Plate} (${car.Brand})`, car.Plate);
          plateSelect.add(opt);
        });
      }
    })
    .catch((err) => console.error("Error loading cars:", err));
}

// 🌟 เลือกรถแล้ว auto-fill เลขไมล์ล่าสุดของคันนั้น (readonly ในฟอร์ม กันแก้มั่ว)
function updateCarDetails(plate) {
  const startMileInput = document.getElementById("start-mile");
  const car = dbCarData.find((c) => c.Plate === plate);
  if (car && startMileInput) {
    startMileInput.value = car.Mileage;
  }
}

// 🌟 กรอกรหัสพนักงานผู้ขับ -> เด้งชื่อจริงมาโชว์ (readonly), ไม่โชว์ email/phone/แผนกในฟอร์มนี้
function lookupDriverName() {
  const empId = document.getElementById("employee-id").value.trim();
  const nameInput = document.getElementById("driver-name");
  if (!nameInput) return;

  if (!empId) {
    nameInput.value = "";
    return;
  }

  fetch(`get_employee_name.php?employee_id=${encodeURIComponent(empId)}`)
    .then((res) => res.json())
    .then((data) => {
      nameInput.value = data.success ? data.name : "ไม่พบรหัสนี้";
    })
    .catch(() => {
      nameInput.value = "ตรวจสอบไม่ได้";
    });
}

// 🌟 เดียวกันกับข้างบน แต่ใช้กับแถวผู้ร่วมทาง (รองรับหลายแถว)
function lookupPassengerName(inputEl) {
  const empId = inputEl.value.trim();
  const row = inputEl.closest(".passenger-row");
  if (!row) return;
  const nameInput = row.querySelector('input[name="passengers[]"]');
  if (!nameInput) return;

  if (!empId) {
    nameInput.value = "";
    return;
  }

  fetch(`get_employee_name.php?employee_id=${encodeURIComponent(empId)}`)
    .then((res) => res.json())
    .then((data) => {
      nameInput.value = data.success ? data.name : "ไม่พบรหัสนี้";
    })
    .catch(() => {
      nameInput.value = "ตรวจสอบไม่ได้";
    });
}

// --- ปุ่มยืนยันยืมรถ (ขาออก) ---
function submitBooking() {
  const data = {
    driver_name: document.getElementById("driver-name").value,
    employee_id: document.getElementById("employee-id").value,
    car_plate: document.getElementById("car-plate-select").value,
    start_mile: document.getElementById("start-mile").value,
    use_date: document.getElementById("use-date").value,
    time_slot: document.getElementById("time-slot").value,
    destination: document.getElementById("destination").value,
    passengers: getPassengerNames(),
    passenger_ids: getPassengerIds(),
  };

  if (!data.employee_id || !data.driver_name) {
    return showToast(
      "warning",
      "กรุณากรอกรหัสพนักงานผู้ขับให้ถูกต้อง (ต้องมีชื่อขึ้นก่อน)",
    );
  }

  if (!data.car_plate || !data.time_slot) {
    return showToast("warning", "กรุณาเลือกทะเบียนรถ และ ช่วงเวลา ให้ครบถ้วน!");
  }

  // 🌟 กันจองช่วงเวลาที่ผ่านมาแล้ว (เทียบเวลาสิ้นสุดของ slot กับเวลาปัจจุบัน)
  // 🩹 เพิ่ม 'กลางคืน' ที่จบข้ามเที่ยงคืนไปเช้าวันถัดไป (endHour ตัวเดียวไม่พอ ต้อง +1 วันด้วย)
  const slotEndHour = { เช้า: 12, บ่าย: 17, ทั้งวัน: 17, กลางคืน: 8 };
  const endHour = slotEndHour[data.time_slot];
  if (data.use_date && endHour !== undefined) {
    const slotEnd = new Date(
      `${data.use_date}T${String(endHour).padStart(2, "0")}:00:00`,
    );
    if (data.time_slot === "กลางคืน") {
      slotEnd.setDate(slotEnd.getDate() + 1);
    }
    if (slotEnd < new Date()) {
      return showToast(
        "warning",
        "ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกวันที่หรือช่วงเวลาใหม่",
      );
    }
  }

  fetch("save_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        showToast("success", "บันทึกการจองสำเร็จ!");
        showReturn();
      } else {
        showToast("error", result.message || "เกิดข้อผิดพลาด");
      }
    })
    .catch((err) => alert("ติดต่อ Server ไม่ได้: " + err));
}

function showReturn() {
  btnReturn.classList.add("active");
  btnCheckout.classList.remove("active");
  returnFields.classList.remove("hidden");
  checkoutFields.classList.add("hidden");
  loadPendingReturns(); // 🌟 โหลดรถที่ยังไม่คืนทุกครั้งที่กดแท็บนี้
}

function loadPendingReturns() {
  const select = document.getElementById("return-car-plate");
  if (!select) return;

  select.innerHTML = '<option value="" disabled selected>กำลังโหลด...</option>';

  fetch("get_pending_returns.php")
    .then((res) => res.json())
    .then((data) => {
      select.innerHTML = "";
      pendingReturnsMap = {};

      if (!data.success) {
        select.innerHTML = `<option value="" disabled selected>${data.message}</option>`;
        return;
      }
      if (!data.pending || data.pending.length === 0) {
        select.innerHTML =
          '<option value="" disabled selected>ไม่มีรถที่ต้องคืน</option>';
        return;
      }
      select.innerHTML =
        '<option value="" disabled selected>-- เลือกรถที่ต้องการคืน --</option>';
      data.pending.forEach((bk) => {
        const opt = new Option(
          `${bk.CarPlate} (${bk.BookingNumber})`,
          bk.BookingID,
        );
        select.add(opt);
        pendingReturnsMap[bk.BookingID] = bk.StartMileage; // 🌟 จำไมล์ตอนออกไว้เช็คทีหลัง
      });
    })
    .catch((err) => {
      console.error("Error loading pending returns:", err);
      select.innerHTML =
        '<option value="" disabled selected>โหลดข้อมูลไม่สำเร็จ</option>';
    });
}

function submitReturn() {
  const bookingId = document.getElementById("return-car-plate").value;
  const endMile = Number(document.getElementById("end-mile").value);
  const startMile = Number(pendingReturnsMap[bookingId] || 0);

  if (!bookingId) {
    return showToast("warning", "กรุณาเลือกรถที่ต้องการคืน");
  }

  if (endMile <= startMile) {
    return showToast(
      "warning",
      `เลขไมล์ตอนคืน (${endMile}) ต้องมากกว่าเลขไมล์ตอนออก (${startMile})`,
    );
  }

  const data = {
    booking_id: bookingId,
    return_date: document.getElementById("return-date").value,
    return_time: document.getElementById("return-time").value,
    end_mile: endMile,
    return_remark: document.getElementById("return-remark").value || "-",
  };

  fetch("save_return.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        showToast("success", "บันทึกการคืนรถสำเร็จ!");
        setTimeout(() => (window.location.href = "car-status.html"), 1500); // เว้นเวลาให้เห็น toast ก่อนเปลี่ยนหน้า
      } else {
        showToast("error", result.message || "เกิดข้อผิดพลาด");
      }
    })
    .catch((err) => showToast("error", "ติดต่อ Server ไม่ได้: " + err));
}

// รวมชื่อผู้ร่วมเดินทาง
function getPassengerNames() {
  const inputs = document.getElementsByName("passengers[]");
  return Array.from(inputs)
    .map((i) => i.value)
    .filter((v) => v.trim() !== "")
    .join(", ");
}

// 🌟 รวมรหัสพนักงานผู้ร่วมเดินทาง (Admin ใช้ตรวจย้อนหลังได้)
function getPassengerIds() {
  const inputs = document.getElementsByName("passenger_ids[]");
  return Array.from(inputs)
    .map((i) => i.value)
    .filter((v) => v.trim() !== "")
    .join(", ");
}

// ฟังก์ชันสลับหน้า
function showCheckout() {
  btnCheckout.classList.add("active");
  btnReturn.classList.remove("active");
  checkoutFields.classList.remove("hidden");
  returnFields.classList.add("hidden");
}

function addMorePassenger() {
  const list = document.getElementById("passenger-list");
  const count = list.getElementsByClassName("passenger-row").length;
  if (count < 5) {
    const newRow = document.createElement("div");
    newRow.className = "passenger-row input-row-group";
    newRow.style =
      "display: flex; gap: 10px; margin-bottom: 10px; align-items: center;";
    newRow.innerHTML = `
            <input type="text" name="passenger_ids[]" class="form-control" placeholder="รหัสพนักงาน" maxlength="4" style="flex: 1;" onblur="lookupPassengerName(this)">
            <input type="text" name="passengers[]" class="form-control" placeholder="ชื่อ (auto)" style="flex: 2;" readonly>
            <button type="button" class="btn-plus-style" onclick="this.parentElement.remove()">-</button>
        `;
    list.appendChild(newRow);
  } else {
    alert("ที่นั่งเต็มแล้วครับพี่!");
  }
}

// ฟังก์ชันสำหรับอัปเดต Progress Bar ตามการกรอกข้อมูล
function updateProgress() {
  const employeeId = document.getElementById("employee-id").value;
  const carPlate = document.getElementById("car-plate-select").value;

  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");

  step2.classList.remove("active");
  step3.classList.remove("active");

  // เงื่อนไขที่ 1: กรอกรหัสพนักงานผู้ขับแล้ว ให้ Step 2 สว่าง
  if (employeeId && employeeId.trim() !== "") {
    step2.classList.add("active");
  }

  // เงื่อนไขที่ 2: ถ้าเลือกรถแล้ว ให้ Step 3 สว่าง
  if (carPlate && carPlate !== "") {
    step3.classList.add("active");
  }
}

// ตั้งค่า Event Listener เมื่อมีการโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", function () {
  // ผูกเหตุการณ์เมื่อมีการเปลี่ยนค่า (Change) ใน Input/Select ที่เหลือ
  const empIdEl = document.getElementById("employee-id");
  if (empIdEl) empIdEl.addEventListener("blur", updateProgress);

  const plateEl = document.getElementById("car-plate-select");
  if (plateEl) plateEl.addEventListener("change", updateProgress);

  // เรียกครั้งแรกเผื่อมีข้อมูลค้างอยู่ (เช่น กด Refresh)
  updateProgress();
});

function showStartMileHint(bookingId) {
  const hint = document.getElementById("start-mile-hint");
  const endMileInput = document.getElementById("end-mile");
  if (!hint) return;

  const startMile = pendingReturnsMap[bookingId];

  if (!bookingId || startMile === undefined) {
    hint.innerText = "เลือกรถก่อนเพื่อดูเลขไมล์ตอนยืม";
    return;
  }

  hint.innerText = `เลขไมล์ตอนยืม: ${startMile.toLocaleString()} กม.`;
  hint.style.color = "#27ae60"; // เขียวให้เด่นขึ้นตอนมีค่าจริง

  // 🌟 ตั้งค่าเริ่มต้นในช่องคืนให้เท่ากับตอนยืม กันลืมว่าฐานอยู่ที่เท่าไหร่
  if (endMileInput) {
    endMileInput.value = startMile;
    endMileInput.min = startMile + 1; // บังคับกรอกมากกว่าเดิมอย่างน้อย 1
  }
}

// ==========================================
// 🌟 ฟังก์ชันจำกัดวันที่และซ่อนช่วงเวลาที่เลยเวลาแล้ว
// ==========================================

// 1. ตั้งค่าไม่ให้เลือกวันย้อนหลังได้
function setupDateLimits() {
  const useDateInput = document.getElementById("use-date");
  if (useDateInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    // กำหนดค่า min เป็นวันที่ปัจจุบัน
    useDateInput.min = `${year}-${month}-${day}`;
  }
}

// 2. เช็กเวลาปัจจุบันเพื่อปิดตัวเลือกที่เลยเวลาแล้ว
function updateAvailableTimeSlots() {
  const dateInput = document.getElementById("use-date");
  const timeSelect = document.getElementById("time-slot");

  if (!dateInput || !timeSelect) return;

  const selectedDateVal = dateInput.value;
  if (!selectedDateVal) return;

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const todayStr = `${year}-${month}-${day}`;

  const currentHour = now.getHours(); // ชั่วโมงปัจจุบัน (0-23)

  const options = timeSelect.options;

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    const val = opt.value;

    if (!val) continue; // ข้าม option ตัวแรกที่เป็นข้อความแนะนำ

    if (selectedDateVal === todayStr) {
      // 📌 ถ้าเลือกใช้งาน "วันนี้"
      if ((val === "เช้า" || val === "ทั้งวัน") && currentHour >= 8) {
        // หลัง 08:00 น. ไม่สามารถจองรอบเช้าหรือทั้งวันได้
        opt.disabled = true;
      } else if (val === "บ่าย" && currentHour >= 13) {
        // หลัง 13:00 น. ไม่สามารถจองรอบบ่ายได้
        opt.disabled = true;
      } else if (val === "กลางคืน" && currentHour >= 17) {
        // หลัง 17:00 น. ไม่สามารถจองรอบกลางคืนได้
        opt.disabled = true;
      } else {
        opt.disabled = false;
      }
    } else {
      // 📌 ถ้าเป็นวันอื่นในอนาคต สามารถเลือกได้ทุกรอบ
      opt.disabled = false;
    }
  }

  // ถ้าช่วงเวลาที่เคยเลือกไว้ถูกปิดใช้งาน ให้รีเซ็ตค่ากลับเป็นค่าว่าง
  if (timeSelect.selectedOptions[0] && timeSelect.selectedOptions[0].disabled) {
    timeSelect.value = "";
  }
}

// เรียกทำงานทันทีเมื่อโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", () => {
  setupDateLimits();

  const dateInput = document.getElementById("use-date");
  if (dateInput) {
    dateInput.addEventListener("change", updateAvailableTimeSlots);
  }
});
