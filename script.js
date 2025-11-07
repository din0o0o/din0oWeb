// Ensure the main section is updated when navigating
function showSection(section) {
    // Reset chat initialization flag when leaving chat
    if (section !== 'chat') {
        chatInitialized = false;
    }

    fetch(`${section}.html`)
        .then(response => response.text())
        .then(data => {
            document.getElementById('main-content').innerHTML = data;
            setTimeout(() => {
                if (section === 'chat') {
                    initializeChat();
                }
            }, 100);
        })
        .catch(error => console.error('Error loading section:', error));
}

// Html hashing
document.addEventListener('DOMContentLoaded', function() {
    const links = document.querySelectorAll('nav ul li a');

    // Check the current hash # and set the section
    const currentHash = window.location.hash.substring(1);
    if (currentHash) {
        showSection(currentHash);
    } else {
        showSection('home'); // Default start section
    }

    // Navigation click handling
    links.forEach(link => {
        link.addEventListener('click', function(event) {
            event.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            window.location.hash = targetId;
            showSection(targetId);
        });
    });

    // Hash change handling
    window.addEventListener('hashchange', function() {
        const targetId = window.location.hash.substring(1);
        showSection(targetId);
    });
});


// Firebase chat functionality
let chatInitialized = false;
function initializeChat() {
    const form = document.getElementById('chat-form');
    const messagesList = document.getElementById('chat-messages');

    if (!form || !window.firebaseDB) {
        return;
    }

    if (chatInitialized) {
        return;
    }
    chatInitialized = true;

    const { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } = window.firebaseModules;
    const messagesRef = collection(window.firebaseDB, 'messages');

    // Listen for new messages in real-time
    const q = query(messagesRef, orderBy('timestamp', 'desc'), limit(50));
    onSnapshot(q, (snapshot) => {
        messagesList.innerHTML = '';
        const messages = [];
        snapshot.forEach((doc) => {
            messages.push(doc.data());
        });

        // Reverse to show oldest first
        messages.reverse().forEach((msg) => {
            const messageElement = document.createElement('li');
            const date = msg.timestamp ? msg.timestamp.toDate() : new Date();
            const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            messageElement.innerHTML = `<strong>${time} ></strong> ${msg.text}`;
            messagesList.appendChild(messageElement);
        });

        messagesList.scrollTop = messagesList.scrollHeight;
    });

    // Handle form submission
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        const messageInput = document.getElementById('message');
        const messageText = messageInput.value.trim();

        if (messageText) {
            try {
                await addDoc(messagesRef, {
                    text: messageText,
                    timestamp: serverTimestamp()
                });
                messageInput.value = '';
            } catch (error) {
                console.error('Error posting message:', error);
                alert('Failed to post message. Please try again.');
            }
        }
    });
}
