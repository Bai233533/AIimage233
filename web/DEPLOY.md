# AI漫剧大师 Web版 - 部署说明

## 项目结构

```
web/
├── api/                    # 后端API（Vercel Serverless Functions）
│   ├── index.js           # API路由入口
│   ├── config.js          # 配置文件
│   ├── db.js              # 数据库层（内存存储）
│   ├── auth.js            # 认证API（登录/注册/会员）
│   └── ai.js              # AI API（豆包调用）
├── css/                   # 样式文件
│   └── style.css
├── js/                    # 前端JavaScript
│   ├── api.js             # API调用封装
│   ├── app.js             # 主应用逻辑
│   ├── store.js           # 本地存储管理
│   ├── ui.js              # UI组件
│   └── pages/             # 页面组件
│       ├── home.js
│       ├── chat.js
│       ├── profile.js
│       └── history.js
├── index.html             # 入口HTML
├── package.json           # 依赖配置
├── vercel.json            # Vercel部署配置
└── DEPLOY.md              # 本文档
```

## 快速部署到Vercel

### 1. 安装Vercel CLI

```bash
npm install -g vercel
```

### 2. 登录Vercel

```bash
vercel login
```

### 3. 进入web目录并部署

```bash
cd web
vercel
```

按照提示操作：
- Set up and deploy? → `Y`
- Which scope? → 选择你的账号
- Link to existing project? → `N`
- Project name: → `ai-drama-master`（或自定义名称）
- Directory where code is located? → `./`

### 4. 设置环境变量

部署完成后，在Vercel控制台设置环境变量：

```bash
vercel env add DOUBAO_API_KEY
vercel env add SEEDREAM_API_KEY
vercel env add JWT_SECRET
vercel env add ADMIN_SECRET
```

或者在Vercel控制台的 Settings → Environment Variables 中添加：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| DOUBAO_API_KEY | 豆包AI对话API密钥 | ark-xxxx |
| SEEDREAM_API_KEY | 豆包生图API密钥 | ark-xxxx |
| JWT_SECRET | JWT密钥（用于生成token） | 任意随机字符串 |
| ADMIN_SECRET | 管理员密钥 | ADMIN_2026 |

### 5. 生产部署

```bash
vercel --prod
```

## 本地开发

### 1. 安装依赖

```bash
cd web
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 注意事项

### 数据库
当前使用内存存储，重启后数据会丢失。生产环境建议：
- 使用 [Turso](https://turso.tech/)（SQLite兼容的边缘数据库）
- 或使用 [Vercel KV](https://vercel.com/docs/storage/vercel-kv)（Redis）

### API密钥安全
- API密钥已配置在后端，前端不会暴露
- 请确保 `.env` 文件不要提交到Git

### 功能说明
- ✅ 用户注册/登录
- ✅ 会员系统（卡密兑换）
- ✅ AI对话
- ✅ 图片生成（文生图/图生图）
- ✅ 分镜提示词生成
- ✅ 对话历史保存（本地存储）
- ⏳ 云盘功能（待开发）

## 测试卡密

开发环境提供以下测试卡密：
- `VIP-TEST-1234`
- `VIP-DEMO-5678`
