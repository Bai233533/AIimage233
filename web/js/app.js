/**
 * app.js - 主应用（路由、初始化、TabBar 管理、桌面端侧边栏）
 */

const App = {
  currentRoute: '',
  currentParams: [],

  // ==================== 初始化 ====================
  async init() {
    // 设置路由
    window.addEventListener('hashchange', () => this.handleRoute());

    // 设置 TabBar
    this._setupTabBar();

    // 设置侧边栏
    this._setupSidebar();

    // 处理初始路由
    this.handleRoute();

    // 登录用户静默同步云端历史到本地
    if (Store.isLoggedIn()) {
      Store.syncHistoryFromCloud();
    }

    // 更新侧边栏用户信息
    this._updateSidebarUser();
  },

  // ==================== 路由 ====================
  navigate(route) {
    window.location.hash = '#/' + route;
  },

  handleRoute() {
    const hash = window.location.hash.slice(2) || 'home';
    const parts = hash.split('/');
    const route = parts[0];
    const params = parts.slice(1);

    this.currentRoute = route;
    this.currentParams = params;

    // 渲染导航栏和 TabBar
    this._updateTabBar(route);

    // 更新侧边栏高亮
    this._updateSidebarActive(route, params);

    // 页面路由
    switch (route) {
      case 'home':
        this._showTabBar();
        this._renderNavbar('对话', false);
        HomePage.onShow();
        break;

      case 'create':
        // 创建新对话然后跳转到聊天页
        this._showTabBar();
        const conv = Store.createConversation('新对话');
        this.navigate('chat/' + conv.id);
        break;

      case 'profile':
        this._showTabBar();
        this._renderNavbar('我的', false);
        ProfilePage.onShow();
        break;

      case 'history':
        this._hideTabBar();
        this._renderNavbar('生成历史', true);
        HistoryPage.onShow();
        break;

      case 'chat':
        this._hideTabBar();
        ChatPage.onShow(params);
        break;

      default:
        this.navigate('home');
    }
  },

  // ==================== 新建对话 ====================
  createNewChat() {
    const conv = Store.createConversation('新对话');
    this.navigate('chat/' + conv.id);
    this._refreshSidebar();
  },

  // ==================== TabBar ====================
  _setupTabBar() {
    const items = document.querySelectorAll('.tabbar-item');
    items.forEach(item => {
      const icon = item.dataset.icon;
      const label = item.dataset.label;
      item.innerHTML =
        '<div class="tabbar-item-icon">' + icon + '</div>' +
        '<div class="tabbar-item-label">' + label + '</div>';

      item.addEventListener('click', () => {
        const route = item.dataset.route;
        if (route === 'create') {
          this.navigate('create');
        } else {
          this.navigate(route);
        }
      });
    });
  },

  _updateTabBar(route) {
    const items = document.querySelectorAll('.tabbar-item');
    const indicator = document.getElementById('tabbar-indicator');

    let activeIndex = 0;
    switch (route) {
      case 'home': activeIndex = 0; break;
      case 'create': activeIndex = 1; break;
      case 'history': activeIndex = 2; break;
      case 'profile': activeIndex = 3; break;
      default: activeIndex = -1;
    }

    items.forEach((item, i) => {
      if (i === activeIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // 滑动指示条
    if (activeIndex >= 0) {
      indicator.style.transform = 'translateX(' + (activeIndex * 100) + '%)';
      indicator.style.opacity = '1';
    } else {
      indicator.style.opacity = '0';
    }
  },

  _showTabBar() {
    document.getElementById('tabbar').style.display = '';
  },

  _hideTabBar() {
    document.getElementById('tabbar').style.display = 'none';
  },

  // ==================== Navbar ====================
  _renderNavbar(title, showBack) {
    const navbar = document.getElementById('navbar');
    if (showBack) {
      navbar.innerHTML = '<div class="navbar-inner">' +
        '<div class="navbar-back" onclick="App.navigate(\'home\')">‹</div>' +
        '<div class="navbar-title">' + title + '</div>' +
        '<div style="width:36px;"></div>' +
        '</div>';
    } else {
      navbar.innerHTML = '<div class="navbar-inner">' +
        '<div style="width:36px;"></div>' +
        '<div class="navbar-title">' + title + '</div>' +
        '<div style="width:36px;"></div>' +
        '</div>';
    }
  },

  // ==================== 桌面端侧边栏 ====================
  _setupSidebar() {
    this._refreshSidebar();
  },

  _refreshSidebar() {
    const listEl = document.getElementById('sidebar-history-list');
    if (!listEl) return;

    const conversations = Store.getConversations();
    if (!conversations || conversations.length === 0) {
      listEl.innerHTML = '<div style="padding:12px;color:#BBB;font-size:13px;">暂无对话</div>';
      return;
    }

    // 按更新时间倒序
    const sorted = conversations.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    listEl.innerHTML = sorted.map(conv => {
      const title = this._escapeHtml(conv.title || '新对话');
      return '<div class="sidebar-conv-item" data-conv-id="' + conv.id + '" onclick="App._onSidebarConvClick(' + conv.id + ')">' +
        '<div class="sidebar-conv-item-dot"></div>' +
        '<div class="sidebar-conv-item-text">' + title + '</div>' +
        '</div>';
    }).join('');
  },

  _onSidebarConvClick(convId) {
    this.navigate('chat/' + convId);
  },

  _updateSidebarActive(route, params) {
    // 清除所有 active
    const items = document.querySelectorAll('.sidebar-conv-item');
    items.forEach(el => el.classList.remove('active'));

    if (route === 'chat' && params[0]) {
      const activeEl = document.querySelector('.sidebar-conv-item[data-conv-id="' + params[0] + '"]');
      if (activeEl) {
        activeEl.classList.add('active');
      }
    }

    // 刷新侧边栏列表（可能有新对话）
    this._refreshSidebar();

    // 再次高亮（因为 refresh 重建了 DOM）
    if (route === 'chat' && params[0]) {
      const activeEl2 = document.querySelector('.sidebar-conv-item[data-conv-id="' + params[0] + '"]');
      if (activeEl2) {
        activeEl2.classList.add('active');
      }
    }
  },

  _updateSidebarUser() {
    const userEl = document.getElementById('sidebar-user');
    if (!userEl) return;

    const userInfo = Store.getUserInfo();
    if (userInfo && userInfo.username) {
      const avatarEl = userEl.querySelector('.sidebar-user-avatar');
      const nameEl = userEl.querySelector('.sidebar-user-name');
      if (avatarEl) avatarEl.textContent = userInfo.username.charAt(0).toUpperCase();
      if (nameEl) nameEl.textContent = userInfo.username;
    }
  },

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
