window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

// 🔒 กัน Stored XSS: ชื่อพนักงาน/ชื่อผู้ขับมาจากที่ผู้ใช้กรอกเองตอนสมัคร ต้อง escape ก่อนแปะลง innerHTML
function escHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

let btnCheckout, btnReturn, plateSelect, checkoutFields, returnFields;
let dbCarData = []; // เก็บข้อมูลรถที่ดึงมาจาก DB
let pendingReturnsMap = {}; // 🌟 เก็บ StartMileage ผูกกับ BookingID

// 🌟 REALTIME: ตัวจับเวลา polling แยกกันระหว่างแท็บ "ขาไป" กับ "ขากลับ"
let checkoutPollTimer = null;
let returnPollTimer = null;
const POLL_INTERVAL_MS = 8000;

document.addEventListener("DOMContentLoaded", () => {
  btnCheckout = document.getElementById("btn-checkout");
  btnReturn = document.getElementById("btn-return");
  plateSelect = document.getElementById("car-plate-select");
  checkoutFields = document.getElementById("checkout-fields");
  returnFields = document.getElementById("return-fields");

  const now = new Date();
  // 🩹 toISOString() เป็น UTC — ก่อน 07:00 น. (ไทย) จะได้วันที่ "เมื่อวาน" ต้องใช้วันที่ตามเวลาเครื่อง
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  const hourNow = now.getHours().toString().padStart(2, "0") + ":00"; // 🌟 select มีแค่ตัวเลือกรายชั่วโมง ปัดเวลาปัจจุบันลงให้ตรง option ที่มีจริง

  if (document.getElementById("use-date"))
    document.getElementById("use-date").value = today;
  if (document.getElementById("return-date"))
    document.getElementById("return-date").value = today;

  // 🌟 gen dropdown เวลาไป/เวลากลับ/เวลาที่คืน แบบ 24 ชม. (เดิม "เวลาที่คืน" เป็น <input type="time"> เบราว์เซอร์ล้วนๆ
  // ยังไม่ได้ทำ custom เหมือนอันอื่น เปลี่ยนเป็น select ตัวเดียวกันให้เข้าชุด)
  populateTimeDropdown("out-time-select");
  populateTimeDropdown("return-time-select");
  populateTimeDropdown("return-time");
  if (document.getElementById("return-time")) {
    document.getElementById("return-time").value = hourNow;
  }

  loadAvailableCars(today);

  if (btnCheckout) btnCheckout.addEventListener("click", showCheckout);
  if (btnReturn) btnReturn.addEventListener("click", showReturn);

  startCheckoutPolling();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopCheckoutPolling();
      stopReturnPolling();
    } else {
      if (returnFields && !returnFields.classList.contains("hidden")) {
        loadPendingReturns();
        startReturnPolling();
      } else {
        loadAvailableCars();
        updateAvailableTimeSlots();
        startCheckoutPolling();
      }
    }
  });

  // 🌟 เปลี่ยนเวลาไป/เวลากลับ -> เช็คว่าข้ามคืนไหม + เตือนถ้าชนช่วงที่จองไว้แล้ว
  const outTimeEl = document.getElementById("out-time-select");
  const returnTimeEl = document.getElementById("return-time-select");
  if (outTimeEl) outTimeEl.addEventListener("change", checkOvernightHint);
  if (returnTimeEl) returnTimeEl.addEventListener("change", checkOvernightHint);
});

// 🌟 สร้างตัวเลือกเวลา 00:00 - 23:00 ทุก 60 นาที ใส่ลง <select> ตาม id ที่ระบุ
function populateTimeDropdown(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    const value = `${hh}:00`;
    select.add(new Option(value, value));
  }
}

// 🌟 ถ้าเวลากลับ <= เวลาไป ถือว่าข้ามคืน โชว์ hint เตือนให้รู้ตัว (ไม่บล็อกการจอง)
function checkOvernightHint() {
  const outVal = document.getElementById("out-time-select")?.value;
  const returnVal = document.getElementById("return-time-select")?.value;
  const hint = document.getElementById("overnight-hint");
  if (!hint) return;
  if (outVal && returnVal && returnVal <= outVal) {
    hint.classList.remove("hidden");
  } else {
    hint.classList.add("hidden");
  }
}

// 🌟 Enter = lookup แล้วเด้งโฟกัสไปช่อง input/select ถัดไปที่กรอกได้ (ข้าม readonly/disabled/hidden)
function focusNextField(currentEl) {
  const form = currentEl.closest("form");
  if (!form) return;
  const focusable = Array.from(
    form.querySelectorAll("input, select, textarea, button"),
  ).filter(
    (el) =>
      !el.disabled &&
      !el.readOnly &&
      el.type !== "hidden" &&
      el.offsetParent !== null,
  );
  const idx = focusable.indexOf(currentEl);
  if (idx > -1 && idx + 1 < focusable.length) {
    focusable[idx + 1].focus();
  }
}

function startCheckoutPolling() {
  stopCheckoutPolling();
  checkoutPollTimer = setInterval(() => {
    loadAvailableCars();
    updateAvailableTimeSlots();
  }, POLL_INTERVAL_MS);
}

function stopCheckoutPolling() {
  if (checkoutPollTimer) {
    clearInterval(checkoutPollTimer);
    checkoutPollTimer = null;
  }
}

function startReturnPolling() {
  stopReturnPolling();
  returnPollTimer = setInterval(() => {
    loadPendingReturns();
  }, POLL_INTERVAL_MS);
}

function stopReturnPolling() {
  if (returnPollTimer) {
    clearInterval(returnPollTimer);
    returnPollTimer = null;
  }
}

function loadAvailableCars(dateVal) {
  const date = dateVal || document.getElementById("use-date")?.value || "";
  fetch(`get_cars.php?date=${encodeURIComponent(date)}`)
    .then((res) => res.json())
    .then((allData) => {
      // 🩹 FIX: เดิมกรองเอาเฉพาะ RealStatus === "ว่าง" ออกมาโชว์ในดรอปดาวน์
      // แต่ RealStatus คำนวณระดับ "ทั้งวัน" (มีจองช่วงไหนของวันก็ตีเป็น "ติดจอง" หมด)
      // ตั้งแต่เปลี่ยนมาใช้เวลาอิสระ (ไม่ใช่ 4 slot คงที่) รถที่จองแค่ 11:00-12:00
      // ก็ยังว่างช่วง 13:00-17:00 ได้ แต่ถูกกรองออกจากดรอปดาวน์ไปทั้งวันเงียบๆ
      // ตัดชนเวลาจริงเช็คที่ server (save_booking.php) + เตือนช่วงที่ถูกจองแล้วผ่าน
      // updateAvailableTimeSlots() อยู่แล้ว ฝั่งนี้เลยกรองแค่สถานะที่ใช้ไม่ได้จริงๆ พอ
      const data = allData.filter(
        (car) => car.RealStatus !== "งดให้บริการ" && car.RealStatus !== "กำลังใช้งาน",
      );
      dbCarData = data;
      if (plateSelect) {
        const prevSelected = plateSelect.value;
        plateSelect.innerHTML = '<option value="" disabled selected>เลือกทะเบียนรถ</option>';
        data.forEach((car) => {
          const opt = new Option(`${car.Plate} (${car.Brand})`, car.Plate);
          if (car.image) opt.dataset.image = car.image;
          plateSelect.add(opt);
        });
        if (prevSelected && data.some((c) => c.Plate === prevSelected)) {
          plateSelect.value = prevSelected;
        } else if (prevSelected) {
          const startMileInput = document.getElementById("start-mile");
          if (startMileInput) startMileInput.value = "";
          const previewImg = document.getElementById("car-preview-img");
          if (previewImg) previewImg.classList.add("hidden");
          showToast("warning", "รถที่เลือกไว้ถูกจองไปแล้ว กรุณาเลือกคันใหม่");
        }
      }
    })
    .catch((err) => console.error("Error loading cars:", err));
}

function updateCarDetails(plate) {
  const startMileInput = document.getElementById("start-mile");
  const previewImg = document.getElementById("car-preview-img");
  const car = dbCarData.find((c) => c.Plate === plate);
  if (car && startMileInput) {
    startMileInput.value = car.Mileage;
  }
  if (previewImg) {
    if (car && car.image) {
      previewImg.src = car.image;
      previewImg.alt = `${car.Plate} (${car.Brand || ""})`;
      previewImg.classList.remove("hidden");
      previewImg.onerror = () => {
        previewImg.src = "assets/img-car/default.png";
      };
    } else {
      previewImg.classList.add("hidden");
    }
  }
  updateAvailableTimeSlots();
}

// 🔢 รหัสพนักงาน: เติม 0 นำหน้าให้ครบ 5 หลักเสมอ (91 -> 00091, 2126 -> 02126)
function padEmployeeId(input) {
  if (!input) return;
  const v = input.value.trim();
  if (/^\d+$/.test(v) && v.length > 0 && v.length <= 5) {
    input.value = v.padStart(5, "0");
  }
}

function lookupDriverName() {
  const empIdInput = document.getElementById("employee-id");
  padEmployeeId(empIdInput);
  const empId = empIdInput.value.trim();
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

// ============================================================
// 🌟 ผู้เข้าร่วมเพิ่มเติม — ค้นหาชื่อ/อีเมล + ติ๊กเลือกจากลิสต์ (แบบเดียวกับจองห้องประชุม)
// เก็บคนที่เลือกไว้ใน Map กันหายตอนค้นหาคำใหม่ทับ (คนที่เลือกไว้ก่อนหน้ายังติ๊กค้างอยู่ถ้าค้นเจอซ้ำ)
// ============================================================
const selectedPassengers = new Map(); // employee_id -> { employee_id, name }
const AVATAR_COLORS = ["#3b82f6", "#14b8a6", "#ec4899", "#8b5cf6", "#f59e0b", "#ef4444", "#22c55e"];

function avatarColorFor(text) {
  let sum = 0;
  for (let i = 0; i < text.length; i++) sum += text.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

let passengerSearchDebounce = null;
function onPassengerSearchInput(query) {
  clearTimeout(passengerSearchDebounce);
  passengerSearchDebounce = setTimeout(() => runPassengerSearch(query.trim()), 250);
}

function runPassengerSearch(query) {
  fetch(`search_employees.php?q=${encodeURIComponent(query)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) return;
      renderPassengerResults(data.results);
    })
    .catch((err) => console.error("search_employees error:", err));
}

function renderPassengerResults(results) {
  const wrap = document.getElementById("passenger-search-results");
  if (!wrap) return;
  wrap.innerHTML = "";
  wrap.classList.remove("hidden");

  const myEmpId = document.getElementById("employee-id")?.value?.trim();

  results
    .filter((r) => r.employee_id !== myEmpId) // กันเลือกตัวเองเป็นผู้ร่วมทาง (เป็นคนขับอยู่แล้ว)
    .forEach((r) => {
      const isChecked = selectedPassengers.has(r.employee_id);
      const row = document.createElement("div");
      row.className = "passenger-result-row" + (isChecked ? " is-selected" : "");
      row.innerHTML = `
        <input type="checkbox" ${isChecked ? "checked" : ""}>
        <div class="passenger-avatar" style="background:${avatarColorFor(r.name || r.email || "?")}">${escHtml((r.name || r.email || "?").trim().charAt(0))}</div>
        <div class="passenger-result-text">
          <div class="passenger-result-name">${r.name ? escHtml(r.name) : "(ไม่มีชื่อ)"}</div>
          <div class="passenger-result-sub">${escHtml(r.email || r.employee_id)}</div>
        </div>`;

      const checkbox = row.querySelector('input[type="checkbox"]');
      row.addEventListener("mousedown", (e) => e.preventDefault()); // กัน input เสีย focus ก่อน click ทำงาน (เลี่ยง blur ปิด dropdown ก่อนกดติ๊ก)
      row.addEventListener("click", (e) => {
        if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          selectedPassengers.set(r.employee_id, { employee_id: r.employee_id, name: r.name, email: r.email });
        } else {
          selectedPassengers.delete(r.employee_id);
        }
        row.classList.toggle("is-selected", checkbox.checked);
        updatePassengerSelectedCount();
      });

      wrap.appendChild(row);
    });

  updatePassengerSelectedCount();
}

function onPassengerSearchBlur() {
  // 🌟 หน่วงก่อนปิด dropdown กัน blur ตัดหน้า click ที่แถวผลลัพธ์ (mousedown ป้องกันไว้ชั้นนึงแล้ว อันนี้กันซ้ำ)
  setTimeout(() => {
    const wrap = document.getElementById("passenger-search-results");
    if (wrap) wrap.classList.add("hidden");
  }, 150);
}

function updatePassengerSelectedCount() {
  const label = document.getElementById("passenger-count-label");
  if (label) {
    label.textContent = selectedPassengers.size > 0 ? ` (เลือกแล้ว ${selectedPassengers.size})` : "";
  }
  renderPassengerChips();
}

// 🌟 คนที่เลือกไว้ -> โชว์เป็น chip ใต้ช่องค้นหา (แบบเดียวกับจองห้องประชุม) กดกากบาทเพื่อเอาออกได้เลย
function renderPassengerChips() {
  const wrap = document.getElementById("passenger-chips");
  if (!wrap) return;
  wrap.innerHTML = "";

  selectedPassengers.forEach((p, empId) => {
    const chip = document.createElement("span");
    chip.className = "passenger-chip";
    chip.innerHTML = `${escHtml(p.name || p.email || empId)} <span class="chip-remove">&times;</span>`;
    chip.querySelector(".chip-remove").addEventListener("click", () => removePassenger(empId));
    wrap.appendChild(chip);
  });
}

function removePassenger(empId) {
  selectedPassengers.delete(empId);
  updatePassengerSelectedCount();
  // ถ้า dropdown ผลค้นหายังเปิดอยู่ ค้นซ้ำด้วยคำเดิมให้ checkbox/ไฮไลต์ sync ตาม map ล่าสุด
  const searchInput = document.getElementById("passenger-search");
  const resultsWrap = document.getElementById("passenger-search-results");
  if (searchInput && resultsWrap && !resultsWrap.classList.contains("hidden")) {
    runPassengerSearch(searchInput.value.trim());
  }
}

function getPassengerNames() {
  return Array.from(selectedPassengers.values()).map((p) => p.name).join(", ");
}

function getPassengerIds() {
  return Array.from(selectedPassengers.keys()).join(", ");
}

function resetPassengerSelection() {
  selectedPassengers.clear();
  const search = document.getElementById("passenger-search");
  if (search) search.value = "";
  const wrap = document.getElementById("passenger-search-results");
  if (wrap) wrap.innerHTML = "";
  const counter = document.getElementById("passenger-selected-count");
  if (counter) counter.remove();
}

// --- ปุ่มยืนยันยืมรถ (ขาออก) ---
function submitBooking() {
  const outTime = document.getElementById("out-time-select").value;
  const returnTime = document.getElementById("return-time-select").value;

  const data = {
    driver_name: document.getElementById("driver-name").value,
    employee_id: document.getElementById("employee-id").value,
    car_plate: document.getElementById("car-plate-select").value,
    start_mile: document.getElementById("start-mile").value,
    use_date: document.getElementById("use-date").value,
    out_time: outTime, // 🌟 เวลาไป (แทน time_slot เดิม)
    planned_return_time: returnTime, // 🌟 เวลากลับโดยประมาณ
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

  if (!data.car_plate || !data.out_time || !data.planned_return_time) {
    return showToast(
      "warning",
      "กรุณาเลือกทะเบียนรถ เวลาไป และเวลากลับ ให้ครบถ้วน!",
    );
  }

  // 🌟 กันจองเวลาที่ผ่านมาแล้ว (คำนวณ end datetime จริง รองรับข้ามคืน)
  if (data.use_date) {
    const outDt = new Date(`${data.use_date}T${outTime}:00`);
    let endDt = new Date(`${data.use_date}T${returnTime}:00`);
    if (returnTime <= outTime) {
      endDt.setDate(endDt.getDate() + 1); // ข้ามคืน จบเช้าวันถัดไป
    }
    if (endDt < new Date()) {
      return showToast(
        "warning",
        "ช่วงเวลานี้ผ่านไปแล้ว กรุณาเลือกวันที่หรือเวลาใหม่",
      );
    }
  }

  const repeatWeeks = parseInt(document.getElementById("repeat-weeks")?.value || "0", 10) || 0;
  const postBooking = (payload) =>
    fetch("save_booking.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((res) => res.json());

  (async () => {
    try {
      const first = await postBooking(data);
      if (!first.success) {
        showToast("error", first.message || "เกิดข้อผิดพลาด");
        loadAvailableCars();
        updateAvailableTimeSlots();
        return;
      }
      // จองซ้ำรายสัปดาห์: ยิงทีละสัปดาห์ (ผ่านการตรวจชนเวลาของ server ทุกรอบ) สัปดาห์ไหนชนก็ข้าม แล้วสรุปให้
      let ok = 1;
      const skipped = [];
      for (let w = 1; w <= repeatWeeks; w++) {
        const dt = new Date(`${data.use_date}T00:00:00`);
        dt.setDate(dt.getDate() + 7 * w);
        const dateStr = formatDateYMD(dt);
        try {
          const r = await postBooking({ ...data, use_date: dateStr });
          if (r.success) ok++;
          else skipped.push(dateStr);
        } catch (e) {
          skipped.push(dateStr);
        }
      }
      if (repeatWeeks > 0) {
        showToast(
          skipped.length ? "warning" : "success",
          `จองสำเร็จ ${ok} จาก ${repeatWeeks + 1} สัปดาห์` + (skipped.length ? ` (ข้ามวันที่ติดจอง: ${skipped.join(", ")})` : ""),
        );
      } else {
        showToast("success", "บันทึกการจองสำเร็จ!");
      }
      const rw = document.getElementById("repeat-weeks");
      if (rw) rw.value = "0";
      closeBookingModal();
      refreshGantt();
      showReturn();
    } catch (err) {
      alert("ติดต่อ Server ไม่ได้: " + err);
    }
  })();
}

function showReturn() {
  btnReturn.classList.add("active");
  btnCheckout.classList.remove("active");
  returnFields.classList.remove("hidden");
  checkoutFields.classList.add("hidden");
  loadPendingReturns();
  stopCheckoutPolling();
  stopGanttPolling();
  startReturnPolling();
}

function loadPendingReturns() {
  const select = document.getElementById("return-car-plate");
  if (!select) return;

  const prevSelected = select.value;
  const isFirstLoad = select.options.length === 0;
  if (isFirstLoad) {
    select.innerHTML = '<option value="" disabled selected>กำลังโหลด...</option>';
  }

  fetch("get_pending_returns.php")
    .then((res) => res.json())
    .then((data) => {
      select.innerHTML = "";
      pendingReturnsMap = {};

      if (!data.success) {
        select.innerHTML = `<option value="" disabled selected>${escHtml(data.message)}</option>`;
        return;
      }
      if (!data.pending || data.pending.length === 0) {
        select.innerHTML =
          '<option value="" disabled selected>ไม่มีรถที่ต้องคืน</option>';
        return;
      }
      select.innerHTML =
        '<option value="" disabled selected>-- เลือกรถที่ต้องการคืน --</option>';
      let stillExists = false;
      data.pending.forEach((bk) => {
        const opt = new Option(
          `${bk.CarPlate} (${bk.BookingNumber})`,
          bk.BookingID,
        );
        select.add(opt);
        pendingReturnsMap[bk.BookingID] = bk.StartMileage;
        if (String(bk.BookingID) === String(prevSelected)) stillExists = true;
      });
      if (prevSelected && stillExists) {
        select.value = prevSelected;
      } else if (prevSelected && !isFirstLoad) {
        showToast("warning", "รายการที่เลือกไว้ถูกคืนไปแล้ว กรุณาเลือกใหม่");
        document.getElementById("start-mile-hint") &&
          (document.getElementById("start-mile-hint").innerText =
            "เลือกรถก่อนเพื่อดูเลขไมล์ตอนยืม");
      }
    })
    .catch((err) => {
      console.error("Error loading pending returns:", err);
      if (isFirstLoad) {
        select.innerHTML =
          '<option value="" disabled selected>โหลดข้อมูลไม่สำเร็จ</option>';
      }
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
        setTimeout(() => {
          askSystemFeedback(bookingId, () => {
            window.location.href = "booking-details.html";
          });
        }, 1200);
      } else {
        showToast("error", result.message || "เกิดข้อผิดพลาด");
        loadPendingReturns();
      }
    })
    .catch((err) => showToast("error", "ติดต่อ Server ไม่ได้: " + err));
}

function showCheckout() {
  btnCheckout.classList.add("active");
  btnReturn.classList.remove("active");
  checkoutFields.classList.remove("hidden");
  returnFields.classList.add("hidden");
  stopReturnPolling();
  loadAvailableCars();
  updateAvailableTimeSlots();
  startCheckoutPolling();
  refreshGantt();
  startGanttPolling();
}

function updateProgress() {
  const step2 = document.getElementById("step-2");
  const step3 = document.getElementById("step-3");
  if (!step2 || !step3) return;

  const employeeId = document.getElementById("employee-id").value;
  const carPlate = document.getElementById("car-plate-select").value;

  step2.classList.remove("active");
  step3.classList.remove("active");

  if (employeeId && employeeId.trim() !== "") {
    step2.classList.add("active");
  }
  if (carPlate && carPlate !== "") {
    step3.classList.add("active");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const empIdEl = document.getElementById("employee-id");
  if (empIdEl) empIdEl.addEventListener("blur", updateProgress);

  const plateEl = document.getElementById("car-plate-select");
  if (plateEl) plateEl.addEventListener("change", updateProgress);

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
  hint.style.color = "#27ae60";

  if (endMileInput) {
    endMileInput.value = startMile;
    endMileInput.min = startMile + 1;
  }
}

function setupDateLimits() {
  const useDateInput = document.getElementById("use-date");
  if (useDateInput) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    useDateInput.min = `${year}-${month}-${day}`;
  }
}

// 🩹 REDESIGN: เดิมฟังก์ชันนี้ disable ตัวเลือกใน dropdown 4 slot ตรงๆ
// ตอนนี้เวลาเลือกได้อิสระ 24 ชม. ไม่มี "ตัวเลือกจำกัด" ให้ disable แบบเดิมแล้ว
// เปลี่ยนมาโชว์ "รายการช่วงที่ถูกจองแล้ว" เป็นข้อความเตือนใต้ dropdown แทน (ไม่บล็อกการเลือก)
// การกันชนจริงทำที่ save_booking.php ตอน submit เสมอ (กันคนแอบแก้ frontend)
function updateAvailableTimeSlots() {
  const dateInput = document.getElementById("use-date");
  const plateSelectEl = document.getElementById("car-plate-select");
  let hintBox = document.getElementById("booked-ranges-hint");

  if (!hintBox) {
    hintBox = document.createElement("div");
    hintBox.id = "booked-ranges-hint";
    hintBox.className = "hint-box hidden"; // 🩹 FIX: กรอบ+พื้นหลังแยกเป็น class ที่มีข้อความค่อย add
    // ไม่งั้นตอนข้อความว่าง (innerHTML="") padding/border/background เดิมยังกินพื้นที่อยู่ กลายเป็นแท่งสีเหลืองว่างเปล่าลอยอยู่
    const overnightHint = document.getElementById("overnight-hint");
    if (overnightHint) {
      overnightHint.insertAdjacentElement("afterend", hintBox);
    }
  }

  const setHintText = (html) => {
    hintBox.innerHTML = html;
    hintBox.classList.toggle("hidden", !html);
  };

  if (!dateInput) return;
  const selectedDateVal = dateInput.value;
  const plate = plateSelectEl ? plateSelectEl.value : "";
  if (!selectedDateVal || !plate) {
    setHintText("");
    return;
  }

  fetch(
    `get_booked_ranges.php?plate=${encodeURIComponent(plate)}&date=${encodeURIComponent(selectedDateVal)}`,
  )
    .then((res) => res.json())
    .then((data) => {
      if (!data.success || !Array.isArray(data.ranges) || data.ranges.length === 0) {
        setHintText("");
        return;
      }
      const items = data.ranges
        .map((r) => {
          const out = (r.out_time || "").slice(0, 5);
          const ret = (r.planned_return_time || "").slice(0, 5);
          return escHtml(`${r.booking_date} ${out}-${ret} น. (${r.driver_name || "ไม่ระบุ"})`);
        })
        .join(" · ");
      setHintText(`⚠️ รถคันนี้ถูกจองแล้วช่วง: ${items}`);
    })
    .catch((err) => console.error("Error loading booked ranges:", err));
}

document.addEventListener("DOMContentLoaded", () => {
  setupDateLimits();

  const dateInput = document.getElementById("use-date");
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      loadAvailableCars(dateInput.value);
      updateAvailableTimeSlots();
    });
  }
});

// 🌟 ปฏิทินเลือกรถ (แบบเดียวกับจองห้องประชุม) — mini calendar รายเดือน + เลือกรถ 1 คันทางซ้าย
// ทางขวาโชว์ตารางว่างรายสัปดาห์ของคันที่เลือก (แถว = ชั่วโมง, คอลัมน์ = วันจันทร์-อาทิตย์)
// แตะช่วงว่าง -> เปิด modal จอง (ใช้ field/logic เดิมทั้งหมด)
// ============================================================
let miniCalYear, miniCalMonth; // เดือนที่ mini calendar กำลังโชว์ (แยกจากสัปดาห์ที่ดูอยู่ได้)
let ganttSelectedDate = formatDateYMD(new Date()); // วันที่ถูกไฮไลต์ใน mini calendar
let ganttWeekStart; // จันทร์ของสัปดาห์ที่กำลังดูตาราง (ตั้งค่าจริงใน DOMContentLoaded)
let ganttSelectedCar = null;
let carBookingsCache = [];
let ganttCarsCache = [];
let weekGridNeedsScroll = true; // เลื่อนตารางไปช่วงเวลาที่ใช้จริงตอนเปิดสัปดาห์/เลือกรถใหม่
let ganttPollTimer = null;

function formatDateYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayStr(dateObj) {
  const d = new Date(dateObj);
  const day = d.getDay(); // 0=อาทิตย์ ... 6=เสาร์
  const diff = day === 0 ? -6 : 1 - day; // เลื่อนกลับไปวันจันทร์ของสัปดาห์นั้น
  d.setDate(d.getDate() + diff);
  return formatDateYMD(d);
}

function weekRangeLabel() {
  const start = new Date(ganttWeekStart + "T00:00:00");
  const end = new Date(start.getTime() + 6 * 86400000);
  const monthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${start.getDate()} ${monthsShort[start.getMonth()]} – ${end.getDate()} ${monthsShort[end.getMonth()]} ${end.getFullYear() + 543}`;
}

// ---------- Mini calendar รายเดือน (ทางซ้าย) ----------
function renderMiniCalendar() {
  const grid = document.getElementById("mini-cal-grid");
  const label = document.getElementById("mini-cal-month-label");
  if (!grid || !label) return;

  const thaiMonthsFull = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
  label.textContent = `${thaiMonthsFull[miniCalMonth]} ${miniCalYear + 543}`;

  grid.innerHTML = "";
  const firstDay = new Date(miniCalYear, miniCalMonth, 1);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // ให้จันทร์เป็นคอลัมน์แรก
  const daysInMonth = new Date(miniCalYear, miniCalMonth + 1, 0).getDate();
  const today = formatDateYMD(new Date());
  const weekEnd = formatDateYMD(new Date(new Date(ganttWeekStart + "T00:00:00").getTime() + 6 * 86400000));

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "mini-cal-day empty";
    grid.appendChild(empty);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = formatDateYMD(new Date(miniCalYear, miniCalMonth, day));
    let cls = "mini-cal-day";
    if (dateStr === today) cls += " is-today";
    if (dateStr >= ganttWeekStart && dateStr <= weekEnd) cls += " in-selected-week";
    if (dateStr === ganttSelectedDate) cls += " is-selected";

    const cell = document.createElement("div");
    cell.className = cls;
    cell.textContent = String(day);
    cell.onclick = () => selectMiniCalDay(dateStr);
    grid.appendChild(cell);
  }
}

function shiftMiniCalMonth(delta) {
  miniCalMonth += delta;
  if (miniCalMonth < 0) {
    miniCalMonth = 11;
    miniCalYear--;
  } else if (miniCalMonth > 11) {
    miniCalMonth = 0;
    miniCalYear++;
  }
  renderMiniCalendar();
}

function selectMiniCalDay(dateStr) {
  ganttSelectedDate = dateStr;
  ganttWeekStart = getMondayStr(new Date(dateStr + "T00:00:00"));
  weekGridNeedsScroll = true;
  renderMiniCalendar();
  renderWeekLabelAndGrid();
}

// แตะวันในแถบวัน (มือถือ) — อยู่สัปดาห์เดิม แค่เปลี่ยนวันที่ดู
function selectStripDay(dateStr) {
  ganttSelectedDate = dateStr;
  renderMiniCalendar();
  renderDayStrip();
  renderDayList();
}

function shiftGanttWeek(deltaWeeks) {
  const d = new Date(ganttWeekStart + "T00:00:00");
  d.setDate(d.getDate() + 7 * deltaWeeks);
  ganttWeekStart = formatDateYMD(d);
  const weekEnd = formatDateYMD(new Date(d.getTime() + 6 * 86400000));
  const todayStr = formatDateYMD(new Date());
  // สัปดาห์ที่มีวันนี้ -> เลือกวันนี้ให้ ไม่งั้นเลือกวันจันทร์
  ganttSelectedDate = todayStr >= ganttWeekStart && todayStr <= weekEnd ? todayStr : ganttWeekStart;
  miniCalYear = d.getFullYear();
  miniCalMonth = d.getMonth();
  weekGridNeedsScroll = true;
  renderMiniCalendar();
  renderWeekLabelAndGrid();
}

function goToGanttToday() {
  const now = new Date();
  ganttSelectedDate = formatDateYMD(now);
  ganttWeekStart = getMondayStr(now);
  miniCalYear = now.getFullYear();
  miniCalMonth = now.getMonth();
  weekGridNeedsScroll = true;
  renderMiniCalendar();
  renderWeekLabelAndGrid();
}

// ---------- เลือกรถ (การ์ดมีรูป + สถานะ: มือถือเลื่อนซ้ายขวา / คอมเรียงแนวตั้ง) ----------
const CAR_STATUS_CLASS = { ว่าง: "st-free", ติดจอง: "st-booked", กำลังใช้งาน: "st-inuse" };

function loadCarSelectList() {
  fetch(`get_cars.php?date=${encodeURIComponent(ganttSelectedDate)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!Array.isArray(data)) return;
      ganttCarsCache = data;
      renderCarSelectList(data);
    })
    .catch((err) => console.error("load car list error:", err));
}

function renderCarSelectList(cars) {
  const wrap = document.getElementById("car-select-items");
  if (!wrap) return;
  const prevScroll = wrap.scrollLeft; // polling สร้างการ์ดใหม่ทุกรอบ กันลิสต์เลื่อนแนวนอนเด้งกลับต้นทาง
  wrap.innerHTML = "";

  cars.forEach((car) => {
    const status = car.RealStatus || "ว่าง";
    const disabled = status === "งดให้บริการ" || status === "เช็คระยะ";
    const img = "assets/img-car/" + (car.Carimage || "car-placeholder.png");

    const item = document.createElement("div");
    item.className =
      "car-select-item" +
      (car.Plate === ganttSelectedCar ? " is-selected" : "") +
      (disabled ? " is-disabled" : "");
    item.dataset.plate = car.Plate;
    item.innerHTML = `
      <div class="car-thumb">
        <img src="${img}" alt="" onerror="this.onerror=null; this.src='assets/img-car/car-placeholder.png';">
      </div>
      <div class="car-info">
        <div class="plate">${escHtml(car.Plate)}</div>
        <div class="model">${escHtml(car.Brand || "")} ${escHtml(car.Model || "")}</div>
      </div>
      <span class="car-status-badge ${CAR_STATUS_CLASS[status] || "st-off"}">${status}</span>`;
    if (!disabled) {
      item.addEventListener("click", () => selectGanttCar(car.Plate));
    }
    wrap.appendChild(item);
  });
  wrap.scrollLeft = prevScroll;

  // ยังไม่เคยเลือกรถ (เพิ่งเข้าหน้า) -> auto เลือกคันแรกที่ใช้งานได้ให้เลย กันตารางว่างเปล่า
  if (!ganttSelectedCar) {
    const firstAvailable = cars.find((c) => !["งดให้บริการ", "เช็คระยะ"].includes(c.RealStatus));
    if (firstAvailable) selectGanttCar(firstAvailable.Plate);
  }
}

function selectGanttCar(plate) {
  ganttSelectedCar = plate;
  weekGridNeedsScroll = true;
  document.querySelectorAll(".car-select-item").forEach((el) => {
    el.classList.toggle("is-selected", el.dataset.plate === plate);
  });
  const car = ganttCarsCache.find((c) => c.Plate === plate);
  const header = document.getElementById("gantt-car-header");
  if (header) {
    header.innerHTML = `<span>🚗 ${escHtml(plate)}</span><span class="gch-model">${car ? escHtml((car.Brand || "") + " " + (car.Model || "")) : ""}</span>`;
  }
  loadCarBookingsForGantt(plate);
}

function loadCarBookingsForGantt(plate, silent) {
  if (!silent) {
    const loading = '<p class="gantt-loading">กำลังโหลด...</p>';
    const rowsWrap = document.getElementById("gantt-rows");
    const dayList = document.getElementById("day-list-m");
    if (rowsWrap) rowsWrap.innerHTML = loading;
    if (dayList) dayList.innerHTML = loading;
  }

  fetch(`get_car_bookings.php?plate=${encodeURIComponent(plate)}`)
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        showToast("error", data.message || "โหลดตารางไม่สำเร็จ");
        return;
      }
      if (plate !== ganttSelectedCar) return; // ผู้ใช้สลับรถไปแล้วระหว่างรอ ทิ้งผลของคันเก่า
      carBookingsCache = data.bookings || [];
      renderWeekLabelAndGrid();
    })
    .catch((err) => console.error("load car bookings error:", err));
}

// ---------- สถานะรายชั่วโมง: busy (จอง/ใช้งานอยู่) = แดง, free = เขียว, past = เทา ----------
// รถที่ "ขาไป" (ใช้งานอยู่) แล้วเลยเวลาคืนที่จองไว้ = เกินกำหนด (ยังไม่คืน) → แดงเข้ม + ยืดช่วงไม่ว่างถึงชั่วโมงปัจจุบัน
function isBookingOverdue(b, now) {
  if (b.BookingStatus !== "ขาไป") return false;
  const out = String(b.OutTime || "").slice(0, 5);
  const ret = String(b.PlannedReturnTime || "").slice(0, 5);
  if (!out || !ret) return false;
  const end = new Date(`${String(b.BookingDate).slice(0, 10)}T${ret}:00`);
  if (ret <= out) end.setDate(end.getDate() + 1);
  return end < now;
}

function rangesForDate(dateStr) {
  const now = new Date();
  const today = formatDateYMD(now);
  return carBookingsCache
    .map((b) => {
      let range = bookingRangeForViewedDay(b, dateStr);
      const overdue = isBookingOverdue(b, now);
      if (range && overdue && dateStr === today) range = [range[0], Math.min(24, Math.max(range[1], now.getHours() + 1))];
      return { range, driver: b.DriverName, inUse: b.BookingStatus === "ขาไป", overdue };
    })
    .filter((r) => r.range !== null);
}

function slotState(ranges, dateStr, h, now) {
  const busy = ranges.find(({ range }) => h < range[1] && h + 1 > range[0]);
  if (busy) return { state: "busy", driver: busy.driver, inUse: busy.inUse, overdue: busy.overdue };
  // ชั่วโมงปัจจุบันยังจองได้ (server ตรวจแค่เวลาจบต้องไม่ผ่านไปแล้ว) นับ "ผ่านไปแล้ว" เมื่อจบชั่วโมงนั้นแล้วเท่านั้น
  const hourEnd = new Date(`${dateStr}T${String(h).padStart(2, "0")}:00:00`);
  hourEnd.setHours(hourEnd.getHours() + 1);
  if (hourEnd <= now) return { state: "past" };
  return { state: "free" };
}

function busyLabel(s) {
  return (s.overdue ? "เกินเวลาคืน" : s.inUse ? "ใช้งานอยู่" : "จองแล้ว") + (s.driver ? ` · ${s.driver}` : "");
}

// ---------- ตารางรายสัปดาห์ (คอม) + แถบวัน/ลิสต์รายวัน (มือถือ) ----------
function renderWeekLabelAndGrid() {
  const label = document.getElementById("gantt-week-label");
  if (label) label.textContent = weekRangeLabel();
  renderWeekDayHeaders();
  renderWeekGrid();
  renderDayStrip();
  renderDayList();
}

function renderWeekDayHeaders() {
  const wrap = document.getElementById("week-day-headers");
  if (!wrap) return;
  wrap.innerHTML = '<div class="wdh-hourcol"></div>';

  const dayAbbr = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
  const today = formatDateYMD(new Date());
  for (let i = 0; i < 7; i++) {
    const d = new Date(ganttWeekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    const dateStr = formatDateYMD(d);
    const el = document.createElement("div");
    el.className = "wdh-day" + (dateStr === today ? " is-today" : "");
    el.innerHTML = `${dayAbbr[i]}<span class="num">${d.getDate()}</span>`;
    wrap.appendChild(el);
  }
}

function weekDatesList() {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ganttWeekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    dates.push(formatDateYMD(d));
  }
  return dates;
}

function renderWeekGrid() {
  const rowsWrap = document.getElementById("gantt-rows");
  const scroller = document.getElementById("gantt-scroll-wrap");
  if (!rowsWrap) return;
  const prevTop = scroller ? scroller.scrollTop : 0;
  rowsWrap.innerHTML = "";

  if (!ganttSelectedCar) {
    rowsWrap.innerHTML = '<p class="gantt-loading">เลือกรถก่อน...</p>';
    return;
  }

  const now = new Date();
  const dates = weekDatesList();
  const rangesByDate = {};
  dates.forEach((d) => (rangesByDate[d] = rangesForDate(d)));

  for (let h = 0; h < 24; h++) {
    const row = document.createElement("div");
    row.className = "week-hour-row";

    const hourLabel = document.createElement("div");
    hourLabel.className = "whr-hourcol";
    hourLabel.textContent = String(h).padStart(2, "0") + ":00";
    row.appendChild(hourLabel);

    dates.forEach((dateStr) => {
      const s = slotState(rangesByDate[dateStr], dateStr, h, now);
      const hh = String(h).padStart(2, "0");
      const cell = document.createElement("div");
      if (s.state === "busy") {
        cell.className = "week-cell is-busy" + (s.overdue ? " is-overdue" : "");
        cell.textContent = s.overdue ? "เกินเวลา · " + (s.driver || "") : s.driver || "จองแล้ว";
        cell.title = `${busyLabel(s)} (${dateStr} ${hh}:00)`;
      } else if (s.state === "past") {
        cell.className = "week-cell is-past";
      } else {
        cell.className = "week-cell is-free";
        cell.title = `ว่าง — แตะเพื่อจอง ${dateStr} ${hh}:00`;
        cell.addEventListener("click", () => openBookingModal(ganttSelectedCar, dateStr, h));
      }
      row.appendChild(cell);
    });

    rowsWrap.appendChild(row);
  }

  if (scroller) {
    if (weekGridNeedsScroll) {
      // เปิดสัปดาห์/เลือกรถใหม่ -> เลื่อนไปช่วงที่ใช้จริง (สัปดาห์นี้ = ชั่วโมงปัจจุบัน, อื่นๆ = 07:00) ไม่ให้เห็นแต่เที่ยงคืนตอนเปิด
      const containsToday = dates.includes(formatDateYMD(now));
      const startHour = containsToday ? Math.max(0, now.getHours() - 1) : 7;
      const targetRow = rowsWrap.children[startHour];
      scroller.scrollTop = targetRow ? targetRow.getBoundingClientRect().top - rowsWrap.getBoundingClientRect().top : 0;
      weekGridNeedsScroll = false;
    } else {
      scroller.scrollTop = prevTop; // polling วาดใหม่ทุก 8 วิ กันตารางเด้งกลับบน
    }
  }
}

function renderDayStrip() {
  const wrap = document.getElementById("day-strip-m");
  if (!wrap) return;
  wrap.innerHTML = "";
  const dayAbbr = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
  const today = formatDateYMD(new Date());
  weekDatesList().forEach((dateStr, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "ds-day" + (dateStr === ganttSelectedDate ? " is-selected" : "") + (dateStr === today ? " is-today" : "");
    btn.innerHTML = `<span class="ds-name">${dayAbbr[i]}</span><span class="ds-num">${Number(dateStr.slice(8))}</span>`;
    btn.addEventListener("click", () => selectStripDay(dateStr));
    wrap.appendChild(btn);
  });
}

function renderDayList() {
  const wrap = document.getElementById("day-list-m");
  if (!wrap) return;

  if (!ganttSelectedCar) {
    wrap.innerHTML = '<p class="gantt-loading">เลือกรถก่อน...</p>';
    return;
  }

  const now = new Date();
  const dateStr = ganttSelectedDate;
  const ranges = rangesForDate(dateStr);
  const states = [];
  for (let h = 0; h < 24; h++) states.push(slotState(ranges, dateStr, h, now));

  // ยุบชั่วโมงที่ผ่านไปแล้ว (และไม่มีการจอง) ตั้งแต่ต้นวันเป็นแถวเดียว ไม่ให้ต้องเลื่อนผ่านแถวเทาเป็นสิบแถว
  let lead = 0;
  while (lead < 24 && states[lead].state === "past") lead++;

  let html = "";
  let start = 0;
  if (lead >= 3) {
    const endLabel = String(lead).padStart(2, "0") + ":00";
    html += `<div class="day-row is-past is-collapsed"><span class="dr-hour">00:00</span><div class="dr-cell">ผ่านไปแล้ว (ถึง ${endLabel})</div></div>`;
    start = lead;
  }
  for (let h = start; h < 24; h++) {
    const s = states[h];
    const hh = String(h).padStart(2, "0") + ":00";
    if (s.state === "busy") {
      html += `<div class="day-row is-busy${s.overdue ? " is-overdue" : ""}"><span class="dr-hour">${hh}</span><div class="dr-cell">${escHtml(busyLabel(s))}</div></div>`;
    } else if (s.state === "past") {
      html += `<div class="day-row is-past"><span class="dr-hour">${hh}</span><div class="dr-cell">ผ่านไปแล้ว</div></div>`;
    } else {
      html += `<div class="day-row is-free" data-h="${h}"><span class="dr-hour">${hh}</span><div class="dr-cell">+ ว่างสำหรับจอง</div></div>`;
    }
  }
  wrap.innerHTML = html;
  wrap.onclick = (e) => {
    const row = e.target.closest(".day-row.is-free");
    if (row) openBookingModal(ganttSelectedCar, ganttSelectedDate, Number(row.dataset.h));
  };
}

// ปุ่ม + ลอย: เปิดฟอร์มจอง เลือกรถ+วันที่ที่ดูอยู่ให้ ช่วงเวลาใส่ชั่วโมงว่างถัดไปให้ (กรอกข้อมูลที่เหลือตามปกติ)
function openQuickBooking() {
  if (!ganttSelectedCar) {
    showToast("warning", "กรุณาเลือกรถก่อน");
    return;
  }
  const now = new Date();
  const ranges = rangesForDate(ganttSelectedDate);
  const isToday = ganttSelectedDate === formatDateYMD(now);
  const from = isToday ? now.getHours() : 8;
  for (let h = from; h < 24; h++) {
    if (slotState(ranges, ganttSelectedDate, h, now).state === "free") {
      openBookingModal(ganttSelectedCar, ganttSelectedDate, h);
      return;
    }
  }
  showToast("warning", "วันนี้ไม่มีช่วงว่างแล้ว ลองเลือกวันอื่น");
}


// คำนวณช่วง [startHour, endHour] ของ booking หนึ่งแถว "เทียบกับวันที่กำลังดูอยู่" (viewedDate)
// รองรับจองข้ามคืน: booking ของเมื่อวานที่ยังไม่จบ จะโผล่มาเป็นช่วง [0, เวลาคืน] ของวันนี้แทน
function bookingRangeForViewedDay(b, viewedDate) {
  const outH = timeToHour(b.OutTime);
  const retH = timeToHour(b.PlannedReturnTime);
  if (outH === null || retH === null) return null;

  if (b.BookingDate === viewedDate) {
    const end = retH <= outH ? retH + 24 : retH;
    return [outH, end];
  }

  const prevDay = formatDateYMD(new Date(new Date(viewedDate + "T00:00:00").getTime() - 86400000));
  if (b.BookingDate === prevDay && retH <= outH) {
    return [0, retH]; // ข้ามคืนจากเมื่อวาน ยังไม่จบตอนเช้าวันนี้
  }
  return null;
}

function timeToHour(t) {
  if (!t) return null;
  const parts = String(t).split(":");
  if (parts.length < 2) return null;
  return Number(parts[0]) + Number(parts[1]) / 60;
}

function refreshGantt() {
  loadCarSelectList();
  if (ganttSelectedCar) loadCarBookingsForGantt(ganttSelectedCar, true);
}

function startGanttPolling() {
  stopGanttPolling();
  ganttPollTimer = setInterval(refreshGantt, POLL_INTERVAL_MS);
}
function stopGanttPolling() {
  if (ganttPollTimer) {
    clearInterval(ganttPollTimer);
    ganttPollTimer = null;
  }
}

// 🌟 เปิด modal จองด่วน — ใช้ field/logic เดิมทั้งหมด (lookupDriverName, updateCarDetails ฯลฯ)
// แค่ pre-fill ค่าจากช่องที่แตะในตาราง Gantt ให้ก่อน ผู้ใช้ปรับต่อในฟอร์มได้ตามปกติ
function openBookingModal(plate, dateStr, startHour) {
  const overlay = document.getElementById("booking-modal-overlay");
  if (!overlay) return;

  const dateInput = document.getElementById("use-date");
  if (dateInput) dateInput.value = dateStr;

  loadAvailableCars(dateStr); // เติม dropdown ทะเบียนรถของวันนั้นก่อน ค่อยเลือกคันที่แตะ

  const applySelection = () => {
    const plateSelectEl = document.getElementById("car-plate-select");
    if (plateSelectEl) {
      plateSelectEl.value = plate;
      updateCarDetails(plate);
    }
    const outSelect = document.getElementById("out-time-select");
    const retSelect = document.getElementById("return-time-select");
    if (outSelect) outSelect.value = String(startHour).padStart(2, "0") + ":00";
    if (retSelect) retSelect.value = String((startHour + 1) % 24).padStart(2, "0") + ":00";
    checkOvernightHint();
    updateAvailableTimeSlots();
  };
  setTimeout(applySelection, 150); // รอ dropdown เติมตัวเลือกจาก loadAvailableCars ก่อน

  overlay.classList.remove("hidden");

  // ผู้ขับเริ่มต้น = ตัวเอง (จองให้คนอื่นก็แก้รหัสพนักงานได้) — ลดช่องที่ต้องกรอก
  const empEl = document.getElementById("employee-id");
  if (empEl && !empEl.value.trim()) {
    fetch("get_current_user.php", { cache: "no-store" })
      .then((r) => r.json())
      .then((u) => {
        if (u && u.success && u.employee_id && !empEl.value.trim()) {
          empEl.value = u.employee_id;
          if (typeof lookupDriverName === "function") lookupDriverName();
        }
      })
      .catch(() => {});
  }
}

function closeBookingModal() {
  const overlay = document.getElementById("booking-modal-overlay");
  if (overlay) overlay.classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", () => {
  const now = new Date();
  miniCalYear = now.getFullYear();
  miniCalMonth = now.getMonth();
  ganttWeekStart = getMondayStr(now);
  renderMiniCalendar();
  renderWeekDayHeaders();
  renderDayStrip();
  loadCarSelectList();
  startGanttPolling();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopGanttPolling();
    } else if (!checkoutFields.classList.contains("hidden")) {
      refreshGantt();
      startGanttPolling();
    }
  });
});