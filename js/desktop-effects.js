// High-quality desktop visual effects: pixel sakura, starfield, and classic bubbles.

(function() {
    const STORAGE_KEY = window.BLANKKE_STATE_KEYS?.effects || 'blankke_effects_v1';
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const defaults = {
        mode: reduceMotion ? 'off' : 'sakura',
        intensity: 'standard',
        speed: 'standard',
        opacity: 'standard',
        quality: 'high',
        idleBoost: true
    };

    const intensityScale = { light: 0.55, standard: 1, lush: 1.65 };
    const speedScale = { slow: 0.68, standard: 1, fast: 1.36 };
    const opacityScale = { low: 0.55, standard: 0.82, high: 1 };
    const qualityScale = { balanced: 1.25, high: 1.75, ultra: 2.25 };
    const mobileScale = () => (window.innerWidth < 720 ? 0.58 : 1);

    const sakuraSprites = [
        [
            '...11..',
            '..122..',
            '.12321.',
            '..232..',
            '..121..',
            '...1...'
        ],
        [
            '..1....',
            '.122...',
            '12321..',
            '.2321..',
            '..11...',
            '.......'
        ],
        [
            '...1...',
            '..121..',
            '.12321.',
            '1234321',
            '.12321.',
            '..121..',
            '...1...'
        ],
        [
            '.11....',
            '1231...',
            '.2321..',
            '..121..',
            '...1...',
            '.......'
        ],
        [
            '...11..',
            '..123..',
            '.12321.',
            '...21..',
            '..11...',
            '.......'
        ]
    ];

    const sakuraPalettes = [
        ['#ffd6e8', '#ff9fc8', '#fff3f8', '#e873a8'],
        ['#ffe0ef', '#ffb0d2', '#fff8fb', '#dc6f9e'],
        ['#f8c4df', '#f08fbd', '#fff0f7', '#c85c91'],
        ['#fff0f4', '#ffc2d8', '#ffffff', '#e889ad']
    ];

    let state = loadState();
    let canvas = null;
    let ctx = null;
    let vignette = null;
    let rafId = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let lastTime = 0;
    let paused = false;
    let hiddenPaused = false;
    let particles = [];
    let meteors = [];
    let lastInputAt = performance.now();
    let lastMode = null;
    let settingsWindowId = 'window-effects-settings';

    function loadState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return { ...defaults, ...(parsed && typeof parsed === 'object' ? parsed : {}) };
        } catch {
            return { ...defaults };
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function ensureCanvas() {
        if (canvas) return;

        vignette = document.createElement('div');
        vignette.className = 'desktop-effects-vignette';
        document.body.appendChild(vignette);

        canvas = document.createElement('canvas');
        canvas.className = 'desktop-effects-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) ctx.imageSmoothingEnabled = false;

        resizeCanvas();
        bindEvents();
    }

    function bindEvents() {
        window.addEventListener('resize', () => {
            resizeCanvas();
            reseedCurrentMode();
        });

        document.addEventListener('visibilitychange', () => {
            hiddenPaused = document.hidden;
            if (!hiddenPaused) {
                lastTime = performance.now();
                startLoop();
            }
        });

        ['mousemove', 'mousedown', 'keydown', 'touchstart', 'wheel'].forEach((eventName) => {
            window.addEventListener(eventName, () => {
                lastInputAt = performance.now();
            }, { passive: true });
        });

        document.getElementById('ctx-effects')?.addEventListener('click', () => {
            api.openSettings();
            const contextMenu = document.getElementById('context-menu');
            if (contextMenu) contextMenu.style.display = 'none';
        });
    }

    function resizeCanvas() {
        if (!canvas || !ctx) return;
        const qualityDpr = qualityScale[state.quality] || qualityScale.high;
        dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, qualityDpr));
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.max(1, Math.floor(width * dpr));
        canvas.height = Math.max(1, Math.floor(height * dpr));
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
    }

    function applyBodyMode() {
        document.body.classList.toggle('effects-active', state.mode !== 'off');
        document.body.classList.toggle('effects-night', state.mode === 'stars');
        if (canvas) {
            canvas.style.display = state.mode === 'off' ? 'none' : 'block';
            canvas.style.opacity = String(opacityScale[state.opacity] || opacityScale.standard);
        }
    }

    function reseedCurrentMode() {
        particles = [];
        meteors = [];
        lastMode = state.mode;

        if (state.mode === 'sakura') seedSakura();
        if (state.mode === 'stars') seedStars();
        if (state.mode === 'bubbles') seedBubbles(false);
    }

    function getAreaFactor() {
        return Math.sqrt((width * height) / (1440 * 900)) * mobileScale();
    }

    function getIntensity() {
        let scale = intensityScale[state.intensity] || intensityScale.standard;
        if (state.mode === 'bubbles' && state.idleBoost && performance.now() - lastInputAt > 10000) {
            scale *= 1.55;
        }
        return scale;
    }

    function targetCount(mode = state.mode) {
        const area = getAreaFactor();
        const intensity = getIntensity();
        const base = {
            sakura: 96,
            stars: 170,
            bubbles: 28
        }[mode] || 0;
        const max = {
            sakura: 230,
            stars: 420,
            bubbles: 68
        }[mode] || 0;
        return Math.min(max, Math.max(0, Math.round(base * area * intensity)));
    }

    function randomBetween(min, max) {
        return min + Math.random() * (max - min);
    }

    function seedSakura() {
        const count = targetCount('sakura');
        for (let i = 0; i < count; i += 1) {
            particles.push(createSakura(true));
        }
    }

    function createSakura(anywhere = false) {
        const depth = Math.random();
        return {
            kind: 'sakura',
            x: anywhere ? randomBetween(-40, width + 120) : randomBetween(width + 20, width + 220),
            y: anywhere ? randomBetween(-80, height + 40) : randomBetween(-120, height * 0.25),
            depth,
            baseSize: randomBetween(1.6, 3.8) + depth * 2.3,
            vx: randomBetween(38, 82) + depth * 78,
            vy: randomBetween(32, 74) + depth * 72,
            phase: Math.random() * Math.PI * 2,
            spin: randomBetween(-1.6, 1.6),
            sway: randomBetween(12, 36) + depth * 18,
            sprite: Math.floor(Math.random() * sakuraSprites.length),
            palette: Math.floor(Math.random() * sakuraPalettes.length),
            flip: Math.random() > 0.5 ? 1 : -1
        };
    }

    function resetSakura(p) {
        const next = createSakura(false);
        Object.assign(p, next);
    }

    function updateSakura(dt, now) {
        syncParticleCount('sakura');
        const speed = speedScale[state.speed] || speedScale.standard;
        const gust = 1 + Math.sin(now * 0.00045) * 0.18 + Math.sin(now * 0.0017) * 0.08;

        particles.forEach((p) => {
            p.phase += dt * (1.2 + p.depth * 1.4);
            const flutter = Math.sin(p.phase) * p.sway;
            p.x -= (p.vx * gust * speed + flutter * 0.18) * dt;
            p.y += (p.vy * (0.88 + gust * 0.12) * speed + Math.cos(p.phase * 0.72) * 13) * dt;

            if (p.x < -90 || p.y > height + 90) resetSakura(p);
        });
    }

    function drawSakura(now) {
        const breezeAlpha = state.opacity === 'high' ? 0.2 : 0.13;
        const gradient = ctx.createLinearGradient(width, 0, 0, height);
        gradient.addColorStop(0, `rgba(255, 214, 232, ${breezeAlpha})`);
        gradient.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
        gradient.addColorStop(1, 'rgba(255, 190, 217, 0.06)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        particles
            .slice()
            .sort((a, b) => a.depth - b.depth)
            .forEach((p) => {
                drawPixelPetal(p, now);
            });
    }

    function drawPixelPetal(p, now) {
        const sprite = sakuraSprites[p.sprite];
        const palette = sakuraPalettes[p.palette];
        const scale = Math.max(1.2, p.baseSize);
        const rot = Math.sin(p.phase * 0.8) * 0.55 + p.spin * now * 0.0005;
        const alpha = 0.42 + p.depth * 0.46;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(rot);
        ctx.scale(p.flip, 1);

        for (let y = 0; y < sprite.length; y += 1) {
            for (let x = 0; x < sprite[y].length; x += 1) {
                const idx = Number(sprite[y][x]);
                if (!idx) continue;
                ctx.fillStyle = palette[idx - 1] || palette[0];
                ctx.fillRect((x - sprite[y].length / 2) * scale, (y - sprite.length / 2) * scale, scale, scale);
            }
        }

        ctx.restore();
    }

    function seedStars() {
        const count = targetCount('stars');
        for (let i = 0; i < count; i += 1) {
            particles.push(createStar());
        }
    }

    function createStar() {
        const depth = Math.random();
        const typeRand = Math.random();
        return {
            kind: 'star',
            x: Math.random() * width,
            y: Math.random() * height,
            depth,
            size: typeRand > 0.86 ? randomBetween(1.4, 2.6) : randomBetween(0.8, 1.8),
            phase: Math.random() * Math.PI * 2,
            twinkle: randomBetween(0.45, 1.8),
            type: typeRand > 0.9 ? 'cross' : (typeRand > 0.78 ? 'warm' : 'dot'),
            drift: randomBetween(0.02, 0.16)
        };
    }

    function updateStars(dt, now) {
        syncParticleCount('stars');
        particles.forEach((p) => {
            p.phase += dt * p.twinkle;
            p.x += p.drift * dt * 10;
            if (p.x > width + 8) p.x = -8;
        });

        if (meteors.length < 2 && Math.random() < dt * 0.08 * getIntensity()) {
            meteors.push(createMeteor());
        }

        meteors = meteors.filter((m) => {
            m.life -= dt;
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            return m.life > 0 && m.x > -160 && m.y < height + 160;
        });
    }

    function createMeteor() {
        return {
            x: randomBetween(width * 0.2, width + 100),
            y: randomBetween(-80, height * 0.35),
            vx: randomBetween(-390, -250),
            vy: randomBetween(210, 330),
            life: randomBetween(0.65, 1.15),
            maxLife: 1.15,
            size: randomBetween(1.2, 2.2)
        };
    }

    function drawStars() {
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, 'rgba(3, 9, 24, 0.45)');
        bg.addColorStop(0.55, 'rgba(3, 22, 35, 0.22)');
        bg.addColorStop(1, 'rgba(0, 40, 44, 0.12)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        particles.forEach((p) => {
            const flicker = 0.45 + (Math.sin(p.phase) + 1) * 0.28 + p.depth * 0.2;
            const alpha = Math.min(1, flicker);
            const size = p.size + p.depth * 1.4;
            const x = Math.round(p.x);
            const y = Math.round(p.y);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.type === 'warm' ? '#ffe6a3' : '#dff7ff';
            ctx.fillRect(x, y, size, size);
            if (p.type === 'cross') {
                ctx.globalAlpha = alpha * 0.55;
                ctx.fillRect(x - size * 2, y, size, size);
                ctx.fillRect(x + size * 2, y, size, size);
                ctx.fillRect(x, y - size * 2, size, size);
                ctx.fillRect(x, y + size * 2, size, size);
            }
        });
        ctx.globalAlpha = 1;

        meteors.forEach((m) => {
            const alpha = Math.max(0, Math.min(1, m.life / m.maxLife));
            const trail = 96;
            const gradient = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 0.18, m.y - m.vy * 0.18);
            gradient.addColorStop(0, `rgba(230, 252, 255, ${0.82 * alpha})`);
            gradient.addColorStop(1, 'rgba(230, 252, 255, 0)');
            ctx.strokeStyle = gradient;
            ctx.lineWidth = m.size;
            ctx.beginPath();
            ctx.moveTo(m.x, m.y);
            ctx.lineTo(m.x - trail, m.y + trail * 0.64);
            ctx.stroke();
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.fillRect(m.x - 1, m.y - 1, m.size * 2, m.size * 2);
        });
    }

    function seedBubbles(anywhere = true) {
        const count = targetCount('bubbles');
        for (let i = 0; i < count; i += 1) {
            particles.push(createBubble(anywhere));
        }
    }

    function createBubble(anywhere = false) {
        const depth = Math.random();
        const radius = randomBetween(18, 66) + depth * 34;
        const fromSide = Math.random() > 0.68;
        return {
            kind: 'bubble',
            x: anywhere ? randomBetween(radius, width - radius) : (fromSide ? (Math.random() > 0.5 ? -radius : width + radius) : randomBetween(width * 0.22, width * 0.78)),
            y: anywhere ? randomBetween(radius, height - radius) : randomBetween(height * 0.62, height + radius * 2),
            r: radius,
            vx: randomBetween(-18, 18) + (fromSide ? (Math.random() > 0.5 ? 34 : -34) : 0),
            vy: -randomBetween(12, 48) - depth * 34,
            depth,
            hue: randomBetween(176, 225),
            phase: Math.random() * Math.PI * 2,
            wobble: randomBetween(0.5, 1.6)
        };
    }

    function resetBubble(p) {
        Object.assign(p, createBubble(false));
    }

    function updateBubbles(dt) {
        syncParticleCount('bubbles');
        const speed = speedScale[state.speed] || speedScale.standard;
        particles.forEach((p) => {
            p.phase += dt * p.wobble;
            p.x += (p.vx + Math.sin(p.phase) * 13) * speed * dt;
            p.y += p.vy * speed * dt;

            if (p.x < p.r) {
                p.x = p.r;
                p.vx = Math.abs(p.vx) * 0.82;
            }
            if (p.x > width - p.r) {
                p.x = width - p.r;
                p.vx = -Math.abs(p.vx) * 0.82;
            }
            if (p.y < -p.r * 2) resetBubble(p);
        });
    }

    function drawBubbles() {
        const wash = ctx.createLinearGradient(0, height, width, 0);
        wash.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
        wash.addColorStop(0.5, 'rgba(183, 231, 255, 0.08)');
        wash.addColorStop(1, 'rgba(255, 210, 239, 0.05)');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, width, height);

        particles
            .slice()
            .sort((a, b) => a.depth - b.depth)
            .forEach(drawBubble);
    }

    function drawBubble(p) {
        const alpha = 0.24 + p.depth * 0.22;
        const ring = ctx.createRadialGradient(
            p.x - p.r * 0.34,
            p.y - p.r * 0.42,
            p.r * 0.08,
            p.x,
            p.y,
            p.r
        );
        ring.addColorStop(0, `hsla(${p.hue + 36}, 100%, 94%, ${alpha * 1.6})`);
        ring.addColorStop(0.28, `hsla(${p.hue}, 100%, 88%, ${alpha * 0.42})`);
        ring.addColorStop(0.68, `hsla(${p.hue + 72}, 100%, 74%, ${alpha * 0.22})`);
        ring.addColorStop(0.9, `hsla(${p.hue - 28}, 100%, 86%, ${alpha * 0.72})`);
        ring.addColorStop(1, `rgba(255, 255, 255, ${alpha * 0.92})`);

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = ring;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `hsla(${p.hue + 18}, 100%, 86%, ${alpha * 1.6})`;
        ctx.lineWidth = Math.max(1, p.r * 0.045);
        ctx.stroke();

        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 1.8})`;
        ctx.beginPath();
        ctx.ellipse(p.x - p.r * 0.34, p.y - p.r * 0.38, p.r * 0.22, p.r * 0.1, -0.72, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = `rgba(255, 178, 232, ${alpha * 0.92})`;
        ctx.lineWidth = Math.max(1, p.r * 0.018);
        ctx.beginPath();
        ctx.arc(p.x + p.r * 0.08, p.y + p.r * 0.08, p.r * 0.74, Math.PI * 0.15, Math.PI * 0.72);
        ctx.stroke();
        ctx.restore();
    }

    function syncParticleCount(mode) {
        const target = targetCount(mode);
        if (particles.length < target) {
            const addCount = Math.min(4, target - particles.length);
            for (let i = 0; i < addCount; i += 1) {
                if (mode === 'sakura') particles.push(createSakura(false));
                if (mode === 'stars') particles.push(createStar());
                if (mode === 'bubbles') particles.push(createBubble(false));
            }
        } else if (particles.length > target) {
            particles.splice(target);
        }
    }

    function clearCanvas() {
        if (!ctx) return;
        ctx.clearRect(0, 0, width, height);
    }

    function tick(now) {
        if (paused || hiddenPaused || state.mode === 'off') {
            rafId = null;
            return;
        }

        const dt = Math.min(0.04, Math.max(0.001, (now - (lastTime || now)) / 1000));
        lastTime = now;

        if (lastMode !== state.mode) reseedCurrentMode();
        clearCanvas();

        if (state.mode === 'sakura') {
            updateSakura(dt, now);
            drawSakura(now);
        } else if (state.mode === 'stars') {
            updateStars(dt, now);
            drawStars();
        } else if (state.mode === 'bubbles') {
            updateBubbles(dt);
            drawBubbles();
        }

        rafId = requestAnimationFrame(tick);
    }

    function startLoop() {
        if (rafId || paused || hiddenPaused || state.mode === 'off') return;
        lastTime = performance.now();
        rafId = requestAnimationFrame(tick);
    }

    function stopLoop() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
    }

    function applyState(options = {}) {
        ensureCanvas();
        applyBodyMode();
        resizeCanvas();
        if (options.reseed !== false) reseedCurrentMode();
        saveState();
        syncSettingsControls();
        if (state.mode === 'off') {
            stopLoop();
            clearCanvas();
        } else {
            startLoop();
        }
    }

    function setMode(mode) {
        const allowed = ['off', 'sakura', 'stars', 'bubbles'];
        state.mode = allowed.includes(mode) ? mode : 'off';
        applyState();
    }

    function setPreset(preset = {}) {
        state = {
            ...state,
            ...Object.fromEntries(Object.entries(preset).filter(([, value]) => value !== undefined))
        };
        applyState();
    }

    function syncSettingsControls() {
        const win = document.getElementById(settingsWindowId);
        if (!win) return;
        const setValue = (id, value) => {
            const el = win.querySelector(`#${id}`);
            if (!el) return;
            if (el.type === 'checkbox') el.checked = !!value;
            else el.value = value;
        };
        setValue('effects-mode', state.mode);
        setValue('effects-intensity', state.intensity);
        setValue('effects-speed', state.speed);
        setValue('effects-opacity', state.opacity);
        setValue('effects-quality', state.quality);
        setValue('effects-idle-boost', state.idleBoost);
    }

    function openSettings() {
        if (typeof createWindow !== 'function') return;

        const existing = document.getElementById(settingsWindowId);
        if (existing) {
            openWindow(settingsWindowId);
            syncSettingsControls();
            return;
        }

        createWindow({
            id: settingsWindowId,
            title: '桌面特效',
            icon: 'assets/icon/settings_gear-4.png',
            width: 430,
            content: `
                <div class="effects-settings">
                    <fieldset>
                        <legend>视觉模式</legend>
                        <div class="field-row">
                            <label for="effects-mode">模式</label>
                            <select id="effects-mode">
                                <option value="off">关闭</option>
                                <option value="sakura">像素樱花</option>
                                <option value="stars">闪烁星空</option>
                                <option value="bubbles">Windows 泡泡</option>
                            </select>
                        </div>
                        <div class="field-row">
                            <label for="effects-intensity">强度</label>
                            <select id="effects-intensity">
                                <option value="light">轻</option>
                                <option value="standard">标准</option>
                                <option value="lush">华丽</option>
                            </select>
                        </div>
                        <div class="field-row">
                            <label for="effects-speed">速度</label>
                            <select id="effects-speed">
                                <option value="slow">慢</option>
                                <option value="standard">标准</option>
                                <option value="fast">快</option>
                            </select>
                        </div>
                        <div class="field-row">
                            <label for="effects-opacity">透明度</label>
                            <select id="effects-opacity">
                                <option value="low">低</option>
                                <option value="standard">标准</option>
                                <option value="high">高</option>
                            </select>
                        </div>
                        <div class="field-row">
                            <label for="effects-quality">画质</label>
                            <select id="effects-quality">
                                <option value="balanced">均衡</option>
                                <option value="high">高</option>
                                <option value="ultra">极致</option>
                            </select>
                        </div>
                        <div class="field-row">
                            <label for="effects-idle-boost">空闲增强</label>
                            <span><input id="effects-idle-boost" type="checkbox"> 屏保感泡泡密度</span>
                        </div>
                        <div class="effects-settings-preview" aria-hidden="true"></div>
                    </fieldset>
                    <div class="message-box-buttons">
                        <button id="effects-defaults" type="button">默认</button>
                        <button id="effects-close" type="button">确定</button>
                    </div>
                    <div class="status-bar" style="margin-top: 10px;">
                        <p class="status-bar-field">Canvas 2D / High DPI</p>
                        <p class="status-bar-field">不拦截鼠标</p>
                    </div>
                </div>
            `
        });

        setTimeout(() => {
            const win = document.getElementById(settingsWindowId);
            if (!win) return;
            syncSettingsControls();

            const readControls = () => ({
                mode: win.querySelector('#effects-mode')?.value || state.mode,
                intensity: win.querySelector('#effects-intensity')?.value || state.intensity,
                speed: win.querySelector('#effects-speed')?.value || state.speed,
                opacity: win.querySelector('#effects-opacity')?.value || state.opacity,
                quality: win.querySelector('#effects-quality')?.value || state.quality,
                idleBoost: !!win.querySelector('#effects-idle-boost')?.checked
            });

            win.querySelectorAll('select, input').forEach((control) => {
                control.addEventListener('change', () => setPreset(readControls()));
            });

            win.querySelector('#effects-defaults')?.addEventListener('click', () => {
                state = { ...defaults, mode: reduceMotion ? 'off' : 'sakura' };
                applyState();
            });

            win.querySelector('#effects-close')?.addEventListener('click', () => {
                closeWindow(settingsWindowId);
            });
        }, 30);
    }

    function pause() {
        paused = true;
        stopLoop();
    }

    function resume() {
        paused = false;
        startLoop();
    }

    const api = {
        setMode,
        setPreset,
        openSettings,
        pause,
        resume,
        getState: () => ({ ...state })
    };

    window.desktopEffects = api;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyState({ reseed: true }));
    } else {
        applyState({ reseed: true });
    }
})();
