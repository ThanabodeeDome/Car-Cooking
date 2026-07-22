let btnCheckout, btnReturn, plateSelect, checkoutFields, returnFields;
let dbCarData = []; // เก็บข้อมูลรถที่ดึงมาจาก DB
let pendingReturnsMap = {}; // 🌟 เก็บ StartMileage ผูกกับ BookingID

const companyData = {
  บริหาร: {
    // หน่วยงานหลักช่องที่ 1
    ทรัพยากรและการเงิน: ["บุคคลและความปลอดภัย", "บัญชีการเงินและต้นทุน"], // ฝ่าย และ แผนก
    การตลาดและจัดซื้อ: ["การตลาด", "จัดซื้อและพัสดุ"], // ฝ่าย และ แผนก
  },
  วิศวกรรมและเทคโนโลยี: {
    // หน่วยงานหลักช่องที่ 1
    วิศวกรรมผลิตภัณฑ์และแม่พิมพ์: [
      "วิศวกรรมโครงการ",
      "ออกแบบผลิตภัณฑ์และแม่พิมพ์",
      "ผลิตและประกอบแม่พิมพ์",
      "ทดลองแม่พิมพ์",
    ], //
    วิศวกรรมระบบอัตโนมัติ: [
      "ระบบดิจิทอลและไอที",
      "วิศวกรรมหุ่นยนต์และ IoT",
      "บำรุงรักษา",
    ], //
  },
  ผลิตและบริหารคุณภาพ: {
    // หน่วยงานหลักช่องที่ 1
    บริหารการผลิตและโลจิสติกส์: ["วางแผนการผลิตและ TPS", "จัดส่งและคลังสินค้า"], //
    บริหารคุณภาพ: ["ประกันคุณภาพและมาตรฐาน", "ควบคุมคุณภาพ"], //
    "ผลิต 1": ["ปั๊ม 1", "ปั๊ม 2", "ประกอบ", "บำรุงรักษาแม่พิมพ์"], //
    "ผลิต 2": ["ชิ้นส่วนท่อ", "ประกอบท่อ", "ชิ้นส่วนสี"], //
  },
};

// --- ระบบหน่วยงาน 3 ระดับ ---
function updateSubDept() {
  const main = document.getElementById("main_dept").value;
  const subSelect = document.getElementById("sub_dept");
  subSelect.innerHTML =
    '<option value="" disabled selected>-- เลือกฝ่าย --</option>';
  if (companyData[main]) {
    for (let sub in companyData[main]) {
      subSelect.options.add(new Option(sub, sub));
    }
  }
  updateSection();
}

function updateSection() {
  const main = document.getElementById("main_dept").value;
  const sub = document.getElementById("sub_dept").value;
  const secSelect = document.getElementById("section");
  secSelect.innerHTML =
    '<option value="" disabled selected>-- เลือกแผนก --</option>';
  if (companyData[main] && companyData[main][sub]) {
    companyData[main][sub].forEach((sec) => {
      secSelect.options.add(new Option(sec, sec));
    });
  }
}

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

  // 🌟 โหลดรหัสพนักงานจาก session มาโชว์ (อ่านอย่างเดียว)
  fetch("get_current_user.php")
    .then((res) => res.json())
    .then((u) => {
      const empIdInput = document.getElementById("employee-id");
      if (u.success && empIdInput) {
        empIdInput.value = u.employee_id;
      }
    });

  // ปุ่มสลับหน้า
  if (btnCheckout) btnCheckout.addEventListener("click", showCheckout);
  if (btnReturn) btnReturn.addEventListener("click", showReturn);
});

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

function updateCarDetails(plate) {
  const startMileInput = document.getElementById("start-mile");
  const car = dbCarData.find((c) => c.Plate === plate);
  if (car && startMileInput) {
    startMileInput.value = car.Mileage;
    startMileInput.min = car.Mileage;
  }
}

// --- ปุ่มยืนยันยืมรถ (ขาออก) ---
function submitBooking() {
  fetch("get_current_user.php")
    .then((res) => res.json())
    .then((sessionUser) => {
      if (!sessionUser.success) {
        alert("กรุณาเข้าสู่ระบบก่อนทำการจอง");
        return;
      }

      const data = {
        driver_name: document.getElementById("driver-name").value,
        employee_id: sessionUser.employee_id, // 🌟 ใช้จาก session แทนช่องพิมพ์เอง
        main_dept: document.getElementById("main_dept").value,
        sub_dept: document.getElementById("sub_dept").value,
        section: document.getElementById("section").value,
        car_plate: document.getElementById("car-plate-select").value,
        start_mile: document.getElementById("start-mile").value,
        use_date: document.getElementById("use-date").value,
        time_slot: document.getElementById("time-slot").value,
        destination: document.getElementById("destination").value,
        work_type: document.getElementById("work-type").value,
        passengers: getPassengerNames(),
        passenger_ids: getPassengerIds(),
        out_remark: document.getElementById("out-remark").value || "-",
      };

      if (
        !data.car_plate ||
        !data.driver_name ||
        !data.section ||
        !data.time_slot
      ) {
        return showToast(
          "warning",
          "กรุณากรอกข้อมูล ชื่อผู้ขับ, หน่วยงาน, ทะเบียนรถ และ ช่วงเวลา ให้ครบถ้วน!",
        );
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
    });
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

// 🌟 รวมรหัสพนักงานผู้ร่วมเดินทาง
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
            <input type="text" name="passengers[]" class="form-control" placeholder="ชื่อคนที่ ${count + 1}" style="flex: 2;">
            <input type="text" name="passenger_ids[]" class="form-control" placeholder="รหัส" maxlength="4" style="flex: 1;">
            <button type="button" class="btn-plus-style" onclick="this.parentElement.remove()">-</button>
        `;
    list.appendChild(newRow);
  } else {
    alert("ที่นั่งเต็มแล้วครับพี่!");
  }
}

// ฟังก์ชันสำหรับอัปเดต Progress Bar ตามการกรอกข้อมูล
function updateProgress() {
  const mainDept = document.getElementById("main_dept").value;
  const subDept = document.getElementById("sub_dept").value;
  const section = document.getElementById("section").value;
  const carPlate = document.getElementById("car-plate-select").value;

  // ดึงรายการ Step ทั้งหมดมา
  const step1 = document.getElementById("step-1");
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");

  // ล้างสถานะ active ออกให้หมดก่อน (ยกเว้นอันแรกที่ต้องสว่างตลอด)
  step2.classList.remove("active");
  step3.classList.remove("active");

  // เงื่อนไขที่ 1: ถ้าเลือกแผนกจนถึงระดับ 'Section' แล้ว ให้ Step 2 สว่าง
  if (section && section !== "") {
    step2.classList.add("active");
  }

  // เงื่อนไขที่ 2: ถ้าเลือกรถแล้ว ให้ Step 3 สว่าง
  if (carPlate && carPlate !== "") {
    step3.classList.add("active");
  }
}

// ตั้งค่า Event Listener เมื่อมีการโหลดหน้าเว็บ
document.addEventListener("DOMContentLoaded", function () {
  // ผูกเหตุการณ์เมื่อมีการเปลี่ยนค่า (Change) ใน Select ต่างๆ
  const inputs = ["main_dept", "sub_dept", "section", "car-plate-select"];

  inputs.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", updateProgress);
    }
  });

  // เรียกครั้งแรกเผื่อมีข้อมูลค้างอยู่ (เช่น กด Refresh)
  updateProgress();
});

// ตัวอย่างการปรับฟังก์ชันเช็กสถานะใน booking.js
function checkUserStatus(employeeId) {
  fetch(`get_user_status.php?id=${employeeId}`)
    .then((res) => res.json())
    .then((data) => {
      // data.lastStatus จะส่งกลับมาเป็น "ขาไป" หรือ "ขากลับ" จาก SQL Server แล้ว
      if (data.lastStatus === "ขาไป") {
        // ถ้าสถานะเป็น "ขาไป" แปลว่ากำลังเอารถไปใช้ซัพพลายเออร์อยู่ -> ให้เปิดฟอร์ม "คืนรถ" (ขากลับ)
        showReturnForm();
      } else {
        // ถ้าสถานะเป็น "ขากลับ" แปลว่าส่งรถคืนเรียกว่า -> ให้เปิดฟอร์ม "เบิกรถใหม่" (ขาไป)
        showCheckoutForm();
      }
    })
    .catch((err) => console.error("Error checking status:", err));
}

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
