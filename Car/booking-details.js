window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});
// 1. กาง/หุบรายละเอียดใบจอง
function toggleDropdown(id) {
  const dropdownBox = document.getElementById(id);
  const arrow = dropdownBox.previousElementSibling.querySelector(".arrow-icon");

  if (
    dropdownBox.style.display === "none" ||
    dropdownBox.style.display === ""
  ) {
    dropdownBox.style.display = "block";
    if (arrow) {
      arrow.innerText = "▲";
      arrow.style.color = "#ff4d4d";
    }
  } else {
    dropdownBox.style.display = "none";
    if (arrow) {
      arrow.innerText = "▼";
      arrow.style.color = "#fff";
    }
  }
}

// 2. สลับแท็บ ขาไป / ขากลับ
function filterHistory(type) {
  const buttons = document.querySelectorAll(".side-menu-container .tab-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active");
  } else {
    // เรียกจากโค้ด (ไม่ใช่คลิกจริง) เลยไม่มี event.currentTarget — ไฮไลต์ปุ่มตาม type แทน
    buttons.forEach((btn) => {
      if (
        (type === "outbound" && btn.textContent.includes("ยืมรถ")) ||
        (type === "inbound" && btn.textContent.includes("คืนรถ"))
      ) {
        btn.classList.add("active");
      }
    });
  }

  const outboundItems = document.querySelectorAll(".outbound-item");
  const inboundItems = document.querySelectorAll(".inbound-item");

  if (type === "outbound") {
    outboundItems.forEach((item) => (item.style.display = "block"));
    inboundItems.forEach((item) => (item.style.display = "none"));
  } else {
    outboundItems.forEach((item) => (item.style.display = "none"));
    inboundItems.forEach((item) => (item.style.display = "block"));
  }
}

// 3. โหลดประวัติจริงจาก DB
document.addEventListener("DOMContentLoaded", () => {
  fetchMyBookings();
});

function fetchMyBookings() {
  fetch("get_my_bookings.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        document.getElementById("booking-list-wrapper").innerHTML =
          `<p style="color:#ef4444; text-align:center; padding:20px;">${data.message || "ไม่สามารถโหลดข้อมูลได้"}</p>`;
        return;
      }
      renderBookingList(data.bookings);
    })
    .catch((err) => {
      console.error("Error loading bookings:", err);
      document.getElementById("booking-list-wrapper").innerHTML =
        `<p style="color:#ef4444; text-align:center; padding:20px;">เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</p>`;
    });
}

function renderBookingList(bookings) {
  const wrapper = document.getElementById("booking-list-wrapper");
  wrapper.innerHTML = "";

  if (!bookings || bookings.length === 0) {
    wrapper.innerHTML = `<p style="color:#94a3b8; text-align:center; padding:20px;">ยังไม่มีประวัติการจอง</p>`;
    return;
  }

  bookings.forEach((bk) => {
    const isReturned = bk.BookingStatus === "ขากลับ";
    const isCancelled = bk.BookingStatus && bk.BookingStatus.includes("ยกเลิก");
    const rowClass = isReturned ? "inbound-item" : "outbound-item";
    const dropdownId = `bk-${bk.BookingID}`;

    // ป้ายสถานะ ให้ตรงธีมเดียวกับหน้าอื่น
    let statusClass, statusText;
    if (isCancelled) {
      statusClass = "status-cancelled";
      statusText = "ยกเลิก";
    } else if (isReturned) {
      statusClass = "status-returned";
      statusText = "คืนแล้ว";
    } else if (bk.CheckInTime) {
      // เช็คอินแล้วจริง ถึงจะเป็น "กำลังใช้งาน" ก่อนหน้านี้ปักไว้ตายตัวผิด
      statusClass = "status-inuse";
      statusText = "กำลังใช้งาน";
    } else {
      statusClass = "status-booked";
      statusText = "ติดจอง";
    }

    const row = document.createElement("div");
    row.className = `booking-row-container ${rowClass}`;
    row.dataset.searchText =
      `${bk.CarPlate || ""} ${bk.DriverName || ""} ${bk.OutDate || ""}`.toLowerCase();

    // ปุ่ม action แสดงเฉพาะเมื่อยังไม่คืนรถและยังไม่ถูกยกเลิก
    const actionButtons =
      isReturned || isCancelled
        ? ""
        : `<div style="display:flex; gap:10px; margin-top:12px;">
             ${
               bk.CheckInTime
                 ? ""
                 : `<button onclick="checkInBooking(${bk.BookingID})" style="background:#10b981; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">
               ✅ เช็คอิน
             </button>`
             }
             <button onclick="cancelBooking(${bk.BookingID})" style="background:#ef4444; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">
               ❌ ยกเลิกการจองนี้
             </button>
           </div>`;

    row.innerHTML = `
      <div class="booking-header-row" onclick="toggleDropdown('${dropdownId}')">
        <span class="bk-id">#${bk.BookingNumber}</span>
        <span class="bk-user">${bk.DriverName}</span>
        <span class="bk-car" style="${isCancelled ? "color:#6b7280; text-decoration:line-through;" : ""}">${bk.CarPlate}</span>
        <span class="bk-date">${bk.OutDate || "-"}</span>
        <span class="status-badge ${statusClass}">${statusText}</span>
        <span class="arrow-icon">▼</span>
      </div>
      <div id="${dropdownId}" class="booking-detail-dropdown" style="display:none">
        <div class="card-dropdown-content">
          <h5 class="text-danger" style="font-weight:bold; margin-bottom:15px;">รายละเอียดการจอง #${bk.BookingNumber}</h5>
          <hr style="border-color:#333">
          <div class="row">
            <div class="col-md-6">
              <p><strong>ชื่อผู้ขับ:</strong> ${bk.DriverName}</p>
              <p><strong>หน่วยงาน/แผนก:</strong> ${bk.Department}</p>
              <p><strong>สถานที่ไป:</strong> ${bk.Destination || "-"}</p>
              <p><strong>รายละเอียดงาน:</strong> ${bk.JobDetail || "-"}</p>
            </div>
            <div class="col-md-6">
              <p><strong>ทะเบียนรถ:</strong> ${bk.CarPlate}</p>
              <p><strong>เลขไมล์เริ่มต้น:</strong> ${bk.StartMileage || "-"} กม.</p>
              <p><strong>ผู้ร่วมเดินทาง:</strong> ${bk.Passengers || "-"}</p>
              <p><strong>ปัญหาก่อนออก:</strong> ${bk.OutRemark || "-"}</p>
            </div>
          </div>
          ${actionButtons}
        </div>
      </div>`;

    wrapper.appendChild(row);
  });
}

// ค้นหาแบบเรียลไทม์ในรายการที่กำลังแสดงอยู่ (ทะเบียน / ชื่อผู้ขับ / วันที่)
function filterBookingSearch(keyword) {
  const q = (keyword || "").trim().toLowerCase();
  document.querySelectorAll(".booking-row-container").forEach((row) => {
    const match = !q || row.dataset.searchText.includes(q);
    row.style.display = match ? "" : "none";
  });
}

function cancelBooking(bookingId) {
  if (!confirm("ยืนยันยกเลิกการจองนี้?")) return;

  fetch("cancel_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        alert("ยกเลิกการจองสำเร็จ");
        fetchMyBookings();
      } else {
        alert("ยกเลิกไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch(() => alert("ติดต่อ Server ไม่ได้"));
}

function checkInBooking(bookingId) {
  fetch("checkin_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  })
    .then((res) => res.json())
    .then((result) => {
      alert(
        result.success
          ? "เช็คอินสำเร็จ! เริ่มใช้รถได้เลย"
          : "เช็คอินไม่สำเร็จ: " + (result.message || ""),
      );
      if (result.success) fetchMyBookings();
    })
    .catch(() => alert("ติดต่อ Server ไม่ได้"));
}
