let currentUser = null;
let cart = [];
let allMenuItems = [];
let allOrders = [];
let currentFilter = 'all';
let currentCategory = 'all';
let cartPanelOpen = false;
let pendingTasteItem = null;
let selectedSpice = '';
let selectedCustomTastes = [];

const SPICE_LEVELS = ['不辣', '微辣', '中辣', '特辣', '变态辣'];
const DEFAULT_TASTES = ['少盐', '少油', '不要葱', '不要香菜', '加蛋', '加饭'];

const socket = io();

socket.on('new_order', (data) => {
    if (currentUser) loadMyOrders();
});

socket.on('order_status_update', (data) => {
    if (currentUser) loadMyOrders();
});

document.addEventListener('DOMContentLoaded', function() {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
        loadUserInfo(savedUserId);
    }
});

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 1800);
}

function switchPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
}

function showLoginPage() {
    currentUser = null;
    localStorage.removeItem('userId');
    cart = [];
    updateCartDisplay();
    switchPage('login-page');
}

async function login() {
    const userName = document.getElementById('user-name').value.trim();
    if (!userName) {
        showToast('请输入昵称');
        return;
    }
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: userName })
        });
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            localStorage.setItem('userId', user.id);
            updateUserDisplay();
            showMenu();
            showToast('欢迎你，' + user.name);
        } else {
            showToast('登录失败');
        }
    } catch (error) {
        console.error('登录失败:', error);
        showToast('网络错误');
    }
}

async function loadUserInfo(userId) {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        const user = users.find(u => u.id === userId);
        if (user) {
            currentUser = user;
            updateUserDisplay();
            showMenu();
        } else {
            showLoginPage();
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

function updateUserDisplay() {
    document.getElementById('user-name-display').textContent = currentUser.name;
    document.getElementById('user-points').textContent = currentUser.points;
    document.getElementById('user-avatar-text').textContent = currentUser.name.charAt(0).toUpperCase();
    const avatar2 = document.getElementById('user-avatar-text-2');
    if (avatar2) avatar2.textContent = currentUser.name.charAt(0).toUpperCase();
}

async function loadMenu() {
    try {
        const response = await fetch('/api/menu');
        allMenuItems = await response.json();
        buildCategoryTabs();
        renderMenu();
    } catch (error) {
        console.error('加载菜单失败:', error);
    }
}

function buildCategoryTabs() {
    const cats = new Set();
    allMenuItems.forEach(item => { if (item.category) cats.add(item.category); });
    const tabsEl = document.getElementById('category-tabs');
    let html = '<div class="cat-tab active" data-cat="all" onclick="selectCategory(\'all\', this)">全部</div>';
    cats.forEach(cat => {
        html += `<div class="cat-tab" data-cat="${cat}" onclick="selectCategory('${cat}', this)">${cat}</div>`;
    });
    tabsEl.innerHTML = html;
}

function selectCategory(cat, el) {
    currentCategory = cat;
    document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderMenu();
}

function filterMenu() {
    renderMenu();
}

function getFilteredMenu() {
    const keyword = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
    return allMenuItems.filter(item => {
        const matchCat = currentCategory === 'all' || item.category === currentCategory;
        const matchSearch = !keyword || item.name.toLowerCase().includes(keyword) || (item.description || '').toLowerCase().includes(keyword);
        return matchCat && matchSearch;
    });
}

function renderMenu() {
    const menuList = document.getElementById('menu-list');
    const items = getFilteredMenu();

    if (items.length === 0) {
        menuList.innerHTML = `
            <div class="mt-empty">
                <div class="mt-empty-icon">🍽️</div>
                <div class="mt-empty-text">暂无符合条件的菜品</div>
            </div>`;
        return;
    }

    menuList.innerHTML = items.map(item => {
        const cartItem = cart.find(c => c.id === item.id);
        const qty = cartItem ? cartItem.quantity : 0;
        const soldOut = item.is_available === false;
        const recommended = item.is_recommended === true;
        const tasteDesc = buildTasteDesc(item, cartItem);

        return `
            <div class="mt-dish-card ${soldOut ? 'sold-out' : ''}">
                <div class="mt-dish-img">
                    ${item.image_url
                        ? `<img src="${item.image_url}" alt="${item.name}">`
                        : `<div class="mt-dish-img-placeholder">🍜</div>`
                    }
                    ${recommended ? '<div class="dish-badge recommend">推荐</div>' : ''}
                    ${soldOut ? '<div class="dish-badge sold">已售罄</div>' : ''}
                </div>
                <div class="mt-dish-info">
                    <div>
                        <div class="mt-dish-name">${item.name}</div>
                        ${item.description ? `<div class="mt-dish-desc">${item.description}</div>` : ''}
                        ${item.spice_level && item.spice_level !== '可选' ? `<div class="dish-tag spice-tag">🌶️ ${item.spice_level}</div>` : ''}
                        ${tasteDesc ? `<div class="dish-taste-info">${tasteDesc}</div>` : ''}
                    </div>
                    <div class="mt-dish-bottom">
                        <div class="mt-dish-price"><span class="mt-dish-price-num">${item.price}</span><span class="mt-dish-price-unit">积分</span></div>
                        ${soldOut ? `
                            <span class="sold-out-text">已售罄</span>
                        ` : qty > 0 ? `
                            <div class="cart-ctrl">
                                <button class="cart-ctrl-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
                                <span class="cart-ctrl-num">${qty}</span>
                                <button class="cart-ctrl-btn cart-ctrl-btn-add" onclick="openTastePanel('${item.id}')">+</button>
                            </div>
                        ` : `
                            <button class="mt-add-btn" onclick="openTastePanel('${item.id}')">+</button>
                        `}
                    </div>
                </div>
            </div>`;
    }).join('');
}

function buildTasteDesc(item, cartItem) {
    if (!cartItem || !cartItem.taste) return '';
    return `<span class="taste-desc-tag">${cartItem.taste}</span>`;
}

function openTastePanel(itemId) {
    const item = allMenuItems.find(m => m.id === itemId);
    if (!item) return;

    pendingTasteItem = item;
    selectedSpice = '';
    selectedCustomTastes = [];

    document.getElementById('taste-dish-name').textContent = item.name;

    const spiceSection = document.getElementById('taste-spice-section');
    const spiceOptions = document.getElementById('spice-options');
    const customSection = document.getElementById('taste-custom-section');
    const customOptions = document.getElementById('custom-taste-options');

    if (item.spice_level && item.spice_level !== '不可选') {
        spiceSection.classList.remove('hidden');
        const levels = item.spice_level === '可选' ? ['不辣', '微辣', '中辣', '特辣'] : SPICE_LEVELS;
        spiceOptions.innerHTML = levels.map(level =>
            `<div class="taste-option" onclick="selectSpice('${level}', this)">${level}</div>`
        ).join('');
    } else {
        spiceSection.classList.add('hidden');
    }

    let tasteOpts = [];
    try { tasteOpts = JSON.parse(item.taste_options || '[]'); } catch(e) {}
    if (tasteOpts.length > 0) {
        customSection.classList.remove('hidden');
        customOptions.innerHTML = tasteOpts.map(opt =>
            `<div class="taste-option" onclick="toggleCustomTaste('${opt}', this)">${opt}</div>`
        ).join('');
    } else {
        customSection.classList.add('hidden');
    }

    if (spiceSection.classList.contains('hidden') && customSection.classList.contains('hidden')) {
        addToCartDirect(item);
        return;
    }

    document.getElementById('taste-mask').classList.remove('hidden');
    document.getElementById('taste-panel').classList.remove('hidden');
}

function selectSpice(level, el) {
    selectedSpice = level;
    document.querySelectorAll('#spice-options .taste-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
}

function toggleCustomTaste(taste, el) {
    const idx = selectedCustomTastes.indexOf(taste);
    if (idx >= 0) {
        selectedCustomTastes.splice(idx, 1);
        el.classList.remove('active');
    } else {
        selectedCustomTastes.push(taste);
        el.classList.add('active');
    }
}

function confirmTaste() {
    if (!pendingTasteItem) return;
    const tasteParts = [];
    if (selectedSpice) tasteParts.push(selectedSpice);
    if (selectedCustomTastes.length > 0) tasteParts.push(selectedCustomTastes.join('、'));
    const taste = tasteParts.join('，');

    const item = pendingTasteItem;
    const existingItem = cart.find(c => c.id === item.id);
    if (existingItem) {
        existingItem.quantity++;
        existingItem.taste = taste;
    } else {
        cart.push({ id: item.id, name: item.name, price: item.price, quantity: 1, taste: taste });
    }

    pendingTasteItem = null;
    selectedSpice = '';
    selectedCustomTastes = [];
    closeTastePanel();
    updateCartDisplay();
    renderMenu();
}

function addToCartDirect(item) {
    const existingItem = cart.find(c => c.id === item.id);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: item.id, name: item.name, price: item.price, quantity: 1, taste: '' });
    }
    updateCartDisplay();
    renderMenu();
}

function closeTastePanel() {
    document.getElementById('taste-mask').classList.add('hidden');
    document.getElementById('taste-panel').classList.add('hidden');
    pendingTasteItem = null;
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCartDisplay();
    renderMenu();
}

function updateQuantity(itemId, change) {
    const item = cart.find(item => item.id === itemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            updateCartDisplay();
            renderMenu();
        }
    }
}

function clearCart() {
    cart = [];
    updateCartDisplay();
    renderMenu();
    closeCartPanel();
}

function updateCartDisplay() {
    const cartFloat = document.getElementById('cart-float');
    const cartBadge = document.getElementById('cart-badge');
    const cartTotal = document.getElementById('cart-total');
    const cartItems = document.getElementById('cart-items');

    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    if (totalCount > 0) {
        cartFloat.classList.remove('hidden');
        cartBadge.textContent = totalCount;
        cartTotal.textContent = totalPrice;
    } else {
        cartFloat.classList.add('hidden');
        if (cartPanelOpen) closeCartPanel();
    }

    if (cart.length === 0) {
        cartItems.innerHTML = `
            <div class="mt-empty" style="padding:30px;">
                <div class="mt-empty-text">购物车是空的</div>
            </div>`;
        return;
    }

    cartItems.innerHTML = cart.map(item => `
        <div class="cart-panel-item">
            <div class="cart-panel-item-left">
                <span class="cart-panel-item-name">${item.name}</span>
                ${item.taste ? `<span class="cart-panel-item-taste">${item.taste}</span>` : ''}
            </div>
            <span class="cart-panel-item-price">${item.price * item.quantity}积分</span>
            <div class="cart-ctrl">
                <button class="cart-ctrl-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
                <span class="cart-ctrl-num">${item.quantity}</span>
                <button class="cart-ctrl-btn cart-ctrl-btn-add" onclick="openTastePanel('${item.id}')">+</button>
            </div>
        </div>
    `).join('');
}

function toggleCartPanel() {
    if (cartPanelOpen) closeCartPanel();
    else openCartPanel();
}

function openCartPanel() {
    document.getElementById('cart-panel-mask').classList.remove('hidden');
    document.getElementById('cart-panel').classList.remove('hidden');
    document.getElementById('cart-panel').classList.add('show');
    cartPanelOpen = true;
}

function closeCartPanel() {
    document.getElementById('cart-panel-mask').classList.add('hidden');
    document.getElementById('cart-panel').classList.add('hidden');
    document.getElementById('cart-panel').classList.remove('show');
    cartPanelOpen = false;
}

function openRemarkPanel() {
    if (cart.length === 0) {
        showToast('购物车为空');
        return;
    }
    if (!currentUser) {
        showToast('请先登录');
        return;
    }
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('remark-total-points').textContent = total;
    document.getElementById('order-remark').value = '';
    document.getElementById('remark-mask').classList.remove('hidden');
    document.getElementById('remark-panel').classList.remove('hidden');
}

function closeRemarkPanel() {
    document.getElementById('remark-mask').classList.add('hidden');
    document.getElementById('remark-panel').classList.add('hidden');
}

async function submitOrder() {
    if (cart.length === 0) {
        showToast('购物车为空');
        return;
    }
    if (!currentUser) {
        showToast('请先登录');
        return;
    }

    const totalPoints = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    if (totalPoints > currentUser.points) {
        showToast('积分不足，请联系管理员充值');
        return;
    }

    const remark = document.getElementById('order-remark').value.trim();

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, items: cart, remark: remark })
        });

        if (response.ok) {
            cart = [];
            updateCartDisplay();
            closeRemarkPanel();
            if (cartPanelOpen) closeCartPanel();
            renderMenu();
            showToast('下单成功！');
            loadUserInfo(currentUser.id);
            loadMyOrders();
        } else {
            const error = await response.json();
            showToast(error.error || '下单失败');
        }
    } catch (error) {
        console.error('提交订单失败:', error);
        showToast('网络错误');
    }
}

async function loadMyOrders() {
    if (!currentUser) return;
    try {
        const response = await fetch('/api/orders');
        allOrders = await response.json();
        allOrders = allOrders.filter(order => order.user_id === currentUser.id);
        renderMyOrders(allOrders);
    } catch (error) {
        console.error('加载订单失败:', error);
    }
}

function filterOrders(status, el) {
    currentFilter = status;
    document.querySelectorAll('.order-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    const filtered = status === 'all' ? allOrders : allOrders.filter(o => o.status === status);
    renderMyOrders(filtered);
}

function renderMyOrders(orders) {
    const myOrdersDiv = document.getElementById('my-orders');

    if (orders.length === 0) {
        myOrdersDiv.innerHTML = `
            <div class="mt-empty">
                <div class="mt-empty-icon">📋</div>
                <div class="mt-empty-text">暂无订单</div>
            </div>`;
        return;
    }

    myOrdersDiv.innerHTML = orders.map(order => {
        const items = JSON.parse(order.items);
        return `
            <div class="mt-order-card">
                <div class="mt-order-header">
                    <div class="mt-order-shop">🍜 小赖菜单</div>
                    <div class="mt-order-status ${order.status}">${getStatusText(order.status)}</div>
                </div>
                <div class="mt-order-body">
                    ${items.map(item => `
                        <div class="mt-order-dish">
                            <div>
                                <span class="mt-order-dish-name">${item.name} x${item.quantity}</span>
                                ${item.taste ? `<span class="order-taste-tag">${item.taste}</span>` : ''}
                            </div>
                            <span class="mt-order-dish-price">${item.price * item.quantity}积分</span>
                        </div>
                    `).join('')}
                    ${order.remark ? `<div class="order-remark">💬 ${order.remark}</div>` : ''}
                </div>
                <div class="mt-order-footer">
                    <span class="mt-order-time">${new Date(order.created_at).toLocaleString('zh-CN')}</span>
                    <div class="mt-order-total">共<span class="mt-order-total-num">${order.total_points}</span><span class="mt-order-total-unit">积分</span></div>
                </div>
                ${order.status === 'completed' ? `
                    <div class="order-reorder-bar">
                        <button class="mt-btn mt-btn-sm mt-btn-primary" onclick="reorder('${order.id}')">再来一单</button>
                    </div>
                ` : ''}
            </div>`;
    }).join('');
}

function reorder(orderId) {
    const order = allOrders.find(o => o.id === orderId);
    if (!order) return;
    const items = JSON.parse(order.items);
    items.forEach(item => {
        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            existing.quantity += item.quantity;
        } else {
            cart.push({ id: item.id, name: item.name, price: item.price, quantity: item.quantity, taste: item.taste || '' });
        }
    });
    updateCartDisplay();
    showMenu();
    showToast('已加入购物车');
}

function getStatusText(status) {
    const map = { 'pending': '待处理', 'completed': '已完成' };
    return map[status] || status;
}

function showMenu() {
    switchPage('menu-page');
    loadMenu();
}

function showOrders() {
    switchPage('orders-page');
    loadMyOrders();
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
