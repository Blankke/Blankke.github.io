// 瀑布流相册逻辑

let galleryCurrentIndex = 0;
let galleryViewerEl = null;

function getGalleryItems() {
    if (Array.isArray(window.galleryData)) return window.galleryData;
    if (typeof galleryData !== 'undefined' && Array.isArray(galleryData)) return galleryData;
    return [];
}

function initGallery() {
    const galleryContainer = document.getElementById('gallery-content');
    if (!galleryContainer) return;

    galleryContainer.innerHTML = '';
    const items = getGalleryItems();

    if (!items.length) {
        galleryContainer.innerHTML = '<div class="win98-empty">相册里暂时没有图片。</div>';
        return;
    }

    items.forEach((item, index) => {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'gallery-item';
        
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.title || `Photo ${index + 1}`;
        img.loading = 'lazy';

        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        caption.innerText = item.title || '';

        img.onerror = () => {
            imgWrapper.classList.add('is-broken');
            img.src = 'assets/icon/directory_open_file_mydocs-4.png';
            img.alt = '图片加载失败';
            caption.innerText = item.title ? `${item.title}（加载失败）` : '图片加载失败';
        };

        img.addEventListener('click', () => openGalleryViewer(index));

        imgWrapper.appendChild(img);
        if (item.title) {
            imgWrapper.appendChild(caption);
        }
        galleryContainer.appendChild(imgWrapper);
    });
}

function ensureGalleryViewer() {
    if (galleryViewerEl) return galleryViewerEl;

    galleryViewerEl = document.createElement('div');
    galleryViewerEl.className = 'gallery-viewer';
    galleryViewerEl.innerHTML = `
        <div class="gallery-viewer-window" role="dialog" aria-modal="true" aria-label="图片查看器">
            <div class="title-bar">
                <div class="title-bar-text">图片查看器</div>
                <div class="title-bar-controls">
                    <button aria-label="Close" id="gallery-viewer-close-title"></button>
                </div>
            </div>
            <div class="gallery-viewer-toolbar">
                <button id="gallery-prev" type="button">上一张</button>
                <button id="gallery-next" type="button">下一张</button>
                <button id="gallery-open-original" type="button">原图</button>
                <span class="gallery-viewer-title" id="gallery-viewer-title"></span>
            </div>
            <div class="gallery-viewer-stage">
                <img id="gallery-viewer-img" alt="">
            </div>
            <div class="gallery-viewer-status status-bar">
                <p class="status-bar-field" id="gallery-viewer-index">0 / 0</p>
                <p class="status-bar-field" id="gallery-viewer-caption">Ready</p>
            </div>
        </div>
    `;

    document.body.appendChild(galleryViewerEl);

    galleryViewerEl.addEventListener('click', (event) => {
        if (event.target === galleryViewerEl) closeGalleryViewer();
    });
    galleryViewerEl.querySelector('#gallery-viewer-close-title')?.addEventListener('click', closeGalleryViewer);
    galleryViewerEl.querySelector('#gallery-prev')?.addEventListener('click', () => stepGallery(-1));
    galleryViewerEl.querySelector('#gallery-next')?.addEventListener('click', () => stepGallery(1));
    galleryViewerEl.querySelector('#gallery-open-original')?.addEventListener('click', () => {
        const item = getGalleryItems()[galleryCurrentIndex];
        if (item?.src) window.open(item.src, '_blank');
    });

    document.addEventListener('keydown', (event) => {
        if (!galleryViewerEl?.classList.contains('is-open')) return;
        if (event.key === 'Escape') closeGalleryViewer();
        if (event.key === 'ArrowLeft') stepGallery(-1);
        if (event.key === 'ArrowRight') stepGallery(1);
    });

    return galleryViewerEl;
}

function renderGalleryViewer() {
    const viewer = ensureGalleryViewer();
    const items = getGalleryItems();
    const item = items[galleryCurrentIndex];
    if (!item) return;

    const img = viewer.querySelector('#gallery-viewer-img');
    const title = viewer.querySelector('#gallery-viewer-title');
    const index = viewer.querySelector('#gallery-viewer-index');
    const caption = viewer.querySelector('#gallery-viewer-caption');

    if (img) {
        img.src = item.src;
        img.alt = item.title || `Photo ${galleryCurrentIndex + 1}`;
    }
    if (title) title.textContent = item.title || `Photo ${galleryCurrentIndex + 1}`;
    if (index) index.textContent = `${galleryCurrentIndex + 1} / ${items.length}`;
    if (caption) caption.textContent = item.title || 'Ready';
}

function openGalleryViewer(index) {
    const items = getGalleryItems();
    if (!items.length) return;
    galleryCurrentIndex = Math.max(0, Math.min(index, items.length - 1));
    ensureGalleryViewer().classList.add('is-open');
    renderGalleryViewer();
}

function closeGalleryViewer() {
    if (galleryViewerEl) galleryViewerEl.classList.remove('is-open');
}

function stepGallery(direction) {
    const items = getGalleryItems();
    if (!items.length) return;
    galleryCurrentIndex = (galleryCurrentIndex + direction + items.length) % items.length;
    renderGalleryViewer();
}

window.initGallery = initGallery;
