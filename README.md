# 好友点餐小程序 - 部署和使用指南

## 项目简介

这是一个简易版好友点餐系统，支持好友之间通过积分进行点餐。管理员可以创建菜单、分配积分、查看订单，用户可以浏览菜单、使用积分下单。

## 功能特性

- ✅ 菜单管理：添加、编辑、删除菜品，支持图片上传
- ✅ 积分系统：管理员可为用户分配积分，用户使用积分点餐
- ✅ 订单管理：实时查看订单，更新订单状态
- ✅ 用户管理：查看用户信息，管理用户积分
- ✅ 分享功能：生成分享链接和二维码
- ✅ 实时同步：订单实时推送，无需刷新页面
- ✅ 移动端友好：响应式设计，适配各种设备

## 技术栈

**后端：**
- Node.js + Express
- SQLite（轻量级数据库）
- Socket.io（实时通信）
- Multer（文件上传）

**前端：**
- 原生HTML/CSS/JavaScript
- Socket.io Client（实时通信）

## 环境要求

- Node.js 14.0 或更高版本
- npm 或 yarn 包管理器
- 现代浏览器（Chrome、Firefox、Safari、Edge）

## 安装步骤

### 1. 安装 Node.js

访问 [Node.js 官网](https://nodejs.org/) 下载并安装最新 LTS 版本。

验证安装：
```bash
node --version
npm --version
```

### 2. 克隆或下载项目

**从 Gitee 克隆：**
```bash
git clone https://gitee.com/你的用户名/friend-order-app.git
cd friend-order-app
```

**或者直接下载 ZIP 文件：**
1. 访问你的 Gitee 仓库
2. 点击"克隆/下载"按钮
3. 选择"下载 ZIP"
4. 解压到本地目录

### 3. 安装依赖

在项目根目录执行：
```bash
npm install
```

### 4. 创建必要的目录

```bash
mkdir uploads
```

## 运行项目

### 开发模式（自动重启）

```bash
npm run dev
```

### 生产模式

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

## 使用指南

### 管理员端

访问 `http://localhost:3000/admin.html`

**功能：**
1. **菜单管理**
   - 添加新菜品（名称、描述、价格、图片）
   - 编辑现有菜品
   - 删除菜品

2. **订单管理**
   - 实时查看所有订单
   - 更新订单状态（待处理/已完成）
   - 查看订单详情

3. **用户管理**
   - 查看所有用户及其积分
   - 为用户分配积分（+10、+50、+100）

4. **分享功能**
   - 复制分享链接
   - 查看二维码

### 用户端

访问 `http://localhost:3000/index.html`

**功能：**
1. **登录**
   - 输入用户名开始点餐

2. **浏览菜单**
   - 查看所有菜品
   - 查看菜品详情和价格

3. **购物车**
   - 添加菜品到购物车
   - 修改数量
   - 删除菜品
   - 查看总积分

4. **下单**
   - 提交订单（自动扣除积分）
   - 查看我的订单

## 部署到 Gitee

### 1. 创建 Gitee 仓库

1. 登录 [Gitee](https://gitee.com/)
2. 点击右上角 "+" 按钮
3. 选择"新建仓库"
4. 填写仓库信息：
   - 仓库名称：friend-order-app
   - 仓库介绍：简易好友点餐小程序
   - 是否公开：公开
5. 点击"创建"

### 2. 初始化 Git 仓库

在项目根目录执行：

```bash
git init
git add .
git commit -m "初始化项目"
```

### 3. 关联远程仓库

```bash
git remote add origin https://gitee.com/你的用户名/friend-order-app.git
```

### 4. 推送到 Gitee

```bash
git branch -M main
git push -u origin main
```

### 5. 配置 Gitee Pages（可选）

如果需要通过 Gitee Pages 部署前端：

1. 进入仓库设置
2. 选择"Gitee Pages"
3. 启用 Gitee Pages 服务
4. 选择部署分支：main
5. 点击"启动"

**注意：** Gitee Pages 只能部署静态文件，后端服务需要单独部署到服务器。

## 服务器部署

### 使用云服务器（推荐）

1. 购买云服务器（阿里云、腾讯云等）
2. 安装 Node.js 环境
3. 上传项目文件到服务器
4. 安装依赖：`npm install`
5. 使用 PM2 管理进程：

```bash
npm install -g pm2
pm2 start server.js --name friend-order-app
pm2 save
pm2 startup
```

6. 配置 Nginx 反向代理（可选）

### 使用免费云服务

**Render.com：**
1. 创建账号
2. 新建 Web Service
3. 连接 Gitee 仓库
4. 配置构建命令：`npm install`
5. 配置启动命令：`node server.js`
6. 部署

**Railway.app：**
1. 创建账号
2. 新建项目
3. 选择"Deploy from GitHub repo"
4. 连接 Gitee 仓库
5. 自动部署

## 数据库说明

项目使用 SQLite 数据库，数据文件为 `orders.db`，包含以下表：

- `users`：用户表（ID、姓名、积分）
- `menu_items`：菜单表（ID、名称、描述、价格、图片）
- `orders`：订单表（ID、用户ID、订单项、总积分、状态）
- `order_items`：订单详情表（ID、订单ID、菜品ID、数量、价格）

**数据备份：**
定期备份 `orders.db` 文件即可。

## 常见问题

### 1. 端口被占用

修改 `server.js` 中的端口号：
```javascript
const PORT = process.env.PORT || 3001; // 改为其他端口
```

### 2. 图片上传失败

确保 `uploads` 目录存在且有写入权限：
```bash
mkdir uploads
chmod 755 uploads
```

### 3. 实时订单不更新

检查 Socket.io 连接：
- 打开浏览器控制台
- 查看是否有连接错误
- 确保防火墙允许 WebSocket 连接

### 4. 积分不足

管理员需要在"用户管理"页面为用户分配积分。

## 项目结构

```
friend-order-app/
├── server.js              # 后端服务器
├── package.json           # 项目配置
├── orders.db             # SQLite 数据库
├── uploads/              # 上传的图片
├── public/               # 前端文件
│   ├── admin.html        # 管理员页面
│   ├── index.html        # 用户页面
│   ├── styles.css        # 样式文件
│   ├── admin.js          # 管理员脚本
│   └── user.js           # 用户脚本
└── README.md             # 说明文档
```

## 安全建议

1. 不要将 `orders.db` 提交到公开仓库
2. 在生产环境中使用环境变量管理配置
3. 添加用户认证和权限管理
4. 定期备份数据库
5. 使用 HTTPS 加密传输

## 技术支持

如有问题，请：
1. 查看本文档的"常见问题"部分
2. 检查浏览器控制台错误信息
3. 查看服务器日志

## 许可证

MIT License

## 更新日志

### v1.0.0 (2024-03-30)
- 初始版本发布
- 实现核心功能：菜单管理、订单管理、积分系统
- 支持实时订单同步
- 移动端响应式设计
