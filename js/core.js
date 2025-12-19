// Core System Logic
// Includes: State, Clock, Boot Toast, Start Menu

// State
let zIndexCounter = 100;

// Clock
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('taskbar-time');
    if (el) el.innerText = timeString;
}
setInterval(updateTime, 1000);
updateTime();

// Boot toast (bottom-right)
function showBootToast() {
    // Use navigation timing as a pseudo "boot time"
    const seconds = Math.max(0.6, Math.round((performance.now() / 1000) * 10) / 10);
    const percent = Math.max(1, Math.min(99, Math.round(99 - seconds * 6)));

    const toast = document.createElement('div');
    toast.className = 'boot-toast';
    toast.textContent = `欢迎回来！本次开机用时 ${seconds} 秒，超越全球 ${percent}% 用户 :)`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 6500);
}

showBootToast();

// Start Menu
const startButton = document.getElementById('start-button');
const startMenu = document.getElementById('start-menu');

if (startButton && startMenu) {
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
}
