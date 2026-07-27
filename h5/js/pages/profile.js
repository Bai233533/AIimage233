/**
 * pages/profile.js - 个人中心页（登录/注册/卡密兑换/会员状态）
 */

const ProfilePage = {
  // 状态
  state: {
    showLoginModal: false,
    loginMode: 'login', // 'login' | 'register'
    showCardKeyModal: false
  },

  render() {
    const userInfo = Store.getUserInfo();
    const isLoggedIn = Store.isLoggedIn();
    const isMember = userInfo.isMember || false;
    const username = userInfo.username || '';
    const expireTime = userInfo.expireTime || '';
    const freeUsed = Store.getFreeUsed();
    const freeLimit = 3;

    let html = '<div class="profile-page">';

    // 头部
    html += '<div class="profile-header">';
    html += '<div class="profile-avatar">' + (isLoggedIn ? username[0].toUpperCase() : '👤') + '</div>';
    if (isLoggedIn) {
      html += '<div class="profile-username">' + this._escape(username) + '</div>';
      if (isMember) {
        html += '<div class="profile-status">会员有效至 ' + expireTime + '</div>';
      } else {
        html += '<div class="profile-status">免费次数：' + (freeLimit - freeUsed) + '/' + freeLimit + '</div>';
      }
    } else {
      html += '<div class="profile-username">未登录</div>';
      html += '<div class="profile-status">登录后可保存记录，无限生成</div>';
    }
    html += '</div>';

    // 功能列表
    html += '<div class="profile-section">';

    if (!isLoggedIn) {
      html += '<div class="profile-item" onclick="ProfilePage.showLogin()">';
      html += '<span class="profile-item-icon">🔑</span>';
      html += '<span class="profile-item-text">登录 / 注册</span>';
      html += '<span class="profile-item-arrow">›</span>';
      html += '</div>';
    } else {
      html += '<div class="profile-item" onclick="ProfilePage.showCardKey()">';
      html += '<span class="profile-item-icon">🎫</span>';
      html += '<span class="profile-item-text">卡密兑换</span>';
      html += '<span class="profile-item-value">延长30天会员</span>';
      html += '<span class="profile-item-arrow">›</span>';
      html += '</div>';

      html += '<div class="profile-item" onclick="App.navigate(\'history\')">';
      html += '<span class="profile-item-icon">📊</span>';
      html += '<span class="profile-item-text">生成历史</span>';
      html += '<span class="profile-item-arrow">›</span>';
      html += '</div>';

      html += '<div class="profile-item" onclick="ProfilePage.logout()">';
      html += '<span class="profile-item-icon">🚪</span>';
      html += '<span class="profile-item-text">退出登录</span>';
      html += '<span class="profile-item-arrow">›</span>';
      html += '</div>';
    }

    html += '</div>';

    // 关于
    html += '<div class="profile-section">';
    html += '<div class="profile-item">';
    html += '<span class="profile-item-icon">ℹ️</span>';
    html += '<span class="profile-item-text">关于 AI漫剧大师</span>';
    html += '<span class="profile-item-value">v1.0.0 H5</span>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    // 弹窗
    if (this.state.showLoginModal) {
      html += this._renderLoginModal();
    }
    if (this.state.showCardKeyModal) {
      html += this._renderCardKeyModal();
    }

    return html;
  },

  onShow() {
    document.getElementById('page-container').innerHTML = this.render();
    this._checkMembership();
  },

  async _checkMembership() {
    if (!Store.isLoggedIn()) return;
    const userInfo = Store.getUserInfo();
    const username = userInfo.username;
    if (!username) return;

    try {
      const res = await API.checkMembership(username);
      if (res && res.success && !res.isNewUser) {
        const formatted = res.expireTime ? Store.formatDate(new Date(res.expireTime)) : '';
        const updated = { ...userInfo, isMember: res.isMember, expireTime: formatted };
        Store.setUserInfo(updated);
        // 重新渲染如果状态变了
        if (userInfo.isMember !== res.isMember) {
          document.getElementById('page-container').innerHTML = this.render();
        }
      }
    } catch (err) {
      console.error('检查会员状态失败:', err);
    }
  },

  // ==================== 登录弹窗 ====================
  _renderLoginModal() {
    const isLogin = this.state.loginMode === 'login';
    let html = '<div class="overlay" onclick="ProfilePage.hideLogin()"></div>';
    html += '<div class="login-modal slide-up">';
    html += '<div class="login-modal-title">' + (isLogin ? '登录' : '注册') + '</div>';
    html += '<div class="login-modal-desc">' + (isLogin ? '登录后可保存聊天记录，享受无限次生成' : '注册即送1天试用会员') + '</div>';

    if (isLogin) {
      html += '<input class="login-input" id="login-username" placeholder="请输入账号" />';
      html += '<input class="login-input" id="login-password" type="password" placeholder="请输入密码" />';
      html += '<div class="login-submit-btn" onclick="ProfilePage.doLogin()">登录</div>';
      html += '<div class="login-switch" onclick="ProfilePage.switchMode(\'register\')">还没有账号？去注册</div>';
      html += '<div class="login-cardkey-link" onclick="ProfilePage.showCardKey()">已有卡密？点击兑换</div>';
    } else {
      html += '<input class="login-input" id="reg-username" placeholder="请输入账号（2-20字符）" />';
      html += '<input class="login-input" id="reg-password" type="password" placeholder="请输入密码（6-20字符）" />';
      html += '<input class="login-input" id="reg-password-confirm" type="password" placeholder="请确认密码" />';
      html += '<div class="login-submit-btn" onclick="ProfilePage.doRegister()">注册</div>';
      html += '<div class="login-switch" onclick="ProfilePage.switchMode(\'login\')">已有账号？去登录</div>';
    }

    html += '<div class="login-close" onclick="ProfilePage.hideLogin()">取消</div>';
    html += '</div>';
    return html;
  },

  showLogin() {
    this.state.showLoginModal = true;
    this.state.loginMode = 'login';
    document.getElementById('page-container').innerHTML = this.render();
  },

  hideLogin() {
    this.state.showLoginModal = false;
    document.getElementById('page-container').innerHTML = this.render();
  },

  switchMode(mode) {
    this.state.loginMode = mode;
    document.getElementById('page-container').innerHTML = this.render();
  },

  async doLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if (!username) { UI.toast('请输入账号'); return; }
    if (!password) { UI.toast('请输入密码'); return; }

    UI.showLoading('登录中...');
    try {
      const res = await API.login(username, password);
      UI.hideLoading();

      if (res && res.success) {
        const formatted = res.expireTime ? Store.formatDate(new Date(res.expireTime)) : '';
        Store.setUserToken(res.token || 'h5_' + Date.now());
        Store.setUserInfo({
          username: res.username,
          isMember: res.isMember,
          expireTime: formatted
        });
        this.state.showLoginModal = false;
        UI.toast('登录成功', 'success');
        this.onShow();
      } else {
        UI.toast(res.errMsg || '登录失败');
      }
    } catch (err) {
      UI.hideLoading();
      UI.toast('登录失败，请重试');
    }
  },

  async doRegister() {
    const username = document.getElementById('reg-username').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    const confirm = document.getElementById('reg-password-confirm').value.trim();

    if (!username) { UI.toast('请输入账号'); return; }
    if (username.length < 2 || username.length > 20) { UI.toast('账号需2-20个字符'); return; }
    if (!password) { UI.toast('请输入密码'); return; }
    if (password.length < 6 || password.length > 20) { UI.toast('密码需6-20个字符'); return; }
    if (password !== confirm) { UI.toast('两次密码不一致'); return; }

    UI.showLoading('注册中...');
    try {
      const res = await API.register(username, password);
      UI.hideLoading();

      if (res && res.success) {
        const formatted = res.expireTime ? Store.formatDate(new Date(res.expireTime)) : '';
        Store.setUserToken(res.token || 'h5_' + Date.now());
        Store.setUserInfo({
          username: res.username,
          isMember: res.isMember,
          expireTime: formatted
        });
        this.state.showLoginModal = false;
        UI.toast('注册成功', 'success');
        this.onShow();
      } else {
        UI.toast(res.errMsg || '注册失败');
      }
    } catch (err) {
      UI.hideLoading();
      UI.toast('注册失败，请重试');
    }
  },

  // ==================== 卡密弹窗 ====================
  _renderCardKeyModal() {
    let html = '<div class="overlay" onclick="ProfilePage.hideCardKey()"></div>';
    html += '<div class="cardkey-modal slide-up">';
    html += '<div class="login-modal-title">卡密兑换</div>';
    html += '<div class="login-modal-desc">输入卡密，兑换30天会员</div>';
    html += '<input class="cardkey-input" id="cardkey-input" placeholder="请输入卡密，如 VIP-AB3D-K9F2" />';
    html += '<div class="cardkey-confirm-btn" onclick="ProfilePage.doVerifyCardKey()">确认兑换</div>';
    html += '<div class="login-close" onclick="ProfilePage.hideCardKey()">取消</div>';
    html += '</div>';
    return html;
  },

  showCardKey() {
    if (!Store.isLoggedIn()) {
      UI.toast('请先登录后再兑换');
      return;
    }
    this.state.showLoginModal = false;
    this.state.showCardKeyModal = true;
    document.getElementById('page-container').innerHTML = this.render();
  },

  hideCardKey() {
    this.state.showCardKeyModal = false;
    document.getElementById('page-container').innerHTML = this.render();
  },

  async doVerifyCardKey() {
    const cardKey = document.getElementById('cardkey-input').value.trim();
    if (!cardKey) { UI.toast('请输入卡密'); return; }

    const userInfo = Store.getUserInfo();
    const username = userInfo.username;

    UI.showLoading('验证中...');
    try {
      const res = await API.verifyCardKey(username, cardKey);
      UI.hideLoading();

      if (res && res.success) {
        const formatted = res.expireTime ? Store.formatDate(new Date(res.expireTime)) : '';
        Store.setUserInfo({ ...userInfo, isMember: true, expireTime: formatted });
        this.state.showCardKeyModal = false;
        UI.toast('兑换成功！', 'success');
        this.onShow();
      } else {
        UI.toast(res.errMsg || '兑换失败');
      }
    } catch (err) {
      UI.hideLoading();
      UI.toast('验证失败，请重试');
    }
  },

  // ==================== 退出登录 ====================
  async logout() {
    const result = await UI.showModal({
      title: '提示',
      content: '退出登录将清空当前对话记录，确定退出吗？',
      confirmText: '退出',
      danger: true
    });
    if (result.confirm) {
      Store.clearLoginState();
      Store.saveConversations([]);
      UI.toast('已退出', 'success');
      this.onShow();
    }
  },

  _escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};
