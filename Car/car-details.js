document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("car-list-display");
  if (!container) return;

  fetch("get_cars.php")
    .then((response) => response.json())
    .then((data) => {
      container.innerHTML = "";

      if (!data || data.length === 0) {
        container.innerHTML = `<p style="color:#666; text-align:center; grid-column:1/-1;">ไม่พบข้อมูลรถยนต์</p>`;
        return;
      }

      data.forEach((car) => {
        const imgPath =
          "assets/img-car/" + (car.Carimage || "car-placeholder.png");
        const statusClass =
          car.CarStatus === "ว่าง"
            ? "free"
            : car.CarStatus === "ไม่ว่าง"
              ? "busy"
              : "maintenance";

        const carHTML = `
          <div class="car-card">
            <div class="car-card-img-wrap">
              <img src="${imgPath}" alt="${car.Model}" onerror="this.onerror=null; this.src='assets/img-car/car-placeholder.png';">
              <span class="car-status-badge status-${statusClass}">${car.CarStatus || "-"}</span>
            </div>
            <div class="car-card-body">
              <h3>${car.Brand || ""} ${car.Model || ""}</h3>
              <div class="car-detail-grid">
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
              </div>
            </div>
          </div>`;
        container.innerHTML += carHTML;
      });
    })
    .catch((error) => {
      console.error("Error loading cars:", error);
      container.innerHTML = `<p style="color:red; text-align:center; grid-column:1/-1;">ไม่สามารถดึงข้อมูลได้</p>`;
    });
});
