// Applications Logic
// Includes: Wisdom Tree, Music Player, Gitalk, Terminal Shortcut

// Wisdom Tree
const TREE_HINT_IDX_KEY = 'wisdom_tree_hint_idx_v1';
const wisdomTreeHints = [
    '……',
    '提示 1：这里的扫雷之前最快纪录是50秒，打破它会怎么样？',
    '提示 2：那只猫以前是会说话的，你知道吗？',
    '提示 3：之前的人在这个电脑上干了什么可以从“历史”里看见',
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

if (typeof addOpenWindowHook === 'function') {
    addOpenWindowHook((id) => {
        if (id === 'window-wisdomtree') {
            onOpenWisdomTree();
        }
    });
}

// Music Player
const musicListEl = document.getElementById('music-list');
const musicAudioEl = document.getElementById('music-audio');
const musicNowTitleEl = document.getElementById('music-now-title');
const musicStatusEl = document.getElementById('music-status');
const musicPrevEl = document.getElementById('music-prev');
const musicNextEl = document.getElementById('music-next');
const musicPlayEl = document.getElementById('music-play');
const musicPauseEl = document.getElementById('music-pause');
const musicLoopEl = document.getElementById('music-loop');

window.mewmewTalkEnabled = false;
// No persistence for MewMew talk state - resets on reload

let trackContextMenu = null;

function ensureTrackContextMenu() {
    if (trackContextMenu) return trackContextMenu;
    trackContextMenu = document.createElement('div');
    trackContextMenu.id = 'track-context-menu';
    trackContextMenu.className = 'context-menu';
    trackContextMenu.style.display = 'none';
    document.body.appendChild(trackContextMenu);

    document.addEventListener('click', (e) => {
        if (!trackContextMenu.contains(e.target)) {
            trackContextMenu.style.display = 'none';
        }
    });

    return trackContextMenu;
}

function showTrackContextMenu(x, y, track, index) {
    const menu = ensureTrackContextMenu();
    menu.innerHTML = ''; // Clear previous items

    // Play Item
    const playItem = document.createElement('div');
    playItem.className = 'context-menu-item';
    playItem.textContent = '播放(P)';
    playItem.addEventListener('click', () => {
        playTrackByIndex(index);
        menu.style.display = 'none';
    });
    menu.appendChild(playItem);

    // Separator
    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    menu.appendChild(sep);

    // Properties Item
    const propItem = document.createElement('div');
    propItem.className = 'context-menu-item';
    propItem.textContent = '属性(R)';
    propItem.addEventListener('click', () => {
        showTrackProperties(track);
        menu.style.display = 'none';
    });
    menu.appendChild(propItem);

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
}

function showTrackProperties(track) {
    const title = track.title || track.file || 'Unknown Track';
    
    // Check if it's American Pie (case-insensitive check)
    if (title.toLowerCase().includes('american pie')) {
        // Show special properties dialog with MewMew toggle
        showMewMewPropertiesDialog(title);
    } else {
        // Show generic properties
        alert(`属性:\n\n标题: ${title}\n文件: ${track.file}\n类型: MP3 Audio`);
    }
}

function showMewMewPropertiesDialog(title) {
    // Create a custom modal for properties
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.zIndex = '9999';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    
    // Window structure
    const win = document.createElement('div');
    win.className = 'window';
    win.style.width = '300px';
    win.style.boxShadow = '2px 2px 10px rgba(0,0,0,0.5)';
    
    win.innerHTML = `
        <div class="title-bar">
            <div class="title-bar-text">属性 - ${title}</div>
            <div class="title-bar-controls">
                <button aria-label="Close" class="close-btn"></button>
            </div>
        </div>
        <div class="window-body">
            <p>文件: ${title}</p>
            <p>类型: MP3 Audio</p>
            <br>
            <fieldset>
                <legend>高级设置</legend>
                <div class="field-row">
                    <input type="checkbox" id="prop-mewmew-toggle">
                    <label for="prop-mewmew-toggle">启用 MewMew 对话</label>
                </div>
            </fieldset>
            <br>
            <div style="text-align: right;">
                <button id="prop-ok-btn">确定</button>
            </div>
        </div>
    `;
    
    overlay.appendChild(win);
    document.body.appendChild(overlay);
    
    const closeBtn = win.querySelector('.close-btn');
    const okBtn = win.querySelector('#prop-ok-btn');
    const toggle = win.querySelector('#prop-mewmew-toggle');
    
    toggle.checked = window.mewmewTalkEnabled;
    
    const close = () => {
        window.mewmewTalkEnabled = toggle.checked;
        document.body.removeChild(overlay);
    };
    
    closeBtn.addEventListener('click', close);
    okBtn.addEventListener('click', close);
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
        const btn = document.createElement('button');
        btn.className = 'btn music-track-btn';
        btn.textContent = title;
        btn.dataset.trackIndex = String(idx);
        btn.addEventListener('click', () => playTrackByIndex(idx));

        // Add context menu to ALL tracks
        btn.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTrackContextMenu(e.clientX, e.clientY, track, idx);
        });

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
            musicStatusEl.textContent = '循环播放';
            return;
        }
        musicStatusEl.textContent = '播放结束';
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

// Gitalk
const gitalk = new Gitalk({
  clientID: 'Ov23lifhLcm9lmBzlp1d',
  clientSecret: 'f9152db39b5d9b851839ee606371d9171c29a608',
  repo: 'Blankke.github.io',
  owner: 'Blankke',
  admin: ['Blankke'],
  id: 'guestbook',
  distractionFreeMode: false
});

try {
    gitalk.render('gitalk-container');
} catch (e) {
    console.error("Gitalk render failed:", e);
}

// Shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl+Alt+C
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        if (typeof openCMD === 'function') openCMD();
    }
});

// Minesweeper Message Listener
window.addEventListener('message', (event) => {
    if (!window.desktopPet) return;

    if (event.data.type === 'minesweeper-win') {
        window.desktopPet.onMinesweeperWin(event.data.time);
    } else if (event.data.type === 'minesweeper-loss') {
        window.desktopPet.onMinesweeperLoss();
    } else if (event.data.type === 'minesweeper-active') {
        window.desktopPet.resetMinesweeperIdleTimer();
    }
});
