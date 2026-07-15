// 桌面宠物系统：夜游像素桌宠
class DesktopPet {
    constructor() {
        this.element = null;
        this.canvas = null;
        this.fallbackImage = null;
        this.ctx = null;
        this.dialogElement = null;

        this.x = 100;
        this.y = 100;
        this.isDragging = false;
        this.dialogTimer = null;
        this.behaviorTimer = null;
        this.animationFrameId = null;
        this.windowObserverMap = new Map();
        this.lastTickAt = 0;
        this.lastUserActivityAt = performance.now();
        this.lastMinesweeperInteraction = Date.now();
        this.minesweeperIdleCheckInterval = null;
        this.randomMoveTimer = null;
        this.pendingMoveTimer = null;
        this.visibilityPaused = document.hidden;
        this.actionSerial = 0;
        this.currentAction = null;
        this.currentState = 'idle';
        this.dialogShown = {};
        this.radioHintGiven = false;
        this.minesweeperCleared = !!window.quest?.hasFlag('minesweeper_fast_clear');
        this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
        this.petVisibleSize = { width: 72, height: 78 };
        this.fallbackSize = { width: 48, height: 48 };
        this.cellWidth = 192;
        this.cellHeight = 208;
        this.manifest = null;
        this.sheetImages = { main: null, extra: null };
        this.assetMode = 'fallback';
        this.assetReady = false;
        this.imageLoadFailed = false;
        this.actionDefs = this.createFallbackActionDefs();

        this.init();
    }

    isTalkEnabled() {
        return typeof window.mewmewTalkEnabled === 'boolean' ? window.mewmewTalkEnabled : false;
    }

    createFallbackActionDefs() {
        return {
            idle: { sheet: 'main', row: 0, frames: 6, frameDurationMs: 180, loop: true },
            'run-right': { sheet: 'main', row: 1, frames: 8, frameDurationMs: 90, loop: true },
            'run-left': { sheet: 'main', row: 2, frames: 8, frameDurationMs: 90, loop: true },
            wave: { sheet: 'main', row: 3, frames: 4, frameDurationMs: 150, loop: false },
            jump: { sheet: 'main', row: 4, frames: 5, frameDurationMs: 110, loop: false },
            raijin: { sheet: 'main', row: 5, frames: 8, frameDurationMs: 105, loop: false },
            'raiju-chibi': { sheet: 'main', row: 6, frames: 6, frameDurationMs: 115, loop: false },
            chess: { sheet: 'main', row: 7, frames: 6, frameDurationMs: 170, loop: true },
            'cane-shunpo': { sheet: 'main', row: 8, frames: 6, frameDurationMs: 105, loop: false },
            'write-poem': { sheet: 'extra', row: 0, frames: 6, frameDurationMs: 170, loop: true },
            'read-book': { sheet: 'extra', row: 1, frames: 6, frameDurationMs: 190, loop: true },
            'listen-radio': { sheet: 'extra', row: 2, frames: 6, frameDurationMs: 165, loop: true },
            'tower-defense': { sheet: 'extra', row: 3, frames: 6, frameDurationMs: 150, loop: true },
            'sleep-in-hat': { sheet: 'extra', row: 4, frames: 6, frameDurationMs: 220, loop: true },
            'moon-dandelion': { sheet: 'extra', row: 5, frames: 6, frameDurationMs: 185, loop: true }
        };
    }

    async loadManifest() {
        try {
            const response = await fetch('assets/pet/night-cat-pixel-action-manifest.json', { cache: 'force-cache' });
            if (!response.ok) throw new Error(`manifest ${response.status}`);
            const parsed = await response.json();
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch {
            return null;
        }
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = () => resolve(image);
            image.onerror = reject;
            image.src = src;
        });
    }

    buildActionDefs(manifest) {
        const defaults = this.createFallbackActionDefs();
        if (!manifest?.sheets) return defaults;

        const result = {};
        for (const [sheetKey, sheet] of Object.entries(manifest.sheets)) {
            const actions = sheet?.actions || {};
            for (const [actionName, action] of Object.entries(actions)) {
                result[actionName] = {
                    sheet: sheetKey,
                    row: Number(action.row) || 0,
                    frames: Number(action.frames) || 1,
                    frameDurationMs: Number(action.frameDurationMs) || 160,
                    loop: !!action.loop
                };
            }
        }

        return Object.keys(result).length ? result : defaults;
    }

    init() {
        this.setupDom();
        this.bindEvents();
        this.bindContextSources();
        this.startDialogSequence();
        this.startBehaviorLoop();
        this.startMinesweeperIdleCheck();
        this.startAssetPipeline();
        this.setPosition(window.innerWidth - 150, window.innerHeight - 150);
        this.returnToIdle({ force: true });
    }

    setupDom() {
        this.element = document.createElement('div');
        this.element.id = 'desktop-pet';
        this.element.setAttribute('aria-label', '夜游桌宠');
        this.element.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: ${this.petVisibleSize.width}px;
            height: ${this.petVisibleSize.height}px;
            z-index: 9999;
            user-select: none;
            cursor: grab;
            touch-action: none;
            filter: drop-shadow(2px 2px 3px rgba(0,0,0,0.3));
            will-change: left, top;
        `;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.cellWidth;
        this.canvas.height = this.cellHeight;
        this.canvas.setAttribute('aria-label', '夜游桌宠');
        this.canvas.setAttribute('role', 'img');
        this.canvas.style.cssText = `
            width: ${this.petVisibleSize.width}px;
            height: ${this.petVisibleSize.height}px;
            display: block;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
            pointer-events: none;
        `;
        this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (this.ctx) {
            this.ctx.imageSmoothingEnabled = false;
        }

        this.fallbackImage = document.createElement('img');
        this.fallbackImage.src = 'assets/icon/icon.png';
        this.fallbackImage.alt = '桌宠图标';
        this.fallbackImage.style.cssText = `
            width: ${this.fallbackSize.width}px;
            height: ${this.fallbackSize.height}px;
            display: none;
            image-rendering: pixelated;
            pointer-events: none;
        `;

        this.element.appendChild(this.canvas);
        this.element.appendChild(this.fallbackImage);
        document.body.appendChild(this.element);

        this.dialogElement = document.createElement('div');
        this.dialogElement.id = 'pet-dialog';
        this.dialogElement.style.cssText = `
            position: fixed;
            background: #ffffff;
            color: #000;
            border: 2px solid #000;
            padding: 8px 10px;
            font-family: "MS Sans Serif", Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            min-width: 100px;
            max-width: 280px;
            text-align: center;
            display: none;
            z-index: 10000;
            pointer-events: none;
        `;
        this.dialogElement.innerHTML = `
            <div id="pet-dialog-text" style="margin: 0;"></div>
            <div style="position: absolute; bottom: -10px; left: 50%; margin-left: -10px; width: 0; height: 0; border-left: 10px solid transparent; border-right: 10px solid transparent; border-top: 10px solid #000;"></div>
            <div style="position: absolute; bottom: -8px; left: 50%; margin-left: -9px; width: 0; height: 0; border-left: 9px solid transparent; border-right: 9px solid transparent; border-top: 9px solid #fff;"></div>
        `;
        document.body.appendChild(this.dialogElement);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes petDialogFadeIn {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: translateY(0); }
            }
            #pet-dialog { animation: petDialogFadeIn 0.12s ease; }
            #desktop-pet:hover { transform: scale(1.06); }
        `;
        document.head.appendChild(style);

        this.syncRenderSurface();
    }

    startAssetPipeline() {
        this.loadAssets();
    }

    async loadAssets() {
        const manifest = await this.loadManifest();
        if (!manifest) {
            this.imageLoadFailed = true;
            this.manifest = null;
            this.actionDefs = this.createFallbackActionDefs();
            this.enableFallbackMode();
            return;
        }

        try {
            const [mainImage, extraImage] = await Promise.all([
                this.loadImage('assets/pet/night-cat-pixel-work-pet.png'),
                this.loadImage('assets/pet/night-cat-pixel-extra-actions.png')
            ]);

            this.manifest = manifest;
            this.actionDefs = this.buildActionDefs(manifest);
            this.sheetImages = { main: mainImage, extra: extraImage };
            this.assetMode = 'canvas';
            this.assetReady = true;
            this.imageLoadFailed = false;
            this.syncRenderSurface();
            this.ensureAnimationLoop();
            this.renderCurrentFrame();
        } catch {
            this.imageLoadFailed = true;
            this.manifest = null;
            this.actionDefs = this.createFallbackActionDefs();
            this.enableFallbackMode();
        }
    }

    enableFallbackMode() {
        this.assetMode = 'fallback';
        this.assetReady = false;
        this.sheetImages = { main: null, extra: null };
        this.stopAnimationLoop();
        this.syncRenderSurface();
        this.renderFallback();
    }

    syncRenderSurface() {
        const size = this.getVisibleSize();
        this.element.style.width = `${size.width}px`;
        this.element.style.height = `${size.height}px`;
        this.canvas.style.display = this.assetMode === 'canvas' && this.assetReady ? 'block' : 'none';
        this.fallbackImage.style.display = this.assetMode === 'canvas' && this.assetReady ? 'none' : 'block';
        this.fallbackImage.style.width = `${this.fallbackSize.width}px`;
        this.fallbackImage.style.height = `${this.fallbackSize.height}px`;
        this.clampIntoViewport();
    }

    getVisibleSize() {
        return this.assetMode === 'canvas' && this.assetReady ? this.petVisibleSize : this.fallbackSize;
    }

    getActionDefinition(name) {
        return this.actionDefs?.[name] || this.createFallbackActionDefs()[name] || null;
    }

    getActionPriority(name) {
        if (name === 'wave' || name === 'jump' || name === 'raijin' || name === 'raiju-chibi' || name === 'cane-shunpo') return 4;
        if (name === 'run-left' || name === 'run-right') return 2;
        if (name === 'idle') return 0;
        return 1;
    }

    markActivity() {
        this.lastUserActivityAt = performance.now();
    }

    clampIntoViewport(x = this.x, y = this.y) {
        const size = this.getVisibleSize();
        const nextX = Math.max(0, Math.min(window.innerWidth - size.width, x));
        const nextY = Math.max(0, Math.min(window.innerHeight - size.height, y));
        return { x: nextX, y: nextY };
    }

    setPosition(x, y, options = {}) {
        const { x: nextX, y: nextY } = options.clamp === false ? { x, y } : this.clampIntoViewport(x, y);
        this.x = nextX;
        this.y = nextY;
        this.element.style.left = `${this.x}px`;
        this.element.style.top = `${this.y}px`;
        if (this.dialogElement.style.display === 'block') {
            this.updateDialogPosition();
        }
    }

    updateDialogPosition() {
        const dialogWidth = this.dialogElement.offsetWidth;
        const dialogHeight = this.dialogElement.offsetHeight;
        const size = this.getVisibleSize();

        let dialogX = this.x + size.width / 2 - dialogWidth / 2;
        let dialogY = this.y - dialogHeight - 20;

        dialogX = Math.max(10, Math.min(window.innerWidth - dialogWidth - 10, dialogX));
        dialogY = Math.max(10, dialogY);

        this.dialogElement.style.left = `${dialogX}px`;
        this.dialogElement.style.top = `${dialogY}px`;
    }

    showDialog(text, duration = 5000) {
        const dialogText = document.getElementById('pet-dialog-text');
        if (!dialogText) return;

        dialogText.textContent = this.isTalkEnabled() ? text : '喵';
        this.dialogElement.style.display = 'block';
        this.updateDialogPosition();

        if (this.dialogTimer) clearTimeout(this.dialogTimer);
        this.dialogTimer = setTimeout(() => this.hideDialog(), duration);
    }

    hideDialog() {
        this.dialogElement.style.display = 'none';
    }

    startDialogSequence() {
        const initialDialogs = [
            { text: '我是这里的小向导，有什么需要帮助的吗？', delay: 6000, id: 'intro0' },
            { text: '这里看起来很简单... 对吧？', delay: 10000, id: 'intro1' },
            { text: '我主人说，真正重要的东西往往藏在表面之下。', delay: 30000, id: 'hint1' },
            { text: '就像冰山... 你只能看到露出水面的那一小部分。', delay: 40000, id: 'hint2' }
        ];

        initialDialogs.forEach((dialog) => {
            setTimeout(() => {
                if (!this.dialogShown[dialog.id]) {
                    this.showDialog(dialog.text);
                    this.dialogShown[dialog.id] = true;
                }
            }, dialog.delay);
        });
    }

    bindEvents() {
        this.element.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            this.markActivity();
            this.isDragging = true;
            this.playAction('idle', { force: true, priority: 0 });
            let moved = false;
            let nextX = this.x;
            let nextY = this.y;
            let frame = null;

            this.element.style.cursor = 'grabbing';
            this.element.style.transition = 'none';
            const offsetX = event.clientX - this.x;
            const offsetY = event.clientY - this.y;
            this.element.setPointerCapture?.(event.pointerId);

            const render = () => {
                frame = null;
                this.setPosition(nextX, nextY);
            };

            const onPointerMove = (moveEvent) => {
                if (!this.isDragging || moveEvent.pointerId !== event.pointerId) return;
                nextX = moveEvent.clientX - offsetX;
                nextY = moveEvent.clientY - offsetY;
                moved ||= Math.abs(moveEvent.clientX - event.clientX) + Math.abs(moveEvent.clientY - event.clientY) > 4;
                if (!frame) frame = requestAnimationFrame(render);
                this.markActivity();
            };

            const onPointerUp = (upEvent) => {
                if (upEvent.pointerId !== event.pointerId) return;
                if (frame) {
                    cancelAnimationFrame(frame);
                    render();
                }

                this.isDragging = false;
                this.element.style.cursor = 'grab';
                this.element.style.transition = 'left 0.3s ease, top 0.3s ease';
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                document.removeEventListener('pointercancel', onPointerUp);
                try {
                    this.element.releasePointerCapture?.(event.pointerId);
                } catch {
                    // 忽略捕获释放失败。
                }

                if (!moved) {
                    this.playAction('wave', { priority: 4, interruptible: false });
                    this.showRandomDialog();
                } else {
                    this.returnToIdle({ force: true });
                }
            };

            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
        });

        window.addEventListener('resize', () => {
            this.syncRenderSurface();
            this.renderCurrentFrame();
        });

        document.addEventListener('visibilitychange', () => {
            this.visibilityPaused = document.hidden;
            if (this.visibilityPaused) {
                this.stopAnimationLoop();
            } else if (this.assetMode === 'canvas' && this.assetReady) {
                this.lastTickAt = performance.now();
                this.ensureAnimationLoop();
            }
        });

        ['pointerdown', 'click', 'keydown', 'touchstart', 'wheel'].forEach((eventName) => {
            window.addEventListener(eventName, () => this.markActivity(), { passive: true });
        });
    }

    observeWindowElement(win) {
        if (!win || this.windowObserverMap.has(win)) return;
        const observer = new MutationObserver(() => {
            this.markActivity();
            this.refreshContextAction();
        });
        observer.observe(win, { attributes: true, attributeFilter: ['class', 'style'] });
        this.windowObserverMap.set(win, observer);
    }

    bindContextSources() {
        document.querySelectorAll('.window').forEach((win) => this.observeWindowElement(win));

        const bodyObserver = new MutationObserver((mutations) => {
            let shouldRefresh = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType !== 1) return;
                        if (node.classList?.contains('window')) this.observeWindowElement(node);
                        node.querySelectorAll?.('.window').forEach((win) => this.observeWindowElement(win));
                    });
                    shouldRefresh = true;
                } else if (mutation.type === 'attributes') {
                    shouldRefresh = true;
                }
            }
            if (shouldRefresh) {
                this.refreshContextAction();
            }
        });
        bodyObserver.observe(document.body, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['class', 'data-effect']
        });

        if (typeof window.addOpenWindowHook === 'function') {
            window.addOpenWindowHook((id) => {
                this.markActivity();
                this.observeWindowElement(document.getElementById(id));
                this.refreshContextAction();
            });
        }

        const musicAudio = document.getElementById('music-audio');
        if (musicAudio) {
            const updateFromMusic = () => this.refreshContextAction();
            musicAudio.addEventListener('play', updateFromMusic);
            musicAudio.addEventListener('pause', updateFromMusic);
            musicAudio.addEventListener('ended', updateFromMusic);
            musicAudio.addEventListener('loadedmetadata', updateFromMusic);
        }
    }

    getOpenWindow(id) {
        const win = document.getElementById(id);
        if (!win || !win.classList.contains('window-open') || win.classList.contains('window-minimized')) return null;
        return win;
    }

    getDesiredContextAction() {
        const musicAudio = document.getElementById('music-audio');
        if (musicAudio && !musicAudio.paused && !musicAudio.ended && musicAudio.src) {
            return 'listen-radio';
        }

        if (this.getOpenWindow('window-minesweeper')) return 'tower-defense';
        if (this.getOpenWindow('window-library')) return 'read-book';

        // 这里把博客窗口当成“写作/内容整理”入口；如果未来有专门编辑器，可以接到更具体的窗口上。
        if (this.getOpenWindow('window-blog')) return 'write-poem';

        const loadingWindow = document.querySelector('.window.window-open.is-app-loading:not(.window-minimized)');
        if (loadingWindow) return 'chess';

        return null;
    }

    refreshContextAction() {
        if (this.isDragging) return;

        const current = this.currentAction;
        if (current && current.priority >= 4 && !current.loop) {
            return;
        }

        const desired = this.getDesiredContextAction();
        if (desired) {
            this.playAction(desired, { priority: 1 });
            return;
        }

        if (!current || current.priority <= 1 || current.loop) {
            this.returnToIdle();
        }
    }

    playAction(name, options = {}) {
        const definition = this.getActionDefinition(name);
        if (!definition) return false;

        const priority = Number.isFinite(options.priority) ? options.priority : this.getActionPriority(name);
        const current = this.currentAction;

        if (!options.force && current) {
            if (priority < current.priority) return false;
            if (priority === current.priority && current.name === name && !options.restart) return true;
        }

        this.clearMovementTimer();
        const serial = ++this.actionSerial;
        this.currentAction = {
            serial,
            name,
            definition,
            priority,
            loop: options.loop ?? definition.loop,
            interruptible: options.interruptible !== false,
            onComplete: typeof options.onComplete === 'function' ? options.onComplete : null,
            elapsedMs: 0,
            frameIndex: 0,
            finished: false
        };
        this.currentState = name;

        if (this.assetMode === 'canvas' && this.assetReady) {
            this.ensureAnimationLoop();
        } else {
            this.renderFallback();
        }

        this.renderCurrentFrame();
        return true;
    }

    clearMovementTimer() {
        if (this.pendingMoveTimer) {
            clearTimeout(this.pendingMoveTimer);
            this.pendingMoveTimer = null;
        }
    }

    returnToIdle(options = {}) {
        const desired = this.getDesiredContextAction() || 'idle';
        if (!options.force && this.currentAction?.name === desired) return true;
        return this.playAction(desired, {
            force: !!options.force,
            priority: desired === 'idle' ? 0 : 1
        });
    }

    setMovementDirection(dx) {
        if (dx === 0) return this.returnToIdle();
        return this.playAction(dx > 0 ? 'run-right' : 'run-left', { priority: 2 });
    }

    performMoveTo(targetX, targetY, options = {}) {
        const next = this.clampIntoViewport(targetX, targetY);
        const dx = next.x - this.x;
        const dy = next.y - this.y;
        const needsMotion = Math.abs(dx) + Math.abs(dy) > 2;

        if (options.animate === false || this.prefersReducedMotion || !needsMotion) {
            this.setPosition(next.x, next.y);
            this.returnToIdle();
            return;
        }

        this.setMovementDirection(dx);
        this.setPosition(next.x, next.y);
        this.clearMovementTimer();
        this.pendingMoveTimer = setTimeout(() => {
            this.pendingMoveTimer = null;
            this.returnToIdle();
        }, 320);
    }

    moveToElement(elementId) {
        const element = document.getElementById(elementId);
        if (!element) return;
        if (!element.classList.contains('window-open') || element.classList.contains('window-minimized')) return;

        const rect = element.getBoundingClientRect();
        const size = this.getVisibleSize();
        let targetX = rect.right + 10;
        let targetY = rect.top + 50;

        if (targetX + size.width > window.innerWidth) {
            targetX = rect.left - size.width - 10;
        }

        targetX = Math.max(10, Math.min(window.innerWidth - size.width - 10, targetX));
        targetY = Math.max(10, Math.min(window.innerHeight - size.height - 10, targetY));
        this.setPosition(targetX, targetY);
    }

    startBehaviorLoop() {
        if (this.behaviorTimer) clearInterval(this.behaviorTimer);
        this.behaviorTimer = setInterval(() => this.behaviorTick(), this.prefersReducedMotion ? 12000 : 4000);
    }

    behaviorTick() {
        if (document.hidden || this.isDragging) return;

        const current = this.currentAction;
        if (current && current.priority >= 4 && !current.loop) return;

        const desiredContext = this.getDesiredContextAction();
        if (desiredContext) {
            this.playAction(desiredContext, { priority: 1 });
            return;
        }

        const inactiveMs = performance.now() - this.lastUserActivityAt;
        const hour = new Date().getHours();
        const nightMode = document.body.classList.contains('effects-night') || hour >= 22 || hour < 6;

        if (inactiveMs >= 45000 && current?.name !== 'sleep-in-hat') {
            this.playAction('sleep-in-hat', { priority: 1 });
            return;
        }

        if (this.prefersReducedMotion) return;

        if (current && current.priority > 1 && current.name !== 'idle' && current.name !== 'sleep-in-hat') {
            return;
        }

        if (nightMode && Math.random() < 0.08) {
            this.playAction('moon-dandelion', { priority: 1 });
            return;
        }

        if (inactiveMs < 10000 || Math.random() > 0.25) return;

        const width = Math.max(1, window.innerWidth - this.getVisibleSize().width);
        const height = Math.max(1, window.innerHeight - this.getVisibleSize().height);
        const targetX = Math.random() * width;
        const targetY = Math.random() * height;

        if (Math.random() < 0.08) {
            this.playAction('cane-shunpo', {
                priority: 4,
                interruptible: false,
                onComplete: () => this.performMoveTo(targetX, targetY)
            });
            return;
        }

        this.performMoveTo(targetX, targetY);
    }

    startMinesweeperIdleCheck() {
        this.minesweeperIdleCheckInterval = setInterval(() => {
            const now = Date.now();
            if (now - this.lastMinesweeperInteraction <= 300000) return;
            if (this.dialogElement.style.display !== 'none') return;
            this.showDialog('好久没玩扫雷了，手不痒吗？', 4000);
            this.lastMinesweeperInteraction = Date.now();
        }, 60000);
    }

    resetMinesweeperIdleTimer() {
        this.lastMinesweeperInteraction = Date.now();
        this.markActivity();
    }

    showRandomDialog() {
        const dialogs = [
            '喵？',
            '找我有什么事吗？',
            '我在这里呢~',
            '别总是戳我啦！',
            '有些秘密，需要你自己去发现...'
        ];

        if (this.minesweeperCleared) {
            dialogs.push('你已经通关扫雷了呢！');
            dialogs.push('有些东西，不是点出来的。');
            dialogs.push('你可以试试同时按下几个你平时不会一起按的键。');
            dialogs.push('键盘上的组合... 也许能打开什么？');
            dialogs.push('Ctrl、Alt... 再加上一个字母... 我主人姓什么来着？');
        }

        const randomDialog = dialogs[Math.floor(Math.random() * dialogs.length)];
        this.showDialog(randomDialog, 3000);
    }

    celebrate() {
        this.playAction('jump', { priority: 4 });
    }

    onMinesweeperWin(time) {
        this.markActivity();
        this.moveToElement('window-minesweeper');
        this.playAction('raijin', {
            priority: 4,
            interruptible: false,
            onComplete: () => {
                if (Math.random() < 0.35) {
                    this.playAction('raiju-chibi', { priority: 4 });
                }
            }
        });

        if (time > 50) {
            this.showDialog(`通关啦！不过用了 ${time} 秒... 有点慢哦~`, 4000);
            setTimeout(() => this.showDialog('下次试试能不能在 50 秒内完成？', 4000), 4500);
            return;
        }

        if (!this.minesweeperCleared) {
            this.minesweeperCleared = true;
            window.quest?.setFlag('minesweeper_fast_clear', true);
            this.showDialog(`哇！${time} 秒！太快了！`, 4000);

            setTimeout(() => this.showDialog('看来你确实有耐心... 也有足够的好奇心。', 4000), 5000);
            setTimeout(() => this.showDialog('那我就告诉你一个秘密吧~', 4000), 10000);
            setTimeout(() => this.showDialog('我主人说... 高手都用键盘，菜鸟才点鼠标。', 5000), 15000);
            setTimeout(() => this.showDialog('有些东西，不是点出来的。', 5000), 21000);
            setTimeout(() => this.showDialog('试试看... 同时按下几个你平时不会一起按的键？', 6000), 27000);
            return;
        }

        this.showDialog(`又是 ${time} 秒！保持这个速度！`, 3000);
    }

    onMinesweeperLoss() {
        this.markActivity();
        this.moveToElement('window-minesweeper');
        const lossDialogs = [
            '哎呀，炸了...',
            '没关系，再试一次！',
            '小心一点哦~',
            '那个位置看起来就很危险...',
            '不要灰心，下次一定行！'
        ];
        this.showDialog(lossDialogs[Math.floor(Math.random() * lossDialogs.length)], 3000);
    }

    triggerDialog(dialogId) {
        const dialogs = {
            cmd_hint: '有时候，命令行比图形界面更强大...',
            radio_hint: '我的主人喜欢听广播，特别是那个格拉斯哥的电台...',
            secret_found: '你找到了！真不简单！'
        };

        if (dialogs[dialogId]) {
            this.showDialog(dialogs[dialogId], 5000);
        }
    }

    giveRadioHint() {
        if (this.radioHintGiven) return;
        this.radioHintGiven = true;

        setTimeout(() => this.showDialog('你之前看过我主人的个人介绍吗？', 5000), 1000);
        setTimeout(() => this.showDialog('他说过... 他喜欢听广播。', 5000), 7000);
        setTimeout(() => this.showDialog('有些编号，不在文件里。', 6000), 13000);
        setTimeout(() => this.showDialog('它们在... 你意想不到的地方。', 6000), 20000);
    }

    renderFallback() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.cellWidth, this.cellHeight);
        }
    }

    renderCurrentFrame() {
        if (this.assetMode !== 'canvas' || !this.assetReady || !this.ctx) {
            return this.renderFallback();
        }

        const action = this.currentAction || {
            name: 'idle',
            definition: this.getActionDefinition('idle')
        };
        const definition = action.definition || this.getActionDefinition(action.name) || this.getActionDefinition('idle');
        const sheet = this.sheetImages[definition.sheet];
        if (!sheet) {
            return this.renderFallback();
        }

        const frameIndex = Math.max(0, Math.min(definition.frames - 1, action.frameIndex || 0));
        const sx = frameIndex * this.cellWidth;
        const sy = definition.row * this.cellHeight;

        this.ctx.clearRect(0, 0, this.cellWidth, this.cellHeight);
        this.ctx.drawImage(sheet, sx, sy, this.cellWidth, this.cellHeight, 0, 0, this.cellWidth, this.cellHeight);
    }

    ensureAnimationLoop() {
        if (this.animationFrameId || this.assetMode !== 'canvas' || !this.assetReady || this.visibilityPaused) return;
        this.lastTickAt = 0;
        const tick = (now) => {
            if (this.visibilityPaused || this.assetMode !== 'canvas' || !this.assetReady) {
                this.animationFrameId = null;
                return;
            }

            if (!this.lastTickAt) {
                this.lastTickAt = now;
            }

            const delta = Math.min(120, Math.max(0, now - this.lastTickAt));
            this.lastTickAt = now;

            const action = this.currentAction;
            if (action) {
                action.elapsedMs += delta;
                const frameDuration = action.definition.frameDurationMs;
                const frames = action.definition.frames;

                if (action.loop) {
                    action.frameIndex = Math.floor(action.elapsedMs / frameDuration) % frames;
                } else {
                    action.frameIndex = Math.min(frames - 1, Math.floor(action.elapsedMs / frameDuration));
                    if (!action.finished && action.elapsedMs >= frameDuration * frames) {
                        action.finished = true;
                        const onComplete = action.onComplete;
                        if (typeof onComplete === 'function') {
                            onComplete();
                        }

                        if (this.currentAction?.serial === action.serial) {
                            this.returnToIdle({ force: true });
                        }
                    }
                }
            }

            this.renderCurrentFrame();
            this.animationFrameId = requestAnimationFrame(tick);
        };

        this.animationFrameId = requestAnimationFrame(tick);
    }

    stopAnimationLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.lastTickAt = 0;
    }
}

window.addEventListener('load', () => {
    window.desktopPet = new DesktopPet();
});