// ==========================================
// 老師訊息中心邏輯 (teacher-messages.js)
// 串接後端 REST API + WebSocket (STOMP)
// ==========================================

const BASE_URL = '';                        // 相對路徑，走 Vite proxy
const WS_BASE_URL = 'http://localhost:8080'; // WebSocket 需要絕對路徑

let conversations = [];      // { bookingId, bookingIds[], studentId, studentName, subject, avatar, lastMessage, time, unread }
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

// ── 載入對話列表 ──────────────────────────

async function loadConversations() {
    if (!getJwt()) {
        console.warn('尚未登入，取消載入對話列表');
        return;
    }
    try {
        const res = await axios.get(`${BASE_URL}/api/tutor/bookings`, {
            headers: authHeaders()
        });
        const bookings = res.data;

        // 只顯示非已取消狀態的預約，並行取學生資訊
        const active = bookings.filter(b => b.status !== 3);
        const studentCache = {};

        const convList = await Promise.all(active.map(async b => {
            const studentId = b.studentId;
            if (studentId && !studentCache[studentId]) {
                try {
                    const sr = await axios.get(`${BASE_URL}/api/student/${studentId}`, {
                        headers: authHeaders()
                    });
                    studentCache[studentId] = sr.data;
                } catch {
                    studentCache[studentId] = { name: '學生', avatar: '' };
                }
            }
            const student = studentId ? (studentCache[studentId] || { name: '學生', avatar: '' }) : { name: '學生', avatar: '' };
            return {
                bookingId: b.orderId,
                studentId: studentId,
                studentName: student.name || student.studentName || '學生',
                subject: b.courseName || '',
                avatar: resolveMediaUrl(convertGoogleDriveUrl(student.avatar)),
                lastMessage: '',
                time: b.date || '',
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
        renderContactList();

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

// ── 渲染聯絡人列表 ────────────────────────

function renderContactList(filter = '') {
    const list = document.getElementById('contact-list');
    const filtered = conversations.filter(c =>
        c.studentName.toLowerCase().includes(filter.toLowerCase()) ||
        c.subject.includes(filter)
    );

    list.innerHTML = filtered.map(c => `
        <div class="contact-item ${c.bookingId === currentBookingId ? 'active' : ''}" data-id="${c.bookingId}" onclick="selectConversation(${c.bookingId})">
            <div class="contact-avatar-wrap">
                <img src="${c.avatar}" alt="${c.studentName}" class="contact-avatar">
                <span class="contact-status-dot"></span>
            </div>
            <div class="contact-info">
                <div class="contact-top">
                    <span class="contact-name">${c.studentName}</span>
                    <span class="contact-time">${c.time}</span>
                </div>
                <div class="contact-bottom">
                    <span class="contact-last">${c.lastMessage}</span>
                    ${c.unread > 0 ? `<span class="contact-badge">${c.unread}</span>` : ''}
                </div>
                <div class="contact-subject">${c.subject}</div>
            </div>
        </div>
    `).join('');
}

// ── 渲染聊天視窗 ──────────────────────────

function renderChatWindow(conv, messages) {
    document.getElementById('chat-student-avatar').src = conv.avatar;
    document.getElementById('chat-student-name').textContent = conv.studentName;
    document.getElementById('chat-subject-tag').textContent = conv.subject;

    const msgArea = document.getElementById('chat-messages');
    msgArea.innerHTML = messages.map(m => buildMsgHtml(m, conv)).join('');
    msgArea.scrollTop = msgArea.scrollHeight;

    conv.unread = 0;
    renderContactList(document.getElementById('search-input').value);
}

function buildMsgHtml(m, conv) {
    const isMe = m.role === 'tutor';
    const timeStr = formatTime(m.createdAt);
    let content = '';

    if (m.messageType === 4 || m.messageType === 3 || m.messageType === 5 || m.messageType === 6) {
        if (m.messageType === 4) {
            content = `<img src="${resolveMediaUrl(m.mediaUrl)}" style="max-width:200px;border-radius:8px;" alt="圖片">`;
        } else if (m.messageType === 5) {
            content = `<video src="${resolveMediaUrl(m.mediaUrl)}" controls style="max-width:240px;border-radius:8px;"></video>`;
        } else if (m.messageType === 3) {
            content = `<audio src="${resolveMediaUrl(m.mediaUrl)}" controls></audio>`;
        } else {
            const storedName   = m.mediaUrl ? m.mediaUrl.split('/').pop() : '';
            const originalName = m.message || storedName || '下載檔案';
            const downloadUrl  = m.mediaUrl && !m.mediaUrl.startsWith('blob:')
                ? `${BASE_URL}/api/chatMessage/download/${encodeURIComponent(storedName)}?name=${encodeURIComponent(originalName)}`
                : m.mediaUrl;
            content = `<a href="${downloadUrl}" download="${escapeHtml(originalName)}" class="msg-file-link">📎 ${escapeHtml(originalName)}</a>`;
        }
    } else {
        content = escapeHtml(m.message || '');
    }

    return `
        <div class="msg-row ${isMe ? 'msg-row--me' : 'msg-row--teacher'}">
            ${!isMe ? `<img src="${conv.avatar}" class="msg-avatar" alt="">` : ''}
            <div class="msg-bubble ${isMe ? 'msg-bubble--me' : 'msg-bubble--teacher'}">
                ${content}
                <div class="msg-time">${timeStr}</div>
            </div>
        </div>
    `;
}

function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function appendMessage(m) {
    const conv = conversations.find(c => c.bookingId === currentBookingId);
    if (!conv) return;
    const msgArea = document.getElementById('chat-messages');
    msgArea.insertAdjacentHTML('beforeend', buildMsgHtml(m, conv));
    msgArea.scrollTop = msgArea.scrollHeight;

    conv.lastMessage = m.message || '';
    conv.time = formatTime(m.createdAt);
    renderContactList(document.getElementById('search-input').value);
}

// ── 選取對話 ──────────────────────────────

async function selectConversation(bookingId) {
    currentBookingId = bookingId;
    const conv = conversations.find(c => c.bookingId === bookingId);
    if (!conv) return;

    document.getElementById('chat-panel').classList.add('chat-panel--visible');
    document.getElementById('contacts-panel').classList.add('contacts-panel--hidden');

    try {
        const res = await axios.get(`${BASE_URL}/api/chatMessage/booking/${bookingId}`, {
            headers: authHeaders()
        });
        const messages = res.data;
        renderChatWindow(conv, messages);

        if (messages.length > 0) {
            const last = messages[messages.length - 1];
            conv.lastMessage = last.message || '';
            conv.time = formatTime(last.createdAt);
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

    if (stompClient && stompClient.connected) {
        subscribeBooking(bookingId);
        return;
    }

    if (stompClient) {
        try { stompClient.disconnect(); } catch { }
    }

    const socket = new SockJS(`${WS_BASE_URL}/ws`);
    stompClient = Stomp.over(socket);
    stompClient.debug = null;

    const jwt = getJwt();
    stompClient.connect(
        { Authorization: 'Bearer ' + jwt },
        () => subscribeBooking(bookingId),
        err => console.error('WebSocket 連線失敗', err)
    );
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
    const input = document.getElementById('msg-input');
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

    const fileInput = document.getElementById('file-input');
    fileInput.disabled = true;

    const localType = detectLocalType(file);
    const blobUrl   = URL.createObjectURL(file);
    const tempId    = 'upload-preview-' + Date.now();
    const conv      = conversations.find(c => c.bookingId === currentBookingId);
    const msgArea   = document.getElementById('chat-messages');

    const previewMsg = { role: 'tutor', messageType: localType,
                         mediaUrl: blobUrl, message: file.name,
                         createdAt: new Date().toISOString() };
    const wrapper = document.createElement('div');
    wrapper.id = tempId;
    wrapper.innerHTML = buildMsgHtml(previewMsg, conv);
    msgArea.appendChild(wrapper);
    msgArea.scrollTop = msgArea.scrollHeight;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('bookingId', currentBookingId);
    formData.append('role', 'tutor');
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
        const msg    = err.response?.data?.message ?? err.message;
        console.error(`上傳失敗 [${status ?? 'no response'}]`, msg, err);
        const el = document.getElementById(tempId);
        if (el) el.remove();
        msgArea.insertAdjacentHTML('beforeend',
            '<div class="msg-upload-error">⚠️ 檔案上傳失敗，請重試。</div>');
        msgArea.scrollTop = msgArea.scrollHeight;
    } finally {
        URL.revokeObjectURL(blobUrl);
        fileInput.disabled = false;
    }
}

// ── 初始化 ────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
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

    loadConversations();

    document.getElementById('search-input').addEventListener('input', e => {
        renderContactList(e.target.value);
    });

    document.getElementById('msg-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    document.getElementById('file-input').addEventListener('change', e => {
        const file = e.target.files[0];
        if (file) {
            uploadFile(file);
            e.target.value = '';
        }
    });

    const backBtn = document.getElementById('chat-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('chat-panel').classList.remove('chat-panel--visible');
            document.getElementById('contacts-panel').classList.remove('contacts-panel--hidden');
        });
    }
});
