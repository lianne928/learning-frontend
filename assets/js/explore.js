// ==========================================
// 探索好老師頁面邏輯 (explore.js)
// 需要先引入 navbar.js（包含 API_BASE_URL）
// ==========================================

let allCoursesData = [];
let currentPage = 0;
let totalPages = 0;
const PAGE_SIZE = 8; // 每頁顯示 8 筆

// ══════════════════════════════════════════
// Google Drive 連結轉換
// ══════════════════════════════════════════
function convertGoogleDriveUrl(url) {
  if (!url) return "https://via.placeholder.com/400x300";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url;
}

// ══════════════════════════════════════════
// 取得課程科目標籤文字
// ══════════════════════════════════════════
function getSubjectLabel(subject) {
  const map = {
    11: "低年級",
    12: "中年級",
    13: "高年級",
    21: "GEPT",
    22: "YLE",
    23: "國中先修",
    31: "其他",
  };
  return map[subject] || "";
}

// ══════════════════════════════════════════
// 載入課程資料（支援分頁）
// ══════════════════════════════════════════
async function fetchCourses(page = 0) {
  const container = document.getElementById("course-list-container");
  container.innerHTML =
    '<h3 style="text-align: center; width: 100%; color: #666;">⏳ 課程資料載入中...</h3>';

  try {
    const response = await axios.get(`${API_BASE_URL}/view/courses`, {
      params: {
        page: page,
        size: PAGE_SIZE
      }
    });
    
    allCoursesData = response.data.content;
    currentPage = response.data.number;
    totalPages = response.data.totalPages;
    
    console.log("成功拿到資料：", allCoursesData);
    console.log(`目前頁數: ${currentPage + 1} / ${totalPages}`);
    
    renderCards(allCoursesData);
    renderPagination();
  } catch (error) {
    console.error("撈取課程資料失敗:", error);
    container.innerHTML =
      '<h3 style="text-align: center; width: 100%; color: #d9534f;">🚨 無法連線到伺服器</h3>';
  }
}

// ══════════════════════════════════════════
// 渲染課程卡片
// ══════════════════════════════════════════
function renderCards(coursesToRender) {
  const container = document.getElementById("course-list-container");
  container.innerHTML = "";

  if (coursesToRender.length === 0) {
    container.innerHTML =
      '<h3 style="text-align: center; width: 100%; color: #999;">沒有找到符合條件的課程喔！換個關鍵字試試吧 🥺</h3>';
    return;
  }

  coursesToRender.forEach((course) => {
    const subjectLabel = getSubjectLabel(course.subject);
    const rating = course.averageRating > 0 ? course.averageRating : "—";

    // 建立背面課表格子
    const days = ["一", "二", "三", "四", "五", "六", "日"];
    const periods = [
      { key: "morning", label: "上午" },
      { key: "afternoon", label: "下午" },
      { key: "evening", label: "晚上" },
    ];
    const slots = course.availableSlots || [];

    let backSchedule = '<div class="flip-schedule-grid">';
    backSchedule += '<div class="flip-sg-corner"></div>';
    days.forEach((d) => {
      backSchedule += `<div class="flip-sg-header">週${d}</div>`;
    });
    periods.forEach((period) => {
      backSchedule += `<div class="flip-sg-label">${period.label}</div>`;
      for (let day = 1; day <= 7; day++) {
        const has = slots.some((s) => s === day + "-" + period.key);
        backSchedule += `<div class="flip-sg-cell${has ? " on" : ""}"></div>`;
      }
    });
    backSchedule += "</div>";

    const cardHTML = `
      <div class="col">
        <div class="flip-card" onclick="this.classList.toggle('flipped')">
          <div class="flip-card-inner">

            <!-- 正面 -->
            <div class="flip-card-front explore-card">
              <span class="explore-tw-badge">Teacher From TW.</span>
              <div class="explore-card-img-wrap">
                <img src="${convertGoogleDriveUrl(course.avatarUrl)}"
                  class="explore-card-img" alt="${course.teacherName}">
              </div>
              <div class="explore-diamond">✦</div>
              <div class="explore-card-body">
                <div class="d-flex align-items-center gap-2">
                  <h5 class="mb-0 sansTeg explore-teacher-name">${course.teacherName || "老師"}</h5>
                  <span class="explore-rating ms-auto">★ ${rating}</span>
                </div>
                <div class="mt-1">
                  <p class="nunito mb-0 explore-course-name">${course.courseName || "課程名稱"}</p>
                  <div class="d-flex gap-1 flex-wrap mt-1">
                    ${subjectLabel ? `<span class="explore-tag">${subjectLabel}</span>` : ""}
                    ${course.title ? `<span class="explore-tag">${course.title}</span>` : ""}
                  </div>
                </div>
              </div>
              <div class="explore-card-footer">
                <div class="d-flex justify-content-center gap-4 mb-2">
                  <div>
                    <span class="explore-price-label">體驗課 <span class="explore-price-badge explore-badge-grey">首堂優惠</span></span>
                    <div class="explore-price explore-price-pink text-center">200<span class="explore-price-unit"> / 60 mins</span></div>
                  </div>
                  <div>
                    <span class="explore-price-label">單堂 <span class="explore-price-badge explore-badge-blue">一般方案</span></span>
                    <div class="explore-price explore-price-blue text-center">${course.price || 0}<span class="explore-price-unit"> / 60 mins</span></div>
                  </div>
                </div>
                <a href="teacher-profile.html?tutorId=${course.tutorId}&courseId=${course.id}"
                  class="text-decoration-none" onclick="event.stopPropagation()">
                  <button type="button" class="explore-btn-talk">LET'S TALK +</button>
                </a>
              </div>
            </div>

            <!-- 背面 -->
            <div class="flip-card-back">
              <div class="flip-back-header">
                <div>
                  <div class="flip-back-name">${course.teacherName || "老師"}</div>
                  <div class="flip-back-course">${course.courseName || "課程名稱"}</div>
                </div>
                <span class="explore-rating">★ ${rating}</span>
              </div>
              <div class="flip-back-schedule-wrap">
                <div class="flip-schedule-title">📅 開課時段</div>
                ${backSchedule}
              </div>
              <div class="flip-back-footer">
                <button class="flip-btn-back" onclick="event.stopPropagation(); this.closest('.flip-card').classList.remove('flipped')">
                  ← 返回
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    `;
    container.innerHTML += cardHTML;
  });
}

// ══════════════════════════════════════════
// 渲染分頁按鈕
// ══════════════════════════════════════════
function renderPagination() {
  const container = document.getElementById("pagination-container");
  
  if (totalPages <= 1) {
    container.style.display = "none";
    return;
  }
  
  container.style.display = "flex";
  container.innerHTML = "";
  
  // 上一頁按鈕
  const prevBtn = document.createElement("button");
  prevBtn.className = "btn btn-outline-primary mx-1";
  prevBtn.textContent = "← 上一頁";
  prevBtn.disabled = currentPage === 0;
  prevBtn.onclick = () => fetchCourses(currentPage - 1);
  container.appendChild(prevBtn);
  
  // 頁碼按鈕（最多顯示 5 頁）
  const startPage = Math.max(0, currentPage - 2);
  const endPage = Math.min(totalPages - 1, startPage + 4);
  
  for (let i = startPage; i <= endPage; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.className = i === currentPage ? "btn btn-primary mx-1" : "btn btn-outline-primary mx-1";
    pageBtn.textContent = i + 1;
    pageBtn.onclick = () => fetchCourses(i);
    container.appendChild(pageBtn);
  }
  
  // 下一頁按鈕
  const nextBtn = document.createElement("button");
  nextBtn.className = "btn btn-outline-primary mx-1";
  nextBtn.textContent = "下一頁 →";
  nextBtn.disabled = currentPage >= totalPages - 1;
  nextBtn.onclick = () => fetchCourses(currentPage + 1);
  container.appendChild(nextBtn);
}

// ══════════════════════════════════════════
// 前端搜尋過濾（在當前頁資料中搜尋）
// ══════════════════════════════════════════
function handleSearch() {
  const keyword = document
    .getElementById("searchInput")
    .value.toLowerCase()
    .trim();
  const subjectValue = document.getElementById("subjectSelect").value;
  const dayValue = document.getElementById("daySelect").value;
  const timeValue = document.getElementById("timeSelect").value;

  const filteredCourses = allCoursesData.filter((course) => {
    const matchKeyword =
      !keyword ||
      (course.teacherName &&
        course.teacherName.toLowerCase().includes(keyword)) ||
      (course.courseName &&
        course.courseName.toLowerCase().includes(keyword));

    const matchSubject = !subjectValue || course.subject == subjectValue;

    let matchSchedule = true;
    if (dayValue || timeValue) {
      matchSchedule = course.availableSlots.some((slot) => {
        const [sDay, sTime] = slot.split("-");
        const dayCondition = !dayValue || sDay === dayValue;
        const timeCondition = !timeValue || sTime === timeValue;
        return dayCondition && timeCondition;
      });
    }

    return matchKeyword && matchSubject && matchSchedule;
  });

  renderCards(filteredCourses);
}

// ══════════════════════════════════════════
// 頁面初始化
// ══════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  // 載入第一頁資料
  fetchCourses(0);
  
  // 綁定搜尋事件
  document.getElementById("searchInput").addEventListener("input", handleSearch);
  document.getElementById("subjectSelect").addEventListener("change", handleSearch);
  document.getElementById("daySelect").addEventListener("change", handleSearch);
  document.getElementById("timeSelect").addEventListener("change", handleSearch);
  document.getElementById("btnSearch").addEventListener("click", handleSearch);
});