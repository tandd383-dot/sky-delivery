const socket = io();

document.addEventListener('DOMContentLoaded', function() {
    loadMenu();
    loadOrders();
    loadUsers();
    generateShareLinks();

    document.getElementById('add-menu-form').addEventListener('submit', addMenuItem);
    document.getElementById('edit-menu-form').addEventListener('submit', updateMenuItem);

    document.getElementById('menu-image').addEventListener('change', function(e) {
        previewImage(e.target, 'upload-preview', 'upload-text');
    });
    document.getElementById('edit-menu-image').addEventListener('change', function(e) {
        previewImage(e.target, 'edit-upload-preview', 'edit-upload-text');
    });

    socket.on('new_order', function(data) {
        loadOrders();
        showToast('🔔 新订单提醒');
    });

    socket.on('order_status_update', function(data) {
        loadOrders();
    });
});

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 1800);
}

function previewImage(input, previewId, textId) {
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById(previewId);
            preview.src = e.target.result;
            preview.classList.remove('hidden');
            document.getElementById(textId).classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

function showTab(tabName, el) {
    document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(tabName + '-tab').classList.add('active');
    el.classList.add('active');
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
            <div class="mt-empty" style="padding:30px;">
                <div class="mt-empty-icon">📋</div>
                <div class="mt-empty-text">暂无菜品，快去添加吧</div>
            </div>`;
        return;
    }

    menuList.innerHTML = menuItems.map(item => `
        <div class="admin-menu-item">
            <div class="admin-menu-img">
                ${item.image_url
                    ? `<img src="${item.image_url}" alt="${item.name}">`
                    : `<div class="admin-menu-img-placeholder">🍜</div>`
                }
            </div>
            <div class="admin-menu-info">
                <div class="admin-menu-name">${item.name}</div>
                ${item.description ? `<div class="admin-menu-desc">${item.description}</div>` : ''}
                <div class="admin-menu-price">${item.price} 积分</div>
            </div>
            <div class="admin-menu-actions">
                <button class="mt-btn mt-btn-sm" style="background:#f0f0f0;color:#333;" onclick="editMenuItem('${item.id}')">编辑</button>
                <button class="mt-btn mt-btn-sm mt-btn-danger" onclick="deleteMenuItem('${item.id}')">删除</button>
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
            document.getElementById('upload-preview').classList.add('hidden');
            document.getElementById('upload-text').classList.remove('hidden');
            loadMenu();
            showToast('添加成功');
        } else {
            showToast('添加失败');
        }
    } catch (error) {
        console.error('添加菜品失败:', error);
        showToast('网络错误');
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

                if (item.image_url) {
                    document.getElementById('edit-upload-preview').src = item.image_url;
                    document.getElementById('edit-upload-preview').classList.remove('hidden');
                    document.getElementById('edit-upload-text').classList.add('hidden');
                } else {
                    document.getElementById('edit-upload-preview').classList.add('hidden');
                    document.getElementById('edit-upload-text').classList.remove('hidden');
                }

                document.getElementById('edit-modal').classList.remove('hidden');
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
            showToast('更新成功');
        } else {
            showToast('更新失败');
        }
    } catch (error) {
        console.error('更新菜品失败:', error);
        showToast('网络错误');
    }
}

async function deleteMenuItem(itemId) {
    if (!confirm('确定删除这个菜品？')) return;

    try {
        const response = await fetch(`/api/menu/${itemId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadMenu();
            showToast('已删除');
        } else {
            showToast('删除失败');
        }
    } catch (error) {
        console.error('删除菜品失败:', error);
        showToast('网络错误');
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
        ordersList.innerHTML = `
            <div class="mt-empty" style="padding:30px;">
                <div class="mt-empty-icon">📦</div>
                <div class="mt-empty-text">暂无订单</div>
            </div>`;
        return;
    }

    ordersList.innerHTML = orders.map(order => {
        const items = JSON.parse(order.items);
        return `
            <div class="mt-order-card">
                <div class="mt-order-header">
                    <div class="mt-order-shop">👤 ${order.user_name}</div>
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
                ${order.status === 'pending' ? `
                    <div class="admin-order-actions">
                        <button class="mt-btn mt-btn-sm mt-btn-success" onclick="updateOrderStatus('${order.id}', 'completed')">✓ 完成订单</button>
                    </div>
                ` : ''}
            </div>`;
    }).join('');
}

function getStatusText(status) {
    const map = { 'pending': '待处理', 'completed': '已完成' };
    return map[status] || status;
}

async function updateOrderStatus(orderId, status) {
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        if (response.ok) {
            showToast('订单已完成');
        } else {
            showToast('操作失败');
        }
    } catch (error) {
        console.error('更新订单状态失败:', error);
        showToast('网络错误');
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
    const normalUsers = users.filter(user => user.name !== 'admin');

    if (normalUsers.length === 0) {
        usersList.innerHTML = `
            <div class="mt-empty" style="padding:30px;">
                <div class="mt-empty-icon">👥</div>
                <div class="mt-empty-text">暂无用户，分享链接给好友吧</div>
            </div>`;
        return;
    }

    usersList.innerHTML = normalUsers.map(user => `
        <div class="admin-user-card">
            <div class="admin-user-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div class="admin-user-info">
                <div class="admin-user-name">${user.name}</div>
                <div class="admin-user-points">积分余额：${user.points}</div>
            </div>
            <div class="admin-user-actions">
                <button class="mt-btn mt-btn-sm mt-btn-primary" onclick="addPoints('${user.id}', 10)">+10</button>
                <button class="mt-btn mt-btn-sm mt-btn-primary" onclick="addPoints('${user.id}', 50)">+50</button>
                <button class="mt-btn mt-btn-sm mt-btn-primary" onclick="addPoints('${user.id}', 100)">+100</button>
            </div>
        </div>
    `).join('');
}

async function addPoints(userId, points) {
    try {
        const response = await fetch(`/api/users/${userId}/points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points, operation: 'add' })
        });

        if (response.ok) {
            loadUsers();
            showToast(`+${points} 积分`);
        } else {
            showToast('操作失败');
        }
    } catch (error) {
        console.error('添加积分失败:', error);
        showToast('网络错误');
    }
}

function generateShareLinks() {
    const baseUrl = window.location.origin;
    document.getElementById('share-url').value = baseUrl + '/index.html';
    document.getElementById('admin-url').value = baseUrl + '/admin.html';

    const shareUrl = baseUrl + '/index.html';
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`;
    document.getElementById('qr-code').innerHTML = `<img src="${qrCodeUrl}" alt="分享二维码">`;
}

function copyShareLink() {
    const input = document.getElementById('share-url');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        showToast('链接已复制');
    }).catch(() => {
        document.execCommand('copy');
        showToast('链接已复制');
    });
}

function copyAdminLink() {
    const input = document.getElementById('admin-url');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
        showToast('管理员链接已复制');
    }).catch(() => {
        document.execCommand('copy');
        showToast('管理员链接已复制');
    });
}

function closeModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

document.getElementById('edit-modal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}
