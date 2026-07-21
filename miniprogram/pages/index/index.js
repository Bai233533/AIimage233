const app = getApp();
const { generateAIPrompt, generateImage, checkImageSecurity, selectAndCheckImage } = require('../../utils/api');

Page({
  data: {
    messages: [],           // 聊天消息列表
    inputText: '',          // 输入框文本
    referenceImages: [],    // 参考图列表，最多3张
    generateCount: 0,       // 当前选择的生成数量索引
    generateCounts: ['1张', '2张', '3张', '4张', '5张', '6张'],
    showCountPicker: false, // 数量选择器展开状态
    generatingPrompt: false,// AI提示词生成中
    generating: false,      // 图片生成中
    showActionSheet: false, // 图片选择弹窗
    showModal: false,       // 生成弹窗
    modalMode: 'generating',
    modalMessage: '',
    scrollToMsg: '',        // 滚动定位
    msgIdCounter: 0,        // 消息ID计数器
    // 登录与会员
    isMember: false,        // 是否会员
    isLoggedIn: false,      // 是否已登录
    freeUsed: 0,            // 已使用免费次数
    freeLimit: 3,           // 免费次数上限
    showLoginModal: false,  // 登录弹窗
    showCardKeyModal: false,// 卡密兑换弹窗
    cardKeyInput: '',       // 卡密输入
    expireTime: ''          // 会员到期时间
  },

  onLoad() {
    // 检查会员状态
    this._checkMembership();
    // 加载免费次数
    const freeUsed = wx.getStorageSync('freeUsed') || 0;
    this.setData({ freeUsed });
    // 从云端加载历史对话
    this.loadChatHistory();
  },

  onShow() {
    // 滚动到底部
    this.scrollToBottom();
  },

  // ==================== 消息管理 ====================

  // 生成唯一消息ID
  _nextMsgId() {
    const id = this.data.msgIdCounter + 1;
    this.setData({ msgIdCounter: id });
    return id;
  },

  // 添加消息到列表
  _addMessage(msg) {
    const messages = this.data.messages.slice();
    messages.push(msg);
    this.setData({ messages });
    this.scrollToBottom();
    // 异步保存到云端
    this.saveChatHistory();
  },

  // 更新指定消息
  _updateMessage(msgId, updateData) {
    const messages = this.data.messages.slice();
    const index = messages.findIndex(m => m.id === msgId);
    if (index !== -1) {
      const key = `messages[${index}]`;
      this.setData({ [key]: Object.assign({}, messages[index], updateData) });
      this.scrollToBottom();
      this.saveChatHistory();
    }
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollToMsg: 'bottom' });
    }, 100);
  },

  // ==================== 登录与会员系统 ====================

  // 检查会员状态
  async _checkMembership() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'checkMembership' }
      });
      if (res.result && res.result.success) {
        const { isMember, isNewUser, expireTime } = res.result;
        this.setData({
          isMember,
          isLoggedIn: !isNewUser,
          expireTime: expireTime ? this._formatDate(new Date(expireTime)) : ''
        });
      }
    } catch (err) {
      console.error('检查会员状态失败:', err);
    }
  },

  // 检查是否可以生成（次数限制）
  _canGenerate() {
    if (this.data.isMember) return true;
    if (this.data.freeUsed < this.data.freeLimit) return true;
    return false;
  },

  // 显示登录弹窗
  showLogin() {
    this.setData({ showLoginModal: true });
  },

  hideLogin() {
    this.setData({ showLoginModal: false });
  },

  // 跳转到用户中心
  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  // 获取手机号登录
  async onGetPhoneNumber(e) {
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({ title: '授权取消', icon: 'none' });
      return;
    }

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
          expireTime: this._formatDate(new Date(res.result.expireTime))
        });
        wx.showToast({ title: '登录成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '登录失败', icon: 'none' });
      console.error('登录失败:', err);
    }
  },

  // 显示卡密兑换弹窗
  showCardKey() {
    this.setData({ showCardKeyModal: true, showLoginModal: false });
  },

  hideCardKey() {
    this.setData({ showCardKeyModal: false, cardKeyInput: '' });
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
        data: {
          type: 'verifyCardKey',
          cardKey
        }
      });

      wx.hideLoading();

      if (res.result && res.result.success) {
        this.setData({
          isMember: true,
          isLoggedIn: true,
          showCardKeyModal: false,
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
      console.error('卡密验证失败:', err);
    }
  },

  // ==================== 输入与发送 ====================

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  // 发送消息
  async sendMessage() {
    const text = this.data.inputText.trim();
    if (!text && this.data.referenceImages.length === 0) {
      wx.showToast({ title: '请输入提示词或上传参考图', icon: 'none' });
      return;
    }
    if (this.data.generating || this.data.generatingPrompt) {
      wx.showToast({ title: '正在生成中，请稍候', icon: 'none' });
      return;
    }

    // 检查生成次数限制
    if (!this._canGenerate()) {
      this.showLogin();
      return;
    }

    // 构建用户消息
    const userMsg = {
      id: this._nextMsgId(),
      role: 'user',
      text: text || '',
      images: this.data.referenceImages.slice(),
      time: this._formatTime(new Date())
    };
    this._addMessage(userMsg);

    // 清空输入和参考图
    const referenceImages = this.data.referenceImages.slice();
    this.setData({
      inputText: '',
      referenceImages: []
    });

    // 开始生成
    await this._doGenerate(text, referenceImages);
  },

  // 执行生成流程
  async _doGenerate(prompt, referenceImages) {
    const counts = [1, 2, 3, 4, 5, 6];
    const count = counts[this.data.generateCount];

    // 添加AI思考消息
    const aiMsgId = this._nextMsgId();
    const aiMsg = {
      id: aiMsgId,
      role: 'ai',
      text: '',
      images: [],
      thinking: true,
      thinkingText: '正在分析图片...'
    };
    this._addMessage(aiMsg);

    this.setData({ generating: true });

    try {
      // 第一步：如果有图片，用AI生成提示词；如果没有图片但有文本提示词，直接用
      let fullPromptContent = prompt;
      let displayText = prompt;

      if (prompt) {
        // 用户输入了提示词，直接使用
        fullPromptContent = prompt;
        displayText = prompt;
        this._updateMessage(aiMsgId, { thinkingText: '正在生成图片...' });
      } else if (referenceImages.length > 0) {
        // 有参考图但没有文字提示词，用AI识别图片生成提示词
        this._updateMessage(aiMsgId, { thinkingText: '正在识别参考图...' });

        const aiResult = await generateAIPrompt({
          imageSrc: referenceImages[0],
          referenceImages: referenceImages.length > 1 ? referenceImages.slice(1) : null,
          count: count
        });
        fullPromptContent = aiResult.fullContent;
        displayText = aiResult.prompt;
        this._updateMessage(aiMsgId, { thinkingText: '正在生成图片...' });
      } else {
        throw new Error('请输入提示词或上传参考图');
      }

      // 第二步：生成图片
      const imageSrc = referenceImages.length > 0 ? referenceImages[0] : null;
      const extraRefs = referenceImages.length > 1 ? referenceImages.slice(1) : null;
      const images = await generateImage(fullPromptContent, count, imageSrc, extraRefs);

      // 第三步：下载图片并上传到云存储
      wx.showLoading({ title: '正在保存图片...' });
      const savedImages = [];
      const now = new Date();

      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i].url || images[i].b64_json;
        let finalUrl = imageUrl;

        if (imageUrl && imageUrl.startsWith('http')) {
          try {
            wx.showLoading({ title: `正在保存第${i + 1}张...` });
            const localPath = await this._downloadImage(imageUrl);
            const cloudFileID = await this._uploadToCloud(localPath);
            finalUrl = cloudFileID;
          } catch (err) {
            console.error(`图片${i + 1}保存失败:`, err);
            finalUrl = imageUrl;
          }
        }

        savedImages.push({ url: finalUrl });
      }

      wx.hideLoading();

      // 保存到历史记录
      this._saveToHistory(savedImages, prompt, referenceImages);

      // 更新AI消息为完成状态
      this._updateMessage(aiMsgId, {
        thinking: false,
        text: displayText ? `已为您生成${images.length}张图片` : '',
        images: savedImages
      });

      // 增加免费使用次数（非会员时）
      if (!this.data.isMember) {
        const freeUsed = this.data.freeUsed + 1;
        this.setData({ freeUsed });
        wx.setStorageSync('freeUsed', freeUsed);
      }

    } catch (error) {
      console.error('生成失败:', error);
      wx.hideLoading();
      this._updateMessage(aiMsgId, {
        thinking: false,
        text: '生成失败：' + (error.message || '请重试'),
        images: []
      });
    } finally {
      this.setData({ generating: false });
    }
  },

  // ==================== 图片选择 ====================

  // 加号按钮 - 显示选择弹窗
  onPlusAction() {
    if (this.data.referenceImages.length >= 3) {
      wx.showToast({ title: '最多上传3张参考图', icon: 'none' });
      return;
    }
    this.setData({ showActionSheet: true });
  },

  hideActionSheet() {
    this.setData({ showActionSheet: false });
  },

  // 左侧拍照按钮
  takePhoto() {
    this.setData({ showActionSheet: false });
    this._selectImage(['camera']);
  },

  // 从相册选择
  chooseFromAlbum() {
    this.setData({ showActionSheet: false });
    this._selectImage(['album']);
  },

  // 添加参考图（预览区的+号）
  addReferenceImage() {
    this._selectImage(['album', 'camera']);
  },

  // 统一的图片选择逻辑
  async _selectImage(sourceType) {
    if (this.data.referenceImages.length >= 3) {
      wx.showToast({ title: '最多上传3张参考图', icon: 'none' });
      return;
    }

    const result = await selectAndCheckImage({ sourceType });
    if (result) {
      const referenceImages = this.data.referenceImages.slice();
      referenceImages.push(result.tempPath);
      this.setData({ referenceImages });
    }
  },

  // 删除参考图
  removeReferenceImage(e) {
    const index = e.currentTarget.dataset.index;
    const referenceImages = this.data.referenceImages.slice();
    referenceImages.splice(index, 1);
    this.setData({ referenceImages });
  },

  // ==================== 数量选择 ====================

  toggleCountPicker() {
    this.setData({ showCountPicker: !this.data.showCountPicker });
  },

  selectCount(e) {
    this.setData({
      generateCount: e.currentTarget.dataset.index,
      showCountPicker: false
    });
  },

  // ==================== AI生成提示词 ====================

  async onGenerateAIPrompt() {
    if (this.data.referenceImages.length === 0) {
      wx.showToast({ title: '请先上传参考图', icon: 'none' });
      return;
    }
    if (this.data.generatingPrompt) {
      wx.showToast({ title: '正在生成中，请稍候', icon: 'none' });
      return;
    }

    // 检查生成次数限制
    if (!this._canGenerate()) {
      this.showLogin();
      return;
    }

    this.setData({ generatingPrompt: true });

    try {
      const counts = [1, 2, 3, 4, 5, 6];
      const promptCount = counts[this.data.generateCount];

      const result = await generateAIPrompt({
        imageSrc: this.data.referenceImages[0],
        referenceImages: this.data.referenceImages.length > 1 ? this.data.referenceImages.slice(1) : null,
        count: promptCount
      });

      this.setData({
        inputText: result.prompt,
        generatingPrompt: false
      });
      wx.showToast({ title: '提示词已生成', icon: 'success' });
    } catch (error) {
      this.setData({ generatingPrompt: false });
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      console.error('AI提示词生成失败:', error);
    }
  },

  // ==================== 图片预览 ====================

  previewImage(e) {
    const src = e.currentTarget.dataset.src;
    const allImages = this.data.messages.reduce((acc, msg) => {
      if (msg.images) {
        msg.images.forEach(img => {
          if (img.url) acc.push(img.url);
        });
      }
      if (msg.images && !msg.images[0]?.url) {
        acc.push(...msg.images);
      }
      return acc;
    }, []);

    wx.previewImage({
      current: src,
      urls: allImages.length > 0 ? allImages : [src]
    });
  },

  // ==================== 保存图片 ====================

  async saveImages(e) {
    const msgId = e.currentTarget.dataset.msgId;
    const msg = this.data.messages.find(m => m.id === msgId);
    if (!msg || !msg.images || msg.images.length === 0) return;

    wx.showLoading({ title: '保存中...' });
    let savedCount = 0;

    for (const img of msg.images) {
      try {
        const url = img.url;
        if (url && url.startsWith('http')) {
          const localPath = await this._downloadImage(url);
          await this._saveToAlbum(localPath);
          savedCount++;
        } else if (url && url.startsWith('cloud://')) {
          // 云存储文件，先下载再保存
          const tempPath = await this._downloadCloudFile(url);
          await this._saveToAlbum(tempPath);
          savedCount++;
        }
      } catch (err) {
        console.error('保存图片失败:', err);
      }
    }

    wx.hideLoading();
    if (savedCount > 0) {
      wx.showToast({ title: `已保存${savedCount}张图片`, icon: 'success' });
    } else {
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },

  _saveToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: (err) => {
          if (err.errMsg.indexOf('auth deny') !== -1 || err.errMsg.indexOf('authorize') !== -1) {
            wx.showModal({
              title: '提示',
              content: '需要您授权保存图片到相册',
              success: (res) => {
                if (res.confirm) {
                  wx.openSetting();
                }
              }
            });
          }
          reject(err);
        }
      });
    });
  },

  // ==================== 弹窗 ====================

  onModalConfirm() {
    if (this.data.modalMode === 'generating') {
      this.setData({ showModal: false });
    } else {
      this.setData({ showModal: false });
    }
  },

  onModalView() {
    this.setData({ showModal: false });
    wx.switchTab({ url: '/pages/history/history' });
  },

  // ==================== 工具方法 ====================

  _downloadImage(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error('下载失败'));
          }
        },
        fail: reject
      });
    });
  },

  _downloadCloudFile(fileID) {
    return new Promise((resolve, reject) => {
      wx.cloud.downloadFile({
        fileID,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      });
    });
  },

  _uploadToCloud(localPath) {
    return new Promise((resolve, reject) => {
      const cloudPath = `generated-images/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
      wx.cloud.uploadFile({
        cloudPath,
        filePath: localPath,
        success: (res) => resolve(res.fileID),
        fail: reject
      });
    });
  },

  _formatTime(date) {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  },

  _formatDate(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}`;
  },

  // ==================== 云端持久化 ====================

  saveChatHistory() {
    const messages = this.data.messages;
    if (messages.length === 0) return;

    // 保存到本地存储
    wx.setStorageSync('chatMessages', messages);

    // 保存到云端（异步，不阻塞）
    try {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'saveChatHistory',
          messages: messages
        }
      }).catch(err => {
        console.error('云端保存失败:', err);
      });
    } catch (e) {
      console.error('云端保存调用失败:', e);
    }
  },

  loadChatHistory() {
    // 优先从本地存储加载
    const localMessages = wx.getStorageSync('chatMessages');
    if (localMessages && localMessages.length > 0) {
      const maxId = localMessages.reduce((max, m) => Math.max(max, m.id || 0), 0);
      this.setData({
        messages: localMessages,
        msgIdCounter: maxId
      });
      this.scrollToBottom();
    }

    // 尝试从云端同步（异步）
    try {
      wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'getChatHistory'
        }
      }).then(res => {
        if (res.result && res.result.messages && res.result.messages.length > 0) {
          // 云端数据更新则覆盖本地
          if (res.result.messages.length >= localMessages.length) {
            const maxId = res.result.messages.reduce((max, m) => Math.max(max, m.id || 0), 0);
            this.setData({
              messages: res.result.messages,
              msgIdCounter: maxId
            });
            wx.setStorageSync('chatMessages', res.result.messages);
            this.scrollToBottom();
          }
        }
      }).catch(err => {
        console.error('云端加载失败:', err);
      });
    } catch (e) {
      console.error('云端加载调用失败:', e);
    }
  },

  // 保存到历史记录（兼容原有历史记录功能）
  _saveToHistory(images, prompt, referenceImages) {
    const now = new Date();
    const groupId = Date.now();
    const newRecords = [];

    for (let i = 0; i < images.length; i++) {
      newRecords.push({
        id: Date.now() + i,
        groupId,
        imageSrc: images[i].url,
        imageUrl: images[i].url,
        referenceImages: referenceImages,
        prompt: prompt,
        date: this._formatDate(now),
        type: 'AI漫剧生成',
        batchIndex: i + 1,
        batchTotal: images.length
      });
    }

    let history = wx.getStorageSync('generationHistory') || [];
    history = newRecords.concat(history);
    wx.setStorageSync('generationHistory', history);
    app.globalData.history = history;
  }
});
