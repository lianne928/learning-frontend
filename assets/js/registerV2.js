const API_BASE_URL = "http://localhost:8080/api";

// 表單提交
document
  .getElementById("registerForm")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("nameInput").value.trim();
    const email = document.getElementById("emailInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    const confirmPassword = document.getElementById("confirmPasswordInput").value;
    const birthday = document.getElementById("birthdayInput").value || null;
    const role = document.querySelector('input[name="role"]:checked').value;
    const registerBtn = document.getElementById("registerBtn");
    const confirmInput = document.getElementById("confirmPasswordInput");
    const mismatchMsg = document.getElementById("passwordMismatch");

    // 確認密碼驗證
    if (password !== confirmPassword) {
      confirmInput.classList.add("is-invalid");
      mismatchMsg.style.display = "block";
      return;
    } else {
      confirmInput.classList.remove("is-invalid");
      mismatchMsg.style.display = "none";
    }

    registerBtn.disabled = true;
    registerBtn.innerText = "註冊中... ⏳";

    try {
      const payload = { name, email, password, role };
      if (birthday) payload.birthday = birthday;

      await axios.post(`${API_BASE_URL}/auth/registerV2`, payload);

      alert("🎉 註冊成功！即將前往登入頁面");
      window.location.href = "login.html";
    } catch (error) {
      console.error("註冊錯誤:", error);

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 400) {
          // Spring Validation 錯誤會在 data.errors 或 data.message
          const message = data?.message || data?.errors || "請確認填寫資料是否正確";
          alert(`❌ 註冊失敗：${message}`);
        } else if (status === 409) {
          alert("❌ 此信箱已被註冊，請使用其他信箱或直接登入");
        } else {
          alert(`❌ 註冊失敗（錯誤碼：${status}）`);
        }
      } else {
        alert("🚨 系統連線異常，請確認後端是否啟動。");
      }
    } finally {
      registerBtn.disabled = false;
      registerBtn.innerText = "立即註冊 🎉";
    }
  });
