// Window Management Logic

let activeWindowId = null;
const taskbarWindowsEl = document.getElementById('taskbar-windows');
const prefersReducedWindowMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

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
    document.querySelectorAll('.window').forEach(win => {
        win.classList.toggle('is-active', win.id === windowId);
    });
    if (!taskbarWindowsEl) return;
    taskbarWindowsEl.querySelectorAll('.taskbar-window-btn').forEach(btn => {
        btn.classList.toggle('is-active', btn.dataset.windowId === windowId);
    });
}

function activateTopVisibleWindow(excludedId = null) {
    const visible = Array.from(document.querySelectorAll('.window.window-open'))
        .filter(win => win.id !== excludedId)
        .sort((a, b) => (parseInt(b.style.zIndex || '0', 10) - parseInt(a.style.zIndex || '0', 10)));
    setActiveWindow(visible[0]?.id || null);
}

function minimizeWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    const finish = () => {
        win.classList.remove('window-open', 'is-active');
        win.classList.add('window-minimized');
        if (activeWindowId === id) activateTopVisibleWindow(id);
    };

    const taskButton = taskbarWindowsEl?.querySelector(`[data-window-id="${id}"]`);
    if (prefersReducedWindowMotion || typeof win.animate !== 'function' || !taskButton) {
        finish();
        return;
    }

    const from = win.getBoundingClientRect();
    const to = taskButton.getBoundingClientRect();
    const deltaX = to.left + to.width / 2 - (from.left + from.width / 2);
    const deltaY = to.top + to.height / 2 - (from.top + from.height / 2);
    const animation = win.animate([
        { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
        { transform: `translate3d(${deltaX}px,${deltaY}px,0) scale(.14)`, opacity: 0.22 }
    ], { duration: 150, easing: 'cubic-bezier(.4,0,.6,1)' });
    animation.finished.then(finish).catch(finish);
}

function toggleMaximizeWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    const { height: availableHeight } = getWindowViewportBounds();
    const isMax = win.classList.contains('window-maximized');
    win.classList.add('window-geometry-animating');

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
        win.style.height = `${availableHeight}px`;
    } else {
        win.classList.remove('window-maximized');
        win.style.left = win.dataset.restoreLeft || '20%';
        win.style.top = win.dataset.restoreTop || '20%';
        win.style.width = win.dataset.restoreWidth || '400px';
        win.style.height = win.dataset.restoreHeight || '';
    }

    window.setTimeout(() => win.classList.remove('window-geometry-animating'), 190);

    bringToFront(win);
}

function getWindowViewportBounds() {
    const taskbarHeight = document.querySelector('.taskbar')?.offsetHeight || 32;
    return {
        width: window.innerWidth,
        height: Math.max(220, window.innerHeight - taskbarHeight),
        taskbarHeight
    };
}

function clampWindowToViewport(win) {
    if (!win || win.classList.contains('window-maximized')) return;
    const bounds = getWindowViewportBounds();
    const margin = window.innerWidth < 760 ? 6 : 10;
    const maxWidth = Math.max(260, bounds.width - margin * 2);
    const maxHeight = Math.max(200, bounds.height - margin * 2);

    if (win.offsetWidth > maxWidth) {
        win.style.width = `${maxWidth}px`;
    }
    if (win.offsetHeight > maxHeight) {
        win.style.height = `${maxHeight}px`;
    }

    const left = parseInt(win.style.left || `${win.offsetLeft}`, 10) || 0;
    const top = parseInt(win.style.top || `${win.offsetTop}`, 10) || 0;
    const maxLeft = Math.max(margin, bounds.width - win.offsetWidth - margin);
    const maxTop = Math.max(margin, bounds.height - win.offsetHeight - margin);

    win.style.left = `${Math.max(margin, Math.min(left, maxLeft))}px`;
    win.style.top = `${Math.max(margin, Math.min(top, maxTop))}px`;
}

// Hookable openWindow function
let _openWindowHooks = [];
function openWindow(id) {
    const win = document.getElementById(id);
    if (!win) return;
    ensureTaskbarButton(win);
    win.classList.remove('window-minimized');
    win.classList.remove('window-closing');
    win.classList.add('window-open');
    if (win._closeTimer) {
        window.clearTimeout(win._closeTimer);
        win._closeTimer = null;
    }
    bringToFront(win);
    
    // Center window if it's the first open (simple check)
    if (!win.dataset.positioned) {
        const bounds = getWindowViewportBounds();
        const margin = window.innerWidth < 760 ? 6 : 10;
        const maxWidth = Math.max(260, bounds.width - margin * 2);
        const maxHeight = Math.max(200, bounds.height - margin * 2);

        if (win.offsetWidth > maxWidth) {
            win.style.width = `${maxWidth}px`;
        }
        if (win.offsetHeight > maxHeight) {
            win.style.height = `${maxHeight}px`;
        }

        win.style.left = `${Math.max(margin, Math.round((bounds.width - win.offsetWidth) / 2))}px`;
        win.style.top = `${Math.max(margin, Math.round((bounds.height - win.offsetHeight) / 2))}px`;
        win.dataset.positioned = 'true';
    }

    clampWindowToViewport(win);

    if (!prefersReducedWindowMotion) {
        win.classList.remove('window-opening');
        void win.offsetWidth;
        win.classList.add('window-opening');
        window.setTimeout(() => win.classList.remove('window-opening'), 170);
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
    const finish = () => {
        if (win.classList.contains('window-maximized')) {
            win.style.left = win.dataset.restoreLeft || '20%';
            win.style.top = win.dataset.restoreTop || '20%';
            win.style.width = win.dataset.restoreWidth || '400px';
            win.style.height = win.dataset.restoreHeight || '';
        }
        win.classList.remove('window-open', 'window-minimized', 'window-maximized', 'window-closing', 'is-active');
        removeTaskbarButton(id);
        if (activeWindowId === id) activateTopVisibleWindow(id);
        win._closeTimer = null;
    };

    if (prefersReducedWindowMotion || !win.classList.contains('window-open')) {
        finish();
        return;
    }
    win.classList.add('window-closing');
    win._closeTimer = window.setTimeout(finish, 135);
}

function bringToFront(element) {
    if (!element) return;
    if (typeof zIndexCounter === 'undefined') zIndexCounter = 100;
    zIndexCounter++;
    element.style.zIndex = zIndexCounter;
    if (element?.id) setActiveWindow(element.id);
}

// 使用 Pointer Events 与 requestAnimationFrame 合并拖拽更新，避免每次移动都触发布局。
const windowGesture = {
    type: null,
    pointerId: null,
    target: null,
    captureTarget: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0,
    startWidth: 0,
    startHeight: 0,
    nextLeft: 0,
    nextTop: 0,
    nextWidth: 0,
    nextHeight: 0,
    frame: null
};

function resetWindowGesture() {
    if (windowGesture.frame) cancelAnimationFrame(windowGesture.frame);
    windowGesture.target?.classList.remove('window-moving', 'window-resizing');
    if (windowGesture.target && windowGesture.type === 'move') {
        windowGesture.target.style.transform = '';
    }
    windowGesture.type = null;
    windowGesture.pointerId = null;
    windowGesture.target = null;
    windowGesture.captureTarget = null;
    windowGesture.frame = null;
}

function renderWindowGesture() {
    windowGesture.frame = null;
    const win = windowGesture.target;
    if (!win) return;
    if (windowGesture.type === 'move') {
        const dx = windowGesture.nextLeft - windowGesture.startLeft;
        const dy = windowGesture.nextTop - windowGesture.startTop;
        win.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
    } else if (windowGesture.type === 'resize') {
        win.style.width = `${windowGesture.nextWidth}px`;
        win.style.height = `${windowGesture.nextHeight}px`;
    }
}

function scheduleWindowGesture() {
    if (!windowGesture.frame) windowGesture.frame = requestAnimationFrame(renderWindowGesture);
}

document.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const clickedWindow = event.target.closest('.window');
    if (clickedWindow) bringToFront(clickedWindow);

    const resizeHandle = event.target.closest('.resize-handle');
    const titleBar = event.target.closest('.title-bar');
    const win = resizeHandle?.closest('.window') || titleBar?.closest('.window');
    if (!win || event.target.closest('.title-bar-controls')) return;
    if (titleBar && win.classList.contains('window-maximized')) return;

    windowGesture.type = resizeHandle ? 'resize' : 'move';
    windowGesture.pointerId = event.pointerId;
    windowGesture.target = win;
    windowGesture.captureTarget = resizeHandle || titleBar;
    windowGesture.startX = event.clientX;
    windowGesture.startY = event.clientY;
    windowGesture.startLeft = win.offsetLeft;
    windowGesture.startTop = win.offsetTop;
    windowGesture.startWidth = win.offsetWidth;
    windowGesture.startHeight = win.offsetHeight;
    windowGesture.nextLeft = win.offsetLeft;
    windowGesture.nextTop = win.offsetTop;
    windowGesture.nextWidth = win.offsetWidth;
    windowGesture.nextHeight = win.offsetHeight;
    win.classList.add(resizeHandle ? 'window-resizing' : 'window-moving');
    windowGesture.captureTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
});

document.addEventListener('pointermove', (event) => {
    if (!windowGesture.target || event.pointerId !== windowGesture.pointerId) return;
    const bounds = getWindowViewportBounds();
    const dx = event.clientX - windowGesture.startX;
    const dy = event.clientY - windowGesture.startY;

    if (windowGesture.type === 'move') {
        windowGesture.nextLeft = Math.max(0, Math.min(windowGesture.startLeft + dx, bounds.width - windowGesture.startWidth));
        windowGesture.nextTop = Math.max(0, Math.min(windowGesture.startTop + dy, bounds.height - 24));
    } else {
        windowGesture.nextWidth = Math.min(
            Math.max(300, windowGesture.startWidth + dx),
            Math.max(300, bounds.width - windowGesture.startLeft)
        );
        windowGesture.nextHeight = Math.min(
            Math.max(200, windowGesture.startHeight + dy),
            Math.max(200, bounds.height - windowGesture.startTop)
        );
    }
    scheduleWindowGesture();
});

function finishWindowGesture(event) {
    if (!windowGesture.target || event.pointerId !== windowGesture.pointerId) return;
    if (windowGesture.frame) {
        cancelAnimationFrame(windowGesture.frame);
        renderWindowGesture();
    }
    if (windowGesture.type === 'move') {
        windowGesture.target.style.left = `${windowGesture.nextLeft}px`;
        windowGesture.target.style.top = `${windowGesture.nextTop}px`;
    }
    resetWindowGesture();
}

document.addEventListener('pointerup', finishWindowGesture);
document.addEventListener('pointercancel', finishWindowGesture);

document.addEventListener('dblclick', (event) => {
    const titleBar = event.target.closest('.title-bar');
    const win = titleBar?.closest('.window');
    if (win && !event.target.closest('.title-bar-controls')) toggleMaximizeWindow(win.id);
});

// Keep maximized window fit on resize
window.addEventListener('resize', () => {
    document.querySelectorAll('.window.window-maximized').forEach(win => {
        const bounds = getWindowViewportBounds();
        win.style.width = `${window.innerWidth}px`;
        win.style.height = `${bounds.height}px`;
    });
    document.querySelectorAll('.window.window-open:not(.window-maximized)').forEach(clampWindowToViewport);
});

// Dynamic Window Creation Helper
window.createWindow = function({ id, title, icon, content, width = 300, height = 'auto', x, y }) {
    // If window exists, just open it
    let win = document.getElementById(id);
    if (win) {
        openWindow(id);
        return win;
    }

    win = document.createElement('div');
    win.id = id;
    win.className = 'window';
    win.style.width = typeof width === 'number' ? `${width}px` : width;
    if (height !== 'auto') win.style.height = typeof height === 'number' ? `${height}px` : height;
    
    // Default position (center-ish)
    const top = y !== undefined ? y : (window.innerHeight / 2 - 150);
    const left = x !== undefined ? x : (window.innerWidth / 2 - 150);
    win.style.top = `${Math.max(0, top)}px`;
    win.style.left = `${Math.max(0, left)}px`;

    win.dataset.windowTitle = title;
    if (icon) win.dataset.windowIcon = icon;

    win.innerHTML = `
        <div class="title-bar">
            <div class="title-bar-text">${title}</div>
            <div class="title-bar-controls">
                <button aria-label="Close" onclick="closeWindow('${id}')"></button>
            </div>
        </div>
        <div class="window-body">
            ${content}
        </div>
    `;

    document.body.appendChild(win);
    openWindow(id);
    return win;
};

// Unified dialog helper (Win98-styled, non-blocking)
window.showMessageBox = function(options = {}) {
    const {
        id,
        title = '提示',
        icon,
        message = '',
        detail = '',
        width = 360,
        buttons = [{ label: '确定', value: true, primary: true }],
        closeValue = null
    } = options;

    const dialogId = id || `dialog-${Date.now()}`;
    const btnDefs = (Array.isArray(buttons) && buttons.length ? buttons : [{ label: '确定', value: true }]).map((btn, idx) => ({
        label: btn.label || `按钮${idx + 1}`,
        value: typeof btn.value === 'undefined' ? idx : btn.value,
        primary: !!btn.primary
    }));

    const buttonsHtml = btnDefs.map(btn => {
        const primaryClass = btn.primary ? 'message-box-btn-primary' : '';
        return `<button class="${primaryClass}" data-dialog-value="${btn.value}">${btn.label}</button>`;
    }).join('');

    const bodyHtml = `
        <div class="message-box">
            <div class="message-box-main">
                ${icon ? `<img class="message-box-icon" src="${icon}" alt="">` : ''}
                <div class="message-box-text">${message}</div>
            </div>
            ${detail ? `<div class="message-box-detail">${detail}</div>` : ''}
            <div class="message-box-buttons">${buttonsHtml}</div>
        </div>
    `;

    return new Promise((resolve) => {
        let resolved = false;
        const resolveOnce = (val) => {
            if (resolved) return;
            resolved = true;
            resolve(val);
        };

        if (typeof createWindow === 'function') {
            createWindow({ id: dialogId, title, icon, width, content: bodyHtml });

            setTimeout(() => {
                const win = document.getElementById(dialogId);
                if (!win) return;

                win.querySelectorAll('[data-dialog-value]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        resolveOnce(btn.dataset.dialogValue);
                        closeWindow(dialogId);
                    });
                });

                const closeBtn = win.querySelector('.title-bar-controls button');
                if (closeBtn) {
                    closeBtn.addEventListener('click', () => resolveOnce(closeValue));
                }

                const firstBtn = win.querySelector('[data-dialog-value]');
                if (firstBtn) firstBtn.focus();
            }, 30);
        } else {
            // Lightweight fallback when window manager is unavailable
            const overlay = document.createElement('div');
            overlay.id = `${dialogId}-overlay`;
            overlay.className = 'message-box-overlay';
            overlay.innerHTML = `
                <div class="message-box-fallback" style="width: ${width}px;">
                    <div class="title-bar">
                        <div class="title-bar-text">${title}</div>
                        <div class="title-bar-controls"><button aria-label="Close"></button></div>
                    </div>
                    <div class="window-body">${bodyHtml}</div>
                </div>
            `;
            document.body.appendChild(overlay);

            overlay.querySelectorAll('[data-dialog-value]').forEach(btn => {
                btn.addEventListener('click', () => {
                    resolveOnce(btn.dataset.dialogValue);
                    overlay.remove();
                });
            });

            const closeBtn = overlay.querySelector('.title-bar-controls button');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    resolveOnce(closeValue);
                    overlay.remove();
                });
            }

            const firstBtn = overlay.querySelector('[data-dialog-value]');
            if (firstBtn) firstBtn.focus();
        }
    });
};

window.showConfirmDialog = function(options = {}) {
    const {
        title = '确认',
        icon,
        message = '',
        detail = '',
        confirmText = '确定',
        cancelText = '取消',
        width
    } = options;

    return window.showMessageBox({
        title,
        icon,
        message,
        detail,
        width,
        buttons: [
            { label: confirmText, value: true, primary: true },
            { label: cancelText, value: false }
        ],
        closeValue: false
    }).then(val => val === true || val === 'true' || val === '1' || val === confirmText);
};


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
    const browserStatus = document.getElementById('browser-status');
    if (browserStatus) browserStatus.textContent = '正在连接…';
    browserIframe.src = url;
    
    openWindow('window-browser');
};
