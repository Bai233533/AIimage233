/**
 * ui.js - UI 组件（Toast / Loading / Modal / ActionSheet / ImagePreview / LongPress）
 * 替代 wx.showToast / wx.showLoading / wx.showModal / wx.showActionSheet / wx.previewImage
 */

const UI = {
  // ==================== Toast ====================
  _toastTimer: null,

  toast(title, icon, duration) {
    const el = document.getElementById('toast');
    el.textContent = title;
    el.className = 'toast' + (icon === 'success' ? ' success' : icon === 'error' ? ' error' : '');
    el.classList.remove('hidden');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.classList.add('hidden');
    }, duration || 2000);
  },

  // ==================== Loading ====================
  showLoading(title) {
    const el = document.getElementById('loading');
    document.getElementById('loading-text').textContent = title || '加载中...';
    el.classList.remove('hidden');
  },

  hideLoading() {
    document.getElementById('loading').classList.add('hidden');
  },

  // ==================== Modal ====================
  showModal(options) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('overlay');
      const modal = document.getElementById('modal');
      const titleEl = document.getElementById('modal-title');
      const bodyEl = document.getElementById('modal-body');
      const cancelBtn = document.getElementById('modal-cancel');
      const confirmBtn = document.getElementById('modal-confirm');

      titleEl.textContent = options.title || '提示';
      bodyEl.textContent = options.content || '';
      cancelBtn.textContent = options.cancelText || '取消';
      confirmBtn.textContent = options.confirmText || '确定';

      confirmBtn.className = 'modal-btn modal-confirm' + (options.danger ? ' danger' : '');

      if (options.showCancel === false) {
        cancelBtn.style.display = 'none';
      } else {
        cancelBtn.style.display = 'flex';
      }

      overlay.classList.remove('hidden');
      modal.classList.remove('hidden');

      const cleanup = () => {
        overlay.classList.add('hidden');
        modal.classList.add('hidden');
        cancelBtn.onclick = null;
        confirmBtn.onclick = null;
        overlay.onclick = null;
      };

      cancelBtn.onclick = () => { cleanup(); resolve({ confirm: false, cancel: true }); };
      confirmBtn.onclick = () => { cleanup(); resolve({ confirm: true, cancel: false }); };
      overlay.onclick = (e) => {
        if (e.target === overlay) { cleanup(); resolve({ confirm: false, cancel: true }); }
      };
    });
  },

  // ==================== ActionSheet ====================
  showActionSheet(options) {
    return new Promise((resolve) => {
      const overlay = document.getElementById('overlay');
      const sheet = document.getElementById('action-sheet');
      const titleEl = document.getElementById('action-sheet-title');
      const itemsEl = document.getElementById('action-sheet-items');
      const cancelBtn = document.getElementById('action-sheet-cancel');

      titleEl.textContent = options.title || '选择操作';
      itemsEl.innerHTML = '';

      const items = options.items || [];
      items.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = 'action-sheet-item' + (item.danger ? ' danger' : '');
        div.textContent = item.label || item;
        div.onclick = () => {
          cleanup();
          resolve({ tapIndex: index });
        };
        itemsEl.appendChild(div);
      });

      cancelBtn.textContent = options.cancelText || '取消';

      overlay.classList.remove('hidden');
      sheet.classList.remove('hidden');

      const cleanup = () => {
        overlay.classList.add('hidden');
        sheet.classList.add('hidden');
        overlay.onclick = null;
        cancelBtn.onclick = null;
      };

      overlay.onclick = (e) => {
        if (e.target === overlay) { cleanup(); resolve({ cancel: true }); }
      };
      cancelBtn.onclick = () => { cleanup(); resolve({ cancel: true }); };
    });
  },

  // ==================== ImagePreview ====================
  previewImage(current, urls) {
    const overlay = document.getElementById('image-preview');
    const imgEl = document.getElementById('image-preview-img');
    const closeBtn = document.getElementById('image-preview-close');
    const imgList = urls && urls.length > 0 ? urls : [current];
    let currentIndex = imgList.indexOf(current);
    if (currentIndex === -1) currentIndex = 0;

    imgEl.src = imgList[currentIndex];
    overlay.classList.remove('hidden');

    const close = () => {
      overlay.classList.add('hidden');
      closeBtn.onclick = null;
      overlay.onclick = null;
    };

    closeBtn.onclick = close;
    overlay.onclick = (e) => {
      if (e.target === overlay) close();
      else {
        // 点击图片切换下一张
        currentIndex = (currentIndex + 1) % imgList.length;
        imgEl.src = imgList[currentIndex];
      }
    };
  },

  // ==================== 图片下载（保存到本地） ====================
  async downloadImage(url) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'ai_image_' + Date.now() + '.jpg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      return true;
    } catch (err) {
      console.error('下载图片失败:', err);
      // 降级方案：直接打开图片
      window.open(url, '_blank');
      return false;
    }
  },

  // ==================== 文件转 base64 ====================
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // 去掉 data:image/jpeg;base64, 前缀
        const result = reader.result;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // ==================== 压缩图片 ====================
  compressImage(file, maxWidth) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (maxWidth && width > maxWidth) {
            height = Math.round(height * maxWidth / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
          resolve(base64);
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  // ==================== 长按事件 ====================
  // 在容器上设置长按事件委托，selector 匹配的元素触发 callback(el)
  // 返回一个 cleanup 函数用于移除监听
  setupLongPress(container, selector, callback) {
    let pressTimer = null;
    let targetEl = null;

    const onTouchStart = (e) => {
      const target = e.target.closest(selector);
      if (!target) return;
      targetEl = target;
      pressTimer = setTimeout(() => {
        if (targetEl) {
          callback(targetEl);
          targetEl = null;
        }
      }, 600);
    };

    const onTouchEnd = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      targetEl = null;
    };

    const onTouchMove = () => {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      targetEl = null;
    };

    // 同时支持鼠标右键（PC 端测试用）
    const onContextMenu = (e) => {
      const target = e.target.closest(selector);
      if (target) {
        e.preventDefault();
        callback(target);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('contextmenu', onContextMenu);

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('contextmenu', onContextMenu);
    };
  }
};
