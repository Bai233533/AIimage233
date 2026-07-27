const app = getApp();

Page({
  data: {
    isLoggedIn: false,
    isMember: false,
    username: '',
    expireTime: '',
    freeUsed: 0,
    freeLimit: 3,
    // 登录弹窗
    showLoginModal: false,
    loginMode: 'login', // 'login' | 'register'
    loginUsername: '',
    loginPassword: '',
    regUsername: '',
    regPassword: '',
    regPasswordConfirm: '',
    // 卡密弹窗
    showCardKeyModal: false,
    cardKeyInput: '',
    // 导航栏适配
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
    this._loadLoginState();
    const freeUsed = wx.getStorageSync('freeUsed') || 0;
    this.setData({ freeUsed });
    this._checkMembership();
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
  },

  // ==================== 登录状态持久化 ====================

  _loadLoginState() {
    const token = wx.getStorageSync('userToken');
    const userInfo = wx.getStorageSync('userInfo');
    if (token && userInfo) {
      this.setData({
        isLoggedIn: true,
        isMember: userInfo.isMember || false,
        username: userInfo.username || '',
        expireTime: userInfo.expireTime || ''
      });
    }
  },

  _saveLoginState(token, username, isMember, expireTime) {
    wx.setStorageSync('userToken', token);
    wx.setStorageSync('userInfo', { username, isMember, expireTime });
  },

  _clearLoginState() {
    wx.removeStorageSync('userToken');
    wx.removeStorageSync('userInfo');
  },

  // ==================== 云端会员状态同步 ====================

  async _checkMembership() {
    try {
      // 未登录时不调用云端检查
      if (!wx.getStorageSync('userToken')) return;

      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'checkMembership' }
      });
      if (res.result && res.result.success) {
        const { isMember, isNewUser, expireTime } = res.result;
        // 新用户（未注册过）不自动设置登录状态
        if (isNewUser) return;

        const formatted = expireTime ? this._formatDate(new Date(expireTime)) : '';
        this.setData({
          isMember,
          expireTime: formatted || this.data.expireTime
        });
        // 同步更新本地缓存
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.isMember = isMember;
        userInfo.expireTime = formatted;
        wx.setStorageSync('userInfo', userInfo);
      }
    } catch (err) {
      console.error('检查会员状态失败:', err);
    }
  },

  // ==================== 登录弹窗 ====================

  showLoginModalAction() {
    if (this.data.isLoggedIn) {
      wx.showToast({ title: '您已登录：' + this.data.username, icon: 'none' });
      return;
    }
    this.setData({ showLoginModal: true, loginMode: 'login', loginUsername: '', loginPassword: '' });
  },

  hideLoginModal() {
    this.setData({ showLoginModal: false });
  },

  switchToLogin() {
    this.setData({ loginMode: 'login', loginUsername: '', loginPassword: '' });
  },

  switchToRegister() {
    this.setData({ loginMode: 'register', regUsername: '', regPassword: '', regPasswordConfirm: '' });
  },

  // ==================== 输入事件 ====================

  onLoginUsernameInput(e) { this.setData({ loginUsername: e.detail.value }); },
  onLoginPasswordInput(e) { this.setData({ loginPassword: e.detail.value }); },
  onRegUsernameInput(e) { this.setData({ regUsername: e.detail.value }); },
  onRegPasswordInput(e) { this.setData({ regPassword: e.detail.value }); },
  onRegPasswordConfirmInput(e) { this.setData({ regPasswordConfirm: e.detail.value }); },

  // ==================== 密码登录 ====================

  async onPasswordLogin() {
    const username = this.data.loginUsername.trim();
    const password = this.data.loginPassword.trim();

    if (!username) {
      wx.showToast({ title: '请输入账号', icon: 'none' }); return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' }); return;
    }

    wx.showLoading({ title: '登录中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'userLoginByPassword',
          action: 'login',
          username,
          password
        }
      });

      wx.hideLoading();
      console.log('[登录] 返回:', JSON.stringify(res.result));

      if (res.result && res.result.success) {
        const { username: uname, isMember, expireTime } = res.result;
        const formatted = expireTime ? this._formatDate(new Date(expireTime)) : '';

        this.setData({
          isLoggedIn: true,
          isMember,
          showLoginModal: false,
          username: uname,
          expireTime: formatted
        });

        this._saveLoginState(
          res.result.token || 'local_' + Date.now(),
          uname, isMember, formatted
        );

        wx.showToast({ title: '登录成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[登录] 异常:', err);
      const errMsg = (err && err.message) || (err && err.errMsg) || '请检查云函数是否已部署';
      wx.showToast({ title: '登录失败：' + errMsg, icon: 'none', duration: 3000 });
    }
  },

  // ==================== 密码注册 ====================

  async onPasswordRegister() {
    const username = this.data.regUsername.trim();
    const password = this.data.regPassword.trim();
    const confirm = this.data.regPasswordConfirm.trim();

    if (!username) {
      wx.showToast({ title: '请输入账号', icon: 'none' }); return;
    }
    if (username.length < 2 || username.length > 20) {
      wx.showToast({ title: '账号需2-20个字符', icon: 'none' }); return;
    }
    if (!password) {
      wx.showToast({ title: '请输入密码', icon: 'none' }); return;
    }
    if (password.length < 6 || password.length > 20) {
      wx.showToast({ title: '密码需6-20个字符', icon: 'none' }); return;
    }
    if (password !== confirm) {
      wx.showToast({ title: '两次密码不一致', icon: 'none' }); return;
    }

    wx.showLoading({ title: '注册中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'userLoginByPassword',
          action: 'register',
          username,
          password
        }
      });

      wx.hideLoading();
      console.log('[注册] 返回:', JSON.stringify(res.result));

      if (res.result && res.result.success) {
        const { username: uname, isMember, expireTime } = res.result;
        const formatted = expireTime ? this._formatDate(new Date(expireTime)) : '';

        this.setData({
          isLoggedIn: true,
          isMember,
          showLoginModal: false,
          username: uname,
          expireTime: formatted
        });

        this._saveLoginState(
          res.result.token || 'local_' + Date.now(),
          uname, isMember, formatted
        );

        wx.showToast({ title: '注册成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '注册失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[注册] 异常:', err);
      const errMsg = (err && err.message) || (err && err.errMsg) || '请检查云函数是否已部署';
      wx.showToast({ title: '注册失败：' + errMsg, icon: 'none', duration: 3000 });
    }
  },

  // ==================== 卡密兑换 ====================

  onCardKeyTap() {
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录后再兑换', icon: 'none' }); return;
    }
    this.setData({ showCardKeyModal: true, cardKeyInput: '' });
  },

  hideCardKeyModal() {
    this.setData({ showCardKeyModal: false });
  },

  onCardKeyInput(e) {
    this.setData({ cardKeyInput: e.detail.value });
  },

  async onVerifyCardKey() {
    const cardKey = this.data.cardKeyInput.trim();
    if (!cardKey) {
      wx.showToast({ title: '请输入卡密', icon: 'none' }); return;
    }

    wx.showLoading({ title: '验证中...' });

    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'verifyCardKey', cardKey }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        const formatted = res.result.expireTime
          ? this._formatDate(new Date(res.result.expireTime)) : '';

        this.setData({
          isMember: true, isLoggedIn: true,
          showCardKeyModal: false, cardKeyInput: '', expireTime: formatted
        });

        this._saveLoginState(
          wx.getStorageSync('userToken') || '',
          this.data.username, true, formatted
        );

        wx.showToast({ title: '兑换成功！', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '兑换失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '验证失败，请重试', icon: 'none' });
      console.error('卡密验证失败:', err);
    }
  },

  // ==================== 退出登录 ====================

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '退出登录将清空当前对话记录，确定退出吗？',
      confirmColor: '#E53E3E',
      success: (res) => {
        if (res.confirm) {
          // 清除当前用户的对话记录
          const userInfo = wx.getStorageSync('userInfo');
          if (userInfo && userInfo.username) {
            wx.setStorageSync('conversations_' + userInfo.username, []);
          } else {
            wx.setStorageSync('conversations_guest', []);
          }
          this._clearLoginState();
          wx.removeStorageSync('loginHintShown');
          this.setData({
            isLoggedIn: false, isMember: false,
            username: '', expireTime: ''
          });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  // ==================== 工具方法 ====================

  _formatDate(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }
});
