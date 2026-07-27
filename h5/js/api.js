/**
 * api.js - CloudBase SDK 初始化 + 云函数调用封装
 * 替代 wx.cloud.callFunction 和 utils/api.js 中的直接 API 调用
 */

const CLOUD_ENV = 'cloud1-d4g2fqiz8adfe4863';

let tcbApp = null;
let authReady = false;

const API = {

  // ==================== 初始化 CloudBase ====================
  async init() {
    if (tcbApp) return tcbApp;

    tcbApp = cloudbase.init({
      env: CLOUD_ENV
    });

    // 检查登录状态，不强制匿名登录
    // H5 调用云函数时，需要先在 CloudBase 控制台开启"匿名登录"
    // 备用方案：开启"未登录访问"，允许未鉴权调用
    const auth = tcbApp.auth();
    if (!authReady) {
      try {
        // 尝试静默登录（如果开启了匿名登录会自动登录）
        const loginState = await auth.getLoginState();
        if (!loginState) {
          // 未登录，尝试匿名登录
          await auth.signInAnonymously();
        }
        authReady = true;
      } catch (err) {
        console.warn('[CloudBase] 未登录状态（需要开启匿名登录）:', err.message);
        // 不报错，云函数可能允许未登录访问
        authReady = true;
      }
    }

    return tcbApp;
  },

  // ==================== 调用云函数 ====================
  async callFunction(action, data) {
    await this.init();
    try {
      const res = await tcbApp.callFunction({
        name: 'h5Backend',
        data: { action, ...data }
      });
      return res.result;
    } catch (err) {
      console.error('[云函数调用失败]', action, err);
      throw err;
    }
  },

  // ==================== AI: 生成分镜提示词（图片识别） ====================
  // images: base64 字符串数组（不含 data:image 前缀）
  async generatePrompt(images, userPrompt, count) {
    return await this.callFunction('generatePrompt', { images, userPrompt, count });
  },

  // ==================== AI: 纯文字生成分镜提示词 ====================
  async generatePromptFromText(userPrompt, count) {
    return await this.callFunction('generatePromptFromText', { userPrompt, count });
  },

  // ==================== AI: 生成图片 ====================
  // images: base64 数组（产品图+参考图合并），referenceImages: 参考图数量
  async generateImage(prompt, count, images, referenceCount) {
    return await this.callFunction('generateImage', {
      prompt,
      count,
      images: images || [],
      referenceImages: referenceCount || 0
    });
  },

  // ==================== AI: 纯文字对话 ====================
  async chat(messages, systemPrompt) {
    return await this.callFunction('chat', { messages, systemPrompt });
  },

  // ==================== 用户: 登录 ====================
  async login(username, password) {
    return await this.callFunction('login', { username, password });
  },

  // ==================== 用户: 注册 ====================
  async register(username, password) {
    return await this.callFunction('register', { username, password });
  },

  // ==================== 用户: 检查会员状态 ====================
  async checkMembership(username) {
    return await this.callFunction('checkMembership', { username });
  },

  // ==================== 用户: 卡密兑换 ====================
  async verifyCardKey(username, cardKey) {
    return await this.callFunction('verifyCardKey', { username, cardKey });
  },

  // ==================== 文本安全检查 ====================
  async textSecurityCheck(content) {
    return await this.callFunction('textSecurityCheck', { content });
  },

  // ==================== 图片意图检测（前端逻辑，同小程序） ====================
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
