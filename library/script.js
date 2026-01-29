document.addEventListener('DOMContentLoaded', () => {
    const bookshelf = document.getElementById('bookshelf');

    // 1. 获取书籍数据
    fetch('books.json')
        .then(response => response.json())
        .then(books => {
            renderBooks(books);
        })
        .catch(error => console.error('Error loading books:', error));

    // 2. 渲染书籍函数
    function renderBooks(books) {
        books.forEach((book, index) => {
            const bookEl = document.createElement('div');
            bookEl.classList.add('book');
            
            // 应用样式变量
            bookEl.style.backgroundColor = book.color;
            
            // 随机高度生成：260px 到 350px 之间
            // Math.random() generates 0-1. *90 -> 0-90. +260 -> 260-350.
            const randomHeight = Math.floor(Math.random() * 90) + 260;
            bookEl.style.height = `${randomHeight}px`;

            // 动画延迟
            bookEl.style.animationDelay = `${index * 0.05}s`;
            
            // 如果JSON里特别指定了文字颜色则使用，否则默认
            if (book.textColor) {
                bookEl.style.color = book.textColor;
            }

            // 书脊文字
            const titleEl = document.createElement('span');
            titleEl.classList.add('spine-title');
            titleEl.innerText = book.title;
            
            bookEl.appendChild(titleEl);

            // 点击事件：打开书
            bookEl.addEventListener('click', () => {
                openBook(book);
            });

            bookshelf.appendChild(bookEl);
        });
    }
});

// 3. 弹窗控制逻辑
const overlay = document.getElementById('overlay');
const modalTitle = document.getElementById('modal-title');
const modalAuthor = document.getElementById('modal-author');
const modalQuotes = document.getElementById('modal-quotes');

function openBook(book) {
    modalTitle.innerText = book.fullTitle || book.title; // 优先使用 fullTitle，如果书脊太短写不下可以用 title
    modalAuthor.innerText = book.author || '';
    
    // 清空旧内容并填入新名言
    modalQuotes.innerHTML = book.quotes.map(quote => 
        `<div class="quote-item">${quote}</div>`
    ).join('');

    overlay.classList.add('active');
    
    // 点击遮罩层关闭
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeBook();
    });
}

function closeBook() {
    overlay.classList.remove('active');
}

// 绑定键盘ESC关闭
document.addEventListener('keydown', (e) => {
    if (e.key === "Escape") closeBook();
});