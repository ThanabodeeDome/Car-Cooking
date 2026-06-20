/* =========================================
   1. ฟังก์ชันดึงประวัติการจอง (ตารางด้านล่าง)
   ========================================= */
/* =========================================
   1. ฟังก์ชันดึงประวัติการจอง (ตารางด้านล่าง)
   ========================================= */
function updateHistoryTable() {
  const tableBody = document.getElementById("history-table-body");

  // ถ้าหน้านี้ไม่มีตารางประวัติ (id="history-table-body") ให้หยุดทำงานทันที
  if (!tableBody) return;

  fetch("get_history.php")
    .then((res) => res.json())
    .then((data) => {
      const bookings = Array.isArray(data) ? data : [];
      if (bookings.length === 0) {
        tableBody.innerHTML =
          '<tr><td colspan="9" style="text-align:center;">ไม่พบประวัติการจอง</td></tr>';
        return;
      }

      tableBody.innerHTML = bookings
        .map((item) => {
          const isOutbound = item.booking_status === "Checked-Out";

          return `
      <tr>
          <td>${item.out_date || "-"}</td>
          <td>${item.out_time || "-"}</td>
          <td>
              <span class="status-badge ${isOutbound ? "status-out" : "status-in"}">
                  ${isOutbound ? "🔴 ขาไป" : "🟢 คืนแล้ว"}
              </span>
          </td>
          <td>${item.car_type || "-"}</td>
          <td>${item.car_brand || "-"}</td>
          <td>${item.car_plate || "-"}</td>
          <td>${item.driver_name || "-"}</td>
          <td>${item.passengers || "-"}</td>
          <td>${item.employeeId || "-"}</td>
      </tr>`;
        })
        .join("");
    })
    .catch((error) => {
      console.error("Error History Table:", error);
      tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; color:red;">ไม่สามารถดึงข้อมูลประวัติได้</td></tr>`;
    });
}

/* =========================================
   2. ฟังก์ชันดึงข้อมูลรถยนต์ (Card Grid)
   ========================================= */
function loadCarData(statusFilter = "all", btn = null) {
  const grid = document.getElementById("car-list-grid");

  // ถ้าหน้านี้ไม่มีที่แสดงรถ (id="car-list-grid") ให้หยุดทำงาน
  if (!grid) return;

  grid.innerHTML = `<p style="color: #666; padding: 20px;">กำลังโหลดข้อมูลรถ...</p>`;

  // จัดการปุ่ม Filter (Slice effect)
  if (btn) {
    document
      .querySelectorAll(".slice")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  }

  fetch("get_all_cars.php")
    .then((response) => response.json())
    .then((data) => {
      let filtered = data;
      if (statusFilter !== "all") {
        filtered = data.filter((car) => car.status === statusFilter);
      }

      if (filtered.length === 0) {
        grid.innerHTML = `<p style="color: #888; padding: 20px;">ไม่พบข้อมูลรถยนต์</p>`;
        return;
      }

      grid.innerHTML = filtered
        .map(
          (car) => `
                <div class="car-card">
                    <img src="${car.image}" class="card-img" onerror="this.src='assets/img-car/default.png'">
                    <div class="card-content">
                        <h3 class="car-plate">${car.plate}</h3>
                        <p class="car-brand">${car.brand}</p>
                        <div class="car-info">
                            <span class="status-badge ${car.status === "available" ? "status-available" : "status-busy"}">
                                ${car.status === "available" ? "● ว่าง" : "● ไม่ว่าง"}
                            </span>
                            <span style="color: #888;">ไมล์: ${Number(car.current_mileage).toLocaleString()} กม.</span>
                        </div>
                    </div>
                </div>`,
        )
        .join("");
    })
    .catch((error) => {
      console.error("Error Cars:", error);
      grid.innerHTML = `<p style="color: red; padding: 20px;">ไม่สามารถดึงข้อมูลได้</p>`;
    });
}

/* =========================================
   3. ส่วนควบคุมการทำงาน (Event Listeners)
   ========================================= */
document.addEventListener("DOMContentLoaded", () => {
  console.log("Homepage JS Loaded...");

  // ดึงข้อมูลรถ (ถ้ามี grid)
  loadCarData("all");

  // ดึงข้อมูลประวัติ (ถ้ามีตาราง)
  updateHistoryTable();

  // ตั้งเวลาอัปเดตประวัติทุก 3 วินาที
  setInterval(updateHistoryTable, 3000);
});

/* =========================================
   4. ฟังก์ชันคำนวณและอัปเดตตัวเลขสถิติ (Stats Counter)
   ========================================= */
function updateStatsCounters(bookings) {
  const totalElement = document.getElementById("stat-total"); // ช่องรวมการจอง
  const activeElement = document.getElementById("stat-active"); // ช่องกำลังใช้งาน
  const completeElement = document.getElementById("stat-complete"); // ช่องเสร็จสิ้น

  if (!totalElement || !activeElement || !completeElement) return;

  const total = bookings.length;
  const active = bookings.filter(
    (item) => item.booking_status === "Checked-Out",
  ).length;
  const complete = bookings.filter(
    (item) =>
      item.booking_status === "Returned" || item.booking_status === "returned",
  ).length;

  totalElement.innerText = total;
  activeElement.innerText = active;
  completeElement.innerText = complete;
}
