// ==========================================
// 設定頁面 - 個人資料與密碼管理
// ==========================================

// 載入使用者資料
async function loadUserProfile() {
    try {
        const res = await axios.get(`${API_BASE_URL}/users/me`);
        const user = res.data;
        
        document.getElementById('input-name').value = user.name || '';
        document.getElementById('input-email').value = user.email || '';
        document.getElementById('input-birthday').value = user.birthday || '';
        
    } catch (error) {
        console.error('載入資料失敗:', error);
        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// 更新個人資料
document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('input-name').value.trim();
    const birthday = document.getElementById('input-birthday').value;
    
    if (!name) {
        alert('請輸入姓名');
        return;
    }
    
    try {
        const payload = { name };
        if (birthday) payload.birthday = birthday;
        
        await axios.put(`${API_BASE_URL}/users/me`, payload);
        
        // 更新 localStorage
        localStorage.setItem('userName', name);
        
        alert('✅ 資料已更新');
        
        // 重新載入頁面以更新 sidebar 名稱
        window.location.reload();
        
    } catch (error) {
        console.error('更新失敗:', error);
        alert('❌ 更新失敗：' + (error.response?.data?.message || '請稍後再試'));
    }
});

// 修改密碼
document.getElementById('password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('input-current-password').value;
    const newPassword = document.getElementById('input-new-password').value;
    const confirmPassword = document.getElementById('input-confirm-password').value;
    
    // 驗證
    if (newPassword.length < 8) {
        alert('新密碼至少需要 8 個字元');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('新密碼與確認密碼不一致');
        return;
    }
    
    try {
        await axios.put(`${API_BASE_URL}/users/me/password`, {
            currentPassword,
            newPassword
        });
        
        alert('✅ 密碼已更新，請重新登入');
        
        // 清除登入資訊並跳轉
        localStorage.clear();
        window.location.href = 'login.html';
        
    } catch (error) {
        console.error('修改密碼失敗:', error);
        
        if (error.response?.status === 401) {
            alert('❌ 目前密碼錯誤');
        } else {
            alert('❌ 修改失敗：' + (error.response?.data?.message || '請稍後再試'));
        }
    }
});

// 頁面載入
document.addEventListener('DOMContentLoaded', () => {
    loadUserProfile();
});