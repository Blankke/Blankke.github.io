// Desktop Logic
// Includes: Icon Dragging, Selection, Context Menus

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
            // Auto arrange
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
        saveIconPosition(draggingIcon);
    }
    isDraggingIcon = false;
    draggingIcon = null;
});

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
        const iconSrc = iconImg ? iconImg.getAttribute('src') : 'icon/settings_gear-4.png';
        
        const confirmed = typeof showConfirmDialog === 'function'
            ? await showConfirmDialog({
                title: '删除到回收站',
                icon: 'icon/recycle_bin_full.png',
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
