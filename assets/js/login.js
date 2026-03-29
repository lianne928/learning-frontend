document
  .getElementById("loginForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const email = document.getElementById("emailInput").value;
    const password = document.getElementById("passwordInput").value;
    const loginBtn = document.getElementById("loginBtn");

    loginBtn.disabled = true;
    loginBtn.innerText = "登入中... ⏳";

    try {
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        email: email,
        password: password,
      });

      const token = response.data.token;

      if (token) {
        // 存入 JWT Token
        localStorage.setItem("jwt_token", token);

        // 從 Token payload 解析 userId、role、name
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

        // 存入 localStorage
        localStorage.setItem("userId", payload.userId);
        localStorage.setItem("userRole", payload.role);
        localStorage.setItem("userName", payload.name);

        alert("🎉 登入成功！");

        // 若有待跳轉頁面（如 video-room），優先跳轉
        const redirectUrl = localStorage.getItem('redirect_after_login');
        if (redirectUrl) {
          localStorage.removeItem('redirect_after_login');
          window.location.href = redirectUrl;
          return;
        }

        // 依角色跳轉
        if (payload.role === 'ADMIN') {
          window.location.href = "admin-dashboard.html";
        } else {
          // TUTOR 和 STUDENT 都跳首頁
          window.location.href = "index.html";
        }
      } else {
        throw new Error("伺服器未回傳 Token");
      }
    } catch (error) {
      console.error("登入錯誤:", error);
      if (
        error.response &&
        (error.response.status === 401 || error.response.status === 400)
      ) {
        alert("❌ 登入失敗：帳號或密碼錯誤！");
      } else {
        alert("🚨 系統連線異常，請確認後端是否啟動。");
      }
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerText = "上課去！";
    }
  });