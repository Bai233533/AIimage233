const API_CONFIG = require('../config/api');

// 将本地图片转换为 base64
// 兼容 http://tmp/ 和 wxfile:// 等新版临时文件路径
function imageToBase64(imagePath) {
  return new Promise((resolve, reject) => {
    if (imagePath && imagePath.indexOf('http://tmp/') === 0) {
      // http://tmp/ 路径：通过 wx.request 以 arraybuffer 方式读取，再转 base64
      wx.request({
        url: imagePath,
        responseType: 'arraybuffer',
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            const base64 = wx.arrayBufferToBase64(res.data);
            resolve(base64);
          } else {
            reject(new Error('读取临时文件失败'));
          }
        },
        fail: reject
      });
    } else {
      wx.getFileSystemManager().readFile({
        filePath: imagePath,
        encoding: 'base64',
        success: (res) => {
          resolve(res.data);
        },
        fail: reject
      });
    }
  });
}

// 从AI返回结果中提取提示词部分（===PROMPT_START=== 到 ===PROMPT_END=== 之间的内容）
function extractPromptFromAIResult(fullContent) {
  const startMarker = '===PROMPT_START===';
  const endMarker = '===PROMPT_END===';
  
  const startIndex = fullContent.indexOf(startMarker);
  const endIndex = fullContent.indexOf(endMarker);
  
  if (startIndex !== -1 && endIndex !== -1) {
    return fullContent.substring(startIndex + startMarker.length, endIndex).trim();
  }
  
  // 如果没有标记，返回原始内容
  return fullContent;
}

// 调用豆包 AI 生成视频分镜提示词（基于图片识别）
// referenceImages: 参考图列表（可选）
// userPrompt: 用户附加的文字描述（可选）
// 返回值：{ fullContent: 完整内容, prompt: 用户看到的分镜提示词 }
function generateAIPrompt(productInfo) {
  return new Promise(async (resolve, reject) => {
    const { imageSrc, count, referenceImages, userPrompt } = productInfo;
    
    try {
      const base64ProductImage = await imageToBase64(imageSrc);
      const hasReferenceImages = referenceImages && referenceImages.length > 0;
      const messageContent = [];
      
      // 添加所有图片
      messageContent.push({
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${base64ProductImage}`
      });
      if (hasReferenceImages) {
        for (let i = 0; i < referenceImages.length; i++) {
          const base64RefImage = await imageToBase64(referenceImages[i]);
          messageContent.push({
            type: 'input_image',
            image_url: `data:image/jpeg;base64,${base64RefImage}`
          });
        }
      }

      const sceneCount = count || 4;
      const refCount = hasReferenceImages ? referenceImages.length : 0;

      const userMessage = `请根据以下图片生成一套${sceneCount}个分镜的视频画面提示词。

═══════════════════════════════════════
图片分工（非常重要！）：
- 第1张是「内容主体图」：你要识别这张图的内容，作为分镜的主角
- ${hasReferenceImages ? `第2张起是「风格参考图」：你只能学习它的画风、色调、光影，绝对不能复制它的画面内容` : '没有额外参考图，风格由你根据内容自动匹配'}
═══════════════════════════════════════

【第一步：识别内容主体图】
仔细识别第1张图片，回答：
- 这是什么？（产品/人物/食物/动物/场景等）
- 主体有什么特征？（颜色、形状、材质、造型）
- 背景是什么？（室内/室外/纯色/虚化）
- 整体什么氛围？（高级/可爱/科技/自然）

【第二步：提取风格基因】
${hasReferenceImages ? `${refCount === 1 ?
`分析这张风格参考图，只提取以下风格要素：
- 画风类型（如：水墨风、赛博朋克、吉卜力、像素风、扁平插画、写实摄影等）
- 色调特征（如：暖黄调、冷蓝调、霓虹色、莫兰迪色等）
- 光影效果（如：逆光剪影、柔光漫射、硬光投影、霓虹光效等）
- 画面质感（如：厚涂质感、线稿感、磨砂质感、胶片颗粒等）
- 情感调性（如：热血燃、治愈暖、暗黑酷、梦幻柔等）

⚠️ 只提取风格DNA，不要描述参考图中的具体内容！` :
`逐张分析这${refCount}张风格参考图，每张都提取：
- 画风类型
- 色调特征
- 光影效果
- 画面质感
- 情感调性
然后综合所有参考图，提炼出一套统一的风格基因。`}` :
 '根据内容主体的特征，自动匹配最合适的视觉风格。'}

【第三步：创作全新分镜提示词】
现在你要用「内容主体图」的内容 + 提取的「风格基因」，创作一套全新的${sceneCount}个分镜。

🚨 核心规则（必须遵守）：
1. 分镜的主角是「内容主体图」中的产品/主体，不是参考图中的内容
2. 参考图的风格基因（画风、色调、光影、质感）要融入每个分镜
3. 场景、动作、构图必须是全新创作，不要复刻任何一张参考图的画面
4. 每个分镜描述的是同一个主体在不同场景/角度/动作下的画面

分镜要求：
- 每段80-120字，中文描述，生动有画面感
- ${sceneCount}个分镜有起承转合的叙事
- 视觉风格统一（同一套色调、画风、氛围）
- 每个分镜有不同的景别和角度变化
- 适合竖屏短视频（9:16）

叙事结构：
- 分镜1：开场引入（吸引注意力）
- 分镜2~${sceneCount - 1}：内容展开（多角度展示）
- 分镜${sceneCount}：结尾高潮（留有余韵）

${userPrompt ? `用户的补充描述：${userPrompt}\n请将用户的描述融入分镜创意中。` : ''}

【输出格式】（严格遵守）
1. 简短识别结果（2-3句）
2. ===ANALYSIS_END===
3. ===PROMPT_START===
4. 分镜提示词
5. ===PROMPT_END===

分镜提示词格式：
共${sceneCount}个分镜画面
分镜1：[画面描述]
分镜2：[画面描述]
...
分镜${sceneCount}：[画面描述]

只写识别结果和分镜提示词，不要写别的。`;

      messageContent.push({ type: 'input_text', text: userMessage });
      
      console.log('[分镜生成] 发送请求...');
      
      wx.request({
        url: `${API_CONFIG.doubao.baseUrl}/responses`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.doubao.apiKey}`
        },
        data: {
        model: API_CONFIG.doubao.model,
        input: [{ role: 'user', content: messageContent }]
      },
      success: (res) => {
        console.log('[分镜生成] 响应:', JSON.stringify(res.data));
          if (res.statusCode === 200 && res.data.output) {
            let fullContent = '';
            for (const item of res.data.output) {
              if (item.type === 'message' && item.content) {
                for (const content of item.content) {
                  if (content.type === 'output_text') {
                    fullContent = content.text.trim();
                    break;
                  }
                }
              }
            }
            if (fullContent) {
              const prompt = extractPromptFromAIResult(fullContent);
              resolve({ fullContent, prompt });
            } else {
              reject(new Error('AI未返回内容'));
            }
          } else {
            const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
            reject(new Error('分镜生成失败: ' + errMsg));
          }
        },
        fail: (err) => {
          reject(new Error('网络请求失败: ' + (err.errMsg || '未知错误')));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 纯文字生成视频分镜提示词（无图片）
function generateAIPromptFromText(productInfo) {
  return new Promise((resolve, reject) => {
    const { userPrompt, count } = productInfo;
    const sceneCount = count || 4;

    const userMessage = `请根据以下文字描述生成一套${sceneCount}个分镜的视频画面提示词。

用户描述：${userPrompt}

请按以下要求生成：

【分镜要求】
- 共${sceneCount}个分镜，构成一段完整的短视频叙事
- 每个分镜是一段完整的画面描述，用中文写，语言生动有画面感
- 每段描述80到120个字
- ${sceneCount}个分镜要有起承转合，画面有变化
- 自动选择最合适的画面风格和色调
- 适合竖屏短视频比例（9:16）

分镜叙事结构：
- 第1个分镜：开场/引入（全景或特写，吸引注意力）
- 第2-${sceneCount - 1}个分镜：内容展开（不同角度展示细节、场景变化）
- 最后一个分镜：结尾/高潮（留有余韵或行动号召）

【输出格式】
请严格按照以下格式输出：
1. 先输出一段简短的创意说明（2-3句话，说明整体方向）
2. 然后输出分隔符 ===ANALYSIS_END===
3. 然后输出分隔符 ===PROMPT_START===
4. 然后只输出用户要看到的分镜提示词
5. 然后输出分隔符 ===PROMPT_END===

用户看到的分镜提示词格式：
共${sceneCount}个分镜画面
分镜1：[详细画面描述]
分镜2：[详细画面描述]
...
分镜${sceneCount}：[详细画面描述]

不要写别的，就写创意说明和分镜提示词。`;

    wx.request({
      url: `${API_CONFIG.doubao.baseUrl}/responses`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.doubao.apiKey}`
      },
      data: {
        model: API_CONFIG.doubao.model,
        input: [{ role: 'user', content: [{ type: 'input_text', text: userMessage }] }]
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.output) {
          let fullContent = '';
          for (const item of res.data.output) {
            if (item.type === 'message' && item.content) {
              for (const content of item.content) {
                if (content.type === 'output_text') {
                  fullContent = content.text.trim();
                  break;
                }
              }
            }
          }
          if (fullContent) {
            const prompt = extractPromptFromAIResult(fullContent);
            resolve({ fullContent, prompt });
          } else {
            reject(new Error('AI未返回内容'));
          }
        } else {
          const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
          reject(new Error('分镜生成失败: ' + errMsg));
        }
      },
      fail: (err) => {
        reject(new Error('网络请求失败: ' + (err.errMsg || '未知错误')));
      }
    });
  });
}

// 调用豆包 Seedream 生成图片（图生图 / 文生图）
// imageSrc: 产品图路径（可为null）
// referenceImages: 参考图路径数组（可选）
function generateImage(prompt, count, imageSrc, referenceImages) {
  return new Promise(async (resolve, reject) => {
    try {
      // 兼容对象传参（chat.js _chatReply 传入了 {prompt, count}）
      if (typeof prompt === 'object' && prompt !== null && !Array.isArray(prompt)) {
        imageSrc = prompt.imageSrc || null;
        referenceImages = prompt.referenceImages || null;
        count = prompt.count;
        prompt = prompt.prompt;
      }

      // 构建图片数组
      const imageArray = [];
      
      // 添加产品图（如果有）
      if (imageSrc) {
        const base64ProductImage = await imageToBase64(imageSrc);
        imageArray.push(`data:image/jpeg;base64,${base64ProductImage}`);
      }
      
      // 添加参考图（如果有）
      if (referenceImages && referenceImages.length > 0) {
        for (const refImage of referenceImages) {
          if (refImage) {
            const base64RefImage = await imageToBase64(refImage);
            imageArray.push(`data:image/jpeg;base64,${base64RefImage}`);
          }
        }
      }

      const hasImages = imageArray.length > 0;
      
      // 构建带图片说明的提示词
      let promptWithImageInfo = '';
      const hasReferenceImages = referenceImages && referenceImages.length > 0;
      
      if (hasReferenceImages) {
        // 有参考图时，明确告诉模型哪张是产品图，哪张是参考图
        promptWithImageInfo = `【图片说明】
第1张图片是产品/主题图（需要展示的主体对象）
${referenceImages.map((_, i) => `第${i + 2}张图片是风格参考（仅借鉴其画风、色调、光影，禁止复制其内容）`).join('\n')}

【生成规则】
🚨 严禁复制参考图的画面内容！必须根据以下提示词全新创作：
- 参考图只用来学习画风和色调
- 画面内容必须100%根据提示词描述来生成
- 生成的图片中不要出现参考图中的人物、场景、动作

【提示词】
${prompt}`;
      } else {
        promptWithImageInfo = prompt;
      }
      
      // 清理提示词中的特殊字符（Seedream API 不接受特殊符号）
      // 有参考图时，提取【提示词】后面的内容；无参考图时直接用 prompt
      let cleanPromptText = '';
      const promptStr = String(prompt || '');
      
      if (hasReferenceImages) {
        const promptSectionMatch = promptWithImageInfo.match(/【提示词】\s*([\s\S]*)$/);
        cleanPromptText = promptSectionMatch ? String(promptSectionMatch[1]).trim() : promptStr;
      } else {
        cleanPromptText = promptStr;
      }
      
      cleanPromptText = cleanPromptText
        .replace(/[【】]/g, '')    // 去掉方括号
        .replace(/[🚨⚠️💡✨🎯🔥❤️⚡🌟💫🎭🎬📸🎨]/g, '')  // 去掉emoji
        .replace(/\n+/g, '，')     // 换行替换为逗号
        .replace(/，+/g, '，')     // 合并连续逗号
        .replace(/^[\d]+[个、]/, '') // 去掉开头的"共X个"数字
        .trim();
      
      // 确保提示词非空
      if (!cleanPromptText || cleanPromptText.length < 2) {
        cleanPromptText = promptStr || '请生成一张图片';
      }
      
      console.log('[生图] 最终提示词:', cleanPromptText.substring(0, 100) + '...');
      
      // 构建请求数据 - 使用豆包 Seedream API
      const requestData = {
        model: API_CONFIG.seedream.model,
        prompt: cleanPromptText,
        response_format: 'url',
        size: '2K',
        watermark: true
      };

      // 有图片时使用图生图，无图片时使用文生图
      if (hasImages) {
        requestData.image = imageArray.length === 1 ? imageArray[0] : imageArray;
      }

      // 多图序列化生成配置
      if (count && count >= 2) {
        requestData.sequential_image_generation = 'auto';
        requestData.sequential_image_generation_options = { max_images: count };
        requestData.stream = true;
      } else {
        requestData.sequential_image_generation = 'disabled';
        requestData.stream = false;
      }

      console.log('调用豆包 Seedream API...');
      var logData = Object.assign({}, requestData, { image: '[base64...]' });
      console.log('请求数据:', JSON.stringify(logData));

      wx.request({
        url: `${API_CONFIG.seedream.baseUrl}/images/generations`,
        method: 'POST',
        timeout: 180000,
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.seedream.apiKey}`
        },
        data: requestData,
        success: (res) => {
          console.log('豆包 Seedream 状态码:', res.statusCode);
          console.log('豆包 Seedream 响应:', JSON.stringify(res.data));
          
          if (res.statusCode === 200 && res.data.data) {
            const images = [];
            const data = res.data.data;
            
            // 提取图片 URL
            if (Array.isArray(data)) {
              for (const item of data) {
                if (item.url) {
                  images.push({
                    url: item.url,
                    b64_json: null
                  });
                }
              }
            }
            
            console.log('提取到的图片数量:', images.length);
            
            if (images.length > 0) {
              resolve(images);
            } else {
              reject(new Error('未找到生成的图片，API返回内容: ' + JSON.stringify(data)));
            }
          } else {
            const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
            reject(new Error('图片生成失败: ' + errMsg));
          }
        },
        fail: (err) => {
          console.error('豆包 Seedream 请求失败:', JSON.stringify(err));
          reject(new Error('网络请求失败: ' + (err.errMsg || '未知错误')));
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 图片内容安全检查（上传至云存储后调用云函数检查）
function checkImageSecurity(tempFilePath) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('[安全检查] 开始，文件路径:', tempFilePath);
      
      // 1. 将临时文件上传到云存储（用于安全检查）
      const cloudPath = `security-check/${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;
      console.log('[安全检查] 上传文件到云存储...');
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath
      });
      console.log('[安全检查] 上传成功，fileID:', uploadRes.fileID);

      // 2. 调用云函数进行内容安全检查（设置较长超时时间）
      console.log('[安全检查] 调用云函数...');
      const checkRes = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'securityCheck',
          fileID: uploadRes.fileID
        },
        config: {
          timeout: 15000  // 15秒超时
        }
      });

      const result = checkRes.result;
      console.log('[安全检查] 检查结果:', JSON.stringify(result));

      // 3. 检查完成后删除临时文件
      try {
        await wx.cloud.deleteFile({ fileList: [uploadRes.fileID] });
      } catch (e) {
        // 忽略删除失败
      }

      resolve(result);
    } catch (err) {
      console.error('[安全检查] 异常:', JSON.stringify(err));
      // 超时或网络异常时放行，避免阻塞正常使用
      resolve({ safe: true, errMsg: '检查跳过' });
    }
  });
}

// 文本内容安全检查（检查提示词等用户输入的文本）
function checkTextSecurity(content) {
  return new Promise(async (resolve, reject) => {
    try {
      const checkRes = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'textSecurityCheck',
          content: content
        }
      });
      resolve(checkRes.result);
    } catch (err) {
      console.error('文本安全检查异常:', err);
      resolve({ safe: false, errMsg: '内容安全检查失败，请重试' });
    }
  });
}

// 选择图片并进行安全检查（公共方法）
// options: { sourceType: ['album'] | ['camera'] | ['album', 'camera'], count: 1 }
// 返回: { tempPath: string } 或 null（用户取消/不合规）
function selectAndCheckImage(options = {}) {
  return new Promise((resolve, reject) => {
    wx.chooseMedia({
      count: options.count || 1,
      mediaType: ['image'],
      sourceType: options.sourceType || ['album', 'camera'],
      success: async (res) => {
        const tempPath = res.tempFiles[0].tempFilePath;
        wx.showLoading({ title: '安全检查中...' });
        try {
          const checkResult = await checkImageSecurity(tempPath);
          wx.hideLoading();
          if (!checkResult.safe) {
            wx.showModal({
              title: '图片不合规',
              content: checkResult.errMsg || '该照片不合规，请重新上传',
              showCancel: false,
              confirmText: '我知道了'
            });
            resolve(null);
          } else {
            resolve({ tempPath });
          }
        } catch (e) {
          wx.hideLoading();
          console.error('安全检查调用失败:', e);
          // 检查失败时放行
          resolve({ tempPath });
        }
      },
      fail: (err) => {
        // 用户取消选择
        resolve(null);
      }
    });
  });
}

// 豆包大模型纯文字对话
// messages: 对话历史 [{ role: 'user'|'assistant', content: '...' }]
// systemPrompt: 系统提示词（可选）
function chatWithAI(messages, systemPrompt) {
  return new Promise((resolve, reject) => {
    // 构建 input 数组
    const inputArray = [];

    // 添加系统提示词
    if (systemPrompt) {
      inputArray.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // 添加对话历史
    for (const msg of messages) {
      inputArray.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.text || ''
      });
    }

    wx.request({
      url: `${API_CONFIG.doubao.baseUrl}/responses`,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_CONFIG.doubao.apiKey}`
      },
      data: {
        model: API_CONFIG.doubao.model,
         input: inputArray
      },
      success: (res) => {
        console.log('[AI对话] 响应:', JSON.stringify(res.data));
        if (res.statusCode === 200 && res.data.output) {
          let reply = '';
          for (const item of res.data.output) {
            if (item.type === 'message' && item.content) {
              for (const content of item.content) {
                if (content.type === 'output_text') {
                  reply = content.text.trim();
                  break;
                }
              }
            }
          }
          if (reply) {
            resolve(reply);
          } else {
            reject(new Error('AI未返回回复'));
          }
        } else {
          const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
          reject(new Error('对话失败: ' + errMsg));
        }
      },
      fail: (err) => {
        reject(new Error('网络请求失败: ' + (err.errMsg || '未知错误')));
      }
    });
  });
}

module.exports = {
  generateAIPrompt,
  generateAIPromptFromText,
  generateImage,
  chatWithAI,
  checkImageSecurity,
  checkTextSecurity,
  selectAndCheckImage
};
