const supabaseUrl = "https://efzvmvvxzsiikofkxurm.supabase.co";

const supabaseKey = "sb_publishable_7g8JVPpBa0LvppWZ-hBZeQ_4MB5leUB";

const supabaseClient = supabase.createClient(
    supabaseUrl,
    supabaseKey
);async function testConnection() {
    const { data, error } = await supabaseClient
        .from("users")
        .select("*");

    if (error) {
        console.log("خطأ:", error);
    } else {
        console.log("الاتصال يعمل:", data);
    }
}

testConnection();

// باقي كود موقعك يكون هنا// ============================================================
//  المكتبة الإلكترونية - قارئ PDF فائق الدقة مع حفظ التقدم
// ============================================================

// ---- 1. IndexedDB (كما هي) ----
const DB_NAME = 'EbookLibrary';
const DB_VERSION = 2;
let db;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            if (!db.objectStoreNames.contains('books')) {
                const store = db.createObjectStore('books', { keyPath: 'id', autoIncrement: true });
                store.createIndex('uploader', 'uploader', { unique: false });
                store.createIndex('title', 'title', { unique: false });
            }
        };
        request.onsuccess = (event) => { db = event.target.result; resolve(db); };
        request.onerror = (event) => reject(event.target.error);
    });
}

// ---- 2. إدارة المستخدمين (كما هي) ----
function getUsers() { return JSON.parse(localStorage.getItem('users')) || []; }
function saveUsers(users) { localStorage.setItem('users', JSON.stringify(users)); }
function getCurrentUser() { return localStorage.getItem('currentUser'); }
function setCurrentUser(username) {
    if (username) localStorage.setItem('currentUser', username);
    else localStorage.removeItem('currentUser');
}

function registerUser(username, password) {
    const users = getUsers();
    if (users.find(u => u.username === username)) return { success: false, error: 'اسم المستخدم موجود مسبقاً' };
    if (username.trim().length < 3) return { success: false, error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' };
    if (password.length < 4) return { success: false, error: 'كلمة السر يجب أن تكون 4 أحرف على الأقل' };
    users.push({ username, password });
    saveUsers(users);
    return { success: true };
}

function loginUser(username, password) {
    const users = getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    if (user) { setCurrentUser(username); return { success: true }; }
    return { success: false, error: 'اسم المستخدم أو كلمة السر غير صحيحة' };
}

// ---- 3. عرض الكتب (كما هي) ----
function renderBooks(books) {
    const shelf = document.getElementById('bookshelf');
    if (!books || books.length === 0) {
        shelf.innerHTML = '<div class="empty-shelf">📚 لا توجد كتب بعد... ارفع أول كتاب!</div>';
        return;
    }
    const currentUser = getCurrentUser();
    shelf.innerHTML = books.map(book => {
        const isOwner = (book.uploader === currentUser);
        return `
            <div class="book-card" data-book-id="${book.id}">
                <h3>${escapeHtml(book.title)}</h3>
                <p><strong>المؤلف:</strong> ${escapeHtml(book.author)}</p>
                <p><strong>التصنيف:</strong> <span class="category">${escapeHtml(book.category)}</span></p>
                <p class="uploader"><i class="fas fa-user-circle"></i> رفعه: ${escapeHtml(book.uploader)}</p>
                <button class="read-btn btn-primary" data-id="${book.id}" style="margin-top:0.8rem;">📖 قراءة</button>
                ${isOwner ? `<button class="delete-btn" data-id="${book.id}"><i class="fas fa-trash"></i> حذف</button>` : ''}
            </div>
        `;
    }).join('');

    document.querySelectorAll('.read-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); openReader(Number(btn.dataset.id)); });
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); deleteBook(Number(btn.dataset.id)); });
    });
    document.querySelectorAll('.book-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            openReader(Number(card.dataset.bookId));
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ---- 4. تحميل الكتب ----
async function loadBooks(filterUser = null, searchTerm = '') {
    if (!db) await openDB();
    const store = db.transaction('books', 'readonly').objectStore('books');
    const request = store.getAll();
    const result = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    let books = result || [];
    if (filterUser) books = books.filter(b => b.uploader === filterUser);
    if (searchTerm.trim()) {
        const term = searchTerm.trim().toLowerCase();
        books = books.filter(b => b.title.toLowerCase().includes(term) || b.author.toLowerCase().includes(term));
    }
    books.sort((a, b) => b.id - a.id);
    renderBooks(books);
}

// ---- 5. رفع كتاب ----
async function uploadBook(title, author, category, file) {
    const currentUser = getCurrentUser();
    if (!currentUser) return { success: false, error: 'يجب تسجيل الدخول أولاً' };
    const arrayBuffer = await file.arrayBuffer();
    const store = db.transaction('books', 'readwrite').objectStore('books');
    const newBook = {
        title: title.trim(), author: author.trim(), category: category.trim(),
        uploader: currentUser, data: arrayBuffer, fileName: file.name,
        uploadedAt: new Date().toISOString()
    };
    const request = store.add(newBook);
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve({ success: true });
        request.onerror = () => reject({ success: false, error: 'فشل حفظ الكتاب' });
    });
}

// ---- 6. حذف كتاب ----
async function deleteBook(bookId) {
    const currentUser = getCurrentUser();
    if (!currentUser) { alert('يجب تسجيل الدخول'); return; }
    const store = db.transaction('books', 'readonly').objectStore('books');
    const book = await new Promise((resolve, reject) => {
        store.get(bookId).onsuccess = e => resolve(e.target.result);
        store.get(bookId).onerror = () => reject(null);
    });
    if (!book) { alert('الكتاب غير موجود'); return; }
    if (book.uploader !== currentUser) { alert('لا يمكنك حذف كتاب ليس لك'); return; }
    if (!confirm('هل أنت متأكد من حذف هذا الكتاب؟')) return;
    const deleteStore = db.transaction('books', 'readwrite').objectStore('books');
    await new Promise((resolve, reject) => {
        deleteStore.delete(bookId).onsuccess = () => resolve();
        deleteStore.delete(bookId).onerror = () => reject();
    });
    const filterMy = document.getElementById('my-books-toggle').dataset.active === 'true';
    if (filterMy) loadBooks(getCurrentUser());
    else loadBooks(null, document.getElementById('search-input').value);
}

// ---- 7. قارئ PDF الفائق الدقة ----
let currentPdfDoc = null;
let currentPdfScale = 2.5; // دقة عالية جداً
let currentPageNum = 1;
let isDualPageMode = false;
let currentBookId = null;

async function openReader(bookId) {
    currentBookId = bookId;
    const store = db.transaction('books', 'readonly').objectStore('books');
    const book = await new Promise((resolve, reject) => {
        store.get(bookId).onsuccess = e => resolve(e.target.result);
        store.get(bookId).onerror = () => reject(null);
    });
    if (!book) return;

    const pdfData = new Uint8Array(book.data);
    document.getElementById('reader-book-title').textContent = book.title;
    document.getElementById('reader-modal').style.display = 'flex';

    const viewerContainer = document.getElementById('pdf-viewer');
    viewerContainer.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.id = 'pdf-canvas-wrapper';
    viewerContainer.appendChild(wrapper);

    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    // استرجاع آخر صفحة مقروءة
    const savedPage = getBookmark(bookId);
    currentPageNum = savedPage || 1;

    try {
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        currentPdfDoc = pdf;
        document.getElementById('total-pages').textContent = `/ ${pdf.numPages}`;
        document.getElementById('page-input').max = pdf.numPages;
        document.getElementById('page-input').value = currentPageNum;

        // تحميل الصفحة (أو صفحتين حسب الوضع)
        renderView();

        // تحديث زر الإشارة المرجعية
        updateBookmarkButton(bookId);
    } catch (error) {
        viewerContainer.innerHTML = `<p style="color:red;">⚠️ فشل التحميل: ${error.message}</p>`;
    }

    // الأحداث
    document.getElementById('prev-page-btn').onclick = () => changePage(currentPageNum - 1);
    document.getElementById('next-page-btn').onclick = () => changePage(currentPageNum + 1);
    document.getElementById('page-input').onchange = function() {
        let num = parseInt(this.value);
        if (num < 1) num = 1;
        if (num > currentPdfDoc.numPages) num = currentPdfDoc.numPages;
        this.value = num;
        currentPageNum = num;
        renderView();
    };
    document.getElementById('bookmark-btn').onclick = () => {
        if (currentPdfDoc) {
            saveBookmark(currentBookId, currentPageNum);
            updateBookmarkButton(currentBookId);
        }
    };

    // أزرار التكبير والتصغير (الدقة العالية تتطلب scale أكبر)
    document.getElementById('zoom-in-btn').onclick = () => {
        if (currentPdfDoc) {
            currentPdfScale = Math.min(currentPdfScale + 0.5, 5);
            renderView();
        }
    };
    document.getElementById('zoom-out-btn').onclick = () => {
        if (currentPdfDoc) {
            currentPdfScale = Math.max(currentPdfScale - 0.5, 0.5);
            renderView();
        }
    };

    // تبديل وضع الصفحة الواحدة أو المزدوجة
    document.getElementById('page-mode-btn').onclick = () => {
        isDualPageMode = !isDualPageMode;
        document.getElementById('page-mode-btn').innerHTML = isDualPageMode ? '<i class="fas fa-book-open"></i>' : '<i class="fas fa-book"></i>';
        document.getElementById('page-mode-btn').title = isDualPageMode ? 'وضع صفحة واحدة' : 'وضع صفحتين';
        renderView();
    };

    // ملء الشاشة
    document.getElementById('fullscreen-btn').onclick = () => {
        const modalContent = document.querySelector('.reader-content');
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            modalContent.requestFullscreen();
        }
    };

    // إغلاق المودال
    document.querySelector('#reader-modal .close-modal').onclick = () => {
        viewerContainer.innerHTML = '';
        currentPdfDoc = null;
        document.getElementById('reader-modal').style.display = 'none';
    };
}

function renderView() {
    if (!currentPdfDoc) return;
    const wrapper = document.getElementById('pdf-canvas-wrapper');
    wrapper.innerHTML = '';
    wrapper.classList.toggle('dual-page', isDualPageMode);

    // ضبط مستوى التكبير
    document.getElementById('zoom-level').textContent = Math.round(currentPdfScale * 100) + '%';

    if (isDualPageMode) {
        // عرض صفحتين متقابلتين
        const leftPage = currentPageNum % 2 === 0 ? currentPageNum - 1 : currentPageNum;
        const rightPage = leftPage + 1;
        renderSinglePage(wrapper, leftPage, currentPdfScale);
        if (rightPage <= currentPdfDoc.numPages) {
            renderSinglePage(wrapper, rightPage, currentPdfScale);
        }
    } else {
        renderSinglePage(wrapper, currentPageNum, currentPdfScale);
    }
}

async function renderSinglePage(container, pageNum, scale) {
    const page = await currentPdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const pageLabel = document.createElement('div');
    pageLabel.textContent = `صفحة ${pageNum}`;
    pageLabel.style.cssText = 'text-align: center; font-size: 0.8rem; color: #888; margin: 5px 0;';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center;';
    wrapper.appendChild(pageLabel);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);

    const renderContext = { canvasContext: ctx, viewport: viewport };
    await page.render(renderContext).promise;

    // التمرير لأعلى
    const viewer = document.getElementById('pdf-viewer');
    viewer.scrollTop = 0;
}

function changePage(newPage) {
    if (!currentPdfDoc) return;
    if (newPage < 1) newPage = 1;
    if (newPage > currentPdfDoc.numPages) newPage = currentPdfDoc.numPages;
    if (newPage === currentPageNum) return;
    currentPageNum = newPage;
    document.getElementById('page-input').value = newPage;
    renderView();
}

// ---- 8. الإشارات المرجعية (LocalStorage) ----
function getBookmarks() {
    return JSON.parse(localStorage.getItem('bookmarks')) || {};
}

function saveBookmark(bookId, page) {
    const user = getCurrentUser();
    if (!user) return;
    const key = `${user}_${bookId}`;
    const bookmarks = getBookmarks();
    bookmarks[key] = page;
    localStorage.setItem('bookmarks', JSON.stringify(bookmarks));
}

function getBookmark(bookId) {
    const user = getCurrentUser();
    if (!user) return null;
    const key = `${user}_${bookId}`;
    const bookmarks = getBookmarks();
    return bookmarks[key] || null;
}

function updateBookmarkButton(bookId) {
    const saved = getBookmark(bookId);
    const btn = document.getElementById('bookmark-btn');
    if (saved) {
        btn.classList.add('active');
        btn.title = `آخر صفحة: ${saved}`;
    } else {
        btn.classList.remove('active');
        btn.title = 'حفظ الموقع';
    }
}

// ---- 9. تهيئة الموقع ----
async function init() {
    try { await openDB(); } catch (e) { alert('فشل فتح قاعدة البيانات'); }
    const currentUser = getCurrentUser();
    if (currentUser) showMainScreen(currentUser);
    else document.getElementById('auth-screen').style.display = 'flex';
    setupAuthForms();
    setupEventListeners();
}

function showMainScreen(username) {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-screen').style.display = 'flex';
    document.getElementById('current-user').textContent = `👋 ${username}`;
    loadBooks(null);
}

function setupAuthForms() {
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').style.display = 'none';
        document.getElementById('signup-form').style.display = 'block';
        clearErrors();
    });
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signup-form').style.display = 'none';
        document.getElementById('login-form').style.display = 'block';
        clearErrors();
    });
    document.getElementById('login-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const result = loginUser(username, password);
        if (result.success) { showMainScreen(username); document.getElementById('login-form').reset(); }
        else document.getElementById('login-error').textContent = result.error;
    });
    document.getElementById('signup-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value.trim();
        const result = registerUser(username, password);
        if (result.success) { loginUser(username, password); showMainScreen(username); document.getElementById('signup-form').reset(); }
        else document.getElementById('signup-error').textContent = result.error;
    });
}

function clearErrors() {
    document.getElementById('login-error').textContent = '';
    document.getElementById('signup-error').textContent = '';
}

function setupEventListeners() {
    document.getElementById('logout-btn').addEventListener('click', () => {
        setCurrentUser(null);
        document.getElementById('main-screen').style.display = 'none';
        document.getElementById('auth-screen').style.display = 'flex';
    });
    document.getElementById('add-book-btn').addEventListener('click', () => {
        document.getElementById('upload-modal').style.display = 'flex';
    });
    document.querySelectorAll('.close-modal').forEach(el => {
        el.addEventListener('click', () => el.closest('.modal').style.display = 'none');
    });
    window.addEventListener('click', (e) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });
    document.getElementById('upload-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const title = document.getElementById('book-title').value.trim();
        const author = document.getElementById('book-author').value.trim();
        const category = document.getElementById('book-category').value.trim();
        const fileInput = document.getElementById('pdf-file');
        const file = fileInput.files[0];
        if (!file) { document.getElementById('upload-error').textContent = 'الرجاء اختيار ملف PDF'; return; }
        if (file.type !== 'application/pdf') { document.getElementById('upload-error').textContent = 'يجب أن يكون الملف من نوع PDF'; return; }
        try {
            const result = await uploadBook(title, author, category, file);
            if (result.success) {
                document.getElementById('upload-modal').style.display = 'none';
                document.getElementById('upload-form').reset();
                document.getElementById('file-name').textContent = 'لم يتم اختيار ملف';
                const filterMy = document.getElementById('my-books-toggle').dataset.active === 'true';
                if (filterMy) loadBooks(getCurrentUser());
                else loadBooks(null, document.getElementById('search-input').value);
            } else document.getElementById('upload-error').textContent = result.error;
        } catch (err) { document.getElementById('upload-error').textContent = 'حدث خطأ'; }
    });
    document.getElementById('my-books-toggle').addEventListener('click', () => {
        const btn = document.getElementById('my-books-toggle');
        if (btn.dataset.active === 'true') {
            btn.dataset.active = 'false';
            btn.innerHTML = '<i class="fas fa-user"></i> كتبي';
            btn.classList.remove('btn-primary');
            btn.classList.add('btn-secondary');
            loadBooks(null, document.getElementById('search-input').value);
        } else {
            btn.dataset.active = 'true';
            btn.innerHTML = '<i class="fas fa-globe"></i> كل الكتب';
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-primary');
            loadBooks(getCurrentUser());
        }
    });
    let searchTimeout;
    document.getElementById('search-input').addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const term = document.getElementById('search-input').value;
        const filterMy = document.getElementById('my-books-toggle').dataset.active === 'true';
        searchTimeout = setTimeout(() => {
            if (filterMy) loadBooks(getCurrentUser(), term);
            else loadBooks(null, term);
        }, 400);
    });
    document.getElementById('pdf-file').addEventListener('change', () => {
        const file = document.getElementById('pdf-file').files[0];
        document.getElementById('file-name').textContent = file ? file.name : 'لم يتم اختيار ملف';
    });
}

document.addEventListener('DOMContentLoaded', init);
