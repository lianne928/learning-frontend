// ==========================================
// 控制台頁面邏輯 (teacher-dashboard.js)
// ==========================================

// 從 localStorage 取得老師 ID
const tutorId = localStorage.getItem("userId");

// 設定問候語（依時段）
function setGreeting(name) {
  const hour = new Date().getHours();
  let greeting = "歡迎回來";
  if (hour >= 5 && hour < 12) greeting = "早安";
  else if (hour >= 12 && hour < 18) greeting = "午安";
  else if (hour >= 18 && hour < 22) greeting = "晚安";
  else greeting = "夜深了，注意休息！";

  document.getElementById("greeting-text").textContent = greeting;
  document.getElementById("welcome-name").textContent = name;
}

// 格式化日期為 YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split("T")[0];
}

// 取得時段標籤
function getTimeBadge(dateStr, hour) {
  const today = formatDate(new Date());
  const now = new Date();
  const slotTime = new Date(
    `${dateStr}T${String(hour).padStart(2, "0")}:00:00`,
  );
  const diffMin = (slotTime - now) / 60000;

  if (dateStr === today && diffMin > 0 && diffMin <= 60) {
    return `<span class="upcoming-time-badge time-soon">⚡ 即將開始</span>`;
  } else if (dateStr === today) {
    return `<span class="upcoming-time-badge time-today">📅 今天</span>`;
  } else {
    return `<span class="upcoming-time-badge time-future">${dateStr}</span>`;
  }
}

// 載入統計數字
async function loadStats() {
  if (!tutorId) return;

  try {
    const res = await axios.get(`${API_BASE_URL}/tutor/${tutorId}/stats`);
    const data = res.data;

    document.getElementById("stat-income").textContent = Number(
      data.monthIncome,
    ).toLocaleString();
    document.getElementById("stat-week").textContent = data.weekCount;
    document.getElementById("stat-rating").textContent = data.avgRating;
    document.getElementById("today-count").textContent = data.todayCount;
  } catch (err) {
    console.error("載入統計資料失敗：", err);
  }
}

// 載入即將開始的課程
async function loadUpcomingBookings() {
  if (!tutorId) return;

  const container = document.getElementById("upcoming-list");

  try {
    // 同時取得預約和課程資料
    const [bookRes, courseRes] = await Promise.all([
      axios.get(`${API_BASE_URL}/bookings/tutor/${tutorId}`),
      axios.get(`${API_BASE_URL}/view/courses`),
    ]);

    const bookings = bookRes.data;
    const courses = courseRes.data.content;

    // 建立 courseId → courseName 的 Map
    const courseMap = {};
    courses.forEach((c) => {
      courseMap[c.id] = c.courseName;
    });

    const now = new Date();
    const today = formatDate(now);

    // 過濾出未來 7 天內、slotLocked=true 的預約，並排序
    const upcoming = bookings
      .filter((b) => {
        if (!b.slotLocked) return false;
        const dateStr = Array.isArray(b.date)
          ? `${b.date[0]}-${String(b.date[1]).padStart(2, "0")}-${String(b.date[2]).padStart(2, "0")}`
          : b.date;
        const slotTime = new Date(
          `${dateStr}T${String(b.hour).padStart(2, "0")}:00:00`,
        );
        const diffDays = (slotTime - now) / (1000 * 60 * 60 * 24);
        return slotTime >= now && dateStr === today;  // 只顯示今天
      })
      .map((b) => {
        const dateStr = Array.isArray(b.date)
          ? `${b.date[0]}-${String(b.date[1]).padStart(2, "0")}-${String(b.date[2]).padStart(2, "0")}`
          : b.date;
        return { ...b, dateStr };
      })
      .sort((a, b) => {
        const ta = new Date(
          `${a.dateStr}T${String(a.hour).padStart(2, "0")}:00:00`,
        );
        const tb = new Date(
          `${b.dateStr}T${String(b.hour).padStart(2, "0")}:00:00`,
        );
        return ta - tb;
      })
      .slice(0, 5); // 最多顯示 5 筆

    // 渲染
    if (upcoming.length === 0) {
      container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <span class="material-symbols-outlined d-block mb-2" style="font-size:40px; opacity:0.3;">event_available</span>
                    <p class="mb-0 fw-bold">近期沒有課程安排</p>
                    <p class="small">學生預約後會顯示在這裡</p>
                </div>
            `;
      return;
    }

    container.innerHTML = upcoming
      .map((b) => {
        const timeBadge = getTimeBadge(b.dateStr, b.hour);
        const timeStr = `${String(b.hour).padStart(2, "0")}:00 - ${String(b.hour + 1).padStart(2, "0")}:00`;

        return `
            <div class="upcoming-item">
                <div class="upcoming-info">
                    <div class="upcoming-title">
                        ${b.studentName || "學生 #" + b.studentId}
                    </div>
                    <div class="upcoming-meta">
                        <span>
                            <span class="material-symbols-outlined">menu_book</span>
                            ${b.courseName || "課程"}
                        </span>
                        <span>
                            <span class="material-symbols-outlined">schedule</span>
                            ${timeStr}
                        </span>
                        ${timeBadge}
                    </div>
                </div>
            </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("載入課程失敗：", err);
    container.innerHTML = `
            <div class="text-center text-muted py-4">
                <span class="material-symbols-outlined d-block mb-2 text-danger" style="font-size:36px;">error</span>
                <p class="mb-0">無法載入課程資料</p>
            </div>
        `;
  }
}

// 載入老師名稱
async function loadTeacherName() {
  if (!tutorId) {
    setGreeting("老師");
    return;
  }

  try {
    const res = await axios.get(`${API_BASE_URL}/tutor/${tutorId}`);
    setGreeting(res.data.name || "老師");
  } catch (err) {
    setGreeting("老師");
  }
}

// 頁面載入
document.addEventListener("DOMContentLoaded", () => {
  loadTeacherName();
  loadStats();
  loadUpcomingBookings();
});
