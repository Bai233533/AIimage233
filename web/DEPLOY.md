# AI漫剧大师 Web版 - Cloudflare Pages 部署指南

## 项目结构

```
web/
├── d1-schema.sql                  # D1 数据库建表脚本（先在控制台执行）
├── _routes.json                   # Cloudflare Pages Functions 路由配置
├── index.html                     # 前端入口
├── admin.html                     # 卡密管理后台
├── css/
│   └── style.css
├── js/
│   ├── api.js                     # API 调用封装
│   ├── app.js                     # 主应用
│   ├── auth.js                    # 共享认证模块
│   ├── store.js                   # 本地存储
│   ├── ui.js                      # UI 组件
│   └── pages/
│       ├── home.js                # 首页（对话列表）
│       ├── chat.js                # 核心页（AI对话/生图）
│       ├── history.js             # 生成历史
│       └── profile.js             # 个人中心
├── functions/                     # Cloudflare Pages Functions
│   └── api/
│       └── [[route]].js           # 所有 /api/* 路由（D1 + 豆包 AI）
├── package.json
├── wrangler.toml
└── DEPLOY.md
```

## 一、准备工作

| 项目 | 状态 |
|------|------|
| Cloudflare 账号 | 已登录 |
| GitHub 仓库 | https://github.com/Bai233533/AIimage233.git |
| D1 数据库 | "AI-戏剧-数据库"（需要执行建表 SQL） |

## 二、D1 数据库建表（关键步骤）

1. 打开 https://dash.cloudflare.com/
2. 左侧菜单 **存储与数据库** → **D1 SQL 数据库**
3. 点击 **AI-戏剧-数据库**
4. 切到 **Console** 标签
5. 复制 `web/d1-schema.sql` 全部内容粘贴进去
6. 点击 **执行**
7. 看到 "users 表" 和 "card_keys 表" 即成功

> 这一步必须先做！否则 API 调用时会报 "no such table" 错误

## 三、Cloudflare Pages 部署

### 3.1 创建 Pages 项目

1. Cloudflare 控制台 → **Workers 和 Pages**
2. 点击 **创建** → **Pages** → **连接到 Git**
3. 选择 **GitHub** → 授权 Cloudflare
4. 选择仓库 **Bai233533/AIimage233**
5. 点击 **开始设置**

### 3.2 配置构建设置

| 配置项 | 值 |
|--------|-----|
| 项目名称 | `ai-drama-master`（或自定义） |
| 生产分支 | `main` |
| 框架预设 | **None** |
| 构建命令 | 留空 |
| 构建输出目录 | **`web`** |
| 根目录 | 留空 |

> 构建输出目录必须填 `web`，否则找不到 index.html

点击 **保存并部署**。

### 3.3 等待首次部署

首次部署会失败（因为还没绑定 D1），没关系，继续下面的步骤。

## 四、绑定 D1 数据库（关键步骤）

1. 进入 Pages 项目 → **Settings** → **Functions**
2. 找到 **D1 database bindings** → 点击 **Add binding**
3. 填写：
   - **Variable name**: `DB`
   - **D1 database**: 选择 `AI-戏剧-数据库`
4. 点击 **保存**

> Variable name 必须填 `DB`，因为 `functions/api/[[route]].js` 用的是 `env.DB`

## 五、设置环境变量

1. 进入 Pages 项目 → **Settings** → **Environment variables**
2. 添加以下变量（**生产环境**和**预览环境**都设置）：

| 变量名 | 值 |
|--------|-----|
| `DOUBAO_API_KEY` | 你的豆包 API Key |
| `SEEDREAM_API_KEY` | 你的豆包生图 API Key |

3. 点击 **保存**

## 六、重新部署

回到 **Deployments** 标签，点击最新部署右上角的 **...** → **Retry deployment**。

等待 1-2 分钟，看到完成表示部署成功。

## 七、验证访问

部署成功后访问：
```
https://ai-drama-master.pages.dev
```

### 测试清单

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| 首页加载 | 打开网址 | 显示"对话"页（空状态） |
| 注册账号 | 我的 → 登录/注册 → 注册 tab | 注册成功，自动登录 |
| 登录账号 | 退出后重新登录 | 登录成功，显示会员到期时间 |
| 卡密兑换 | 我的 → 卡密兑换 → 输入测试卡密 | 提示兑换成功，会员延长 |
| AI 对话 | 创建对话 → 输入文字 | 2-3 秒返回结果 |
| 生成分镜 | 创建对话 → 输入"分镜：xxx" | 2-3 秒返回分镜 |
| 生成图片 | 上传图片 → 点生成 | 5-10 秒返回 1-6 张图 |
| D1 验证 | D1 控制台 → Console → `SELECT * FROM users` | 看到刚才注册的账号 |

## 八、常见问题

### Q1: 部署后访问 404
- 检查"构建输出目录"是否填 `web`

### Q2: API 请求失败 "no such table"
- 没执行 `d1-schema.sql`，回到"二、D1 数据库建表"执行

### Q3: API 请求失败 "env.DB is undefined"
- D1 binding 没设置或变量名不是 `DB`，回到"四、绑定 D1 数据库"

### Q4: AI 请求失败 "401 Unauthorized"
- 环境变量没设置或 Key 错误

### Q5: 修改代码后怎么更新
1. 本地修改 → `git add` → `git commit` → `git push`
2. Cloudflare 自动检测 push → 自动部署
3. 在 Pages → Deployments 标签看进度

## 九、自定义域名（可选）

1. Pages 项目 → **Custom domains** → **Set up a custom domain**
2. 输入你的域名 → 按照提示添加 CNAME 记录
3. Cloudflare 自动签发 SSL 证书

## 十、下一步优化建议

- [ ] 密码加 bcrypt 加密（当前是明文）
- [ ] JWT token 替代简单 base64 编码
- [ ] 接入 Cloudflare R2 存储图片
- [ ] 接入 Cloudflare Analytics 看访问数据
- [ ] 添加 Cloudflare WAF 规则防滥用
