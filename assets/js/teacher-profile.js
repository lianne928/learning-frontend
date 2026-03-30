// ==========================================
// 老師個人頁邏輯 (teacher-profile.js)
// ==========================================
// 從網址列取得參數
const urlParams = new URLSearchParams(window.location.search);
const tutorId = urlParams.get("tutorId");
let selectedCourseId = urlParams.get("courseId");

let allCourses = [];
let tutorBookings = [];

window.addEventListener("DOMContentLoaded", async () => {
  if (!tutorId) {
    alert("找不到老師資訊！");
    return;
  }

  // 先取得預約資料
  try {
    const bookRes = await axios.get(
      `${API_BASE_URL}/bookings/tutor/${tutorId}`,
    );
    tutorBookings = bookRes.data;
  } catch (e) {
    tutorBookings = [];
  }

  // 同時取得老師資料和課程
  await Promise.all([fetchTutorProfile(), fetchTutorCourses()]);
});

// ── Google Drive 連結轉換 ──
function convertGoogleDriveUrl(url) {
  if (!url) return "https://via.placeholder.com/120";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url;
}

// ── 判斷是否為 Google Drive 影片連結 ──
function isGoogleDriveUrl(url) {
  return (
    url && (url.includes("drive.google.com") || url.includes("docs.google.com"))
  );
}

// ── 將任意影片 URL 轉為可嵌入的 embed URL（僅限 Google Drive）──
function toGoogleDriveEmbedUrl(url) {
  const match = url.match(/[/]d[/]([a-zA-Z0-9_-]+)/);
  return match ? `https://drive.google.com/file/d/${match[1]}/preview` : url;
}

// ==========================================
// API 1：取得老師個人資料
// ==========================================
async function fetchTutorProfile() {
  try {
    const res = await axios.get(
      `${API_BASE_URL}/tutor/${tutorId}?courseId=${selectedCourseId || ""}`,
    );
    const data = res.data;

    // 基本資料（全部加 null 檢查，避免找不到 id 報錯）
    const elAvatar = document.getElementById("tutor-avatar");
    const elName = document.getElementById("tutor-name");
    const elNameBg = document.getElementById("tutor-name-bg");
    const elHeadline = document.getElementById("tutor-headline");
    const elIntro = document.getElementById("tutor-intro");
    const elRating = document.getElementById("tutor-rating");

    if (elAvatar) elAvatar.src = convertGoogleDriveUrl(data.avatar);
    if (elName) elName.textContent = data.name || "老師姓名";
    if (elNameBg) elNameBg.textContent = data.name || "老師";
    if (elHeadline) elHeadline.textContent = data.headline || "";
    if (elIntro) elIntro.textContent = data.intro || "";
    if (elRating) elRating.textContent = `⭐ ${data.averageRating || "—"}`;

    // 學歷
    renderEducation(data.education);

    // 經歷
    renderExperience(data.experience1, data.experience2);

    // 各區塊渲染
    renderReviews(data.reviews);
    renderSchedule(data.schedules);
    renderCertificates(
      data.certificate1,
      data.certificateName1,
      data.certificate2,
      data.certificateName2,
    );

    // carousel 只放頭貼
    renderCarousel(data.avatar);

    // 影片獨立區塊
    renderVideos(data.videoUrl1, data.videoUrl2);
    if (data.certificate2) {
      const cert2Img = document.querySelector("#carousel-cert2 img");
      if (cert2Img) cert2Img.src = convertGoogleDriveUrl(data.certificate2);
    }
  } catch (err) {
    console.error("取得老師資料失敗：", err);
  }
}

// ==========================================
// API 2：取得這位老師的所有課程
// ==========================================
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
    renderBookingButton();
  } catch (err) {
    console.error("取得課程資料失敗：", err);
  }
}

// ── 渲染課程選擇按鈕 ──
function renderCourseButtons() {
  const container = document.getElementById("course-buttons");
  container.innerHTML = "";

  allCourses.forEach((course) => {
    const isSelected = String(course.id) === String(selectedCourseId);
    const a = document.createElement("a");
    a.className = isSelected
      ? "nav-link active border rounded-3 px-4 bg-success fw-bold"
      : "nav-link border rounded-3 px-4 fw-bold";
    a.href = "#";
    a.textContent = course.courseName;
    a.onclick = (e) => {
      e.preventDefault();
      selectCourse(course.id);
    };
    container.appendChild(a);
  });
}

// ── 切換課程 ──
function selectCourse(courseId) {
  selectedCourseId = courseId;
  renderCourseButtons();
  renderSelectedCourse();
  renderBookingButton();
  fetchTutorProfile();
}

// ── 渲染課程描述 ──
function renderSelectedCourse() {
  const course = allCourses.find(
    (c) => String(c.id) === String(selectedCourseId),
  );
  if (!course) return;
  const elCourseName = document.getElementById("course-name");
  const elCourseDesc = document.getElementById("course-desc");
  if (elCourseName) elCourseName.textContent = course.courseName;
  if (elCourseDesc) elCourseDesc.textContent = course.description;
}

// ── 渲染預約按鈕和價格 ──
function renderBookingButton() {
  const course = allCourses.find(
    (c) => String(c.id) === String(selectedCourseId),
  );
  if (!course) return;

  const price = course.price;

  document.getElementById("btn-booking").onclick = () => {
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
    // window.location.href = `booking.html?tutorId=${tutorId}&courseId=${selectedCourseId}&price=${price}&tutorName=${tutorName}&courseName=${courseName}`;
    window.location.href = `booking.html?tutorId=${tutorId}&courseId=${selectedCourseId}`;
  };
}

// ==========================================
// 渲染各區塊
// ==========================================

// ── 學歷 ──
function renderEducation(education) {
  const container = document.getElementById("education-list");
  if (!container) return;
  if (!education) {
    container.innerHTML =
      '<li><span class="text-secondary"> ✦ </span> 尚未填寫</li>';
    return;
  }
  container.innerHTML = `<li><span class="text-secondary"> ✦ </span> ${education}</li>`;
}

// ── 經歷 ──
function renderExperience(exp1, exp2) {
  const container = document.getElementById("experience-list");
  if (!container) return;
  const items = [exp1, exp2].filter(Boolean);
  if (items.length === 0) {
    container.innerHTML =
      '<li><span class="text-secondary"> ✦ </span> 尚未填寫</li>';
    return;
  }
  container.innerHTML = items
    .map((exp) => `<li><span class="text-secondary"> ✦ </span> ${exp}</li>`)
    .join("");
}

// ── 評價 ──
function renderReviews(reviews) {
  const container = document.getElementById("reviews-container");
  if (!reviews || reviews.length === 0) {
    container.innerHTML = '<p style="color:#999;">目前還沒有評價</p>';
    return;
  }
  container.innerHTML = reviews
    .map(
      (r, i) => `
    <div class="card border-1 bg-primary border ${i < reviews.length - 1 ? "mb-2" : ""}">
      <div class="card-body">
        <div class="d-flex justify-content-between mb-1">
          <strong class="text-light">${r.studentName}</strong>
          <span class="text-light" style="font-size:0.85em;">${"⭐".repeat(r.rating)} (${r.updatedAt?.split("T")[0] || ""})</span>
        </div>
        <p class="text-light mb-0">${r.comment}</p>
      </div>
    </div>
  `,
    )
    .join("");
}

// ── Carousel：只顯示頭貼 ──
function renderCarousel(avatar) {
  const avatarImg = document.getElementById("tutor-avatar");
  if (avatarImg) avatarImg.src = convertGoogleDriveUrl(avatar);
}

// ── 影片獨立區塊 ──
// 支援兩種來源：
//   1. Google Drive 連結  → 用 <iframe> 嵌入 preview
//   2. 本地伺服器 URL     → 用 <video> 標籤直接播放
function renderVideos(url1, url2) {
  const container = document.getElementById("videos-container");
  if (!container) return;

  const videos = [url1, url2].filter(Boolean);
  if (videos.length === 0) {
    container.innerHTML = "";
    return;
  }

  const labels = ["自我介紹影片", "教學示範影片"];

  container.innerHTML = videos
    .map((url, i) => {
      const label = labels[i];

      if (isGoogleDriveUrl(url)) {
        // ── Google Drive：轉成 embed URL，用 <iframe> 播放 ──
        const embedUrl = toGoogleDriveEmbedUrl(url);
        return `
        <div class="mb-2">
          <p class="fw-bold mb-1 nunito" style="font-size:0.9rem;">▶ ${label}</p>
          <div style="border:2px solid #464646; border-radius:12px; overflow:hidden; height:300px;">
            <iframe src="${embedUrl}" width="100%" height="300"
              frameborder="0" allowfullscreen allow="autoplay">
            </iframe>
          </div>
        </div>
      `;
      } else {
        // ── 本地伺服器 / 一般 URL：用 <video> 標籤直接播放 ──
        return `
        <div class="mb-2">
          <p class="fw-bold mb-1 nunito" style="font-size:0.9rem;">▶ ${label}</p>
          <div style="border:2px solid #464646; border-radius:12px; overflow:hidden;">
            <video
              src="${url}"
              controls
              preload="metadata"
              style="width:100%; height:300px; object-fit:contain; background:#000; display:block;"
            >
              您的瀏覽器不支援影片播放，請更新瀏覽器。
            </video>
          </div>
        </div>
      `;
      }
    })
    .join("");
}

// ── 課表 ──
function renderSchedule(schedules) {
  const container = document.getElementById("schedule-container");

  if (!schedules || schedules.length === 0) {
    container.innerHTML = '<p style="color:#999;">目前沒有開放時段</p>';
    return;
  }

  const now = new Date();
  const after24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const targetDate = new Date(after24h);
  targetDate.setHours(0, 0, 0, 0);

  const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}-${String(targetDate.getDate()).padStart(2, "0")}`;
  const targetWeekday = targetDate.getDay() === 0 ? 7 : targetDate.getDay();

  const availableSlots = schedules
    .filter((s) => s.weekday === targetWeekday)
    .filter((s) => {
      const slotTime = new Date(
        `${targetDateStr}T${String(s.hour).padStart(2, "0")}:00:00`,
      );
      return slotTime > after24h;
    })
    .filter((s) => {
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

  const dayMap = {
    1: "週一",
    2: "週二",
    3: "週三",
    4: "週四",
    5: "週五",
    6: "週六",
    7: "週日",
  };

  if (availableSlots.length === 0) {
    container.innerHTML = `<p style="color:#999;">📅 ${targetDateStr} 當天沒有可預約時段</p>`;
    return;
  }

  container.innerHTML = `
    <p style="font-size:0.85em; color:#666; margin-bottom:10px; width:100%;">
      📅 ${targetDateStr}（${dayMap[targetWeekday]}）可預約時段：
    </p>
    ${availableSlots
      .map(
        (s) => `
      <button type="button" class="btn btn-success border border-1 py-2">
        <time class="nunito">${targetDateStr.slice(5).replace("-", "/")} ${String(s.hour).padStart(2, "0")}:00</time>
      </button>
    `,
      )
      .join("")}
  `;
}

// ── 證照 ──
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
