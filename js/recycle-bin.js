// Recycle Bin Logic

const RECYCLE_KEY = 'recycle_bin_items_v1';
const PVZ_RESTORED_KEY = 'pvz_restored_v1';
const README_RESTORED_KEY = 'readme_restored_v1';

const recycleBinDefaults = ['readme', 'pvz'];
const recycleBinCatalog = {
    readme: {
        id: 'readme',
        name: 'readme.txt',
        icon: 'assets/icon/notepad-5.png',
        preview: 'readme.txt\n\n我本来想写一个提示系统……\n写到一半又觉得太直白。\n\n最后我决定：把它删掉。\n\n（但是它为什么还在回收站里？）\n',
        canRestore: true,
        restoreData: { 
            type: 'desktop-icon',
            content: '<img src="assets/icon/notepad-5.png" alt="readme"><div class="icon-text">readme.txt</div>',
            ondblclick: function() { openRecycleReadme(); },
            left: 20,
            top: 320
        }
    },
    pvz: {
        id: 'pvz',
        name: 'PlantsVsZombies.lnk',
        icon: 'assets/icon/pvz_icon.png',
        preview: '一个奇怪的快捷方式。\n右键它，也许会有“还原”。',
        canRestore: true,
        restoreData: { type: 'desktop-icon' }
    }
};

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
    img.src = items.length ? 'assets/icon/recycle_bin_full.png' : 'assets/icon/recycle_bin_empty.png';
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
    if (textarea && !textarea.dataset.initialized) {
        textarea.value = recycleBinCatalog.readme.preview;
        textarea.dataset.initialized = 'true';
    }
    openWindow('window-recycle-readme');
}

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
            // localStorage.setItem(PVZ_RESTORED_KEY, '1'); // No persistence for puzzle items
            icon.dataset.defaultLeft = '120';
            icon.dataset.defaultTop = '120';
            icon.setAttribute('ondblclick', "openWindow('window-wisdomtree')");
            icon.innerHTML = `
                <img src="assets/icon/pvz_icon.png" alt="PVZ">
                <div class="icon-text">植物大战僵尸</div>
            `;
        } else {
            if (itemId === 'readme') {
                // localStorage.setItem(README_RESTORED_KEY, '1'); // No persistence for puzzle items
            }
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
        if (typeof bindIconInteractions === 'function') {
            bindIconInteractions(icon);
        }
        if (typeof loadIconPositions === 'function') {
            loadIconPositions();
        }
    }

    renderRecycleBin();
}

function initRecycleBinState() {
    // 1. Check PVZ
    // const pvzRestored = localStorage.getItem(PVZ_RESTORED_KEY) === '1';
    const pvzRestored = false; // Always reset to recycle bin on reload
    let items = getRecycleItems();
    let changed = false;

    if (pvzRestored) {
        if (!document.getElementById('icon-pvz')) {
            restoreRecycleItem('pvz');
        }
        const currentItems = getRecycleItems();
        if (currentItems.includes('pvz')) {
            items = currentItems.filter(id => id !== 'pvz');
            changed = true;
        } else {
            items = currentItems;
        }
    } else {
        if (!items.includes('pvz')) {
            items.push('pvz');
            changed = true;
        }
    }

    // 2. Check Readme
    // const readmeRestored = localStorage.getItem(README_RESTORED_KEY) === '1';
    const readmeRestored = false; // Always reset to recycle bin on reload

    if (readmeRestored) {
        if (!document.getElementById('icon-readme')) {
            restoreRecycleItem('readme');
        }
        const currentItems = getRecycleItems();
        if (currentItems.includes('readme')) {
            items = currentItems.filter(id => id !== 'readme');
            changed = true;
        } else {
            items = currentItems;
        }
    } else {
        if (!items.includes('readme')) {
            items.push('readme');
            changed = true;
        }
    }

    if (changed) {
        setRecycleItems(items);
    }
    
    renderRecycleBin();
}

// Hook into openWindow to refresh recycle bin
if (typeof addOpenWindowHook === 'function') {
    addOpenWindowHook((id) => {
        if (id === 'window-recyclebin') {
            renderRecycleBin();
        }
    });
}
