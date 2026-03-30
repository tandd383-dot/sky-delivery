let currentUser = null;
let cart = [];
let allOrders = [];
let currentFilter = 'all';

const socket = io();

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
            showMenu();
            loadUserInfo(user.id);
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
            document.getElementById('user-name-display').textContent = user.name;
            document.getElementById('user-points').textContent = user.points;
            document.getElementById('user-avatar-text').textContent = user.name.charAt(0).toUpperCase();
            showMenu();
        }
    } catch (error) {
        console.error('加载用户信息失败:', error);
    }
}

async function loadMenu() {
    try {
        const response = await fetch('/api/menu');
        const menuItems = await response.json();
        renderMenu(menuItems);
    } catch (error) {
        console.error('加载菜单失败:', error);
    }
}

function renderMenu(menuItems) {
    const menuList = document.getElementById('menu-list');

    if (menuItems.length === 0) {
        menuList.innerHTML = `
            <div class="mt-empty">
                <div class="mt-empty-icon">🍽️</div>
                <div class="mt-empty-text">老板还没上架菜品哦~</div>
            </div>`;
        return;
    }

    menuList.innerHTML = menuItems.map(item => {
        const cartItem = cart.find(c => c.id === item.id);
        const qty = cartItem ? cartItem.quantity : 0;
        return `
            <div class="mt-dish-card">
                <div class="mt-dish-img">
                    ${item.image_url
                        ? `<img src="${item.image_url}" alt="${item.name}">`
                        : `<div class="mt-dish-img-placeholder">🍜</div>`
                    }
                </div>
                <div class="mt-dish-info">
                    <div>
                        <div class="mt-dish-name">${item.name}</div>
                        ${item.description ? `<div class="mt-dish-desc">${item.description}</div>` : ''}
                    </div>
                    <div class="mt-dish-bottom">
                        <div class="mt-dish-price">${item.price}<span class="mt-dish-price-unit">积分</span></div>
                        ${qty > 0 ? `
                            <div class="cart-ctrl">
                                <button class="cart-ctrl-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
                                <span class="cart-ctrl-num">${qty}</span>
                                <button class="cart-ctrl-btn" style="background:linear-gradient(135deg,var(--mt-orange),var(--mt-yellow));border:none;" onclick="addToCart('${item.id}', '${item.name}', ${item.price})">+</button>
                            </div>
                        ` : `
                            <button class="mt-add-btn" onclick="addToCart('${item.id}', '${item.name}', ${item.price})">+</button>
                        `}
                    </div>
                </div>
            </div>`;
    }).join('');
}

function addToCart(itemId, itemName, price) {
    const existingItem = cart.find(item => item.id === itemId);
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({ id: itemId, name: itemName, price: price, quantity: 1 });
    }
    updateCartDisplay();
    loadMenu();
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCartDisplay();
    loadMenu();
}

function updateQuantity(itemId, change) {
    const item = cart.find(item => item.id === itemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            updateCartDisplay();
            loadMenu();
        }
    }
}

function clearCart() {
    cart = [];
    updateCartDisplay();
    loadMenu();
    toggleCartPanel();
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
            <span class="cart-panel-item-name">${item.name}</span>
            <span class="cart-panel-item-price">¥${item.price * item.quantity}</span>
            <div class="cart-ctrl">
                <button class="cart-ctrl-btn" onclick="updateQuantity('${item.id}', -1)">−</button>
                <span class="cart-ctrl-num">${item.quantity}</span>
                <button class="cart-ctrl-btn" style="background:linear-gradient(135deg,var(--mt-orange),var(--mt-yellow));border:none;" onclick="addToCart('${item.id}', '${item.name}', ${item.price})">+</button>
            </div>
        </div>
    `).join('');
}

function toggleCartPanel() {
    const mask = document.getElementById('cart-panel-mask');
    const panel = document.getElementById('cart-panel');
    if (panel.classList.contains('hidden')) {
        mask.classList.remove('hidden');
        panel.classList.remove('hidden');
        panel.classList.add('show');
    } else {
        mask.classList.add('hidden');
        panel.classList.add('hidden');
        panel.classList.remove('show');
    }
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

    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: currentUser.id, items: cart })
        });

        if (response.ok) {
            cart = [];
            updateCartDisplay();
            loadUserInfo(currentUser.id);
            toggleCartPanel();
            loadMenu();
            showToast('下单成功！');
            loadMyOrders();
            showOrders();
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
                    <div class="mt-order-shop">🍜 好友点餐</div>
                    <div class="mt-order-status ${order.status}">${getStatusText(order.status)}</div>
                </div>
                <div class="mt-order-body">
                    ${items.map(item => `
                        <div class="mt-order-dish">
                            <span class="mt-order-dish-name">${item.name} x${item.quantity}</span>
                            <span class="mt-order-dish-price">${item.price * item.quantity}积分</span>
                        </div>
                    `).join('')}
                </div>
                <div class="mt-order-footer">
                    <span class="mt-order-time">${new Date(order.created_at).toLocaleString('zh-CN')}</span>
                    <div class="mt-order-total">共${order.total_points}<span class="mt-order-total-num">积分</span></div>
                </div>
            </div>`;
    }).join('');
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
