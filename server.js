require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join('.', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10
});

async function initDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) DEFAULT '',
        points INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        price INT NOT NULL,
        image_url VARCHAR(500),
        category VARCHAR(50) DEFAULT '主食',
        is_available BOOLEAN DEFAULT true,
        is_recommended BOOLEAN DEFAULT false,
        spice_level VARCHAR(20) DEFAULT '可选',
        taste_options TEXT DEFAULT '[]',
        sales_count INT DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        items TEXT NOT NULL,
        total_points INT NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        remark TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        menu_item_id VARCHAR(64) NOT NULL,
        quantity INT NOT NULL,
        price INT NOT NULL,
        taste TEXT DEFAULT ''
      )
    `);

    const alterCols = [
      { table: 'users', col: 'password_hash', def: "VARCHAR(255) DEFAULT ''" },
      { table: 'menu_items', col: 'category', def: "VARCHAR(50) DEFAULT '主食'" },
      { table: 'menu_items', col: 'is_available', def: "BOOLEAN DEFAULT true" },
      { table: 'menu_items', col: 'is_recommended', def: "BOOLEAN DEFAULT false" },
      { table: 'menu_items', col: 'spice_level', def: "VARCHAR(20) DEFAULT '可选'" },
      { table: 'menu_items', col: 'taste_options', def: "TEXT DEFAULT '[]'" },
      { table: 'menu_items', col: 'sales_count', def: "INT DEFAULT 0" },
      { table: 'orders', col: 'remark', def: "TEXT DEFAULT ''" },
      { table: 'order_items', col: 'taste', def: "TEXT DEFAULT ''" }
    ];
    for (const ac of alterCols) {
      try {
        await pool.query(`ALTER TABLE ${ac.table} ADD COLUMN ${ac.col} ${ac.def}`);
      } catch (e) {
        if (!e.message.includes('already exists') && !e.message.includes('duplicate column')) {
          console.error(`Migration warning (${ac.table}.${ac.col}):`, e.message);
        }
      }
    }

    await pool.query("CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category)");

    const { rows: adminRows } = await pool.query("SELECT id, password_hash FROM users WHERE name = 'admin' LIMIT 1");
    if (adminRows.length === 0) {
      const adminId = uuidv4();
      const hash = await bcrypt.hash('123456', SALT_ROUNDS);
      await pool.query("INSERT INTO users (id, name, password_hash, points) VALUES ($1, $2, $3, $4)", [adminId, 'admin', hash, 999999]);
      console.log('管理员账号已创建 (admin / 123456)');
    } else if (!adminRows[0].password_hash) {
      const hash = await bcrypt.hash('123456', SALT_ROUNDS);
      await pool.query("UPDATE users SET password_hash = $1 WHERE name = 'admin'", [hash]);
      console.log('管理员密码已加密');
    }

    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    process.exit(1);
  }
}

initDatabase();

app.post('/api/register', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  if (name.length < 2 || name.length > 12) {
    return res.status(400).json({ error: '用户名长度2-12个字符' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: '密码至少4个字符' });
  }
  try {
    const { rows } = await pool.query("SELECT id FROM users WHERE name = $1 LIMIT 1", [name]);
    if (rows.length > 0) {
      return res.status(400).json({ error: '该用户名已被注册' });
    }
    const userId = uuidv4();
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query("INSERT INTO users (id, name, password_hash, points) VALUES ($1, $2, $3, $4)", [userId, name, hash, 0]);
    res.json({ id: userId, name, points: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { name, password } = req.body;
  if (!name || !password) {
    return res.status(400).json({ error: '请输入用户名和密码' });
  }
  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE name = $1 LIMIT 1", [name]);
    if (rows.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const user = rows[0];
    if (!user.password_hash) {
      return res.status(401).json({ error: '该账号未设置密码，请重新注册' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    res.json({ id: user.id, name: user.name, points: user.points });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { name } = req.body;
  try {
    const { rows } = await pool.query("SELECT id, name, points FROM users WHERE name = $1 LIMIT 1", [name]);
    if (rows.length > 0) {
      return res.json(rows[0]);
    }
    res.status(404).json({ error: '用户不存在' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id, name, points, created_at FROM users ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id/password', async (req, res) => {
  const { id } = req.params;
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) {
    return res.status(400).json({ error: '请输入旧密码和新密码' });
  }
  if (new_password.length < 4) {
    return res.status(400).json({ error: '新密码至少4个字符' });
  }
  try {
    const { rows } = await pool.query("SELECT password_hash FROM users WHERE id = $1", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }
    const match = await bcrypt.compare(old_password, rows[0].password_hash);
    if (!match) {
      return res.status(401).json({ error: '旧密码错误' });
    }
    const hash = await bcrypt.hash(new_password, SALT_ROUNDS);
    await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/:id/points', async (req, res) => {
  const { id } = req.params;
  const { points, operation } = req.body;
  const query = operation === 'add'
    ? "UPDATE users SET points = points + $1 WHERE id = $2"
    : "UPDATE users SET points = $1 WHERE id = $2";
  try {
    await pool.query(query, [points, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/menu', upload.single('image'), async (req, res) => {
  const { name, description, price, category, spice_level, taste_options, is_recommended } = req.body;
  const itemId = uuidv4();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
  try {
    await pool.query(
      `INSERT INTO menu_items (id, name, description, price, image_url, category, spice_level, taste_options, is_recommended)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [itemId, name, description, parseInt(price), imageUrl,
       category || '主食', spice_level || '可选',
       taste_options || '[]', is_recommended === 'true' || is_recommended === true]
    );
    res.json({ id: itemId, name, description, price: parseInt(price), image_url: imageUrl, category: category || '主食' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/menu', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM menu_items ORDER BY is_recommended DESC, sales_count DESC, created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, spice_level, taste_options, is_available, is_recommended } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image;
  try {
    await pool.query(
      `UPDATE menu_items SET name=$1, description=$2, price=$3, image_url=$4, category=$5,
       spice_level=$6, taste_options=$7, is_available=$8, is_recommended=$9 WHERE id=$10`,
      [name, description, parseInt(price), imageUrl,
       category || '主食', spice_level || '可选', taste_options || '[]',
       is_available !== 'false' && is_available !== false,
       is_recommended === 'true' || is_recommended === true, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id/toggle', async (req, res) => {
  const { id } = req.params;
  const { field } = req.body;
  try {
    await pool.query(`UPDATE menu_items SET ${field} = NOT ${field} WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM menu_items WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/orders', async (req, res) => {
  const { user_id, items, remark } = req.body;
  const orderId = uuidv4();
  const totalPoints = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query("SELECT points FROM users WHERE id = $1 FOR UPDATE", [user_id]);
    if (rows.length === 0 || rows[0].points < totalPoints) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '积分不足' });
    }
    await client.query(
      "INSERT INTO orders (id, user_id, items, total_points, remark) VALUES ($1, $2, $3, $4, $5)",
      [orderId, user_id, JSON.stringify(items), totalPoints, remark || '']
    );
    for (const item of items) {
      await client.query(
        "INSERT INTO order_items (id, order_id, menu_item_id, quantity, price, taste) VALUES ($1, $2, $3, $4, $5, $6)",
        [uuidv4(), orderId, item.id, item.quantity, item.price, item.taste || '']
      );
      await client.query("UPDATE menu_items SET sales_count = sales_count + $1 WHERE id = $2", [item.quantity, item.id]);
    }
    await client.query("UPDATE users SET points = points - $1 WHERE id = $2", [totalPoints, user_id]);
    await client.query('COMMIT');
    io.emit('new_order', { order_id: orderId, user_id, items, total_points: totalPoints, remark });
    res.json({ id: orderId, total_points: totalPoints });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, u.name as user_name
       FROM orders o JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
    io.emit('order_status_update', { order_id: id, status });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const totalOrders = await pool.query("SELECT COUNT(*) as count FROM orders");
    const todayOrders = await pool.query("SELECT COUNT(*) as count FROM orders WHERE created_at >= CURRENT_DATE");
    const totalUsers = await pool.query("SELECT COUNT(*) as count FROM users WHERE name != 'admin'");
    const totalSales = await pool.query("SELECT COALESCE(SUM(total_points), 0) as total FROM orders");
    const topItems = await pool.query(
      `SELECT mi.name, mi.image_url, SUM(oi.quantity) as total_qty
       FROM order_items oi JOIN menu_items mi ON oi.menu_item_id = mi.id
       GROUP BY mi.id, mi.name, mi.image_url ORDER BY total_qty DESC LIMIT 5`
    );
    res.json({
      total_orders: parseInt(totalOrders.rows[0].count),
      today_orders: parseInt(todayOrders.rows[0].count),
      total_users: parseInt(totalUsers.rows[0].count),
      total_sales: parseInt(totalSales.rows[0].total),
      top_items: topItems.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('新客户端连接');
  socket.on('disconnect', () => {
    console.log('客户端断开连接');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`小赖菜单服务器运行在 http://localhost:${PORT}`);
});
