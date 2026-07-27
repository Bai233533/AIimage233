/**
 * store.js - 本地存储管理（替代 wx.getStorageSync / wx.setStorageSync）
 */

const Store = {
  // ==================== 基础存储 ====================
  get(key, defaultValue) {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : (defaultValue !== undefined ? defaultValue : null);
    } catch (e) {
      return defaultValue !== undefined ? defaultValue : null;
    }
  },

  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  // ==================== 用户状态 ====================
  getUserToken() {
    return this.get('userToken', '');
  },

  setUserToken(token) {
    this.set('userToken', token);
  },

  getUserInfo() {
    return this.get('userInfo', {});
  },

  setUserInfo(info) {
    this.set('userInfo', info);
  },

  isLoggedIn() {
    return !!this.get('userToken', '');
  },

  getFreeUsed() {
    return this.get('freeUsed', 0);
  },

  setFreeUsed(count) {
    this.set('freeUsed', count);
  },

  clearLoginState() {
    this.remove('userToken');
    this.remove('userInfo');
  },

  // ==================== 对话管理 ====================
  _getStorageKey() {
    const userInfo = this.getUserInfo();
    const username = userInfo && userInfo.username ? userInfo.username : '';
    return username ? 'conversations_' + username : 'conversations_guest';
  },

  getConversations() {
    return this.get(this._getStorageKey(), []);
  },

  saveConversations(list) {
    this.set(this._getStorageKey(), list);
  },

  createConversation(title) {
    const list = this.getConversations();
    const now = Date.now();
    const colors = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)'
    ];
    const conv = {
      id: 'conv_' + now + '_' + Math.random().toString(36).slice(2, 8),
      title: title || '新对话',
      summary: '',
      messages: [],
      color: colors[list.length % colors.length],
      avatarText: (title || '新')[0],
      createdAt: now,
      updatedAt: now,
      pinned: false
    };
    list.unshift(conv);
    this.saveConversations(list);
    return conv;
  },

  updateConversation(convId, updates) {
    const list = this.getConversations();
    const idx = list.findIndex(c => c.id === convId);
    if (idx === -1) return null;
    Object.assign(list[idx], updates, { updatedAt: Date.now() });
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
    this.saveConversations(list);
    return list[idx];
  },

  deleteConversation(convId) {
    const list = this.getConversations().filter(c => c.id !== convId);
    this.saveConversations(list);
  },

  getConversation(convId) {
    return this.getConversations().find(c => c.id === convId) || null;
  },

  // ==================== 历史记录 ====================
  getHistory() {
    return this.get('generationHistory', []);
  },

  saveHistory(history) {
    this.set('generationHistory', history);
  },

  addToHistory(images, prompt) {
    const now = new Date();
    const groupId = Date.now();
    const records = images.map((img, i) => ({
      id: Date.now() + i,
      groupId,
      imageSrc: img.url,
      imageUrl: img.url,
      prompt: prompt,
      date: this._formatDate(now),
      type: 'AI漫剧生成',
      batchIndex: i + 1,
      batchTotal: images.length
    }));
    let history = this.getHistory();
    history = records.concat(history);
    this.saveHistory(history);
    return records;
  },

  // ==================== 工具方法 ====================
  _formatDate(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return y + '-' + mo + '-' + d + ' ' + h + ':' + mi;
  },

  formatDate(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + mo + '-' + d;
  },

  formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return h + ':' + m;
  },

  formatTimeDisplay(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return this.formatTime(date);
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天';
    }
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      const days = ['日', '一', '二', '三', '四', '五', '六'];
      return '周' + days[date.getDay()];
    }
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return mo + '/' + d;
  }
};
