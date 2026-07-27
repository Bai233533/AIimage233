# H5 部署指南（CloudBase Web Apps + SDK 方案）

## 架构说明

```
用户浏览器 → CloudBase Web Apps（webapps.tcloudbase.com）→ CloudBase SDK → 中心 API 网关 → h5Backend 云函数 → 豆包 API
```

- **前端**：部署到 CloudBase Web 应用托管（`webapps.tcloudbase.com`，不受 418 限制）
- **API 调用**：通过 CloudBase JS SDK 调用云函数（走中心网关 `tcb-api.tencentcloudapi.com`，不走被封禁的 `tcloudbaseapp.com`）
- **后端**：CloudBase 云函数 `h5Backend`（AI 代理 + 用户管理）
- **数据库**：CloudBase 数据库（users / card_keys）

> **为什么不用 Vercel + HTTP 访问服务？**
> CloudBase 2025-10-09 后新建环境的所有 `tcloudbaseapp.com` 默认域名（包括静态托管和 HTTP 访问服务）都被策略封禁，浏览器直接访问返回 418。Web Apps 的 `webapps.tcloudbase.com` 域名不受此限制。

---

## Step 1: 部署云函数（如未部署）

```bash
# 进入云函数目录
cd cloudfunctions/h5Backend

# 安装依赖
npm install

# 通过 CloudBase CLI 部署
tcb fn deploy h5Backend
```

或通过 CloudBase 控制台手动上传代码包。

---

## Step 2: 开启匿名登录

SDK 调用云函数需要身份认证，最简单的方式是开启匿名登录。

1. 打开 [CloudBase 控制台](https://tcb.cloud.tencent.com/dev?envId=cloud1-d4g2fqiz8adfe4863)
2. 左侧菜单 → **设置** → **登录授权**（或"环境管理 → 登录方式"）
3. 找到 **"匿名登录"**，点击 **启用**
4. 保存

> 如果找不到"匿名登录"选项，也可以尝试开启 **"未登录访问"**（在"安全配置"中），允许未鉴权用户调用云函数。

---

## Step 3: 配置安全域名

SDK 会校验当前页面域名是否在安全域名列表中。

1. CloudBase 控制台 → **设置** → **安全配置** → **安全域名**
2. 添加：`h5-cloud1-d4g2fqiz8adfe4863.webapps.tcloudbase.com`
3. 保存

> CloudBase Web Apps 托管可能已自动添加此域名，检查确认即可。

---

## Step 4: 部署前端到 CloudBase Web Apps

### 方式 A：控制台上传（已使用的方式）

1. CloudBase 控制台 → **云托管** → **Web 应用**（或"网站托管 → Web 应用"）
2. 创建 Web 应用，选择环境 `cloud1-d4g2fqiz8adfe4863`
3. 上传 `h5/` 目录下所有文件（index.html、css/、js/）
4. 部署完成后获得访问地址：`https://h5-cloud1-d4g2fqiz8adfe4863.webapps.tcloudbase.com`

### 方式 B：CLI 部署

```bash
# 安装 CloudBase CLI
npm i -g @cloudbase/cli

# 登录
tcb login

# 部署
tcb hosting deploy ./h5 --env cloud1-d4g2fqiz8adfe4863
```

---

## Step 5: 更新部署后重新上传

修改代码后，重新上传 `h5/` 目录下的文件到 CloudBase Web Apps 即可。

---

## 测试清单

1. ✅ 页面能打开（`webapps.tcloudbase.com`）
2. ⬜ 点击"创作" → 输入文字 → AI 生成提示词 → 生成图片
3. ⬜ 登录/注册功能
4. ⬜ 历史记录查看

> 如果 Step 2 失败（页面能打开但功能不可用），通常是匿名登录未开启。回到 Step 2 检查。

---

## 文件结构

```
h5/
├── index.html          # 入口 HTML（含 CloudBase SDK tcb.js）
├── css/
│   └── style.css       # 全局样式
├── js/
│   ├── api.js          # API 调用封装（CloudBase SDK 模式）
│   ├── store.js        # localStorage + 对话管理
│   ├── ui.js           # UI 组件（Toast/Loading/Modal 等）
│   ├── app.js          # 主应用（路由 + TabBar + API.init）
│   └── pages/
│       ├── home.js     # 对话列表页
│       ├── chat.js     # AI 对话生成页（核心）
│       ├── profile.js  # 个人中心
│       └── history.js  # 历史记录
└── DEPLOY.md           # 本文档
```
