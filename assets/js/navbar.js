// ==========================================
// 共用導覽列 JWT 邏輯 (navbar.js)
// 所有前台頁面都引入這個檔案
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
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
      const name = payload.name || "會員";
      const role = payload.role || "";

      // 依角色顯示不同的導覽列
      if (role === "TUTOR") {
        authNavItem.innerHTML = `
                    <a href="teacher-dashboard.html" class="text-decoration-none px-3 text-primary fw-bold">
                        👋 ${name}
                    </a>
                    <a href="#" onclick="navLogout()" class="text-decoration-none px-3 pe-0 text-danger fw-bold">登出</a>
                `;
      } else {
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

function navLogout() {
  if (confirm("確定要登出嗎？")) {
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("userId");
    localStorage.removeItem("userRole");
    localStorage.removeItem("userName");
    window.location.href = "index.html";
  }
}
