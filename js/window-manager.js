// Window Management Logic

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

// Hookable openWindow function
let _openWindowHooks = [];
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

    // Run hooks (for apps like Recycle Bin or Wisdom Tree to react)
    _openWindowHooks.forEach(hook => hook(id));
}

function addOpenWindowHook(fn) {
    _openWindowHooks.push(fn);
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
    if (typeof zIndexCounter === 'undefined') zIndexCounter = 100;
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

// Keep maximized window fit on resize
window.addEventListener('resize', () => {
    document.querySelectorAll('.window.window-maximized').forEach(win => {
        win.style.width = `${window.innerWidth}px`;
        win.style.height = `${window.innerHeight - 32}px`;
    });
});

// Common Window Openers
function openCMD() {
    const cmdWindow = document.getElementById('window-cmd');
    if (!cmdWindow) return;
    
    openWindow('window-cmd');
    
    if (!window.terminal) {
        if (typeof TerminalSystem !== 'undefined') {
            window.terminal = new TerminalSystem();
            window.terminal.unlockFirstLayer();
        }
    }
    
    setTimeout(() => {
        const input = document.getElementById('terminal-input');
        if (input) {
            input.focus();
            setTimeout(() => input.focus(), 300);
        }
    }, 100);
}

window.openBrowser = function(url) {
    const browserWindow = document.getElementById('window-browser');
    const browserIframe = document.getElementById('browser-iframe');
    const browserAddress = document.getElementById('browser-address');
    
    if (!browserWindow || !browserIframe) return;
    
    if (browserAddress) browserAddress.value = url;
    browserIframe.src = url;
    
    openWindow('window-browser');
};
