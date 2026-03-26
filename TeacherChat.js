// ==========================================
// 老師訊息中心邏輯 (TeacherChat.js)
// 串接後端 REST API + WebSocket (STOMP)
// ==========================================

const BASE_URL = '';                         // 相對路徑，走 Vite proxy
const API_BASE_URL = '/api';
const WS_BASE_URL = 'http://localhost:8080'; // WebSocket 需要絕對路徑
const DEFAULT_AVATAR = '/assets/img/teacher.png';

let tutorId = null;

let conversations = [];      // { bookingId (=b.id), studentId, studentName, subject, avatar, lastMessage, time, unread }
let currentBookingId = null;
let stompClient = null;
let stompSubscription = null;

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
        const res = await axios.get(`${API_BASE_URL}/bookings/tutor/${tutorId}`, {
            headers: authHeaders()
        });
        const bookings = res.data;

        // 只顯示非已取消狀態的預約，優先使用 booking 回傳的學生資料
        const active = bookings.filter(b => b.status !== 3);

        const convList = await Promise.all(active.map(async b => {
            const studentId = b.studentId;
            const studentData = {
                name: b.studentName || b.student?.name || b.student?.studentName || '',
                avatar: b.studentAvatar || b.student?.avatar || ''
            };
            const dateVal = Array.isArray(b.date)
                ? `${b.date[0]}-${String(b.date[1]).padStart(2, '0')}-${String(b.date[2]).padStart(2, '0')}`
                : (b.date || '');
            return {
                bookingId: b.id,
                studentId: studentId,
                studentName: studentData.name || studentData.studentName || '學生 #' + studentId,
                subject: b.courseName || '',
                avatar: resolveMediaUrl(convertGoogleDriveUrl(studentData.avatar)),
                lastMessage: '',
                time: dateVal,
                unread: 0
            };
        }));

        // 依 studentId + courseName 分組，同一課程只顯示一個聯絡人
        const groupMap = new Map();
        for (const c of convList) {
            const key = `${c.studentId}::${c.subject}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, { ...c, bookingIds: [c.bookingId] });
            } else {
                const g = groupMap.get(key);
                g.bookingIds.push(c.bookingId);
                if (c.time > g.time) {
                    g.bookingId = c.bookingId;
                    g.time = c.time;
                }
            }
        }
        conversations = [...groupMap.values()].sort((a, b) => (b.time > a.time ? 1 : -1));
        renderChatList();

        const bid = getBookingIdFromQuery();
        if (bid) {
            const conv = conversations.find(c => c.bookingIds.includes(bid));
            if (conv) selectConversation(conv.bookingId);
            else if (conversations.length > 0) selectConversation(conversations[0].bookingId);
        } else if (conversations.length > 0) {
            selectConversation(conversations[0].bookingId);
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
        c.subject.includes(filter)
    );

    list.innerHTML = filtered.map(c => `
        <li class="chat-item ${c.bookingId === currentBookingId ? 'active' : ''}" data-id="${c.bookingId}">
            <div class="contact-avatar-wrap">
                <img src="${c.avatar || DEFAULT_AVATAR}" alt="${escapeHtml(c.studentName)}" class="contact-avatar" onerror="this.onerror=null;this.src='${DEFAULT_AVATAR}';">
            </div>
            <div class="chat-item-body">
                <div class="chat-item-top">
                    <span class="contact-name">${escapeHtml(c.studentName)}</span>
                    <span class="contact-time">${escapeHtml(c.time)}</span>
                </div>
                <div class="chat-item-bottom">
                    <span class="contact-preview">${escapeHtml(c.lastMessage)}</span>
                    ${c.unread > 0 ? `<span class="unread-badge">${c.unread}</span>` : ''}
                </div>
                <span class="subject-tag">${escapeHtml(c.subject)}</span>
            </div>
        </li>
    `).join('');

    list.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            selectConversation(parseInt(item.dataset.id));
        });
    });
}

// ── 渲染訊息 ──────────────────────────────

function buildMsgHtml(m, conv) {
    const isMe = m.role === 'tutor';
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
        const downloadUrl = m.mediaUrl && !m.mediaUrl.startsWith('blob:')
            ? `${API_BASE_URL}/chatMessage/download/${encodeURIComponent(storedName)}?name=${encodeURIComponent(originalName)}`
            : m.mediaUrl;
        content = `<a href="${downloadUrl}" download="${escapeHtml(originalName)}" class="msg-file-link">📎 ${escapeHtml(originalName)}</a>`;
    } else {
        content = escapeHtml(m.message || '');
    }

    if (isMe) {
        return `
            <div class="msg-row student">
                <div class="msg-content">
                    <div class="msg-bubble">${content}</div>
                    <span class="msg-time">${timeStr}</span>
                </div>
            </div>`;
    } else {
        return `
            <div class="msg-row teacher">
                <img src="${conv.avatar}" alt="${escapeHtml(conv.studentName)}" class="msg-row-avatar">
                <div class="msg-content">
                    <div class="msg-bubble">${content}</div>
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
    const conv = conversations.find(c => c.bookingId === currentBookingId);
    if (!conv) return;
    const container = document.getElementById('chatMessages');
    container.insertAdjacentHTML('beforeend', buildMsgHtml(m, conv));
    scrollToBottom();

    conv.lastMessage = m.message || '';
    conv.time = formatTime(m.createdAt);
    renderChatList(document.getElementById('searchInput').value);
}

// ── 選取對話 ──────────────────────────────

async function selectConversation(bookingId) {
    currentBookingId = bookingId;
    const conv = conversations.find(c => c.bookingId === bookingId);
    if (!conv) return;

    // 更新 header
    const headerAvatar = document.getElementById('headerAvatar');
    const headerName = document.getElementById('headerName');
    const headerTag = document.getElementById('headerTag');
    if (headerAvatar) { headerAvatar.src = conv.avatar; headerAvatar.alt = conv.studentName; }
    if (headerName) headerName.textContent = conv.studentName;
    if (headerTag) headerTag.textContent = conv.subject;

    renderChatList(document.getElementById('searchInput').value);

    try {
        const res = await axios.get(`${API_BASE_URL}/chatMessage/booking/${bookingId}`, {
            headers: authHeaders()
        });
        const messages = res.data;
        renderMessages(messages, conv);

        if (messages.length > 0) {
            const last = messages[messages.length - 1];
            conv.lastMessage = last.message || '';
            conv.time = formatTime(last.createdAt);
            renderChatList(document.getElementById('searchInput').value);
        }
    } catch (err) {
        console.error('載入訊息失敗', err);
    }

    connectWebSocket(bookingId);
}

// ── WebSocket / STOMP ─────────────────────

function connectWebSocket(bookingId) {
    if (stompSubscription) {
        stompSubscription.unsubscribe();
        stompSubscription = null;
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
            if (msg.role !== 'tutor') {
                appendMessage(msg);
            }
        }
    );
}

// ── 傳送訊息 ──────────────────────────────

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !currentBookingId) return;

    const payload = {
        bookingId: currentBookingId,
        role: 'tutor',
        messageType: 1,
        message: text,
        mediaUrl: null
    };

    const now = new Date().toISOString();
    appendMessage({ ...payload, createdAt: now });
    input.value = '';

    if (isStompConnected()) {
        if (typeof stompClient.publish === 'function') {
            stompClient.publish({
                destination: `/app/chat/${currentBookingId}`,
                body: JSON.stringify(payload)
            });
        } else {
            stompClient.send(`/app/chat/${currentBookingId}`, {}, JSON.stringify(payload));
        }
    } else {
        try {
            await axios.post(`${API_BASE_URL}/chatMessage`, payload, { headers: authHeaders() });
        } catch (err) {
            console.error('傳送訊息失敗', err);
        }
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
    const conv = conversations.find(c => c.bookingId === currentBookingId);
    const msgArea = document.getElementById('chatMessages');

    const previewMsg = {
        role: 'tutor',
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
    formData.append('role', 'tutor');
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
