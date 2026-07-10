Page({
  data: {
    detail: null,
    batchImages: [], // 同批次的所有图片
    currentImageIndex: 0, // 当前显示的图片索引
    isBatch: false, // 是否是批量生成
    originalImage: '', // 产品原图
    referenceImages: [], // 参考图数组
    hasReferenceImages: false // 是否有参考图
  },

  onLoad() {
    const detail = wx.getStorageSync('currentDetail');
    const batchImages = wx.getStorageSync('currentBatchImages');
    
    if (detail) {
      this.setData({ 
        detail,
        batchImages: batchImages || [],
        isBatch: batchImages && batchImages.length > 1,
        originalImage: detail.originalImage || '',
        referenceImages: detail.referenceImages || [],
        hasReferenceImages: detail.referenceImages && detail.referenceImages.length > 0
      });
    }
  },

  // 切换图片
  switchImage(e) {
    const index = e.currentTarget.dataset.index;
    const image = this.data.batchImages[index];
    if (image) {
      this.setData({
        currentImageIndex: index,
        detail: image,
        originalImage: image.originalImage || '',
        referenceImages: image.referenceImages || [],
        hasReferenceImages: image.referenceImages && image.referenceImages.length > 0
      });
    }
  },

  // 获取图片临时URL（用于预览）
  async getImageTempUrl(imageSrc) {
    if (!imageSrc) return '';
    // 如果是普通URL，直接返回
    if (imageSrc.startsWith('http')) return imageSrc;
    // 如果是云存储fileID，获取临时URL
    if (imageSrc.startsWith('cloud://')) {
      try {
        const res = await wx.cloud.getTempFileURL({ fileList: [imageSrc] });
        if (res.fileList && res.fileList[0] && res.fileList[0].tempFileURL) {
          return res.fileList[0].tempFileURL;
        }
      } catch (err) {
        console.error('获取临时URL失败:', err);
      }
    }
    return imageSrc;
  },

  // 预览图片
  async previewImage() {
    if (this.data.batchImages.length > 0) {
      const urls = [];
      for (const img of this.data.batchImages) {
        const url = await this.getImageTempUrl(img.imageSrc);
        urls.push(url);
      }
      const currentUrl = await this.getImageTempUrl(this.data.detail.imageSrc);
      wx.previewImage({
        urls: urls,
        current: currentUrl
      });
    } else if (this.data.detail) {
      const currentUrl = await this.getImageTempUrl(this.data.detail.imageSrc);
      wx.previewImage({
        urls: [currentUrl],
        current: currentUrl
      });
    }
  },

  // 复制提示词
  copyPrompt() {
    if (this.data.detail && this.data.detail.prompt) {
      wx.setClipboardData({
        data: this.data.detail.prompt,
        success: () => {
          wx.showToast({ title: '已复制提示词', icon: 'success' });
        }
      });
    }
  },

  // 下载图片（支持云存储和普通URL）
  downloadImageFile(imageSrc) {
    return new Promise((resolve, reject) => {
      // 判断是否是云存储文件ID
      if (imageSrc && imageSrc.startsWith('cloud://')) {
        wx.cloud.downloadFile({
          fileID: imageSrc,
          success: (res) => resolve(res.tempFilePath),
          fail: (err) => reject(err)
        });
      } else {
        wx.downloadFile({
          url: imageSrc,
          success: (res) => {
            if (res.statusCode === 200) {
              resolve(res.tempFilePath);
            } else {
              reject(new Error('下载失败'));
            }
          },
          fail: (err) => reject(err)
        });
      }
    });
  },

  // 保存当前图片
  async saveImage() {
    if (this.data.detail) {
      try {
        const tempFilePath = await this.downloadImageFile(this.data.detail.imageSrc);
        wx.saveImageToPhotosAlbum({
          filePath: tempFilePath,
          success: () => {
            wx.showToast({ title: '保存成功', icon: 'success' });
          },
          fail: (err) => {
            if (err.errMsg.includes('auth deny')) {
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
          }
        });
      } catch (err) {
        wx.showToast({ title: '下载失败', icon: 'none' });
      }
    }
  },

  // 保存所有图片
  async saveAllImages() {
    if (this.data.batchImages.length === 0) return;
    
    let savedCount = 0;
    const totalCount = this.data.batchImages.length;
    
    wx.showLoading({ title: '保存中...' });
    
    for (const img of this.data.batchImages) {
      try {
        const tempFilePath = await this.downloadImageFile(img.imageSrc);
        await new Promise((resolve, reject) => {
          wx.saveImageToPhotosAlbum({
            filePath: tempFilePath,
            success: () => {
              savedCount++;
              resolve();
            },
            fail: (err) => {
              savedCount++;
              reject(err);
            }
          });
        });
      } catch (err) {
        savedCount++;
      }
    }
    
    wx.hideLoading();
    if (savedCount === totalCount) {
      wx.showToast({ title: '全部保存成功', icon: 'success' });
    } else {
      wx.showToast({ title: '部分保存失败', icon: 'none' });
    }
  },

  // 分享
  onShareAppMessage() {
    if (this.data.detail) {
      return {
        title: '商品图制作',
        path: '/pages/index/index'
      };
    }
  }
});
