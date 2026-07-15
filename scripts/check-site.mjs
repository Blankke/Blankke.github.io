/**
 * 静态站点完整性检查：校验 JavaScript 语法、本地资源、重复 ID、CSS 花括号与解密链路锚点。
 *
 * 使用示例：
 *   node scripts/check-site.mjs
 */

import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const scriptFiles = [
    'cmd.js',
    'pet.js',
    'js/app-registry.js',
    'js/apps.js',
    'js/core.js',
    'js/desktop-effects.js',
    'js/desktop.js',
    'js/gallery-data.js',
    'js/gallery.js',
    'js/main.js',
    'js/recycle-bin.js',
    'js/system-experience.js',
    'js/window-manager.js',
    'library/books-data.js',
    'library/script.js'
];
const htmlFiles = [
    'index.html',
    '404.html',
    'apps/ie_start.html',
    'apps/minesweeper.html',
    'apps/resume.html',
    'library/index.html'
];
const cssFiles = ['style.css', 'style-gallery.css', 'apps/resume.css', 'library/style.css'];
const errors = [];

function reportError(message) {
    errors.push(message);
    console.error(`  × ${message}`);
}

function isLocalReference(reference) {
    return reference
        && !/^(?:[a-z]+:|#|\/\/)/i.test(reference)
        && !reference.startsWith('data:');
}

async function fileExists(pathname) {
    try {
        await access(pathname);
        return true;
    } catch {
        return false;
    }
}

console.log('[1/5] JavaScript 语法');
for (const file of scriptFiles) {
    try {
        execFileSync(process.execPath, ['--check', resolve(root, file)], { stdio: 'pipe' });
    } catch (error) {
        reportError(`${file} 语法错误：${String(error.stderr || error.message).trim()}`);
    }
}

console.log('[2/5] HTML 内联脚本与重复 ID');
for (const file of htmlFiles) {
    const source = await readFile(resolve(root, file), 'utf8');
    const ids = Array.from(source.matchAll(/\bid\s*=\s*"([^"]+)"/g), (match) => match[1]);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicates.length) reportError(`${file} 存在重复 ID：${Array.from(new Set(duplicates)).join(', ')}`);

    const inlineScripts = Array.from(source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi), (match) => match[1]);
    inlineScripts.forEach((script, index) => {
        try {
            Function(script);
        } catch (error) {
            reportError(`${file} 的第 ${index + 1} 个内联脚本语法错误：${error.message}`);
        }
    });
}

console.log('[3/5] 本地资源引用');
for (const file of [...htmlFiles, ...cssFiles]) {
    const source = await readFile(resolve(root, file), 'utf8');
    const references = [];
    if (file.endsWith('.html')) {
        references.push(...Array.from(source.matchAll(/\b(?:src|href|data-src)\s*=\s*"([^"]+)"/gi), (match) => match[1]));
    } else {
        references.push(...Array.from(source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi), (match) => match[1]));
    }

    for (const reference of references) {
        if (!isLocalReference(reference)) continue;
        const cleanReference = reference.split(/[?#]/, 1)[0];
        const pathname = resolve(root, dirname(file), cleanReference);
        if (!await fileExists(pathname)) reportError(`${file} 引用了不存在的资源：${reference}`);
    }
}

console.log('[4/5] CSS 结构');
for (const file of cssFiles) {
    const source = (await readFile(resolve(root, file), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    const opening = (source.match(/{/g) || []).length;
    const closing = (source.match(/}/g) || []).length;
    if (opening !== closing) reportError(`${file} 花括号不平衡：${opening} / ${closing}`);
}

console.log('[5/5] 解密链路锚点');
const questChecks = [
    ['index.html', 'mystery-signal'],
    ['js/recycle-bin.js', "recycleBinDefaults = ['readme', 'pvz']"],
    ['js/recycle-bin.js', "setFlag('pvz_restored', true)"],
    ['js/apps.js', 'wisdomTreeHints'],
    ['js/apps.js', "setFlag('pet_voice_restored'"],
    ['apps/minesweeper.html', "type: 'minesweeper-win'"],
    ['pet.js', "setFlag('minesweeper_fast_clear', true)"],
    ['js/apps.js', 'e.ctrlKey && e.altKey'],
    ['cmd.js', 'copy notes.raw'],
    ['cmd.js', "setFlag('cmd_unlocked', true)"],
    ['cmd.js', 'const validHashes'],
    ['cmd.js', "setFlag('diary_key_accepted', true)"],
    ['cmd.js', "setFlag('diary_read', true)"],
    ['cmd.js', 'blankke.caozc1108.workers.dev']
];

for (const [file, marker] of questChecks) {
    const source = await readFile(resolve(root, file), 'utf8');
    if (!source.includes(marker)) reportError(`${file} 缺少解密链路锚点：${marker}`);
}

if (errors.length) {
    console.error(`\n检查失败：${errors.length} 个问题。`);
    process.exitCode = 1;
} else {
    console.log('\n检查通过：脚本、页面、资源与解密链路锚点均完整。');
}
