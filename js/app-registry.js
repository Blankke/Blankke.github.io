// Visible application registry.
// Hidden puzzle surfaces such as CMD and PVZ are intentionally not registered here.

(function() {
    const visibleApps = [
        {
            id: 'computer',
            label: '我的电脑',
            icon: 'assets/icon/computer_explorer-4.png',
            open: () => openWindow('window-computer')
        },
        {
            id: 'resume',
            label: '我的简历',
            icon: 'assets/icon/Hopstarter-Soft-Scraps-Adobe-PDF-Document.256.png',
            open: () => openWindow('window-resume')
        },
        {
            id: 'guestbook',
            label: '留言板',
            icon: 'assets/icon/notepad-5.png',
            open: () => openWindow('window-guestbook')
        },
        {
            id: 'library',
            label: '私人图书馆',
            icon: 'assets/icon/directory_open_file_mydocs-4.png',
            open: () => openWindow('window-library')
        },
        {
            id: 'gallery',
            label: '我的相册',
            icon: 'assets/icon/directory_open_file_mydocs-4.png',
            open: () => {
                openWindow('window-gallery');
                if (typeof initGallery === 'function') initGallery();
            }
        },
        {
            id: 'music',
            label: '音乐播放器',
            icon: 'assets/icon/cd_player.png',
            open: () => openWindow('window-music')
        },
        {
            id: 'minesweeper',
            label: '扫雷',
            icon: 'assets/icon/minesweeper-0.png',
            open: () => openWindow('window-minesweeper')
        },
        {
            id: 'browser',
            label: 'Internet Explorer',
            icon: 'assets/icon/msie1-0.png',
            open: () => openBrowser('apps/ie_start.html')
        },
        {
            id: 'settings',
            label: '设置',
            icon: 'assets/icon/settings_gear-4.png',
            open: () => {
                if (typeof openSettingsWindow === 'function') openSettingsWindow();
            }
        }
    ];

    window.visibleApps = visibleApps;

    window.runVisibleApp = function(appId) {
        const app = visibleApps.find(item => item.id === appId);
        if (app && typeof app.open === 'function') {
            app.open();
        }
    };

    function renderStartMenu() {
        const container = document.getElementById('start-menu-items');
        if (!container) return;

        const divider = container.querySelector('hr');
        visibleApps.forEach(app => {
            if (container.querySelector(`[data-app-id="${app.id}"]`)) return;

            const item = document.createElement('div');
            item.className = 'menu-item';
            item.dataset.appId = app.id;
            item.innerHTML = `<img src="${app.icon}" alt=""><span>${app.label}</span>`;
            item.addEventListener('click', () => {
                app.open();
                const startMenu = document.getElementById('start-menu');
                const startButton = document.getElementById('start-button');
                if (startMenu) startMenu.style.display = 'none';
                if (startButton) startButton.classList.remove('active');
            });

            if (divider) {
                container.insertBefore(item, divider);
            } else {
                container.appendChild(item);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderStartMenu);
    } else {
        renderStartMenu();
    }
})();
