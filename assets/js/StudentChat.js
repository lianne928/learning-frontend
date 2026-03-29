// ==========================================
// 學生訊息中心 - 純 HTTP 版本（最終版）
// 移除所有 WebSocket 相關代碼
// ==========================================

const BASE_URL = '';

let conversations = [];
let currentBookingId = null;

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
        const res = await axios.get(`${BASE_URL}/api/chatMessage/conversations`, {
            headers: authHeaders()
        });

        const raw = res.data || [];

        conversations = raw.map(item => ({
            bookingId: item.orderId,
            bookingRecordId: item.bookingRecordId,
            bookingIds: item.bookingIds || [],
            bookingRecordIds: item.bookingRecordIds || [],
            participantId: item.participantId,
            participantName: item.participantName || '未命名',
            avatar: convertGoogleDriveUrl(item.avatar),
            subject: item.subject || '',
            lastMessage: item.lastMessage || '',
            time: formatTime(item.lastMessageTime),
            unread: item.unread || 0
        }));

        renderChatList('');

        const targetId = getBookingIdFromQuery();
        if (targetId) {
            selectConversation(targetId);
        } else if (conversations.length > 0) {
            selectConversation(conversations[0].bookingId);
        }
    } catch (err) {
        console.error('載入對話列表失敗', err);
        if (err.response?.status === 401) {
            localStorage.clear();
            window.location.href = 'login.html';
        }
    }
}

// ── 渲染對話列表 ──────────────────────────

function renderChatList(keyword) {
    const list = document.getElementById('chatList');
    if (!list) return;

    const filtered = keyword.trim()
        ? conversations.filter(c =>
            (c.participantName || '').toLowerCase().includes(keyword.toLowerCase()) ||
            (c.subject || '').toLowerCase().includes(keyword.toLowerCase())
        )
        : conversations;

    if (filtered.length === 0) {
        list.innerHTML = '<li class="empty-state">沒有對話</li>';
        return;
    }

    list.innerHTML = filtered.map(c => `
        <li class="chat-item ${c.bookingId === currentBookingId ? 'active' : ''}" data-id="${c.bookingId}">
            <div class="chat-item-avatar">
                <img src="${c.avatar}" alt="${escapeHtml(c.participantName)}">
            </div>
            <div class="chat-item-content">
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
    const isMe = m.role === 1;
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

    const headerAvatar = document.getElementById('headerAvatar');
    const headerName = document.getElementById('headerName');
    const headerTag = document.getElementById('headerTag');
    if (headerAvatar) { headerAvatar.src = conv.avatar; headerAvatar.alt = conv.participantName; }
    if (headerName) headerName.textContent = conv.participantName;
    if (headerTag) headerTag.textContent = conv.subject;

    renderChatList(document.getElementById('searchInput').value);

    try {
        let messages = [];
        
        if (conv.bookingIds && conv.bookingIds.length > 0) {
            const orderIdsParam = conv.bookingIds.join(',');
            const res = await axios.get(`${BASE_URL}/api/chatMessage/orders?ids=${orderIdsParam}`, {
                headers: authHeaders()
            });
            messages = res.data || [];
        } else {
            const res = await axios.get(`${BASE_URL}/api/chatMessage/booking/${bookingId}`, {
                headers: authHeaders()
            });
            messages = res.data || [];
        }
        
        renderMessages(messages, conv);
        conv.unread = 0;
        renderChatList(document.getElementById('searchInput').value);
    } catch (err) {
        console.error('載入訊息失敗', err);
    }
}

// ── 傳送訊息（純 HTTP）──────────────────────────────

async function sendMessage() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !currentBookingId) return;

    const conv = conversations.find(c => c.bookingId === currentBookingId);
    if (!conv) return;

    const actualBookingId = (conv.bookingIds && conv.bookingIds.length > 0) 
        ? conv.bookingIds[conv.bookingIds.length - 1]
        : currentBookingId;

    const payload = {
        bookingId: actualBookingId,
        role: 1,
        messageType: 1,
        message: text,
        mediaUrl: null
    };

    const now = new Date().toISOString();
    appendMessage({ ...payload, createdAt: now });
    input.value = '';

    try {
        await axios.post(`${BASE_URL}/api/chatMessage`, payload, { 
            headers: authHeaders() 
        });
    } catch (err) {
        console.error('傳送訊息失敗', err);
        alert('傳送失敗：' + (err.response?.data?.message || err.message));
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

    const conv = conversations.find(c => c.bookingId === currentBookingId);
    if (!conv) return;

    const actualBookingId = (conv.bookingIds && conv.bookingIds.length > 0) 
        ? conv.bookingIds[conv.bookingIds.length - 1]
        : currentBookingId;

    const fileInput = document.getElementById('fileInput');
    fileInput.disabled = true;

    const localType = detectLocalType(file);
    const blobUrl = URL.createObjectURL(file);
    const tempId = 'upload-preview-' + Date.now();
    const msgArea = document.getElementById('chatMessages');

    const previewMsg = {
        role: 1,
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
    formData.append('bookingId', actualBookingId);
    formData.append('role', 1);
    formData.append('message', '');

    try {
        const res = await axios.post(`${BASE_URL}/api/chatMessage/upload`, formData, {
            headers: { 'Authorization': 'Bearer ' + getJwt() }
        });

        const msg = res.data;
        const tempDiv = document.getElementById(tempId);
        if (tempDiv) tempDiv.remove();

        appendMessage(msg);
        fileInput.value = '';
        fileInput.disabled = false;
    } catch (err) {
        console.error('上傳失敗', err);
        alert('上傳失敗，請重試。');
        const tempDiv = document.getElementById(tempId);
        if (tempDiv) tempDiv.remove();
        fileInput.disabled = false;
    }
}

// ── 初始化 ──────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    loadConversations();

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderChatList(e.target.value);
        });
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    const msgInput = document.getElementById('msgInput');
    if (msgInput) {
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) uploadFile(file);
        });
    }
});