/* การ์ด "เพิ่มการจองลงปฏิทินมือถือ" ในหน้าโปรไฟล์ */
(function () {
  "use strict";
  const card = document.getElementById("calendar-card");
  if (!card) return;
  const ios = card.querySelector("#cal-ios");
  const copy = card.querySelector("#cal-copy");
  let feedUrl = "";

  fetch("get_calendar_link.php", { cache: "no-store" })
    .then((r) => r.json())
    .then((d) => {
      if (!d || !d.success) {
        card.style.display = "none";
        return;
      }
      feedUrl = d.url;
      ios.href = d.webcal;
    })
    .catch(() => {
      card.style.display = "none";
    });

  copy.addEventListener("click", async () => {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
    } catch (e) {
      const t = document.createElement("textarea");
      t.value = feedUrl;
      document.body.appendChild(t);
      t.select();
      try { document.execCommand("copy"); } catch (e2) {}
      t.remove();
    }
    if (window.AppDialog) window.AppDialog.alert("คัดลอกลิงก์ปฏิทินแล้ว นำไปวางในแอปปฏิทินได้เลย", { type: "success", title: "คัดลอกแล้ว" });
  });
})();
