// Desktop Logic
// Includes: Icon Dragging, Selection, Context Menus

const desktop = document.getElementById('desktop');
const DESKTOP_STATE_KEY = window.BLANKKE_STATE_KEYS?.desktop || 'blankke_desktop_v2';
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
        icon.classList.add('icon-layout-animating');
        icon.style.left = `${position.left}px`;
        icon.style.top = `${position.top}px`;
        window.setTimeout(() => icon.classList.remove('icon-layout-animating'), 220);
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
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_STATE_KEY) || '{}');
        if (!saved || typeof saved !== 'object') saved = {};
    } catch {
        saved = {};
    }
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
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(DESKTOP_STATE_KEY) || '{}');
        if (!saved || typeof saved !== 'object') saved = {};
    } catch {
        saved = {};
    }
    saved[id] = { left: icon.offsetLeft, top: icon.offsetTop };
    localStorage.setItem(DESKTOP_STATE_KEY, JSON.stringify(saved));
}

let isDraggingIcon = false;
let draggingIcon = null;
let iconDragOffsetX = 0;
let iconDragOffsetY = 0;
let iconDownX = 0;
let iconDownY = 0;
let iconStartLeft = 0;
let iconStartTop = 0;
let iconNextLeft = 0;
let iconNextTop = 0;
let iconPointerId = null;
let iconDragFrame = null;
let selectedIcon = null;
const selectedIcons = new Set();

function clearIconSelection() {
    selectedIcons.forEach((icon) => icon.classList.remove('selected'));
    selectedIcons.clear();
    selectedIcon = null;
}

function selectIcons(icons) {
    clearIconSelection();
    icons.forEach((icon) => {
        if (!icon) return;
        icon.classList.add('selected');
        selectedIcons.add(icon);
    });
    selectedIcon = icons[0] || null;
}

function selectIcon(icon) {
    selectIcons(icon ? [icon] : []);
}

let isSelectingDesktop = false;
let desktopSelectionPointerId = null;
let desktopSelectionStartX = 0;
let desktopSelectionStartY = 0;
let desktopSelectionCurrentX = 0;
let desktopSelectionCurrentY = 0;
let desktopSelectionBox = null;
let desktopSelectionCaptureTarget = null;
let didDrawDesktopSelection = false;

function canStartDesktopSelection(target) {
    if (!(target instanceof Element)) return false;
    return !target.closest([
        '.icon',
        '.window',
        '.taskbar',
        '.start-menu',
        '.context-menu',
        '#icon-context-menu',
        '#top-right-info',
        '.mystery-signal',
        '.message-box-overlay'
    ].join(','));
}

function getDesktopSelectionRect() {
    const left = Math.min(desktopSelectionStartX, desktopSelectionCurrentX);
    const top = Math.min(desktopSelectionStartY, desktopSelectionCurrentY);
    const right = Math.max(desktopSelectionStartX, desktopSelectionCurrentX);
    const bottom = Math.max(desktopSelectionStartY, desktopSelectionCurrentY);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}

function ensureDesktopSelectionBox() {
    if (desktopSelectionBox) return desktopSelectionBox;
    desktopSelectionBox = document.createElement('div');
    desktopSelectionBox.className = 'desktop-selection-box';
    desktopSelectionBox.setAttribute('aria-hidden', 'true');
    document.body.appendChild(desktopSelectionBox);
    return desktopSelectionBox;
}

function updateDesktopSelectionBox() {
    const rect = getDesktopSelectionRect();
    const box = ensureDesktopSelectionBox();
    box.style.left = `${rect.left}px`;
    box.style.top = `${rect.top}px`;
    box.style.width = `${rect.width}px`;
    box.style.height = `${rect.height}px`;
}

function removeDesktopSelectionBox() {
    desktopSelectionBox?.remove();
    desktopSelectionBox = null;
}

function rectsIntersect(a, b) {
    return a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;
}

function updateIconsFromSelectionRect() {
    const selectionRect = getDesktopSelectionRect();
    const icons = getDesktopIcons().filter((icon) => {
        const iconRect = icon.getBoundingClientRect();
        return rectsIntersect(selectionRect, iconRect);
    });
    selectIcons(icons);
}

function startDesktopSelection(event) {
    if (event.button !== 0 || !canStartDesktopSelection(event.target)) return;
    hideContextMenu();
    hideIconContextMenu();
    clearIconSelection();
    isSelectingDesktop = true;
    didDrawDesktopSelection = false;
    desktopSelectionPointerId = event.pointerId;
    desktopSelectionStartX = event.clientX;
    desktopSelectionStartY = event.clientY;
    desktopSelectionCurrentX = event.clientX;
    desktopSelectionCurrentY = event.clientY;
    desktopSelectionCaptureTarget = event.target instanceof Element ? event.target : document.body;
    desktopSelectionCaptureTarget.setPointerCapture?.(event.pointerId);
}

function updateDesktopSelection(event) {
    if (!isSelectingDesktop || event.pointerId !== desktopSelectionPointerId) return;
    const moved = Math.abs(event.clientX - desktopSelectionStartX) + Math.abs(event.clientY - desktopSelectionStartY);
    if (moved < 4 && !didDrawDesktopSelection) return;
    event.preventDefault();
    didDrawDesktopSelection = true;
    desktopSelectionCurrentX = event.clientX;
    desktopSelectionCurrentY = event.clientY;
    updateDesktopSelectionBox();
    updateIconsFromSelectionRect();
}

function finishDesktopSelection(event) {
    if (!isSelectingDesktop || event.pointerId !== desktopSelectionPointerId) return;
    desktopSelectionCaptureTarget?.releasePointerCapture?.(event.pointerId);
    removeDesktopSelectionBox();
    isSelectingDesktop = false;
    desktopSelectionPointerId = null;
    desktopSelectionCaptureTarget = null;
    if (!didDrawDesktopSelection) {
        clearIconSelection();
    }
    didDrawDesktopSelection = false;
}

// Desktop interactions
if (desktop) {
    document.addEventListener('pointerdown', startDesktopSelection);
    document.addEventListener('pointermove', updateDesktopSelection);
    document.addEventListener('pointerup', finishDesktopSelection);
    document.addEventListener('pointercancel', finishDesktopSelection);

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

    icon.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        isDraggingIcon = true;
        draggingIcon = icon;
        iconPointerId = e.pointerId;
        iconDownX = e.clientX;
        iconDownY = e.clientY;
        iconStartLeft = icon.offsetLeft;
        iconStartTop = icon.offsetTop;
        iconNextLeft = iconStartLeft;
        iconNextTop = iconStartTop;
        iconDragOffsetX = e.clientX - iconStartLeft;
        iconDragOffsetY = e.clientY - iconStartTop;
        icon.setPointerCapture?.(e.pointerId);
        selectIcon(icon);
    });
}

// Initial bind
document.querySelectorAll('.icon[data-icon-id]').forEach(icon => {
    bindIconInteractions(icon);
});

function renderIconDrag() {
    iconDragFrame = null;
    if (!draggingIcon) return;
    const dx = iconNextLeft - iconStartLeft;
    const dy = iconNextTop - iconStartTop;
    draggingIcon.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
}

document.addEventListener('pointermove', (e) => {
    if (!isDraggingIcon || !draggingIcon || e.pointerId !== iconPointerId) return;
    const moved = Math.abs(e.clientX - iconDownX) + Math.abs(e.clientY - iconDownY);
    if (moved < 3) return;
    e.preventDefault();
    
    if (!draggingIcon.classList.contains('dragging')) {
        draggingIcon.classList.add('dragging');
    }
    
    const maxLeft = window.innerWidth - draggingIcon.offsetWidth;
    const maxTop = window.innerHeight - 28 - draggingIcon.offsetHeight;
    iconNextLeft = clamp(e.clientX - iconDragOffsetX, 0, maxLeft);
    iconNextTop = clamp(e.clientY - iconDragOffsetY, 0, maxTop);
    if (!iconDragFrame) iconDragFrame = requestAnimationFrame(renderIconDrag);
});

function finishIconDrag(e) {
    if (!isDraggingIcon || e.pointerId !== iconPointerId) return;
    if (isDraggingIcon && draggingIcon) {
        if (iconDragFrame) {
            cancelAnimationFrame(iconDragFrame);
            renderIconDrag();
        }
        if (draggingIcon.classList.contains('dragging')) {
            draggingIcon.style.left = `${iconNextLeft}px`;
            draggingIcon.style.top = `${iconNextTop}px`;
        }
        draggingIcon.style.transform = '';
        draggingIcon.classList.remove('dragging');
        clampIconToViewport(draggingIcon);
        saveIconPosition(draggingIcon);
    }
    isDraggingIcon = false;
    draggingIcon = null;
    iconPointerId = null;
    iconDragFrame = null;
}

document.addEventListener('pointerup', finishIconDrag);
document.addEventListener('pointercancel', finishIconDrag);

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
const ICON_METADATA_KEYS = ['itemType', 'description', 'url', 'opensWith'];

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

function escapeDesktopHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getIconMetadata(icon) {
    return ICON_METADATA_KEYS.reduce((metadata, key) => {
        if (icon.dataset[key]) {
            metadata[key] = icon.dataset[key];
        }
        return metadata;
    }, {});
}

function applyIconMetadata(icon, metadata = {}) {
    ICON_METADATA_KEYS.forEach((key) => {
        if (metadata[key]) {
            icon.dataset[key] = metadata[key];
        }
    });
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
    
    if (copiedIcon.ondblclickAttr) {
        newIcon.setAttribute('ondblclick', copiedIcon.ondblclickAttr);
    } else if (copiedIcon.ondblclick) {
        newIcon.ondblclick = copiedIcon.ondblclick;
    }
    applyIconMetadata(newIcon, copiedIcon.metadata);
    
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
            ondblclick: contextMenuTargetIcon.ondblclick,
            ondblclickAttr: contextMenuTargetIcon.getAttribute('ondblclick'),
            metadata: getIconMetadata(contextMenuTargetIcon)
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
                ondblclick: contextMenuTargetIcon.ondblclick,
                ondblclickAttr: contextMenuTargetIcon.getAttribute('ondblclick'),
                metadata: getIconMetadata(contextMenuTargetIcon)
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
            if (iconId === 'pvz') {
                window.quest?.setFlag('pvz_restored', false);
            }
            if (iconId === 'readme') {
                window.quest?.setFlag('readme_restored', false);
            }
            
            // Remove from localStorage position data
            const saved = JSON.parse(localStorage.getItem(DESKTOP_STATE_KEY) || '{}');
            delete saved[iconId];
            localStorage.setItem(DESKTOP_STATE_KEY, JSON.stringify(saved));
            
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
        const iconType = contextMenuTargetIcon.dataset.itemType || '桌面快捷方式';
        const iconDescription = contextMenuTargetIcon.dataset.description;
        const iconUrl = contextMenuTargetIcon.dataset.url;
        const opensWith = contextMenuTargetIcon.dataset.opensWith;
        const properties = [
            ['名称', iconText],
            ['类型', iconType],
            iconDescription ? ['说明', iconDescription] : null,
            iconUrl ? ['地址', iconUrl] : null,
            opensWith ? ['打开方式', opensWith] : null,
            ['ID', iconId],
            ['位置', `(${contextMenuTargetIcon.offsetLeft}, ${contextMenuTargetIcon.offsetTop})`]
        ].filter(Boolean);
        const message = properties
            .map(([label, value]) => `<div>${escapeDesktopHtml(label)}: ${escapeDesktopHtml(value)}</div>`)
            .join('');
        const fallbackText = properties.map(([label, value]) => `${label}: ${value}`).join('\n');

        if (typeof showMessageBox === 'function') {
            await showMessageBox({
                title: '图标属性',
                icon: iconSrc,
                width: 420,
                message
            });
        } else {
            alert(`图标属性\n\n${fallbackText}`);
        }
    }
    hideIconContextMenu();
});
