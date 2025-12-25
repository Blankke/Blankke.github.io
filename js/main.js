// Main Entry Point
// Initializes the desktop environment

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Icon Positions
    if (typeof loadIconPositions === 'function') {
        loadIconPositions();
    }

    // 2. Initialize Recycle Bin State (Restore missing icons)
    if (typeof initRecycleBinState === 'function') {
        // Ensure PVZ starts in recycle bin (remove any desktop remnants from previous state if needed)
        // This logic was in script.js, but initRecycleBinState handles most of it now.
        // We just need to make sure we don't have a stale icon if we want to force a state,
        // but initRecycleBinState is smart enough.
        
        // However, the original script had this specific block:
        /*
        const existingPvzIcon = document.getElementById('icon-pvz');
        if (existingPvzIcon) {
            existingPvzIcon.remove();
            localStorage.removeItem(PVZ_RESTORED_KEY);
        }
        */
        // This block in the original script seemed to be for debugging or a specific reset.
        // But later in the script it called initRecycleBinState().
        // Actually, looking at the original script, that block was:
        // "Initialize on load / Ensure PVZ starts in recycle bin..."
        // It seems the user might have wanted a hard reset at some point, but `initRecycleBinState`
        // is the robust way to handle persistence.
        // I will trust `initRecycleBinState` to do the right thing based on localStorage.
        
        initRecycleBinState();
    }

    // 3. Load Music
    if (typeof loadMusicManifest === 'function') {
        loadMusicManifest();
    }
    
    // 4. Render Recycle Bin (initRecycleBinState does this, but just in case)
    if (typeof renderRecycleBin === 'function') {
        renderRecycleBin();
    }

    // 5. System Tray Interactions
    const trayEthernet = document.getElementById('tray-ethernet');
    if (trayEthernet) {
        trayEthernet.addEventListener('click', () => {
            if (typeof createWindow === 'function') {
                createWindow({
                    id: 'window-ethernet-status',
                    title: '本地连接 状态',
                    icon: 'icon/Pictogrammers-Material-Ethernet-cable.512.png',
                    width: 300,
                    content: `
                        <div style="display: flex; gap: 10px; align-items: flex-start;">
                            <img src="icon/Pictogrammers-Material-Ethernet-cable.512.png" style="width: 32px; height: 32px;">
                            <div>
                                <p><strong>连接状态</strong></p>
                                <p>状态: 已连接</p>
                                <p>持续时间: 00:00:00</p>
                                <p>速度: 100.0 Mbps</p>
                            </div>
                        </div>
                        <br>
                        <div style="text-align: right;">
                            <button onclick="closeWindow('window-ethernet-status')">关闭</button>
                        </div>
                    `
                });
            } else {
                alert('已连接: Ethernet\n速度: 100.0 Mbps\n状态: 已连接');
            }
        });
    }

    const trayQQ = document.getElementById('tray-qq');
    if (trayQQ) {
        trayQQ.addEventListener('click', () => {
            if (typeof createWindow === 'function') {
                createWindow({
                    id: 'window-qq-msg',
                    title: '与 群星 聊天中',
                    icon: 'icon/Bootstrap-Bootstrap-Bootstrap-tencent-qq.512.png',
                    width: 350,
                    content: `
                        <div style="background: #fff; border: 2px inset #dfdfdf; padding: 10px; height: 180px; overflow-y: auto; margin-bottom: 8px;">
                            <div style="display: flex; gap: 8px; align-items: flex-start;">
                                <img src="icon/Bootstrap-Bootstrap-Bootstrap-tencent-qq.512.png" style="width: 24px; height: 24px;">
                                <div>
                                    <div style="color: #000080; font-size: 12px; margin-bottom: 2px;">群星</div>
                                    <div>你帮我看看american pie这首歌有多大。</div>
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 5px;">
                            <input type="text" style="flex: 1;">
                            <button onclick="closeWindow('window-qq-msg')">发送</button>
                        </div>
                    `
                });
            } else {
                alert('来自 群星 的消息:\n\n“你帮我看看american pie这首歌有多大。”');
            }
        });
    }

    // 6. Set Last Updated Time
    const lastUpdatedContainer = document.getElementById('last-updated');
    if (lastUpdatedContainer) {
        fetch('https://api.github.com/repos/Blankke/Blankke.github.io/commits?per_page=1')
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const commit = data[0].commit;
                    const dateObj = new Date(commit.committer.date);
                    const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
                    const message = commit.message.split('\n')[0]; // Use first line of commit message
                    
                    lastUpdatedContainer.innerHTML = `last update : <span style="color: #FFFF00;">${dateStr}</span> with <span style="color: #FFFF00;">${message}</span>`;
                }
            })
            .catch(err => {
                console.error('Error fetching commit info:', err);
                // Fallback to document.lastModified
                const date = new Date(document.lastModified);
                const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                lastUpdatedContainer.innerHTML = `last update : <span style="color: #FFFF00;">${dateStr}</span>`;
            });
    }
});
