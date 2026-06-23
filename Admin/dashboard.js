/**
 * 📊 ระบบจัดการข้อมูล Dashboard (แยกไฟล์)
 */
function fetchDashboardStats() {
  fetch("get_dashboard_stats.php")
    .then((response) => response.json())
    .then((data) => {
      console.log("Dashboard Data:", data);
      if (data.error) return;

      // อัปเดตตัวเลขสถิติบนหน้าเว็บ
      if (document.getElementById("available-cars")) {
        document.getElementById("available-cars").innerText =
          (data.available || 0) + " คัน";
      }
      if (document.getElementById("busy-cars")) {
        document.getElementById("busy-cars").innerText =
          (data.busy || 0) + " คัน";
      }
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
    })
    .catch((err) => console.error("Error Dashboard:", err));
}

function renderDashboardCarCards(cars) {
  const cardContainer = document.querySelector(".cars-card-grid");
  if (!cardContainer) return;
  cardContainer.innerHTML = "";

  const carList = Array.isArray(cars) ? cars : [];
  if (carList.length === 0) {
    cardContainer.innerHTML = `<div style='color:#64748b; text-align:center; width:100%; padding:20px;'>❌ ยังไม่มีข้อมูลรถยนต์ในระบบในขณะนี้</div>`;
    return;
  }

  carList.forEach((car) => {
    const statusClass = car.CarStatus === "ว่าง" ? "pill-empty" : "pill-busy";
    const imgPath = car.CarImage
      ? `../Car/assets/img-car/${car.CarImage.trim()}`
      : `../Car/assets/img-car/car-placeholder.png`;
    const carJsonString = JSON.stringify(car).replace(/"/g, "&quot;");

    cardContainer.innerHTML += `
      <div class="car-item-card" style="background:#1e293b; border-radius:8px; padding:15px; margin-bottom:15px;">
        <img src="${imgPath}" style="width:100%; height:150px; object-fit:cover; border-radius:6px;" onerror="this.src='../Car/assets/img-car/car-placeholder.png';">
        <h3 style="color:#fff; margin-top:10px; font-size:18px;">${car.Brand || ""} ${car.Model || ""}</h3>
        <p style="color:#94a3b8; font-size:14px;">ทะเบียน: ${car.Plate || "-"}</p>
        <p style="color:#94a3b8; font-size:14px;">สถานะ: ${car.CarStatus || "ว่าง"}</p>
        <div style="margin-top:10px; display:flex; gap:10px;">
          <button onclick="fillWorkspaceForm(${carJsonString})" style="background:#3b82f6; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; flex:1;">แก้ไข</button>
          <button onclick="deleteCarFromWorkspace(${car.CarID})" style="background:#ef4444; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; flex:1;">ลบ</button>
        </div>
      </div>
    `;
  });
}

// 🌟 สำคัญมาก: ผูกฟังก์ชันไว้กับ window object เพื่อให้ไฟล์ app.js เรียกข้ามมาได้แน่นอน
window.fetchDashboardStats = fetchDashboardStats;
