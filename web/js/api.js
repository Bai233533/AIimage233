/**
 * api.js - 调用后端API
 * 
 * 配置说明：
 * API_BASE 指向 Cloudflare Workers 后端地址
 * 如果前端和 API 同域（如 Pages Functions），留空即可
 */

const API_CONFIG = {
  // Cloudflare Workers 后端地址
  API_BASE: 'https://ai-drama-api.19863435913.workers.dev'
};

const API = {

  // ==================== 基础请求方法 ====================
  async request(path, options = {}) {
    const token = Store.getUserToken();
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = API_CONFIG.API_BASE ? API_CONFIG.API_BASE + path : path;

    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.errMsg || data.error || '请求失败');
    }
    return data;
  },

  // ==================== AI: 生成分镜提示词（图片识别） ====================
  async generatePrompt(images, userPrompt, count) {
    return await this.request('/api/ai/generate-prompt', {
      method: 'POST',
      body: JSON.stringify({ images, userPrompt, count })
    });
  },

  // ==================== AI: 纯文字生成分镜提示词 ====================
  async generatePromptFromText(userPrompt, count) {
    return await this.request('/api/ai/generate-prompt-text', {
      method: 'POST',
      body: JSON.stringify({ userPrompt, count })
    });
  },

  // ==================== AI: 生成图片 ====================
  async generateImage(prompt, count, images, referenceCount) {
    return await this.request('/api/ai/generate-image', {
      method: 'POST',
      body: JSON.stringify({ prompt, count, images: images || [], referenceImages: referenceCount || 0 })
    });
  },

  // ==================== AI: 纯文字对话 ====================
  async chat(messages, systemPrompt) {
    return await this.request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, systemPrompt })
    });
  },

  // ==================== 用户: 登录 ====================
  async login(username, password) {
    return await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  // ==================== 用户: 注册 ====================
  async register(username, password) {
    return await this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },

  // ==================== 用户: 检查会员状态 ====================
  async checkMembership(username) {
    return await this.request('/api/auth/check-membership', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  },

  // ==================== 用户: 卡密兑换 ====================
  async verifyCardKey(username, cardKey) {
    return await this.request('/api/auth/verify-card-key', {
      method: 'POST',
      body: JSON.stringify({ username, cardKey })
    });
  },

  // ==================== 历史记录 ====================
  async getHistory() {
    return await this.request('/api/history/list');
  },

  async saveHistoryRecord(groupId, prompt, images) {
    return await this.request('/api/history/save', {
      method: 'POST',
      body: JSON.stringify({ groupId, prompt, images })
    });
  },

  // ==================== 图片意图检测（前端逻辑） ====================
  detectImageIntent(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const keywords = [
      '分镜', '画面', '场景', '背景', '镜头', '景别',
      '特写', '全景', '近景', '远景', '俯拍', '仰拍',
      '竖屏', '横屏', '9:16', '16:9', '4:3',
      '色调', '光影', '氛围', '风格', '画风',
      '生成', '生图', '出图', '画一张', '帮我画',
      '动漫', '插画', '3D', '写实', '水彩', '像素',
      '人物', '角色', '产品', '商品', '食物', '风景',
      '背景虚化', '逆光', '暖色', '冷色', '霓虹'
    ];
    return keywords.some(kw => lower.includes(kw));
  }
};
