# 好友点餐系统

简易版好友点餐工具，模仿美团风格，支持好友之间通过积分点餐。使用 Neon PostgreSQL（免费）存储数据。

## 功能

- 菜单管理：添加/编辑/删除菜品，支持图片上传
- 积分系统：管理员为好友分配积分
- 购物车：美团风格底部浮动购物车
- 订单管理：实时订单推送，订单状态管理
- 分享功能：生成链接和二维码

## 技术栈

- Node.js + Express
- **Neon PostgreSQL**（免费 0.5GB）
- Socket.io（实时通信）
- 原生 HTML/CSS/JS（美团风格UI）

## 快速开始

### 1. 创建 Neon 免费数据库

1. 打开 https://neon.tech → 用 GitHub 登录
2. 点击「Create Project」
3. Name: `friend-order`，Region: 选离你最近的
4. 创建完成后，点击「Connect」→ 选「Node.js」
5. 复制连接字符串

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```bash
DATABASE_URL=postgresql://neondb_owner:你的密码@ep-xxx.aws.neon.tech/neondb?sslmode=require
PORT=3000
```

### 3. 运行

```bash
npm install
npm start
```

- 管理员后台：http://localhost:3000/admin.html
- 好友点餐：http://localhost:3000/index.html

> 项目启动时会自动创建所需的表，无需手动建表。

## 部署到 Render.com（免费）

1. 注册 https://render.com/
2. New → Web Service → 连接 GitHub 仓库
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. 环境变量: `DATABASE_URL` = 你的 Neon 连接字符串
6. 开启 Persistent Disk（用于图片上传）
7. 部署完成后获得公网地址，分享给朋友即可

## Neon 免费额度

| 资源 | 免费额度 |
|------|---------|
| 数据库空间 | 0.5GB |
| 计算 | 每月 300 小时 |
| 存储 | 1GB |
| **费用** | **$0，永久免费** |
