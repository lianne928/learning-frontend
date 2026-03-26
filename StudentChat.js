// ==========================================
// 學生訊息中心邏輯 (StudentChat.js)
// 串接後端 REST API + WebSocket (STOMP)
// ==========================================

const BASE_URL = '';                        // 相對路徑，走 Vite proxy
const WS_BASE_URL = 'http://localhost:8080'; // WebSocket 需要絕對路徑

let conversations = [];      // { bookingId (=orderId), bookingRecordId, bookingIds[], bookingRecordIds[], participantId, participantName, avatar, subject, lastMessage, time, unread }
let currentBookingId = null;
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
    if (!url) return 'https://via.placeholder.com/40';
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
}

function getJwt() {
    return localStorage.getItem('jwt_token');
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
    if (!getJwt()) {
        window.location.href = 'login.html';
        return;
    }
    try {
        const res = await axios.get(`${BASE_URL}/api/student/bookings`, {
            headers: authHeaders()
        });
        const bookings = res.data;

        // 只顯示非已取消狀態的預約，並行取老師資訊
        const active = bookings.filter(b => b.status !== 3);
        const tutorCache = {};

        const convList = (await Promise.all(active.map(async b => {
            if (!b.orderId) {
                console.warn('預約缺少 orderId，無法建立聊天對話', b);
                return null;
            }

            const tutorId = b.tutorId;
            if (tutorId && !tutorCache[tutorId]) {
                try {
                    const tr = await axios.get(`${BASE_URL}/api/tutor/${tutorId}`, {
                        headers: authHeaders()
                    });
                    tutorCache[tutorId] = tr.data;
                } catch {
                    tutorCache[tutorId] = { name: '老師', avatar: '' };
                }
            }
            const tutor = tutorId ? (tutorCache[tutorId] || { name: '老師', avatar: '' }) : { name: '老師', avatar: '' };
            return {
                bookingId: b.orderId,
                bookingRecordId: b.id,
                participantId: tutorId,
                participantName: tutor.name || tutor.tutorName || '老師',
                subject: b.courseName || '',
                avatar: resolveMediaUrl(convertGoogleDriveUrl(tutor.avatar)),
                lastMessage: '',
                time: b.date || '',
                unread: 0
            };
        }))).filter(Boolean);

        // 依 participantId + courseName 分組，同一課程只顯示一個聯絡人
        const groupMap = new Map();
        for (const c of convList) {
            const key = `${c.participantId}::${c.subject}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, {
                    ...c,
                    bookingIds: [c.bookingId],
                    bookingRecordIds: [c.bookingRecordId]
                });
            } else {
                const g = groupMap.get(key);
                g.bookingIds.push(c.bookingId);
                g.bookingRecordIds.push(c.bookingRecordId);
                if (c.time > g.time) {
                    g.bookingId = c.bookingId;
                    g.bookingRecordId = c.bookingRecordId;
                    g.time = c.time;
                }
            }
        }
        conversations = [...groupMap.values()].sort((a, b) => (b.time > a.time ? 1 : -1));
        renderChatList();

        const bid = getBookingIdFromQuery();
        if (bid) {
            const conv = conversations.find(c =>
                c.bookingIds.includes(bid) || c.bookingRecordIds.includes(bid)
            );
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
        c.participantName.toLowerCase().includes(filter.toLowerCase()) ||
        c.subject.includes(filter)
    );

    list.innerHTML = filtered.map(c => `
        <li class="chat-item ${c.bookingId === currentBookingId ? 'active' : ''}" data-id="${c.bookingId}">
            <div class="contact-avatar-wrap">
                <img src="${c.avatar}" alt="${escapeHtml(c.participantName)}" class="contact-avatar">
            </div>
            <div class="chat-item-body">
                <div class="chat-item-top">
                    <span class="contact-name">${escapeHtml(c.participantName)}</span>
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
    const isMe = m.role === 'student';
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
            ? `${BASE_URL}/api/chatMessage/download/${encodeURIComponent(storedName)}?name=${encodeURIComponent(originalName)}`
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
                <img src="${conv.avatar}" alt="${escapeHtml(conv.participantName)}" class="msg-row-avatar">
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
    if (headerAvatar) { headerAvatar.src = conv.avatar; headerAvatar.alt = conv.participantName; }
    if (headerName) headerName.textContent = conv.participantName;
    if (headerTag) headerTag.textContent = conv.subject;

    renderChatList(document.getElementById('searchInput').value);

    try {
        const res = await axios.get(`${BASE_URL}/api/chatMessage/booking/${bookingId}`, {
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

    if (stompErrorSubscription) {
        stompErrorSubscription.unsubscribe();
        stompErrorSubscription = null;
    }

    if (stompClient && stompClient.active) {
        subscribeBooking(bookingId);
        return;
    }

    if (stompClient) {
        try { stompClient.deactivate(); } catch { }
    }

    const jwt = getJwt();
    stompClient = new StompJs.Client({
        webSocketFactory: () => new SockJS(`${WS_BASE_URL}/ws`),
        connectHeaders: { Authorization: 'Bearer ' + jwt },
        reconnectDelay: 5000,
        onConnect: () => subscribeBooking(bookingId),
        onStompError: err => console.error('WebSocket 連線失敗', err)
    });
    stompClient.activate();
}

function subscribeBooking(bookingId) {
    stompSubscription = stompClient.subscribe(
        `/topic/room/${bookingId}/chat`,
        frame => {
            const msg = JSON.parse(frame.body);
            // 避免重複顯示自己送出的訊息
            if (msg.role !== 'student') {
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
    if (!text || !currentBookingId) return;

    const payload = {
        bookingId: currentBookingId,
        role: 'student',
        messageType: 1,
        message: text,
        mediaUrl: null
    };

    const now = new Date().toISOString();
    appendMessage({ ...payload, createdAt: now });
    input.value = '';

    if (stompClient && stompClient.connected) {
        stompClient.send(`/app/chat/${currentBookingId}`, {}, JSON.stringify(payload));
    } else {
        try {
            await axios.post(`${BASE_URL}/api/chatMessage`, payload, { headers: authHeaders() });
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
        role: 'student',
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
    formData.append('role', 'student');
    formData.append('message', '');

    try {
        const res = await axios.post(`${BASE_URL}/api/chatMessage/upload`, formData, {
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
    // 401/403 自動跳轉登入頁
    axios.interceptors.response.use(
        res => res,
        err => {
            if (err.response && (err.response.status === 401 || err.response.status === 403)) {
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
