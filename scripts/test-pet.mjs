// 夜游桌宠轻量验收测试。
// 使用示例：node scripts/test-pet.mjs
// 该脚本不启动浏览器，只验证 manifest、逐帧时长、图集回退资源和关键运行时算法。

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root = resolve(new URL('..', import.meta.url).pathname);
const manifestPath = resolve(root, 'assets/pet/qq/night-cat-qq-manifest.json');
const petPath = resolve(root, 'pet.js');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const petSource = await readFile(petPath, 'utf8');

function check(condition, message) {
    assert.ok(condition, message);
    console.log(`  ✓ ${message}`);
}

async function fileExists(pathname) {
    try {
        await access(pathname);
        return true;
    } catch {
        return false;
    }
}

function readFrameBounds(sheetPath, row) {
    const output = execFileSync('convert', [
        sheetPath,
        '-crop', '256x256',
        '+repage',
        '-alpha', 'extract',
        '-threshold', '1%',
        '-trim',
        '-format', '%w %h %X %Y\\n',
        'info:'
    ], { encoding: 'utf8' });
    return output.trim().split(/\r?\n/).slice(row * 12, row * 12 + 12).map((line) => {
        const [width, height, x, y] = line.trim().split(/\s+/);
        return {
            centerX: Number.parseInt(x, 10) + Number(width) / 2,
            bottom: Number.parseInt(y, 10) + Number(height)
        };
    });
}

function range(values) {
    return Math.max(...values) - Math.min(...values);
}

const expectedActions = [
    'idle', 'run-right', 'run-left', 'wave', 'jump', 'sleep-in-hat',
    'chess', 'write-poem', 'read-book', 'listen-radio', 'moon-dandelion',
    'cane-shunpo', 'raijin', 'raiju-chibi'
];

console.log('[1/4] manifest 与资源');
check(manifest.pet.cell.width === 256 && manifest.pet.cell.height === 256, 'Canvas 单帧逻辑尺寸为 256×256');
check(manifest.pet.renderer === 'canvas-requestAnimationFrame', 'manifest 声明 Canvas + requestAnimationFrame 播放');
check(expectedActions.every((name) => manifest.actions[name]), '14 个动作全部存在');
check(!manifest.actions['tower-defense'], '旧塔防动作已从 manifest 移除');
check(manifest.menuGroups.flatMap((group) => group.actions).length === 11, '动作菜单包含 11 个可选动作');

for (const name of expectedActions) {
    const action = manifest.actions[name];
    check(action.frames === 12 && action.durationsMs.length === 12, `${name} 使用 0–11 共 12 帧及逐帧时长`);
}

for (const filename of [
    'night-cat-qq-core.webp', 'night-cat-qq-core.png',
    'night-cat-qq-actions.webp', 'night-cat-qq-actions.png',
    'night-cat-qq-manifest.json'
]) {
    check(await fileExists(resolve(root, 'assets/pet/qq', filename)), `${filename} 已部署`);
}

console.log('[2/4] Canvas 运行时锚点');
check(petSource.includes('requestAnimationFrame'), '主循环使用 requestAnimationFrame');
check(petSource.includes('imageSmoothingEnabled = false'), 'Canvas 已关闭图像平滑');
check(petSource.includes("this.loadImage(`assets/pet/qq/${sheet.png}`)"), 'WebP 失败时回退 PNG');
check(!petSource.includes('tower-defense'), '桌宠代码不再引用塔防动作');

console.log('[2.5/4] 图集帧内锚点');
for (const [sheet, rows] of [
    ['night-cat-qq-core.png', [['idle', 0], ['run-right', 1], ['run-left', 2], ['wave', 3]]],
    ['night-cat-qq-actions.png', [['chess', 0], ['write-poem', 1], ['read-book', 2], ['listen-radio', 3]]]
]) {
    const sheetPath = resolve(root, 'assets/pet/qq', sheet);
    for (const [name, row] of rows) {
        const bounds = readFrameBounds(sheetPath, row);
        check(range(bounds.map((frame) => frame.centerX)) <= 8, `${name} 相邻帧横向锚点已稳定`);
        check(range(bounds.map((frame) => frame.bottom)) <= 12, `${name} 相邻帧底线已稳定`);
    }
}

console.log('[3/4] 帧推进算法');
const context = {
    window: { addEventListener() {} },
};
runInNewContext(`${petSource}\nthis.__DesktopPet = DesktopPet;`, context);
const Pet = context.__DesktopPet;
const run = manifest.actions['run-right'];
let frame = Pet.advanceFrame(run, 0, 0, 70);
check(frame.frame === 1 && !frame.completed, '奔跑动作按 70ms 严格切换到下一帧');
const wave = manifest.actions.wave;
const waveDuration = wave.durationsMs.reduce((sum, duration) => sum + duration, 0);
frame = Pet.advanceFrame(wave, 0, 0, waveDuration);
check(frame.completed && frame.frame === 11, '一次性动作播放完整轮次后标记完成');
const looped = Pet.advanceFrame(run, 11, 0, 140);
check(looped.frame === 1 && !looped.completed, '循环动作可以跨越循环边界且不丢帧');

console.log('[4/4] 菜单视口夹取');
const menuPosition = Pet.clampMenuPosition(1270, 840, 320, 560, 1280, 900);
check(menuPosition.x === 952 && menuPosition.y === 332, '菜单右下角坐标被夹在视口内');
const smallViewport = Pet.clampMenuPosition(0, 0, 320, 560, 300, 500);
check(smallViewport.x === 8 && smallViewport.y === 8, '窄视口菜单仍保留安全边距');

console.log('\n桌宠轻量测试通过。');
