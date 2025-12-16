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

// Gitalk Initialization
// ---------------------------------------------------
// 请按照以下步骤配置 Gitalk:
// 1. 登录 GitHub，进入 Settings > Developer settings > OAuth Apps
// 2. 点击 "New OAuth App"
// 3. 填写 Application Name (如: My Retro Blog)
// 4. Homepage URL 填写你的 GitHub Pages 网址 (例如: https://yourname.github.io/repo-name)
// 5. Authorization callback URL 同上 (必须完全一致)
// 6. 注册成功后，复制 Client ID 和 Client Secret 填入下方
// 7. 创建一个新的 GitHub 仓库 (Repository) 用来存储评论，或者直接使用你存放这个网页的仓库
// ---------------------------------------------------

const gitalk = new Gitalk({
  clientID: 'Ov23lifhLcm9lmBzlp1d', // 替换为你的 Client ID
  clientSecret: 'f9152db39b5d9b851839ee606371d9171c29a608', // 替换为你的 Client Secret
  repo: 'Blankke.github.io',      // 存储评论的仓库名 (例如: 'my-blog-comments')
  owner: 'Blankke', // 你的 GitHub 用户名
  admin: ['Blankke'], // 管理员列表 (通常就是你自己)
  id: 'guestbook',      // 唯一标识，确保所有留言都在同一个 Issue 下
  distractionFreeMode: false  // 类似 Facebook 的无干扰模式
});

// 渲染 Gitalk
// 注意：如果你的网站还没部署，Gitalk 可能会报错 "Error: Not Found" 或 CORS 错误，这是正常的。
// 请确保 OAuth App 的 URL 配置正确。
try {
    gitalk.render('gitalk-container');
} catch (e) {
    console.error("Gitalk render failed:", e);
}
