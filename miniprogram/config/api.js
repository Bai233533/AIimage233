// API 配置
const API_CONFIG = {
  // 豆包对话模型配置
  doubao: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: 'ark-f93f0cb1-d06a-4bf5-af7b-00787df51ebc-672cd',
    model: 'doubao-seed-2-0-pro-260215'
  },
  // 豆包生图模型配置（Seedream 5.0，支持文生图/图生图/多图生图/序列化生图）
  seedream: {
    baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: 'ark-f93f0cb1-d06a-4bf5-af7b-00787df51ebc-672cd',
    model: 'doubao-seedream-5-0-260128'
  }
};

module.exports = API_CONFIG;
