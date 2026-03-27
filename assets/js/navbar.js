// ==========================================
// 共用導覽列 JWT 邏輯 + API 配置 (navbar.js)
// 所有前台頁面都引入這個檔案
// ==========================================

// API 基礎網址 - 共用
const API_BASE_URL = "http://localhost:8080/api";

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("jwt_token");
  const authNavItem = document.getElementById("auth-nav-item");

  if (!authNavItem) return;

  if (token) {
    try {
      // 解析 JWT payload
      const base64Url = token.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const padding = "=".repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(
        decodeURIComponent(
          atob(base64 + padding)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join(""),
        ),
      );

      const userId = payload.userId;
      const name = payload.name || "會員";
      const role = payload.role || "";

      // 依角色顯示不同的導覽列
      if (role === "TUTOR") {
        // 已經是老師 - 顯示後台連結
        authNavItem.innerHTML = `
          <a href="teacher-dashboard.html" class="text-decoration-none px-3 text-primary fw-bold">
            👋 ${name}
          </a>
          <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
        `;
      } else if (role === "STUDENT") {
        // 學生 - 檢查是否有申請老師（審核中）
        try {
          const response = await axios.get(
            `${API_BASE_URL}/tutor/application/status`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const tutorStatus = response.data.status;

          if (tutorStatus === 1) {
            // 審核中 (status = 1)
            authNavItem.innerHTML = `
              <span class="text-primary fw-bold px-3">👋 ${name}</span>
              <span class="badge bg-warning text-dark px-3 py-2 fw-bold" style="font-size: 0.9em;">
                ⏳ 審核中
              </span>
              <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
            `;
          } else if (tutorStatus === 2) {
            // 已核准但 role 還沒更新 - 提示重新登入
            authNavItem.innerHTML = `
              <span class="text-primary fw-bold px-3">👋 ${name}</span>
              <a href="#" onclick="navReloadAuth()" class="badge bg-success text-white px-3 py-2 fw-bold text-decoration-none" style="font-size: 0.9em;">
                ✅ 已核准，點此更新
              </a>
              <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
            `;
          } else if (tutorStatus === 3) {
            // 停權 (status = 3)
            authNavItem.innerHTML = `
              <span class="text-primary fw-bold px-3">👋 ${name}</span>
              <span class="badge bg-danger text-white px-3 py-2 fw-bold" style="font-size: 0.9em;">
                ❌ 已停權
              </span>
              <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
            `;
          }
        } catch (error) {
          // 404 = 找不到記錄（未申請）
          // 顯示「成為老師」
          if (error.response && error.response.status === 404) {
            authNavItem.innerHTML = `
              <span class="text-primary fw-bold px-3">👋 ${name}</span>
              <a href="become-tutor.html" class="text-decoration-none px-3 text-info fw-bold">成為老師</a>
              <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
            `;
          } else {
            // 其他錯誤（網路問題等）- 顯示基本資訊
            authNavItem.innerHTML = `
              <span class="text-primary fw-bold px-3">👋 ${name}</span>
              <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
            `;
          }
        }
      } else if (role === "ADMIN") {
        // 管理員 - 顯示後台連結
        authNavItem.innerHTML = `
          <a href="admin-dashboard.html" class="text-decoration-none px-3 text-warning fw-bold">
            🛡️ ${name}
          </a>
          <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
        `;
      } else {
        // 其他未知角色
        authNavItem.innerHTML = `
          <span class="text-primary fw-bold px-3">👋 ${name}</span>
          <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
        `;
      }
    } catch (e) {
      console.error("Token 解析失敗:", e);
      // token 壞掉就清除，顯示登入按鈕
      localStorage.removeItem("jwt_token");
    }
  }
  // 未登入：維持原本的 LOGIN 連結不動
});

// 登出
function navLogout() {
  if (confirm("確定要登出嗎？")) {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    window.location.href = "index.html";
  }
}

// 重新載入認證（審核通過後更新 role）
function navReloadAuth() {
  if (confirm("您的申請已通過！點擊確定重新登入以更新權限")) {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    window.location.href = "login.html";
  }
}

// ==========================================
// Toast 提示函數 - 共用
// ==========================================
function showToast(message, type = "info") {
  const toastContainer = document.getElementById("toastContainer");

  if (!toastContainer) {
    console.warn("找不到 toastContainer");
    return;
  }

  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white border-0 ${getToastClass(type)}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.setAttribute("aria-atomic", "true");

  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${getIcon(type)} ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;

  toastContainer.appendChild(toast);

  const bsToast = new bootstrap.Toast(toast, {
    autohide: true,
    delay: type === "success" ? 2000 : 4000,
  });

  bsToast.show();

  toast.addEventListener("hidden.bs.toast", () => {
    toast.remove();
  });
}

function getToastClass(type) {
  const classes = {
    success: "bg-success",
    error: "bg-danger",
    warning: "bg-warning",
    info: "bg-info",
  };
  return classes[type] || classes.info;
}

function getIcon(type) {
  const icons = {
    success: "🎉",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };
  return icons[type] || icons.info;
}