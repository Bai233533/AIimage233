#!/bin/bash
# deploy-h5.sh - 一键部署 H5 到 CloudBase 静态托管
#
# 前置条件：
#   1. 已安装 Node.js
#   2. 已执行 tcb login 登录过 CloudBase
#
# 使用方法：
#   bash deploy-h5.sh
#
# 首次使用需要先安装 CLI：
#   npm install -g @cloudbase/cli
#   tcb login

set -e

ENV_ID="cloud1-d4g2fqiz8adfe4863"
H5_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=========================================="
echo "  AI漫剧大师 H5 部署脚本"
echo "  环境: $ENV_ID"
echo "  目录: $H5_DIR"
echo "=========================================="
echo ""

# 检查是否安装了 tcb 命令
if ! command -v tcb &> /dev/null; then
  echo "❌ 未检测到 CloudBase CLI，正在安装..."
  npm install -g @cloudbase/cli
fi

# 检查登录状态
echo "📋 检查登录状态..."
if ! tcb env list &> /dev/null; then
  echo "⚠️  未登录或登录已过期，请按提示完成登录："
  tcb login
fi

# 部署 H5 文件
echo ""
echo "🚀 开始部署 H5 文件到静态托管..."
tcb hosting deploy "$H5_DIR" --envId "$ENV_ID"

echo ""
echo "✅ 部署完成！"
echo ""
echo "访问地址："
echo "  https://${ENV_ID}-1331759233.tcloudbaseapp.com"
echo ""
echo "📱 在手机浏览器打开上面的链接即可体验"
echo ""
