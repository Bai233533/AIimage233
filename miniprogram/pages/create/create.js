const app = getApp();
const conversationManager = require('../index/index');

Page({
  data: {
    statusBarHeight: 20,
    navBarHeight: 44
  },

  onLoad() {
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight || 20,
      navBarHeight: app.globalData.navBarHeight || 44
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
  },

  goToNewChat() {
    const conv = conversationManager.createConversation('新对话');
    wx.navigateTo({ url: `/pages/chat/chat?conversationId=${conv.id}` });
  }
});
