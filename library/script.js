const LIBRARY_STATE_KEY = 'blankke_library_v2';

const libraryEls = {
    bookshelf: document.getElementById('bookshelf'),
    search: document.getElementById('library-search'),
    authorFilter: document.getElementById('author-filter'),
    clearFilter: document.getElementById('clear-library-filter'),
    count: document.getElementById('library-count'),
    subtitle: document.getElementById('library-subtitle'),
    quoteCount: document.getElementById('quote-count'),
    empty: document.getElementById('library-empty'),
    panel: document.getElementById('reading-panel'),
    panelClose: document.getElementById('panel-close'),
    panelTitle: document.getElementById('panel-title'),
    panelAuthor: document.getElementById('panel-author'),
    panelTags: document.getElementById('panel-tags'),
    panelNote: document.getElementById('panel-note'),
    panelQuotes: document.getElementById('panel-quotes'),
    sameAuthor: document.getElementById('same-author'),
    openBookCard: document.getElementById('open-book-card'),
    quoteIndex: document.getElementById('quote-index'),
    quoteIndexCount: document.getElementById('quote-index-count'),
    overlay: document.getElementById('overlay'),
    modalStatus: document.getElementById('modal-status'),
    modalTitle: document.getElementById('modal-title'),
    modalAuthor: document.getElementById('modal-author'),
    modalNote: document.getElementById('modal-note'),
    modalQuotes: document.getElementById('modal-quotes'),
    modalRelated: document.getElementById('modal-related')
};

let normalizedBooks = [];
let filteredBooks = [];
let selectedBookId = null;

function readLibraryState() {
    try {
        const parsed = JSON.parse(localStorage.getItem(LIBRARY_STATE_KEY) || '{}');
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
}

function writeLibraryState(patch = {}) {
    const next = { ...readLibraryState(), ...patch };
    localStorage.setItem(LIBRARY_STATE_KEY, JSON.stringify(next));
}

function normalizeText(value) {
    return String(value || '').trim().toLowerCase();
}

function getBooks() {
    if (Array.isArray(window.libraryBooks)) return window.libraryBooks;
    if (typeof libraryBooks !== 'undefined' && Array.isArray(libraryBooks)) return libraryBooks;
    return [];
}

function normalizeBook(book, index) {
    const quotes = Array.isArray(book.quotes) ? book.quotes.filter(Boolean) : [];
    const tags = Array.isArray(book.tags) ? book.tags.filter(Boolean) : [];
    return {
        ...book,
        id: book.id || `book-${index}`,
        index,
        title: book.title || `Untitled ${index + 1}`,
        fullTitle: book.fullTitle || book.title || `Untitled ${index + 1}`,
        author: book.author || '未知作者',
        color: book.color || '#3f4b55',
        textColor: book.textColor || '#ffffff',
        quotes,
        tags,
        status: book.status || '',
        note: book.note || '',
        year: book.year || ''
    };
}

function initLibrary() {
    normalizedBooks = getBooks().map(normalizeBook);
    const state = readLibraryState();

    if (libraryEls.search && state.query) libraryEls.search.value = state.query;
    renderAuthorFilter(state.author || 'all');

    selectedBookId = state.selectedBookId || normalizedBooks[0]?.id || null;
    applyFilters();
    bindLibraryEvents();
}

function bindLibraryEvents() {
    libraryEls.search?.addEventListener('input', () => {
        writeLibraryState({ query: libraryEls.search.value });
        applyFilters();
    });

    libraryEls.authorFilter?.addEventListener('change', () => {
        writeLibraryState({ author: libraryEls.authorFilter.value });
        applyFilters();
    });

    libraryEls.clearFilter?.addEventListener('click', () => {
        if (libraryEls.search) libraryEls.search.value = '';
        if (libraryEls.authorFilter) libraryEls.authorFilter.value = 'all';
        writeLibraryState({ query: '', author: 'all' });
        applyFilters();
    });

    libraryEls.openBookCard?.addEventListener('click', () => {
        const book = normalizedBooks.find(item => item.id === selectedBookId);
        if (book) openBook(book);
    });

    libraryEls.panelClose?.addEventListener('click', () => {
        libraryEls.panel?.classList.remove('is-open');
    });

    libraryEls.overlay?.addEventListener('click', (event) => {
        if (event.target === libraryEls.overlay) closeBook();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeBook();
    });
}

function renderAuthorFilter(selectedAuthor) {
    if (!libraryEls.authorFilter) return;
    const authors = Array.from(new Set(normalizedBooks.map(book => book.author))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
    libraryEls.authorFilter.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = '全部';
    libraryEls.authorFilter.appendChild(allOption);

    authors.forEach((author) => {
        const option = document.createElement('option');
        option.value = author;
        option.textContent = author;
        libraryEls.authorFilter.appendChild(option);
    });

    libraryEls.authorFilter.value = authors.includes(selectedAuthor) ? selectedAuthor : 'all';
}

function bookMatches(book, query, author) {
    const authorMatches = author === 'all' || book.author === author;
    if (!authorMatches) return false;
    if (!query) return true;

    const haystack = [
        book.title,
        book.fullTitle,
        book.author,
        book.note,
        book.year,
        book.status,
        book.tags.join(' '),
        book.quotes.join(' ')
    ].map(normalizeText).join(' ');

    return haystack.includes(query);
}

function applyFilters() {
    const query = normalizeText(libraryEls.search?.value);
    const author = libraryEls.authorFilter?.value || 'all';
    filteredBooks = normalizedBooks.filter(book => bookMatches(book, query, author));

    if (!filteredBooks.some(book => book.id === selectedBookId)) {
        selectedBookId = filteredBooks[0]?.id || normalizedBooks[0]?.id || null;
    }

    renderBooks();
    renderStats();
    renderPanel();
    renderQuoteIndex();
}

function renderStats() {
    const totalQuotes = filteredBooks.reduce((sum, book) => sum + book.quotes.length, 0);
    if (libraryEls.count) {
        libraryEls.count.textContent = `${filteredBooks.length} / ${normalizedBooks.length} books`;
    }
    if (libraryEls.quoteCount) {
        libraryEls.quoteCount.textContent = String(totalQuotes);
    }
    if (libraryEls.subtitle) {
        const selected = normalizedBooks.find(book => book.id === selectedBookId);
        libraryEls.subtitle.textContent = selected
            ? `${selected.author} · ${selected.fullTitle}`
            : '这层书架暂时空着。';
    }
    if (libraryEls.empty) {
        libraryEls.empty.classList.toggle('is-visible', filteredBooks.length === 0);
    }
}

function renderBooks() {
    if (!libraryEls.bookshelf) return;
    libraryEls.bookshelf.innerHTML = '';

    filteredBooks.forEach((book) => {
        const bookEl = document.createElement('button');
        bookEl.type = 'button';
        bookEl.className = 'book';
        bookEl.dataset.bookId = book.id;
        bookEl.style.setProperty('--book-color', book.color);
        bookEl.style.setProperty('--book-text', book.textColor || '#fff');
        bookEl.style.setProperty('--book-height', `${getBookHeight(book.index)}px`);
        bookEl.style.setProperty('--book-tilt', `${getBookTilt(book.index)}deg`);
        bookEl.classList.toggle('is-selected', book.id === selectedBookId);
        bookEl.setAttribute('aria-label', `${book.fullTitle}，${book.author}`);

        const titleEl = document.createElement('span');
        titleEl.className = 'spine-title';
        titleEl.textContent = book.title;
        bookEl.appendChild(titleEl);

        bookEl.addEventListener('click', () => {
            selectBook(book.id, { openPanel: true });
        });
        bookEl.addEventListener('dblclick', () => openBook(book));

        libraryEls.bookshelf.appendChild(bookEl);
    });
}

function getBookHeight(index) {
    const heights = [250, 296, 276, 318, 270, 304, 262, 334];
    return heights[index % heights.length];
}

function getBookTilt(index) {
    const tilts = [-1.4, 0.8, -0.3, 1.2, -0.9, 0.4];
    return tilts[index % tilts.length];
}

function selectBook(bookId, options = {}) {
    selectedBookId = bookId;
    writeLibraryState({ selectedBookId });
    renderBooks();
    renderStats();
    renderPanel();
    if (options.openPanel) {
        libraryEls.panel?.classList.add('is-open');
    }
}

function renderPanel() {
    const book = normalizedBooks.find(item => item.id === selectedBookId);
    if (!book) return;

    if (libraryEls.panelTitle) libraryEls.panelTitle.textContent = book.fullTitle;
    if (libraryEls.panelAuthor) {
        const meta = [book.author, book.year].filter(Boolean).join(' · ');
        libraryEls.panelAuthor.textContent = meta;
    }
    renderTags(libraryEls.panelTags, book);
    if (libraryEls.panelNote) {
        libraryEls.panelNote.textContent = book.note || getStatusText(book.status);
        libraryEls.panelNote.style.display = (book.note || book.status) ? 'block' : 'none';
    }
    renderQuoteList(libraryEls.panelQuotes, book.quotes);
    renderSameAuthor(book);
}

function renderTags(container, book) {
    if (!container) return;
    container.innerHTML = '';
    const tags = [
        ...book.tags,
        book.status ? getStatusText(book.status) : ''
    ].filter(Boolean);

    tags.forEach((tag) => {
        const span = document.createElement('span');
        span.className = 'panel-tag';
        span.textContent = tag;
        container.appendChild(span);
    });
}

function getStatusText(status) {
    const map = {
        read: '已读',
        reading: '在读',
        wishlist: '想读'
    };
    return map[status] || status || '';
}

function renderQuoteList(container, quotes) {
    if (!container) return;
    container.innerHTML = '';

    if (!quotes.length) {
        const empty = document.createElement('p');
        empty.className = 'quote-line';
        empty.textContent = '还没有摘录。';
        container.appendChild(empty);
        return;
    }

    quotes.forEach((quote) => {
        const line = document.createElement('blockquote');
        line.className = 'quote-line';
        line.textContent = quote;
        container.appendChild(line);
    });
}

function renderSameAuthor(book) {
    if (!libraryEls.sameAuthor) return;
    const siblings = normalizedBooks.filter(item => item.author === book.author && item.id !== book.id);
    libraryEls.sameAuthor.innerHTML = '';
    if (!siblings.length) return;

    const title = document.createElement('div');
    title.className = 'same-author-title';
    title.textContent = '同作者';
    libraryEls.sameAuthor.appendChild(title);

    siblings.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = item.fullTitle;
        btn.addEventListener('click', () => selectBook(item.id, { openPanel: true }));
        libraryEls.sameAuthor.appendChild(btn);
    });
}

function renderQuoteIndex() {
    if (!libraryEls.quoteIndex) return;
    libraryEls.quoteIndex.innerHTML = '';
    const entries = [];

    filteredBooks.forEach((book) => {
        book.quotes.forEach((quote, quoteIndex) => {
            entries.push({ book, quote, quoteIndex });
        });
    });

    if (libraryEls.quoteIndexCount) {
        libraryEls.quoteIndexCount.textContent = `${entries.length} entries`;
    }

    entries.forEach(({ book, quote, quoteIndex }) => {
        const card = document.createElement('article');
        card.className = 'quote-card';
        card.tabIndex = 0;

        const text = document.createElement('p');
        text.textContent = quote;
        const meta = document.createElement('small');
        meta.textContent = `${book.fullTitle} · ${book.author}`;

        card.appendChild(text);
        card.appendChild(meta);
        card.addEventListener('click', () => {
            selectBook(book.id, { openPanel: true });
            openBook(book, quoteIndex);
        });
        card.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectBook(book.id, { openPanel: true });
                openBook(book, quoteIndex);
            }
        });

        libraryEls.quoteIndex.appendChild(card);
    });
}

function openBook(book, focusQuoteIndex = -1) {
    if (!book) return;
    selectBook(book.id);

    if (libraryEls.modalStatus) {
        libraryEls.modalStatus.textContent = getStatusText(book.status) || 'Reading Card';
    }
    if (libraryEls.modalTitle) libraryEls.modalTitle.textContent = book.fullTitle;
    if (libraryEls.modalAuthor) {
        libraryEls.modalAuthor.textContent = [book.author, book.year].filter(Boolean).join(' · ');
    }
    if (libraryEls.modalNote) {
        libraryEls.modalNote.textContent = book.note || '';
        libraryEls.modalNote.style.display = book.note ? 'block' : 'none';
    }
    if (libraryEls.modalQuotes) {
        libraryEls.modalQuotes.innerHTML = '';
        book.quotes.forEach((quote, index) => {
            const item = document.createElement('blockquote');
            item.className = 'quote-item';
            item.textContent = quote;
            if (index === focusQuoteIndex) {
                item.style.borderLeftColor = '#1f6f70';
                item.style.background = 'rgba(31, 111, 112, 0.12)';
            }
            libraryEls.modalQuotes.appendChild(item);
        });
    }
    renderModalRelated(book);

    libraryEls.overlay?.classList.add('active');
    libraryEls.overlay?.setAttribute('aria-hidden', 'false');
}

function renderModalRelated(book) {
    if (!libraryEls.modalRelated) return;
    const siblings = normalizedBooks.filter(item => item.author === book.author && item.id !== book.id);
    libraryEls.modalRelated.innerHTML = '';
    if (!siblings.length) return;

    const title = document.createElement('div');
    title.className = 'same-author-title';
    title.textContent = '同作者';
    libraryEls.modalRelated.appendChild(title);

    siblings.forEach((item) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = item.fullTitle;
        btn.addEventListener('click', () => openBook(item));
        libraryEls.modalRelated.appendChild(btn);
    });
}

function closeBook() {
    libraryEls.overlay?.classList.remove('active');
    libraryEls.overlay?.setAttribute('aria-hidden', 'true');
}

window.openBook = openBook;
window.closeBook = closeBook;

document.addEventListener('DOMContentLoaded', initLibrary);
