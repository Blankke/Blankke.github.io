// Core System Logic
// Includes: State, Clock, Boot Toast, Start Menu

// State
let zIndexCounter = 100;

// Shared local state for hidden progress and small app preferences.
window.BLANKKE_STATE_KEYS = {
    desktop: 'blankke_desktop_v2',
    recycle: 'blankke_recycle_v2',
    recycleCatalog: 'blankke_recycle_catalog_v2',
    quest: 'blankke_quest_v2',
    library: 'blankke_library_v2',
    minesweeper: 'blankke_minesweeper_v2',
    effects: 'blankke_effects_v1'
};

window.quest = (function() {
    const key = window.BLANKKE_STATE_KEYS.quest;

    function read() {
        try {
            const parsed = JSON.parse(localStorage.getItem(key) || '{}');
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    function write(state) {
        localStorage.setItem(key, JSON.stringify(state));
        window.dispatchEvent(new CustomEvent('quest:changed', { detail: state }));
    }

    return {
        getState: read,
        get(name, fallback = undefined) {
            const state = read();
            return Object.prototype.hasOwnProperty.call(state, name) ? state[name] : fallback;
        },
        set(name, value) {
            const state = read();
            state[name] = value;
            write(state);
        },
        hasFlag(name) {
            return !!read()[name];
        },
        setFlag(name, value = true) {
            const state = read();
            state[name] = !!value;
            write(state);
        },
        reset() {
            localStorage.removeItem(key);
            window.dispatchEvent(new CustomEvent('quest:changed', { detail: {} }));
        }
    };
})();

// Clock
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('taskbar-time');
    if (el) el.innerText = timeString;
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

if (startButton && startMenu) {
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
}

window.openSettingsWindow = function() {
    if (typeof createWindow !== 'function') return;

    const existing = document.getElementById('window-settings');
    if (existing) {
        openWindow('window-settings');
        return;
    }

    createWindow({
        id: 'window-settings',
        title: '设置',
        icon: 'assets/icon/settings_gear-4.png',
        width: 420,
        content: `
            <div class="message-box">
                <fieldset>
                    <legend>桌面</legend>
                    <p>图标位置、窗口排列和本地状态会保存在这台浏览器中。</p>
                    <div class="message-box-buttons" style="justify-content: flex-start;">
                        <button id="settings-arrange-icons" type="button">排列图标</button>
                        <button id="settings-reset-desktop" type="button">重置桌面布局</button>
                    </div>
                </fieldset>
                <fieldset style="margin-top: 10px;">
                    <legend>视觉效果</legend>
                    <p>切换桌面背景上的动态特效，不会影响窗口、宠物或隐藏入口。</p>
                    <div class="message-box-buttons" style="justify-content: flex-start;">
                        <button id="settings-effects" type="button">桌面特效...</button>
                    </div>
                </fieldset>
                <fieldset style="margin-top: 10px;">
                    <legend>本地数据</legend>
                    <p>清理普通界面状态，不会改变网页文件本身。</p>
                    <div class="message-box-buttons" style="justify-content: flex-start;">
                        <button id="settings-clear-ui" type="button">清除界面状态</button>
                    </div>
                </fieldset>
                <div class="status-bar" style="margin-top: 10px;">
                    <p class="status-bar-field">Preferences stored locally</p>
                </div>
            </div>
        `
    });

    setTimeout(() => {
        document.getElementById('settings-arrange-icons')?.addEventListener('click', () => {
            if (typeof window.refreshDesktopIconLayout === 'function') {
                window.refreshDesktopIconLayout({ arrange: true });
            }
        });

        document.getElementById('settings-reset-desktop')?.addEventListener('click', () => {
            localStorage.removeItem(window.BLANKKE_STATE_KEYS.desktop);
            localStorage.removeItem('win98_desktop_icons');
            if (typeof loadIconPositions === 'function') loadIconPositions();
        });

        document.getElementById('settings-effects')?.addEventListener('click', () => {
            if (window.desktopEffects?.openSettings) {
                window.desktopEffects.openSettings();
            }
        });

        document.getElementById('settings-clear-ui')?.addEventListener('click', () => {
            localStorage.removeItem(window.BLANKKE_STATE_KEYS.library);
            if (typeof showMessageBox === 'function') {
                showMessageBox({
                    title: '设置',
                    icon: 'assets/icon/settings_gear-4.png',
                    message: '界面状态已经清理。'
                });
            }
        });
    }, 30);
};
