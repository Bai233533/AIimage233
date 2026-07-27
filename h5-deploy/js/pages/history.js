/**
 * pages/history.js - 生成历史页
 */

const HistoryPage = {
  state: {
    filter: 'all' // all | today | week | month
  },

  render() {
    let history = Store.getHistory();

    // 筛选
    const now = Date.now();
    if (this.state.filter === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      history = history.filter(r => new Date(r.date).getTime() >= todayStart.getTime());
    } else if (this.state.filter === 'week') {
      history = history.filter(r => now - new Date(r.date).getTime() < 7 * 24 * 60 * 60 * 1000);
    } else if (this.state.filter === 'month') {
      history = history.filter(r => now - new Date(r.date).getTime() < 30 * 24 * 60 * 60 * 1000);
    }

    let html = '<div class="history-page">';

    // 筛选条
    html += '<div class="history-filter">';
    const filters = [
      { key: 'all', label: '全部' },
      { key: 'today', label: '今天' },
      { key: 'week', label: '本周' },
      { key: 'month', label: '本月' }
    ];
    filters.forEach(f => {
      html += '<div class="history-filter-item ' + (this.state.filter === f.key ? 'active' : '') + '" onclick="HistoryPage.setFilter(\'' + f.key + '\')">' + f.label + '</div>';
    });
    html += '</div>';

    if (history.length === 0) {
      html += '<div class="empty-state">';
      html += '<div class="empty-state-icon">📸</div>';
      html += '<div class="empty-state-text">还没有生成记录</div>';
      html += '</div>';
    } else {
      // 按日期分组
      const groups = {};
      history.forEach(record => {
        const dateStr = record.date.split(' ')[0];
        if (!groups[dateStr]) groups[dateStr] = [];
        groups[dateStr].push(record);
      });

      // 按日期倒序
      const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

      sortedDates.forEach(dateStr => {
        html += '<div class="history-group">';
        html += '<div class="history-group-title">' + dateStr + '</div>';
        html += '<div class="history-grid">';

        groups[dateStr].forEach(record => {
          html += '<div class="history-grid-item" onclick="HistoryPage.previewImage(\'' + record.imageSrc + '\', \'' + dateStr + '\')">';
          html += '<img src="' + record.imageSrc + '" loading="lazy" onerror="this.src=\'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23F0F0F0%22 width=%22100%22 height=%22100%22/></svg>\'" />';
          if (record.batchTotal > 1) {
            html += '<div class="history-grid-item-badge">' + record.batchIndex + '/' + record.batchTotal + '</div>';
          }
          html += '</div>';
        });

        html += '</div>';
        html += '</div>';
      });
    }

    html += '</div>';
    return html;
  },

  onShow() {
    document.getElementById('page-container').innerHTML = this.render();
  },

  setFilter(filter) {
    this.state.filter = filter;
    this.onShow();
  },

  previewImage(src, dateStr) {
    // 获取同组所有图片
    const history = Store.getHistory();
    const group = history.filter(r => r.date.startsWith(dateStr));
    const urls = group.map(r => r.imageSrc);
    UI.previewImage(src, urls);
  }
};
