// ==========================================
// 設定頁面邏輯 (student-settings.js)
// ==========================================

const tutorId = localStorage.getItem('userId');

// 暫存目前的 tutor profile
let currentProfile = {};

// 暫存各檔案上傳後的 URL
let uploadedUrls = {
    avatar:       null,
    certificate1: null,
    certificate2: null,
    videoUrl1:    null,
    videoUrl2:    null,
};

// ── 分頁切換 ──
document.querySelectorAll('.schedule-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.schedule-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
});

// ── 轉換 Google Drive 連結 ──
function convertGoogleDriveUrl(url) {
    if (!url) return '';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}

// ── 設定圖片預覽 ──
function setImagePreview(imgId, placeholderId, url) {
    const img         = document.getElementById(imgId);
    const placeholder = document.getElementById(placeholderId);
    if (url) {
        img.src = convertGoogleDriveUrl(url);
        img.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        img.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }
}

// ── 設定影片預覽 ──
function setVideoPreview(videoId, placeholderId, url) {
    const video       = document.getElementById(videoId);
    const placeholder = document.getElementById(placeholderId);
    if (url) {
        video.src = url;
        video.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
    } else {
        video.style.display = 'none';
        if (placeholder) placeholder.style.display = 'flex';
    }
}

// ── 通用上傳函式 ──
async function uploadFile(file, endpoint) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE_URL}/tutor/me/upload/${endpoint}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data.url;
}

// ==========================================
// 自我介紹分頁：顯示/編輯 切換
// ==========================================

// fieldKey 對應：title / intro / exp1 / exp2
function toggleEdit(fieldKey) {
    const view = document.getElementById(`${fieldKey}-view`);
    const edit = document.getElementById(`${fieldKey}-edit`);
    const input = document.getElementById(`input-${fieldKey}`);

    // 填入目前值
    const currentVal = getCurrentFieldValue(fieldKey);
    input.value = currentVal === '—' ? '' : currentVal;

    view.style.display = 'none';
    edit.style.display = 'block';
}

function cancelEdit(fieldKey) {
    document.getElementById(`${fieldKey}-view`).style.display = 'block';
    document.getElementById(`${fieldKey}-edit`).style.display = 'none';
}

function getCurrentFieldValue(fieldKey) {
    return document.getElementById(`${fieldKey}-view`).textContent || '—';
}

async function saveField(fieldKey) {
    const input = document.getElementById(`input-${fieldKey}`);
    const value = input.value.trim();

    // 對應欄位名稱
    const fieldMap = {
        title: 'title',
        intro: 'intro',
        exp1:  'experience1',
        exp2:  'experience2',
    };

    try {
        const payload = { ...currentProfile, [fieldMap[fieldKey]]: value };
        await axios.put(`${API_BASE_URL}/tutor/me/profile`, payload);

        // 更新本地快取
        currentProfile[fieldMap[fieldKey]] = value;

        // 更新顯示
        document.getElementById(`${fieldKey}-view`).textContent = value || '—';
        cancelEdit(fieldKey);

    } catch (err) {
        console.error('儲存失敗：', err);
        alert('❌ 儲存失敗，請稍後再試');
    }
}

// ==========================================
// 個人資料：編輯/取消 切換
// ==========================================
document.getElementById('btn-edit-profile').addEventListener('click', () => {
    document.getElementById('profile-view-mode').style.display = 'none';
    document.getElementById('profile-edit-mode').style.display = 'block';
    document.getElementById('avatar-edit-btn').style.display   = 'flex';
    document.getElementById('btn-edit-profile').style.display  = 'none';
});

document.getElementById('btn-cancel-profile').addEventListener('click', () => {
    document.getElementById('profile-view-mode').style.display = 'block';
    document.getElementById('profile-edit-mode').style.display = 'none';
    document.getElementById('avatar-edit-btn').style.display   = 'none';
    document.getElementById('btn-edit-profile').style.display  = '';
});

// ==========================================
// 頁面初始化
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!tutorId) return;

    try {
        const [meRes, profileRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/users/me`),
            axios.get(`${API_BASE_URL}/tutor/me/profile`)
        ]);

        const me      = meRes.data;
        const profile = profileRes.data;
        currentProfile = { ...profile };

        // 個人資料 - 顯示模式
        document.getElementById('view-name').textContent    = me.name || '—';
        document.getElementById('view-email').textContent   = me.email || '—';
        document.getElementById('view-birthday').textContent = me.birthday || '—';
        document.getElementById('profile-name-display').textContent  = me.name || '';
        document.getElementById('profile-email-display').textContent = me.email || '';

        // 個人資料 - 編輯模式
        document.getElementById('input-name').value     = me.name || '';
        document.getElementById('input-email').value    = me.email || '';
        document.getElementById('input-birthday').value = me.birthday || '';

        // 頭貼
        const avatarUrl = convertGoogleDriveUrl(profile.avatar);
        if (avatarUrl) document.getElementById('avatar-preview').src = avatarUrl;
        uploadedUrls.avatar = profile.avatar;

        // 自我介紹 - 顯示模式
        document.getElementById('title-view').textContent = profile.title       || '—';
        document.getElementById('intro-view').textContent = profile.intro       || '—';
        document.getElementById('exp1-view').textContent  = profile.experience1 || '—';
        document.getElementById('exp2-view').textContent  = profile.experience2 || '—';

        // 證照
        document.getElementById('input-cert1-name').value = profile.certificateName1 || '';
        document.getElementById('input-cert2-name').value = profile.certificateName2 || '';
        setImagePreview('cert1-preview', 'cert1-placeholder', profile.certificate1);
        setImagePreview('cert2-preview', 'cert2-placeholder', profile.certificate2);
        uploadedUrls.certificate1 = profile.certificate1;
        uploadedUrls.certificate2 = profile.certificate2;

        // 影片
        setVideoPreview('video1-preview', 'video1-placeholder', profile.videoUrl1);
        setVideoPreview('video2-preview', 'video2-placeholder', profile.videoUrl2);
        uploadedUrls.videoUrl1 = profile.videoUrl1;
        uploadedUrls.videoUrl2 = profile.videoUrl2;

    } catch (err) {
        console.error('載入資料失敗：', err);
    }
});

// ==========================================
// 頭貼選擇後即時上傳
// ==========================================
document.getElementById('avatar-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => { document.getElementById('avatar-preview').src = ev.target.result; };
    reader.readAsDataURL(file);

    try {
        const url = await uploadFile(file, 'avatar');
        uploadedUrls.avatar = url;
    } catch (err) {
        console.error('頭貼上傳失敗：', err);
        alert('❌ 頭貼上傳失敗！');
    }
});

// ==========================================
// 個人資料儲存
// ==========================================
document.getElementById('btn-save-profile').addEventListener('click', async () => {
    const name     = document.getElementById('input-name').value.trim();
    const birthday = document.getElementById('input-birthday').value;

    if (!name) { alert('姓名不能為空！'); return; }

    const btn = document.getElementById('btn-save-profile');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    try {
        await axios.put(`${API_BASE_URL}/users/me`, { name, birthday: birthday || null });

        // 若頭貼有更換
        if (uploadedUrls.avatar !== currentProfile.avatar) {
            await axios.put(`${API_BASE_URL}/tutor/me/profile`, {
                ...currentProfile, avatar: uploadedUrls.avatar
            });
            currentProfile.avatar = uploadedUrls.avatar;
        }

        // 更新顯示
        document.getElementById('view-name').textContent    = name;
        document.getElementById('view-birthday').textContent = birthday || '—';
        localStorage.setItem('userName', name);
        document.getElementById('sidebar-name').textContent = name;
        document.getElementById('profile-name-display').textContent = name;

        // 回到顯示模式
        document.getElementById('btn-cancel-profile').click();
        alert('✅ 個人資料已儲存！');

    } catch (err) {
        console.error('儲存失敗：', err);
        alert('❌ 儲存失敗，請稍後再試');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">save</span> 儲存';
    }
});

// ==========================================
// 證照 / 影片：選擇後預覽並上傳
// ==========================================
function setupFilePreview(inputId, previewId, placeholderId, uploadEndpoint, urlKey, isVideo = false) {
    document.getElementById(inputId).addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = ev => {
            const el = document.getElementById(previewId);
            el.src = ev.target.result;
            el.style.display = 'block';
            const placeholder = document.getElementById(placeholderId);
            if (placeholder) placeholder.style.display = 'none';
        };
        reader.readAsDataURL(file);

        try {
            const url = await uploadFile(file, uploadEndpoint);
            uploadedUrls[urlKey] = url;
        } catch (err) {
            console.error(`${uploadEndpoint} 上傳失敗：`, err);
            alert('❌ 上傳失敗！');
        }
    });
}

setupFilePreview('cert1-input',  'cert1-preview',  'cert1-placeholder',  'certificate1', 'certificate1');
setupFilePreview('cert2-input',  'cert2-preview',  'cert2-placeholder',  'certificate2', 'certificate2');
setupFilePreview('video1-input', 'video1-preview', 'video1-placeholder', 'video1',       'videoUrl1', true);
setupFilePreview('video2-input', 'video2-preview', 'video2-placeholder', 'video2',       'videoUrl2', true);

// ==========================================
// 媒體儲存
// ==========================================
document.getElementById('btn-save-media').addEventListener('click', async () => {
    const cert1Name = document.getElementById('input-cert1-name').value.trim();
    const cert2Name = document.getElementById('input-cert2-name').value.trim();

    const btn = document.getElementById('btn-save-media');
    btn.disabled = true;
    btn.textContent = '儲存中...';

    try {
        const payload = {
            ...currentProfile,
            certificate1:     uploadedUrls.certificate1,
            certificateName1: cert1Name,
            certificate2:     uploadedUrls.certificate2,
            certificateName2: cert2Name,
            videoUrl1:        uploadedUrls.videoUrl1,
            videoUrl2:        uploadedUrls.videoUrl2,
        };
        await axios.put(`${API_BASE_URL}/tutor/me/profile`, payload);
        currentProfile = { ...payload };
        alert('✅ 證照與影片已儲存！');
    } catch (err) {
        console.error('儲存失敗：', err);
        alert('❌ 儲存失敗，請稍後再試');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">save</span> 儲存所有媒體';
    }
});

// ==========================================
// 修改密碼
// ==========================================
document.getElementById('btn-save-password').addEventListener('click', async () => {
    const oldPassword     = document.getElementById('input-old-password').value;
    const newPassword     = document.getElementById('input-new-password').value;
    const confirmPassword = document.getElementById('input-confirm-password').value;

    if (!oldPassword || !newPassword || !confirmPassword) {
        alert('請填寫所有密碼欄位！'); return;
    }
    if (newPassword.length < 8) {
        alert('新密碼至少需要 8 個字元！'); return;
    }
    if (newPassword !== confirmPassword) {
        alert('新密碼與確認密碼不一致！'); return;
    }

    const btn = document.getElementById('btn-save-password');
    btn.disabled = true;
    btn.textContent = '更新中...';

    try {
        await axios.put(`${API_BASE_URL}/users/me/password`, { oldPassword, newPassword });
        alert('✅ 密碼已更新！請重新登入。');
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        window.location.href = 'login.html';
    } catch (err) {
        const msg = err.response?.data?.msg || '舊密碼不正確或發生錯誤';
        alert(`❌ ${msg}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:16px;">lock_reset</span> 更新密碼';
    }
});