// Section navigation
function showSection(section) {
    fetch(`${section}.html`)
        .then(response => response.text())
        .then(data => {
            document.getElementById('main-content').innerHTML = data;
            if (section === 'chat') {
                initializeChat();
            } else if (section === 'files') {
                initializeFiles();
            }
        })
        .catch(error => console.error('Error loading section:', error));
}

// Hash-based navigation
document.addEventListener('DOMContentLoaded', function() {
    const links = document.querySelectorAll('nav ul li a');

    const currentHash = window.location.hash.substring(1);
    showSection(currentHash || 'home');

    links.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            window.location.hash = targetId;
            showSection(targetId);
        });
    });

    window.addEventListener('hashchange', function() {
        const targetId = window.location.hash.substring(1);
        showSection(targetId);
    });
});

// Chat functionality (local API)
let chatInitialized = false;
let chatPollInterval = null;

function initializeChat() {
    const form = document.getElementById('chat-form');
    const messagesList = document.getElementById('chat-messages');

    if (!form || !messagesList) return;
    if (chatInitialized) return;
    chatInitialized = true;

    // Load messages
    loadMessages();

    // Poll for new messages every 3 seconds
    chatPollInterval = setInterval(loadMessages, 3000);

    // Handle form submission
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const messageInput = document.getElementById('message');
        const messageText = messageInput.value.trim();

        if (messageText) {
            try {
                const response = await fetch('/api/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: messageText })
                });

                if (response.ok) {
                    messageInput.value = '';
                    loadMessages();
                }
            } catch (error) {
                console.error('Error posting message:', error);
            }
        }
    });
}

async function loadMessages() {
    const messagesList = document.getElementById('chat-messages');
    if (!messagesList) {
        // Chat section not visible, stop polling
        if (chatPollInterval) {
            clearInterval(chatPollInterval);
            chatPollInterval = null;
            chatInitialized = false;
        }
        return;
    }

    try {
        const response = await fetch('/api/messages');
        const messages = await response.json();

        messagesList.innerHTML = '';
        messages.forEach(msg => {
            const li = document.createElement('li');
            const time = formatTime(msg.timestamp);
            li.innerHTML = `<strong>${time} ></strong> ${escapeHtml(msg.text)}`;
            messagesList.appendChild(li);
        });

        messagesList.scrollTop = messagesList.scrollHeight;
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Files functionality (local API)
let filesInitialized = false;

function initializeFiles() {
    const fileInput = document.getElementById('file-input');
    if (!fileInput || filesInitialized) return;
    filesInitialized = true;

    loadFiles();

    fileInput.addEventListener('change', async (e) => {
        const status = document.getElementById('upload-status');
        for (const file of e.target.files) {
            status.textContent = `Uploading ${file.name}...`;
            await uploadFile(file);
        }
        status.textContent = '';
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

    try {
        const response = await fetch('/api/files');
        const files = await response.json();

        fileList.innerHTML = '';
        if (files.length === 0) {
            fileList.innerHTML = '<li class="no-files">No files uploaded</li>';
            return;
        }

        files.forEach(file => {
            const li = document.createElement('li');
            const size = formatFileSize(file.size);
            li.innerHTML = `
                <span class="file-name">${escapeHtml(file.original_name)}</span>
                <span class="file-size">${size}</span>
                <button onclick="downloadFile('${file.filename}')">Download</button>
                <button onclick="deleteFile('${file.filename}')">Delete</button>
            `;
            fileList.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/files', {
            method: 'POST',
            body: formData
        });
        return response.ok;
    } catch (error) {
        console.error('Upload error:', error);
        return false;
    }
}

function downloadFile(filename) {
    window.location.href = `/api/files/${encodeURIComponent(filename)}`;
}

async function deleteFile(filename) {
    if (!confirm('Delete this file?')) return;

    try {
        const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });
        if (response.ok) {
            loadFiles();
        }
    } catch (error) {
        console.error('Delete error:', error);
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
