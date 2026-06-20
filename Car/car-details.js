document.addEventListener("DOMContentLoaded", function () {
  const container = document.getElementById("car-list-display");
  if (!container) return;

  fetch("get_cars.php")
    .then((response) => response.json())
    .then((data) => {
      container.innerHTML = "";
      data.forEach((car) => {
        // เน้น Path ให้ถูกต้องคือ assets/img-car/ + ชื่อไฟล์ใน DB
        const imgPath = "assets/img-car/" + car.Carimage;

        const carHTML = `
                <div class="car-card">
                    <h3>${car.Brand} ${car.Model}</h3>
                    <p>ทะเบียน: ${car.Plate}</p>
                    <p>สถานะ: ${car.CarStatus}</p>
                    <img src="${imgPath}" alt="${car.Model}" style="width:200px; height:150px; object-fit:cover;">
                </div>
                `;
        container.innerHTML += carHTML;
      });
    })
    .catch((error) => console.error("Error loading cars:", error));
});
