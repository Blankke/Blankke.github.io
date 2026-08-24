// 桌面宠物系统：夜游 QQ 式像素桌宠
// 使用示例：页面末尾直接引入本文件即可，脚本会在 load 后创建 window.desktopPet。
// 运行时只读取 assets/pet/qq/ 下的 manifest 与 Canvas 图集；GIF/WebP 预览不参与播放。

class DesktopPet {
    constructor() {
        this.element = null;
        this.canvas = null;
        this.fallbackImage = null;
        this.ctx = null;
        this.dialogElement = null;
        this.dialogTextElement = null;
        this.actionMenu = null;

        // 位置可以保留小数用于插值，但每次绘制到 DOM 时都写入整数像素。
        this.x = 100;
        this.y = 100;
        this.movement = null;
        this.isDragging = false;
        this.dragPointerId = null;
        this.dragStart = null;

        this.dialogTimer = null;
        this.behaviorTimer = null;
        this.minesweeperIdleCheckInterval = null;
        this.dialogTimers = [];
        this.animationFrameId = null;
        this.lastTickAt = 0;
        this.visibilityPaused = document.hidden;
        this.disposed = false;

        this.windowObserverMap = new Map();
        this.bodyObserver = null;
        this.lastUserActivityAt = performance.now();
        this.lastMinesweeperInteraction = Date.now();
        this.actionSerial = 0;
        this.currentAction = null;
        this.currentState = 'idle';
        this.dialogShown = {};
        this.radioHintGiven = false;
        this.minesweeperCleared = !!window.quest?.hasFlag('minesweeper_fast_clear');
        this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;

        this.cellWidth = 256;
        this.cellHeight = 256;
        this.fallbackSize = { width: 48, height: 48 };
        this.manifest = null;
        this.actionDefs = this.createFallbackActionDefs();
        this.sheetImages = { core: null, actions: null };
        this.sheetPromises = new Map();
        this.assetMode = 'fallback';
        this.assetReady = false;
        this.imageLoadFailed = false;

        this.menuItems = [];
        this.menuIndex = 0;
        this.menuRequestSerial = 0;

        this.init();
    }

    /**
     * 用纯数据推进一帧，动画循环和无依赖测试共用这段逻辑。
     * @param {object} action 动作定义，包含 frames、durationsMs、loop
     * @param {number} frame 当前帧
     * @param {number} frameElapsed 当前帧已播放毫秒数
     * @param {number} deltaMs 本次 RAF 间隔
     * @returns {{frame: number, frameElapsed: number, completed: boolean}}
     */
    static advanceFrame(action, frame, frameElapsed, deltaMs) {
        const frames = Math.max(1, Number(action?.frames) || 1);
        const durations = Array.isArray(action?.durationsMs) && action.durationsMs.length
            ? action.durationsMs
            : Array.from({ length: frames }, () => 160);
        let nextFrame = Math.max(0, Math.min(frames - 1, Number(frame) || 0));
        let elapsed = Math.max(0, Number(frameElapsed) || 0) + Math.max(0, Number(deltaMs) || 0);
        let completed = false;
        let guard = 0;

        while (guard++ < 128) {
            const duration = Math.max(1, Number(durations[nextFrame]) || 160);
            if (elapsed < duration) break;
            elapsed -= duration;

            if (nextFrame < frames - 1) {
                nextFrame += 1;
                continue;
            }

            if (action.loop) {
                nextFrame = 0;
                continue;
            }

            // 一次性动作在最后一帧完整停留 duration 后结束，由调用方切回 idle。
            completed = true;
            nextFrame = frames - 1;
            elapsed = 0;
            break;
        }

        return { frame: nextFrame, frameElapsed: elapsed, completed };
    }

    static clampMenuPosition(clientX, clientY, menuWidth, menuHeight, viewportWidth, viewportHeight, gap = 8) {
        return {
            x: Math.max(gap, Math.min(Math.round(clientX), viewportWidth - menuWidth - gap)),
            y: Math.max(gap, Math.min(Math.round(clientY), viewportHeight - menuHeight - gap))
        };
    }

    isTalkEnabled() {
        return typeof window.mewmewTalkEnabled === 'boolean' ? window.mewmewTalkEnabled : false;
    }

    createFallbackActionDefs() {
        const durations = (duration) => Array.from({ length: 12 }, () => duration);
        return {
            idle: { sheet: 'core', row: 0, frames: 12, durationsMs: [180, 180, 160, 220, 220, 160, 180, 180, 160, 180, 180, 220], loop: true },
            'run-right': { sheet: 'core', row: 1, frames: 12, durationsMs: durations(70), loop: true },
            'run-left': { sheet: 'core', row: 2, frames: 12, durationsMs: durations(70), loop: true },
            wave: { sheet: 'core', row: 3, frames: 12, durationsMs: durations(120), loop: false },
            jump: { sheet: 'core', row: 4, frames: 12, durationsMs: durations(100), loop: false },
            'sleep-in-hat': { sheet: 'core', row: 5, frames: 12, durationsMs: durations(220), loop: false },
            chess: { sheet: 'actions', row: 0, frames: 12, durationsMs: durations(260), loop: false },
            'write-poem': { sheet: 'actions', row: 1, frames: 12, durationsMs: durations(220), loop: false },
            'read-book': { sheet: 'actions', row: 2, frames: 12, durationsMs: durations(220), loop: false },
            'listen-radio': { sheet: 'actions', row: 3, frames: 12, durationsMs: durations(160), loop: false },
            'moon-dandelion': { sheet: 'actions', row: 4, frames: 12, durationsMs: durations(200), loop: false },
            'cane-shunpo': { sheet: 'actions', row: 5, frames: 12, durationsMs: durations(100), loop: false },
            raijin: { sheet: 'actions', row: 6, frames: 12, durationsMs: durations(120), loop: false },
            'raiju-chibi': { sheet: 'actions', row: 7, frames: 12, durationsMs: durations(120), loop: false }
        };
    }

    async loadManifest() {
        try {
            const response = await fetch('assets/pet/qq/night-cat-qq-manifest.json', { cache: 'force-cache' });
            if (!response.ok) throw new Error(`manifest ${response.status}`);
            const parsed = await response.json();
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (error) {
            console.warn('[桌宠] manifest 加载失败，使用旧图标兜底。', error);
            return null;
        }
    }

    loadImage(src) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = async () => {
                // decode 失败不代表 onload 图片不可用，因此只把它当作优化步骤。
                try {
                    await image.decode?.();
                } catch {
                    // 浏览器已经触发 onload 时，继续使用已完成加载的图片。
                }
                resolve(image);
            };
            image.onerror = () => reject(new Error(`图片加载失败：${src}`));
            image.src = src;
        });
    }

    async loadSheet(sheet) {
        try {
            return await this.loadImage(`assets/pet/qq/${sheet.webp}`);
        } catch {
            // WebP 解码失败时回退到同尺寸的无损 PNG。
            return this.loadImage(`assets/pet/qq/${sheet.png}`);
        }
    }

    ensureSheet(name) {
        if (this.sheetImages[name]) return Promise.resolve(this.sheetImages[name]);
        if (this.sheetPromises.has(name)) return this.sheetPromises.get(name);
        const sheet = this.manifest?.sheets?.[name];
        if (!sheet) return Promise.reject(new Error(`未知图集：${name}`));

        const promise = this.loadSheet(sheet)
            .then((image) => {
                this.sheetImages[name] = image;
                this.sheetPromises.delete(name);
                return image;
            })
            .catch((error) => {
                this.sheetPromises.delete(name);
                throw error;
            });
        this.sheetPromises.set(name, promise);
        return promise;
    }

    init() {
        this.setupDom();
        this.bindEvents();
        this.bindContextSources();
        this.startDialogSequence();
        this.startBehaviorLoop();
        this.startMinesweeperIdleCheck();
        this.startAssetPipeline();
        this.setPosition(window.innerWidth - 176, window.innerHeight - 176);
        this.returnToIdle({ force: true, respectContext: false });
    }

    setupDom() {
        this.element = document.createElement('div');
        this.element.id = 'desktop-pet';
        this.element.className = 'desktop-pet';
        this.element.setAttribute('aria-label', '夜游桌宠');

        this.canvas = document.createElement('canvas');
        // 内部分辨率严格固定为一个资源格，显示层再缩小到 128/96。
        this.canvas.width = this.cellWidth;
        this.canvas.height = this.cellHeight;
        this.canvas.setAttribute('aria-label', '夜游桌宠，右键打开动作大全');
        this.canvas.setAttribute('role', 'img');
        this.canvas.tabIndex = 0;
        this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
        if (this.ctx) this.ctx.imageSmoothingEnabled = false;

        this.fallbackImage = document.createElement('img');
        this.fallbackImage.src = 'assets/icon/icon.png';
        this.fallbackImage.alt = '桌宠图标';
        this.fallbackImage.draggable = false;

        this.element.append(this.canvas, this.fallbackImage);
        document.body.appendChild(this.element);

        this.dialogElement = document.createElement('div');
        this.dialogElement.id = 'pet-dialog';
        this.dialogElement.className = 'pet-dialog';
        this.dialogElement.setAttribute('role', 'status');
        this.dialogElement.setAttribute('aria-live', 'polite');
        this.dialogTextElement = document.createElement('div');
        this.dialogTextElement.id = 'pet-dialog-text';
        this.dialogElement.appendChild(this.dialogTextElement);
        const arrow = document.createElement('span');
        arrow.className = 'pet-dialog-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        this.dialogElement.appendChild(arrow);
        document.body.appendChild(this.dialogElement);

        this.actionMenu = document.createElement('div');
        this.actionMenu.id = 'pet-action-menu';
        this.actionMenu.className = 'pet-action-menu';
        this.actionMenu.hidden = true;
        this.actionMenu.setAttribute('role', 'menu');
        this.actionMenu.setAttribute('aria-label', '夜游动作大全');
        document.body.appendChild(this.actionMenu);

        this.syncRenderSurface();
    }

    startAssetPipeline() {
        this.loadAssets();
    }

    async loadAssets() {
        const manifest = await this.loadManifest();
        if (!manifest?.sheets?.core || !manifest?.actions) {
            this.imageLoadFailed = true;
            this.enableFallbackMode();
            return;
        }

        this.manifest = manifest;
        this.actionDefs = manifest.actions;
        if (this.currentAction && this.actionDefs[this.currentAction.name]) {
            this.currentAction.definition = this.actionDefs[this.currentAction.name];
        }
        this.buildActionMenu();

        try {
            // 首屏只加载 core；actions 由动作菜单或首次扩展动作触发懒加载。
            await this.ensureSheet('core');
            this.assetMode = 'canvas';
            this.assetReady = true;
            this.imageLoadFailed = false;
            this.syncRenderSurface();
            this.ensureAnimationLoop();
            this.renderCurrentFrame();
        } catch (error) {
            console.warn('[桌宠] core 图集加载失败，使用旧图标兜底。', error);
            this.imageLoadFailed = true;
            this.enableFallbackMode();
        }
    }

    enableFallbackMode() {
        this.assetMode = 'fallback';
        this.assetReady = false;
        this.sheetImages = { core: null, actions: null };
        this.stopAnimationLoop();
        this.syncRenderSurface();
        this.renderFallback();
    }

    getDisplaySize() {
        return window.matchMedia?.('(max-width: 640px)').matches ? 96 : 128;
    }

    syncRenderSurface() {
        const size = this.getVisibleSize();
        this.element.style.width = `${size.width}px`;
        this.element.style.height = `${size.height}px`;
        this.canvas.style.width = `${size.width}px`;
        this.canvas.style.height = `${size.height}px`;
        this.canvas.style.display = this.assetMode === 'canvas' && this.assetReady ? 'block' : 'none';
        this.fallbackImage.style.display = this.assetMode === 'canvas' && this.assetReady ? 'none' : 'block';
        this.clampIntoViewport();
    }

    getVisibleSize() {
        if (this.assetMode === 'canvas' && this.assetReady) {
            const display = this.getDisplaySize();
            return { width: display, height: display };
        }
        return this.fallbackSize;
    }

    getActionDefinition(name) {
        return this.actionDefs?.[name] || null;
    }

    getActionPriority(name) {
        const definition = this.getActionDefinition(name);
        if (name === 'idle') return 0;
        if (name === 'run-left' || name === 'run-right') return 2;
        if (definition?.group === 'special' || ['raijin', 'raiju-chibi', 'cane-shunpo'].includes(name)) return 4;
        return 1;
    }

    getActionSource(name, options = {}) {
        if (options.source) return options.source;
        if (name === 'idle') return 'system';
        if (name === 'run-left' || name === 'run-right') return 'movement';
        if (options.priority >= 4) return 'special';
        return 'context';
    }

    getSourcePriority(source, fallback) {
        const priorities = {
            system: 0,
            context: 1,
            movement: 2,
            special: 4,
            click: 5,
            menu: 6,
            drag: 7
        };
        return priorities[source] ?? fallback;
    }

    markActivity() {
        this.lastUserActivityAt = performance.now();
    }

    clampIntoViewport(x = this.x, y = this.y) {
        const size = this.getVisibleSize();
        return {
            x: Math.max(0, Math.min(Math.max(0, window.innerWidth - size.width), x)),
            y: Math.max(0, Math.min(Math.max(0, window.innerHeight - size.height), y))
        };
    }

    setPosition(x, y, options = {}) {
        const next = options.clamp === false ? { x, y } : this.clampIntoViewport(x, y);
        this.x = Number.isFinite(next.x) ? next.x : this.x;
        this.y = Number.isFinite(next.y) ? next.y : this.y;
        this.applyPosition();
        if (this.dialogElement?.style.display === 'block') this.updateDialogPosition();
    }

    applyPosition() {
        if (!this.element) return;
        // transform 只负责位置，永远不使用镜像或半像素坐标。
        this.element.style.transform = `translate3d(${Math.round(this.x)}px, ${Math.round(this.y)}px, 0)`;
    }

    updateDialogPosition() {
        if (!this.dialogElement) return;
        const dialogWidth = this.dialogElement.offsetWidth;
        const dialogHeight = this.dialogElement.offsetHeight;
        const size = this.getVisibleSize();
        const dialogX = Math.max(10, Math.min(window.innerWidth - dialogWidth - 10, this.x + size.width / 2 - dialogWidth / 2));
        const dialogY = Math.max(10, this.y - dialogHeight - 18);
        this.dialogElement.style.left = `${Math.round(dialogX)}px`;
        this.dialogElement.style.top = `${Math.round(dialogY)}px`;
    }

    showDialog(text, duration = 5000) {
        if (!this.dialogTextElement) return;
        this.dialogTextElement.textContent = this.isTalkEnabled() ? text : '喵';
        this.dialogElement.style.display = 'block';
        this.updateDialogPosition();
        if (this.dialogTimer) clearTimeout(this.dialogTimer);
        this.dialogTimer = window.setTimeout(() => this.hideDialog(), duration);
    }

    hideDialog() {
        if (this.dialogElement) this.dialogElement.style.display = 'none';
    }

    startDialogSequence() {
        const initialDialogs = [
            { text: '我是这里的小向导，有什么需要帮助的吗？', delay: 6000, id: 'intro0' },
            { text: '这里看起来很简单……对吧？', delay: 10000, id: 'intro1' },
            { text: '我主人说，真正重要的东西往往藏在表面之下。', delay: 30000, id: 'hint1' },
            { text: '就像冰山……你只能看到露出水面的那一小部分。', delay: 40000, id: 'hint2' }
        ];
        initialDialogs.forEach((dialog) => {
            const timer = window.setTimeout(() => {
                if (!this.dialogShown[dialog.id] && !this.disposed) {
                    this.showDialog(dialog.text);
                    this.dialogShown[dialog.id] = true;
                }
            }, dialog.delay);
            this.dialogTimers.push(timer);
        });
    }

    bindEvents() {
        this.canvas.addEventListener('contextmenu', (event) => {
            // 只拦截宠物自身右键，桌面和窗口仍保留原有右键菜单。
            event.preventDefault();
            this.openActionMenu(event.clientX, event.clientY);
        });

        this.canvas.addEventListener('keydown', (event) => {
            if ((event.shiftKey && event.key === 'F10') || event.key === 'ContextMenu') {
                event.preventDefault();
                const box = this.canvas.getBoundingClientRect();
                this.openActionMenu(box.left + box.width / 2, box.top + box.height / 2);
            }
        });

        this.element.addEventListener('pointerdown', (event) => {
            if (event.button !== 0) return;
            event.preventDefault();
            this.markActivity();
            this.closeActionMenu({ restoreFocus: false });
            this.isDragging = true;
            this.dragPointerId = event.pointerId;
            this.dragStart = {
                clientX: event.clientX,
                clientY: event.clientY,
                x: this.x,
                y: this.y,
                moved: false,
                offsetX: event.clientX - this.x,
                offsetY: event.clientY - this.y
            };
            this.movement = null;
            this.playAction('idle', { source: 'drag', priority: 7, force: true, interrupt: true, restart: true });
            this.element.classList.add('is-dragging');
            this.element.setPointerCapture?.(event.pointerId);
        });

        this.element.addEventListener('pointermove', (event) => {
            if (!this.isDragging || event.pointerId !== this.dragPointerId || !this.dragStart) return;
            const moved = Math.abs(event.clientX - this.dragStart.clientX) + Math.abs(event.clientY - this.dragStart.clientY);
            this.dragStart.moved ||= moved > 4;
            const next = this.clampIntoViewport(event.clientX - this.dragStart.offsetX, event.clientY - this.dragStart.offsetY);
            this.setPosition(next.x, next.y);
            this.markActivity();
        });

        const stopDrag = (event) => {
            if (!this.isDragging || event.pointerId !== this.dragPointerId) return;
            const wasClick = !this.dragStart?.moved;
            this.isDragging = false;
            this.dragPointerId = null;
            this.dragStart = null;
            this.element.classList.remove('is-dragging');
            try {
                this.element.releasePointerCapture?.(event.pointerId);
            } catch {
                // 某些浏览器在 pointercancel 后已自动释放捕获，忽略即可。
            }

            if (wasClick) {
                this.playAction('wave', { source: 'click', priority: 5, force: true, interrupt: true, restart: true });
                this.showRandomDialog();
            } else {
                this.returnToIdle({ force: true });
            }
        };
        this.element.addEventListener('pointerup', stopDrag);
        this.element.addEventListener('pointercancel', stopDrag);

        document.addEventListener('pointerdown', (event) => {
            if (this.actionMenu.hidden) return;
            if (!this.actionMenu.contains(event.target) && event.target !== this.canvas) {
                this.closeActionMenu({ restoreFocus: false });
            }
        });

        this.actionMenu.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.closeActionMenu();
                return;
            }
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                if (event.key === 'ArrowDown') this.menuIndex = (this.menuIndex + 1) % this.menuItems.length;
                if (event.key === 'ArrowUp') this.menuIndex = (this.menuIndex - 1 + this.menuItems.length) % this.menuItems.length;
                if (event.key === 'Home') this.menuIndex = 0;
                if (event.key === 'End') this.menuIndex = this.menuItems.length - 1;
                this.focusMenuItem();
                return;
            }
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.menuItems[this.menuIndex]?.click();
            }
        });

        window.addEventListener('resize', () => {
            this.syncRenderSurface();
            this.setPosition(this.x, this.y);
            this.renderCurrentFrame();
            this.closeActionMenu({ restoreFocus: false });
        });
        window.addEventListener('scroll', () => this.closeActionMenu({ restoreFocus: false }), { passive: true });

        document.addEventListener('visibilitychange', () => {
            this.visibilityPaused = document.hidden;
            if (this.visibilityPaused) {
                this.closeActionMenu({ restoreFocus: false });
                this.stopAnimationLoop();
            } else if (this.assetMode === 'canvas' && this.assetReady) {
                // 回到前台从当前姿态继续，不把后台停留时间计入动作。
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
        this.bodyObserver = new MutationObserver((mutations) => {
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
            if (shouldRefresh) this.refreshContextAction();
        });
        this.bodyObserver.observe(document.body, {
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
            ['play', 'pause', 'ended', 'loadedmetadata'].forEach((eventName) => musicAudio.addEventListener(eventName, updateFromMusic));
        }
    }

    getOpenWindow(id) {
        const win = document.getElementById(id);
        if (!win || !win.classList.contains('window-open') || win.classList.contains('window-minimized')) return null;
        return win;
    }

    getDesiredContextAction() {
        const musicAudio = document.getElementById('music-audio');
        if (musicAudio && !musicAudio.paused && !musicAudio.ended && musicAudio.src) return 'listen-radio';
        if (this.getOpenWindow('window-minesweeper')) return 'chess';
        if (this.getOpenWindow('window-library')) return 'read-book';
        if (this.getOpenWindow('window-blog')) return 'write-poem';
        if (document.querySelector('.window.window-open.is-app-loading:not(.window-minimized)')) return 'chess';
        return null;
    }

    refreshContextAction() {
        if (this.isDragging || this.movement || this.prefersReducedMotion) return;
        const current = this.currentAction;
        if (current && current.source !== 'context' && current.name !== 'idle') return;
        const desired = this.getDesiredContextAction();
        if (desired) {
            this.playAction(desired, { source: 'context', priority: 1, interrupt: false });
        } else if (!current || current.source === 'context') {
            this.returnToIdle({ respectContext: false });
        }
    }

    /**
     * 统一动作入口。旧调用方的 priority/force/onComplete 参数继续有效，
     * 新调用方可使用 source 与 interrupt 控制状态机优先级。
     */
    playAction(name, options = {}) {
        const definition = this.getActionDefinition(name);
        if (!definition) return false;

        const source = this.getActionSource(name, options);
        const fallbackPriority = this.getActionPriority(name);
        const priority = this.getSourcePriority(source, Number.isFinite(options.priority) ? options.priority : fallbackPriority);
        const interrupt = options.interrupt !== false;
        const current = this.currentAction;

        if (current && current.name === name && !options.restart && !options.force) return true;
        if (current && !options.force) {
            const userOverride = source === 'menu' || source === 'drag';
            if (!userOverride && (!interrupt || priority < current.priority || (priority === current.priority && current.interruptible === false))) {
                return false;
            }
        }

        if (name !== 'run-left' && name !== 'run-right' && source !== 'movement') this.movement = null;
        const serial = ++this.actionSerial;
        this.currentAction = {
            serial,
            name,
            definition,
            source,
            priority,
            loop: options.loop ?? !!definition.loop,
            interruptible: options.interruptible !== false,
            onComplete: typeof options.onComplete === 'function' ? options.onComplete : null,
            frameIndex: 0,
            frameElapsed: 0,
            finished: false
        };
        this.currentState = name;

        if (definition.sheet && !this.sheetImages[definition.sheet] && this.manifest) {
            this.ensureSheet(definition.sheet)
                .then(() => {
                    if (this.currentAction?.serial === serial) this.renderCurrentFrame();
                })
                .catch(() => {
                    if (this.currentAction?.serial === serial) this.returnToIdle({ force: true, respectContext: false });
                });
        }

        if (this.assetMode === 'canvas' && this.assetReady) this.ensureAnimationLoop();
        this.renderCurrentFrame();
        return true;
    }

    clearMovement() {
        this.movement = null;
    }

    returnToIdle(options = {}) {
        const respectContext = options.respectContext !== false;
        const desired = respectContext && !this.prefersReducedMotion ? this.getDesiredContextAction() : null;
        const name = desired || 'idle';
        if (!options.force && this.currentAction?.name === name) return true;
        return this.playAction(name, {
            source: desired ? 'context' : 'system',
            priority: desired ? 1 : 0,
            force: !!options.force,
            interrupt: true,
            restart: !!options.restart
        });
    }

    setMovementDirection(dx, options = {}) {
        if (dx === 0) return this.returnToIdle({ force: true });
        return this.playAction(dx > 0 ? 'run-right' : 'run-left', {
            source: 'movement',
            priority: 2,
            force: !!options.force,
            interrupt: true,
            restart: true
        });
    }

    performMoveTo(targetX, targetY, options = {}) {
        const next = this.clampIntoViewport(targetX, targetY);
        const dx = next.x - this.x;
        const dy = next.y - this.y;
        const distance = Math.hypot(dx, dy);
        if (options.animate === false || this.prefersReducedMotion || distance <= 2) {
            this.setPosition(next.x, next.y);
            this.returnToIdle({ force: true, respectContext: false });
            return;
        }

        this.movement = {
            targetX: next.x,
            targetY: next.y,
            speed: Math.max(0.04, Number(options.speed) || 0.12)
        };
        this.setMovementDirection(dx, options);
    }

    advanceMovement(deltaMs) {
        if (!this.movement || this.isDragging) return;
        const dx = this.movement.targetX - this.x;
        const dy = this.movement.targetY - this.y;
        const distance = Math.hypot(dx, dy);
        const step = this.movement.speed * deltaMs;
        if (distance <= step || distance <= 0.01) {
            this.setPosition(this.movement.targetX, this.movement.targetY);
            this.movement = null;
            this.returnToIdle({ force: true, respectContext: false });
            return;
        }
        this.setPosition(this.x + dx / distance * step, this.y + dy / distance * step);
    }

    moveToElement(elementId) {
        const element = document.getElementById(elementId);
        if (!element || !element.classList.contains('window-open') || element.classList.contains('window-minimized')) return;
        const rect = element.getBoundingClientRect();
        const size = this.getVisibleSize();
        let targetX = rect.right + 10;
        const targetY = rect.top + 50;
        if (targetX + size.width > window.innerWidth) targetX = rect.left - size.width - 10;
        this.setPosition(
            Math.max(10, Math.min(window.innerWidth - size.width - 10, targetX)),
            Math.max(10, Math.min(window.innerHeight - size.height - 10, targetY))
        );
    }

    startAnimationLoop() {
        if (this.animationFrameId || this.assetMode !== 'canvas' || !this.assetReady || this.visibilityPaused) return;
        this.lastTickAt = 0;
        const tick = (now) => {
            if (this.disposed || this.visibilityPaused || this.assetMode !== 'canvas' || !this.assetReady) {
                this.animationFrameId = null;
                return;
            }
            if (!this.lastTickAt) this.lastTickAt = now;
            const delta = Math.min(50, Math.max(0, now - this.lastTickAt));
            this.lastTickAt = now;
            this.advanceMovement(delta);
            this.advanceAction(delta);
            this.renderCurrentFrame();
            this.animationFrameId = window.requestAnimationFrame(tick);
        };
        this.animationFrameId = window.requestAnimationFrame(tick);
    }

    ensureAnimationLoop() {
        this.startAnimationLoop();
    }

    stopAnimationLoop() {
        if (this.animationFrameId) window.cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
        this.lastTickAt = 0;
    }

    advanceAction(deltaMs) {
        const action = this.currentAction;
        if (!action || action.finished) return;
        const result = DesktopPet.advanceFrame(action.definition, action.frameIndex, action.frameElapsed, deltaMs);
        action.frameIndex = result.frame;
        action.frameElapsed = result.frameElapsed;
        if (!result.completed || action.finished) return;

        action.finished = true;
        const onComplete = action.onComplete;
        if (typeof onComplete === 'function') onComplete();
        if (this.currentAction?.serial !== action.serial) return;
        this.returnToIdle({ force: true, respectContext: false });
    }

    renderFallback() {
        if (this.ctx) this.ctx.clearRect(0, 0, this.cellWidth, this.cellHeight);
    }

    renderCurrentFrame() {
        if (this.assetMode !== 'canvas' || !this.assetReady || !this.ctx) return this.renderFallback();
        const action = this.currentAction || { name: 'idle', frameIndex: 0 };
        const definition = action.definition || this.getActionDefinition(action.name) || this.getActionDefinition('idle');
        const sheet = this.sheetImages[definition?.sheet];
        if (!definition || !sheet) {
            // 扩展图集正在懒加载时继续显示 core 待机，避免桌宠在网络等待期间闪空。
            const idleDefinition = this.getActionDefinition('idle');
            const idleSheet = this.sheetImages[idleDefinition?.sheet];
            if (!idleDefinition || !idleSheet) return this.renderFallback();
            this.ctx.clearRect(0, 0, this.cellWidth, this.cellHeight);
            this.ctx.imageSmoothingEnabled = false;
            this.ctx.drawImage(idleSheet, 0, Number(idleDefinition.row) * this.cellHeight, this.cellWidth, this.cellHeight, 0, 0, this.cellWidth, this.cellHeight);
            return;
        }

        const frameIndex = Math.max(0, Math.min(Number(definition.frames) - 1, action.frameIndex || 0));
        const sx = frameIndex * this.cellWidth;
        const sy = Number(definition.row) * this.cellHeight;
        this.ctx.clearRect(0, 0, this.cellWidth, this.cellHeight);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(sheet, sx, sy, this.cellWidth, this.cellHeight, 0, 0, this.cellWidth, this.cellHeight);
    }

    buildActionMenu() {
        if (!this.actionMenu || !this.manifest?.menuGroups) return;
        const fragment = document.createDocumentFragment();
        this.menuItems = [];
        this.manifest.menuGroups.forEach((group) => {
            const heading = document.createElement('div');
            heading.className = 'pet-action-menu__heading';
            heading.textContent = group.label;
            fragment.appendChild(heading);

            group.actions.forEach((name) => {
                const action = this.manifest.actions[name];
                if (!action) return;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'pet-action-menu__item';
                button.setAttribute('role', 'menuitem');
                button.tabIndex = -1;
                button.dataset.action = name;

                const icon = document.createElement('img');
                icon.src = `assets/pet/qq/${action.icon}`;
                icon.alt = '';
                icon.width = 64;
                icon.height = 64;
                icon.draggable = false;
                const label = document.createElement('span');
                label.textContent = action.label;
                button.append(icon, label);
                button.addEventListener('click', () => {
                    this.closeActionMenu();
                    this.playAction(name, { source: 'menu', priority: 6, interrupt: true, restart: true });
                });
                this.menuItems.push(button);
                fragment.appendChild(button);
            });
        });
        this.actionMenu.replaceChildren(fragment);
    }

    async openActionMenu(clientX, clientY) {
        if (!this.manifest) return;
        const requestSerial = ++this.menuRequestSerial;
        try {
            await this.ensureSheet('actions');
        } catch {
            if (requestSerial === this.menuRequestSerial) this.showDialog('动作图集暂时无法加载。', 2500);
            return;
        }
        if (this.disposed || requestSerial !== this.menuRequestSerial) return;

        this.actionMenu.hidden = false;
        this.actionMenu.style.left = '0px';
        this.actionMenu.style.top = '0px';
        const box = this.actionMenu.getBoundingClientRect();
        const position = DesktopPet.clampMenuPosition(clientX, clientY, box.width, box.height, window.innerWidth, window.innerHeight);
        this.actionMenu.style.left = `${position.x}px`;
        this.actionMenu.style.top = `${position.y}px`;
        this.menuIndex = 0;
        this.focusMenuItem();
    }

    closeActionMenu(options = {}) {
        this.menuRequestSerial += 1;
        if (!this.actionMenu || this.actionMenu.hidden) return;
        this.actionMenu.hidden = true;
        if (options.restoreFocus !== false) this.canvas.focus({ preventScroll: true });
    }

    focusMenuItem() {
        this.menuItems.forEach((item, index) => { item.tabIndex = index === this.menuIndex ? 0 : -1; });
        this.menuItems[this.menuIndex]?.focus({ preventScroll: true });
    }

    startBehaviorLoop() {
        if (this.behaviorTimer) clearTimeout(this.behaviorTimer);
        const delay = this.prefersReducedMotion ? 12000 : 4000;
        this.behaviorTimer = window.setTimeout(() => {
            this.behaviorTick();
            this.startBehaviorLoop();
        }, delay);
    }

    behaviorTick() {
        if (document.hidden || this.isDragging || this.movement || this.actionMenu?.hidden === false || this.prefersReducedMotion) return;
        const current = this.currentAction;
        if (current && current.name !== 'idle' && current.source !== 'context') return;

        const desiredContext = this.getDesiredContextAction();
        if (desiredContext) {
            this.playAction(desiredContext, { source: 'context', priority: 1, interrupt: false });
            return;
        }

        const inactiveMs = performance.now() - this.lastUserActivityAt;
        const hour = new Date().getHours();
        const nightMode = document.body.classList.contains('effects-night') || hour >= 22 || hour < 6;
        if (inactiveMs >= 45000 && current?.name !== 'sleep-in-hat') {
            this.playAction('sleep-in-hat', { source: 'context', priority: 1, interrupt: false });
            return;
        }
        if (nightMode && Math.random() < 0.08) {
            this.playAction('moon-dandelion', { source: 'context', priority: 1, interrupt: false });
            return;
        }
        if (inactiveMs < 10000 || Math.random() > 0.25) return;

        const size = this.getVisibleSize();
        const targetX = Math.random() * Math.max(1, window.innerWidth - size.width);
        const targetY = Math.random() * Math.max(1, window.innerHeight - size.height);
        if (Math.random() < 0.08) {
            this.playAction('cane-shunpo', {
                source: 'special',
                priority: 4,
                interrupt: true,
                interruptible: false,
                onComplete: () => this.performMoveTo(targetX, targetY, { force: true })
            });
            return;
        }
        this.performMoveTo(targetX, targetY);
    }

    startMinesweeperIdleCheck() {
        this.minesweeperIdleCheckInterval = window.setInterval(() => {
            if (this.disposed) return;
            if (Date.now() - this.lastMinesweeperInteraction <= 300000) return;
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
        const dialogs = ['喵？', '找我有什么事吗？', '我在这里呢~', '别总是戳我啦！', '有些秘密，需要你自己去发现……'];
        if (this.minesweeperCleared) {
            dialogs.push('你已经通关扫雷了呢！', '有些东西，不是点出来的。', '你可以试试同时按下几个你平时不会一起按的键。');
        }
        this.showDialog(dialogs[Math.floor(Math.random() * dialogs.length)], 3000);
    }

    celebrate() {
        this.playAction('jump', { source: 'special', priority: 4, interrupt: true, restart: true });
    }

    onMinesweeperWin(time) {
        this.markActivity();
        this.moveToElement('window-minesweeper');
        this.playAction('raijin', {
            source: 'special',
            priority: 4,
            interrupt: true,
            interruptible: false,
            onComplete: () => {
                if (Math.random() < 0.35) this.playAction('raiju-chibi', { source: 'special', priority: 4, force: true, interrupt: true });
            }
        });

        if (time > 50) {
            this.showDialog(`通关啦！不过用了 ${time} 秒……有点慢哦~`, 4000);
            window.setTimeout(() => this.showDialog('下次试试能不能在 50 秒内完成？', 4000), 4500);
            return;
        }

        if (!this.minesweeperCleared) {
            this.minesweeperCleared = true;
            window.quest?.setFlag('minesweeper_fast_clear', true);
            this.showDialog(`哇！${time} 秒！太快了！`, 4000);
            window.setTimeout(() => this.showDialog('看来你确实有耐心……也有足够的好奇心。', 4000), 5000);
            window.setTimeout(() => this.showDialog('那我就告诉你一个秘密吧~', 4000), 10000);
            window.setTimeout(() => this.showDialog('我主人说……高手都用键盘，菜鸟才点鼠标。', 5000), 15000);
            window.setTimeout(() => this.showDialog('试试看……同时按下几个你平时不会一起按的键？', 6000), 21000);
            window.setTimeout(() => this.showDialog('Ctrl……Alt……我主人姓什么来着?', 6000), 21000);
            return;
        }
        this.showDialog(`又是 ${time} 秒！保持这个速度！`, 3000);
    }

    onMinesweeperLoss() {
        this.markActivity();
        this.moveToElement('window-minesweeper');
        const dialogs = ['哎呀，炸了……', '没关系，再试一次！', '小心一点哦~', '那个位置看起来就很危险……', '不要灰心，下次一定行！'];
        this.showDialog(dialogs[Math.floor(Math.random() * dialogs.length)], 3000);
    }

    triggerDialog(dialogId) {
        const dialogs = {
            cmd_hint: '有时候，命令行比图形界面更强大……',
            radio_hint: '我的主人喜欢听广播，特别是那个城市之声的电台……',
            secret_found: '你找到了！真不简单！'
        };
        if (dialogs[dialogId]) this.showDialog(dialogs[dialogId], 5000);
    }

    giveRadioHint() {
        if (this.radioHintGiven) return;
        this.radioHintGiven = true;
        [
            ['你之前看过我主人的个人介绍吗？', 1000, 5000],
            ['他说过……他喜欢听广播。', 7000, 5000],
            ['有些编号，不在文件里。', 13000, 6000],
            ['它们在……你意想不到的地方。', 20000, 6000]
        ].forEach(([text, delay, duration]) => window.setTimeout(() => this.showDialog(text, duration), delay));
    }

    advanceActionFrameForTest(deltaMs) {
        if (!this.currentAction) return null;
        const result = DesktopPet.advanceFrame(this.currentAction.definition, this.currentAction.frameIndex, this.currentAction.frameElapsed, deltaMs);
        this.currentAction.frameIndex = result.frame;
        this.currentAction.frameElapsed = result.frameElapsed;
        return result;
    }

    destroy() {
        this.disposed = true;
        this.stopAnimationLoop();
        if (this.behaviorTimer) clearTimeout(this.behaviorTimer);
        if (this.minesweeperIdleCheckInterval) clearInterval(this.minesweeperIdleCheckInterval);
        if (this.dialogTimer) clearTimeout(this.dialogTimer);
        this.dialogTimers.forEach((timer) => clearTimeout(timer));
        this.windowObserverMap.forEach((observer) => observer.disconnect());
        this.bodyObserver?.disconnect();
        this.closeActionMenu({ restoreFocus: false });
        this.dialogElement?.remove();
        this.actionMenu?.remove();
        this.element?.remove();
    }
}

// 保留全局类名，便于调试和无浏览器轻量测试；网站实际入口仍是 window.desktopPet。
window.DesktopPet = DesktopPet;
window.addEventListener('load', () => {
    window.desktopPet = new DesktopPet();
});
