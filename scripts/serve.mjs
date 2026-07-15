/**
 * 本地静态预览服务器（零依赖）。
 *
 * 使用示例：
 *   node scripts/serve.mjs
 *   node scripts/serve.mjs 8080
 *
 * 浏览器访问：http://localhost:4173
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const requestedPort = Number.parseInt(process.argv[2] || '4173', 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;
const mimeTypes = {
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml; charset=utf-8'
};

function getSafePath(urlString) {
    const pathname = decodeURIComponent(new URL(urlString, 'http://localhost').pathname);
    const target = resolve(root, `.${pathname}`);
    if (target !== root && !target.startsWith(`${root}${sep}`)) return null;
    return target;
}

const server = createServer(async (request, response) => {
    try {
        let target = getSafePath(request.url || '/');
        if (!target) {
            response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
            response.end('Forbidden');
            return;
        }

        const targetStat = await stat(target);
        if (targetStat.isDirectory()) target = resolve(target, 'index.html');
        const body = await readFile(target);
        const contentType = mimeTypes[extname(target).toLowerCase()] || 'application/octet-stream';
        response.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-store'
        });
        response.end(body);
    } catch (error) {
        const status = error?.code === 'ENOENT' ? 404 : 500;
        response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(status === 404 ? 'Not Found' : 'Internal Server Error');
    }
});

server.listen(port, '127.0.0.1', () => {
    console.log(`Dent du Lion 已启动：http://localhost:${port}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
