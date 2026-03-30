const express = require('express');
const sqlite3 = require('sqlite3').verbose();
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

const DATA_DIR = process.env.DATA_DIR || '.';
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'orders.db');

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

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('已连接到SQLite数据库: ' + DB_PATH);
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      points INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      items TEXT NOT NULL,
      total_points INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    )`);

    db.get("SELECT * FROM users WHERE name = 'admin'", (err, row) => {
      if (!row) {
        const adminId = uuidv4();
        db.run("INSERT INTO users (id, name, points) VALUES (?, ?, ?)", [adminId, 'admin', 999999]);
      }
    });
  });
}

app.post('/api/users', (req, res) => {
  const { name } = req.body;
  const userId = uuidv4();

  db.run("INSERT INTO users (id, name, points) VALUES (?, ?, ?)", [userId, name, 0], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ id: userId, name, points: 0 });
  });
});

app.get('/api/users', (req, res) => {
  db.all("SELECT * FROM users ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.post('/api/users/:id/points', (req, res) => {
  const { id } = req.params;
  const { points, operation } = req.body;

  const query = operation === 'add'
    ? "UPDATE users SET points = points + ? WHERE id = ?"
    : "UPDATE users SET points = ? WHERE id = ?";

  db.run(query, [points, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.post('/api/menu', upload.single('image'), (req, res) => {
  const { name, description, price } = req.body;
  const itemId = uuidv4();
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

  db.run("INSERT INTO menu_items (id, name, description, price, image_url) VALUES (?, ?, ?, ?, ?)",
    [itemId, name, description, parseInt(price), imageUrl], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ id: itemId, name, description, price: parseInt(price), image_url: imageUrl });
    });
});

app.get('/api/menu', (req, res) => {
  db.all("SELECT * FROM menu_items ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.put('/api/menu/:id', upload.single('image'), (req, res) => {
  const { id } = req.params;
  const { name, description, price } = req.body;
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.existing_image;

  db.run("UPDATE menu_items SET name = ?, description = ?, price = ?, image_url = ? WHERE id = ?",
    [name, description, parseInt(price), imageUrl, id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    });
});

app.delete('/api/menu/:id', (req, res) => {
  const { id } = req.params;

  db.run("DELETE FROM menu_items WHERE id = ?", [id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ success: true });
  });
});

app.post('/api/orders', (req, res) => {
  const { user_id, items } = req.body;
  const orderId = uuidv4();
  const totalPoints = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  db.get("SELECT points FROM users WHERE id = ?", [user_id], (err, user) => {
    if (err || !user || user.points < totalPoints) {
      return res.status(400).json({ error: '积分不足' });
    }

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      db.run("INSERT INTO orders (id, user_id, items, total_points) VALUES (?, ?, ?, ?)",
        [orderId, user_id, JSON.stringify(items), totalPoints]);

      items.forEach(item => {
        db.run("INSERT INTO order_items (id, order_id, menu_item_id, quantity, price) VALUES (?, ?, ?, ?, ?)",
          [uuidv4(), orderId, item.id, item.quantity, item.price]);
      });

      db.run("UPDATE users SET points = points - ? WHERE id = ?", [totalPoints, user_id]);

      db.run("COMMIT", (err) => {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: err.message });
        }

        io.emit('new_order', { order_id: orderId, user_id, items, total_points });
        res.json({ id: orderId, total_points: totalPoints });
      });
    });
  });
});

app.get('/api/orders', (req, res) => {
  db.all(`SELECT o.*, u.name as user_name
          FROM orders o
          JOIN users u ON o.user_id = u.id
          ORDER BY o.created_at DESC`, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  db.run("UPDATE orders SET status = ? WHERE id = ?", [status, id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    io.emit('order_status_update', { order_id: id, status });
    res.json({ success: true });
  });
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
