# AI漫剧大师

AI 图片生成工具，上传产品/主题图片或输入文字，自动生成分镜提示词并生成配套图片。

## 项目结构

```
├── web/                      # Web 版（Cloudflare Pages 部署）
│   ├── functions/api/        # 后端 API（Cloudflare Pages Functions + D1）
│   ├── js/                   # 前端 SPA
│   ├── css/                  # 样式
│   ├── index.html            # 入口页面
│   ├── admin.html            # 卡密管理后台
│   └── DEPLOY.md             # 部署指南
├── h5/                       # H5 版（腾讯云开发部署）
│   ├── js/                   # 前端 SPA
│   ├── css/                  # 样式
│   └── index.html            # 入口页面
└── cloudfunctions/
    └── h5Backend/            # H5 版云函数后端
```

## 技术栈

- **前端**: 原生 JS SPA（无框架）
- **AI 模型**: 豆包大模型（对话）+ Seedream 5.0（生图）
- **后端**: Cloudflare Pages Functions + D1 / 腾讯云开发云函数
