/**
 * auth.js - 共享认证模块（登录/注册/卡密兑换）
 * 供 chat.js 和 profile.js 复用
 */

const Auth = {
  state: {
    showLoginModal: false,
    loginMode: 'login', // 'login' | 'register'
    showCardKeyModal: false
  },

  // ==================== 登录弹窗 ====================
  renderLoginModal(options) {
    const { prefix = '', showRegister = false, onClose, onLogin, onRegister, onCardKey } = options;
    const isLogin = this.state.loginMode === 'login';
    let html = '<div class="overlay" onclick="Auth.closeLogin()"></div>';
    html += '<div class="login-modal slide-up">';
    html += '<div class="login-modal-title">' + (isLogin ? '登录' : '注册') + '</div>';
    html += '<div class="login-modal-desc">' + (isLogin ? '登录后可保存聊天记录，享受无限次生成' : '注册即送1天试用会员') + '</div>';

    if (isLogin) {
      html += '<input class="login-input" id="' + prefix + 'login-username" placeholder="请输入账号" />';
      html += '<input class="login-input" id="' + prefix + 'login-password" type="password" placeholder="请输入密码" />';
      if (showRegister) {
        html += '<div class="login-submit-btn" onclick="' + onLogin + '">登录</div>';
        html += '<div class="login-switch" onclick="Auth.switchMode(\'register\')">还没有账号？去注册</div>';
        html += '<div class="login-cardkey-link" onclick="' + onCardKey + '">已有卡密？点击兑换</div>';
      } else {
        html += '<div class="login-submit-btn" onclick="' + onLogin + '">登录</div>';
        html += '<div class="login-switch" onclick="App.navigate(\'profile\')">还没有账号？去注册</div>';
        html += '<div class="login-cardkey-link" onclick="' + onCardKey + '">已有卡密？点击兑换</div>';
      }
    } else {
      html += '<input class="login-input" id="' + prefix + 'reg-username" placeholder="请输入账号（2-20字符）" />';
      html += '<input class="login-input" id="' + prefix + 'reg-password" type="password" placeholder="请输入密码（6-20字符）" />';
      html += '<input class="login-input" id="' + prefix + 'reg-password-confirm" type="password" placeholder="请确认密码" />';
      html += '<div class="login-submit-btn" onclick="' + onRegister + '">注册</div>';
      html += '<div class="login-switch" onclick="Auth.switchMode(\'login\')">已有账号？去登录</div>';
    }

    html += '<div class="login-close" onclick="' + onClose + '">取消</div>';
    html += '</div>';
    return html;
  },

  renderCardKeyModal(options) {
    const { prefix = '', onClose, onVerify } = options;
    let html = '<div class="overlay" onclick="' + onClose + '"></div>';
    html += '<div class="cardkey-modal slide-up">';
    html += '<div class="login-modal-title">卡密兑换</div>';
    html += '<div class="login-modal-desc">输入卡密，兑换30天会员</div>';
    html += '<input class="cardkey-input" id="' + prefix + 'cardkey-input" placeholder="请输入卡密，如 VIP-AB3D-K9F2" />';
    html += '<div class="cardkey-confirm-btn" onclick="' + onVerify + '">确认兑换</div>';
    html += '<div class="login-close" onclick="' + onClose + '">取消</div>';
    html += '</div>';
    return html;
  },

  showLogin() {
    this.state.showLoginModal = true;
    this.state.loginMode = 'login';
  },

  hideLogin() {
    this.state.showLoginModal = false;
  },

  closeLogin() {
    this.state.showLoginModal = false;
  },

  showCardKey() {
    this.state.showLoginModal = false;
    this.state.showCardKeyModal = true;
  },

  hideCardKey() {
    this.state.showCardKeyModal = false;
  },

  switchMode(mode) {
    this.state.loginMode = mode;
  },

  // ==================== 登录逻辑 ====================
  async doLogin(prefix) {
    const username = document.getElementById(prefix + 'login-username').value.trim();
    const password = document.getElementById(prefix + 'login-password').value.trim();

    if (!username) { UI.toast('请输入账号'); return null; }
    if (!password) { UI.toast('请输入密码'); return null; }

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
        return { success: true, username: res.username, isMember: res.isMember, expireTime: formatted };
      } else {
        UI.toast(res.errMsg || '登录失败');
        return null;
      }
    } catch (err) {
      UI.hideLoading();
      UI.toast('登录失败，请重试');
      return null;
    }
  },

  // ==================== 注册逻辑 ====================
  async doRegister(prefix) {
    const username = document.getElementById(prefix + 'reg-username').value.trim();
    const password = document.getElementById(prefix + 'reg-password').value.trim();
    const confirm = document.getElementById(prefix + 'reg-password-confirm').value.trim();

    if (!username) { UI.toast('请输入账号'); return null; }
    if (username.length < 2 || username.length > 20) { UI.toast('账号需2-20个字符'); return null; }
    if (!password) { UI.toast('请输入密码'); return null; }
    if (password.length < 6 || password.length > 20) { UI.toast('密码需6-20个字符'); return null; }
    if (password !== confirm) { UI.toast('两次密码不一致'); return null; }

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
        return { success: true, username: res.username, isMember: res.isMember, expireTime: formatted };
      } else {
        UI.toast(res.errMsg || '注册失败');
        return null;
      }
    } catch (err) {
      UI.hideLoading();
      UI.toast('注册失败，请重试');
      return null;
    }
  },

  // ==================== 卡密验证逻辑 ====================
  async doVerifyCardKey(prefix) {
    const cardKey = document.getElementById(prefix + 'cardkey-input').value.trim();
    if (!cardKey) { UI.toast('请输入卡密'); return null; }

    const userInfo = Store.getUserInfo();
    const username = userInfo.username;
    if (!username) { UI.toast('请先登录'); return null; }

    UI.showLoading('验证中...');
    try {
      const res = await API.verifyCardKey(username, cardKey);
      UI.hideLoading();

      if (res && res.success) {
        const formatted = res.expireTime ? Store.formatDate(new Date(res.expireTime)) : '';
        Store.setUserInfo({ ...userInfo, isMember: true, expireTime: formatted });
        this.state.showCardKeyModal = false;
        UI.toast('兑换成功！', 'success');
        return { success: true, expireTime: formatted };
      } else {
        UI.toast(res.errMsg || '兑换失败');
        return null;
      }
    } catch (err) {
      UI.hideLoading();
      UI.toast('验证失败，请重试');
      return null;
    }
  }
};
