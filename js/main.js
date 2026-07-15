// Main Entry Point
// Initializes the desktop environment

// 网络状态页只读取浏览器本地能力，不再请求 IP、测速或 GitHub 接口。
window.switchEthernetTab = function(tabId) {
    const tabs = ['tab-status', 'tab-quality', 'tab-privacy'];
    tabs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = (id === tabId) ? 'block' : 'none';
    });
};

function getLocalNetworkSnapshot() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
        online: navigator.onLine,
        effectiveType: connection?.effectiveType || '浏览器未提供',
        downlink: Number.isFinite(connection?.downlink) ? `${connection.downlink} Mbps（估计）` : '浏览器未提供',
        rtt: Number.isFinite(connection?.rtt) ? `${connection.rtt} ms（估计）` : '浏览器未提供',
        saveData: connection?.saveData ? '已开启' : '未开启'
    };
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load Icon Positions
    if (typeof loadIconPositions === 'function') {
        loadIconPositions();
    }

    // 2. Initialize Recycle Bin State.
    // PVZ and readme remain hidden recycle-bin clues by default; if the user restores
    // them, that state is carried by the quest namespace.
    if (typeof initRecycleBinState === 'function') {
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
                    title: 'Ethernet 状态',
                    icon: 'assets/icon/Pictogrammers-Material-Ethernet-cable.512.png',
                    width: 400,
                    content: `
                        <div style="display: flex; gap: 5px; margin-bottom: 10px; border-bottom: 1px solid #808080; padding-bottom: 5px;">
                            <button onclick="switchEthernetTab('tab-status')">状态</button>
                            <button onclick="switchEthernetTab('tab-quality')">链路</button>
                            <button onclick="switchEthernetTab('tab-privacy')">隐私</button>
                        </div>
                        
                        <div id="tab-status">
                            <div style="display: flex; gap: 10px; align-items: flex-start;">
                                <img src="assets/icon/Pictogrammers-Material-Ethernet-cable.512.png" style="width: 32px; height: 32px;">
                                <div>
                                    <p><strong>连接状态</strong></p>
                                    <p>状态: ${getLocalNetworkSnapshot().online ? '已连接' : '已断开'}</p>
                                    <p>协议: HTTP / Internet</p>
                                    <p>数据源: 浏览器本地网络状态</p>
                                </div>
                            </div>
                        </div>

                        <div id="tab-quality" style="display: none;">
                            <fieldset>
                                <legend>浏览器提供的链路估计</legend>
                                <div class="network-detail-grid">
                                    <span>有效类型</span><strong>${getLocalNetworkSnapshot().effectiveType}</strong>
                                    <span>下行估计</span><strong>${getLocalNetworkSnapshot().downlink}</strong>
                                    <span>往返延迟</span><strong>${getLocalNetworkSnapshot().rtt}</strong>
                                    <span>节省流量</span><strong>${getLocalNetworkSnapshot().saveData}</strong>
                                </div>
                            </fieldset>
                        </div>

                        <div id="tab-privacy" style="display: none;">
                            <fieldset>
                                <legend>隐私说明</legend>
                                <p>此窗口不会向第三方上传你的 IP、位置或测速数据。</p>
                                <p>站点仅使用浏览器直接提供的在线状态和粗略链路估计；不支持的字段会保持空白。</p>
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

    // 6. Resume reader controls
    const resumeFrame = document.getElementById('resume-frame');
    const resumeOpenNew = document.getElementById('resume-open-new');
    const resumePrint = document.getElementById('resume-print');
    const resumeZoomOut = document.getElementById('resume-zoom-out');
    const resumeZoomIn = document.getElementById('resume-zoom-in');
    const resumeZoomReset = document.getElementById('resume-zoom-reset');
    const resumeZoomLabel = document.getElementById('resume-zoom-label');
    let resumeZoom = 1;

    const applyResumeZoom = () => {
        if (!resumeFrame) return;
        resumeZoom = Math.max(0.7, Math.min(1.4, resumeZoom));
        resumeFrame.style.transform = `scale(${resumeZoom})`;
        resumeFrame.style.width = `${100 / resumeZoom}%`;
        resumeFrame.style.height = `${100 / resumeZoom}%`;
        if (resumeZoomLabel) resumeZoomLabel.textContent = `${Math.round(resumeZoom * 100)}%`;
    };

    resumeOpenNew?.addEventListener('click', () => window.open('apps/resume.html', '_blank'));
    resumePrint?.addEventListener('click', () => {
        try {
            resumeFrame?.contentWindow?.focus();
            resumeFrame?.contentWindow?.print();
        } catch {
            window.open('apps/resume.html', '_blank');
        }
    });
    resumeZoomOut?.addEventListener('click', () => {
        resumeZoom -= 0.1;
        applyResumeZoom();
    });
    resumeZoomIn?.addEventListener('click', () => {
        resumeZoom += 0.1;
        applyResumeZoom();
    });
    resumeZoomReset?.addEventListener('click', () => {
        resumeZoom = 1;
        applyResumeZoom();
    });
    applyResumeZoom();

    // 7. Internet Explorer 基础导航控件
    const browserFrame = document.getElementById('browser-iframe');
    const browserAddress = document.getElementById('browser-address');
    const browserStatus = document.getElementById('browser-status');
    const navigateBrowser = () => {
        const raw = browserAddress?.value.trim();
        if (!raw || /^javascript:/i.test(raw)) return;
        const target = /^(https?:|about:|\/|\.\/|\.\.\/)/i.test(raw) ? raw : `https://${raw}`;
        openBrowser(target);
    };

    document.getElementById('browser-back')?.addEventListener('click', () => {
        try { browserFrame?.contentWindow?.history.back(); } catch { /* 跨域页面不暴露历史 */ }
    });
    document.getElementById('browser-home')?.addEventListener('click', () => openBrowser('apps/ie_start.html'));
    document.getElementById('browser-open-external')?.addEventListener('click', () => {
        const target = browserAddress?.value.trim();
        if (target && !/^javascript:/i.test(target)) window.open(target, '_blank', 'noopener');
    });
    document.getElementById('browser-go')?.addEventListener('click', navigateBrowser);
    browserAddress?.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') navigateBrowser();
    });
    browserFrame?.addEventListener('load', () => {
        if (browserStatus) browserStatus.textContent = '完成';
    });

});
