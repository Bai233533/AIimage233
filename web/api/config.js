/**
 * 后端配置
 */

module.exports = {
  // 豆包AI配置
  doubao: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: process.env.DOUBAO_API_KEY || 'ark-f93f0cb1-d06a-4bf5-af7b-00787df51ebc-672cd',
    model: 'doubao-seed-2-0-pro-260215'
  },

  // 豆包生图模型配置（Seedream 5.0）
  seedream: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: process.env.SEEDREAM_API_KEY || 'ark-f93f0cb1-d06a-4bf5-af7b-00787df51ebc-672cd',
    model: 'doubao-seedream-5-0-260128'
  },

  // JWT密钥（用于生成token）
  jwtSecret: process.env.JWT_SECRET || 'ai-drama-master-secret-2024',

  // 管理员密钥
  adminSecret: process.env.ADMIN_SECRET || 'ADMIN_2026'
};
