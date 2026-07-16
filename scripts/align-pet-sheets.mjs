// 夜游桌宠图集帧内锚点修复脚本。
// 使用示例：
//   node scripts/align-pet-sheets.mjs --dry-run
//   node scripts/align-pet-sheets.mjs
//
// 该脚本依赖 ImageMagick 的 convert 命令。它会逐帧读取 256×256 单元，
// 修正透明内容的横向锚点与左右半区的纵向截取偏移，再以无损 PNG/WebP 写回图集。

import { execFileSync } from 'node:child_process';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cellSize = 256;
const columns = 12;
const dryRun = process.argv.includes('--dry-run');

const sheetDefinitions = [
    {
        name: 'core',
        png: resolve(root, 'assets/pet/qq/night-cat-qq-core.png'),
        webp: resolve(root, 'assets/pet/qq/night-cat-qq-core.webp'),
        rows: [
            ['idle', 0],
            ['run-right', 1],
            ['run-left', 2],
            ['wave', 3],
            ['jump', 4],
            ['sleep-in-hat', 5]
        ]
    },
    {
        name: 'actions',
        png: resolve(root, 'assets/pet/qq/night-cat-qq-actions.png'),
        webp: resolve(root, 'assets/pet/qq/night-cat-qq-actions.webp'),
        rows: [
            ['chess', 0],
            ['write-poem', 1],
            ['read-book', 2],
            ['listen-radio', 3],
            ['moon-dandelion', 4],
            ['cane-shunpo', 5],
            ['raijin', 6],
            ['raiju-chibi', 7]
        ]
    }
];

// 这些动作的角色应该稳定落在同一条底线上；跳跃、瞬步和战型的纵向变化则保留。
const baselineActions = new Set([
    'idle',
    'run-right',
    'run-left',
    'wave',
    'chess',
    'write-poem',
    'read-book',
    'listen-radio'
]);

function runConvert(args, options = {}) {
    try {
        return execFileSync('convert', args, { encoding: options.encoding || 'utf8', stdio: options.stdio || 'pipe' });
    } catch (error) {
        if (error?.code === 'ENOENT') {
            throw new Error('未找到 ImageMagick convert，请先安装 ImageMagick 后重试。');
        }
        throw error;
    }
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function readFrameBounds(sheetPath) {
    const output = runConvert([
        sheetPath,
        '-crop', `${cellSize}x${cellSize}`,
        '+repage',
        '-alpha', 'extract',
        '-threshold', '1%',
        '-trim',
        '-format', '%w %h %X %Y\\n',
        'info:'
    ]);

    return output.trim().split(/\r?\n/).map((line) => {
        const [width, height, x, y] = line.trim().split(/\s+/);
        return {
            width: Number(width),
            height: Number(height),
            x: Number.parseInt(x, 10),
            y: Number.parseInt(y, 10)
        };
    });
}

function getAlignmentOffsets(bounds, actionName) {
    const frames = bounds.map((bound, frame) => ({
        ...bound,
        frame,
        centerX: bound.x + bound.width / 2,
        bottom: bound.y + bound.height
    }));

    // 资源包的第 7–12 帧来自另一块透明画布，先根据两半的底部中位数找出纵向偏移。
    const splitDy = Math.round(
        median(frames.slice(0, 6).map((frame) => frame.bottom))
        - median(frames.slice(6).map((frame) => frame.bottom))
    );
    const verticallyCorrected = frames.map((frame) => ({
        ...frame,
        correctedBottom: frame.bottom + (frame.frame >= 6 ? splitDy : 0)
    }));

    // 用整行动作的透明边界中心作为横向锚点，消除相邻帧逐步向左漂移。
    const targetCenterX = median(verticallyCorrected.map((frame) => frame.centerX));
    const targetBottom = median(verticallyCorrected.map((frame) => frame.correctedBottom));

    return verticallyCorrected.map((frame) => {
        const dx = Math.round(targetCenterX - frame.centerX);
        const baselineDy = baselineActions.has(actionName)
            ? Math.round(targetBottom - frame.correctedBottom)
            : 0;
        const splitCorrection = frame.frame >= 6 ? splitDy : 0;
        const requestedDy = baselineDy + splitCorrection;

        // 防止归一化把非透明内容推到 256×256 单元外。
        return {
            dx: Math.round(clamp(dx, -frame.x, cellSize - (frame.x + frame.width))),
            dy: Math.round(clamp(requestedDy, -frame.y, cellSize - (frame.y + frame.height)))
        };
    });
}

function geometry(dx, dy) {
    const x = dx >= 0 ? `+${dx}` : `${dx}`;
    const y = dy >= 0 ? `+${dy}` : `${dy}`;
    return `${x}${y}`;
}

async function alignSheet(sheet, tempRoot) {
    const bounds = readFrameBounds(sheet.png);
    if (bounds.length !== sheet.rows.length * columns) {
        throw new Error(`${sheet.name} 图集帧数异常：${bounds.length}`);
    }

    const framePaths = [];
    for (const [actionName, row] of sheet.rows) {
        const rowBounds = bounds.slice(row * columns, row * columns + columns);
        const offsets = getAlignmentOffsets(rowBounds, actionName);
        console.log(`${sheet.name}/${actionName}: ${offsets.map(({ dx, dy }) => `${dx},${dy}`).join(' | ')}`);

        for (let frame = 0; frame < columns; frame += 1) {
            const sourcePath = join(tempRoot, `${sheet.name}-${row}-${frame}-source.png`);
            const alignedPath = join(tempRoot, `${sheet.name}-${row}-${frame}.png`);
            const x = frame * cellSize;
            const y = row * cellSize;
            runConvert([sheet.png, '-crop', `${cellSize}x${cellSize}+${x}+${y}`, '+repage', sourcePath]);
            runConvert([
                '-size', `${cellSize}x${cellSize}`,
                'xc:none',
                sourcePath,
                '-geometry', geometry(offsets[frame].dx, offsets[frame].dy),
                '-composite',
                alignedPath
            ]);
            framePaths.push({ path: alignedPath, x, y });
        }
    }

    if (dryRun) return;

    const alignedPng = join(tempRoot, `${sheet.name}-aligned.png`);
    const composeArgs = ['-size', `${columns * cellSize}x${sheet.rows.length * cellSize}`, 'xc:none'];
    framePaths.forEach(({ path, x, y }) => {
        composeArgs.push(path, '-geometry', `+${x}+${y}`, '-composite');
    });
    composeArgs.push(alignedPng);
    runConvert(composeArgs);

    const alignedWebp = join(tempRoot, `${sheet.name}-aligned.webp`);
    runConvert([alignedPng, '-define', 'webp:lossless=true', alignedWebp]);
    await rename(alignedPng, sheet.png);
    await rename(alignedWebp, sheet.webp);
}

async function main() {
    const tempRoot = await mkdtemp(join(tmpdir(), 'night-cat-qq-aligned-'));
    try {
        console.log(dryRun ? '预览模式：只计算锚点，不写回图集。' : '开始修复夜游图集锚点……');
        for (const sheet of sheetDefinitions) await alignSheet(sheet, tempRoot);
        console.log(dryRun ? '锚点计算完成。' : '图集已按无损方式写回。');
    } finally {
        await rm(tempRoot, { recursive: true, force: true });
    }
}

main().catch((error) => {
    console.error(`图集锚点修复失败：${error.message}`);
    process.exitCode = 1;
});
