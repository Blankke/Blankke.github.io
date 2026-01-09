// Main Entry Point
// Initializes the desktop environment

// Helper for Ethernet Window Tabs
window.switchEthernetTab = function(tabId) {
    const tabs = ['tab-status', 'tab-speed', 'tab-ip'];
    tabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === tabId) ? 'block' : 'none';
    });
};

// Network Tools Helpers
window.fetchIPInfo = function() {
    const container = document.getElementById('net-ip-content');
    if (!container) return;
    
    container.innerHTML = '正在获取 IP 信息...';
    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            container.innerHTML = `
                <div style="display: grid; grid-template-columns: 80px 1fr; gap: 5px; font-size: 12px;">
                    <div><strong>IP地址:</strong></div><div>${data.ip}</div>
                    <div><strong>位置:</strong></div><div>${data.city}, ${data.region}, ${data.country_name}</div>
                    <div><strong>运营商:</strong></div><div>${data.org}</div>
                    <div><strong>ASN:</strong></div><div>${data.asn}</div>
                </div>
            `;
        })
        .catch(err => {
            container.innerHTML = '<div style="color: red;">获取失败。可能是由于广告拦截器或网络限制。</div>';
            console.error(err);
        });
};

window.startSpeedTest = function() {
    const statusEl = document.getElementById('speed-status');
    const valueEl = document.getElementById('speed-value');
    if (!statusEl || !valueEl) return;

    statusEl.textContent = '正在准备...';
    valueEl.textContent = '--- Mbps';
    
    const startTime = performance.now();
    // Use Cloudflare speed test endpoint (1MB file)
    const fileSize = 1048576; 
    const url = 'https://speed.cloudflare.com/__down?bytes=' + fileSize + '&t=' + startTime;

    statusEl.textContent = '正在测速...';

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Network error');
            return response.blob();
        })
        .then(blob => {
            const endTime = performance.now();
            const durationInSeconds = (endTime - startTime) / 1000;
            // bits = bytes * 8
            const speedBps = (fileSize * 8) / durationInSeconds;
            const speedMbps = (speedBps / (1024 * 1024)).toFixed(2);
            
            statusEl.textContent = '测速完成';
            valueEl.textContent = `${speedMbps} Mbps`;
        })
        .catch(err => {
            statusEl.textContent = '测速失败';
            valueEl.textContent = 'Error';
            console.error(err);
        });
};

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
            // Remove existing window to ensure content update (if it was created with old content)
            const existingWin = document.getElementById('window-ethernet-status');
            if (existingWin) existingWin.remove();

            if (typeof createWindow === 'function') {
                createWindow({
                    id: 'window-ethernet-status',
                    title: '网络工具箱',
                    icon: 'assets/icon/Pictogrammers-Material-Ethernet-cable.512.png',
                    width: 400,
                    content: `
                        <div style="display: flex; gap: 5px; margin-bottom: 10px; border-bottom: 1px solid #808080; padding-bottom: 5px;">
                            <button onclick="switchEthernetTab('tab-status')">状态</button>
                            <button onclick="switchEthernetTab('tab-speed')">测速</button>
                            <button onclick="switchEthernetTab('tab-ip')">IP信息</button>
                        </div>
                        
                        <div id="tab-status">
                            <div style="display: flex; gap: 10px; align-items: flex-start;">
                                <img src="assets/icon/Pictogrammers-Material-Ethernet-cable.512.png" style="width: 32px; height: 32px;">
                                <div>
                                    <p><strong>连接状态</strong></p>
                                    <p>状态: 已连接</p>
                                    <p>持续时间: 00:00:00</p>
                                    <p>速度: 100.0 Mbps</p>
                                </div>
                            </div>
                        </div>

                        <div id="tab-speed" style="display: none;">
                            <fieldset>
                                <legend>网络测速</legend>
                                <div style="text-align: center; margin: 15px 0;">
                                    <div id="speed-value" style="font-size: 28px; font-weight: bold; color: #008000; font-family: 'Courier New', monospace;">--- Mbps</div>
                                    <div id="speed-status" style="font-size: 12px; color: #666; margin-top: 5px;">准备就绪</div>
                                </div>
                                <div style="text-align: center;">
                                    <button onclick="startSpeedTest()">开始测速</button>
                                </div>
                            </fieldset>
                        </div>

                        <div id="tab-ip" style="display: none;">
                            <fieldset>
                                <legend>IP 信息概览</legend>
                                <div id="net-ip-content" style="padding: 5px;">
                                    点击下方按钮获取信息...
                                </div>
                                <div style="text-align: center; margin-top: 10px;">
                                    <button onclick="fetchIPInfo()">获取 IP 信息</button>
                                </div>
                            </fieldset>
                        </div>

                        <br>
                        <div style="text-align: right;">
                            <button onclick="closeWindow('window-ethernet-status')">关闭</button>
                        </div>
                    `
                });
            } else if (typeof showMessageBox === 'function') {
                showMessageBox({
                    title: '网络状态',
                    message: '已连接: Ethernet<br>速度: 100.0 Mbps<br>状态: 已连接'
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
                    icon: 'assets/icon/Bootstrap-Bootstrap-Bootstrap-tencent-qq.512.png',
                    width: 350,
                    content: `
                        <div style="background: #fff; border: 2px inset #dfdfdf; padding: 10px; height: 180px; overflow-y: auto; margin-bottom: 8px;">
                            <div style="display: flex; gap: 8px; align-items: flex-start;">
                                <img src="assets/icon/Bootstrap-Bootstrap-Bootstrap-tencent-qq.512.png" style="width: 24px; height: 24px;">
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
            } else if (typeof showMessageBox === 'function') {
                showMessageBox({
                    title: '消息',
                    message: '来自 群星 的消息:<br><br>“你帮我看看american pie这首歌有多大。”'
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
