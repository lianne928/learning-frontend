const API_BASE_URL = "http://localhost:8080/api";

// 從網址列取得參數
const urlParams = new URLSearchParams(window.location.search);
const tutorId = urlParams.get("tutorId");
let selectedCourseId = urlParams.get("courseId");

let allCourses = [];

let tutorBookings = []; // 新增全域變數存預約資料

window.addEventListener("DOMContentLoaded", async () => {
  if (!tutorId) {
    alert("找不到學生資訊！");
    return;
  }

  // 先取得預約資料，再一起渲染
  try {
    const bookRes = await axios.get(
      `${API_BASE_URL}/bookings/tutor/${tutorId}`,
    );
    tutorBookings = bookRes.data;
  } catch (e) {
    tutorBookings = [];
  }

  await Promise.all([fetchTutorProfile(), fetchTutorCourses()]);
});

function convertGoogleDriveUrl(url) {
  if (!url) return "https://via.placeholder.com/120";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) {
    return `https://lh3.googleusercontent.com/d/${match[1]}`;
  }
  return url;
}

// 🔗 API 1：取得學生個人資料
async function fetchTutorProfile() {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/tutor/${tutorId}?courseId=${selectedCourseId || ""}`,
    );
    const data = res.data;

    document.getElementById("tutor-avatar").src = convertGoogleDriveUrl(
      data.avatar,
    );
    document.getElementById("tutor-name").textContent = data.name || "學生姓名";
    document.getElementById("tutor-headline").textContent = data.headline || "";
    document.getElementById("tutor-intro").textContent = data.intro || "";
    document.getElementById("tutor-rating").textContent =
      `⭐ ${data.averageRating}`;

    renderVideos(data.videoUrl1, data.videoUrl2);
    renderReviews(data.reviews);
    renderSchedule(data.schedules);
    renderCertificates(
      data.certificate1,
      data.certificateName1,
      data.certificate2,
      data.certificateName2,
    );
  } catch (err) {
    console.error("取得學生資料失敗：", err);
  }
}

// 🔗 API 2：取得這位學生的所有課程
async function fetchTutorCourses() {
  try {
    const res = await axios.get(`${API_BASE_URL}/view/courses`);
    const allData = res.data.content;

    allCourses = allData.filter((c) => String(c.tutorId) === String(tutorId));

    if (!selectedCourseId && allCourses.length > 0) {
      selectedCourseId = allCourses[0].id;
    }

    renderCourseButtons();
    renderSelectedCourse();
    renderPricePanel();
  } catch (err) {
    console.error("取得課程資料失敗：", err);
  }
}

// 渲染課程選擇按鈕
function renderCourseButtons() {
  const container = document.getElementById("course-buttons");
  container.innerHTML = "";

  allCourses.forEach((course) => {
    const btn = document.createElement("button");
    const isSelected = String(course.id) === String(selectedCourseId);
    btn.className = isSelected ? "active" : "";
    btn.textContent = course.courseName;
    btn.onclick = () => selectCourse(course.id);
    container.appendChild(btn);
  });
}

// 切換課程
function selectCourse(courseId) {
  selectedCourseId = courseId;
  renderCourseButtons();
  renderSelectedCourse();
  renderPricePanel();
  fetchTutorProfile();
}

// 渲染目前選取課程的描述
function renderSelectedCourse() {
  const course = allCourses.find(
    (c) => String(c.id) === String(selectedCourseId),
  );
  if (!course) return;

  document.getElementById("course-name").textContent = course.courseName;
  document.getElementById("course-desc").textContent = course.description;
}

// 渲染右側價格欄
function renderPricePanel() {
  const course = allCourses.find(
    (c) => String(c.id) === String(selectedCourseId),
  );
  if (!course) return;

  const price = course.price;
  document.getElementById("price-single").textContent = `NT$ ${price}`;
  document.getElementById("price-5").textContent =
    `NT$ ${Math.floor(price * 5 * 0.95).toLocaleString()}`;
  document.getElementById("price-10").textContent =
    `NT$ ${Math.floor(price * 10 * 0.9).toLocaleString()}`;

  document.getElementById("btn-booking").onclick = () => {
    // 檢查是否已登入
    const token = localStorage.getItem("jwt_token");
    if (!token) {
      alert("請先登入才能預約課程！");
      window.location.href = "login.html";
      return;
    }

    const tutorName = encodeURIComponent(
      document.getElementById("tutor-name").textContent,
    );
    const courseName = encodeURIComponent(course.courseName);
    window.location.href = `booking.html?tutorId=${tutorId}&courseId=${selectedCourseId}&price=${price}&tutorName=${tutorName}&courseName=${courseName}`;
  };
}

// 渲染評價
function renderReviews(reviews) {
  const container = document.getElementById("reviews-container");
  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<p style="color:#999;">目前還沒有評價</p>';
    return;
  }
  container.innerHTML = reviews
    .map(
      (r) => `
        <div style="border-bottom: 1px solid #ccc; padding-bottom: 15px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between;">
                <strong>${r.studentName}</strong>
                <span>${"⭐".repeat(r.rating)} (${r.updatedAt?.split("T")[0] || ""})</span>
            </div>
            <p style="margin: 5px 0 0 0;">${r.comment}</p>
        </div>
    `,
    )
    .join("");
}

// 渲染影片
function renderVideos(url1, url2) {
  const container = document.getElementById("videos-container");
  const videos = [url1, url2].filter(Boolean);

  if (videos.length === 0) {
    container.innerHTML = '<p style="color:#999;">目前沒有影片</p>';
    return;
  }

  container.innerHTML = videos
    .map((url) => {
      // 把分享連結轉成嵌入連結
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      const embedUrl = match
        ? `https://drive.google.com/file/d/${match[1]}/preview`
        : url;

      return `
            <div style="flex: 1 1 240px; border: 1px dashed #999; height: 200px; background: #eee; overflow: hidden;">
                <iframe 
                    src="${embedUrl}" 
                    width="100%" 
                    height="200" 
                    frameborder="0" 
                    allowfullscreen
                    allow="autoplay">
                </iframe>
            </div>
        `;
    })
    .join("");
}

// 渲染課表
function renderSchedule(schedules) {
  const container = document.getElementById("schedule-container");

  if (!schedules || schedules.length === 0) {
    container.innerHTML = '<p style="color:#999;">目前沒有開放時段</p>';
    return;
  }

  const now = new Date();
  // 24 小時後的時間點
  const after24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  // 取得 24 小時後是哪一天
  const targetDate = new Date(after24h);
  targetDate.setHours(0, 0, 0, 0);

  // 用本地時間格式化，避免 UTC 時區偏移問題
  const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;

  // 24 小時後那天的星期幾（1=週一 ... 7=週日）
  const targetWeekday = targetDate.getDay() === 0 ? 7 : targetDate.getDay();

  // 過濾出當天開放的時段
  const availableSlots = schedules
    .filter((s) => s.weekday === targetWeekday)
    .filter((s) => {
      // 時段要在 after24h 之後
      const slotTime = new Date(
        `${targetDateStr}T${String(s.hour).padStart(2, "0")}:00:00`,
      );
      return slotTime > after24h;
    })
    .filter((s) => {
      // 排除已被預約的時段
      return !tutorBookings.some((b) => {
        const bDateStr = Array.isArray(b.date)
          ? `${b.date[0]}-${String(b.date[1]).padStart(2, "0")}-${String(b.date[2]).padStart(2, "0")}`
          : b.date;
        return (
          bDateStr === targetDateStr &&
          b.hour === s.hour &&
          b.slotLocked === true
        );
      });
    })
    .sort((a, b) => a.hour - b.hour);

  if (availableSlots.length === 0) {
    container.innerHTML = `<p style="color:#999;">📅 ${targetDateStr} 當天沒有可預約時段</p>`;
    return;
  }

  const dayMap = {
    1: "週一",
    2: "週二",
    3: "週三",
    4: "週四",
    5: "週五",
    6: "週六",
    7: "週日",
  };

  container.innerHTML = `
        <p style="font-size:0.85em; color:#666; margin-bottom: 10px;">
            📅 ${targetDateStr}（${dayMap[targetWeekday]}）可預約時段：
        </p>
        ${availableSlots
          .map(
            (s) => `
            <span class="schedule-tag">
                🕒 ${String(s.hour).padStart(2, "0")}:00
            </span>
        `,
          )
          .join("")}
    `;
}

// 渲染證照
function renderCertificates(cert1, name1, cert2, name2) {
  const container = document.getElementById("certificates-container");
  container.innerHTML = "";

  const items = [
    [cert1, name1],
    [cert2, name2],
  ].filter(([c]) => c);
  if (items.length === 0) {
    container.innerHTML =
      '<li style="list-style:none; color:#999;">目前沒有證照資料</li>';
    return;
  }

  items.forEach(([url, name]) => {
    const li = document.createElement("li");
    li.style.marginBottom = "10px";

    const label = document.createElement("strong");
    label.textContent = "專業認證：";

    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.textContent = name || "查看證照";

    li.appendChild(label);
    li.appendChild(link);
    container.appendChild(li);
  });
}
