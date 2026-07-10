App({
  onLaunch() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d4g2fqiz8adfe4863',
        traceUser: true
      });
    }
    
    // 获取本地存储的历史记录
    const history = wx.getStorageSync('generationHistory');
    if (history) {
      this.globalData.history = history;
    }
  },
  globalData: {
    history: []
  }
});
