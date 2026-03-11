// Desktop Logic
// Includes: Icon Dragging, Selection, Context Menus

const desktop = document.getElementById('desktop');
const DESKTOP_ICON_LAYOUT = {
    baseScale: 1,
    minScale: 0.65,
    scaleStep: 0.05,
    startX: 20,
    startY: 20,
    columnGap: 100,
    rowGap: 90,
    estimatedWidth: 84,
    estimatedHeight: 74,
    paddingRight: 12,
    paddingBottom: 12,
    taskbarFallbackHeight: 32
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getDesktopIcons() {
    return Array.from(document.querySelectorAll('.icon[data-icon-id]'));
}

function getTaskbarHeight() {
    return document.querySelector('.taskbar')?.offsetHeight || DESKTOP_ICON_LAYOUT.taskbarFallbackHeight;
}

function getDesktopViewport() {
    const width = desktop?.clientWidth || window.innerWidth;
    const height = (desktop?.clientHeight || window.innerHeight) - getTaskbarHeight();
    return {
        width: Math.max(width, DESKTOP_ICON_LAYOUT.estimatedWidth),
        height: Math.max(height, DESKTOP_ICON_LAYOUT.estimatedHeight)
    };
}

function getRowsPerColumn(scale) {
    const { height } = getDesktopViewport();
    const startY = DESKTOP_ICON_LAYOUT.startY * scale;
    const maxTop = height - DESKTOP_ICON_LAYOUT.estimatedHeight * scale - DESKTOP_ICON_LAYOUT.paddingBottom;

    if (maxTop <= startY) {
        return 1;
    }

    return Math.max(1, Math.floor((maxTop - startY) / (DESKTOP_ICON_LAYOUT.rowGap * scale)) + 1);
}

function getColumnsPerRow(scale) {
    const { width } = getDesktopViewport();
    const startX = DESKTOP_ICON_LAYOUT.startX * scale;
    const maxLeft = width - DESKTOP_ICON_LAYOUT.estimatedWidth * scale - DESKTOP_ICON_LAYOUT.paddingRight;

    if (maxLeft <= startX) {
        return 1;
    }

    return Math.max(1, Math.floor((maxLeft - startX) / (DESKTOP_ICON_LAYOUT.columnGap * scale)) + 1);
}

function computeAdaptiveIconScale(iconCount = getDesktopIcons().length) {
    if (iconCount <= 1) {
        return DESKTOP_ICON_LAYOUT.baseScale;
    }

    for (let scale = DESKTOP_ICON_LAYOUT.baseScale; scale >= DESKTOP_ICON_LAYOUT.minScale; scale -= DESKTOP_ICON_LAYOUT.scaleStep) {
        const rows = getRowsPerColumn(scale);
        const cols = getColumnsPerRow(scale);
        if (rows * cols >= iconCount) {
            return Number(scale.toFixed(2));
        }
    }

    return DESKTOP_ICON_LAYOUT.minScale;
}

function applyDesktopIconScale(iconCount = getDesktopIcons().length) {
    const scale = computeAdaptiveIconScale(iconCount);
    document.body.style.setProperty('--desktop-icon-scale', String(scale));
    return scale;
}

function getArrangedIconPosition(index, scale, rowsPerColumn = getRowsPerColumn(scale)) {
    const row = index % rowsPerColumn;
    const column = Math.floor(index / rowsPerColumn);
    return {
        left: Math.round(DESKTOP_ICON_LAYOUT.startX * scale + column * DESKTOP_ICON_LAYOUT.columnGap * scale),
        top: Math.round(DESKTOP_ICON_LAYOUT.startY * scale + row * DESKTOP_ICON_LAYOUT.rowGap * scale)
    };
}

function clampIconToViewport(icon) {
    const { width, height } = getDesktopViewport();
    const left = parseInt(icon.style.left || '0', 10) || 0;
    const top = parseInt(icon.style.top || '0', 10) || 0;
    const maxLeft = Math.max(0, Math.floor(width - icon.offsetWidth - DESKTOP_ICON_LAYOUT.paddingRight));
    const maxTop = Math.max(0, Math.floor(height - icon.offsetHeight - DESKTOP_ICON_LAYOUT.paddingBottom));
    const clampedLeft = clamp(left, 0, maxLeft);
    const clampedTop = clamp(top, 0, maxTop);

    icon.style.left = `${clampedLeft}px`;
    icon.style.top = `${clampedTop}px`;
    return clampedLeft !== left || clampedTop !== top;
}

function arrangeDesktopIcons(options = {}) {
    const { persist = true } = options;
    const icons = getDesktopIcons();
    const scale = applyDesktopIconScale(icons.length);
    const rowsPerColumn = getRowsPerColumn(scale);

    icons.forEach((icon, index) => {
        const position = getArrangedIconPosition(index, scale, rowsPerColumn);
        icon.style.left = `${position.left}px`;
        icon.style.top = `${position.top}px`;
        if (persist) {
            saveIconPosition(icon);
        }
    });
}

function keepIconsInViewport() {
    const icons = getDesktopIcons();
    applyDesktopIconScale(icons.length);

    let outOfBoundsCount = 0;
    icons.forEach((icon) => {
        if (clampIconToViewport(icon)) {
            outOfBoundsCount += 1;
        }
    });

    if (outOfBoundsCount > 0) {
        arrangeDesktopIcons({ persist: true });
    }
}

function loadIconPositions() {
    const saved = JSON.parse(localStorage.getItem('win98_desktop_icons') || '{}');
    const icons = getDesktopIcons();
    const scale = applyDesktopIconScale(icons.length);

    icons.forEach((icon, index) => {
        const id = icon.dataset.iconId;
        const fallbackPosition = getArrangedIconPosition(index, scale);
        const fallbackLeft = parseInt(icon.dataset.defaultLeft || String(fallbackPosition.left), 10);
        const fallbackTop = parseInt(icon.dataset.defaultTop || String(fallbackPosition.top), 10);
        const pos = saved[id] || { left: fallbackLeft, top: fallbackTop };
        icon.style.left = `${pos.left}px`;
        icon.style.top = `${pos.top}px`;
    });

    keepIconsInViewport();
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
let selectedIcon = null;

function selectIcon(icon) {
    if (selectedIcon) {
        selectedIcon.classList.remove('selected');
    }
    selectedIcon = icon;
    if (icon) {
        icon.classList.add('selected');
    }
}

// Desktop interactions
if (desktop) {
    desktop.addEventListener('click', (e) => {
        if (e.target.id === 'desktop' || e.target === document.body) {
            selectIcon(null);
        }
    });

    desktop.addEventListener('dblclick', (e) => {
        if (e.target.id === 'desktop' || e.target === document.body) {
            arrangeDesktopIcons({ persist: true });
        }
    });
}

// Icon interactions
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

// Initial bind
document.querySelectorAll('.icon[data-icon-id]').forEach(icon => {
    bindIconInteractions(icon);
});

document.addEventListener('mousemove', (e) => {
    if (!isDraggingIcon || !draggingIcon) return;
    const moved = Math.abs(e.clientX - iconDownX) + Math.abs(e.clientY - iconDownY);
    if (moved < 3) return;
    e.preventDefault();
    
    if (!draggingIcon.classList.contains('dragging')) {
        draggingIcon.classList.add('dragging');
    }
    
    const maxLeft = window.innerWidth - draggingIcon.offsetWidth;
    const maxTop = window.innerHeight - 28 - draggingIcon.offsetHeight;
    const left = clamp(e.clientX - iconDragOffsetX, 0, maxLeft);
    const top = clamp(e.clientY - iconDragOffsetY, 0, maxTop);
    draggingIcon.style.left = `${left}px`;
    draggingIcon.style.top = `${top}px`;
});

document.addEventListener('mouseup', () => {
    if (isDraggingIcon && draggingIcon) {
        draggingIcon.classList.remove('dragging');
        clampIconToViewport(draggingIcon);
        saveIconPosition(draggingIcon);
    }
    isDraggingIcon = false;
    draggingIcon = null;
});

window.addEventListener('resize', () => {
    keepIconsInViewport();
});

window.refreshDesktopIconLayout = function(options = {}) {
    if (options.arrange) {
        arrangeDesktopIcons({ persist: true });
        return;
    }

    keepIconsInViewport();
};

// Context Menus
const contextMenu = document.getElementById('context-menu');
const iconContextMenu = document.getElementById('icon-context-menu');
let copiedIcon = null;
let contextMenuTargetIcon = null;

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

function showContextMenu(x, y) {
    if (!contextMenu) return;
    hideIconContextMenu();
    updatePasteButton();
    contextMenu.style.display = 'block';
    contextMenu.style.left = `${x}px`;
    contextMenu.style.top = `${y}px`;
    
    const rect = contextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        contextMenu.style.left = `${window.innerWidth - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        contextMenu.style.top = `${window.innerHeight - rect.height}px`;
    }
}

function showIconContextMenu(x, y, icon) {
    if (!iconContextMenu) return;
    hideContextMenu();
    contextMenuTargetIcon = icon;
    iconContextMenu.style.display = 'block';
    iconContextMenu.style.left = `${x}px`;
    iconContextMenu.style.top = `${y}px`;
    
    const rect = iconContextMenu.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
        iconContextMenu.style.left = `${window.innerWidth - rect.width}px`;
    }
    if (rect.bottom > window.innerHeight) {
        iconContextMenu.style.top = `${window.innerHeight - rect.height}px`;
    }
}

function hideContextMenu() {
    if (contextMenu) contextMenu.style.display = 'none';
}

function hideIconContextMenu() {
    if (iconContextMenu) iconContextMenu.style.display = 'none';
    contextMenuTargetIcon = null;
}
 
document.addEventListener('contextmenu', (e) => {
    const icon = e.target.closest('.icon[data-icon-id]');
    if (icon) {
        e.preventDefault();
        selectIcon(icon);
        showIconContextMenu(e.clientX, e.clientY, icon);
        return;
    }
    
    if (e.target === document.body || e.target.id === 'desktop' || e.target.closest('.desktop-icons')) {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
    }
});

document.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target) && iconContextMenu && !iconContextMenu.contains(e.target)) {
        hideContextMenu();
        hideIconContextMenu();
    }
});

// Context Menu Actions
document.getElementById('ctx-arrange')?.addEventListener('click', () => {
    arrangeDesktopIcons({ persist: true });
    hideContextMenu();
});

document.getElementById('ctx-refresh')?.addEventListener('click', () => {
    location.reload();
    hideContextMenu();
});

document.getElementById('ctx-paste')?.addEventListener('click', () => {
    if (!copiedIcon) return;
    
    const newIcon = document.createElement('div');
    newIcon.className = 'icon';
    
    const timestamp = Date.now();
    const newId = `icon-copy-${timestamp}`;
    const newDataId = `copy-${timestamp}`;
    
    newIcon.id = newId;
    newIcon.dataset.iconId = newDataId;
    
    const offsetX = 80;
    const offsetY = 80;
    newIcon.dataset.defaultLeft = String(copiedIcon.left + offsetX);
    newIcon.dataset.defaultTop = String(copiedIcon.top + offsetY);
    newIcon.style.left = `${copiedIcon.left + offsetX}px`;
    newIcon.style.top = `${copiedIcon.top + offsetY}px`;
    
    newIcon.innerHTML = copiedIcon.content;
    
    if (copiedIcon.ondblclick) {
        newIcon.ondblclick = copiedIcon.ondblclick;
    }
    
    document.getElementById('desktop').appendChild(newIcon);
    bindIconInteractions(newIcon);
    saveIconPosition(newIcon);
    window.refreshDesktopIconLayout();
    
    hideContextMenu();
});

document.getElementById('ctx-properties')?.addEventListener('click', async () => {
    if (typeof showMessageBox === 'function') {
        await showMessageBox({
            title: '桌面属性',
            width: 380,
            message: `
                <div>分辨率: ${window.innerWidth} x ${window.innerHeight}</div>
                <div>颜色: 32 位</div>
                <div>适配器: GitHub Pages Accelerator</div>
            `
        });
    } else {
        alert('桌面属性\n\n分辨率: ' + window.innerWidth + ' x ' + window.innerHeight + '\n颜色: 32 位\n适配器: GitHub Pages Accelerator');
    }
    hideContextMenu();
});

document.getElementById('icon-ctx-open')?.addEventListener('click', () => {
    if (contextMenuTargetIcon) {
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

document.getElementById('icon-ctx-delete')?.addEventListener('click', async () => {
    if (contextMenuTargetIcon && contextMenuTargetIcon.dataset.iconId) {
        const iconId = contextMenuTargetIcon.dataset.iconId;
        const iconName = contextMenuTargetIcon.querySelector('.icon-text')?.textContent || iconId;
        const iconImg = contextMenuTargetIcon.querySelector('img');
        const iconSrc = iconImg ? iconImg.getAttribute('src') : 'assets/icon/settings_gear-4.png';
        
        const confirmed = typeof showConfirmDialog === 'function'
            ? await showConfirmDialog({
                title: '删除到回收站',
                icon: 'assets/icon/recycle_bin_full.png',
                message: `确定要删除 "${iconName}" 吗？`,
                detail: '删除的图标将移至回收站。',
                width: 380
            })
            : confirm(`确定要删除 "${iconName}" 吗?\n\n删除的图标将移至回收站。`);

        if (confirmed) {
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
            if (typeof addIconToRecycleBin === 'function') {
                addIconToRecycleBin(iconId, iconData);
                const items = getRecycleItems();
                if (!items.includes(iconId)) {
                    items.push(iconId);
                    setRecycleItems(items);
                }
            }
            
            // Clear PVZ/Readme restored flag
            if (iconId === 'pvz') localStorage.removeItem('pvz_restored_v1');
            if (iconId === 'readme') localStorage.removeItem('readme_restored_v1');
            
            // Remove from localStorage position data
            const saved = JSON.parse(localStorage.getItem('win98_desktop_icons') || '{}');
            delete saved[iconId];
            localStorage.setItem('win98_desktop_icons', JSON.stringify(saved));
            
            // Remove from DOM
            contextMenuTargetIcon.remove();
            window.refreshDesktopIconLayout();
            
            // Update recycle bin icon
            if (typeof updateRecycleBinDesktopIcon === 'function') {
                updateRecycleBinDesktopIcon();
            }
        }
    }
    hideIconContextMenu();
});

document.getElementById('icon-ctx-properties')?.addEventListener('click', async () => {
    if (contextMenuTargetIcon) {
        const iconText = contextMenuTargetIcon.querySelector('.icon-text')?.textContent || '未知';
        const iconId = contextMenuTargetIcon.dataset.iconId || 'unknown';
        const iconImg = contextMenuTargetIcon.querySelector('img');
        const iconSrc = iconImg ? iconImg.getAttribute('src') : undefined;

        if (typeof showMessageBox === 'function') {
            await showMessageBox({
                title: '图标属性',
                icon: iconSrc,
                width: 360,
                message: `名称: ${iconText}<br>ID: ${iconId}<br>位置: (${contextMenuTargetIcon.offsetLeft}, ${contextMenuTargetIcon.offsetTop})`
            });
        } else {
            alert(`图标属性\n\n名称: ${iconText}\nID: ${iconId}\n位置: (${contextMenuTargetIcon.offsetLeft}, ${contextMenuTargetIcon.offsetTop})`);
        }
    }
    hideIconContextMenu();
});
