// ─── State ──────────────────────────────────────────────────────────
let currentSection = 'home';
let chatInitialized = false;
let chatPollInterval = null;
let chatLastPost = 0;
const CHAT_COOLDOWN = 5000;

let filesInitialized = false;
let messagesCache = null;
let filesCache = null;
let stuffCache = null;
let linksCache = null;


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
            else if (section === 'stuff') loadStuff();
            else if (section === 'links') loadLinks();
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

    prefetch();
});

async function prefetch() {
    try {
        const [msgRes, fileRes, stuffRes, linksRes] = await Promise.all([
            fetch('/api/messages'),
            fetch('/api/files'),
            fetch('/api/stuff'),
            fetch('/api/links')
        ]);
        if (msgRes.ok) messagesCache = await msgRes.json();
        if (fileRes.ok) filesCache = await fileRes.json();
        if (stuffRes.ok) stuffCache = await stuffRes.json();
        if (linksRes.ok) linksCache = await linksRes.json();
    } catch (_) { /* non-critical */ }
}


// ─── Chat ─────────────────────────────────────────────────────────────
function initializeChat() {
    const form = document.getElementById('chat-form');
    const messagesList = document.getElementById('chat-messages');
    if (!form || !messagesList) return;
    if (chatInitialized) return;
    chatInitialized = true;

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
        const name = msg.name ? escapeHtml(msg.name) : 'anon';
        li.innerHTML = `<div class="msg-meta">${name} · ${time}</div><div class="msg-text">${escapeHtml(msg.text)}</div>`;
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

function parseTimestamp(ts) {
    // SQLite CURRENT_TIMESTAMP uses space separator ("2026-03-30 14:23:45"), not ISO 8601.
    // Replace space with T and append Z (UTC) so all browsers parse it correctly.
    return new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z');
}

function formatTime(timestamp) {
    return parseTimestamp(timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp) {
    return parseTimestamp(timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


// ─── Stuff ────────────────────────────────────────────────────────────
async function loadStuff() {
    const stuffList = document.getElementById('stuff-list');
    if (!stuffList) return;

    if (stuffCache) renderStuff(stuffList, stuffCache);

    try {
        const res = await fetch('/api/stuff');
        const items = await res.json();
        stuffCache = items;
        renderStuff(stuffList, items);
    } catch (err) {
        console.error('Error loading stuff:', err);
    }
}

function renderStuff(list, items) {
    list.innerHTML = '';
    if (!items.length) {
        list.innerHTML = '<li>No projects yet</li>';
        return;
    }
    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'stuff-card';
        const thumb = item.thumbnail
            ? `<a href="${escapeHtml(item.url || '#')}" target="_blank"><img class="stuff-thumb" src="/api/stuff/thumbnail/${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}"></a>`
            : '';
        li.innerHTML = thumb
            + `<div class="stuff-info">`
            + `<a href="${escapeHtml(item.url || '#')}" target="_blank">${escapeHtml(item.title)}</a>`
            + `<span>${escapeHtml(item.description)}</span>`
            + `</div>`;
        list.appendChild(li);
    });
}


// ─── Links ────────────────────────────────────────────────────────────
async function loadLinks() {
    const linksList = document.getElementById('links-list');
    if (!linksList) return;

    if (linksCache) renderLinks(linksList, linksCache);

    try {
        const res = await fetch('/api/links');
        const items = await res.json();
        linksCache = items;
        renderLinks(linksList, items);
    } catch (err) {
        console.error('Error loading links:', err);
    }
}

function renderLinks(list, items) {
    list.innerHTML = '';
    if (!items.length) {
        list.innerHTML = '<span>No links yet</span>';
        return;
    }
    items.forEach(item => {
        const line = document.createElement('div');
        line.innerHTML = `<a href="${escapeHtml(item.url)}" target="_blank">${escapeHtml(item.name)}</a>`
            + `<br><span>${escapeHtml(item.description)}</span>`;
        list.appendChild(line);
    });
}


// ─── Files ────────────────────────────────────────────────────────────
function initializeFiles() {
    if (filesInitialized) return;
    filesInitialized = true;
    loadFiles();
}

async function loadFiles() {
    const fileList = document.getElementById('file-list');
    if (!fileList) {
        filesInitialized = false;
        return;
    }

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
        const date = file.uploaded ? `<span class="file-date">${formatDate(file.uploaded)}</span>` : '';
        li.innerHTML = `
            <span class="file-name">${escapeHtml(file.original_name)}</span>
            ${date}
            <span class="file-size">${formatFileSize(file.size)}</span>
            <button class="action-btn" onclick="downloadFile('${escapeHtml(file.filename)}')">⤵️</button>
        `;
        list.appendChild(li);
    });
}

function downloadFile(filename) {
    window.location.href = `/api/files/${encodeURIComponent(filename)}`;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
