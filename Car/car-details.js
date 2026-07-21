document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("car-list-display");
  if (!container) return;

  loadCars();
  setInterval(loadCars, 15000); // 🌟 รีเฟรชสถานะทุก 15 วิ แบบเรียลไทม์

  function brandIcon(brand) {
    const b = (brand || "").toLowerCase();
    if (b.includes("toyota")) return '<i class="fa-solid fa-car-side"></i>';
    if (b.includes("chevrolet"))
      return '<i class="fa-solid fa-truck-pickup"></i>';
    if (b.includes("mazda")) return '<i class="fa-solid fa-car"></i>';
    return '<i class="fa-solid fa-car"></i>';
  }

  function loadCars() {
    fetch("get_cars.php")
      .then((response) => response.json())
      .then((data) => {
        container.innerHTML = "";

        if (!data || data.length === 0) {
          container.innerHTML = `<p style="color:#666; text-align:center;">ไม่พบข้อมูลรถยนต์</p>`;
          return;
        }

        data.forEach((car) => {
          const imgPath =
            "assets/img-car/" + (car.Carimage || "car-placeholder.png");
          const status = car.RealStatus;
          const statusClass =
            status === "ว่าง"
              ? "free"
              : status === "กำลังใช้งาน"
                ? "busy"
                : status === "จองแล้ว"
                  ? "reserved"
                  : "maintenance";

          const rowHTML = `
            <div class="car-row-card">
              <div class="car-row-img-wrap">
                <img src="${imgPath}" alt="${car.Model}" onerror="this.onerror=null; this.src='assets/img-car/car-placeholder.png';">
                <span class="car-status-badge status-${statusClass}">${status}</span>
              </div>
              <div class="car-row-body">
                <div class="car-row-title">
                  <span class="car-brand-icon">${brandIcon(car.Brand)}</span>
                  <h3>${car.Brand || ""} ${car.Model || ""}</h3>
                </div>
                <div class="car-detail-row">
                  <div class="car-detail-item">
                    <span class="detail-label"><i class="fa-solid fa-id-card"></i> ทะเบียน</span>
                    <span class="detail-value">${car.Plate || "-"}</span>
                  </div>
                  <div class="car-detail-item">
                    <span class="detail-label"><i class="fa-solid fa-palette"></i> สี</span>
                    <span class="detail-value">${car.Color || "-"}</span>
                  </div>
                  <div class="car-detail-item">
                    <span class="detail-label"><i class="fa-solid fa-gauge-high"></i> เลขไมล์</span>
                    <span class="detail-value">${car.Mileage ? Number(car.Mileage).toLocaleString() + " กม." : "-"}</span>
                  </div>
                  <div class="car-detail-item">
                    <span class="detail-label"><i class="fa-solid fa-circle-info"></i> สถานะ</span>
                    <span class="detail-value">${status}</span>
                  </div>
                </div>
              </div>
              <div class="car-row-actions">
                <a href="booking.html" class="car-action-btn" title="จองรถคันนี้"><i class="fa-solid fa-calendar-plus"></i></a>
                <a href="booking-details.html" class="car-action-btn" title="ดูประวัติการจอง"><i class="fa-solid fa-clock-rotate-left"></i></a>
              </div>
            </div>`;
          container.innerHTML += rowHTML;
        });
      })
      .catch((error) => {
        console.error("Error loading cars:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">ไม่สามารถดึงข้อมูลได้</p>`;
      });
  }
});
