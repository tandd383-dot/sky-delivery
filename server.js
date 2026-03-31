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
        name VARCHAR(50) NOT NULL,
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
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL,
        menu_item_id VARCHAR(64) NOT NULL,
        quantity INT NOT NULL,
        price INT NOT NULL
      )
    `);

    await pool.query("CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)");
    await pool.query("CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id)");

    const { rows } = await pool.query("SELECT id FROM users WHERE name = 'admin' LIMIT 1");
    if (rows.length === 0) {
      const adminId = uuidv4();
      await pool.query("INSERT INTO users (id, name, points) VALUES ($1, $2, $3)", [adminId, 'admin', 999999]);
    }

    console.log('数据库初始化完成');
  } catch (err) {
    console.error('数据库初始化失败:', err.message);
    console.error('请检查 DATABASE_URL 配置是否正确');
    console.error('当前 DATABASE_URL:', process.env.DATABASE_URL ? '已设置(***隐藏***)' : '未设置');
    process.exit(1);
  }
}

initDatabase();

app.post('/api/users', async (req, res) => {
  const { name } = req.body;

  try {
    const { rows } = await pool.query("SELECT * FROM users WHERE name = $1 LIMIT 1", [name]);
    if (rows.length > 0) {
      return res.json(rows[0]);
    }

    const userId = uuidv4();
    await pool.query("INSERT INTO users (id, name, points) VALUES ($1, $2, $3)", [userId, name, 0]);
    res.json({ id: userId, name, points: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
    res.json(rows);
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
  const { name, description, price } = req.body;
  const itemId = uuidv4();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    await pool.query(
      "INSERT INTO menu_items (id, name, description, price, image_url) VALUES ($1, $2, $3, $4, $5)",
      [itemId, name, description, parseInt(price), imageUrl]
    );
    res.json({ id: itemId, name, description, price: parseInt(price), image_url: imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/menu', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM menu_items ORDER BY created_at DESC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/menu/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image;

  try {
    await pool.query(
      "UPDATE menu_items SET name = $1, description = $2, price = $3, image_url = $4 WHERE id = $5",
      [name, description, parseInt(price), imageUrl, id]
    );
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
  const { user_id, items } = req.body;
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
      "INSERT INTO orders (id, user_id, items, total_points) VALUES ($1, $2, $3, $4)",
      [orderId, user_id, JSON.stringify(items), totalPoints]
    );

    for (const item of items) {
      await client.query(
        "INSERT INTO order_items (id, order_id, menu_item_id, quantity, price) VALUES ($1, $2, $3, $4, $5)",
        [uuidv4(), orderId, item.id, item.quantity, item.price]
      );
    }

    await client.query("UPDATE users SET points = points - $1 WHERE id = $2", [totalPoints, user_id]);

    await client.query('COMMIT');

    io.emit('new_order', { order_id: orderId, user_id, items, total_points });
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
       FROM orders o
       JOIN users u ON o.user_id = u.id
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

io.on('connection', (socket) => {
  console.log('新客户端连接');
  socket.on('disconnect', () => {
    console.log('客户端断开连接');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});
