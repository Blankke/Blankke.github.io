// Applications Logic
// Includes: Wisdom Tree, Music Player, Gitalk, Terminal Shortcut

// Wisdom Tree
const TREE_HINT_IDX_KEY = 'wisdom_tree_hint_idx_v1';
const wisdomTreeHints = [
    '……',
    '提示 1：这里的扫雷之前最快纪录是50秒，打破它会怎么样？',
    '提示 2：那只猫以前是会说话的，你知道吗？',
    '提示 3：之前的人在这个电脑上干了什么可以从“历史”里看见。',
    '提示 4：”I\'m in the INTERNET“可能是在说答案的位置。'
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
    // Ensure track is an object
    if (!track || typeof track !== 'object') {
        track = { title: 'Error', file: 'Error' };
    }

    const title = track.title || track.file || 'Unknown Track';
    // Loose matching for "American Pie"
    const isAmericanPie = title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('americanpie');
    
    // Close existing properties window if any (to allow switching or refreshing)
    if (typeof closeWindow === 'function') {
        closeWindow('window-track-properties');
    }

    let content = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
                <img src="icon/cd_player.png" style="width: 32px; height: 32px;">
                <div>
                    <p><strong>${title}</strong></p>
                    <p>类型: MP3 Audio</p>
                    <p>位置: music/</p>
                </div>
            </div>
            <div style="border-top: 1px solid #808080; border-bottom: 1px solid #fff; margin: 5px 0;"></div>
            <div style="display: grid; grid-template-columns: 80px 1fr; gap: 5px; font-size: 12px;">
                <div>文件名:</div>
                <div>${track.file}</div>
                <div>大小:</div>
                <div>未知</div>
            </div>
    `;

    if (isAmericanPie) {
        content += `
            <br>
            <fieldset>
                <legend>高级设置</legend>
                <div class="field-row">
                    <input type="checkbox" id="prop-mewmew-toggle">
                    <label for="prop-mewmew-toggle">启用 MewMew 对话</label>
                </div>
                <p style="margin-top: 6px; color: gray; font-size: 11px;">* 勾选后点击猫咪即可对话</p>
            </fieldset>
        `;
    }

    content += `
            <br>
            <div style="text-align: right;">
                <button id="prop-ok-btn" style="min-width: 60px;">确定</button>
            </div>
        </div>
    `;

    if (typeof createWindow === 'function') {
        createWindow({
            id: 'window-track-properties',
            title: '属性',
            icon: 'icon/settings_gear-4.png',
            width: 350,
            content: content
        });

        // Bind events after creation
        setTimeout(() => {
            const win = document.getElementById('window-track-properties');
            if (!win) return;

            const okBtn = win.querySelector('#prop-ok-btn');
            if (okBtn) {
                okBtn.addEventListener('click', () => closeWindow('window-track-properties'));
            }

            if (isAmericanPie) {
                const toggle = win.querySelector('#prop-mewmew-toggle');
                if (toggle) {
                    toggle.checked = window.mewmewTalkEnabled;
                    toggle.addEventListener('change', () => {
                        window.mewmewTalkEnabled = toggle.checked;
                    });
                }
            }
        }, 50); // Increased timeout slightly to ensure DOM is ready
    } else {
        // Fallback if window manager not ready
        alert(`属性:\n\n标题: ${title}\n文件: ${track.file}`);
    }
}

// Removed showMewMewPropertiesDialog as it is now integrated into showTrackProperties

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
