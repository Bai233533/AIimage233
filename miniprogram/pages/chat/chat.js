const app = getApp();
const { generateAIPrompt, generateAIPromptFromText, generateImage, chatWithAI, checkImageSecurity, selectAndCheckImage } = require('../../utils/api');
const conversationManager = require('../index/index');

Page({
  data: {
    conversationId: '',
    conversationTitle: '新对话',
    statusBarHeight: 20,
    navBarHeight: 44,
    messages: [],
    inputText: '',
    referenceImages: [],
    generateCount: 0,
    generateCounts: ['1张', '2张', '3张', '4张', '5张', '6张'],
    showCountPicker: false,
    generatingPrompt: false,
    generating: false,
    showActionSheet: false,
    showModal: false,
    modalMode: 'generating',
    modalMessage: '',
    scrollToMsg: '',
    msgIdCounter: 0,
    isMember: false,
    isLoggedIn: false,
    freeUsed: 0,
    freeLimit: 3,
    showLoginModal: false,
    showCardKeyModal: false,
    cardKeyInput: '',
    expireTime: '',
    loginUsername: '',
    loginPassword: ''
  },

  onLoad(options) {
    const conversationId = options.conversationId || '';
    this.setData({
      conversationId,
      statusBarHeight: app.globalData.statusBarHeight || 20,
      navBarHeight: app.globalData.navBarHeight || 44
    });

    // 加载该对话的消息
    if (conversationId) {
      const conv = conversationManager.getConversation(conversationId);
      if (conv) {
        const messages = conv.messages || [];
        const maxId = messages.reduce((max, m) => Math.max(max, m.id || 0), 0);
        this.setData({
          conversationTitle: conv.title,
          messages,
          msgIdCounter: maxId
        });
      }
    }

    this._checkMembership();
    const freeUsed = wx.getStorageSync('freeUsed') || 0;
    this.setData({ freeUsed });
    this.scrollToBottom();
  },

  onShow() {
    this.scrollToBottom();
  },

  onUnload() {
    // 页面卸载时保存对话
    this._saveConversationToStorage();
  },

  // ==================== 返回 ====================

  onGoBack() {
    // 先保存当前对话
    this._saveConversationToStorage();
    wx.navigateBack({ delta: 1 });
  },

  // ==================== 消息管理 ====================

  _nextMsgId() {
    const id = this.data.msgIdCounter + 1;
    this.setData({ msgIdCounter: id });
    return id;
  },

  _addMessage(msg) {
    const messages = this.data.messages.slice();
    messages.push(msg);
    this.setData({ messages });
    this.scrollToBottom();
    this._saveConversationToStorage();
  },

  _updateMessage(msgId, updateData) {
    const messages = this.data.messages.slice();
    const index = messages.findIndex(m => m.id === msgId);
    if (index !== -1) {
      const key = `messages[${index}]`;
      this.setData({ [key]: Object.assign({}, messages[index], updateData) });
      this.scrollToBottom();
      this._saveConversationToStorage();
    }
  },

  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollToMsg: 'bottom' });
    }, 100);
  },

  // ==================== 长按删除消息 ====================

  onMessageLongPress(e) {
    const msgId = e.currentTarget.dataset.msgId;
    const msg = this.data.messages.find(m => m.id === msgId);
    if (!msg) return;
    // 正在生成中的消息不允许删除
    if (msg.thinking) return;

    wx.showActionSheet({
      itemList: ['删除此消息'],
      itemColor: '#e74c3c',
      success: (res) => {
        if (res.tapIndex === 0) {
          this._deleteMessage(msgId);
        }
      }
    });
  },

  _deleteMessage(msgId) {
    const messages = this.data.messages.filter(m => m.id !== msgId);
    this.setData({ messages });
    this._saveConversationToStorage();
    wx.showToast({ title: '已删除', icon: 'success' });
  },

  // ==================== 对话持久化 ====================

  _saveConversationToStorage() {
    const { conversationId, messages, conversationTitle } = this.data;
    if (!conversationId) return;

    // 生成摘要（取最后一条用户消息或AI消息）
    let summary = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'user' && msg.text) {
        summary = msg.text;
        break;
      }
      if (msg.role === 'ai' && msg.text && !msg.thinking) {
        summary = msg.text;
        break;
      }
    }

    // 自动更新对话标题（第一条用户消息）
    let title = conversationTitle;
    if (title === '新对话') {
      const firstUserMsg = messages.find(m => m.role === 'user' && m.text);
      if (firstUserMsg) {
        title = firstUserMsg.text.slice(0, 20);
        this.setData({ conversationTitle: title });
      }
    }

    conversationManager.updateConversation(conversationId, {
      title,
      summary: summary.slice(0, 50),
      messages,
      avatarText: title[0] || '新'
    });
  },

  // ==================== 登录与会员 ====================

  async _checkMembership() {
    try {
      // 未登录时不调用云端检查，使用本地状态
      if (!wx.getStorageSync('userToken')) {
        this.setData({ isMember: false, isLoggedIn: false });
        return;
      }

      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'checkMembership' }
      });
      if (res.result && res.result.success) {
        const { isMember, isNewUser, expireTime } = res.result;
        // 新用户不自动设为已登录
        if (isNewUser) {
          this.setData({ isMember: false, isLoggedIn: false });
          return;
        }
        this.setData({
          isMember,
          isLoggedIn: true,
          expireTime: expireTime ? this._formatDate(new Date(expireTime)) : ''
        });
        // 同步本地缓存
        const userInfo = wx.getStorageSync('userInfo') || {};
        userInfo.isMember = isMember;
        wx.setStorageSync('userInfo', userInfo);
      }
    } catch (err) {
      console.error('检查会员状态失败:', err);
    }
  },

  _canGenerate() {
    if (this.data.isMember) return true;
    if (this.data.freeUsed < this.data.freeLimit) return true;
    return false;
  },

  showLogin() {
    this.setData({ showLoginModal: true });
  },

  hideLogin() {
    this.setData({ showLoginModal: false, loginUsername: '', loginPassword: '' });
  },

  goToProfile() {
    this.setData({ showLoginModal: false });
    wx.switchTab({ url: '/pages/profile/profile' });
  },

  // ==================== 分镜预览弹窗 ====================

  onPreviewConfirm() {
    this.setData({
      inputText: this.data.previewPromptText,
      showPromptPreview: false,
      previewPromptText: ''
    });
  },

  onPreviewCancel() {
    this.setData({ showPromptPreview: false, previewPromptText: '' });
  },

  async onPreviewRetry() {
    this.setData({ showPromptPreview: false });
    await this.onGenerateAIPrompt();
  },

  onLoginUsernameInput(e) { this.setData({ loginUsername: e.detail.value }); },
  onLoginPasswordInput(e) { this.setData({ loginPassword: e.detail.value }); },

  async onPasswordLogin() {
    const username = this.data.loginUsername.trim();
    const password = this.data.loginPassword.trim();
    if (!username) { wx.showToast({ title: '请输入账号', icon: 'none' }); return; }
    if (!password) { wx.showToast({ title: '请输入密码', icon: 'none' }); return; }

    wx.showLoading({ title: '登录中...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'userLoginByPassword', action: 'login', username, password }
      });
      wx.hideLoading();
      if (res.result && res.result.success) {
        const { username: uname, isMember, expireTime } = res.result;
        const formatted = expireTime ? this._formatDate(new Date(expireTime)) : '';
        this.setData({
          isLoggedIn: true, isMember, showLoginModal: false,
          username: uname, expireTime: formatted,
          loginUsername: '', loginPassword: ''
        });
        wx.setStorageSync('userToken', res.result.token || 'local_' + Date.now());
        wx.setStorageSync('userInfo', { username: uname, isMember, expireTime: formatted });
        wx.showToast({ title: '登录成功', icon: 'success' });
      } else {
        wx.showToast({ title: res.result.errMsg || '登录失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('[登录] 异常:', err);
      wx.showToast({ title: '登录失败，请重试', icon: 'none' });
    }
  },

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

  showCardKey() {
    this.setData({ showCardKeyModal: true, showLoginModal: false });
  },

  hideCardKey() {
    this.setData({ showCardKeyModal: false, cardKeyInput: '' });
  },

  onCardKeyInput(e) {
    this.setData({ cardKeyInput: e.detail.value });
  },

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
        data: { type: 'verifyCardKey', cardKey }
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

    if (!this._canGenerate()) {
      this.showLogin();
      return;
    }

    // 未登录用户每次发言扣减一次免费次数
    if (!this.data.isMember) {
      const freeUsed = this.data.freeUsed + 1;
      this.setData({ freeUsed });
      wx.setStorageSync('freeUsed', freeUsed);
    }

    const userMsg = {
      id: this._nextMsgId(),
      role: 'user',
      text: text || '',
      images: this.data.referenceImages.slice(),
      time: this._formatTime(new Date())
    };
    this._addMessage(userMsg);

    const referenceImages = this.data.referenceImages.slice();
    this.setData({ inputText: '', referenceImages: [] });

    await this._doGenerate(text, referenceImages);
  },

  async _doGenerate(prompt, referenceImages) {
    const counts = [1, 2, 3, 4, 5, 6];
    const count = counts[this.data.generateCount];

    const hasText = !!prompt;
    const hasImages = referenceImages.length > 0;

    // ==================== 场景1：纯文字对话（无图片） ====================
    if (hasText && !hasImages) {
      await this._chatReply(prompt);
      return;
    }

    // ==================== 场景2/3：有图片，走生图流程 ====================
    const aiMsgId = this._nextMsgId();
    const aiMsg = {
      id: aiMsgId,
      role: 'ai',
      text: '',
      images: [],
      thinking: true,
      thinkingText: '正在识别图片...'
    };
    this._addMessage(aiMsg);

    this.setData({ generating: true });

    try {
      let fullPromptContent = prompt;
      let displayText = prompt;

      if (hasText && hasImages) {
        // 场景2：文字 + 图片 → 直接用文字生成图片
        fullPromptContent = prompt;
        displayText = prompt;
        this._updateMessage(aiMsgId, { thinkingText: '正在生成图片...' });
      } else if (hasImages) {
        // 场景3：只有图片，没有文字 → 调用大模型识别图片生成提示词
        this._updateMessage(aiMsgId, { thinkingText: '正在识别参考图...' });

        const aiResult = await generateAIPrompt({
          imageSrc: referenceImages[0],
          referenceImages: referenceImages.length > 1 ? referenceImages.slice(1) : null,
          count: count
        });
        fullPromptContent = aiResult.fullContent;
        displayText = aiResult.prompt;
        this._updateMessage(aiMsgId, { thinkingText: '正在生成图片...' });
      }

      const imageSrc = referenceImages.length > 0 ? referenceImages[0] : null;
      const extraRefs = referenceImages.length > 1 ? referenceImages.slice(1) : null;
      const images = await generateImage(fullPromptContent, count, imageSrc, extraRefs);

      wx.showLoading({ title: '正在保存图片...' });
      const savedImages = [];

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

      this._saveToHistory(savedImages, prompt, referenceImages);

      this._updateMessage(aiMsgId, {
        thinking: false,
        text: displayText ? `已为您生成${images.length}张图片` : '',
        images: savedImages
      });

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

  // ==================== 纯文字AI对话 ====================

  async _chatReply(userText) {
    const aiMsgId = this._nextMsgId();
    this._addMessage({
      id: aiMsgId,
      role: 'ai',
      text: '',
      images: [],
      thinking: true,
      thinkingText: 'AI 正在思考...'
    });

    this.setData({ generating: true });

    try {
      // 检测用户是否在描述画面（触发生图）
      const isImageRequest = this._detectImageIntent(userText);

      if (isImageRequest) {
        // 用户在描述画面 → 分析 + 生图
        this._updateMessage(aiMsgId, { thinkingText: '正在分析描述并生成图片...' });

        const analysisPrompt = `用户描述了一段画面，请先简要分析这个画面的核心要素（30字以内），然后直接输出优化后的完整提示词（保留所有细节描述）。

用户描述：${userText}

输出格式：
【分析】xxx
【提示词】xxx`;

        const analysis = await chatWithAI([
          { role: 'user', text: analysisPrompt }
        ]);

        let analysisText = '';
        let optimizedPrompt = userText;
        const analysisStr = String(analysis || '');
        const analysisMatch = analysisStr.match(/【分析】([\s\S]*?)(?=【提示词】|$)/);
        const promptMatch = analysisStr.match(/【提示词】([\s\S]*?)$/);
        if (analysisMatch) analysisText = analysisMatch[1].trim();
        if (promptMatch) optimizedPrompt = String(promptMatch[1]).trim();
        
        // 确保提示词是字符串且非空
        optimizedPrompt = String(optimizedPrompt || userText || '');

        // 确保提示词非空
        if (!optimizedPrompt || optimizedPrompt.length < 2) {
          optimizedPrompt = userText;
        }

        this._updateMessage(aiMsgId, {
          thinking: false,
          text: analysisText ? `画面分析：${analysisText}\n\n优化提示词：${optimizedPrompt}` : optimizedPrompt,
          images: []
        });

        // 调用生图
        this._updateMessage(aiMsgId, { thinking: true, thinkingText: '正在生成图片...' });

        try {
          const result = await generateImage({
            prompt: optimizedPrompt,
            count: [1, 2, 3, 4, 5, 6][this.data.generateCount]
          });

          // generateImage 成功时返回图片数组 [{url, b64_json}]
          if (result && Array.isArray(result) && result.length > 0) {
            this._updateMessage(aiMsgId, {
              thinking: false,
              images: result,
              prompt: optimizedPrompt
            });
          } else {
            this._updateMessage(aiMsgId, {
              thinking: false,
              text: `已为您分析画面描述，但图片生成失败\n\n优化提示词：${optimizedPrompt}`
            });
          }
        } catch (imgErr) {
          console.error('[生图] 失败:', imgErr);
          this._updateMessage(aiMsgId, {
            thinking: false,
            text: `图片生成失败：${imgErr.message || '请重试'}\n\n优化提示词：${optimizedPrompt}`
          });
        }

        this._saveConversationToStorage();
        this.setData({ generating: false });
        this.scrollToBottom();
      } else {
        // 普通对话 → 文字回复
        const recentMessages = this.data.messages
          .filter(m => m.role === 'user' || (m.role === 'ai' && m.text && !m.thinking))
          .slice(-10);

        const reply = await chatWithAI(recentMessages);

        this._updateMessage(aiMsgId, {
          thinking: false,
          text: reply,
          images: []
        });
      }
    } catch (error) {
      console.error('[AI对话] 失败:', error);
      this._updateMessage(aiMsgId, {
        thinking: false,
        text: '回复失败：' + (error.message || '请重试'),
        images: []
      });
    } finally {
      this.setData({ generating: false });
    }
  },

  // 检测用户是否在描述画面（触发生图）
  _detectImageIntent(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    const imageKeywords = [
      '分镜', '画面', '场景', '背景', '镜头', '景别',
      '特写', '全景', '近景', '远景', '俯拍', '仰拍',
      '竖屏', '横屏', '9:16', '16:9', '4:3',
      '色调', '光影', '氛围', '风格', '画风',
      '生成', '生图', '出图', '画一张', '帮我画',
      '动漫', '插画', '3D', '写实', '水彩', '像素',
      '人物', '角色', '产品', '商品', '食物', '风景',
      '背景虚化', '逆光', '暖色', '冷色', '霓虹'
    ];
    return imageKeywords.some(kw => lower.includes(kw));
  },

  // ==================== 图片选择 ====================

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

  takePhoto() {
    this.setData({ showActionSheet: false });
    this._selectImage(['camera']);
  },

  chooseFromAlbum() {
    this.setData({ showActionSheet: false });
    this._selectImage(['album']);
  },

  addReferenceImage() {
    this._selectImage(['album', 'camera']);
  },

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
    if (this.data.generatingPrompt) {
      wx.showToast({ title: '正在生成中，请稍候', icon: 'none' });
      return;
    }

    const hasImages = this.data.referenceImages.length > 0;
    const hasText = this.data.inputText.trim().length > 0;

    if (!hasImages && !hasText) {
      wx.showToast({ title: '请上传参考图或输入内容描述', icon: 'none' });
      return;
    }

    if (!this._canGenerate()) {
      this.showLogin();
      return;
    }

    this.setData({ generatingPrompt: true });

    try {
      const counts = [1, 2, 3, 4, 5, 6];
      const promptCount = counts[this.data.generateCount];
      const userText = this.data.inputText.trim();

      let result;

      if (hasImages) {
        // 有图片：走图片识别+分镜生成
        result = await generateAIPrompt({
          imageSrc: this.data.referenceImages[0],
          referenceImages: this.data.referenceImages.length > 1 ? this.data.referenceImages.slice(1) : null,
          count: promptCount,
          userPrompt: userText || null
        });
      } else {
        // 无图片，纯文字：大模型根据文字描述生成分镜提示词
        result = await generateAIPromptFromText({
          userPrompt: userText,
          count: promptCount
        });
      }

      this.setData({
        generatingPrompt: false,
        previewPromptText: result.prompt,
        showPromptPreview: true
      });
    } catch (error) {
      this.setData({ generatingPrompt: false });
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      console.error('分镜提示词生成失败:', error);
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
    this.setData({ showModal: false });
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
