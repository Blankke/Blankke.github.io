// 桌面动态环境：风中樱落、深夜星图与经典泡泡屏保
// 用法：在 window-manager.js 之后引入本文件；也可通过
// window.desktopEffects.setMode('sakura' | 'stars' | 'bubbles' | 'off') 切换模式。

(function() {
    const STORAGE_KEY = window.BLANKKE_STATE_KEYS?.effects || 'blankke_effects_v2';
    const LEGACY_STORAGE_KEYS = ['blankke_effects_v1'];
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
    const settingsWindowId = 'window-effects-settings';
    const visualThemes = ['classic', 'arcade'];
    const defaults = {
        theme: 'classic',
        mode: 'sakura',
        intensity: reduceMotion ? 'light' : 'standard',
        speed: reduceMotion ? 'slow' : 'standard',
        opacity: 'standard',
        quality: reduceMotion ? 'balanced' : 'high',
        idleBoost: !reduceMotion
    };

    const intensityScale = { light: 0.62, standard: 1, lush: 1.55 };
    const speedScale = { slow: 0.7, standard: 1, fast: 1.32 };
    const opacityScale = { low: 0.48, standard: 0.76, high: 0.96 };
    const qualityDpr = { balanced: 1.15, high: 1.6, ultra: 2 };
    const modeCounts = { sakura: 52, stars: 128, bubbles: 18 };
    const modeLimits = { sakura: 110, stars: 260, bubbles: 38 };

    let state = loadState();
    let canvas = null;
    let context = null;
    let atmosphere = null;
    let frameId = null;
    let width = 1;
    let height = 1;
    let dpr = 1;
    let lastFrameAt = 0;
    let lastInputAt = performance.now();
    let paused = false;
    let hiddenPaused = false;
    let particles = [];
    let transients = [];
    let currentMode = '';
    const pointer = { x: -1000, y: -1000, dx: 0, dy: 0, activeUntil: 0 };

    function loadState() {
        const normalizeState = (value) => ({
            ...defaults,
            ...(value && typeof value === 'object' ? value : {})
        });

        const migrateModeToSakura = (value) => {
            const next = normalizeState(value);
            next.mode = 'sakura';
            return next;
        };

        try {
            const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
            if (parsed && typeof parsed === 'object') {
                return normalizeState(parsed);
            }
        } catch {
            // 当前版本读取失败时，继续尝试迁移旧缓存。
        }

        for (const legacyKey of LEGACY_STORAGE_KEYS) {
            try {
                const raw = localStorage.getItem(legacyKey);
                if (!raw) continue;
                const parsed = JSON.parse(raw);
                if (!parsed || typeof parsed !== 'object') continue;
                const migrated = migrateModeToSakura(parsed);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                localStorage.removeItem(legacyKey);
                return migrated;
            } catch {
                // 旧缓存损坏时直接回到默认值，不让这块把页面拖死。
            }
        }

        return { ...defaults };
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function random(min, max) {
        return min + Math.random() * (max - min);
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function normalizeTheme(theme) {
        return visualThemes.includes(theme) ? theme : defaults.theme;
    }

    function areaScale() {
        const scale = Math.sqrt((width * height) / (1440 * 900));
        return clamp(scale * (width < 720 ? 0.72 : 1), 0.48, 1.35);
    }

    function activeIntensity() {
        let value = intensityScale[state.intensity] || 1;
        if (state.mode === 'bubbles' && state.idleBoost && performance.now() - lastInputAt > 12000) {
            value *= 1.35;
        }
        return value;
    }

    function targetCount(mode = state.mode) {
        const target = Math.round((modeCounts[mode] || 0) * areaScale() * activeIntensity());
        return Math.min(modeLimits[mode] || 0, Math.max(0, target));
    }

    function ensureSurface() {
        if (canvas) return;

        atmosphere = document.createElement('div');
        atmosphere.className = 'desktop-effects-vignette';
        atmosphere.setAttribute('aria-hidden', 'true');
        document.body.appendChild(atmosphere);

        canvas = document.createElement('canvas');
        canvas.className = 'desktop-effects-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        context = canvas.getContext('2d', { alpha: true, desynchronized: true });

        resizeSurface();
        bindEvents();
    }

    function resizeSurface() {
        if (!canvas || !context) return;
        width = Math.max(1, window.innerWidth);
        height = Math.max(1, window.innerHeight);
        dpr = clamp(Math.min(window.devicePixelRatio || 1, qualityDpr[state.quality] || 1.6), 1, 2);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        context.setTransform(dpr, 0, 0, dpr, 0, 0);
        context.imageSmoothingEnabled = true;
    }

    function bindEvents() {
        window.addEventListener('resize', () => {
            resizeSurface();
            seedMode(true);
        }, { passive: true });

        document.addEventListener('visibilitychange', () => {
            hiddenPaused = document.hidden;
            if (!hiddenPaused) {
                lastFrameAt = performance.now();
                startLoop();
            }
        });

        window.addEventListener('pointermove', (event) => {
            pointer.dx = event.clientX - pointer.x;
            pointer.dy = event.clientY - pointer.y;
            pointer.x = event.clientX;
            pointer.y = event.clientY;
            pointer.activeUntil = performance.now() + 180;
            lastInputAt = performance.now();
        }, { passive: true });

        ['pointerdown', 'keydown', 'touchstart', 'wheel'].forEach((eventName) => {
            window.addEventListener(eventName, () => {
                lastInputAt = performance.now();
            }, { passive: true });
        });

        document.getElementById('ctx-effects')?.addEventListener('click', () => {
            api.openSettings();
            const menu = document.getElementById('context-menu');
            if (menu) menu.style.display = 'none';
        });
    }

    function applyBodyMode() {
        state.theme = normalizeTheme(state.theme);
        document.documentElement.dataset.visualTheme = state.theme;
        document.body.dataset.visualTheme = state.theme;
        document.body.classList.toggle('effects-active', state.mode !== 'off');
        document.body.classList.toggle('effects-night', state.mode === 'stars');
        document.body.dataset.effect = state.mode;
        if (canvas) {
            canvas.hidden = state.mode === 'off';
            canvas.style.opacity = String(opacityScale[state.opacity] || opacityScale.standard);
        }
    }

    function createSakura(anywhere = false) {
        const depth = Math.random();
        const fromLeft = !anywhere && Math.random() < 0.18;
        const size = random(3.2, 6.5) + depth * 3.6;
        return {
            kind: 'sakura',
            x: anywhere ? random(-30, width + 30) : (fromLeft ? random(-70, -12) : random(-40, width * 0.96)),
            y: anywhere ? random(-50, height + 20) : (fromLeft ? random(-40, height * 0.3) : random(-110, -12)),
            depth,
            size,
            vx: random(-5, 9),
            vy: random(16, 30) + depth * 26,
            phase: random(0, Math.PI * 2),
            sway: random(10, 24) + depth * 12,
            rotation: random(0, Math.PI * 2),
            spin: random(-1.25, 1.25),
            flip: random(0, Math.PI * 2),
            flipSpeed: random(1.2, 2.8),
            tint: Math.floor(random(0, 5))
        };
    }

    function windAt(particle, now) {
        const slowBreeze = 13 + Math.sin(now * 0.00022) * 5;
        const localBreeze = Math.sin(particle.y * 0.012 + now * 0.00075) * 4;
        const gustWave = Math.max(0, Math.sin(now * 0.00017 - 1.2));
        const gust = Math.pow(gustWave, 7) * 34;
        return slowBreeze + localBreeze + gust;
    }

    function updateSakura(dt, now) {
        syncCount('sakura');
        const speed = speedScale[state.speed] || 1;
        const pointerLive = now < pointer.activeUntil;

        particles.forEach((petal) => {
            petal.phase += dt * (0.7 + petal.depth * 0.9);
            petal.flip += dt * petal.flipSpeed;
            petal.rotation += dt * petal.spin;

            if (pointerLive) {
                const dx = petal.x - pointer.x;
                const dy = petal.y - pointer.y;
                const distance = Math.hypot(dx, dy);
                if (distance < 105) {
                    const influence = (1 - distance / 105) * (0.4 + petal.depth * 0.6);
                    petal.vx += pointer.dx * influence * 0.12;
                    petal.vy += pointer.dy * influence * 0.055;
                }
            }

            const lateral = Math.sin(petal.phase) * petal.sway;
            petal.x += (windAt(petal, now) * (0.52 + petal.depth * 0.68) + petal.vx + lateral * 0.16) * dt * speed;
            petal.y += (petal.vy + Math.cos(petal.phase * 1.35) * 6) * dt * speed;
            petal.vx *= Math.pow(0.22, dt);
            petal.vy = petal.vy * Math.pow(0.8, dt) + (18 + petal.depth * 28) * (1 - Math.pow(0.8, dt));

            if (petal.x > width + 80 || petal.y > height + 70) {
                Object.assign(petal, createSakura(false));
            }
        });
    }

    function drawSakuraPetal(petal) {
        const colors = ['#ffd8e8', '#f8b9d2', '#fff0f5', '#ef9fc1', '#ffe5ed'];
        const edgeColors = ['#df7da8', '#db8baa', '#e79aba', '#cc6f9c', '#e2a1b3'];
        const flipScale = 0.18 + Math.abs(Math.cos(petal.flip)) * 0.82;
        const size = petal.size;

        context.save();
        context.translate(petal.x, petal.y);
        context.rotate(petal.rotation);
        context.scale(1, flipScale);
        context.globalAlpha = 0.38 + petal.depth * 0.54;

        context.beginPath();
        context.moveTo(0, size * 0.92);
        context.bezierCurveTo(-size * 0.72, size * 0.38, -size * 0.78, -size * 0.5, -size * 0.15, -size);
        context.quadraticCurveTo(0, -size * 0.7, size * 0.15, -size);
        context.bezierCurveTo(size * 0.78, -size * 0.5, size * 0.72, size * 0.38, 0, size * 0.92);
        context.closePath();
        context.fillStyle = colors[petal.tint];
        context.fill();

        context.lineWidth = Math.max(0.45, size * 0.085);
        context.strokeStyle = edgeColors[petal.tint];
        context.stroke();

        context.globalAlpha *= 0.58;
        context.beginPath();
        context.moveTo(0, size * 0.72);
        context.quadraticCurveTo(-size * 0.08, 0, -size * 0.04, -size * 0.66);
        context.strokeStyle = '#c86f99';
        context.lineWidth = Math.max(0.4, size * 0.055);
        context.stroke();
        context.restore();
    }

    function drawSakura() {
        particles
            .slice()
            .sort((a, b) => a.depth - b.depth)
            .forEach(drawSakuraPetal);
    }

    function createStar() {
        const depth = Math.random();
        const bright = Math.random() > 0.82;
        return {
            kind: 'star',
            x: random(0, width),
            y: random(0, height),
            depth,
            radius: bright ? random(1.1, 1.9) : random(0.45, 1.15),
            phase: random(0, Math.PI * 2),
            pulse: random(0.7, 2.2),
            drift: random(0.3, 2.3),
            bright,
            warm: Math.random() > 0.78
        };
    }

    function createMeteor() {
        const speed = random(420, 610);
        const angle = random(0.22, 0.34);
        return {
            x: random(width * 0.56, width + 50),
            y: random(20, height * 0.27),
            vx: -Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: random(0.62, 0.9),
            maxLife: 0.9,
            length: random(70, 115)
        };
    }

    function updateStars(dt, now) {
        syncCount('stars');
        const speed = speedScale[state.speed] || 1;
        particles.forEach((star) => {
            star.phase += dt * star.pulse * speed;
            star.x += star.drift * dt * speed;
            if (star.x > width + 4) star.x = -4;
        });

        if (transients.length < 2 && Math.random() < dt * 0.045 * activeIntensity()) {
            transients.push(createMeteor());
        }
        transients = transients.filter((meteor) => {
            meteor.life -= dt;
            meteor.x += meteor.vx * dt * speed;
            meteor.y += meteor.vy * dt * speed;
            return meteor.life > 0;
        });
    }

    function drawStars() {
        const wash = context.createLinearGradient(0, 0, 0, height);
        wash.addColorStop(0, 'rgba(2, 8, 22, .5)');
        wash.addColorStop(0.62, 'rgba(3, 21, 32, .28)');
        wash.addColorStop(1, 'rgba(0, 35, 38, .12)');
        context.fillStyle = wash;
        context.fillRect(0, 0, width, height);

        particles.forEach((star) => {
            const pulse = 0.28 + Math.pow((Math.sin(star.phase) + 1) / 2, 2.4) * 0.72;
            const alpha = pulse * (0.52 + star.depth * 0.42);
            const radius = star.radius + star.depth * 0.75;
            context.globalAlpha = alpha;
            context.fillStyle = star.warm ? '#ffe7b0' : '#e7f7ff';
            context.fillRect(Math.round(star.x), Math.round(star.y), Math.max(1, Math.round(radius)), Math.max(1, Math.round(radius)));

            if (star.bright && pulse > 0.68) {
                context.globalAlpha = (pulse - 0.58) * 0.6;
                context.fillRect(Math.round(star.x - radius * 3), Math.round(star.y), Math.round(radius * 7), 1);
                context.fillRect(Math.round(star.x), Math.round(star.y - radius * 3), 1, Math.round(radius * 7));
            }
        });

        transients.forEach((meteor) => {
            const magnitude = Math.hypot(meteor.vx, meteor.vy) || 1;
            const tailX = -meteor.vx / magnitude;
            const tailY = -meteor.vy / magnitude;
            const gradient = context.createLinearGradient(
                meteor.x,
                meteor.y,
                meteor.x + tailX * meteor.length,
                meteor.y + tailY * meteor.length
            );
            const alpha = clamp(meteor.life / meteor.maxLife, 0, 1);
            gradient.addColorStop(0, `rgba(255,255,255,${alpha})`);
            gradient.addColorStop(0.18, `rgba(172,226,255,${alpha * 0.72})`);
            gradient.addColorStop(1, 'rgba(94,190,255,0)');
            context.strokeStyle = gradient;
            context.lineWidth = 1.5;
            context.beginPath();
            context.moveTo(meteor.x, meteor.y);
            context.lineTo(meteor.x + tailX * meteor.length, meteor.y + tailY * meteor.length);
            context.stroke();
        });
        context.globalAlpha = 1;
    }

    function createBubble(anywhere = false) {
        const depth = Math.random();
        const radius = random(14, 38) + depth * 34;
        return {
            kind: 'bubble',
            x: random(radius, Math.max(radius, width - radius)),
            y: anywhere ? random(radius, Math.max(radius, height - radius - 36)) : height + radius + random(0, 120),
            radius,
            depth,
            vx: random(-7, 7),
            vy: -(random(12, 25) + depth * 18),
            phase: random(0, Math.PI * 2),
            wobble: random(0.55, 1.25),
            hue: random(178, 226),
            delay: anywhere ? random(-2, 0) : random(0, 5),
            mass: radius * radius
        };
    }

    function constrainBubbleSpeed(bubble) {
        const max = 78 + bubble.depth * 42;
        const magnitude = Math.hypot(bubble.vx, bubble.vy);
        if (magnitude <= max) return;
        bubble.vx = bubble.vx / magnitude * max;
        bubble.vy = bubble.vy / magnitude * max;
    }

    function collideBubbles() {
        for (let i = 0; i < particles.length; i += 1) {
            const a = particles[i];
            if (a.delay > 0) continue;
            for (let j = i + 1; j < particles.length; j += 1) {
                const b = particles[j];
                if (b.delay > 0) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const minimum = a.radius + b.radius;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared <= 0 || distanceSquared >= minimum * minimum) continue;

                const distance = Math.sqrt(distanceSquared);
                const nx = dx / distance;
                const ny = dy / distance;
                const overlap = minimum - distance;
                const inverseA = 1 / a.mass;
                const inverseB = 1 / b.mass;
                const inverseSum = inverseA + inverseB;

                a.x -= nx * overlap * inverseA / inverseSum;
                a.y -= ny * overlap * inverseA / inverseSum;
                b.x += nx * overlap * inverseB / inverseSum;
                b.y += ny * overlap * inverseB / inverseSum;

                const relativeX = b.vx - a.vx;
                const relativeY = b.vy - a.vy;
                const velocity = relativeX * nx + relativeY * ny;
                if (velocity > 0) continue;
                const impulse = -(1 + 0.88) * velocity / inverseSum;
                a.vx -= impulse * nx * inverseA;
                a.vy -= impulse * ny * inverseA;
                b.vx += impulse * nx * inverseB;
                b.vy += impulse * ny * inverseB;
            }
        }
    }

    function updateBubbles(dt, now) {
        syncCount('bubbles');
        const speed = speedScale[state.speed] || 1;
        const pointerLive = now < pointer.activeUntil;

        particles.forEach((bubble) => {
            bubble.delay -= dt;
            if (bubble.delay > 0) return;
            bubble.phase += dt * bubble.wobble;
            bubble.vx += Math.sin(bubble.phase) * dt * 3.6;
            bubble.x += bubble.vx * dt * speed;
            bubble.y += bubble.vy * dt * speed;

            if (pointerLive) {
                const dx = bubble.x - pointer.x;
                const dy = bubble.y - pointer.y;
                const distance = Math.hypot(dx, dy) || 1;
                const range = bubble.radius + 64;
                if (distance < range) {
                    const force = (1 - distance / range) * 22;
                    bubble.vx += dx / distance * force;
                    bubble.vy += dy / distance * force;
                }
            }

            if (bubble.x < bubble.radius) {
                bubble.x = bubble.radius;
                bubble.vx = Math.abs(bubble.vx) * 0.84;
            } else if (bubble.x > width - bubble.radius) {
                bubble.x = width - bubble.radius;
                bubble.vx = -Math.abs(bubble.vx) * 0.84;
            }

            if (bubble.y < -bubble.radius * 1.5) {
                Object.assign(bubble, createBubble(false));
            }
            constrainBubbleSpeed(bubble);
        });
        collideBubbles();
    }

    function drawBubble(bubble) {
        if (bubble.delay > 0) return;
        const alpha = 0.18 + bubble.depth * 0.26;
        const gradient = context.createRadialGradient(
            bubble.x - bubble.radius * 0.35,
            bubble.y - bubble.radius * 0.42,
            bubble.radius * 0.06,
            bubble.x,
            bubble.y,
            bubble.radius
        );
        gradient.addColorStop(0, `hsla(${bubble.hue + 36},100%,96%,${alpha * 1.7})`);
        gradient.addColorStop(0.22, `hsla(${bubble.hue},100%,86%,${alpha * 0.18})`);
        gradient.addColorStop(0.74, `hsla(${bubble.hue + 80},100%,74%,${alpha * 0.12})`);
        gradient.addColorStop(0.94, `hsla(${bubble.hue - 32},100%,84%,${alpha * 0.74})`);
        gradient.addColorStop(1, `rgba(255,255,255,${alpha})`);

        context.save();
        context.globalCompositeOperation = 'screen';
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
        context.fill();
        context.strokeStyle = `hsla(${bubble.hue + 15},100%,90%,${alpha * 1.8})`;
        context.lineWidth = Math.max(0.8, bubble.radius * 0.025);
        context.stroke();

        context.fillStyle = `rgba(255,255,255,${alpha * 1.9})`;
        context.beginPath();
        context.ellipse(
            bubble.x - bubble.radius * 0.33,
            bubble.y - bubble.radius * 0.39,
            bubble.radius * 0.19,
            bubble.radius * 0.065,
            -0.65,
            0,
            Math.PI * 2
        );
        context.fill();
        context.restore();
    }

    function drawBubbles() {
        particles
            .slice()
            .sort((a, b) => a.depth - b.depth)
            .forEach(drawBubble);
    }

    function seedMode(anywhere = true) {
        particles = [];
        transients = [];
        currentMode = state.mode;
        const count = targetCount();
        for (let index = 0; index < count; index += 1) {
            if (state.mode === 'sakura') particles.push(createSakura(anywhere));
            if (state.mode === 'stars') particles.push(createStar());
            if (state.mode === 'bubbles') particles.push(createBubble(anywhere));
        }
    }

    function syncCount(mode) {
        const target = targetCount(mode);
        while (particles.length < target) {
            if (mode === 'sakura') particles.push(createSakura(false));
            if (mode === 'stars') particles.push(createStar());
            if (mode === 'bubbles') particles.push(createBubble(false));
        }
        if (particles.length > target) particles.length = target;
    }

    function clearSurface() {
        context?.clearRect(0, 0, width, height);
    }

    function tick(now) {
        if (paused || hiddenPaused || state.mode === 'off') {
            frameId = null;
            return;
        }

        const dt = clamp((now - (lastFrameAt || now)) / 1000, 0.001, 0.035);
        lastFrameAt = now;
        if (currentMode !== state.mode) seedMode(true);
        clearSurface();

        if (state.mode === 'sakura') {
            updateSakura(dt, now);
            drawSakura();
        } else if (state.mode === 'stars') {
            updateStars(dt, now);
            drawStars();
        } else if (state.mode === 'bubbles') {
            updateBubbles(dt, now);
            drawBubbles();
        }

        pointer.dx *= 0.72;
        pointer.dy *= 0.72;
        frameId = requestAnimationFrame(tick);
    }

    function startLoop() {
        if (frameId || paused || hiddenPaused || state.mode === 'off') return;
        lastFrameAt = performance.now();
        frameId = requestAnimationFrame(tick);
    }

    function stopLoop() {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = null;
    }

    function applyState(options = {}) {
        ensureSurface();
        applyBodyMode();
        resizeSurface();
        if (options.reseed !== false) seedMode(true);
        saveState();
        syncSettingsControls();

        if (state.mode === 'off') {
            stopLoop();
            clearSurface();
        } else {
            startLoop();
        }
    }

    function setMode(mode) {
        state.mode = ['off', 'sakura', 'stars', 'bubbles'].includes(mode) ? mode : 'off';
        applyState();
    }

    function setTheme(theme) {
        state.theme = normalizeTheme(theme);
        applyState({ reseed: false });
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
        const assign = (id, value) => {
            const control = win.querySelector(`#${id}`);
            if (!control) return;
            if (control.type === 'checkbox') control.checked = !!value;
            else control.value = value;
        };
        assign('effects-theme', normalizeTheme(state.theme));
        assign('effects-mode', state.mode);
        assign('effects-intensity', state.intensity);
        assign('effects-speed', state.speed);
        assign('effects-opacity', state.opacity);
        assign('effects-quality', state.quality);
        assign('effects-idle-boost', state.idleBoost);
        const preview = win.querySelector('[data-effect-preview]');
        if (preview) preview.dataset.mode = state.mode;
    }

    function openSettings() {
        if (typeof window.createWindow !== 'function') return;
        const existing = document.getElementById(settingsWindowId);
        if (existing) {
            openWindow(settingsWindowId);
            syncSettingsControls();
            return;
        }

        window.createWindow({
            id: settingsWindowId,
            title: '桌面动态环境',
            icon: 'assets/icon/settings_gear-4.png',
            width: 440,
            content: `
                <div class="effects-settings">
                    <fieldset>
                        <legend>屏幕保护与环境效果</legend>
                        <div class="effects-settings-preview" data-effect-preview aria-hidden="true"><i></i><i></i><i></i></div>
                        <div class="field-row"><label for="effects-theme">界面风格</label><select id="effects-theme">
                            <option value="classic">经典默认</option>
                            <option value="arcade">霓虹电玩</option>
                        </select></div>
                        <div class="field-row"><label for="effects-mode">模式</label><select id="effects-mode">
                            <option value="off">关闭</option>
                            <option value="sakura">风中樱落</option>
                            <option value="stars">深夜星图</option>
                            <option value="bubbles">经典泡泡屏保</option>
                        </select></div>
                        <div class="field-row"><label for="effects-intensity">密度</label><select id="effects-intensity">
                            <option value="light">克制</option><option value="standard">标准</option><option value="lush">繁盛</option>
                        </select></div>
                        <div class="field-row"><label for="effects-speed">时间</label><select id="effects-speed">
                            <option value="slow">慢速</option><option value="standard">自然</option><option value="fast">快速</option>
                        </select></div>
                        <div class="field-row"><label for="effects-opacity">存在感</label><select id="effects-opacity">
                            <option value="low">轻微</option><option value="standard">标准</option><option value="high">清晰</option>
                        </select></div>
                        <div class="field-row"><label for="effects-quality">渲染</label><select id="effects-quality">
                            <option value="balanced">均衡</option><option value="high">高分屏</option><option value="ultra">精细</option>
                        </select></div>
                        <div class="field-row"><label for="effects-idle-boost">屏保行为</label><span><input id="effects-idle-boost" type="checkbox"> 空闲时增加泡泡</span></div>
                    </fieldset>
                    <div class="message-box-buttons">
                        <button id="effects-defaults" type="button">恢复默认</button>
                        <button id="effects-close" type="button">确定</button>
                    </div>
                    <div class="status-bar"><p class="status-bar-field">Canvas 2D / Pointer wind field</p></div>
                </div>
            `
        });

        window.setTimeout(() => {
            const win = document.getElementById(settingsWindowId);
            if (!win) return;
            syncSettingsControls();
            const readControls = () => ({
                theme: win.querySelector('#effects-theme')?.value || state.theme,
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
                state = { ...defaults, mode: 'sakura' };
                applyState();
            });
            win.querySelector('#effects-close')?.addEventListener('click', () => closeWindow(settingsWindowId));
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
        setTheme,
        setPreset,
        openSettings,
        pause,
        resume,
        getState: () => ({ ...state })
    };
    window.desktopEffects = api;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => applyState({ reseed: true }), { once: true });
    } else {
        applyState({ reseed: true });
    }
})();
