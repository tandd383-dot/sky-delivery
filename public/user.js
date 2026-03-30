let currentUser = null;
let cart = [];

const socket = io();

document.addEventListener('DOMContentLoaded', function() {
    const savedUserId = localStorage.getItem('userId');
    if (savedUserId) {
        loadUserInfo(savedUserId);
    }
});

async function login() {
    const userName = document.getElementById('user-name').value.trim();
    if (!userName) {
        alert('请输入你的名字');
        return;
    }
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name: userName })
        });
        
        if (response.ok) {
            const user = await response.json();
            currentUser = user;
            localStorage.setItem('userId', user.id);
            showMenu();
            loadUserInfo(user.id);
        } else {
            alert('登录失败，请重试');
        }
    } catch (error) {
        console.error('登录失败:', error);
        alert('登录失败，请重试');
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
        menuList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">暂无菜品</p>';
        return;
    }
    
    menuList.innerHTML = menuItems.map(item => `
        <div class="menu-item">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : '<div class="menu-item-placeholder">暂无图片</div>'}
            <div class="menu-item-content">
                <div class="menu-item-name">${item.name}</div>
                ${item.description ? `<div class="menu-item-description">${item.description}</div>` : ''}
                <div class="menu-item-price">${item.price} 积分</div>
                <div class="menu-item-actions">
                    <button class="btn btn-primary" onclick="addToCart('${item.id}', '${item.name}', ${item.price})">加入购物车</button>
                </div>
            </div>
        </div>
    `).join('');
}

function addToCart(itemId, itemName, price) {
    const existingItem = cart.find(item => item.id === itemId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            id: itemId,
            name: itemName,
            price: price,
            quantity: 1
        });
    }
    
    updateCartDisplay();
    showNotification('已添加', `${itemName} 已加入购物车`);
}

function removeFromCart(itemId) {
    cart = cart.filter(item => item.id !== itemId);
    updateCartDisplay();
}

function updateQuantity(itemId, change) {
    const item = cart.find(item => item.id === itemId);
    if (item) {
        item.quantity += change;
        if (item.quantity <= 0) {
            removeFromCart(itemId);
        } else {
            updateCartDisplay();
        }
    }
}

function updateCartDisplay() {
    const cartItems = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');
    
    if (cart.length === 0) {
        cartItems.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">购物车为空</p>';
        cartTotal.textContent = '0';
        return;
    }
    
    cartItems.innerHTML = cart.map(item => `
        <div class="cart-item">
            <div class="cart-item-info">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-price">${item.price} 积分/份</div>
            </div>
            <div class="cart-item-actions">
                <button class="btn btn-secondary" onclick="updateQuantity('${item.id}', -1)">-</button>
                <span class="cart-item-quantity">${item.quantity}</span>
                <button class="btn btn-secondary" onclick="updateQuantity('${item.id}', 1)">+</button>
                <button class="btn btn-danger" onclick="removeFromCart('${item.id}')">删除</button>
            </div>
        </div>
    `).join('');
    
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.textContent = total;
}

async function submitOrder() {
    if (cart.length === 0) {
        alert('购物车为空，请先添加菜品');
        return;
    }
    
    if (!currentUser) {
        alert('请先登录');
        return;
    }
    
    const totalPoints = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    if (totalPoints > currentUser.points) {
        alert('积分不足，请联系管理员充值');
        return;
    }
    
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: currentUser.id,
                items: cart
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            cart = [];
            updateCartDisplay();
            loadUserInfo(currentUser.id);
            showNotification('订单提交成功', `订单号: ${result.id}`);
            loadMyOrders();
            showOrders();
        } else {
            const error = await response.json();
            alert(error.error || '订单提交失败');
        }
    } catch (error) {
        console.error('提交订单失败:', error);
        alert('订单提交失败，请重试');
    }
}

async function loadMyOrders() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/orders');
        const allOrders = await response.json();
        const myOrders = allOrders.filter(order => order.user_id === currentUser.id);
        renderMyOrders(myOrders);
    } catch (error) {
        console.error('加载订单失败:', error);
    }
}

function renderMyOrders(orders) {
    const myOrdersDiv = document.getElementById('my-orders');
    
    if (orders.length === 0) {
        myOrdersDiv.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">暂无订单</p>';
        return;
    }
    
    myOrdersDiv.innerHTML = orders.map(order => {
        const items = JSON.parse(order.items);
        return `
            <div class="order-item">
                <div class="order-header">
                    <span class="order-user">订单号: ${order.id.substring(0, 8)}</span>
                    <span class="order-status status-${order.status}">${getStatusText(order.status)}</span>
                </div>
                <div class="order-items">
                    ${items.map(item => `
                        <div class="order-item-detail">
                            <span>${item.name} x${item.quantity}</span>
                            <span>${item.price * item.quantity} 积分</span>
                        </div>
                    `).join('')}
                </div>
                <div class="order-total">总计: ${order.total_points} 积分</div>
                <small style="color: #666; display: block; margin-top: 10px;">${new Date(order.created_at).toLocaleString('zh-CN')}</small>
            </div>
        `;
    }).join('');
}

function getStatusText(status) {
    const statusMap = {
        'pending': '待处理',
        'completed': '已完成'
    };
    return statusMap[status] || status;
}

function showMenu() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('menu-section').classList.remove('hidden');
    document.getElementById('orders-section').classList.add('hidden');
    loadMenu();
}

function showOrders() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('menu-section').classList.add('hidden');
    document.getElementById('orders-section').classList.remove('hidden');
    loadMyOrders();
}

function showNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: message });
    }
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
