// 瀑布流相册逻辑

function initGallery() {
    const galleryContainer = document.getElementById('gallery-content');
    if (!galleryContainer) return;

    // 清空容器
    galleryContainer.innerHTML = '';

    // 遍历数据并创建图片元素
    galleryData.forEach((item, index) => {
        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'gallery-item';
        
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.title || `Photo ${index + 1}`;
        img.loading = "lazy"; // 懒加载
        
        // 点击查看大图（简单的实现，可以后续优化）
        img.onclick = () => {
            window.open(item.src, '_blank');
        };

        const caption = document.createElement('div');
        caption.className = 'gallery-caption';
        caption.innerText = item.title || '';

        imgWrapper.appendChild(img);
        if (item.title) {
            imgWrapper.appendChild(caption);
        }
        galleryContainer.appendChild(imgWrapper);
    });
}

// 监听窗口打开事件，如果是相册窗口，则初始化相册
// 假设 window-manager.js 中有类似的事件机制，或者我们直接在打开窗口时调用
// 这里我们做一个简单的轮询或者依赖全局函数
// 为了简单起见，我们将 initGallery 暴露给全局，在 index.html 的 ondblclick 中调用，或者在窗口加载时调用

window.initGallery = initGallery;
