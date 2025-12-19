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

// Recycle Bin + PVZ Wisdom Tree hint system
// ---------------------------------------------------
const RECYCLE_KEY = 'recycle_bin_items_v1';
const PVZ_RESTORED_KEY = 'pvz_restored_v1';
const TREE_HINT_IDX_KEY = 'wisdom_tree_hint_idx_v1';

const recycleBinDefaults = ['readme', 'pvz'];
const recycleBinCatalog = {
    readme: {
        id: 'readme',
        name: 'readme.txt',
        icon: 'icon/notepad-5.png',
        preview: 'readme.txt\n\n我本来想写一个提示系统……\n写到一半又觉得太直白。\n\n最后我决定：把它删掉。\n\n（但是它为什么还在回收站里？）\n',
        canRestore: true,
        restoreData: { type: 'window', windowId: 'window-recycle-readme' }
    },
    pvz: {
        id: 'pvz',
        name: 'PlantsVsZombies.lnk',
        icon: 'icon/pvz_icon.png',
        preview: '一个奇怪的快捷方式。\n右键它，也许会有“还原”。',
        canRestore: true,
        restoreData: { type: 'desktop-icon' }
    }
};

// Add deleted icon to recycle catalog
function addIconToRecycleBin(iconId, iconData) {
    recycleBinCatalog[iconId] = {
        id: iconId,
        name: iconData.name || iconId,
        icon: iconData.icon || 'settings_gear-4.png',
        preview: `已删除的图标\n\n名称: ${iconData.name || iconId}\n原位置: (${iconData.left || 0}, ${iconData.top || 0})`,
        canRestore: true,
        restoreData: {
            type: 'desktop-icon',
            iconId: iconId,
            content: iconData.content,
            left: iconData.left,
            top: iconData.top,
            ondblclick: iconData.ondblclick
        }
    };
}



function getRecycleItems() {
    try {
        const raw = localStorage.getItem(RECYCLE_KEY);
        if (!raw) return [...recycleBinDefaults];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [...recycleBinDefaults];
        return parsed.filter(id => typeof id === 'string');
    } catch {
        return [...recycleBinDefaults];
    }
}

function setRecycleItems(items) {
    localStorage.setItem(RECYCLE_KEY, JSON.stringify(items));
    updateRecycleBinDesktopIcon();
}

function updateRecycleBinDesktopIcon() {
    const img = document.getElementById('recyclebin-desktop-icon');
    if (!img) return;
    const items = getRecycleItems();
    img.src = items.length ? 'icon/recycle_bin_full.png' : 'icon/recycle_bin_empty.png';
}

function renderRecycleBin() {
    updateRecycleBinDesktopIcon();

    const listEl = document.getElementById('recyclebin-list');
    const previewEl = document.getElementById('recyclebin-preview-text');
    if (!listEl) return;

    const items = getRecycleItems();
    listEl.innerHTML = '';
    let selectedId = null;

    const selectItem = (id) => {
        selectedId = id;
        listEl.querySelectorAll('.recyclebin-item').forEach(el => {
            el.classList.toggle('is-selected', el.dataset.itemId === id);
        });
        const meta = recycleBinCatalog[id];
        if (previewEl) previewEl.textContent = meta?.preview || '…';
    };

    items.forEach((id) => {
        const meta = recycleBinCatalog[id];
        if (!meta) return;

        const row = document.createElement('div');
        row.className = 'recyclebin-item';
        row.dataset.itemId = id;
        row.innerHTML = `<img src="${meta.icon}" alt=""><span>${meta.name}</span>`;

        row.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem(id);
        });

        row.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (id === 'readme') {
                openRecycleReadme();
            }
        });

        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            selectItem(id);
            if (meta.canRestore) {
                showRecycleContextMenu(e.clientX, e.clientY, id);
            }
        });

        listEl.appendChild(row);
    });

    if (items.length) selectItem(items[0]);
    else if (previewEl) previewEl.textContent = '回收站是空的。';
}

function openRecycleReadme() {
    const textarea = document.getElementById('recycle-readme-text');
    if (textarea) {
        textarea.value = recycleBinCatalog.readme.preview;
    }
    openWindow('window-recycle-readme');
}

// Recycle item context menu (restore)
let recycleMenuEl = null;
let currentRecycleItemId = null;

function ensureRecycleContextMenu() {
    if (recycleMenuEl) return recycleMenuEl;
    recycleMenuEl = document.createElement('div');
    recycleMenuEl.id = 'recycle-item-context-menu';
    recycleMenuEl.className = 'context-menu';
    recycleMenuEl.style.display = 'none';
    recycleMenuEl.innerHTML = `
        <div class="context-menu-item" id="recycle-ctx-restore"><span>还原</span></div>
    `;
    document.body.appendChild(recycleMenuEl);

    document.addEventListener('click', () => {
        recycleMenuEl.style.display = 'none';
    });

    const restoreBtn = recycleMenuEl.querySelector('#recycle-ctx-restore');
    if (restoreBtn) {
        restoreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            recycleMenuEl.style.display = 'none';
            if (currentRecycleItemId) {
                restoreRecycleItem(currentRecycleItemId);
            }
        });
    }
    return recycleMenuEl;
}

function showRecycleContextMenu(x, y, itemId) {
    const menu = ensureRecycleContextMenu();
    currentRecycleItemId = itemId;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
}

function bindIconInteractions(icon) {
    if (!icon) return;
    if (!icon.dataset.iconId) return;

    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        selectIcon(icon);
    });

    icon.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDraggingIcon = true;
        draggingIcon = icon;
        iconDownX = e.clientX;
        iconDownY = e.clientY;
        iconDragOffsetX = e.clientX - icon.offsetLeft;
        iconDragOffsetY = e.clientY - icon.offsetTop;
        selectIcon(icon);
    });
}

function restoreRecycleItem(itemId) {
    const meta = recycleBinCatalog[itemId];
    if (!meta || !meta.canRestore) return;

    // Remove from recycle items
    const items = getRecycleItems().filter(id => id !== itemId);
    setRecycleItems(items);

    const restoreData = meta.restoreData;
    if (!restoreData) return;

    if (restoreData.type === 'desktop-icon') {
        // Restore desktop icon
        const desktopEl = document.getElementById('desktop');
        if (!desktopEl) {
            console.error('[RecycleBin] Desktop element not found!');
            return;
        }

        const existingId = itemId === 'pvz' ? 'icon-pvz' : `icon-${itemId}`;
        if (document.getElementById(existingId)) {
            return; // Already exists
        }

        const icon = document.createElement('div');
        icon.className = 'icon';
        icon.id = existingId;
        icon.dataset.iconId = itemId;
        
        if (itemId === 'pvz') {
            // Special handling for PVZ
            localStorage.setItem(PVZ_RESTORED_KEY, '1');
            icon.dataset.defaultLeft = '120';
            icon.dataset.defaultTop = '120';
            icon.setAttribute('ondblclick', "openWindow('window-wisdomtree')");
            icon.innerHTML = `
                <img src="icon/pvz_icon.png" alt="PVZ">
                <div class="icon-text">植物大战僵尸</div>
            `;
        } else {
            // Restore from saved data
            icon.dataset.defaultLeft = String(restoreData.left || 120);
            icon.dataset.defaultTop = String(restoreData.top || 120);
            icon.style.left = `${restoreData.left || 120}px`;
            icon.style.top = `${restoreData.top || 120}px`;
            icon.innerHTML = restoreData.content || '';
            if (restoreData.ondblclick) {
                icon.ondblclick = restoreData.ondblclick;
            }
        }
        
        desktopEl.appendChild(icon);
        bindIconInteractions(icon);
        loadIconPositions();
    }

    renderRecycleBin();
}

function initRecycleBinState() {
    // 1. Check PVZ
    const pvzRestored = localStorage.getItem(PVZ_RESTORED_KEY) === '1';
    let items = getRecycleItems();
    let changed = false;

    if (pvzRestored) {
        // If it's marked as restored, ensure it's on the desktop
        if (!document.getElementById('icon-pvz')) {
            // Use restoreRecycleItem to create the DOM element
            // It will also ensure it's removed from the bin list
            restoreRecycleItem('pvz');
        }
        
        // Double check it's not in the bin (restoreRecycleItem handles this, but just in case)
        const currentItems = getRecycleItems();
        if (currentItems.includes('pvz')) {
            items = currentItems.filter(id => id !== 'pvz');
            changed = true;
        } else {
            items = currentItems;
        }
    } else {
        // If NOT restored, it MUST be in the recycle bin
        if (!items.includes('pvz')) {
            items.push('pvz');
            changed = true;
        }
    }

    // 2. Check Readme (Always ensure it's in bin for "initial state" behavior)
    if (!items.includes('readme')) {
        items.push('readme');
        changed = true;
    }

    if (changed) {
        setRecycleItems(items);
    }
    
    // Force render to update UI
    renderRecycleBin();
}

// Wisdom tree hints
const wisdomTreeHints = [
    '……',
    '提示 1：这里的提示以后再写。',
    '提示 2：有些东西不是“点出来”的。',
    '提示 3：也许你该回到“回收站”看看。',
    '提示 4：先到这里，剩下的你来补充。'
];

let pvzFood = 10;

function resetWisdomTreeUI() {
    pvzFood = 10;
    const countEl = document.getElementById('pvz-food-count');
    if (countEl) countEl.textContent = `x ${pvzFood}`;
    const speechEl = document.getElementById('pvz-tree-speech');
    if (speechEl) speechEl.textContent = '……';
}

function initWisdomTreeOnce() {
    const btn = document.getElementById('pvz-fertilize');
    if (!btn || btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
        if (pvzFood <= 0) return;
        pvzFood -= 1;
        const countEl = document.getElementById('pvz-food-count');
        if (countEl) countEl.textContent = `x ${pvzFood}`;

        let idx = 0;
        try {
            idx = parseInt(localStorage.getItem(TREE_HINT_IDX_KEY) || '0', 10);
            if (Number.isNaN(idx) || idx < 0) idx = 0;
        } catch {
            idx = 0;
        }
        const next = Math.min(idx + 1, wisdomTreeHints.length - 1);
        localStorage.setItem(TREE_HINT_IDX_KEY, String(next));

        const speechEl = document.getElementById('pvz-tree-speech');
        if (speechEl) speechEl.textContent = wisdomTreeHints[next] || '……';
    });
}

function onOpenWisdomTree() {
    initWisdomTreeOnce();
    resetWisdomTreeUI();
    const tree = document.getElementById('pvz-tree');
    if (tree) tree.style.display = 'flex';
}

// Hook into openWindow for recyclebin + wisdom tree
const _openWindow = openWindow;
openWindow = function(id) {
    _openWindow(id);
    if (id === 'window-recyclebin') {
        renderRecycleBin();
    }
    if (id === 'window-wisdomtree') {
        onOpenWisdomTree();
    }
};



// Initialize on load
// Ensure PVZ starts in recycle bin (remove any desktop remnants from previous state)
const existingPvzIcon = document.getElementById('icon-pvz');
if (existingPvzIcon) {
    existingPvzIcon.remove();
    // Clear the restored flag to ensure it stays in recycle bin
    localStorage.removeItem(PVZ_RESTORED_KEY);
}
renderRecycleBin();

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

// MewMew talk toggle state
window.mewmewTalkEnabled = false;
try {
    window.mewmewTalkEnabled = localStorage.getItem('mewmew_talk_enabled_v1') === '1';
} catch {
    // ignore
}

// Track context menu for American Pie secret
let trackContextMenu = null;
let trackContextMenuTarget = null;

function ensureTrackContextMenu() {
    if (trackContextMenu) return trackContextMenu;
    trackContextMenu = document.createElement('div');
    trackContextMenu.id = 'track-context-menu';
    trackContextMenu.className = 'context-menu';
    trackContextMenu.style.display = 'none';
    trackContextMenu.innerHTML = `
        <div class="context-menu-item" id="track-ctx-mewmew">
            <label style="cursor: pointer; user-select: none; display: flex; align-items: center; gap: 6px;">
                <input type="checkbox" id="track-mewmew-toggle" style="margin: 0;">
                <span>MewMew 对话</span>
            </label>
        </div>
    `;
    document.body.appendChild(trackContextMenu);

    const toggleEl = trackContextMenu.querySelector('#track-mewmew-toggle');
    if (toggleEl) {
        toggleEl.checked = window.mewmewTalkEnabled;
        toggleEl.addEventListener('change', () => {
            window.mewmewTalkEnabled = !!toggleEl.checked;
            try {
                localStorage.setItem('mewmew_talk_enabled_v1', window.mewmewTalkEnabled ? '1' : '0');
            } catch {
                // ignore
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!trackContextMenu.contains(e.target)) {
            trackContextMenu.style.display = 'none';
        }
    });

    return trackContextMenu;
}

function showTrackContextMenu(x, y, trackIndex) {
    const menu = ensureTrackContextMenu();
    trackContextMenuTarget = trackIndex;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';

    // Sync checkbox state
    const toggleEl = menu.querySelector('#track-mewmew-toggle');
    if (toggleEl) toggleEl.checked = window.mewmewTalkEnabled;
}

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

        // Right-click menu only for American Pie (index 0)
        if (idx === 0) {
            btn.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
                showTrackContextMenu(e.clientX, e.clientY, idx);
            });
        }

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
        const iconName = contextMenuTargetIcon.querySelector('.icon-text')?.textContent || iconId;
        const iconImg = contextMenuTargetIcon.querySelector('img');
        const iconSrc = iconImg ? iconImg.getAttribute('src') : 'icon/settings_gear-4.png';
        
        if (confirm(`确定要删除 "${iconName}" 吗?

删除的图标将移至回收站。`)) {
            // Save icon data to recycle bin
            const iconData = {
                name: iconName,
                icon: iconSrc,
                content: contextMenuTargetIcon.innerHTML,
                left: contextMenuTargetIcon.offsetLeft,
                top: contextMenuTargetIcon.offsetTop,
                ondblclick: contextMenuTargetIcon.ondblclick
            };
            
            // Add to recycle catalog and items list
            addIconToRecycleBin(iconId, iconData);
            const items = getRecycleItems();
            if (!items.includes(iconId)) {
                items.push(iconId);
                setRecycleItems(items);
            }
            
            // Clear PVZ restored flag if deleting PVZ
            if (iconId === 'pvz') {
                localStorage.removeItem(PVZ_RESTORED_KEY);
            }
            
            // Remove from localStorage position data
            const saved = JSON.parse(localStorage.getItem('win98_desktop_icons') || '{}');
            delete saved[iconId];
            localStorage.setItem('win98_desktop_icons', JSON.stringify(saved));
            
            // Remove from DOM
            contextMenuTargetIcon.remove();
            
            // Update recycle bin icon
            updateRecycleBinDesktopIcon();
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

// 快捷键监听 - Ctrl+Alt+C 打开 CMD
// ---------------------------------------------------
document.addEventListener('keydown', (e) => {
    // Ctrl+Alt+C
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        openCMD();
    }
});

// 监听来自 iframe 的消息（扫雷通关）
window.addEventListener('message', (event) => {
    // console.log('[Main] Received message:', event.data);
    if (!window.desktopPet) return;

    if (event.data.type === 'minesweeper-win') {
        window.desktopPet.onMinesweeperWin(event.data.time);
    } else if (event.data.type === 'minesweeper-loss') {
        window.desktopPet.onMinesweeperLoss();
    } else if (event.data.type === 'minesweeper-active') {
        window.desktopPet.resetMinesweeperIdleTimer();
    }
});

function openCMD() {
    const cmdWindow = document.getElementById('window-cmd');
    if (!cmdWindow) return;
    
    // 打开窗口
    openWindow('window-cmd');
    
    // 初始化终端（如果还没初始化）
    if (!window.terminal) {
        window.terminal = new TerminalSystem();
        // 解锁第一层（快捷键本身就是第一个 token）
        window.terminal.unlockFirstLayer();
    }
    
    // 聚焦输入框
    setTimeout(() => {
        const input = document.getElementById('terminal-input');
        if (input) {
            input.focus();
            // 再次尝试，防止动画未完成
            setTimeout(() => input.focus(), 300);
        }
    }, 100);
}

// 打开内置浏览器
window.openBrowser = function(url) {
    const browserWindow = document.getElementById('window-browser');
    const browserIframe = document.getElementById('browser-iframe');
    const browserAddress = document.getElementById('browser-address');
    
    if (!browserWindow || !browserIframe) return;
    
    // 更新地址栏和 iframe
    if (browserAddress) browserAddress.value = url;
    browserIframe.src = url;
    
    // 打开窗口
    openWindow('window-browser');
};

// Initialize Recycle Bin State (Restore missing icons)
initRecycleBinState();


