// ==========================================
// 註冊頁面邏輯
// 需要先引入 navbar.js（包含 API_BASE_URL 和 showToast）
// ==========================================

// 表單提交
document
  .getElementById("registerForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("nameInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    const confirmPassword = document.getElementById("confirmPasswordInput").value;
    const birthdayInput = document.getElementById("birthdayInput").value;
    const registerBtn = document.getElementById("registerBtn");
    const confirmInput = document.getElementById("confirmPasswordInput");
    const mismatchMsg = document.getElementById("passwordMismatch");

    // 確認密碼驗證
    if (password !== confirmPassword) {
      confirmInput.classList.add("is-invalid");
      mismatchMsg.style.display = "block";
      showToast("密碼不一致，請重新確認", "error");
      return;
    } else {
      confirmInput.classList.remove("is-invalid");
      mismatchMsg.style.display = "none";
    }

    // 禁用按鈕並顯示載入狀態
    registerBtn.disabled = true;
    registerBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
      註冊中...
    `;

    try {
      // 組合請求資料 - 移除 role，後端會自動設定為 STUDENT
      const payload = {
        name: name,
        email: email,
        password: password
      };

      // birthday 是選填的，有值才加入
      if (birthdayInput) {
        payload.birthday = birthdayInput;
      }

      console.log("發送註冊請求:", payload);

      const response = await axios.post(`${API_BASE_URL}/auth/register`, payload);

      console.log("註冊成功:", response.data);
      
      showToast(response.data.msg || "註冊成功！即將前往登入頁面", "success");
      
      // 延遲跳轉，讓用戶看到成功訊息
      setTimeout(() => {
        window.location.href = "login.html";
      }, 2000);

    } catch (error) {
      console.error("註冊錯誤:", error);

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        console.log("錯誤回應:", status, data);

        if (status === 400) {
          let errorMessage = "請確認填寫資料是否正確";
          
          if (data.message) {
            errorMessage = data.message;
          } else if (data.errors && Array.isArray(data.errors)) {
            errorMessage = data.errors.join(", ");
          } else if (typeof data === 'object') {
            const errors = Object.values(data).filter(v => typeof v === 'string');
            if (errors.length > 0) {
              errorMessage = errors.join(", ");
            }
          }
          
          showToast(`註冊失敗：${errorMessage}`, "error");
          
        } else if (status === 409) {
          showToast("此信箱已被註冊，請使用其他信箱或直接登入", "warning");
          
        } else if (status === 500) {
          showToast("伺服器錯誤，請稍後再試", "error");
          
        } else {
          showToast(`註冊失敗（錯誤碼：${status}）`, "error");
        }
        
      } else if (error.request) {
        showToast("系統連線異常，請確認後端是否啟動", "error");
      } else {
        showToast("發生未知錯誤，請稍後再試", "error");
      }
      
      // 恢復按鈕狀態
      registerBtn.disabled = false;
      registerBtn.innerHTML = "立即註冊 🎉";
    }
  });

// 即時密碼確認驗證
document.getElementById("confirmPasswordInput").addEventListener("input", function() {
  const password = document.getElementById("passwordInput").value;
  const confirmPassword = this.value;
  const mismatchMsg = document.getElementById("passwordMismatch");
  
  if (confirmPassword && password !== confirmPassword) {
    this.classList.add("is-invalid");
    mismatchMsg.style.display = "block";
  } else {
    this.classList.remove("is-invalid");
    mismatchMsg.style.display = "none";
  }
});

// Email 格式即時驗證
document.getElementById("emailInput").addEventListener("blur", function() {
  const email = this.value.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (email && !emailRegex.test(email)) {
    this.classList.add("is-invalid");
    showToast("Email 格式不正確", "warning");
  } else {
    this.classList.remove("is-invalid");
  }
});

// 密碼長度即時驗證
document.getElementById("passwordInput").addEventListener("blur", function() {
  const password = this.value;
  
  if (password && password.length < 8) {
    this.classList.add("is-invalid");
    showToast("密碼至少需要 8 個字元", "warning");
  } else {
    this.classList.remove("is-invalid");
  }
});