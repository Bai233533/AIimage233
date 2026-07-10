const app = getApp();
const { generateAIPrompt, generateImage, checkImageSecurity, checkTextSecurity, selectAndCheckImage } = require('../../utils/api');

Page({
  data: {
    imageSrc: '',
    referenceImages: [], // 参考图列表，最多3张
    ratioIndex: 0,
    ratios: ['自由选择', '1:1', '3:4', '4:3', '9:16', '16:9'],
    audienceIndex: 0,
    audiences: ['宝妈', '学生', '老人', '儿童', '男性', '女性'],
    platformIndex: 0,
    platforms: ['小红书', '抖音', '淘宝', '拼多多'],
    generateCount: 0,
    generateCounts: ['1张', '2张', '3张', '4张', '5张', '6张'],
    prompt: '',
    fullPromptContent: '', // 完整的返回内容（含分析过程），传给生图模型
    generating: false,
    generatingPrompt: false, // 提示词生成中状态
    showModal: false,
    modalMode: 'generating', // generating=生成中, completed=已完成
    modalMessage: '' // 弹窗文案
  },

  // 从相册选择图片
  async chooseImageFromAlbum() {
    const result = await selectAndCheckImage({ sourceType: ['album'] });
    if (result) {
      this.setData({ imageSrc: result.tempPath });
    }
  },

  // 拍照上传图片
  async chooseImageFromCamera() {
    const result = await selectAndCheckImage({ sourceType: ['camera'] });
    if (result) {
      this.setData({ imageSrc: result.tempPath });
    }
  },

  // 删除图片
  removeImage() {
    this.setData({ imageSrc: '' });
  },

  // 选择参考图
  async chooseReferenceImage(e) {
    const index = e.currentTarget.dataset.index;
    const result = await selectAndCheckImage({ sourceType: ['album', 'camera'] });
    if (result) {
      const referenceImages = this.data.referenceImages.slice();
      referenceImages[index] = result.tempPath;
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

  // 选择比例
  selectRatio(e) {
    this.setData({ ratioIndex: e.currentTarget.dataset.index });
  },

  // 选择面向群众
  selectAudience(e) {
    this.setData({ audienceIndex: e.currentTarget.dataset.index });
  },

  // 选择发布平台
  selectPlatform(e) {
    this.setData({ platformIndex: e.currentTarget.dataset.index });
  },

  // 选择生成数量
  selectCount(e) {
    this.setData({ generateCount: e.currentTarget.dataset.index });
  },

  // 输入提示词
  onPromptInput(e) {
    this.setData({ prompt: e.detail.value });
  },

  // 生成提示词（识别图片）
  async onGenerateAIPrompt() {
    if (!this.data.imageSrc) {
      wx.showToast({ title: '请先上传产品图片', icon: 'none' });
      return;
    }

    if (this.data.generatingPrompt) {
      wx.showToast({ title: '正在生成中，请稍候', icon: 'none' });
      return;
    }

    // 过滤掉空的参考图位置
    const referenceImages = this.data.referenceImages.filter(img => img);
    
    this.setData({ generatingPrompt: true });
    try {
      const counts = [1, 2, 3, 4, 5, 6];
      const promptCount = counts[this.data.generateCount];
      
      const result = await generateAIPrompt({
        imageSrc: this.data.imageSrc,
        audience: this.data.audiences[this.data.audienceIndex],
        platform: this.data.platforms[this.data.platformIndex],
        ratio: this.data.ratios[this.data.ratioIndex],
        count: promptCount,
        referenceImages: referenceImages.length > 0 ? referenceImages : null
      });
      // 保存完整内容（传给生图模型）和用户看到的提示词
      this.setData({ 
        fullPromptContent: result.fullContent,
        prompt: result.prompt,
        generatingPrompt: false
      });
      wx.showToast({ title: '提示词已生成', icon: 'success' });
    } catch (error) {
      this.setData({ generatingPrompt: false });
      wx.showToast({ title: '生成失败，请重试', icon: 'none' });
      console.error('生成失败:', error);
    }
  },

  // 生成图片
  async onGenerateImage() {
    if (!this.data.imageSrc) {
      wx.showToast({ title: '请先上传产品图片', icon: 'none' });
      return;
    }

    if (!this.data.prompt) {
      wx.showToast({ title: '请先生成提示词', icon: 'none' });
      return;
    }

    // 根据生成数量显示不同的提示文案
    const counts = [1, 2, 3, 4, 5, 6];
    const count = counts[this.data.generateCount];
    const modalMessage = count <= 2 
      ? '当前正在生成，请耐心等待' 
      : '照片数量比较多，等待时间可能比较久，请耐心等待';

    // 立即显示"生成中"弹窗
    this.setData({ 
      generating: true, 
      showModal: true, 
      modalMode: 'generating',
      modalMessage: modalMessage
    });

    try {
      // 优先使用完整内容（含分析过程）传给生图模型，其次使用提示词
      const promptForImage = this.data.fullPromptContent || this.data.prompt;
      
      // 过滤掉空的参考图
      const referenceImages = this.data.referenceImages.filter(img => img);
      
      // 调用 API 生成图片（产品图 + 参考图 + 提示词）
      const images = await generateImage(promptForImage, count, this.data.imageSrc, referenceImages.length > 0 ? referenceImages : null);
      
      console.log('API返回图片数量:', images.length);
      
      // 下载图片并上传到云存储
      wx.showLoading({ title: '正在保存图片...' });
      const newRecords = [];
      const now = new Date();
      const groupId = Date.now();
      
      for (let i = 0; i < images.length; i++) {
        const imageUrl = images[i].url || images[i].b64_json;
        console.log(`图片${i + 1} URL:`, imageUrl);
        
        let imageSrc = imageUrl;
        
        // 如果是远程URL，下载后上传到云存储
        if (imageUrl && imageUrl.startsWith('http')) {
          try {
            wx.showLoading({ title: `正在保存第${i + 1}张图片...` });
            const localPath = await this.downloadImage(imageUrl);
            console.log(`图片${i + 1} 本地路径:`, localPath);
            
            // 上传到云存储
            const cloudFileID = await this.uploadToCloud(localPath);
            imageSrc = cloudFileID;
            console.log(`图片${i + 1} 云存储ID:`, cloudFileID);
          } catch (err) {
            console.error(`图片${i + 1} 保存失败:`, err);
            // 保存失败则使用原URL
            imageSrc = imageUrl;
          }
        }
        
        const record = {
          id: Date.now() + i,
          groupId: groupId,
          imageSrc: imageSrc,
          imageUrl: imageUrl,
          originalImage: this.data.imageSrc,  // 产品原图
          referenceImages: referenceImages,    // 参考图数组
          ratio: this.data.ratios[this.data.ratioIndex],
          audience: this.data.audiences[this.data.audienceIndex],
          platform: this.data.platforms[this.data.platformIndex],
          prompt: this.data.prompt,
          date: this.formatDate(now),
          type: '智能生成',
          batchIndex: i + 1,
          batchTotal: images.length
        };
        newRecords.push(record);
      }
      
      wx.hideLoading();

      // 保存到本地存储
      let history = wx.getStorageSync('generationHistory') || [];
      history = newRecords.concat(history);
      wx.setStorageSync('generationHistory', history);
      app.globalData.history = history;

      // 生成完成后显示"完成"弹窗
      this.setData({ 
        generating: false,
        modalMode: 'completed'
      });
    } catch (error) {
      console.error('图片生成失败:', error);
      this.setData({ generating: false, showModal: false });
      wx.hideLoading();
      const errMsg = error.message || '生成失败，请重试';
      wx.showModal({
        title: '生成失败',
        content: errMsg,
        showCancel: false
      });
    }
  },

  // 弹窗 - 确定/我知道了
  onModalConfirm() {
    if (this.data.modalMode === 'generating') {
      // 生成中模式：关闭弹窗并重置选项
      this.resetOptions();
    } else {
      // 完成模式：关闭弹窗（继续生成）
      this.setData({ showModal: false });
    }
  },

  // 弹窗 - 查看记录
  onModalView() {
    this.setData({ showModal: false });
    wx.switchTab({ url: '/pages/history/history' });
  },

  // 重置所有选项到初始状态
  resetOptions() {
    this.setData({ 
      showModal: false,
      imageSrc: '',
      referenceImages: [],
      ratioIndex: 0,
      audienceIndex: 0,
      platformIndex: 0,
      generateCount: 0,
      prompt: '',
      fullPromptContent: ''
    });
  },

  // 下载图片到本地
  downloadImage(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            resolve(res.tempFilePath);
          } else {
            reject(new Error('下载失败'));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    });
  },

  // 上传图片到云存储
  uploadToCloud(localPath) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const random = Math.floor(Math.random() * 10000);
      const cloudPath = `generated-images/${timestamp}_${random}.jpg`;
      
      wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: localPath,
        success: (res) => {
          console.log('云存储上传成功:', res.fileID);
          resolve(res.fileID);
        },
        fail: (err) => {
          console.error('云存储上传失败:', err);
          reject(err);
        }
      });
    });
  },

  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
});
