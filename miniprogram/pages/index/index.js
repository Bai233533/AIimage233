// 对话管理工具
const COLORS = [
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  'linear-gradient(135deg, #f5576c 0%, #ff6a88 100%)',
  'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
];

function _getStorageKey() {
  const userInfo = wx.getStorageSync('userInfo');
  const username = userInfo && userInfo.username ? userInfo.username : '';
  return username ? `conversations_${username}` : 'conversations_guest';
}

function getConversations() {
  return wx.getStorageSync(_getStorageKey()) || [];
}

function saveConversations(list) {
  wx.setStorageSync(_getStorageKey(), list);
}

// 清除当前用户的对话记录
function clearUserConversations() {
  const key = _getStorageKey();
  if (key !== 'conversations_guest') {
    wx.setStorageSync(key, []);
  }
}

function createConversation(title) {
  const list = getConversations();
  const now = Date.now();
  const colorIndex = list.length % COLORS.length;
  const conv = {
    id: 'conv_' + now + '_' + Math.random().toString(36).slice(2, 8),
    title: title || '新对话',
    summary: '',
    messages: [],
    color: COLORS[colorIndex],
    avatarText: (title || '新')[0],
    createdAt: now,
    updatedAt: now,
    pinned: false,
    unread: false
  };
  list.unshift(conv);
  saveConversations(list);
  return conv;
}

function updateConversation(convId, updates) {
  const list = getConversations();
  const idx = list.findIndex(c => c.id === convId);
  if (idx === -1) return null;
  Object.assign(list[idx], updates, { updatedAt: Date.now() });
  // 置顶的排前面
  list.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.updatedAt - a.updatedAt;
  });
  saveConversations(list);
  return list[idx];
}

function deleteConversation(convId) {
  const list = getConversations().filter(c => c.id !== convId);
  saveConversations(list);
}

function getConversation(convId) {
  return getConversations().find(c => c.id === convId) || null;
}

const app = getApp();

// ==================== 首页逻辑 ====================

Page({
  data: {
    conversations: [],
    showMenu: false,
    showRenameModal: false,
    renameValue: '',
    targetConversation: {},
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad() {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 20,
      navBarHeight: app.globalData.navBarHeight || 44
    });
    this._loadConversations();
    this._checkLoginHint();
  },

  _checkLoginHint() {
    const token = wx.getStorageSync('userToken');
    const hinted = wx.getStorageSync('loginHintShown');
    if (!token && !hinted) {
      wx.showModal({
        title: '登录提示',
        content: '未登录状态下聊天记录不会保存，请优先登录账户以保留您的对话。',
        confirmText: '去登录',
        cancelText: '暂不',
        confirmColor: '#1E3A8A',
        success: (res) => {
          wx.setStorageSync('loginHintShown', true);
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
    }
  },

  onShow() {
    this._loadConversations();
    // 隐藏原生tabBar
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  _loadConversations() {
    let list = getConversations();
    // 排序：置顶优先，然后按更新时间倒序
    list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });
    // 格式化时间显示
    list = list.map(c => ({
      ...c,
      timeDisplay: this._formatTimeDisplay(c.updatedAt)
    }));
    this.setData({ conversations: list });
  },

  // 新建对话
  onNewChat() {
    const conv = createConversation('新对话');
    wx.navigateTo({ url: `/pages/chat/chat?conversationId=${conv.id}` });
  },

  // 打开对话
  onOpenChat(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/chat/chat?conversationId=${id}` });
  },

  // 长按对话
  onLongPress(e) {
    const id = e.currentTarget.dataset.id;
    const conv = this.data.conversations.find(c => c.id === id);
    if (conv) {
      this.setData({ showMenu: true, targetConversation: conv });
    }
  },

  hideMenu() {
    this.setData({ showMenu: false });
  },

  // 置顶/取消置顶
  onPinConversation() {
    const conv = this.data.targetConversation;
    updateConversation(conv.id, { pinned: !conv.pinned });
    this.setData({ showMenu: false });
    this._loadConversations();
    wx.showToast({ title: conv.pinned ? '已取消置顶' : '已置顶', icon: 'none' });
  },

  // 重命名
  onRenameConversation() {
    this.setData({
      showMenu: false,
      showRenameModal: true,
      renameValue: this.data.targetConversation.title
    });
  },

  hideRenameModal() {
    this.setData({ showRenameModal: false });
  },

  onRenameInput(e) {
    this.setData({ renameValue: e.detail.value });
  },

  onConfirmRename() {
    const name = this.data.renameValue.trim();
    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' });
      return;
    }
    updateConversation(this.data.targetConversation.id, {
      title: name,
      avatarText: name[0]
    });
    this.setData({ showRenameModal: false });
    this._loadConversations();
    wx.showToast({ title: '已重命名', icon: 'success' });
  },

  // 删除对话
  onDeleteConversation() {
    const conv = this.data.targetConversation;
    wx.showModal({
      title: '删除对话',
      content: `确定删除「${conv.title}」？此操作不可恢复。`,
      confirmColor: '#FF3B30',
      success: (res) => {
        if (res.confirm) {
          deleteConversation(conv.id);
          this.setData({ showMenu: false });
          this._loadConversations();
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  _formatTimeDisplay(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      const h = String(date.getHours()).padStart(2, '0');
      const m = String(date.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
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
    return `${mo}/${d}`;
  }
});

// 导出给外部使用
module.exports = {
  getConversations,
  saveConversations,
  createConversation,
  updateConversation,
  deleteConversation,
  getConversation
};
