let currentUserId = null;
let cart = [];

const socket = io();

document.addEventListener('DOMContentLoaded', function() {
    loadMenu();
    loadOrders();
    loadUsers();
    generateShareLink();
    
    document.getElementById('add-menu-form').addEventListener('submit', addMenuItem);
    document.getElementById('edit-menu-form').addEventListener('submit', updateMenuItem);
    
    socket.on('new_order', function(data) {
        loadOrders();
        showNotification('新订单！', `${data.user_id} 下了一笔订单`);
    });
    
    socket.on('order_status_update', function(data) {
        loadOrders();
    });
});

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(tabName + '-tab').classList.add('active');
    event.target.classList.add('active');
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
    menuList.innerHTML = menuItems.map(item => `
        <div class="menu-item">
            ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : '<div class="menu-item-placeholder">暂无图片</div>'}
            <div class="menu-item-content">
                <div class="menu-item-name">${item.name}</div>
                ${item.description ? `<div class="menu-item-description">${item.description}</div>` : ''}
                <div class="menu-item-price">${item.price} 积分</div>
                <div class="menu-item-actions">
                    <button class="btn btn-secondary" onclick="editMenuItem('${item.id}')">编辑</button>
                    <button class="btn btn-danger" onclick="deleteMenuItem('${item.id}')">删除</button>
                </div>
            </div>
        </div>
    `).join('');
}

async function addMenuItem(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('menu-name').value);
    formData.append('description', document.getElementById('menu-description').value);
    formData.append('price', document.getElementById('menu-price').value);
    
    const imageFile = document.getElementById('menu-image').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    try {
        const response = await fetch('/api/menu', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            document.getElementById('add-menu-form').reset();
            loadMenu();
            showNotification('成功', '菜品添加成功！');
        } else {
            showNotification('错误', '添加菜品失败');
        }
    } catch (error) {
        console.error('添加菜品失败:', error);
        showNotification('错误', '添加菜品失败');
    }
}

function editMenuItem(itemId) {
    fetch('/api/menu')
        .then(response => response.json())
        .then(menuItems => {
            const item = menuItems.find(i => i.id === itemId);
            if (item) {
                document.getElementById('edit-menu-id').value = item.id;
                document.getElementById('edit-menu-name').value = item.name;
                document.getElementById('edit-menu-description').value = item.description || '';
                document.getElementById('edit-menu-price').value = item.price;
                document.getElementById('edit-existing-image').value = item.image_url || '';
                document.getElementById('edit-modal').style.display = 'block';
            }
        });
}

async function updateMenuItem(e) {
    e.preventDefault();
    
    const formData = new FormData();
    formData.append('name', document.getElementById('edit-menu-name').value);
    formData.append('description', document.getElementById('edit-menu-description').value);
    formData.append('price', document.getElementById('edit-menu-price').value);
    formData.append('existing_image', document.getElementById('edit-existing-image').value);
    
    const imageFile = document.getElementById('edit-menu-image').files[0];
    if (imageFile) {
        formData.append('image', imageFile);
    }
    
    const itemId = document.getElementById('edit-menu-id').value;
    
    try {
        const response = await fetch(`/api/menu/${itemId}`, {
            method: 'PUT',
            body: formData
        });
        
        if (response.ok) {
            closeModal();
            loadMenu();
            showNotification('成功', '菜品更新成功！');
        } else {
            showNotification('错误', '更新菜品失败');
        }
    } catch (error) {
        console.error('更新菜品失败:', error);
        showNotification('错误', '更新菜品失败');
    }
}

async function deleteMenuItem(itemId) {
    if (!confirm('确定要删除这个菜品吗？')) return;
    
    try {
        const response = await fetch(`/api/menu/${itemId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadMenu();
            showNotification('成功', '菜品删除成功！');
        } else {
            showNotification('错误', '删除菜品失败');
        }
    } catch (error) {
        console.error('删除菜品失败:', error);
        showNotification('错误', '删除菜品失败');
    }
}

async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        renderOrders(orders);
    } catch (error) {
        console.error('加载订单失败:', error);
    }
}

function renderOrders(orders) {
    const ordersList = document.getElementById('orders-list');
    
    if (orders.length === 0) {
        ordersList.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">暂无订单</p>';
        return;
    }
    
    ordersList.innerHTML = orders.map(order => {
        const items = JSON.parse(order.items);
        return `
            <div class="order-item">
                <div class="order-header">
                    <span class="order-user">${order.user_name}</span>
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
                <div class="order-actions">
                    ${order.status === 'pending' ? `
                        <button class="btn btn-success" onclick="updateOrderStatus('${order.id}', 'completed')">完成订单</button>
                    ` : ''}
                    <small style="color: #666;">${new Date(order.created_at).toLocaleString('zh-CN')}</small>
                </div>
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

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        if (response.ok) {
            showNotification('成功', '订单状态已更新');
        } else {
            showNotification('错误', '更新订单状态失败');
        }
    } catch (error) {
        console.error('更新订单状态失败:', error);
        showNotification('错误', '更新订单状态失败');
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        renderUsers(users);
    } catch (error) {
        console.error('加载用户失败:', error);
    }
}

function renderUsers(users) {
    const usersList = document.getElementById('users-list');
    
    usersList.innerHTML = users.filter(user => user.name !== 'admin').map(user => `
        <div class="user-card">
            <div>
                <div class="user-name">${user.name}</div>
                <div class="user-points">${user.points} 积分</div>
            </div>
            <div class="user-actions">
                <button class="btn btn-success" onclick="addPoints('${user.id}', 10)">+10积分</button>
                <button class="btn btn-success" onclick="addPoints('${user.id}', 50)">+50积分</button>
                <button class="btn btn-success" onclick="addPoints('${user.id}', 100)">+100积分</button>
            </div>
        </div>
    `).join('');
}

async function addPoints(userId, points) {
    try {
        const response = await fetch(`/api/users/${userId}/points`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ points, operation: 'add' })
        });
        
        if (response.ok) {
            loadUsers();
            showNotification('成功', `已为用户添加 ${points} 积分`);
        } else {
            showNotification('错误', '添加积分失败');
        }
    } catch (error) {
        console.error('添加积分失败:', error);
        showNotification('错误', '添加积分失败');
    }
}

function generateShareLink() {
    const shareUrl = window.location.origin + '/index.html';
    document.getElementById('share-url').value = shareUrl;
    
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;
    document.getElementById('qr-code').innerHTML = `<img src="${qrCodeUrl}" alt="分享二维码">`;
}

function copyShareLink() {
    const shareUrl = document.getElementById('share-url');
    shareUrl.select();
    document.execCommand('copy');
    showNotification('成功', '链接已复制到剪贴板');
}

function closeModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

function showNotification(title, message) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body: message });
    } else {
        alert(`${title}: ${message}`);
    }
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target === modal) {
        closeModal();
    }
}
