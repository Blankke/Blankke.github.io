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
let activeWindowId = null;
const taskbarWindowsEl = document.getElementById('taskbar-windows');

function getWindowMeta(win) {
    const title = win.dataset.windowTitle || win.id;
    const icon = win.dataset.windowIcon || '';
    return { title, icon };
}

function ensureTaskbarButton(win) {
    if (!taskbarWindowsEl) return;
    const id = win.id;
    let btn = taskbarWindowsEl.querySelector(`[data-window-id="${id}"]`);
    if (btn) return btn;

    const meta = getWindowMeta(win);
    btn = document.createElement('button');
    btn.className = 'taskbar-window-btn';
    btn.dataset.windowId = id;
    btn.type = 'button';

    if (meta.icon) {
        const img = document.createElement('img');
        img.src = meta.icon;
        img.alt = '';
        btn.appendChild(img);
    }
    const span = document.createElement('span');
    span.textContent = meta.title;
    btn.appendChild(span);

    btn.addEventListener('click', () => {
        // If it's active and open => minimize, otherwise restore + focus
        const w = document.getElementById(id);
        if (!w) return;
        const isOpen = w.classList.contains('window-open');
        if (isOpen && activeWindowId === id) {
            minimizeWindow(id);
        } else {
            openWindow(id);
        }
    });

    taskbarWindowsEl.appendChild(btn);
    return btn;
}

function removeTaskbarButton(windowId) {
    if (!taskbarWindowsEl) return;
    const btn = taskbarWindowsEl.querySelector(`[data-window-id="${windowId}"]`);
    if (btn) btn.remove();
}

function setActiveWindow(windowId) {
    activeWindowId = windowId;
    if (!taskbarWindowsEl) return;
    taskbarWindowsEl.querySelectorAll('.taskbar-window-btn').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.windowId === windowId);
    });
}

function minimizeWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    win.classList.remove('window-open');
    win.classList.add('window-minimized');
    if (activeWindowId === id) {
        setActiveWindow(null);
    }
}

function toggleMaximizeWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    const taskbarHeight = 32;
    const isMax = win.classList.contains('window-maximized');

    if (!isMax) {
        // Save current geometry
        win.dataset.restoreLeft = win.style.left || `${win.offsetLeft}px`;
        win.dataset.restoreTop = win.style.top || `${win.offsetTop}px`;
        win.dataset.restoreWidth = win.style.width || `${win.offsetWidth}px`;
        win.dataset.restoreHeight = win.style.height || `${win.offsetHeight}px`;

        win.classList.add('window-maximized');
        win.style.left = '0px';
        win.style.top = '0px';
        win.style.width = `${window.innerWidth}px`;
        win.style.height = `${window.innerHeight - taskbarHeight}px`;
    } else {
        win.classList.remove('window-maximized');
        win.style.left = win.dataset.restoreLeft || '20%';
        win.style.top = win.dataset.restoreTop || '20%';
        win.style.width = win.dataset.restoreWidth || '400px';
        win.style.height = win.dataset.restoreHeight || '';
    }

    bringToFront(win);
}

function openWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    ensureTaskbarButton(win);
    win.classList.remove('window-minimized');
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
    if (!win) return;
    win.classList.remove('window-open');
    win.classList.remove('window-minimized');
    win.classList.remove('window-maximized');
    removeTaskbarButton(id);
    if (activeWindowId === id) setActiveWindow(null);
}

function bringToFront(element) {
    zIndexCounter++;
    element.style.zIndex = zIndexCounter;
    if (element?.id) setActiveWindow(element.id);
}

// Make clicking inside a window focus it
document.querySelectorAll('.window').forEach(win => {
    win.addEventListener('mousedown', () => bringToFront(win));
});

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
let selectedIcon = null; // 当前选中的图标

// 图标选中功能
function selectIcon(icon) {
    if (selectedIcon) {
        selectedIcon.classList.remove('selected');
    }
    selectedIcon = icon;
    if (icon) {
        icon.classList.add('selected');
    }
}

// 点击桌面取消选中
document.getElementById('desktop').addEventListener('click', (e) => {
    if (e.target.id === 'desktop' || e.target === document.body) {
        selectIcon(null);
    }
});

// 双击桌面空白区域自动排列图标（类似 Windows 98）
document.getElementById('desktop').addEventListener('dblclick', (e) => {
    if (e.target.id === 'desktop' || e.target === document.body) {
        // 自动排列图标
        const icons = Array.from(document.querySelectorAll('.icon[data-icon-id]'));
        let top = 20;
        let left = 20;
        const spacing = 90;
        const maxHeight = window.innerHeight - 100;
        
        icons.forEach((icon) => {
            icon.style.left = `${left}px`;
            icon.style.top = `${top}px`;
            saveIconPosition(icon);
            
            top += spacing;
            if (top > maxHeight) {
                top = 20;
                left += 90;
            }
        });
    }
});

document.querySelectorAll('.icon[data-icon-id]').forEach(icon => {
    // 单击选中图标
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        selectIcon(icon);
    });

    icon.addEventListener('mousedown', (e) => {
        // only left button
        if (e.button !== 0) return;
        isDraggingIcon = true;
        draggingIcon = icon;
        iconDownX = e.clientX;
        iconDownY = e.clientY;
        iconDragOffsetX = e.clientX - icon.offsetLeft;
        iconDragOffsetY = e.clientY - icon.offsetTop;
        selectIcon(icon); // 拖动时也选中
    });
});

document.addEventListener('mousemove', (e) => {
    if (!isDraggingIcon || !draggingIcon) return;
    const moved = Math.abs(e.clientX - iconDownX) + Math.abs(e.clientY - iconDownY);
    if (moved < 3) return; // tiny threshold to avoid interfering with dblclick
    e.preventDefault();
    
    // 添加拖拽样式
    if (!draggingIcon.classList.contains('dragging')) {
        draggingIcon.classList.add('dragging');
    }
    
    const maxLeft = window.innerWidth - draggingIcon.offsetWidth;
    const maxTop = window.innerHeight - 28 - draggingIcon.offsetHeight; // keep above taskbar
    const left = clamp(e.clientX - iconDragOffsetX, 0, maxLeft);
    const top = clamp(e.clientY - iconDragOffsetY, 0, maxTop);
    draggingIcon.style.left = `${left}px`;
    draggingIcon.style.top = `${top}px`;
});

document.addEventListener('mouseup', () => {
    if (isDraggingIcon && draggingIcon) {
        draggingIcon.classList.remove('dragging'); // 移除拖拽样式
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
const musicPrevEl = document.getElementById('music-prev');
const musicNextEl = document.getElementById('music-next');
const musicPlayEl = document.getElementById('music-play');
const musicPauseEl = document.getElementById('music-pause');
const musicLoopEl = document.getElementById('music-loop');

let musicTracks = [];
let musicCurrentIndex = -1;

async function loadMusicManifest() {
    try {
        const res = await fetch('music/manifest.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const tracks = Array.isArray(data.tracks) ? data.tracks : [];
        musicTracks = tracks;
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
        btn.className = 'btn music-track-btn';
        btn.textContent = title;
        btn.dataset.trackIndex = String(idx);
        btn.addEventListener('click', () => playTrackByIndex(idx));
        musicListEl.appendChild(btn);
    });

    syncMusicHighlight();
}

function syncMusicHighlight() {
    if (!musicListEl) return;
    musicListEl.querySelectorAll('.music-track-btn').forEach(btn => {
        const idx = parseInt(btn.dataset.trackIndex || '-1', 10);
        btn.classList.toggle('is-current', idx === musicCurrentIndex);
    });
}

function playTrackByIndex(index) {
    if (!Array.isArray(musicTracks) || !musicTracks.length) return;
    const safe = ((index % musicTracks.length) + musicTracks.length) % musicTracks.length;
    musicCurrentIndex = safe;
    const t = musicTracks[safe];
    const title = t.title || t.file || `Track ${safe + 1}`;
    const file = t.file;
    playTrack({ title, file });
    syncMusicHighlight();
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

function playNext() {
    if (!musicTracks.length) return;
    const next = musicCurrentIndex >= 0 ? musicCurrentIndex + 1 : 0;
    playTrackByIndex(next);
}

function playPrev() {
    if (!musicTracks.length) return;
    const prev = musicCurrentIndex >= 0 ? musicCurrentIndex - 1 : 0;
    playTrackByIndex(prev);
}

if (musicAudioEl) {
    musicAudioEl.addEventListener('ended', () => {
        if (musicLoopEl?.checked) {
            // browser loop handles replay; keep status consistent
            musicStatusEl.textContent = '循环播放';
            return;
        }
        musicStatusEl.textContent = '播放结束';
        // Auto-next
        playNext();
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

if (musicLoopEl && musicAudioEl) {
    musicLoopEl.addEventListener('change', () => {
        musicAudioEl.loop = !!musicLoopEl.checked;
        if (musicLoopEl.checked) {
            musicStatusEl.textContent = '循环开启';
        } else {
            musicStatusEl.textContent = '循环关闭';
        }
    });
}

musicPrevEl?.addEventListener('click', playPrev);
musicNextEl?.addEventListener('click', playNext);
musicPlayEl?.addEventListener('click', () => {
    if (!musicAudioEl) return;
    if (!musicAudioEl.src) {
        playTrackByIndex(0);
        return;
    }
    musicAudioEl.play().catch(() => {});
});
musicPauseEl?.addEventListener('click', () => musicAudioEl?.pause());

// Keep maximized window fit on resize
window.addEventListener('resize', () => {
    document.querySelectorAll('.window.window-maximized').forEach(win => {
        win.style.width = `${window.innerWidth}px`;
        win.style.height = `${window.innerHeight - 32}px`;
    });
});

loadMusicManifest();

// 右键菜单功能
// ---------------------------------------------------
const contextMenu = document.getElementById('context-menu');
const iconContextMenu = document.getElementById('icon-context-menu');
let copiedIcon = null; // 存储被复制的图标数据
let contextMenuTargetIcon = null; // 右键点击的图标

// 更新粘贴按钮状态
function updatePasteButton() {
    const pasteBtn = document.getElementById('ctx-paste');
    if (pasteBtn) {
        if (copiedIcon) {
            pasteBtn.classList.remove('disabled');
        } else {
            pasteBtn.classList.add('disabled');
        }
    }
}

// 显示桌面右键菜单
function showContextMenu(x, y) {
    if (!contextMenu) return;
    hideIconContextMenu(); // 隐藏图标菜单
    updatePasteButton(); // 更新粘贴按钮状态
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    
    // 确保菜单不会超出屏幕
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = `${window.innerWidth - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = `${window.innerHeight - rect.height}px`;
    }
}

// 显示图标右键菜单
function showIconContextMenu(x, y, icon) {
    if (!iconContextMenu) return;
    hideContextMenu(); // 隐藏桌面菜单
    contextMenuTargetIcon = icon;
    iconContextMenu.style.display = 'block';
    iconContextMenu.style.left = `${x}px`;
    iconContextMenu.style.top = `${y}px`;
    
    // 确保菜单不会超出屏幕
    const rect = iconContextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        iconContextMenu.style.left = `${window.innerWidth - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        iconContextMenu.style.top = `${window.innerHeight - rect.height}px`;
    }
}

// 隐藏桌面右键菜单
function hideContextMenu() {
    if (contextMenu) {
        contextMenu.style.display = 'none';
    }
}

// 隐藏图标右键菜单
function hideIconContextMenu() {
    if (iconContextMenu) {
        iconContextMenu.style.display = 'none';
    }
    contextMenuTargetIcon = null;
}

// 桌面右键菜单
document.addEventListener('contextmenu', (e) => {
    // 检查是否点击在图标上
    const icon = e.target.closest('.icon[data-icon-id]');
    if (icon) {
        e.preventDefault();
        selectIcon(icon);
        showIconContextMenu(e.clientX, e.clientY, icon);
        return;
    }
    
    // 只在桌面区域显示右键菜单
    if (e.target === document.body || e.target.id === 'desktop' || e.target.closest('.desktop-icons')) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
    }
});

// 点击其他地方关闭菜单
document.addEventListener('click', (e) => {
    if (!contextMenu.contains(e.target) && !iconContextMenu.contains(e.target)) {
        hideContextMenu();
        hideIconContextMenu();
    }
});

// 右键菜单项功能
document.getElementById('ctx-arrange')?.addEventListener('click', () => {
    // 自动排列图标
    const icons = Array.from(document.querySelectorAll('.icon[data-icon-id]'));
    let top = 20;
    let left = 20;
    const spacing = 90;
    const maxHeight = window.innerHeight - 100;
    
    icons.forEach((icon, index) => {
        icon.style.left = `${left}px`;
        icon.style.top = `${top}px`;
        saveIconPosition(icon);
        
        top += spacing;
        if (top > maxHeight) {
            top = 20;
            left += 90;
        }
    });
    
    hideContextMenu();
});

document.getElementById('ctx-refresh')?.addEventListener('click', () => {
    // 刷新页面
    location.reload();
    hideContextMenu();
});

document.getElementById('ctx-paste')?.addEventListener('click', () => {
    if (!copiedIcon) return;
    
    // 创建新图标
    const newIcon = document.createElement('div');
    newIcon.className = 'icon';
    
    // 生成唯一 ID
    const timestamp = Date.now();
    const newId = `icon-copy-${timestamp}`;
    const newDataId = `copy-${timestamp}`;
    
    newIcon.id = newId;
    newIcon.dataset.iconId = newDataId;
    
    // 设置位置（在原图标附近偏移一点）
    const offsetX = 80;
    const offsetY = 80;
    newIcon.dataset.defaultLeft = String(copiedIcon.left + offsetX);
    newIcon.dataset.defaultTop = String(copiedIcon.top + offsetY);
    newIcon.style.left = `${copiedIcon.left + offsetX}px`;
    newIcon.style.top = `${copiedIcon.top + offsetY}px`;
    
    // 复制内容
    newIcon.innerHTML = copiedIcon.content;
    
    // 如果有双击事件，也复制过来
    if (copiedIcon.ondblclick) {
        newIcon.ondblclick = copiedIcon.ondblclick;
    }
    
    // 添加到桌面
    document.getElementById('desktop').appendChild(newIcon);
    
    // 添加事件监听器
    setupIconEvents(newIcon);
    
    // 保存位置
    saveIconPosition(newIcon);
    
    hideContextMenu();
});

document.getElementById('ctx-properties')?.addEventListener('click', () => {
    // 显示属性对话框
    alert('桌面属性\\n\\n分辨率: ' + window.innerWidth + ' x ' + window.innerHeight + '\\n颜色: 32 位\\n适配器: GitHub Pages Accelerator');
    hideContextMenu();
});

// 图标右键菜单项功能
document.getElementById('icon-ctx-open')?.addEventListener('click', () => {
    if (contextMenuTargetIcon) {
        // 触发双击事件
        const dblclickEvent = new MouseEvent('dblclick', {
            bubbles: true,
            cancelable: true,
            view: window
        });
        contextMenuTargetIcon.dispatchEvent(dblclickEvent);
    }
    hideIconContextMenu();
});

document.getElementById('icon-ctx-copy')?.addEventListener('click', () => {
    if (contextMenuTargetIcon) {
        // 保存图标数据
        copiedIcon = {
            content: contextMenuTargetIcon.innerHTML,
            left: contextMenuTargetIcon.offsetLeft,
            top: contextMenuTargetIcon.offsetTop,
            ondblclick: contextMenuTargetIcon.ondblclick
        };
        updatePasteButton();
    }
    hideIconContextMenu();
});

document.getElementById('icon-ctx-delete')?.addEventListener('click', () => {
    if (contextMenuTargetIcon && contextMenuTargetIcon.dataset.iconId) {
        const iconId = contextMenuTargetIcon.dataset.iconId;
        
        // 不允许删除原始图标
        const originalIcons = ['computer', 'guestbook', 'github', 'resume', 'music', 'radio', 'minesweeper'];
        if (originalIcons.includes(iconId)) {
            alert('无法删除系统图标！');
            hideIconContextMenu();
            return;
        }
        
        // 删除复制的图标
        if (confirm('确定要删除这个图标吗？')) {
            // 从 localStorage 中删除位置信息
            const saved = JSON.parse(localStorage.getItem('win98_desktop_icons') || '{}');
            delete saved[iconId];
            localStorage.setItem('win98_desktop_icons', JSON.stringify(saved));
            
            // 从 DOM 中删除
            contextMenuTargetIcon.remove();
        }
    }
    hideIconContextMenu();
});

document.getElementById('icon-ctx-properties')?.addEventListener('click', () => {
    if (contextMenuTargetIcon) {
        const iconText = contextMenuTargetIcon.querySelector('.icon-text')?.textContent || '未知';
        const iconId = contextMenuTargetIcon.dataset.iconId || 'unknown';
        alert(`图标属性\\n\\n名称: ${iconText}\\nID: ${iconId}\\n位置: (${contextMenuTargetIcon.offsetLeft}, ${contextMenuTargetIcon.offsetTop})`);
    }
    hideIconContextMenu();
});

// 为新图标设置事件监听器的辅助函数
function setupIconEvents(icon) {
    // 单击选中图标
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        selectIcon(icon);
    });

    icon.addEventListener('mousedown', (e) => {
        // only left button
        if (e.button !== 0) return;
        isDraggingIcon = true;
        draggingIcon = icon;
        iconDownX = e.clientX;
        iconDownY = e.clientY;
        iconDragOffsetX = e.clientX - icon.offsetLeft;
        iconDragOffsetY = e.clientY - icon.offsetTop;
        selectIcon(icon); // 拖动时也选中
    });
}

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
