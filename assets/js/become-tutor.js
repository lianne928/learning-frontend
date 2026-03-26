// ==========================================
// 申請成為老師頁面邏輯
// 需要先引入 navbar.js（包含 API_BASE_URL 和 showToast）
// ==========================================

// 檢查登入狀態
function checkAuth() {
  const token = localStorage.getItem('jwt_token');
  const userRole = localStorage.getItem('userRole');
  
  if (!token) {
    // 未登入，導向登入頁
    showToast("請先登入", "warning");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
    return false;
  }
  
  if (userRole === 'TUTOR') {
    // 已經是老師了
    showToast("您已經是老師了，即將前往老師後台", "info");
    setTimeout(() => {
      window.location.href = "teacher-dashboard.html";
    }, 2000);
    return false;
  }
  
  return true;
}

// 頁面載入時檢查登入狀態
document.addEventListener('DOMContentLoaded', function() {
  if (!checkAuth()) {
    return;
  }
});

// 表單提交
document.getElementById('becomeTutorForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const token = localStorage.getItem('jwt_token');
  if (!token) {
    showToast("請先登入", "error");
    window.location.href = "login.html";
    return;
  }
  
  const submitBtn = document.getElementById('submitBtn');
  const title = document.getElementById('titleInput').value.trim();
  const intro = document.getElementById('introInput').value.trim();
  const education = document.getElementById('educationInput').value.trim();
  const experience1 = document.getElementById('experience1Input')?.value.trim() || "";
  const experience2 = document.getElementById('experience2Input')?.value.trim() || "";
  const certificateName1 = document.getElementById('cert1Input')?.value.trim() || "";
  const certificateName2 = document.getElementById('cert2Input')?.value.trim() || "";
  
  // 禁用按鈕
  submitBtn.disabled = true;
  submitBtn.innerHTML = `
    <span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
    提交中...
  `;
  
  try {
    // ⚠️ 修正：選填欄位送空字串 "" 而非 undefined
    const payload = {
      title,
      intro,
      education,
      experience1,
      experience2,
      certificateName1,
      certificateName2
    };
    
    console.log("發送申請:", payload);
    
    const response = await axios.post(`${API_BASE_URL}/tutor/become`, payload, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log("申請成功:", response.data);
    
    // ⚠️ 重點：申請成功後不改變 localStorage 的 role
    showToast("✅ 申請已提交！導覽列將顯示「審核中」", "success");
    
    // 2 秒後回首頁，navbar 會自動顯示審核狀態
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
    
  } catch (error) {
    console.error("申請錯誤:", error);
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 400) {
        let errorMessage = "請檢查填寫內容是否正確";
        if (data.msg) {
          errorMessage = data.msg;
        } else if (data.message) {
          errorMessage = data.message;
        }
        showToast(errorMessage, "error");
      } else if (status === 401) {
        showToast("登入已過期，請重新登入", "warning");
        setTimeout(() => {
          localStorage.clear();
          window.location.href = "login.html";
        }, 2000);
      } else {
        showToast(data.msg || data.message || "申請失敗，請稍後再試", "error");
      }
    } else {
      showToast("系統連線異常，請確認後端是否啟動", "error");
    }
    
    // 恢復按鈕
    submitBtn.disabled = false;
    submitBtn.innerHTML = "提交申請 🚀";
  }
});