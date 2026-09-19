/**
 * Booking Details Controller
 * Handles loading booking records, real-time filtering, search, and cancellations.
 */

window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

let allBookings = [];
let currentFilterTab = "all";
let currentSearchKeyword = "";

// Unified notification helper
function notify(type, message) {
  if (typeof showToast === "function") {
    showToast(type, message);
  } else {
    alert(message);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const highlightPlate = params.get("plate");
  fetchMyBookings(highlightPlate);
});

/**
 * Fetch booking records from server
 */
function fetchMyBookings(highlightPlate) {
  const wrapper = document.getElementById("booking-list-wrapper");

  fetch("get_my_bookings.php")
    .then((res) => res.json())
    .then((data) => {
      if (!data.success) {
        wrapper.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h3>ไม่สามารถโหลดข้อมูลได้</h3>
            <p>${data.message || "เกิดข้อผิดพลาดในการโหลดรายการจอง"}</p>
            <a href="booking.html" class="btn-new-booking">จองรถใหม่</a>
          </div>`;
        return;
      }

      allBookings = data.bookings || [];
      updateSummaryMetrics(allBookings);
      applyFilterAndRender(highlightPlate);
    })
    .catch((err) => {
      console.error("Error loading bookings:", err);
      wrapper.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-plug-circle-xmark"></i></div>
          <h3>เชื่อมต่อเซิร์ฟเวอร์ไม่ได้</h3>
          <p>กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตหรือลองใหม่อีกครั้ง</p>
        </div>`;
    });
}

/**
 * Update the 4 metric cards and tab badges
 */
function updateSummaryMetrics(bookings) {
  let countActive = 0;
  let countReturned = 0;
  let countCancelled = 0;

  bookings.forEach((bk) => {
    const isCancelled = bk.BookingStatus && bk.BookingStatus.includes("ยกเลิก");
    const isReturned = bk.BookingStatus === "คืนแล้ว";

    if (isCancelled) {
      countCancelled++;
    } else if (isReturned) {
      countReturned++;
    } else {
      // Pending check-in or currently in use
      countActive++;
    }
  });

  const total = bookings.length;

  // Header metric counts
  const setElText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val.toLocaleString("th-TH");
  };

  setElText("count-all", total);
  setElText("count-active", countActive);
  setElText("count-returned", countReturned);
  setElText("count-cancelled", countCancelled);

  // Tab badge counts
  setElText("badge-all", total);
  setElText("badge-active", countActive);
  setElText("badge-returned", countReturned);
  setElText("badge-cancelled", countCancelled);
}

/**
 * Filter bookings and render cards
 */
function applyFilterAndRender(highlightPlate) {
  const wrapper = document.getElementById("booking-list-wrapper");
  wrapper.innerHTML = "";

  const q = currentSearchKeyword.trim().toLowerCase();

  const filtered = allBookings.filter((bk) => {
    const isCancelled = bk.BookingStatus && bk.BookingStatus.includes("ยกเลิก");
    const isReturned = bk.BookingStatus === "คืนแล้ว";
    const isActive = !isCancelled && !isReturned;

    // Filter by tab
    if (currentFilterTab === "active" && !isActive) return false;
    if (currentFilterTab === "returned" && !isReturned) return false;
    if (currentFilterTab === "cancelled" && !isCancelled) return false;

    // Filter by search query
    if (q) {
      const searchTarget = `
        ${bk.BookingNumber || ""}
        ${bk.CarPlate || ""}
        ${bk.DriverName || ""}
        ${bk.Department || ""}
        ${bk.Destination || ""}
        ${bk.OutDate || ""}
      `.toLowerCase();
      if (!searchTarget.includes(q)) return false;
    }

    return true;
  });

  // Empty state handling
  if (filtered.length === 0) {
    if (allBookings.length === 0) {
      wrapper.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-car-side"></i></div>
          <h3>ยังไม่มีประวัติการจองรถยนต์</h3>
          <p>คุณยังไม่เคยทำการจองรถในระบบ เริ่มต้นจองรถสำหรับภารกิจของคุณได้ทันที</p>
          <a href="booking.html" class="btn-new-booking">
            <i class="fa-solid fa-plus"></i> จองรถตอนนี้
          </a>
        </div>`;
    } else {
      wrapper.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon"><i class="fa-solid fa-filter-circle-xmark"></i></div>
          <h3>ไม่พบรายการจองที่ตรงกับเงื่อนไข</h3>
          <p>ลองปรับคำค้นหา หรือเลือกแท็บสถานะอื่นเพื่อดูรายการจองของคุณ</p>
          <button type="button" class="tab-pill" onclick="resetFilters()">
            <i class="fa-solid fa-arrow-rotate-left"></i> ล้างตัวกรองทั้งหมด
          </button>
        </div>`;
    }
    return;
  }

  // Render cards
  filtered.forEach((bk) => {
    const isCancelled = bk.BookingStatus && bk.BookingStatus.includes("ยกเลิก");
    const isReturned = bk.BookingStatus === "คืนแล้ว";
    const dropdownId = `bk-${bk.BookingID}`;

    let statusClass, statusText, statusIcon;
    if (isCancelled) {
      statusClass = "status-cancelled";
      statusText = "ยกเลิก";
      statusIcon = "fa-solid fa-ban";
    } else if (isReturned) {
      statusClass = "status-returned";
      statusText = "คืนแล้ว";
      statusIcon = "fa-solid fa-circle-check";
    } else if (bk.CheckInTime) {
      statusClass = "status-inuse";
      statusText = "กำลังใช้งาน";
      statusIcon = "fa-solid fa-car-side";
    } else {
      statusClass = "status-booked";
      statusText = "รอเช็คอิน";
      statusIcon = "fa-solid fa-hourglass-half";
    }

    const row = document.createElement("article");
    row.className = "booking-row-container";
    row.id = `row-${dropdownId}`;
    row.dataset.plate = bk.CarPlate || "";

    // Action buttons in detail drawer
    let actionButtons = "";
    if (!isReturned && !isCancelled) {
      actionButtons = `
        <div class="detail-actions-row">
          <button type="button" class="btn-cancel-booking" onclick="cancelBooking(${bk.BookingID})">
            <i class="fa-solid fa-xmark"></i> ยกเลิกการจองนี้
          </button>
          <a href="scan.php?plate=${encodeURIComponent(bk.CarPlate || "")}" class="btn-action-checkin">
            <i class="fa-solid fa-qrcode"></i> ${bk.BookingStatus === "ขาไป" ? "ไปหน้าคืนรถ" : "ไปหน้าสแกนเช็คอิน"}
          </a>
        </div>`;
    }

    // Mileage row calculation
    const startM = Number(bk.StartMileage);
    const endM = Number(bk.EndMileage);
    let mileageBox = "";
    if (startM || endM) {
      const distance = endM && startM && endM > startM ? endM - startM : null;
      mileageBox = `
        <div class="mileage-banner">
          <div class="mileage-col">
            <span class="mileage-label">เลขไมล์เริ่มต้น</span>
            <span class="mileage-val">${startM ? startM.toLocaleString("th-TH") : "-"} กม.</span>
          </div>
          ${
            endM
              ? `
          <div class="mileage-col">
            <span class="mileage-label">เลขไมล์ตอนคืน</span>
            <span class="mileage-val">${endM.toLocaleString("th-TH")} กม.</span>
          </div>`
              : ""
          }
          ${
            distance
              ? `
          <div class="mileage-diff">
            <i class="fa-solid fa-route"></i>
            <span>รวม ${distance.toLocaleString("th-TH")} กม.</span>
          </div>`
              : ""
          }
        </div>`;
    }

    // Return remark / feedback block
    let feedbackBox = "";
    if (bk.ReturnRemark) {
      feedbackBox = `
        <div class="comment-bubble">
          <i class="fa-solid fa-comment-dots"></i>
          <div>
            <strong>ความเห็น / ข้อเสนอแนะหลังใช้งาน</strong>
            <p>${escapeHtml(bk.ReturnRemark)}</p>
          </div>
        </div>`;
    }

    // Out remark block
    let outRemarkBox = "";
    if (bk.OutRemark) {
      outRemarkBox = `
        <div class="comment-bubble" style="border-left-color: #f59e0b;">
          <i class="fa-solid fa-note-sticky" style="color: #f59e0b;"></i>
          <div>
            <strong>หมายเหตุการขอใช้รถ</strong>
            <p>${escapeHtml(bk.OutRemark)}</p>
          </div>
        </div>`;
    }

    row.innerHTML = `
      <div class="booking-header-row" onclick="toggleDropdown('${dropdownId}', this)">
        <div class="bk-id-chip">
          <i class="fa-solid fa-ticket"></i>
          <span>#${escapeHtml(bk.BookingNumber || bk.BookingID)}</span>
        </div>

        <div>
          <span class="bk-plate-badge ${isCancelled ? "plate-cancelled" : ""}">
            <i class="fa-solid fa-car"></i>
            <span>${escapeHtml(bk.CarPlate || "-")}</span>
          </span>
        </div>

        <div class="bk-summary-col">
          <div class="bk-summary-top">
            <span class="bk-driver-name">${escapeHtml(bk.DriverName || "ไม่ระบุ")}</span>
            <span class="bk-trip-date">
              <i class="fa-regular fa-calendar"></i>
              <span>${escapeHtml(bk.OutDate || "-")} ${bk.OutTime ? escapeHtml(bk.OutTime) : ""}</span>
            </span>
          </div>
          <div class="bk-destination-preview" title="${escapeHtml(bk.Destination || "-")}">
            <i class="fa-solid fa-location-dot"></i>
            <span>${escapeHtml(bk.Destination || "ไม่ระบุสถานที่")}</span>
          </div>
        </div>

        <div class="status-badge ${statusClass}">
          <i class="${statusIcon}"></i>
          <span>${statusText}</span>
        </div>

        <div class="arrow-icon-wrap">
          <i class="fa-solid fa-chevron-down"></i>
        </div>
      </div>

      <div id="${dropdownId}" class="booking-detail-dropdown" style="display: none;">
        <div class="detail-drawer-header">
          <h4 class="detail-drawer-title">
            <i class="fa-solid fa-file-invoice"></i>
            <span>ข้อมูลการเดินทางฉบับเต็ม #${escapeHtml(bk.BookingNumber || bk.BookingID)}</span>
          </h4>
        </div>

        <div class="detail-grid">
          <!-- Left Panel: Driver & Job -->
          <div class="detail-card-panel">
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-user"></i> ชื่อผู้ขับขี่</span>
              <span class="detail-item-value">${escapeHtml(bk.DriverName || "-")}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-building"></i> แผนก / สังกัด</span>
              <span class="detail-item-value">${escapeHtml(bk.Department || "-")}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-location-dot"></i> สถานที่ปลายทาง</span>
              <span class="detail-item-value highlight-red">${escapeHtml(bk.Destination || "-")}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-briefcase"></i> วัตถุประสงค์งาน</span>
              <span class="detail-item-value">${escapeHtml(bk.JobDetail || "ไม่ได้ระบุ")}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-users"></i> ผู้ร่วมเดินทาง</span>
              <span class="detail-item-value">${escapeHtml(bk.Passengers || "ไม่มี")}</span>
            </div>
          </div>

          <!-- Right Panel: Car & Time -->
          <div class="detail-card-panel">
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-car"></i> ทะเบียนรถยนต์</span>
              <span class="detail-item-value">${escapeHtml(bk.CarPlate || "-")}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-calendar-day"></i> วัน-เวลาเดินทางไป</span>
              <span class="detail-item-value">${escapeHtml(bk.OutDate || "-")} ${bk.OutTime ? escapeHtml(bk.OutTime) : ""}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-calendar-check"></i> วัน-เวลาคืนรถ</span>
              <span class="detail-item-value">${escapeHtml(bk.ReturnDate || "-")} ${bk.ReturnTime ? escapeHtml(bk.ReturnTime) : ""}</span>
            </div>
            <div class="detail-item">
              <span class="detail-item-label"><i class="fa-solid fa-gauge-high"></i> บันทึกเลขไมล์</span>
              ${mileageBox || '<span class="detail-item-value">-</span>'}
            </div>
          </div>
        </div>

        ${outRemarkBox}
        ${feedbackBox}
        ${actionButtons}
      </div>
    `;

    wrapper.appendChild(row);
  });

  // Handle URL highlight (e.g. ?plate=...)
  if (highlightPlate) {
    const target = wrapper.querySelector(`.booking-row-container[data-plate="${highlightPlate}"]`);
    if (target) {
      const dropdown = target.querySelector(".booking-detail-dropdown");
      if (dropdown) {
        dropdown.style.display = "block";
        target.classList.add("open");
      }

      target.style.transition = "background-color 0.6s ease, box-shadow 0.6s ease";
      target.style.backgroundColor = "rgba(74, 222, 128, 0.12)";
      target.style.boxShadow = "0 0 0 2px #4ade80, 0 10px 30px rgba(0,0,0,0.5)";

      setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
      setTimeout(() => {
        target.style.backgroundColor = "";
        target.style.boxShadow = "";
      }, 4000);
    }
  }
}

/**
 * Accordion expansion toggle
 */
function toggleDropdown(id, headerEl) {
  const dropdownBox = document.getElementById(id);
  if (!dropdownBox) return;

  const container = headerEl ? headerEl.closest(".booking-row-container") : dropdownBox.closest(".booking-row-container");

  if (dropdownBox.style.display === "none" || dropdownBox.style.display === "") {
    dropdownBox.style.display = "block";
    if (container) container.classList.add("open");
  } else {
    dropdownBox.style.display = "none";
    if (container) container.classList.remove("open");
  }
}

/**
 * Switch Filter Tab
 */
function filterByTab(tabKey) {
  currentFilterTab = tabKey;

  document.querySelectorAll(".tab-pill").forEach((btn) => {
    if (btn.dataset.filter === tabKey) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  applyFilterAndRender();
}

/**
 * Real-time Search Filter
 */
function filterBookingSearch(keyword) {
  currentSearchKeyword = keyword || "";
  const clearBtn = document.getElementById("clear-search-btn");
  if (clearBtn) {
    clearBtn.style.display = currentSearchKeyword.trim() ? "flex" : "none";
  }
  applyFilterAndRender();
}

function clearSearch() {
  const input = document.getElementById("booking-search");
  if (input) input.value = "";
  filterBookingSearch("");
}

function resetFilters() {
  clearSearch();
  filterByTab("all");
}

/**
 * Cancel a booking record
 */
async function cancelBooking(bookingId) {
  const ok = await AppDialog.confirm({
    title: "ยกเลิกการจองนี้?",
    message: "เมื่อยกเลิกแล้ว คิวรถช่วงนี้จะถูกปล่อยให้คนอื่นจองได้ทันที",
    confirmText: "ยกเลิกการจอง",
    cancelText: "ไม่ยกเลิก",
    danger: true,
  });
  if (!ok) return;

  fetch("cancel_booking.php", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking_id: bookingId }),
  })
    .then((res) => res.json())
    .then((result) => {
      if (result.success) {
        notify("success", "ยกเลิกการจองเรียบร้อยแล้ว");
        fetchMyBookings();
      } else {
        notify("error", "ยกเลิกไม่สำเร็จ: " + (result.message || ""));
      }
    })
    .catch((err) => {
      console.error("Cancel booking error:", err);
      notify("error", "ติดต่อ Server ไม่ได้ กรุณาลองใหม่อีกครั้ง");
    });
}

/**
 * HTML Escaper
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
