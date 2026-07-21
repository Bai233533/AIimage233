Page({
  data: {
    isLoggedIn: false,
    isMember: false,
    phone: '',
    expireTime: '',
    freeUsed: 0,
    freeLimit: 3,
    showCardKey: false,
    cardKeyInput: '',
    showLoginModal: false
  },

  onShow() {
    this._checkMembership();
    const freeUsed = wx.getStorageSync('freeUsed') || 0;
    this.setData({ freeUsed });
  },

  // 检查会员状态
  async _checkMembership() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'checkMembership' }
      });
      if (res.result && res.result.success) {
        const { isMember, isNewUser, expireTime, phone } = res.result;
        this.setData({
          isMember,
          isLoggedIn: !isNewUser,
          phone: phone ? this._maskPhone(phone) : '',
          expireTime: expireTime ? this._formatDate(new Date(expireTime)) : ''
        });
      }
    } catch (err) {
      console.error('检查会员状态失败:', err);
    }
  },

  // 手机号脱敏
  _maskPhone(phone) {
    if (!phone || phone.length < 7) return phone;
    return phone.substring(0, 3) + '****' + phone.substring(7);
  },

  // 登录
  onLogin() {
    this.setData({ showLoginModal: true });
  },

  hideLogin() {
    this.setData({ showLoginModal: false });
  },

  // 获取手机号登录
  async onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') return;

    wx.showLoading({ title: '登录中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'userLogin',
          phoneNumber: e.detail.phoneNumber,
          code: e.detail.code
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        this.setData({
          isLoggedIn: true,
          isMember: true,
          showLoginModal: false,
          phone: this._maskPhone(e.detail.phoneNumber),
          expireTime: this._formatDate(new Date(res.result.expireTime))
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
    }
  },

  // 显示卡密输入
  showCardKeyInput() {
    if (!this.data.isLoggedIn) {
      this.setData({ showLoginModal: true });
      return;
    }
    this.setData({ showCardKey: !this.data.showCardKey });
  },

  onCardKeyInput(e) {
    this.setData({ cardKeyInput: e.detail.value });
  },

  // 验证卡密
  async onVerifyCardKey() {
    const cardKey = this.data.cardKeyInput.trim();
    if (!cardKey) {
      wx.showToast({ title: '请输入卡密', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '验证中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'verifyCardKey', cardKey }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        this.setData({
          isMember: true,
          isLoggedIn: true,
          showCardKey: false,
          cardKeyInput: '',
          expireTime: this._formatDate(new Date(res.result.expireTime))
        });
        wx.showToast({ title: '兑换成功！', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '兑换失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '验证失败', icon: 'none' });
    }
  },

  // 退出登录
  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确定退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            isLoggedIn: false,
            isMember: false,
            phone: '',
            expireTime: '',
            showCardKey: false
          });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  _formatDate(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
});
