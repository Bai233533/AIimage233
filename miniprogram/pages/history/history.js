const app = getApp();

Page({
  data: {
    historyList: [],
    filteredList: [],
    groupedHistory: [],
    isEmpty: true,
    timeRanges: ['全部', '今天', '本周', '本月'],
    timeRangeIndex: 0,
    expandedGroups: {}
  },

  onShow() {
    this.loadHistory();
  },

  loadHistory() {
    let history = wx.getStorageSync('generationHistory') || [];
    
    // 旧云环境数据清理（仅执行一次）
    const cleanupFlag = 'oldEnvDataCleaned_v1';
    if (!wx.getStorageSync(cleanupFlag)) {
      const oldEnv = 'cloud1-d1gry8qpxaef1c037';
      const hasOldData = history.some(item => 
        (item.imageSrc && item.imageSrc.includes(oldEnv)) ||
        (item.cloudFileID && item.cloudFileID.includes(oldEnv))
      );
      
      if (hasOldData) {
        history = history.filter(item => {
          const imageSrc = item.imageSrc || '';
          const cloudFileID = item.cloudFileID || '';
          return !imageSrc.includes(oldEnv) && !cloudFileID.includes(oldEnv);
        });
        wx.setStorageSync('generationHistory', history);
      }
      wx.setStorageSync(cleanupFlag, true);
    }

    this.setData({
      historyList: history,
      isEmpty: history.length === 0
    });
    this.filterByTime();
  },

  // 选择时间范围
  selectTimeRange(e) {
    this.setData({ timeRangeIndex: e.currentTarget.dataset.index });
    this.filterByTime();
  },

  // 根据时间筛选
  filterByTime() {
    const { historyList, timeRangeIndex, timeRanges } = this.data;
    const now = new Date();
    let filtered = historyList.slice();

    if (timeRangeIndex > 0) {
      filtered = historyList.filter(item => {
        const itemDate = new Date(item.date);
        switch (timeRanges[timeRangeIndex]) {
          case '今天':
            return this.isSameDay(itemDate, now);
          case '本周':
            return this.isSameWeek(itemDate, now);
          case '本月':
            return this.isSameMonth(itemDate, now);
          default:
            return true;
        }
      });
    }

    this.setData({
      filteredList: filtered,
      isEmpty: filtered.length === 0
    });
    this.groupByBatch(filtered);
  },

  // 按批次分组
  groupByBatch(list) {
    const groupMap = {};
    const groupOrder = [];

    list.forEach(item => {
      const gid = item.groupId || item.id;
      if (!groupMap[gid]) {
        groupMap[gid] = {
          groupId: gid,
          date: item.date,
          ratio: item.ratio,
          platform: item.platform,
          count: 0,
          images: [],
          isSingle: true
        };
        groupOrder.push(gid);
      }
      groupMap[gid].count++;
      groupMap[gid].images.push(item);
      groupMap[gid].isSingle = groupMap[gid].count === 1;
    });

    const groupedHistory = groupOrder.map(gid => groupMap[gid]);
    this.setData({ groupedHistory });
  },

  // 展开/收起分组
  toggleGroup(e) {
    const groupId = e.currentTarget.dataset.groupid;
    const expandedGroups = Object.assign({}, this.data.expandedGroups);
    expandedGroups[groupId] = !expandedGroups[groupId];
    this.setData({ expandedGroups });
  },

  // 点击图片跳转详情（单张）
  viewDetail(e) {
    const item = e.currentTarget.dataset.item;
    wx.setStorageSync('currentDetail', item);
    wx.setStorageSync('currentBatchImages', [item]);
    wx.navigateTo({
      url: '/pages/detail/detail'
    });
  },

  // 点击分组图片跳转详情
  viewGroupDetail(e) {
    const groupId = e.currentTarget.dataset.groupid;
    const group = this.data.groupedHistory.find(g => g.groupId === groupId);
    if (group) {
      wx.setStorageSync('currentDetail', group.images[0]);
      wx.setStorageSync('currentBatchImages', group.images);
      wx.navigateTo({
        url: '/pages/detail/detail'
      });
    }
  },

  // 点击展开后的单张图片
  viewImage(e) {
    const item = e.currentTarget.dataset.item;
    const groupId = e.currentTarget.dataset.groupid;
    const group = this.data.groupedHistory.find(g => g.groupId === groupId);
    const images = group ? group.images : [item];
    
    wx.setStorageSync('currentDetail', item);
    wx.setStorageSync('currentBatchImages', images);
    wx.navigateTo({
      url: '/pages/detail/detail'
    });
  },

  isSameDay(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  },

  isSameWeek(d1, d2) {
    const startOfWeek = new Date(d2);
    startOfWeek.setDate(d2.getDate() - d2.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return d1 >= startOfWeek && d1 <= d2;
  },

  isSameMonth(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth();
  },

  // 清空历史记录
  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清空所有历史记录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('generationHistory');
          app.globalData.history = [];
          this.setData({
            historyList: [],
            filteredList: [],
            groupedHistory: [],
            isEmpty: true
          });
          wx.showToast({ title: '已清空', icon: 'success' });
        }
      }
    });
  },

  // 图片加载失败处理
  onImageError(e) {
    const { index, groupIndex } = e.currentTarget.dataset;
    const groupedHistory = this.data.groupedHistory.slice();
    
    if (groupedHistory[groupIndex]) {
      const group = groupedHistory[groupIndex];
      if (group.images && group.images[index]) {
        group.images[index].loadError = true;
        this.setData({ groupedHistory });
      }
    }
  }
});
