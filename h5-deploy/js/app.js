/**
 * app.js - 主应用（路由、初始化、TabBar 管理）
 */

const App = {
  currentRoute: '',
  currentParams: [],

  // ==================== 初始化 ====================
  async init() {
    // 初始化 CloudBase SDK
    try {
      await API.init();
    } catch (err) {
      console.error('[App] CloudBase 初始化失败:', err);
    }

    // 设置路由
    window.addEventListener('hashchange', () => this.handleRoute());

    // 设置 TabBar
    this._setupTabBar();

    // 处理初始路由
    this.handleRoute();
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

      case 'clouddrive':
        this._showTabBar();
        this._renderNavbar('云盘', false);
        document.getElementById('page-container').innerHTML =
          '<div class="empty-state"><div class="empty-state-icon">☁️</div><div class="empty-state-text">云盘功能开发中...</div></div>';
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
      case 'clouddrive': activeIndex = 2; break;
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
        '<div class="navbar-back" onclick="App.navigate(\'profile\')">‹</div>' +
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
  }
};

// ==================== 启动 ====================
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
