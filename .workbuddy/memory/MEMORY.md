# 项目记忆

## 项目概述
- **项目名称**: AI漫剧大师（对外名：爆款商品生成工具）
- **类型**: 微信小程序（云开发）
- **AppID**: wxf4b2e9b3dffb0620
- **云环境**: cloud1-d4g2fqiz8adfe4863（app.js 中初始化的）
- **核心功能**: 用户上传商品图片/输入文字 → 豆包AI识别并生成分镜提示词 → 豆包Seedream生成营销图片

## 技术架构
- **前端**: 微信小程序（原生开发，无框架），自定义TabBar
- **后端**: 单一云函数 `quickstartFunctions`（type路由分发模式，13个处理函数）
- **AI服务**: 字节跳动豆包大模型（对话模型 doubao-seed-evolving + 生图模型 doubao-seedream-5-0-260128）
- **数据库集合**: users（用户）、card_keys（卡密）、sales（演示数据）
- **状态管理**: 无库，使用 app.globalData + wx.Storage + index.js模块导出共享

## 页面结构（7个页面）
1. index - 对话列表页（TabBar第1页），导出对话管理函数供其他页面使用
2. chat - AI对话生成页（核心页面），三种生成场景：纯文字/文字+图片/纯图片
3. create - 创作中心页（TabBar第2页），新建对话入口
4. clouddrive - 云盘页（TabBar第3页），占位未实现
5. profile - 个人中心页（TabBar第4页），登录/注册/卡密兑换
6. history - 生成历史页，按时间筛选+分组展示
7. detail - 图片详情页，大图预览/保存/分享

## 会员体系
- 免费用户3次额度（localStorage计数）
- 注册赠送1天试用会员
- 卡密兑换延长30天会员
- 管理后台（admin/index.html）批量生成卡密，adminSecret: ADMIN_2026

## 已知问题/风险
1. API Key硬编码在前端 config/api.js（安全风险）
2. 密码明文存储在数据库
3. 云环境不一致（app.js vs envList.js）
4. admin/index.html未真正对接云函数
5. clouddrive页面未实现
6. 遗留组件未清理（components/custom-tabbar, cloudTipModal）
7. chat.js中generateImage调用参数可能不一致

## 设计系统
- stitch_/stitch_/lumina_glass/DESIGN.md - Lumina Glass玻璃拟态设计系统
- 三张设计稿截图（首页/历史/详情）
- 主色调: 深蓝#1E3A8A，背景白/浅灰

## H5 网页版（2026-07-24 新增）
- **原因**: 小程序因"涉及深度合成技术（AI绘画）"被拒审，转H5绕过审核
- **云函数**: `cloudfunctions/h5Backend/` — AI代理+用户管理，API Key安全存储在云端
  - AI: generatePrompt / generatePromptFromText / generateImage / chat
  - 用户: login / register / checkMembership / verifyCardKey（基于username查询）
  - 超时60秒，内存512MB，支持环境变量 DOUBAO_API_KEY
- **前端**: `h5/` 目录，vanilla JS SPA，CloudBase JS SDK v1.7.2
  - CloudBase SDK 初始化 → 匿名认证 → 调用h5Backend云函数
  - 4个页面: home(对话列表) / chat(生成) / profile(个人中心) / history(历史)
  - 三种生成场景完整移植，提示词工程完整移植
  - 底部TabBar: 滑动指示条+胶囊背景（与小程序升级版一致）
  - 部署指南: `h5/DEPLOY.md`
- **部署方案**: CloudBase Web Apps（云托管 Web 应用）
  - 访问地址: `https://h5-cloud1-d4g2fqiz8adfe4863.webapps.tcloudbase.com/`
  - `webapps.tcloudbase.com` 域名不受 418 策略限制（与 `tcloudbaseapp.com` 不同）
  - SDK 通过中心网关 `tcb-api.tencentcloudapi.com` 调云函数，绕过 418
  - 前提: 需开启匿名登录 + 配置安全域名
- **踩坑记录**:
  - `tcloudbaseapp.com` 静态托管域名: 418（2025-10-09后新建环境被封禁）
  - `service.tcloudbaseapp.com` HTTP访问服务域名: 同样 418
  - `webapps.tcloudbase.com` Web Apps域名: 正常可用 ✅
  - Vercel方案已废弃（不需要了）
## Cloudflare Pages 浏览器版（2026-07-27 新增）
- **原因**: 用户决定放弃腾讯云 CloudBase，改用 Cloudflare Pages + D1，全球边缘访问
- **目录**: `web/` （与 H5 腾讯云版完全不同，是纯 vanilla JS + Pages Functions 架构）
- **架构**:
  - 前端：vanilla JS SPA（hash 路由，4 个页面：home/chat/profile/history）
  - 后端：Cloudflare Pages Functions（`web/functions/api/[[route]].js` 一个 catch-all 文件处理所有 API）
  - 数据库：Cloudflare D1（SQLite，已建好"AI-戏剧-数据库"）
- **核心 API**（均在 `[[route]].js`）:
  - 认证：login / register / checkMembership / verifyCardKey
  - AI：generatePrompt（图生分镜）/ generatePromptFromText（文生分镜）/ generateImage（生图）/ chat（对话）
  - D1 表：users(openid, username, password, expire_time, free_used, create_time)
  - D1 表：card_keys(id, key, status, used_by, used_time, create_time)
  - token 用 `btoa(openid + ':' + Date.now())` 简单实现（未用 JWT）
- **关键配置**:
  - **Root directory 必须填 `web`**（不能留空！Functions 必须在 Root directory 下才能识别）
  - Build output 留空（因为 Root 已经是 web）
  - D1 binding 变量名必须是 `DB`（代码用 env.DB）
  - 环境变量：`DOUBAO_API_KEY`、`SEEDREAM_API_KEY`
  - `_routes.json` 告诉 Pages `/api/*` 走 Functions
- **API Key**: `ark-f93f0cb1-d06a-4bf5-af7b-00787df51ebc-672cd`（对话和生图共用，硬编码在 `web/workers/wrangler.toml`）
- **备用文件**: `web/api/`（Vercel Serverless 风格）、`web/workers/`（单 Worker 模式）— 不使用但保留
- **部署文档**: `web/CLOUDFLARE-DEPLOY.md`（10 步完整指南）
- **建表脚本**: `web/d1-schema.sql`
- **GitHub 仓库**: `https://github.com/Bai233533/AIimage233.git`（main 分支）
- **数据兼容**: H5 与小程序共享 users/card_keys 集合，卡密通用
- **卡密管理后台**: `web/admin.html`（部署后 `https://ai-drama-master.pages.dev/admin.html`）
  - 管理员密钥：`ADMIN_2026`
  - API：`/api/admin/generate-card-keys`（生成）、`/api/admin/list-card-keys`（查询）
  - 卡密格式 `{PREFIX}-{4位}`，排除易混字符（O/0/I/1）
