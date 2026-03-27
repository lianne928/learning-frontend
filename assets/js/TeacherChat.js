// ==========================================
// 老師訊息中心邏輯 (TeacherChat.js)
// 串接後端 REST API + WebSocket (STOMP)
// ==========================================

// ✅ 修正：移除重複定義，使用 navbar.js 的 API_BASE_URL
// 注意：navbar.js 必須在此檔案之前載入！

const DEFAULT_AVATAR = '/assets/img/default-student-avatar.png';

// WebSocket 基礎 URL（從 API_BASE_URL 自動推導）
const WS_BASE_URL = (() => {
    if (API_BASE_URL.startsWith('http')) {
        const url = new URL(API_BASE_URL);
        return `${url.protocol}//${url.host}`;
    }
    return window.location.origin;
})();

let tutorId = null;

let conversations = [];      // { bookingId (=orderId), bookingRecordId, bookingIds[], bookingRecordIds[], participantId, participantName, avatar, subject, lastMessage, time, unread }
let currentStudentId = null; // 🆕 改用 studentId（原本是 currentBookingId）
let stompClient = null;
let stompSubscription = null;
let stompErrorSubscription = null;

// ── Helpers ──────────────────────────────

function resolveMediaUrl(mediaUrl) {
    if (!mediaUrl) return '';
    if (mediaUrl.startsWith('http') || mediaUrl.startsWith('blob:')) return mediaUrl;
    return (mediaUrl.startsWith('/') ? '' : '/') + mediaUrl;
}

function convertGoogleDriveUrl(url) {
    if (!url) return DEFAULT_AVATAR;
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}

function getJwt() {
    return localStorage.getItem('jwt_token');
}

// 模組載入時立即設定 axios 全域 Authorization header（與 teacher-layout.js 一致）
const _initJwt = getJwt();
if (_initJwt) {
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + _initJwt;
}

function authHeaders() {
    return {
        'Authorization': 'Bearer ' + getJwt(),
        'Content-Type': 'application/json'
    };
}

async function downloadFile(storedName, originalName) {
    try {
        const res = await axios.get(
            `${API_BASE_URL}/chatMessage/download/${storedName}?name=${encodeURIComponent(originalName)}`,
            { headers: authHeaders(), responseType: 'blob' }
        );
        const url = URL.createObjectURL(res.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = originalName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('下載失敗', err);
        alert('檔案下載失敗，請重試。');
    }
}

function formatTime(createdAt) {
    if (!createdAt) return '';
    const d = new Date(createdAt);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) {
        return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    } else if (diffDays === 1) {
        return '昨天';
    } else if (diffDays < 7) {
        return ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][d.getDay()];
    } else {
        return `${d.getMonth() + 1}/${d.getDate()}`;
    }
}

function getBookingIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const rawBookingId = params.get('bookingId') || params.get('bookingid');
    const bookingId = Number.parseInt(rawBookingId, 10);
    return Number.isInteger(bookingId) && bookingId > 0 ? bookingId : null;
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (container) container.scrollTop = container.scrollHeight;
}

// ── 載入對話列表 ──────────────────────────


async function loadConversations() {
    if (!tutorId) {
        console.warn('無法取得 userId，取消載入對話列表');
        return;
    }
    try {
        const res = await axios.get(
            `${API_BASE_URL}/chatMessage/conversations/tutor/${tutorId}`,
            { headers: authHeaders() }
        );
        
        conversations = res.data.map(conv => ({
            studentId: conv.studentId,
            studentName: conv.studentName,
            // ✅ 正確寫法 (統一使用最上面定義好的 DEFAULT_AVATAR)
studentAvatar: conv.studentAvatar || DEFAULT_AVATAR,
            orderIds: conv.orderIds,
            courses: conv.courses,
            lastMessage: conv.lastMessage || '',
            lastMessageTime: conv.lastMessageTime,
            unreadCount: conv.unreadCount || 0
        }));
        
        renderChatList();
        
        if (conversations.length > 0) {
            selectConversation(conversations[0].studentId);
        }
    } catch (err) {
        console.error('載入對話列表失敗', err);
    }
}


// ── 渲染對話列表 ──────────────────────────

function renderChatList(filter = '') {
    const list = document.getElementById('chatList');
    const filtered = conversations.filter(c =>
        c.studentName.toLowerCase().includes(filter.toLowerCase()) ||
        c.courses.join(", ").includes(filter)
    );

    list.innerHTML = filtered.map(c => `
        <li class="chat-item ${c.studentId === currentStudentId ? 'active' : ''}" data-student-id="${c.studentId}">
            <div class="contact-avatar-wrap">
                <img src="${c.studentAvatar || DEFAULT_AVATAR}" alt="${escapeHtml(c.studentName)}" class="contact-avatar" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}';">
            </div>
            <div class="chat-item-body">
                <div class="chat-item-top">
                    <span class="contact-name">${escapeHtml(c.studentName)}</span>
                    <span class="contact-time">${formatTime(c.lastMessageTime)}</span>
                </div>
                <div class="chat-item-bottom">
                    <span class="contact-preview">${escapeHtml(c.lastMessage)}</span>
                    ${c.unreadCount > 0 ? `<span class="unread-badge">${c.unreadCount}</span>` : ''}
                </div>
                <span class="subject-tag">${escapeHtml(c.courses.join(", "))}</span>
            </div>
        </li>
    `).join('');

    list.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            selectConversation(parseInt(item.dataset.studentId, 10));
        });
    });
}

// ── 渲染訊息 ──────────────────────────────

function buildMsgHtml(m, conv) {
    const isMe = m.role === 2 || m.role === '2';  // role = 2 是老師
    const timeStr = formatTime(m.createdAt);
    let content = '';

    if (m.messageType === 4) {
        content = `<img src="${resolveMediaUrl(m.mediaUrl)}" style="max-width:200px;border-radius:8px;" alt="圖片">`;
    } else if (m.messageType === 5) {
        content = `<video src="${resolveMediaUrl(m.mediaUrl)}" controls style="max-width:240px;border-radius:8px;"></video>`;
    } else if (m.messageType === 3) {
        content = `<audio src="${resolveMediaUrl(m.mediaUrl)}" controls></audio>`;
    } else if (m.messageType === 6) {
        const storedName = m.mediaUrl ? m.mediaUrl.split('/').pop() : '';
        const originalName = m.message || storedName || '下載檔案';
        if (m.mediaUrl && !m.mediaUrl.startsWith('blob:')) {
            content = `<button class="msg-file-link" onclick="downloadFile('${encodeURIComponent(storedName)}','${escapeHtml(originalName).replace(/'/g, "\\'")}')">📎 ${escapeHtml(originalName)}</button>`;
        } else {
            content = `<a href="${m.mediaUrl}" download="${escapeHtml(originalName)}" class="msg-file-link">📎 ${escapeHtml(originalName)}</a>`;
        }
    } else {
        content = escapeHtml(m.message || '');
    }

    if (isMe) {
        // 老師訊息（右邊藍色）
        return `
            <div class="msg-row tutor" style="align-self: flex-end; margin-left: auto; width: fit-content; max-width: 70%;">
                <div class="msg-content" style="max-width: 100%;">
                    <div class="msg-bubble" style="word-break: break-word; overflow-wrap: break-word;">${content}</div>
                    <span class="msg-time">${timeStr}</span>
                </div>
            </div>`;
    } else {
        // 學生訊息（左邊白色）
        const avatarUrl = '/assets/img/default-student-avatar.png';
        return `
            <div class="msg-row student" style="align-self: flex-start; margin-right: auto; width: fit-content; max-width: 70%;">
                <img src="${avatarUrl}" alt="${escapeHtml(conv.studentName)}" class="msg-row-avatar">
                <div class="msg-content" style="max-width: 100%;">
                    <div class="msg-bubble" style="word-break: break-word; overflow-wrap: break-word;">${content}</div>
                    <span class="msg-time">${timeStr}</span>
                </div>
            </div>`;
    }
}



function renderMessages(messages, conv) {
    const container = document.getElementById('chatMessages');
    container.innerHTML = messages.map(m => buildMsgHtml(m, conv)).join('');
    scrollToBottom();
}

function appendMessage(m) {
    const conv = conversations.find(c => c.studentId === currentStudentId);
    if (!conv) return;
    const container = document.getElementById('chatMessages');
    container.insertAdjacentHTML('beforeend', buildMsgHtml(m, conv));
    scrollToBottom();

    conv.lastMessage = m.message || '';
    conv.time = formatTime(m.createdAt);
    renderChatList(document.getElementById('searchInput').value);
}

// ── 選取對話 ──────────────────────────────

async function selectConversation(studentId) {
    const conv = conversations.find(c => c.studentId === studentId);
    if (!conv) {
        console.warn('找不到對話', studentId);
        return;
    }
    
    currentStudentId = studentId;
    
    document.getElementById('headerName').textContent = conv.studentName;
    document.getElementById('headerAvatar').src = conv.studentAvatar || DEFAULT_AVATAR;
    document.getElementById('headerTag').textContent = conv.courses.join(', ');
    
    document.querySelectorAll('.chat-list-item').forEach(item => {
        if (parseInt(item.dataset.studentId) === studentId) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    try {
        const res = await axios.get(
            `${API_BASE_URL}/chatMessage/orders?ids=${conv.orderIds.join(',')}`,
            { headers: authHeaders() }
        );
        
        const messages = res.data;
        renderMessages(messages, conv);
        scrollToBottom();
        connectWebSocket(conv.orderIds[0]);
    } catch (err) {
        console.error('載入訊息失敗', err);
    }
}

function connectWebSocket(bookingId) {
    if (stompSubscription) {
        stompSubscription.unsubscribe();
        stompSubscription = null;
    }

    if (stompErrorSubscription) {
        stompErrorSubscription.unsubscribe();
        stompErrorSubscription = null;
    }

    if (isStompConnected()) {
        subscribeBooking(bookingId);
        return;
    }

    if (stompClient) {
        try {
            if (typeof stompClient.deactivate === 'function') {
                stompClient.deactivate();
            } else if (typeof stompClient.disconnect === 'function') {
                stompClient.disconnect();
            }
        } catch { }
    }

    const jwt = getJwt();
    if (window.StompJs && window.StompJs.Client) {
        stompClient = new window.StompJs.Client({
            webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
            connectHeaders: { Authorization: 'Bearer ' + jwt },
            reconnectDelay: 5000,
            onConnect: () => subscribeBooking(bookingId),
            onStompError: err => console.error('WebSocket 連線失敗', err)
        });
        stompClient.activate();
        return;
    }

    if (window.Stomp && typeof window.Stomp.over === 'function') {
        const socket = new SockJS(`${WS_BASE_URL}/ws`);
        stompClient = window.Stomp.over(socket);
        stompClient.debug = null;
        stompClient.connect(
            { Authorization: 'Bearer ' + jwt },
            () => subscribeBooking(bookingId),
            err => console.error('WebSocket 連線失敗', err)
        );
        return;
    }

    console.error('找不到 STOMP 客戶端，請確認 stompjs 載入成功');
}

function isStompConnected() {
    if (!stompClient) return false;
    if (typeof stompClient.connected === 'boolean') return stompClient.connected;
    if (typeof stompClient.active === 'boolean') return stompClient.active;
    return false;
}

function subscribeBooking(bookingId) {
    stompSubscription = stompClient.subscribe(
        `/topic/room/${bookingId}/chat`,
        frame => {
            const msg = JSON.parse(frame.body);
            // 避免重複顯示自己送出的訊息
            if (msg.role !== 2) {  // 老師 = 2
                appendMessage(msg);
            }
        }
    );

    stompErrorSubscription = stompClient.subscribe(
        `/topic/room/${bookingId}/errors`,
        frame => {
            try {
                const error = JSON.parse(frame.body);
                console.error('聊天室訊息儲存失敗', error);
            } catch {
                console.error('聊天室訊息儲存失敗', frame.body);
            }
        }
    );
}

// ── 傳送訊息 ──────────────────────────────

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text) return;
    
    const conv = conversations.find(c => c.studentId === currentStudentId);
    if (!conv) {
        alert('請先選擇對話');
        return;
    }
    
    const targetOrderId = conv.orderIds[0];
    
    const payload = {
        bookingId: targetOrderId,
        role: 2,  // 老師 = 2
        messageType: 1,
        message: text,
        mediaUrl: null
    };

    const now = new Date().toISOString();
    appendMessage({ ...payload, role: 2, createdAt: now });  // 顯示時用數字
    input.value = '';

    try {
        if (stompClient && stompClient.connected) {
            if (typeof stompClient.publish === 'function') {
                stompClient.publish({
                    destination: `/app/chat/${targetOrderId}`,
                    body: JSON.stringify(payload)
                });
            } else {
                stompClient.send(`/app/chat/${targetOrderId}`, {}, JSON.stringify(payload));
            }
        } else {
            await axios.post(`${API_BASE_URL}/chatMessage`, payload, { headers: authHeaders() });
        }
    } catch (err) {
        input.value = text;
        console.error('傳送訊息失敗', err);
    }
}


// ── 上傳檔案 ──────────────────────────────

function detectLocalType(file) {
    const t = file.type || '';
    if (t.startsWith('image/')) return 4;
    if (t.startsWith('video/')) return 5;
    if (t.startsWith('audio/')) return 3;
    return 6;
}

async function uploadFile(file) {
    if (!file || !currentBookingId) return;

    const fileInput = document.getElementById('fileInput');
    fileInput.disabled = true;

    const localType = detectLocalType(file);
    const blobUrl = URL.createObjectURL(file);
    const tempId = 'upload-preview-' + Date.now();
    const conv = conversations.find(c => c.studentId === currentStudentId);
    const msgArea = document.getElementById('chatMessages');

    const previewMsg = {
        role: 2,  // 老師 = 2
        messageType: localType,
        mediaUrl: blobUrl,
        message: file.name,
        createdAt: new Date().toISOString()
    };
    const wrapper = document.createElement('div');
    wrapper.id = tempId;
    wrapper.innerHTML = buildMsgHtml(previewMsg, conv);
    msgArea.appendChild(wrapper);
    scrollToBottom();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bookingId', currentBookingId);
    formData.append('role', 2);  // 老師 = 2
    formData.append('message', '');

    try {
        const res = await axios.post(`${API_BASE_URL}/chatMessage/upload`, formData, {
            headers: { 'Authorization': 'Bearer ' + getJwt() }
        });
        const el = document.getElementById(tempId);
        if (el) el.remove();
        appendMessage(res.data);
    } catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.message ?? err.message;
        console.error(`上傳失敗 [${status ?? 'no response'}]`, msg, err);
        const el = document.getElementById(tempId);
        if (el) el.remove();
        msgArea.insertAdjacentHTML('beforeend',
            '<div class="msg-upload-error">⚠️ 檔案上傳失敗，請重試。</div>');
        scrollToBottom();
    } finally {
        URL.revokeObjectURL(blobUrl);
        fileInput.disabled = false;
    }
}

// ── Sidebar 使用者資訊 ────────────────────

function populateSidebarUser() {
    const name = localStorage.getItem('userName');
    if (name) {
        const el = document.getElementById('sidebarName');
        if (el) el.textContent = name;
    }
}

// ── 載入側邊欄頭貼 ──
async function loadSidebarAvatar() {
    if (!tutorId) return;
    try {
        const res = await axios.get(`${API_BASE_URL}/tutor/${tutorId}`, {
            headers: authHeaders()
        });
        const avatarUrl = res.data.avatar;
        const avatarEl = document.getElementById('sidebarAvatar');
        if (avatarEl && avatarUrl) {
            avatarEl.src = convertGoogleDriveUrl(avatarUrl);
        }
    } catch (err) {
        console.error('載入頭貼失敗：', err);
    }
}

// ── 初始化 ────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // 每次頁面載入時重新讀取 userId（確保取到最新值）
    tutorId = localStorage.getItem('userId');

    // 更新 axios 全域 Authorization header（防止模組載入時 token 尚未寫入的極端情況）
    const _jwt = getJwt();
    if (_jwt) {
        axios.defaults.headers.common['Authorization'] = 'Bearer ' + _jwt;
    }

    // 401 = 未認證（token 無效或過期）→ 清除並跳轉登入頁
    // 403 = 已認證但無權限 → 不登出，僅讓個別請求的 catch 處理
    axios.interceptors.response.use(
        res => res,
        err => {
            if (err.response && err.response.status === 401) {
                ['jwt_token', 'userId', 'userRole', 'userName'].forEach(k => localStorage.removeItem(k));
                window.location.href = 'login.html';
            }
            return Promise.reject(err);
        }
    );

    if (!getJwt()) {
        window.location.href = 'login.html';
        return;
    }

    populateSidebarUser();
    loadSidebarAvatar();
    loadConversations();

    document.getElementById('searchInput').addEventListener('input', e => {
        renderChatList(e.target.value);
    });

    document.getElementById('sendBtn').addEventListener('click', sendMessage);

    document.getElementById('msgInput').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    document.querySelector('.attach-btn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });

    document.getElementById('fileInput').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            uploadFile(file);
            e.target.value = '';
        }
    });

    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('確定要登出嗎？')) {
            ['jwt_token', 'userId', 'userRole', 'userName'].forEach(k => localStorage.removeItem(k));
            window.location.href = 'login.html';
        }
    });
});