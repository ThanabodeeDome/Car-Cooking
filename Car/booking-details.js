// 1. ฟังก์ชันคลิกแถวประวัติแล้วให้กาง/หุบรายละเอียดใบจองรถลงมา
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

// 2. ฟังก์ชันสลับคัดกรองแท็บ ขาไป (Outbound) / ขากลับ (Inbound)
function filterHistory(type) {
  // สลับสถานะเรืองแสงสีแดง (.active) ให้เฉพาะปุ่มที่เรากดปัจจุบัน
  const buttons = document.querySelectorAll(".side-menu-container .tab-btn");
  buttons.forEach((btn) => btn.classList.remove("active"));

  if (event && event.currentTarget) {
    event.currentTarget.classList.add("active");
  }

  // ดึงรายการประวัติทั้งหมดมาสลับการมองเห็น
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
