# 好友点餐系统

简易版好友点餐工具，模仿美团风格，支持好友之间通过积分点餐。使用阿里云 RDS MySQL 存储数据。

## 功能

- 菜单管理：添加/编辑/删除菜品，支持图片上传
- 积分系统：管理员为好友分配积分
- 购物车：美团风格底部浮动购物车
- 订单管理：实时订单推送，订单状态管理
- 分享功能：生成链接和二维码

## 技术栈

- Node.js + Express
- **阿里云 RDS MySQL**（mysql2 连接池）
- Socket.io（实时通信）
- 原生 HTML/CSS/JS（美团风格UI）

## 数据库配置

项目使用 MySQL，支持阿里云 RDS 免费版或任何 MySQL 5.7+ 数据库。

### 1. 创建阿里云免费 RDS

1. 登录 [阿里云 RDS](https://rds.aliyuncs.com/)
2. 创建 MySQL 实例（选择免费试用或基础版）
3. 创建数据库 `friend_order`
4. 设置白名单（允许 0.0.0.0/0 或你的服务器 IP）
5. 创建数据库账号和密码

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，填入你的数据库信息：

```bash
DB_HOST=rm-xxx.mysql.rds.aliyuncs.com
DB_PORT=3306
DB_USER=your_username
DB_PASSWORD=your_password
DB_NAME=friend_order
PORT=3000
```

> 项目启动时会自动创建所需的表，无需手动建表。

## 本地运行

```bash
npm install
npm start
```

- 管理员后台：http://localhost:3000/admin.html
- 好友点餐：http://localhost:3000/index.html

## 部署到 Render.com（免费）

1. 注册 [Render.com](https://render.com/)
2. 点击 **New** → **Web Service**
3. 连接你的仓库
4. 配置：
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
5. 添加环境变量（在 Environment 中）：
   - `DB_HOST` = 你的 RDS 地址
   - `DB_PORT` = 3306
   - `DB_USER` = 数据库用户名
   - `DB_PASSWORD` = 数据库密码
   - `DB_NAME` = friend_order
6. 开启 **Persistent Disk**（用于图片上传存储）
7. 点击 **Create Web Service**

## 使用 Docker 部署

```bash
docker build -t friend-order .
docker run -p 3000:3000 \
  -e DB_HOST=rm-xxx.mysql.rds.aliyuncs.com \
  -e DB_USER=root \
  -e DB_PASSWORD=your_password \
  -e DB_NAME=friend_order \
  -v ./uploads:/app/uploads \
  friend-order
```

## 数据库表结构

项目启动时自动创建以下表：

| 表名 | 说明 |
|------|------|
| `users` | 用户表（id, name, points, created_at） |
| `menu_items` | 菜品表（id, name, description, price, image_url, created_at） |
| `orders` | 订单表（id, user_id, items, total_points, status, created_at） |
| `order_items` | 订单详情表（id, order_id, menu_item_id, quantity, price） |
