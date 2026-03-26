// ==========================================
// 學生訊息中心邏輯 (student-messages.js)
// ==========================================

const BASE_URL = '';                        // 相對路徑，走 Vite proxy
const WS_BASE_URL = 'http://localhost:8080'; // WebSocket 需要絕對路徑

let conversations = [];      // { bookingId（最新，用於送訊息/WS）, bookingIds[], tutorId, tutorName, subject, avatar, lastMessage, time, unread }
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

async function downloadFile(storedName, originalName) {
    try {
        const res = await axios.get(
            `${BASE_URL}/api/chatMessage/download/${storedName}?name=${encodeURIComponent(originalName)}`,
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
};

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
        const res = await axios.get(`${BASE_URL}/api/student/bookings`, {
            headers: authHeaders()
        });
        const bookings = res.data;

        // 只顯示 status=1（已排課）的預約，並行取老師資訊
        const active = bookings.filter(b => b.status !== 3);
        const tutorCache = {};

        const convList = await Promise.all(active.map(async b => {
            if (!tutorCache[b.tutorId]) {
                try {
                    const tr = await axios.get(`${BASE_URL}/api/tutor/${b.tutorId}`, {
                        headers: authHeaders()
                    });
                    tutorCache[b.tutorId] = tr.data;
                } catch {
                    tutorCache[b.tutorId] = { name: '老師', avatar: '' };
                }
            }
            const tutor = tutorCache[b.tutorId];
            return {
                bookingId: b.orderId,
                tutorId: b.tutorId,
                tutorName: tutor.name || '老師',
                subject: b.courseName || '',
                avatar: resolveMediaUrl(convertGoogleDriveUrl(tutor.avatar)),
                lastMessage: '',
                time: b.date || '',
                unread: 0
            };
        }));

        // 依 tutorId + courseName 分組，同一課程只顯示一個聯絡人
        const groupMap = new Map();
        for (const c of convList) {
            const key = `${c.tutorId}::${c.subject}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, { ...c, bookingIds: [c.bookingId] });
            } else {
                const g = groupMap.get(key);
                g.bookingIds.push(c.bookingId);
                // 保留最新日期的 bookingId 作為 active（用於送訊息）
                if (c.time > g.time) {
                    g.bookingId = c.bookingId;
                    g.time = c.time;
                }
            }
        }
        conversations = [...groupMap.values()].sort((a, b) => (b.time > a.time ? 1 : -1));
        renderContactList();

        // URL 帶的 bookingId 可能是群組內任一 booking → 找對應群組
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
    const filtered = mockConversations.filter(c =>
        c.teacherName.toLowerCase().includes(filter.toLowerCase()) ||
        c.subject.includes(filter)
    );

    list.innerHTML = filtered.map(c => `
        <div class="contact-item ${c.id === currentConvId ? 'active' : ''}" data-id="${c.id}" onclick="selectConversation(${c.id})">
            <div class="contact-avatar-wrap">
                <img src="${c.avatar}" alt="${c.teacherName}" class="contact-avatar">
                <span class="contact-status-dot"></span>
            </div>
            <div class="contact-info">
                <div class="contact-top">
                    <span class="contact-name">${c.teacherName}</span>
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

function renderChatWindow(convId) {
    const conv = mockConversations.find(c => c.id === convId);
    if (!conv) return;

    // Header
    document.getElementById('chat-teacher-avatar').src = conv.avatar;
    document.getElementById('chat-teacher-name').textContent = conv.teacherName;
    document.getElementById('chat-subject-tag').textContent = conv.subject;

    // Messages
    const msgArea = document.getElementById('chat-messages');
    msgArea.innerHTML = messages.map(m => buildMsgHtml(m, conv)).join('');
    msgArea.scrollTop = msgArea.scrollHeight;

    conv.unread = 0;
    renderContactList(document.getElementById('search-input').value);
}

function buildMsgHtml(m, conv) {
    const isMe = m.role === 'student';
    const timeStr = formatTime(m.createdAt);
    let content = '';

    if (m.messageType === 4 || m.messageType === 3 || m.messageType === 5 || m.messageType === 6) {
        // 媒體訊息
        if (m.messageType === 4) {
            content = `<img src="${resolveMediaUrl(m.mediaUrl)}" style="max-width:200px;border-radius:8px;" alt="圖片">`;
        } else if (m.messageType === 5) {
            content = `<video src="${resolveMediaUrl(m.mediaUrl)}" controls style="max-width:240px;border-radius:8px;"></video>`;
        } else if (m.messageType === 3) {
            content = `<audio src="${resolveMediaUrl(m.mediaUrl)}" controls></audio>`;
        } else {
            const storedName   = m.mediaUrl ? m.mediaUrl.split('/').pop() : '';
            const originalName = m.message || storedName || '下載檔案';
            if (m.mediaUrl && !m.mediaUrl.startsWith('blob:')) {
                content = `<button class="msg-file-link" onclick="downloadFile('${encodeURIComponent(storedName)}','${escapeHtml(originalName).replace(/'/g, "\\'")}')">📎 ${escapeHtml(originalName)}</button>`;
            } else {
                content = `<a href="${m.mediaUrl}" download="${escapeHtml(originalName)}" class="msg-file-link">📎 ${escapeHtml(originalName)}</a>`;
            }
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
    `.join('');

    // Clear unread
    conv.unread = 0;

    // Scroll to bottom
    msgArea.scrollTop = msgArea.scrollHeight;
}

function selectConversation(id) {
    currentConvId = id;
    renderContactList(document.getElementById('search-input').value);
    renderChatWindow(id);

    // On mobile, show chat panel
    document.getElementById('chat-panel').classList.add('chat-panel--visible');
    document.getElementById('contacts-panel').classList.add('contacts-panel--hidden');
}

// ── WebSocket / STOMP ─────────────────────

function connectWebSocket(bookingId) {
    // 斷開舊的訂閱
    if (stompSubscription) {
        stompSubscription.unsubscribe();
        stompSubscription = null;
    }

    if (stompClient && stompClient.connected) {
        subscribeBooking(bookingId);
        return;
    }

    // 建立新連線
    if (stompClient) {
        try { stompClient.disconnect(); } catch { }
    }

    const socket = new SockJS(`${WS_BASE_URL}/ws`);
    stompClient = Stomp.over(socket);
    stompClient.debug = null; // 關閉 debug log

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
            // 避免重複顯示自己送出的訊息（透過 STOMP 送的）
            if (msg.role !== 'student') {
                appendMessage(msg);
            }
        }
    );
}

// ── 傳送訊息 ──────────────────────────────

async function sendMessage() {
    const input = document.getElementById('msg-input');
    const text = input.value.trim();
    if (!text) return;

    const conv = mockConversations.find(c => c.id === currentConvId);
    if (!conv) return;

    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    conv.messages.push({ from: 'me', text, time });
    conv.lastMessage = text;
    conv.time = time;

    input.value = '';
    renderContactList(document.getElementById('search-input').value);
    renderChatWindow(currentConvId);
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

    // ① 本地 Blob 即時預覽
    const localType = detectLocalType(file);
    const blobUrl   = URL.createObjectURL(file);
    const tempId    = 'upload-preview-' + Date.now();
    const conv      = conversations.find(c => c.bookingId === currentBookingId);
    const msgArea   = document.getElementById('chat-messages');

    const previewMsg = { role: 'student', messageType: localType,
                         mediaUrl: blobUrl, message: file.name,
                         createdAt: new Date().toISOString() };
    const wrapper = document.createElement('div');
    wrapper.id = tempId;
    wrapper.innerHTML = buildMsgHtml(previewMsg, conv);
    msgArea.appendChild(wrapper);
    msgArea.scrollTop = msgArea.scrollHeight;

    // ② FormData 上傳
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bookingId', currentBookingId);
    formData.append('role', 'student');
    formData.append('message', '');

    try {
        const res = await axios.post(`${BASE_URL}/api/chatMessage/upload`, formData, {
            headers: { 'Authorization': 'Bearer ' + getJwt() }
        });
        // ③ 以伺服器真實訊息取代預覽
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
    // JWT 過期或無權限 → 自動導回登入頁
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

    // Search
    document.getElementById('search-input').addEventListener('input', e => {
        renderContactList(e.target.value);
    });

    // Send on Enter (Shift+Enter = newline)
    document.getElementById('msg-input').addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Back button (mobile)
    const backBtn = document.getElementById('chat-back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('chat-panel').classList.remove('chat-panel--visible');
            document.getElementById('contacts-panel').classList.remove('contacts-panel--hidden');
        });
    }
});
