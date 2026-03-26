// ─── State ──────────────────────────────────────────────────────────
let currentSection = 'home';
let chatInitialized = false;
let chatPollInterval = null;
let chatLastPost = 0;
const CHAT_COOLDOWN = 5000;

let filesInitialized = false;
let messagesCache = null;
let filesCache = null;


// ─── Dark Mode ───────────────────────────────────────────────────────
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('darkmode-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function toggleDarkMode() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
}


// ─── Nav Indicator ───────────────────────────────────────────────────
function updateNavIndicator(section) {
    const dot = document.getElementById('nav-dot');
    if (!dot) return;

    const link = document.querySelector(`nav a[href="#${section}"]`);
    if (!link) {
        dot.style.opacity = '0';
        return;
    }

    const header = document.querySelector('header');
    const headerRect = header.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();

    dot.style.left = (linkRect.left - headerRect.left + linkRect.width / 2 - 3) + 'px';
    dot.style.opacity = '1';
}


// ─── Navigation ──────────────────────────────────────────────────────
function showSection(section) {
    // Clean up previous section state
    if (section !== 'chat' && chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
        chatInitialized = false;
    }
    if (section !== 'files') filesInitialized = false;

    currentSection = section;
    updateNavIndicator(section);

    fetch(`${section}.html`)
        .then(r => r.text())
        .then(html => {
            document.getElementById('main-content').innerHTML = html;
            if (section === 'chat') initializeChat();
            else if (section === 'files') initializeFiles();
        })
        .catch(err => console.error('Error loading section:', err));
}

document.addEventListener('DOMContentLoaded', function () {
    applyTheme(localStorage.getItem('theme') || 'light');

    document.getElementById('darkmode-toggle')
        .addEventListener('click', toggleDarkMode);

    const hash = window.location.hash.substring(1);
    showSection(hash || 'home');

    document.querySelectorAll('nav ul li a').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const target = this.getAttribute('href').substring(1);
            window.location.hash = target;
            showSection(target);
        });
    });

    window.addEventListener('hashchange', function () {
        const target = window.location.hash.substring(1);
        if (target && target !== currentSection) showSection(target);
    });

    window.addEventListener('resize', () => updateNavIndicator(currentSection));

    // Background prefetch for snappier section loads
    prefetch();
});

async function prefetch() {
    try {
        const [msgRes, fileRes] = await Promise.all([
            fetch('/api/messages'),
            fetch('/api/files')
        ]);
        if (msgRes.ok) messagesCache = await msgRes.json();
        if (fileRes.ok) filesCache = await fileRes.json();
    } catch (_) { /* non-critical */ }
}


// ─── Chat ─────────────────────────────────────────────────────────────
function initializeChat() {
    const form = document.getElementById('chat-form');
    const messagesList = document.getElementById('chat-messages');
    if (!form || !messagesList) return;
    if (chatInitialized) return;
    chatInitialized = true;

    // Restore saved name
    const nameInput = document.getElementById('chat-name');
    if (nameInput) {
        nameInput.value = localStorage.getItem('chatName') || '';
        nameInput.addEventListener('change', () => {
            localStorage.setItem('chatName', nameInput.value.trim());
        });
    }

    loadMessages();
    chatPollInterval = setInterval(loadMessages, 3000);

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const messageInput = document.getElementById('message');
        const text = messageInput.value.trim();
        if (!text) return;

        const wait = CHAT_COOLDOWN - (Date.now() - chatLastPost);
        if (wait > 0) {
            showChatStatus(`Please wait ${Math.ceil(wait / 1000)}s...`);
            return;
        }

        const name = (document.getElementById('chat-name')?.value || '').trim();
        try {
            const res = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, ...(name && { name }) })
            });
            if (res.ok) {
                messageInput.value = '';
                chatLastPost = Date.now();
                loadMessages();
            }
        } catch (err) {
            console.error('Error posting message:', err);
        }
    });
}

async function loadMessages() {
    const messagesList = document.getElementById('chat-messages');
    if (!messagesList) {
        if (chatPollInterval) {
            clearInterval(chatPollInterval);
            chatPollInterval = null;
            chatInitialized = false;
        }
        return;
    }

    // Show cache instantly while fetching fresh data
    if (messagesCache) renderMessages(messagesList, messagesCache);

    try {
        const res = await fetch('/api/messages');
        const messages = await res.json();
        messagesCache = messages;
        renderMessages(messagesList, messages);
    } catch (err) {
        console.error('Error loading messages:', err);
    }
}

function renderMessages(list, messages) {
    const atBottom = list.scrollHeight - list.scrollTop <= list.clientHeight + 10;
    list.innerHTML = '';
    messages.forEach(msg => {
        const li = document.createElement('li');
        const time = formatTime(msg.timestamp);
        const name = msg.name ? `<em>${escapeHtml(msg.name)}</em> ` : '';
        li.innerHTML = `<strong>${time} &gt;</strong> ${name}${escapeHtml(msg.text)}`;
        list.appendChild(li);
    });
    if (atBottom) list.scrollTop = list.scrollHeight;
}

function showChatStatus(msg) {
    const el = document.getElementById('chat-status');
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 3000);
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// ─── Files ────────────────────────────────────────────────────────────
function getUploadPassword() {
    let pwd = localStorage.getItem('uploadPassword');
    if (pwd === null) {
        const input = prompt('Upload password (leave blank if none):');
        if (input === null) return null; // cancelled
        pwd = input.trim();
        localStorage.setItem('uploadPassword', pwd);
    }
    return pwd;
}

function initializeFiles() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput || filesInitialized) return;
    filesInitialized = true;

    loadFiles();

    fileInput.addEventListener('change', async (e) => {
        const pwd = getUploadPassword();
        if (pwd === null) return; // user cancelled prompt

        for (const file of e.target.files) {
            const ok = await uploadFile(file, pwd);
            if (!ok) break;
        }
        fileInput.value = '';
        loadFiles();
    });
}

async function loadFiles() {
    const fileList = document.getElementById('file-list');
    if (!fileList) {
        filesInitialized = false;
        return;
    }

    // Show cache instantly while fetching fresh data
    if (filesCache) renderFiles(fileList, filesCache);

    try {
        const res = await fetch('/api/files');
        const files = await res.json();
        filesCache = files;
        renderFiles(fileList, files);
    } catch (err) {
        console.error('Error loading files:', err);
    }
}

function renderFiles(list, files) {
    list.innerHTML = '';
    if (files.length === 0) {
        list.innerHTML = '<li class="no-files">No files uploaded</li>';
        return;
    }
    files.forEach(file => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="file-name">${escapeHtml(file.original_name)}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <button class="action-btn" onclick="downloadFile('${file.filename}')">⤵️</button>
            <button class="action-btn" onclick="deleteFile('${file.filename}')">❌</button>
        `;
        list.appendChild(li);
    });
}

function uploadFile(file, password) {
    return new Promise((resolve) => {
        const formData = new FormData();
        formData.append('file', file);

        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                updateProgress(file.name, Math.round((e.loaded / e.total) * 100));
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status === 401 || xhr.status === 403) {
                localStorage.removeItem('uploadPassword');
                alert('Upload denied: incorrect password.');
                resolve(false);
            } else {
                updateProgress(file.name, 100);
                resolve(xhr.status >= 200 && xhr.status < 300);
            }
        });

        xhr.addEventListener('error', () => resolve(false));

        xhr.open('POST', '/api/files');
        xhr.setRequestHeader('X-Upload-Password', password || '');
        xhr.send(formData);
    });
}

function updateProgress(filename, pct) {
    const container = document.getElementById('upload-progress');
    if (!container) return;
    container.style.display = 'block';
    container.innerHTML = `
        <div>${escapeHtml(filename)} — ${pct}%</div>
        <div class="upload-progress-bar-bg">
            <div class="upload-progress-bar" style="width:${pct}%"></div>
        </div>`;
    if (pct >= 100) {
        setTimeout(() => { container.style.display = 'none'; }, 1200);
    }
}

function downloadFile(filename) {
    window.location.href = `/api/files/${encodeURIComponent(filename)}`;
}

async function deleteFile(filename) {
    if (!confirm('Delete this file?')) return;
    try {
        const res = await fetch(`/api/files/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        if (res.ok) loadFiles();
    } catch (err) {
        console.error('Delete error:', err);
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
