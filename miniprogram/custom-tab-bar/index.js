Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', text: '对话', icon: '💬' },
      { pagePath: '/pages/create/create', text: '创作', icon: '🎨' },
      { pagePath: '/pages/clouddrive/clouddrive', text: '云盘', icon: '☁️' },
      { pagePath: '/pages/profile/profile', text: '我的', icon: '👤' }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const index = data.index;
      const url = this.data.list[index].pagePath;
      wx.switchTab({ url });
    }
  }
});
