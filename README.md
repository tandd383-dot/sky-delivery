# 好友点餐系统

简易版好友点餐工具，模仿美团风格，支持好友之间通过积分点餐。

## 功能

- 菜单管理：添加/编辑/删除菜品，支持图片上传
- 积分系统：管理员为好友分配积分
- 购物车：美团风格底部浮动购物车
- 订单管理：实时订单推送，订单状态管理
- 分享功能：生成链接和二维码

## 本地运行

```bash
npm install
npm start
```

- 管理员后台：http://localhost:3000/admin.html
- 好友点餐：http://localhost:3000/index.html

## 部署到 Render.com（免费，推荐）

这是最简单的免费部署方案，部署后任何人都可以通过链接访问。

### 步骤

1. 注册 [Render.com](https://render.com/) 账号
2. 点击 **New** → **Web Service**
3. 连接你的 Gitee 仓库（或 GitHub 镜像）
4. 配置如下：
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment**: 添加 `DATA_DIR=/opt/render/project/src/data`
5. 在 **Advanced** 中开启 **Persistent Disk**（1GB 免费）
6. 点击 **Create Web Service**

部署完成后你会得到一个公网地址，例如 `https://friend-order-xxx.onrender.com`

> 好友点餐链接：`https://你的域名/index.html`
> 管理员链接：`https://你的域名/admin.html`

## 部署到 Railway（免费）

1. 注册 [Railway.app](https://railway.app/)
2. 新建项目 → Deploy from GitHub repo
3. 添加环境变量 `DATA_DIR=/app/data`
4. 添加 Volume 挂载到 `/app/data`
5. 自动部署完成

## 使用 Docker 部署

```bash
docker build -t friend-order .
docker run -p 3000:3000 -v ./data:/app/data friend-order
```

## 技术栈

- Node.js + Express
- SQLite
- Socket.io（实时通信）
- 原生 HTML/CSS/JS（美团风格UI）
