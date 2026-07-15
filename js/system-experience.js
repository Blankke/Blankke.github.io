// 复古系统体验层
// 用法：在 core.js 与 window-manager.js 之后引入本文件；页面会自动接管启动画面、
// 懒加载应用 iframe、探索信号面板和“关闭系统”对话框，无需手动初始化。

(function() {
    const BOOT_SEEN_KEY = 'blankke_boot_seen_v1';
    const SIGNAL_WINDOW_ID = 'window-signal-monitor';
    const SIGNAL_VISIBLE_MS = 6000;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    let signalDismissTimer = 0;

    const questStages = [
        {
            id: 'recovery',
            label: '恢复记录',
            code: 'SECTOR 01',
            isDone: (state) => !!(state.pvz_restored || state.readme_restored),
            idle: '回收站仍有可恢复对象。',
            done: '检测到被恢复的旧文件。'
        },
        {
            id: 'game-cache',
            label: '游戏缓存',
            code: 'SECTOR 14',
            isDone: (state) => !!state.minesweeper_fast_clear,
            idle: '旧程序保留了一条异常记录。',
            done: '隐藏的游戏记录已写入。'
        },
        {
            id: 'hidden-process',
            label: '隐藏进程',
            code: 'PORT 03',
            isDone: (state) => !!state.cmd_unlocked,
            idle: '一个未注册进程正在监听输入。',
            done: '未注册的系统进程已被唤醒。'
        },
        {
            id: 'encrypted-file',
            label: '加密档案',
            code: 'FILE 98',
            isDone: (state) => !!state.diary_key_accepted,
            idle: '磁盘中存在无法建立索引的档案。',
            done: '加密档案的权限已通过。'
        },
        {
            id: 'remote-node',
            label: '外部节点',
            code: 'NET 08',
            isDone: (state) => !!state.diary_read,
            idle: '远端地址被一层旧协议遮蔽。',
            done: '完整隐藏路线已经建立。'
        }
    ];

    function getQuestSnapshot() {
        return window.quest?.getState?.() || {};
    }

    function getQuestProgress() {
        const state = getQuestSnapshot();
        const completed = questStages.filter((stage) => stage.isDone(state)).length;
        return { state, completed, total: questStages.length };
    }

    function getSignalStatus(completed, total) {
        if (completed === 0) return '回收站内有 2 个异常对象';
        if (completed === total) return '隐藏路线已完整建立';
        return `已确认 ${completed} 段信号，继续调查`;
    }

    function renderSignalSummary() {
        const { completed, total } = getQuestProgress();
        const progressEl = document.getElementById('mystery-signal-progress');
        const statusEl = document.getElementById('mystery-signal-status');
        const signalEl = document.getElementById('mystery-signal');
        const trayEl = document.getElementById('tray-mystery');

        if (progressEl) progressEl.textContent = `${completed}/${total}`;
        if (statusEl) statusEl.textContent = getSignalStatus(completed, total);
        signalEl?.classList.toggle('is-complete', completed === total);
        trayEl?.classList.toggle('is-complete', completed === total);
        renderSignalWindow();
    }

    function buildSignalRows() {
        const { state } = getQuestProgress();
        return questStages.map((stage) => {
            const done = stage.isDone(state);
            return `
                <div class="signal-stage ${done ? 'is-done' : ''}">
                    <span class="signal-stage-light" aria-hidden="true"></span>
                    <div class="signal-stage-copy">
                        <div><strong>${stage.label}</strong><span>${stage.code}</span></div>
                        <p>${done ? stage.done : stage.idle}</p>
                    </div>
                    <span class="signal-stage-state">${done ? 'FOUND' : 'UNKNOWN'}</span>
                </div>
            `;
        }).join('');
    }

    function renderSignalWindow() {
        const container = document.querySelector(`#${SIGNAL_WINDOW_ID} [data-signal-stage-list]`);
        if (!container) return;
        const { completed, total } = getQuestProgress();
        container.innerHTML = buildSignalRows();
        const label = document.querySelector(`#${SIGNAL_WINDOW_ID} [data-signal-progress-label]`);
        if (label) label.textContent = `${completed} / ${total} SECTORS RECOVERED`;
        const bar = document.querySelector(`#${SIGNAL_WINDOW_ID} .signal-monitor-progress i`);
        if (bar) bar.style.width = `${(completed / total) * 100}%`;
    }

    function openSignalMonitor() {
        if (typeof window.createWindow !== 'function') return;

        const existing = document.getElementById(SIGNAL_WINDOW_ID);
        if (existing) {
            openWindow(SIGNAL_WINDOW_ID);
            renderSignalWindow();
            return;
        }

        const { completed, total } = getQuestProgress();
        window.createWindow({
            id: SIGNAL_WINDOW_ID,
            title: 'ScanDisk - 异常信号',
            icon: 'assets/icon/settings_gear-4.png',
            width: 520,
            height: 490,
            content: `
                <div class="signal-monitor">
                    <div class="signal-monitor-head">
                        <div class="signal-monitor-radar" aria-hidden="true"><span></span></div>
                        <div>
                            <div class="signal-monitor-kicker">DENT DU LION / DEEP SCAN</div>
                            <h2>这台电脑藏着一条完整路线。</h2>
                            <p>这里仅记录你已经触发的系统痕迹，不会显示答案。留意旧文件、异常行为和看似无用的细节。</p>
                        </div>
                    </div>
                    <div class="signal-monitor-progress">
                        <span data-signal-progress-label>${completed} / ${total} SECTORS RECOVERED</span>
                        <div><i style="width:${(completed / total) * 100}%"></i></div>
                    </div>
                    <div class="signal-stage-list" data-signal-stage-list>${buildSignalRows()}</div>
                    <div class="status-bar">
                        <p class="status-bar-field">扫描模式：非侵入</p>
                        <p class="status-bar-field">提示级别：不剧透</p>
                    </div>
                </div>
            `
        });
    }

    function hydrateFrameForWindow(windowId) {
        const win = document.getElementById(windowId);
        const frame = win?.querySelector('iframe[data-src]');
        if (!win || !frame) return;

        win.classList.add('is-app-loading');
        frame.addEventListener('load', () => {
            win.classList.remove('is-app-loading');
            frame.classList.add('is-ready');
        }, { once: true });

        frame.src = frame.dataset.src;
        delete frame.dataset.src;
    }

    function bindLazyApplications() {
        if (typeof window.addOpenWindowHook !== 'function') return;
        window.addOpenWindowHook((windowId) => hydrateFrameForWindow(windowId));
    }

    function updateLocalSystemInfo() {
        const updatedEl = document.getElementById('last-updated-time');

        if (updatedEl) {
            const modified = new Date(document.lastModified);
            updatedEl.textContent = Number.isNaN(modified.getTime())
                ? '未知'
                : modified.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
        }
    }

    // 右下角信号停留数秒后缓慢滑入任务栏下方；托盘问号保留永久入口。
    function showDiskToast() {
        const signal = document.getElementById('mystery-signal');
        if (!signal) return;

        window.clearTimeout(signalDismissTimer);
        signal.classList.remove('is-minimized');
        signal.setAttribute('aria-hidden', 'false');
        signal.tabIndex = 0;
        requestAnimationFrame(() => signal.classList.add('is-visible'));
        signalDismissTimer = window.setTimeout(() => {
            signal.classList.remove('is-visible');
            signal.classList.add('is-minimized');
            signal.setAttribute('aria-hidden', 'true');
            signal.tabIndex = -1;
        }, SIGNAL_VISIBLE_MS);
    }

    function showBootScreen() {
        let alreadySeen = false;
        try {
            alreadySeen = sessionStorage.getItem(BOOT_SEEN_KEY) === '1';
            sessionStorage.setItem(BOOT_SEEN_KEY, '1');
        } catch {
            alreadySeen = false;
        }

        if (alreadySeen || reduceMotion) {
            window.setTimeout(showDiskToast, 700);
            return;
        }

        const boot = document.createElement('div');
        boot.className = 'retro-boot';
        boot.tabIndex = 0;
        boot.innerHTML = `
            <div class="retro-boot-card">
                <img src="assets/icon/windows-0.png" alt="">
                <div>
                    <span>DENT DU LION</span>
                    <strong>PERSONAL 98</strong>
                    <small>Restoring a slower corner of the internet...</small>
                </div>
            </div>
            <div class="retro-boot-track"><i></i></div>
            <div class="retro-boot-status">正在检查磁盘中的旧痕迹…</div>
            <div class="retro-boot-skip">按任意键跳过</div>
        `;
        document.body.appendChild(boot);

        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            window.removeEventListener('keydown', close);
            boot.classList.add('is-leaving');
            window.setTimeout(() => {
                boot.remove();
                showDiskToast();
            }, 260);
        };

        boot.addEventListener('click', close, { once: true });
        window.addEventListener('keydown', close, { once: true });
        window.setTimeout(close, 1650);
    }

    function enterStandby() {
        window.desktopEffects?.pause?.();
        const overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.className = 'standby-screen';
        overlay.innerHTML = '<span>PERSONAL 98</span><strong>系统正在待机</strong><small>单击任意位置唤醒</small>';
        overlay.addEventListener('click', () => {
            overlay.classList.add('is-leaving');
            window.setTimeout(() => overlay.remove(), 220);
            window.desktopEffects?.resume?.();
        }, { once: true });
        document.body.appendChild(overlay);
    }

    window.showShutdownDialog = async function() {
        document.getElementById('start-menu')?.classList.remove('is-open');
        document.getElementById('start-button')?.classList.remove('active');
        if (typeof window.showMessageBox !== 'function') return;

        const action = await window.showMessageBox({
            title: '关闭 Windows',
            icon: 'assets/icon/shut_down_normal-4.png',
            width: 420,
            message: '<strong>希望计算机做什么？</strong>',
            detail: '待机会保留当前桌面；重新启动会重新载入系统。',
            buttons: [
                { label: '进入待机', value: 'standby', primary: true },
                { label: '重新启动', value: 'restart' },
                { label: '取消', value: 'cancel' }
            ],
            closeValue: 'cancel'
        });

        if (action === 'standby') enterStandby();
        if (action === 'restart') {
            try { sessionStorage.removeItem(BOOT_SEEN_KEY); } catch { /* 可选状态 */ }
            window.location.reload();
        }
    };

    function init() {
        bindLazyApplications();
        renderSignalSummary();
        updateLocalSystemInfo();
        showBootScreen();

        const mysterySignal = document.getElementById('mystery-signal');
        mysterySignal?.addEventListener('click', () => {
            window.clearTimeout(signalDismissTimer);
            mysterySignal.classList.remove('is-visible');
            mysterySignal.classList.add('is-minimized');
            mysterySignal.setAttribute('aria-hidden', 'true');
            mysterySignal.tabIndex = -1;
            openSignalMonitor();
        });
        document.getElementById('tray-mystery')?.addEventListener('click', openSignalMonitor);
        window.addEventListener('quest:changed', () => {
            renderSignalSummary();
            showDiskToast();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
