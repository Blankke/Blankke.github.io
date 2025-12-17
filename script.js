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
    win.classList.add('window-open');
    bringToFront(win);
    
    // Center window if it's the first open (simple check)
    if (!win.dataset.positioned) {
        win.style.top = '20%';
        win.style.left = '20%';
        win.dataset.positioned = 'true';
    }
}

function closeWindow(id) {
    const win = document.getElementById(id);
    win.classList.remove('window-open');
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
    isResizing = false;
    resizingWindow = null;
});

// Resizing Logic
let isResizing = false;
let resizingWindow = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

document.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation(); // Prevent window dragging
        isResizing = true;
        resizingWindow = handle.closest('.window');
        bringToFront(resizingWindow);
        
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        resizeStartWidth = resizingWindow.offsetWidth;
        resizeStartHeight = resizingWindow.offsetHeight;
    });
});

document.addEventListener('mousemove', (e) => {
    if (isResizing && resizingWindow) {
        e.preventDefault();
        
        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;
        
        const newWidth = Math.max(300, resizeStartWidth + deltaX);
        const newHeight = Math.max(200, resizeStartHeight + deltaY);
        
        resizingWindow.style.width = newWidth + 'px';
        resizingWindow.style.height = newHeight + 'px';
    }
});

// Desktop Icon Dragging (with persistence)
// ---------------------------------------------------
const desktop = document.getElementById('desktop');

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function loadIconPositions() {
    const saved = JSON.parse(localStorage.getItem('win98_desktop_icons') || '{}');
    document.querySelectorAll('.icon[data-icon-id]').forEach(icon => {
        const id = icon.dataset.iconId;
        const fallbackLeft = parseInt(icon.dataset.defaultLeft || '20', 10);
        const fallbackTop = parseInt(icon.dataset.defaultTop || '20', 10);
        const pos = saved[id] || { left: fallbackLeft, top: fallbackTop };
        icon.style.left = `${pos.left}px`;
        icon.style.top = `${pos.top}px`;
    });
}

function saveIconPosition(icon) {
    const id = icon.dataset.iconId;
    if (!id) return;
    const saved = JSON.parse(localStorage.getItem('win98_desktop_icons') || '{}');
    saved[id] = { left: icon.offsetLeft, top: icon.offsetTop };
    localStorage.setItem('win98_desktop_icons', JSON.stringify(saved));
}

let isDraggingIcon = false;
let draggingIcon = null;
let iconDragOffsetX = 0;
let iconDragOffsetY = 0;
let iconDownX = 0;
let iconDownY = 0;

document.querySelectorAll('.icon[data-icon-id]').forEach(icon => {
    icon.addEventListener('mousedown', (e) => {
        // only left button
        if (e.button !== 0) return;
        isDraggingIcon = true;
        draggingIcon = icon;
        iconDownX = e.clientX;
        iconDownY = e.clientY;
        iconDragOffsetX = e.clientX - icon.offsetLeft;
        iconDragOffsetY = e.clientY - icon.offsetTop;
    });
});

document.addEventListener('mousemove', (e) => {
    if (!isDraggingIcon || !draggingIcon) return;
    const moved = Math.abs(e.clientX - iconDownX) + Math.abs(e.clientY - iconDownY);
    if (moved < 3) return; // tiny threshold to avoid interfering with dblclick
    e.preventDefault();
    const maxLeft = window.innerWidth - draggingIcon.offsetWidth;
    const maxTop = window.innerHeight - 28 - draggingIcon.offsetHeight; // keep above taskbar
    const left = clamp(e.clientX - iconDragOffsetX, 0, maxLeft);
    const top = clamp(e.clientY - iconDragOffsetY, 0, maxTop);
    draggingIcon.style.left = `${left}px`;
    draggingIcon.style.top = `${top}px`;
});

document.addEventListener('mouseup', () => {
    if (isDraggingIcon && draggingIcon) {
        saveIconPosition(draggingIcon);
    }
    isDraggingIcon = false;
    draggingIcon = null;
});

loadIconPositions();

// Music Player
// ---------------------------------------------------
const musicListEl = document.getElementById('music-list');
const musicAudioEl = document.getElementById('music-audio');
const musicNowTitleEl = document.getElementById('music-now-title');
const musicStatusEl = document.getElementById('music-status');

async function loadMusicManifest() {
    try {
        const res = await fetch('music/manifest.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        renderTrackList(tracks);
    } catch (err) {
        if (musicListEl) {
            musicListEl.innerHTML = `<div style="padding: 6px;">无法读取 music/manifest.json。<br>请确认已部署并且文件存在。<br><br>错误：${String(err)}</div>`;
        }
    }
}

function renderTrackList(tracks) {
    if (!musicListEl) return;
    if (!tracks.length) {
        musicListEl.innerHTML = `<div style="padding: 6px;">music/manifest.json 里没有歌曲。</div>`;
        return;
    }

    musicListEl.innerHTML = '';
    tracks.forEach((track, idx) => {
        const title = track.title || track.file || `Track ${idx + 1}`;
        const file = track.file;
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = title;
        btn.addEventListener('click', () => playTrack({ title, file }));
        musicListEl.appendChild(btn);
    });
}

function playTrack(track) {
    if (!musicAudioEl) return;
    if (!track?.file) return;
    const src = `music/${encodeURIComponent(track.file)}`;
    musicAudioEl.src = src;
    musicNowTitleEl.textContent = track.title || track.file;
    musicStatusEl.textContent = '播放中...';
    musicAudioEl.play().catch(() => {
        musicStatusEl.textContent = '已加载（点击播放）';
    });
}

if (musicAudioEl) {
    musicAudioEl.addEventListener('ended', () => {
        musicStatusEl.textContent = '播放结束';
    });
    musicAudioEl.addEventListener('pause', () => {
        if (musicAudioEl.currentTime > 0 && !musicAudioEl.ended) {
            musicStatusEl.textContent = '已暂停';
        }
    });
    musicAudioEl.addEventListener('play', () => {
        musicStatusEl.textContent = '播放中...';
    });
}

loadMusicManifest();

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
