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
                    title: '消息 - 群星',
                    icon: 'icon/Bootstrap-Bootstrap-Bootstrap-tencent-qq.512.png',
                    width: 320,
                    content: `
                        <div style="display: flex; gap: 10px;">
                            <img src="icon/Bootstrap-Bootstrap-Bootstrap-tencent-qq.512.png" style="width: 32px; height: 32px;">
                            <div>
                                <p><strong>群星</strong></p>
                                <p style="margin-top: 8px;">“把文件夹里的 American Pie 看看属性。”</p>
                            </div>
                        </div>
                        <br>
                        <div style="text-align: right;">
                            <button onclick="closeWindow('window-qq-msg')">回复</button>
                            <button onclick="closeWindow('window-qq-msg')">关闭</button>
                        </div>
                    `
                });
            } else {
                alert('来自 群星 的消息:\n\n“把文件夹里的 American Pie 看看属性。”');
            }
        });
    }
});
