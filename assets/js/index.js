// ==========================================
// 首頁老師卡片動態渲染 (index.js)
// ==========================================
// Google Drive 連結轉換
function convertGoogleDriveUrl(url) {
  if (!url) return "./assets/img/tutor.png";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}

// 課程科目對應標籤
function getSubjectTags(subject) {
  const map = {
    11: ["低年級", "兒童英語", "1 對 1"],
    12: ["中年級", "兒童英語", "1 對 1"],
    13: ["高年級", "兒童英語", "1 對 1"],
    21: ["GEPT", "英檢衝刺", "1 對 1"],
    22: ["YLE 劍橋", "兒童英檢", "1 對 1"],
    23: ["國中先修", "口說訓練", "1 對 1"],
    31: ["多元課程", "口說訓練", "1 對 1"],
  };
  return map[subject] || ["英語課程", "1 對 1"];
}

// 渲染單張老師卡片
function renderTeacherCard(course) {
  const avatarUrl = convertGoogleDriveUrl(course.avatarUrl);
  const tags = getSubjectTags(course.subject);
  const rating = course.averageRating > 0 ? course.averageRating : "—";

  return `
        <div class="teacher-slide-item">
            <div class="teacherItem">
                <div class="card rounded-4 border-dark h-100 position-relative">
                    <span class="position-absolute top-0 end-0 translate-middle-y rounded-pill border border-dark text-dark mb-0 bg-light px-3 py-1"
                          style="margin-right: 8px;">
                        平台推薦老師
                    </span>
                    <div class="p-3 h-100">
                        <div class="d-flex flex-column h-100">

                            <!-- 老師頭像 -->
                            <img src="${avatarUrl}"
                                alt="${course.teacherName}"
                                class="rounded-3 w-100 object-fit-cover"
                                style="height:180px;"
                                onerror="this.src='./assets/img/tutor.png'">

                            <div class="card-body px-0">
                                <!-- 老師姓名 + 評分 -->
                                <div class="d-flex align-items-center justify-content-between mt-2 mb-1">
                                    <h6 class="mb-0 fw-bold">${course.teacherName}</h6>
                                    <span class="badge bg-warning text-dark border border-dark">★ ${rating}</span>
                                </div>
                                <!-- 課程名稱 -->
                                <small class="storeName card-title fw-light bg-light d-block mb-1">
                                    ${course.courseName}
                                </small>
                                <!-- 職稱標語 -->
                                ${course.title ? `<small class="text-muted">${course.title}</small>` : ""}
                            </div>

                            <div class="card-footer border-0 py-0 mt-auto bg-transparent px-0">
                                <div class="position-relative">
                                    <!-- 標籤 -->
                                    <div class="mb-2 d-flex flex-wrap gap-2">
                                        ${tags
                                          .map(
                                            (tag) => `
                                            <span class="badge border border-1 border-dark bg-light text-dark fw-light">
                                                ${tag}
                                            </span>
                                        `,
                                          )
                                          .join("")}
                                    </div>
                                    <a href="teacher-profile.html?tutorId=${course.tutorId}&courseId=${course.id}"
                                        class="cardHref btn btn-primary d-inline-block w-100 border border-1 border-dark text-white fw-bold mt-auto card-btn">
                                        <p class="mb-0">立即預約</p>
                                    </a>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ★ 滑鼠拖曳滑動功能
function enableDragScroll(wrapper) {
  let isDown = false;
  let startX;
  let scrollLeft;

  wrapper.addEventListener("mousedown", (e) => {
    isDown = true;
    wrapper.classList.add("active");
    startX = e.pageX - wrapper.offsetLeft;
    scrollLeft = wrapper.scrollLeft;
  });

  wrapper.addEventListener("mouseleave", () => {
    isDown = false;
    wrapper.classList.remove("active");
  });

  wrapper.addEventListener("mouseup", () => {
    isDown = false;
    wrapper.classList.remove("active");
  });

  wrapper.addEventListener("mousemove", (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - wrapper.offsetLeft;
    const walk = (x - startX) * 1.5; // 滑動速度倍率
    wrapper.scrollLeft = scrollLeft - walk;
  });
}

// 頁面初始化
document.addEventListener("DOMContentLoaded", async () => {
  const container = document.getElementById("teacher-card-container");
  if (!container) return;

  try {
    const res = await axios.get(`${API_BASE_URL}/view/courses?size=50`);
    const courses = res.data.content;

    if (!courses || courses.length === 0) {
      container.innerHTML =
        '<div class="col-12 text-center text-muted py-5">目前沒有課程資料</div>';
      return;
    }

    // 每位老師只取第一堂課（用 tutorId 去重），最多顯示 8 張
    const seen = new Set();
    const uniqueCourses = courses
      .filter((c) => {
        if (seen.has(c.tutorId)) return false;
        seen.add(c.tutorId);
        return true;
      })
      .slice(0, 8);

    // ★ 建立外層結構：箭頭 + 滑動容器
    container.innerHTML = "";
    container.classList.add("teacher-slide-section");

    // 左箭頭
    const prevBtn = document.createElement("button");
    prevBtn.className = "slide-arrow slide-prev";
    prevBtn.setAttribute("aria-label", "往左滑動");
    prevBtn.innerHTML = "‹";

    // 右箭頭
    const nextBtn = document.createElement("button");
    nextBtn.className = "slide-arrow slide-next";
    nextBtn.setAttribute("aria-label", "往右滑動");
    nextBtn.innerHTML = "›";

    // 滑動容器
    const wrapper = document.createElement("div");
    wrapper.className = "teacher-slide-wrapper";
    wrapper.innerHTML = uniqueCourses.map(renderTeacherCard).join("");

    container.appendChild(prevBtn);
    container.appendChild(wrapper);
    container.appendChild(nextBtn);

    // ★ 箭頭點擊滑動（每次滑一張卡片的寬度 + gap）
    const scrollAmount = () => {
      const firstItem = wrapper.querySelector(".teacher-slide-item");
      return firstItem ? firstItem.offsetWidth + 20 : 300;
    };

    prevBtn.addEventListener("click", () => {
      wrapper.scrollBy({ left: -scrollAmount(), behavior: "smooth" });
    });

    nextBtn.addEventListener("click", () => {
      wrapper.scrollBy({ left: scrollAmount(), behavior: "smooth" });
    });

    // ★ 啟用滑鼠拖曳
    enableDragScroll(wrapper);
  } catch (err) {
    console.error("載入老師資料失敗：", err);
    container.innerHTML =
      '<div class="col-12 text-center text-danger py-5">🚨 無法連線到伺服器</div>';
  }
});
