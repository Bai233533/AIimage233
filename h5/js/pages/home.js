/**
 * pages/home.js - 首页（对话列表）
 */

const HomePage = {
  render() {
    const conversations = Store.getConversations();
    conversations.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

    let html = '<div class="home-page">';
    html += '<div class="home-header">';
    html += '<h1>对话</h1>';
    html += '<div class="home-new-btn" onclick="HomePage.newChat()">+</div>';
    html += '</div>';

    if (conversations.length === 0) {
      html += '<div class="empty-state">';
      html += '<div class="empty-state-icon">💬</div>';
      html += '<div class="empty-state-text">还没有对话，点击右上角开始</div>';
      html += '</div>';
    } else {
      html += '<div class="conversation-list">';
      conversations.forEach(conv => {
        const timeDisplay = Store.formatTimeDisplay(conv.updatedAt);
        html += '<div class="conversation-item" data-conv-id="' + conv.id + '" onclick="HomePage.openChat(\'' + conv.id + '\')">';
        html += '<div class="conversation-avatar" style="background:' + conv.color + '">' + (conv.avatarText || '新') + '</div>';
        html += '<div class="conversation-info">';
        html += '<div class="conversation-title">' + this._escape(conv.title) + '</div>';
        html += '<div class="conversation-summary">' + this._escape(conv.summary || '点击开始对话') + '</div>';
        html += '</div>';
        html += '<div style="text-align:right;">';
        if (conv.pinned) {
          html += '<div class="conversation-pin">置顶</div>';
        }
        html += '<div class="conversation-time">' + timeDisplay + '</div>';
        html += '</div>';
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  onShow() {
    document.getElementById('page-container').innerHTML = this.render();
    // 设置长按事件委托
    const container = document.getElementById('page-container');
    if (this._longPressCleanup) this._longPressCleanup();
    this._longPressCleanup = UI.setupLongPress(container, '[data-conv-id]', (target) => {
      const convId = target.dataset.convId;
      if (convId) this.onLongPress(convId);
    });
  },

  newChat() {
    const conv = Store.createConversation('新对话');
    App.navigate('chat/' + conv.id);
  },

  openChat(convId) {
    App.navigate('chat/' + convId);
  },

  async onLongPress(convId) {
    const conv = Store.getConversation(convId);
    if (!conv) return;

    const result = await UI.showActionSheet({
      title: conv.title,
      items: [
        { label: conv.pinned ? '取消置顶' : '置顶' },
        { label: '重命名' },
        { label: '删除', danger: true }
      ]
    });

    if (result.cancel) return;

    if (result.tapIndex === 0) {
      Store.updateConversation(convId, { pinned: !conv.pinned });
      UI.toast(conv.pinned ? '已取消置顶' : '已置顶');
      this.onShow();
    } else if (result.tapIndex === 1) {
      this._renameConversation(convId, conv.title);
    } else if (result.tapIndex === 2) {
      this._deleteConversation(convId, conv.title);
    }
  },

  async _renameConversation(convId, currentName) {
    const newName = prompt('请输入新名称', currentName);
    if (newName && newName.trim()) {
      Store.updateConversation(convId, { title: newName.trim(), avatarText: newName.trim()[0] });
      UI.toast('已重命名', 'success');
      this.onShow();
    }
  },

  async _deleteConversation(convId, title) {
    const result = await UI.showModal({
      title: '删除对话',
      content: '确定删除「' + title + '」？此操作不可恢复。',
      confirmText: '删除',
      danger: true
    });
    if (result.confirm) {
      Store.deleteConversation(convId);
      UI.toast('已删除', 'success');
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
