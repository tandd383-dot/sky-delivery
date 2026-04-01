let adminId = localStorage.getItem('adminId');
let newOrderCount = 0;
const socket = io();

socket.on('new_order', (data) => {
    newOrderCount++;
    document.getElementById('new-order-badge').classList.remove('hidden');
    document.getElementById('new-order-count').textContent = newOrderCount;
    loadOrders();
    loadStats();
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('小赖菜单 - 新订单', { body: `收到新订单，共${data.total_points}积分` });
    }
});

socket.on('order_status_update', () => { loadOrders(); loadStats(); });
socket.on('menu_updated', () => { loadMenu(); });
socket.on('user_points_update', () => { loadUsers(); });

document.addEventListener('DOMContentLoaded', function() {
    if (adminId) {
        document.getElementById('admin-login-page').classList.add('hidden');
        document.getElementById('admin-main').classList.remove('hidden');
        initAdmin();
    }

    document.getElementById('add-menu-form').addEventListener('submit', handleAddMenu);
    document.getElementById('edit-menu-form').addEventListener('submit', handleEditMenu);
    document.getElementById('menu-image').addEventListener('change', function(e) { previewImage(e, 'upload-preview', 'upload-text'); });
    document.getElementById('edit-menu-image').addEventListener('change', function(e) { previewImage(e, 'edit-upload-preview', 'edit-upload-text'); });
});

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 1800);
}

async function adminLogin() {
    const name = document.getElementById('admin-login-name').value.trim();
    const password = document.getElementById('admin-login-password').value;
    if (!name || !password) { showToast('请输入账号和密码'); return; }
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, password })
        });
        const data = await response.json();
        if (response.ok) {
            if (data.name !== 'admin') { showToast('仅管理员可登录'); return; }
            adminId = data.id;
            localStorage.setItem('adminId', data.id);
            document.getElementById('admin-login-page').classList.add('hidden');
            document.getElementById('admin-main').classList.remove('hidden');
            initAdmin();
            showToast('登录成功');
        } else {
            showToast(data.error || '登录失败');
        }
    } catch (error) { showToast('网络错误'); }
}

function adminLogout() {
    adminId = null;
    localStorage.removeItem('adminId');
    document.getElementById('admin-main').classList.add('hidden');
    document.getElementById('admin-login-page').classList.remove('hidden');
    document.getElementById('admin-login-password').value = '';
    showToast('已退出');
}

function initAdmin() {
    loadMenu();
    loadOrders();
    loadUsers();
    loadStats();
    initShareLinks();
}

function showTab(tabName, el) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    el.classList.add('active');
    document.getElementById(tabName + '-tab').classList.add('active');
    if (tabName === 'orders') {
        newOrderCount = 0;
        document.getElementById('new-order-badge').classList.add('hidden');
    }
    if (tabName === 'stats') loadStats();
}

function previewImage(e, previewId, textId) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(ev) {
            document.getElementById(previewId).src = ev.target.result;
            document.getElementById(previewId).classList.remove('hidden');
            document.getElementById(textId).classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
}

async function handleAddMenu(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('menu-name').value);
    formData.append('description', document.getElementById('menu-description').value);
    formData.append('price', document.getElementById('menu-price').value);
    formData.append('category', document.getElementById('menu-category').value);
    formData.append('spice_level', document.getElementById('menu-spice').value);
    formData.append('is_recommended', document.getElementById('menu-recommended').checked);
    const tasteStr = document.getElementById('menu-taste-options').value.trim();
    formData.append('taste_options', tasteStr ? JSON.stringify(tasteStr.split(/[,，]/).map(s => s.trim()).filter(Boolean)) : '[]');
    const imageFile = document.getElementById('menu-image').files[0];
    if (imageFile) formData.append('image', imageFile);
    try {
        const response = await fetch('/api/menu', { method: 'POST', body: formData });
        if (response.ok) {
            showToast('添加成功');
            e.target.reset();
            document.getElementById('upload-preview').classList.add('hidden');
            document.getElementById('upload-text').classList.remove('hidden');
            loadMenu();
        } else { showToast('添加失败'); }
    } catch (err) { showToast('网络错误'); }
}

async function handleEditMenu(e) {
    e.preventDefault();
    const formData = new FormData();
    formData.append('name', document.getElementById('edit-menu-name').value);
    formData.append('description', document.getElementById('edit-menu-description').value);
    formData.append('price', document.getElementById('edit-menu-price').value);
    formData.append('category', document.getElementById('edit-menu-category').value);
    formData.append('spice_level', document.getElementById('edit-menu-spice').value);
    formData.append('is_recommended', document.getElementById('edit-menu-recommended').checked);
    formData.append('is_available', document.getElementById('edit-menu-available').checked);
    formData.append('existing_image', document.getElementById('edit-existing-image').value);
    const tasteStr = document.getElementById('edit-menu-taste-options').value.trim();
    formData.append('taste_options', tasteStr ? JSON.stringify(tasteStr.split(/[,，]/).map(s => s.trim()).filter(Boolean)) : '[]');
    const imageFile = document.getElementById('edit-menu-image').files[0];
    if (imageFile) formData.append('image', imageFile);
    const id = document.getElementById('edit-menu-id').value;
    try {
        const response = await fetch(`/api/menu/${id}`, { method: 'PUT', body: formData });
        if (response.ok) { showToast('修改成功'); closeModal(); loadMenu(); }
        else { showToast('修改失败'); }
    } catch (err) { showToast('网络错误'); }
}

async function loadMenu() {
    try {
        const response = await fetch('/api/menu');
        renderMenu(await response.json());
    } catch (err) { console.error('加载菜单失败:', err); }
}

function renderMenu(items) {
    const menuList = document.getElementById('menu-list');
    if (items.length === 0) { menuList.innerHTML = '<div class="mt-empty"><div class="mt-empty-text">暂无菜品</div></div>'; return; }
    menuList.innerHTML = items.map(item => `
        <div class="admin-menu-item ${item.is_available === false ? 'item-sold-out' : ''}">
            <div class="admin-menu-img">
                ${item.image_url ? `<img src="${item.image_url}" alt="${item.name}">` : `<div class="admin-menu-img-placeholder">🍜</div>`}
                ${item.is_recommended ? '<div class="admin-badge-rec">荐</div>' : ''}
            </div>
            <div class="admin-menu-info">
                <div class="admin-menu-name">${item.name} ${item.is_available === false ? '<span class="sold-tag">售罄</span>' : ''}</div>
                <div class="admin-menu-desc">${item.description || ''}</div>
                <div class="admin-menu-meta">
                    <span class="admin-menu-price">${item.price}积分</span>
                    <span class="admin-menu-cat">${item.category || '主食'}</span>
                    ${item.sales_count > 0 ? `<span class="admin-menu-sales">已售${item.sales_count}</span>` : ''}
                </div>
            </div>
            <div class="admin-menu-actions">
                <button class="mt-btn mt-btn-sm mt-btn-primary" onclick="editMenuItem('${item.id}')">编辑</button>
                <button class="mt-btn mt-btn-sm mt-btn-danger" onclick="deleteMenuItem('${item.id}')">删除</button>
            </div>
        </div>`).join('');
}

function editMenuItem(id) {
    fetch('/api/menu').then(r => r.json()).then(items => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        document.getElementById('edit-menu-id').value = item.id;
        document.getElementById('edit-menu-name').value = item.name;
        document.getElementById('edit-menu-description').value = item.description || '';
        document.getElementById('edit-menu-price').value = item.price;
        document.getElementById('edit-menu-category').value = item.category || '主食';
        document.getElementById('edit-menu-spice').value = item.spice_level || '可选';
        document.getElementById('edit-menu-recommended').checked = item.is_recommended;
        document.getElementById('edit-menu-available').checked = item.is_available !== false;
        document.getElementById('edit-existing-image').value = item.image_url || '';
        let tasteOpts = [];
        try { tasteOpts = JSON.parse(item.taste_options || '[]'); } catch(e) {}
        document.getElementById('edit-menu-taste-options').value = tasteOpts.join('，');
        if (item.image_url) {
            document.getElementById('edit-upload-preview').src = item.image_url;
            document.getElementById('edit-upload-preview').classList.remove('hidden');
            document.getElementById('edit-upload-text').classList.add('hidden');
        } else {
            document.getElementById('edit-upload-preview').classList.add('hidden');
            document.getElementById('edit-upload-text').classList.remove('hidden');
        }
        document.getElementById('edit-modal').classList.remove('hidden');
    });
}

function closeModal() { document.getElementById('edit-modal').classList.add('hidden'); }

async function deleteMenuItem(id) {
    if (!confirm('确定删除这道菜吗？')) return;
    try {
        const response = await fetch(`/api/menu/${id}`, { method: 'DELETE' });
        if (response.ok) { showToast('已删除'); loadMenu(); }
    } catch (err) { showToast('删除失败'); }
}

async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        renderOrders(await response.json());
    } catch (err) { console.error('加载订单失败:', err); }
}

function renderOrders(orders) {
    const ordersList = document.getElementById('orders-list');
    if (orders.length === 0) { ordersList.innerHTML = '<div class="mt-empty"><div class="mt-empty-text">暂无订单</div></div>'; return; }
    ordersList.innerHTML = orders.map(order => {
        const items = JSON.parse(order.items);
        return `
            <div class="mt-order-card">
                <div class="mt-order-header">
                    <div><div class="mt-order-shop">👤 ${order.user_name || '未知用户'}</div><div class="admin-order-time">${new Date(order.created_at).toLocaleString('zh-CN')}</div></div>
                    <div class="mt-order-status ${order.status}">${order.status === 'pending' ? '待处理' : '已完成'}</div>
                </div>
                <div class="mt-order-body">
                    ${items.map(item => `<div class="mt-order-dish"><div><span class="mt-order-dish-name">${item.name} x${item.quantity}</span>${item.taste ? `<span class="order-taste-tag">${item.taste}</span>` : ''}</div><span class="mt-order-dish-price">${item.price * item.quantity}积分</span></div>`).join('')}
                    ${order.remark ? `<div class="order-remark">💬 备注：${order.remark}</div>` : ''}
                </div>
                <div class="mt-order-footer">
                    <span class="mt-order-total">共<span class="mt-order-total-num">${order.total_points}</span><span class="mt-order-total-unit">积分</span></span>
                    ${order.status === 'pending' ? `<button class="mt-btn mt-btn-sm mt-btn-success" onclick="completeOrder('${order.id}')">完成订单</button>` : ''}
                </div>
            </div>`;
    }).join('');
}

async function completeOrder(orderId) {
    try {
        const response = await fetch(`/api/orders/${orderId}/status`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'completed' })
        });
        if (response.ok) { showToast('订单已完成'); loadOrders(); loadStats(); }
    } catch (err) { showToast('操作失败'); }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        renderUsers(await response.json());
    } catch (err) { console.error('加载用户失败:', err); }
}

function renderUsers(users) {
    const usersList = document.getElementById('users-list');
    const normalUsers = users.filter(u => u.name !== 'admin');
    if (normalUsers.length === 0) { usersList.innerHTML = '<div class="mt-empty"><div class="mt-empty-text">暂无注册用户</div></div>'; return; }
    usersList.innerHTML = normalUsers.map(user => `
        <div class="admin-user-card">
            <div class="admin-user-avatar">${user.name.charAt(0).toUpperCase()}</div>
            <div class="admin-user-info">
                <div class="admin-user-name">${user.name}</div>
                <div class="admin-user-points">积分余额：${user.points}</div>
            </div>
            <div class="admin-user-actions">
                <input type="number" class="points-input" id="points-input-${user.id}" placeholder="积分" min="1" value="">
                <button class="mt-btn mt-btn-sm mt-btn-primary" onclick="addPointsFromInput('${user.id}')">充值</button>
            </div>
        </div>`).join('');
}

function addPointsFromInput(userId) {
    const input = document.getElementById('points-input-' + userId);
    const points = parseInt(input.value);
    if (!points || points <= 0) { showToast('请输入有效的积分数量'); return; }
    addPoints(userId, points);
    input.value = '';
}

async function addPoints(userId, points) {
    try {
        const response = await fetch(`/api/users/${userId}/points`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ points, operation: 'add' })
        });
        if (response.ok) { showToast(`已充值 ${points} 积分`); loadUsers(); }
        else { showToast('充值失败'); }
    } catch (err) { showToast('网络错误'); }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        document.getElementById('stat-total-orders').textContent = stats.total_orders;
        document.getElementById('stat-today-orders').textContent = stats.today_orders;
        document.getElementById('stat-total-users').textContent = stats.total_users;
        document.getElementById('stat-total-sales').textContent = stats.total_sales;
        const topItems = document.getElementById('top-items');
        if (stats.top_items.length === 0) { topItems.innerHTML = '<div class="mt-empty"><div class="mt-empty-text">暂无数据</div></div>'; }
        else {
            topItems.innerHTML = stats.top_items.map((item, idx) => `
                <div class="top-item">
                    <span class="top-item-rank">${idx + 1}</span>
                    <div class="top-item-info"><span class="top-item-name">${item.name}</span></div>
                    <span class="top-item-count">售出 ${item.total_qty} 份</span>
                </div>`).join('');
        }
    } catch (err) { console.error('加载统计失败:', err); }
}

function initShareLinks() {
    const base = window.location.origin;
    document.getElementById('share-url').value = base + '/index.html';
    document.getElementById('admin-url').value = base + '/admin.html';
    document.getElementById('qr-code').innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(base + '/index.html')}" alt="QR Code">`;
}

function copyShareLink() {
    const input = document.getElementById('share-url');
    input.select(); document.execCommand('copy'); showToast('用户链接已复制');
}

function copyAdminLink() {
    const input = document.getElementById('admin-url');
    input.select(); document.execCommand('copy'); showToast('管理员链接已复制');
}

function showPasswordModal() {
    document.getElementById('admin-old-password').value = '';
    document.getElementById('admin-new-password').value = '';
    document.getElementById('admin-new-password2').value = '';
    document.getElementById('password-modal').classList.remove('hidden');
}

function closePasswordModal() { document.getElementById('password-modal').classList.add('hidden'); }

async function adminChangePassword() {
    const oldPwd = document.getElementById('admin-old-password').value;
    const newPwd = document.getElementById('admin-new-password').value;
    const newPwd2 = document.getElementById('admin-new-password2').value;
    if (!oldPwd || !newPwd) { showToast('请填写完整'); return; }
    if (newPwd.length < 4) { showToast('新密码至少4个字符'); return; }
    if (newPwd !== newPwd2) { showToast('两次密码不一致'); return; }
    try {
        const response = await fetch(`/api/users/${adminId}/password`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password: oldPwd, new_password: newPwd })
        });
        const data = await response.json();
        if (response.ok) { showToast('密码修改成功'); closePasswordModal(); }
        else { showToast(data.error || '修改失败'); }
    } catch (error) { showToast('网络错误'); }
}
