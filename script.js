// State
let zIndexCounter = 100;

// Clock
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    document.getElementById('taskbar-time').innerText = timeString;
}
setInterval(updateTime, 1000);
updateTime();

// Start Menu
const startButton = document.getElementById('start-button');
const startMenu = document.getElementById('start-menu');

startButton.addEventListener('click', (e) => {
    e.stopPropagation();
    startMenu.style.display = startMenu.style.display === 'block' ? 'none' : 'block';
    startButton.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!startMenu.contains(e.target) && e.target !== startButton) {
        startMenu.style.display = 'none';
        startButton.classList.remove('active');
    }
});

// Window Management
function openWindow(id) {
    const win = document.getElementById(id);
    win.style.display = 'block';
    bringToFront(win);
    
    // Center window if it's the first open (simple check)
    if (!win.dataset.positioned) {
        const rect = win.getBoundingClientRect();
        win.style.top = '20%';
        win.style.left = '20%';
        win.dataset.positioned = 'true';
    }
}

function closeWindow(id) {
    document.getElementById(id).style.display = 'none';
}

function bringToFront(element) {
    zIndexCounter++;
    element.style.zIndex = zIndexCounter;
}

// Dragging Logic
let isDragging = false;
let currentWindow = null;
let offset = { x: 0, y: 0 };

document.querySelectorAll('.title-bar').forEach(titleBar => {
    titleBar.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentWindow = titleBar.closest('.window');
        bringToFront(currentWindow);
        
        offset.x = e.clientX - currentWindow.offsetLeft;
        offset.y = e.clientY - currentWindow.offsetTop;
    });
});

document.addEventListener('mousemove', (e) => {
    if (isDragging && currentWindow) {
        e.preventDefault();
        currentWindow.style.left = (e.clientX - offset.x) + 'px';
        currentWindow.style.top = (e.clientY - offset.y) + 'px';
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    currentWindow = null;
});

// Guestbook Logic (Simulation)
function postMessage() {
    const input = document.getElementById('guestbook-input');
    const message = input.value.trim();
    if (message) {
        const container = document.getElementById('guestbook-messages');
        const entry = document.createElement('div');
        entry.className = 'message-entry';
        
        const now = new Date().toLocaleString();
        
        entry.innerHTML = `
            <div><span class="message-author">Visitor</span> <span class="message-time">[${now}]</span></div>
            <div>${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        `;
        
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight; // Auto scroll to bottom
        input.value = '';
        
        // Optional: Save to localStorage to persist across reloads (local only)
        saveMessageLocally(message, now);
    }
}

function saveMessageLocally(msg, time) {
    let messages = JSON.parse(localStorage.getItem('win98_guestbook') || '[]');
    messages.push({ author: 'Visitor', time: time, text: msg });
    localStorage.setItem('win98_guestbook', JSON.stringify(messages));
}

function loadMessages() {
    const messages = JSON.parse(localStorage.getItem('win98_guestbook') || '[]');
    const container = document.getElementById('guestbook-messages');
    messages.forEach(m => {
        const entry = document.createElement('div');
        entry.className = 'message-entry';
        entry.innerHTML = `
            <div><span class="message-author">${m.author}</span> <span class="message-time">[${m.time}]</span></div>
            <div>${m.text}</div>
        `;
        container.appendChild(entry);
    });
}

// Initialize
loadMessages();
