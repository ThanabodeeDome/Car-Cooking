function fetchDashboardStats() {
  fetch("get_dashboard_stats.php")
    .then((response) => response.json())
    .then((data) => {
      console.log("Dashboard Data:", data);
      if (data.error) return;

      if (document.getElementById("available-cars")) {
        document.getElementById("available-cars").innerText =
          (data.available || 0) + " คัน";
      }
      // busy = ไม่ว่าง (ถูกจอง)
      if (document.getElementById("busy-cars")) {
        document.getElementById("busy-cars").innerText =
          (data.busy || 0) + " คัน";
      }
      // maintenance = ซ่อมบำรุง/เช็คระยะ
      if (document.getElementById("maintenance-cars")) {
        document.getElementById("maintenance-cars").innerText =
          (data.maintenance || 0) + " คัน";
      }
      if (document.getElementById("today-bookings")) {
        document.getElementById("today-bookings").innerText =
          (data.today || 0) + " รายการ";
      }
      if (document.getElementById("total-cars")) {
        const total =
          (data.available || 0) + (data.busy || 0) + (data.maintenance || 0);
        document.getElementById("total-cars").innerText = total + " คัน";
      }

      renderDashboardCarCards(data.cars);
      renderStatCarLists(data.cars); // 🌟 ใหม่: แยกรถลงแต่ละการ์ด
    })
    .catch((err) => console.error("Error Dashboard:", err));
}

// 🌟 ฟังก์ชันใหม่: โชว์รายชื่อรถ (ทะเบียน/ยี่ห้อ) แยกตามสถานะ ในแต่ละการ์ด
function renderStatCarLists(cars) {
  const carList = Array.isArray(cars) ? cars : [];

  const groups = {
    "available-cars-list": [],
    "busy-cars-list": [],
    "maintenance-cars-list": [],
  };

  carList.forEach((car) => {
    if (car.CarStatus === "ว่าง") {
      groups["available-cars-list"].push(car);
    } else if (car.CarStatus === "ไม่ว่าง") {
      groups["busy-cars-list"].push(car);
    } else if (car.CarStatus === "เช็คระยะ" || car.CarStatus === "ซ่อมบำรุง") {
      groups["maintenance-cars-list"].push(car);
    }
  });

  Object.keys(groups).forEach((containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = groups[containerId];
    if (list.length === 0) {
      container.innerHTML = `<span style="color:#94a3b8; font-size:13px;">ไม่มีรถในกลุ่มนี้</span>`;
      return;
    }

    container.innerHTML = list
      .map(
        (car) => `
          <div class="mini-car-chip">
            <span class="mini-car-icon">🚗</span>
            <div class="mini-car-info">
              <span class="mini-car-plate">${car.Plate || "-"}</span>
              <span class="mini-car-model">${car.Brand || ""} ${car.Model || ""}</span>
            </div>
          </div>`,
      )
      .join("");
  });
}

function renderDashboardCarCards(cars) {
  // ...โค้ดเดิม ไม่ต้องแก้...
}

window.fetchDashboardStats = fetchDashboardStats;
