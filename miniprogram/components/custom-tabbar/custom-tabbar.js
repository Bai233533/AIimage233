Component({
  properties: {
    selected: {
      type: Number,
      value: 0
    },
    color: {
      type: String,
      value: '#999999'
    },
    selectedColor: {
      type: String,
      value: '#1E3A8A'
    },
    backgroundColor: {
      type: String,
      value: 'rgba(255, 255, 255, 0.9)'
    }
  },

  data: {
    list: [
      {
        pagePath: '/pages/index/index',
        text: '首页',
        iconPath: '/images/icons/navbar/home.svg',
        selectedIconPath: '/images/icons/navbar/home-active.svg'
      },
      {
        pagePath: '/pages/history/history',
        text: '历史记录',
        iconPath: '/images/icons/navbar/history.svg',
        selectedIconPath: '/images/icons/navbar/history-active.svg'
      },
      {
        pagePath: '/pages/profile/profile',
        text: '我的',
        iconPath: '/images/icons/navbar/profile.svg',
        selectedIconPath: '/images/icons/navbar/profile-active.svg'
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = this.data.list[data.index].pagePath
      
      wx.switchTab({
        url: url
      })
    }
  }
})