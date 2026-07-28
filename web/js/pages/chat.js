/**
 * pages/chat.js - 对话生成页（核心页面）
 * 
 * 三种生成场景：
 * 1. 纯文字对话（检测画面意图→生图 or 普通对话）
 * 2. 文字 + 图片 → 直接用文字生成图片
 * 3. 只有图片 → AI识别生成提示词 → 生成图片
 */

const ChatPage = {
  state: {
    conversationId: '',
    conversationTitle: '新对话',
    messages: [],
    inputText: '',
    referenceImages: [], // base64 数组
    referenceImagePreviews: [], // data URL 数组（用于显示）
    generateCount: 0, // 索引 0-5 对应 1-6 张
    generateCounts: ['1张', '2张', '3张', '4张', '5张', '6张'],
    showCountPicker: false,
    generatingPrompt: false,
    generating: false,
    msgIdCounter: 0,
    isMember: false,
    isLoggedIn: false,
    freeUsed: 0,
    freeLimit: 3,
    showPromptPreview: false,
    previewPromptText: ''
  },

  _fileInput: null,

  // ==================== 页面初始化 ====================
  onShow(params) {
    const conversationId = params[0] || '';
    this.state.conversationId = conversationId;

    // 加载对话
    if (conversationId) {
      const conv = Store.getConversation(conversationId);
      if (conv) {
        this.state.conversationTitle = conv.title;
        this.state.messages = conv.messages || [];
        this.state.msgIdCounter = this.state.messages.reduce((max, m) => Math.max(max, m.id || 0), 0);
      }
    }

    // 检查会员状态
    this._checkMembership();
    this.state.freeUsed = Store.getFreeUsed();

    this._render();
    this._setupFileInput();
    this._scrollToBottom();
  },

  _render() {
    const app = document.getElementById('app');
    // 隐藏 tabbar
    document.getElementById('tabbar').style.display = 'none';

    // 渲染导航栏
    const navbar = document.getElementById('navbar');
    navbar.innerHTML = '<div class="navbar-inner">' +
      '<div class="navbar-back" onclick="ChatPage.onGoBack()">‹</div>' +
      '<div class="navbar-title">' + this._escape(this.state.conversationTitle) + '</div>' +
      '<div style="width:36px;"></div>' +
      '</div>';

    // 渲染页面
    const container = document.getElementById('page-container');
    container.innerHTML = this._renderChatHTML();

    // 渲染弹窗
    this._renderModals();

    // 绑定事件
    this._bindEvents();
  },

  _renderChatHTML() {
    let html = '<div class="chat-page">';

    // 消息区域
    html += '<div class="chat-messages" id="chat-messages">';
    html += this._renderMessages();
    html += '<div class="bottom-placeholder"></div>';
    html += '</div>';

    // 底部输入区
    html += '<div class="input-area" id="input-area">';
    html += this._renderInputArea();
    html += '</div>';

    html += '</div>';
    return html;
  },

  _renderMessages() {
    let html = '';

    if (this.state.messages.length === 0) {
      // 桌面端：居中欢迎页；移动端：气泡提示
      html += '<div class="welcome-page">';
      html += '<div class="welcome-title">有什么能帮助你吗？</div>';
      html += '<div class="welcome-subtitle">上传图片或输入文字，我来帮你生成分镜提示词</div>';
      html += '</div>';
    }

    this.state.messages.forEach(msg => {
      if (msg.role === 'user') {
        html += '<div class="message-wrapper user-msg-wrapper" data-msg-id="' + msg.id + '">';
        // 用户图片
        if (msg.images && msg.images.length > 0) {
          html += '<div class="user-images-full">';
          msg.images.forEach(img => {
            html += '<img class="user-chat-image-full" src="' + img + '" onclick="ChatPage.previewImage(\'' + img + '\')" />';
          });
          html += '</div>';
        }
        // 用户文字
        if (msg.text) {
          html += '<div class="user-text-row"><div class="bubble user-bubble"><span>' + this._escape(msg.text) + '</span></div></div>';
        }
        html += '</div>';
      } else {
        // AI 消息
        html += '<div class="ai-msg-block" data-msg-id="' + msg.id + '">';
        if (msg.thinking) {
          html += '<div class="thinking-row"><div class="thinking-content">';
          html += '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
          html += '<span class="thinking-text">' + this._escape(msg.thinkingText || '正在思考中...') + '</span>';
          html += '</div></div>';
        }
        if (msg.text && !msg.thinking) {
          html += '<div class="ai-text-row"><div class="ai-plain-text">' + this._escape(msg.text) + '</div></div>';
        }
        if (msg.images && msg.images.length > 0 && !msg.thinking) {
          const gridClass = msg.images.length > 2 ? 'grid-multi' : 'grid-' + msg.images.length;
          html += '<div class="ai-images-full"><div class="ai-image-grid ' + gridClass + '">';
          msg.images.forEach(img => {
            html += '<img class="ai-generated-image" src="' + img.url + '" onclick="ChatPage.previewImage(\'' + img.url + '\')" loading="lazy" />';
          });
          html += '</div></div>';
          html += '<div class="ai-actions">';
          html += '<div class="ai-action-btn" onclick="ChatPage.saveImages(' + msg.id + ')">保存图片</div>';
          html += '</div>';
        }
        html += '</div>';
      }
    });

    return html;
  },

  _renderInputArea() {
    let html = '';

    // 参考图预览
    if (this.state.referenceImagePreviews.length > 0) {
      html += '<div class="reference-preview"><div class="reference-preview-list">';
      this.state.referenceImagePreviews.forEach((preview, i) => {
        html += '<div class="reference-preview-item">';
        html += '<img class="reference-preview-img" src="' + preview + '" />';
        html += '<div class="reference-preview-remove" onclick="ChatPage.removeReferenceImage(' + i + ')">×</div>';
        html += '</div>';
      });
      if (this.state.referenceImagePreviews.length < 3) {
        html += '<div class="reference-preview-item reference-preview-add" onclick="ChatPage.addReferenceImage()"><span class="reference-add-icon">+</span></div>';
      }
      html += '</div>';
      html += '<div class="reference-tip"><span>💡</span><span>上传参考图 + 输入提示词，效果更佳</span></div>';
      html += '</div>';
    }

    // 快捷操作栏
    html += '<div class="quick-actions"><div class="quick-actions-inner">';
    html += '<div class="quick-action-btn ' + (this.state.showCountPicker ? 'active' : '') + '" onclick="ChatPage.toggleCountPicker()">';
    html += '<span>🖼️</span><span>' + this.state.generateCounts[this.state.generateCount] + '</span>';
    html += '</div>';
    html += '<div class="quick-action-btn ' + (this.state.generatingPrompt ? 'loading' : '') + '" onclick="ChatPage.onGenerateAIPrompt()">';
    html += '<span>✨</span><span>' + (this.state.generatingPrompt ? '生成中...' : 'AI生成分镜提示词') + '</span>';
    html += '</div>';
    html += '</div></div>';

    // 数量选择器
    if (this.state.showCountPicker) {
      html += '<div class="count-picker">';
      this.state.generateCounts.forEach((label, i) => {
        html += '<div class="count-option ' + (this.state.generateCount === i ? 'active' : '') + '" onclick="ChatPage.selectCount(' + i + ')">' + label + '</div>';
      });
      html += '</div>';
    }

    // 输入栏
    const hasInput = this.state.inputText || this.state.referenceImagePreviews.length > 0;
    html += '<div class="chat-input-bar">';
    if (!this.state.inputText && this.state.referenceImagePreviews.length === 0) {
      html += '<div class="input-camera" onclick="ChatPage.takePhoto()">📷</div>';
    }
    html += '<div class="input-field-wrap">';
    html += '<textarea class="chat-input" id="chat-input" placeholder="发消息..." oninput="ChatPage.onInput(this.value)" onkeydown="ChatPage.onKeyDown(event)" oncompositionstart="ChatPage.onCompositionStart()" oncompositionend="ChatPage.onCompositionEnd()" maxlength="2000">' + this._escape(this.state.inputText) + '</textarea>';
    html += '</div>';
    if (!this.state.inputText && this.state.referenceImagePreviews.length === 0) {
      html += '<div class="input-plus" onclick="ChatPage.chooseFromAlbum()">➕</div>';
    }
    if (hasInput) {
      html += '<div class="input-send" onclick="ChatPage.sendMessage()"><div class="send-arrow"></div></div>';
    }
    html += '</div>';

    return html;
  },

  _renderModals() {
    // 先清除已有弹窗
    document.querySelectorAll('.dynamic-modal').forEach(el => el.remove());

    let html = '';

    // 登录弹窗（使用 Auth 共享模块）
    if (Auth.state.showLoginModal) {
      html += '<div class="dynamic-modal">';
      html += Auth.renderLoginModal({
        prefix: 'chat-',
        showRegister: false,
        onClose: 'ChatPage.closeLogin()',
        onLogin: 'ChatPage.doLogin()',
        onCardKey: 'ChatPage.showCardKey()'
      });
      html += '</div>';
    }

    // 卡密弹窗（使用 Auth 共享模块）
    if (Auth.state.showCardKeyModal) {
      html += '<div class="dynamic-modal">';
      html += Auth.renderCardKeyModal({
        prefix: 'chat-',
        onClose: 'ChatPage.hideCardKey()',
        onVerify: 'ChatPage.doVerifyCardKey()'
      });
      html += '</div>';
    }

    // 提示词预览弹窗
    if (this.state.showPromptPreview) {
      html += '<div class="dynamic-modal">';
      html += '<div class="overlay" onclick="ChatPage.onPreviewCancel()"></div>';
      html += '<div class="prompt-preview-modal slide-up">';
      html += '<div class="prompt-preview-header">';
      html += '<span class="prompt-preview-title">分镜提示词预览</span>';
      html += '<span class="prompt-preview-subtitle">AI已根据您的内容生成了分镜提示词，请确认</span>';
      html += '</div>';
      html += '<div class="prompt-preview-body"><span class="prompt-preview-text">' + this._escape(this.state.previewPromptText) + '</span></div>';
      html += '<div class="prompt-preview-actions">';
      html += '<div class="prompt-action-btn prompt-action-cancel" onclick="ChatPage.onPreviewCancel()">取消</div>';
      html += '<div class="prompt-action-btn prompt-action-retry" onclick="ChatPage.onPreviewRetry()">重新生成</div>';
      html += '<div class="prompt-action-btn prompt-action-confirm" onclick="ChatPage.onPreviewConfirm()">确认</div>';
      html += '</div>';
      html += '</div></div>';
    }

    if (html) {
      const div = document.createElement('div');
      div.innerHTML = html;
      while (div.firstChild) {
        document.body.appendChild(div.firstChild);
      }
    }
  },

  // ==================== 事件绑定 ====================
  _bindEvents() {
    // textarea 自适应高度
    const input = document.getElementById('chat-input');
    if (input) {
      input.addEventListener('input', () => {
        if (this._composing) return;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 80) + 'px';
      });
    }
  },

  _setupFileInput() {
    if (this._fileInput) return;
    this._fileInput = document.createElement('input');
    this._fileInput.type = 'file';
    this._fileInput.accept = 'image/*';
    this._fileInput.style.display = 'none';
    this._fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) {
        this._handleFileSelect(e.target.files[0]);
      }
      e.target.value = ''; // 重置以便重复选择
    });
    document.body.appendChild(this._fileInput);
  },

  // ==================== 文件选择 ====================
  takePhoto() {
    if (this._fileInput) {
      this._fileInput.setAttribute('capture', 'environment');
      this._fileInput.click();
      setTimeout(() => this._fileInput.removeAttribute('capture'), 100);
    }
  },

  chooseFromAlbum() {
    if (this._fileInput) {
      this._fileInput.removeAttribute('capture');
      this._fileInput.click();
    }
  },

  addReferenceImage() {
    if (this.state.referenceImages.length >= 3) {
      UI.toast('最多上传3张参考图');
      return;
    }
    this.chooseFromAlbum();
  },

  async _handleFileSelect(file) {
    if (this.state.referenceImages.length >= 3) {
      UI.toast('最多上传3张参考图');
      return;
    }

    UI.showLoading('处理图片中...');
    try {
      // 压缩图片并转 base64
      const base64 = await UI.compressImage(file, 1024);
      const dataUrl = 'data:image/jpeg;base64,' + base64;

      this.state.referenceImages.push(base64);
      this.state.referenceImagePreviews.push(dataUrl);

      UI.hideLoading();
      this._updateInputArea();
    } catch (err) {
      UI.hideLoading();
      UI.toast('图片处理失败');
      console.error(err);
    }
  },

  removeReferenceImage(index) {
    this.state.referenceImages.splice(index, 1);
    this.state.referenceImagePreviews.splice(index, 1);
    this._updateInputArea();
  },

  // ==================== 输入 ====================
  _composing: false,

  onCompositionStart() {
    this._composing = true;
  },

  onCompositionEnd() {
    this._composing = false;
    // 组合结束后用最终值更新状态并刷新发送按钮
    const input = document.getElementById('chat-input');
    if (input) {
      this.state.inputText = input.value;
      this._updateSendButton();
    }
  },

  onInput(value) {
    // IME 组合中不处理，避免干扰输入法
    if (this._composing) return;
    this.state.inputText = value;
    // 只更新发送按钮显示状态，不重建整个输入区域
    this._updateSendButton();
  },

  _updateSendButton() {
    const sendBtn = document.querySelector('.input-send');
    const cameraBtn = document.querySelector('.input-camera');
    const plusBtn = document.querySelector('.input-plus');
    const hasInput = this.state.inputText || this.state.referenceImagePreviews.length > 0;

    if (hasInput) {
      if (!sendBtn) {
        // 需要显示发送按钮：隐藏 camera/plus，添加 send
        if (cameraBtn) cameraBtn.style.display = 'none';
        if (plusBtn) plusBtn.style.display = 'none';
        const bar = document.querySelector('.chat-input-bar');
        if (bar && !bar.querySelector('.input-send')) {
          const div = document.createElement('div');
          div.className = 'input-send';
          div.onclick = () => this.sendMessage();
          div.innerHTML = '<div class="send-arrow"></div>';
          bar.appendChild(div);
        }
      }
    } else {
      if (sendBtn) sendBtn.remove();
      if (cameraBtn) cameraBtn.style.display = '';
      if (plusBtn) plusBtn.style.display = '';
    }
  },

  onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  },

  // ==================== 发送消息 ====================
  async sendMessage() {
    const text = this.state.inputText.trim();
    if (!text && this.state.referenceImages.length === 0) {
      UI.toast('请输入提示词或上传参考图');
      return;
    }
    if (this.state.generating || this.state.generatingPrompt) {
      UI.toast('正在生成中，请稍候');
      return;
    }
    if (!this._canGenerate()) {
      this.showLogin();
      return;
    }

    // 未登录用户扣减免费次数
    if (!this.state.isMember) {
      this.state.freeUsed++;
      Store.setFreeUsed(this.state.freeUsed);
    }

    // 添加用户消息
    const userMsg = {
      id: this._nextMsgId(),
      role: 'user',
      text: text,
      images: this.state.referenceImagePreviews.slice(),
      time: Store.formatTime(new Date())
    };
    this.state.messages.push(userMsg);

    const referenceImages = this.state.referenceImages.slice();
    const referencePreviews = this.state.referenceImagePreviews.slice();
    this.state.inputText = '';
    this.state.referenceImages = [];
    this.state.referenceImagePreviews = [];

    // 增量追加用户消息到 DOM
    this._updateMessage(userMsg.id, {});
    this._updateInputArea();
    this._scrollToBottom();

    await this._doGenerate(text, referenceImages, referencePreviews);
  },

  async _doGenerate(prompt, referenceImages, referencePreviews) {
    const counts = [1, 2, 3, 4, 5, 6];
    const count = counts[this.state.generateCount];

    const hasText = !!prompt;
    const hasImages = referenceImages.length > 0;

    // ==================== 场景1：纯文字对话 ====================
    if (hasText && !hasImages) {
      await this._chatReply(prompt);
      return;
    }

    // ==================== 场景2/3：有图片，走生图流程 ====================
    const aiMsgId = this._nextMsgId();
    this.state.messages.push({
      id: aiMsgId,
      role: 'ai',
      text: '',
      images: [],
      thinking: true,
      thinkingText: '正在识别图片...'
    });
    this._updateMessage(aiMsgId, {});
    this._scrollToBottom();

    this.state.generating = true;

    try {
      let fullPromptContent = prompt;
      let displayText = prompt;

      if (hasText && hasImages) {
        // 场景2：文字 + 图片 → 直接用文字生成图片
        displayText = prompt;
        this._updateMessage(aiMsgId, { thinkingText: '正在生成图片...' });
      } else if (hasImages) {
        // 场景3：只有图片 → AI识别生成提示词
        this._updateMessage(aiMsgId, { thinkingText: '正在识别参考图...' });

        const aiResult = await API.generatePrompt(
          referenceImages,
          null,
          count
        );

        if (aiResult.success) {
          fullPromptContent = aiResult.fullContent;
          displayText = aiResult.prompt;
        } else {
          throw new Error(aiResult.errMsg || '识别失败');
        }
        this._updateMessage(aiMsgId, { thinkingText: '正在生成图片...' });
      }

      // 生图
      const imageResult = await API.generateImage(
        fullPromptContent,
        count,
        referenceImages,
        0 // 参考图数量（已在 referenceImages 中）
      );

      if (imageResult.success && imageResult.images) {
        // 保存到历史
        Store.addToHistory(imageResult.images, prompt);

        this._updateMessage(aiMsgId, {
          thinking: false,
          text: displayText ? '已为您生成' + imageResult.images.length + '张图片' : '',
          images: imageResult.images
        });
      } else {
        throw new Error(imageResult.errMsg || '图片生成失败');
      }

    } catch (error) {
      console.error('生成失败:', error);
      this._updateMessage(aiMsgId, {
        thinking: false,
        text: '生成失败：' + (error.message || '请重试'),
        images: []
      });
    } finally {
      this.state.generating = false;
      this._saveConversation();
      this._scrollToBottom();
    }
  },

  // ==================== 纯文字AI对话 ====================
  async _chatReply(userText) {
    const aiMsgId = this._nextMsgId();
    this.state.messages.push({
      id: aiMsgId,
      role: 'ai',
      text: '',
      images: [],
      thinking: true,
      thinkingText: 'AI 正在思考...'
    });
    this._updateMessage(aiMsgId, {});
    this._scrollToBottom();

    this.state.generating = true;

    try {
      const isImageRequest = API.detectImageIntent(userText);

      if (isImageRequest) {
        // 用户在描述画面 → 分析 + 生图
        this._updateMessage(aiMsgId, { thinkingText: '正在分析描述并生成图片...' });

        const analysisPrompt = '用户描述了一段画面，请先简要分析这个画面的核心要素（30字以内），然后直接输出优化后的完整提示词（保留所有细节描述）。\n\n用户描述：' + userText + '\n\n输出格式：\n【分析】xxx\n【提示词】xxx';

        const chatResult = await API.chat([{ role: 'user', text: analysisPrompt }]);

        let analysisText = '';
        let optimizedPrompt = userText;

        if (chatResult.success) {
          const reply = chatResult.reply || '';
          const analysisMatch = reply.match(/【分析】([\s\S]*?)(?=【提示词】|$)/);
          const promptMatch = reply.match(/【提示词】([\s\S]*?)$/);
          if (analysisMatch) analysisText = analysisMatch[1].trim();
          if (promptMatch) optimizedPrompt = promptMatch[1].trim();
        }

        optimizedPrompt = String(optimizedPrompt || userText || '');
        if (!optimizedPrompt || optimizedPrompt.length < 2) {
          optimizedPrompt = userText;
        }

        this._updateMessage(aiMsgId, {
          thinking: false,
          text: analysisText ? '画面分析：' + analysisText + '\n\n优化提示词：' + optimizedPrompt : optimizedPrompt,
          images: []
        });

        // 调用生图
        this._updateMessage(aiMsgId, { thinking: true, thinkingText: '正在生成图片...' });

        try {
          const counts = [1, 2, 3, 4, 5, 6];
          const count = counts[this.state.generateCount];
          const imageResult = await API.generateImage(optimizedPrompt, count, [], 0);

          if (imageResult.success && imageResult.images && imageResult.images.length > 0) {
            Store.addToHistory(imageResult.images, optimizedPrompt);
            this._updateMessage(aiMsgId, {
              thinking: false,
              images: imageResult.images
            });
          } else {
            this._updateMessage(aiMsgId, {
              thinking: false,
              text: '已为您分析画面描述，但图片生成失败\n\n优化提示词：' + optimizedPrompt
            });
          }
        } catch (imgErr) {
          this._updateMessage(aiMsgId, {
            thinking: false,
            text: '图片生成失败：' + (imgErr.message || '请重试') + '\n\n优化提示词：' + optimizedPrompt
          });
        }
      } else {
        // 普通对话
        const recentMessages = this.state.messages
          .filter(m => m.role === 'user' || (m.role === 'ai' && m.text && !m.thinking))
          .slice(-10);

        const chatResult = await API.chat(recentMessages);

        if (chatResult.success) {
          this._updateMessage(aiMsgId, {
            thinking: false,
            text: chatResult.reply,
            images: []
          });
        } else {
          throw new Error(chatResult.errMsg || '对话失败');
        }
      }
    } catch (error) {
      this._updateMessage(aiMsgId, {
        thinking: false,
        text: '回复失败：' + (error.message || '请重试'),
        images: []
      });
    } finally {
      this.state.generating = false;
      this._saveConversation();
      this._scrollToBottom();
    }
  },

  // ==================== AI生成分镜提示词 ====================
  async onGenerateAIPrompt() {
    if (this.state.generatingPrompt) {
      UI.toast('正在生成中，请稍候');
      return;
    }

    const hasImages = this.state.referenceImages.length > 0;
    const hasText = this.state.inputText.trim().length > 0;

    if (!hasImages && !hasText) {
      UI.toast('请上传参考图或输入内容描述');
      return;
    }

    if (!this._canGenerate()) {
      this.showLogin();
      return;
    }

    this.state.generatingPrompt = true;
    this._updateInputArea();

    try {
      const counts = [1, 2, 3, 4, 5, 6];
      const promptCount = counts[this.state.generateCount];
      const userText = this.state.inputText.trim();

      let result;
      if (hasImages) {
        result = await API.generatePrompt(
          this.state.referenceImages,
          userText || null,
          promptCount
        );
      } else {
        result = await API.generatePromptFromText(userText, promptCount);
      }

      if (result.success) {
        this.state.generatingPrompt = false;
        this.state.previewPromptText = result.prompt;
        this.state.showPromptPreview = true;
        this._renderModals();
      } else {
        throw new Error(result.errMsg || '生成失败');
      }
    } catch (error) {
      this.state.generatingPrompt = false;
      UI.toast('生成失败，请重试');
      console.error('分镜提示词生成失败:', error);
      this._updateInputArea();
    }
  },

  // ==================== 提示词预览弹窗 ====================
  onPreviewConfirm() {
    this.state.inputText = this.state.previewPromptText;
    this.state.showPromptPreview = false;
    this.state.previewPromptText = '';
    this._renderModals();
    this._updateInputArea();
  },

  onPreviewCancel() {
    this.state.showPromptPreview = false;
    this.state.previewPromptText = '';
    this._renderModals();
  },

  async onPreviewRetry() {
    this.state.showPromptPreview = false;
    this.state.previewPromptText = '';
    this._renderModals();
    await this.onGenerateAIPrompt();
  },

  // ==================== 数量选择 ====================
  toggleCountPicker() {
    this.state.showCountPicker = !this.state.showCountPicker;
    this._updateInputArea();
  },

  selectCount(index) {
    this.state.generateCount = index;
    this.state.showCountPicker = false;
    this._updateInputArea();
  },

  // ==================== 图片预览 ====================
  previewImage(src) {
    const allImages = [];
    this.state.messages.forEach(msg => {
      if (msg.images) {
        msg.images.forEach(img => {
          if (img.url) allImages.push(img.url);
          else if (typeof img === 'string') allImages.push(img);
        });
      }
    });
    UI.previewImage(src, allImages.length > 0 ? allImages : [src]);
  },

  // ==================== 保存图片 ====================
  async saveImages(msgId) {
    const msg = this.state.messages.find(m => m.id === msgId);
    if (!msg || !msg.images || msg.images.length === 0) return;

    UI.showLoading('保存中...');
    let savedCount = 0;

    for (const img of msg.images) {
      try {
        const url = img.url;
        if (url && url.startsWith('http')) {
          await UI.downloadImage(url);
          savedCount++;
        }
      } catch (err) {
        console.error('保存图片失败:', err);
      }
    }

    UI.hideLoading();
    if (savedCount > 0) {
      UI.toast('已保存' + savedCount + '张图片', 'success');
    } else {
      UI.toast('保存失败');
    }
  },

  // ==================== 长按删除消息 ====================
  async onMessageLongPress(msgId) {
    const msg = this.state.messages.find(m => m.id === msgId);
    if (!msg) return;
    if (msg.thinking) return;

    const result = await UI.showActionSheet({
      title: '消息操作',
      items: [{ label: '删除此消息', danger: true }]
    });

    if (result.cancel) return;
    if (result.tapIndex === 0) {
      this.state.messages = this.state.messages.filter(m => m.id !== msgId);
      this._fullRebuildMessages();
      this._saveConversation();
      UI.toast('已删除', 'success');
    }
  },

  // ==================== 登录弹窗（委托 Auth 模块） ====================
  showLogin() {
    Auth.showLogin();
    this._renderModals();
  },

  closeLogin() {
    Auth.closeLogin();
    this._renderModals();
  },

  hideLogin() {
    Auth.hideLogin();
    this._renderModals();
  },

  async doLogin() {
    const result = await Auth.doLogin('chat-');
    if (result) {
      this.state.isLoggedIn = true;
      this.state.isMember = result.isMember;
      this._renderModals();
    }
  },

  // ==================== 卡密弹窗（委托 Auth 模块） ====================
  showCardKey() {
    Auth.showCardKey();
    this._renderModals();
  },

  hideCardKey() {
    Auth.hideCardKey();
    this._renderModals();
  },

  async doVerifyCardKey() {
    const result = await Auth.doVerifyCardKey('chat-');
    if (result) {
      this.state.isMember = true;
      this.state.isLoggedIn = true;
      this._renderModals();
    }
  },

  // ==================== 返回 ====================
  onGoBack() {
    this._saveConversation();
    // 恢复 tabbar
    document.getElementById('tabbar').style.display = '';
    // 清理弹窗
    document.querySelectorAll('.dynamic-modal').forEach(el => el.remove());
    App.navigate('home');
  },

  // ==================== 会员检查 ====================
  async _checkMembership() {
    if (!Store.isLoggedIn()) {
      this.state.isMember = false;
      this.state.isLoggedIn = false;
      return;
    }

    const userInfo = Store.getUserInfo();
    this.state.isLoggedIn = true;
    this.state.isMember = userInfo.isMember || false;

    try {
      const res = await API.checkMembership(userInfo.username);
      if (res && res.success && !res.isNewUser) {
        this.state.isMember = res.isMember;
        const formatted = res.expireTime ? Store.formatDate(new Date(res.expireTime)) : '';
        Store.setUserInfo({ ...userInfo, isMember: res.isMember, expireTime: formatted });
      }
    } catch (err) {
      console.error('检查会员状态失败:', err);
    }
  },

  _canGenerate() {
    if (this.state.isMember) return true;
    if (this.state.freeUsed < this.state.freeLimit) return true;
    return false;
  },

  // ==================== 消息管理 ====================
  _nextMsgId() {
    return ++this.state.msgIdCounter;
  },

  _updateMessage(msgId, updates) {
    const msg = this.state.messages.find(m => m.id === msgId);
    if (msg) {
      Object.assign(msg, updates);
      // 增量更新：只重建变化的那条消息 DOM
      const el = document.getElementById('chat-messages');
      if (el) {
        const msgEl = el.querySelector('[data-msg-id="' + msgId + '"]');
        if (msgEl) {
          const temp = document.createElement('div');
          temp.innerHTML = this._renderOneMessage(msg);
          const newNode = temp.firstChild;
          msgEl.replaceWith(newNode);
        } else {
          // 新消息，追加到末尾（placeholder 之前）
          const placeholder = el.querySelector('.bottom-placeholder');
          const temp = document.createElement('div');
          temp.innerHTML = this._renderOneMessage(msg);
          const newNode = temp.firstChild;
          el.insertBefore(newNode, placeholder);
        }
        // 绑定长按事件委托（只绑定一次）
        this._ensureLongPress(el);
      }
      this._scrollToBottom();
      this._saveConversation();
    }
  },

  _renderOneMessage(msg) {
    let html = '';
    if (msg.role === 'user') {
      html += '<div class="message-wrapper user-msg-wrapper" data-msg-id="' + msg.id + '">';
      if (msg.images && msg.images.length > 0) {
        html += '<div class="user-images-full">';
        msg.images.forEach(img => {
          html += '<img class="user-chat-image-full" src="' + img + '" onclick="ChatPage.previewImage(\'' + img + '\')" />';
        });
        html += '</div>';
      }
      if (msg.text) {
        html += '<div class="user-text-row"><div class="bubble user-bubble"><span>' + this._escape(msg.text) + '</span></div></div>';
      }
      html += '</div>';
    } else {
      html += '<div class="ai-msg-block" data-msg-id="' + msg.id + '">';
      if (msg.thinking) {
        html += '<div class="thinking-row"><div class="thinking-content">';
        html += '<div class="thinking-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
        html += '<span class="thinking-text">' + this._escape(msg.thinkingText || '正在思考中...') + '</span>';
        html += '</div></div>';
      }
      if (msg.text && !msg.thinking) {
        html += '<div class="ai-text-row"><div class="ai-plain-text">' + this._escape(msg.text) + '</div></div>';
      }
      if (msg.images && msg.images.length > 0 && !msg.thinking) {
        const gridClass = msg.images.length > 2 ? 'grid-multi' : 'grid-' + msg.images.length;
        html += '<div class="ai-images-full"><div class="ai-image-grid ' + gridClass + '">';
        msg.images.forEach(img => {
          html += '<img class="ai-generated-image" src="' + img.url + '" onclick="ChatPage.previewImage(\'' + img.url + '\')" loading="lazy" />';
        });
        html += '</div></div>';
        html += '<div class="ai-actions">';
        html += '<div class="ai-action-btn" onclick="ChatPage.saveImages(' + msg.id + ')">保存图片</div>';
        html += '</div>';
      }
      html += '</div>';
    }
    return html;
  },

  _ensureLongPress(el) {
    if (this._longPressBound) return;
    this._longPressBound = true;
    this._longPressCleanup = UI.setupLongPress(el, '[data-msg-id]', (target) => {
      const msgId = parseInt(target.dataset.msgId);
      if (msgId) this.onMessageLongPress(msgId);
    });
  },

  // 完整重建消息列表（仅初次加载和删除消息时使用）
  _fullRebuildMessages() {
    const el = document.getElementById('chat-messages');
    if (el) {
      el.innerHTML = this._renderMessages() + '<div class="bottom-placeholder"></div>';
      this._ensureLongPress(el);
    }
  },

  _updateInputArea() {
    const el = document.getElementById('input-area');
    if (el) {
      el.innerHTML = this._renderInputArea();
      this._bindEvents();
    }
  },

  _scrollToBottom() {
    requestAnimationFrame(() => {
      const el = document.getElementById('chat-messages');
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  },

  // ==================== 对话持久化 ====================
  _saveConversation() {
    const { conversationId, messages, conversationTitle } = this.state;
    if (!conversationId) return;

    let summary = '';
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'user' && msg.text) { summary = msg.text; break; }
      if (msg.role === 'ai' && msg.text && !msg.thinking) { summary = msg.text; break; }
    }

    let title = conversationTitle;
    if (title === '新对话') {
      const firstUserMsg = messages.find(m => m.role === 'user' && m.text);
      if (firstUserMsg) {
        title = firstUserMsg.text.slice(0, 20);
        this.state.conversationTitle = title;
        document.querySelector('.navbar-title').textContent = title;
      }
    }

    Store.updateConversation(conversationId, {
      title,
      summary: summary.slice(0, 50),
      messages,
      avatarText: title[0] || '新'
    });
  },

  // ==================== 工具 ====================
  _escape(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '<br>');
  }
};
