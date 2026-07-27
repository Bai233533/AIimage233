/**
 * pages/profile.js - 个人中心页（登录/注册/卡密兑换/会员状态）
 */

const ProfilePage = {
  // 状态（认证状态由 Auth 模块管理）

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

    // 弹窗（使用 Auth 共享模块）
    if (Auth.state.showLoginModal) {
      html += Auth.renderLoginModal({
        prefix: 'profile-',
        showRegister: true,
        onClose: 'ProfilePage.hideLogin()',
        onLogin: 'ProfilePage.doLogin()',
        onRegister: 'ProfilePage.doRegister()',
        onCardKey: 'ProfilePage.showCardKey()'
      });
    }
    if (Auth.state.showCardKeyModal) {
      html += Auth.renderCardKeyModal({
        prefix: 'profile-',
        onClose: 'ProfilePage.hideCardKey()',
        onVerify: 'ProfilePage.doVerifyCardKey()'
      });
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

  // ==================== 登录弹窗（委托 Auth 模块） ====================
  showLogin() {
    Auth.showLogin();
    document.getElementById('page-container').innerHTML = this.render();
  },

  hideLogin() {
    Auth.hideLogin();
    document.getElementById('page-container').innerHTML = this.render();
  },

  async doLogin() {
    const result = await Auth.doLogin('profile-');
    if (result) {
      this.onShow();
    }
  },

  async doRegister() {
    const result = await Auth.doRegister('profile-');
    if (result) {
      this.onShow();
    }
  },

  // ==================== 卡密弹窗（委托 Auth 模块） ====================
  showCardKey() {
    if (!Store.isLoggedIn()) {
      UI.toast('请先登录后再兑换');
      return;
    }
    Auth.showCardKey();
    document.getElementById('page-container').innerHTML = this.render();
  },

  hideCardKey() {
    Auth.hideCardKey();
    document.getElementById('page-container').innerHTML = this.render();
  },

  async doVerifyCardKey() {
    const result = await Auth.doVerifyCardKey('profile-');
    if (result) {
      this.onShow();
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
