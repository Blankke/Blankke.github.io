// Applications Logic
// Includes: Wisdom Tree, Music Player, Gitalk, Terminal Shortcut

// Wisdom Tree
const TREE_HINT_IDX_KEY = 'wisdom_tree_hint_idx_v1';
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
try {
    window.mewmewTalkEnabled = localStorage.getItem('mewmew_talk_enabled_v1') === '1';
} catch {
    // ignore
}

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
        const btn = document.createElement('button');
        btn.className = 'btn music-track-btn';
        btn.textContent = title;
        btn.dataset.trackIndex = String(idx);
        btn.addEventListener('click', () => playTrackByIndex(idx));

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
