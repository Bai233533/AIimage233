const API_CONFIG = require('../config/api');

// 将本地图片转换为 base64
function imageToBase64(imagePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath: imagePath,
      encoding: 'base64',
      success: (res) => {
        resolve(res.data);
      },
      fail: (err) => {
        reject(err);
      }
    });
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

// 调用豆包 AI 生成提示词（基于图片识别）
// referenceImages: 参考图列表（可选），有参考图时会分析参考图特点
// 返回值：{ fullContent: 完整内容, prompt: 用户看到的提示词 }
function generateAIPrompt(productInfo) {
  return new Promise(async (resolve, reject) => {
    const { imageSrc, audience, platform, ratio, count, referenceImages } = productInfo;
    
    try {
      // 将产品图转换为 base64
      const base64ProductImage = await imageToBase64(imageSrc);
      
      // 判断是否需要多场景提示词
      const isMultiScene = count && count >= 2;
      
      // 判断是否有参考图
      const hasReferenceImages = referenceImages && referenceImages.length > 0;
      
      // 构建消息内容数组（图片+文字）
      const messageContent = [];
      
      // 添加产品图
      messageContent.push({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${base64ProductImage}`
        }
      });
      
      // 如果有参考图，添加参考图
      if (hasReferenceImages) {
        for (let i = 0; i < referenceImages.length; i++) {
          const base64RefImage = await imageToBase64(referenceImages[i]);
          messageContent.push({
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64RefImage}`
            }
          });
        }
      }
      
      // 构建提示词
      let userMessage = '';
      
      if (hasReferenceImages) {
        // 有参考图时的提示词规则
        const refCount = referenceImages.length;
        
        userMessage = `我给你上传了1张产品图和${refCount}张参考图，请按以下流程处理：

【第一步：识别产品图】
请先识别产品图中的商品或物品，告诉我这是什么商品，识别清楚，不要错误。

【第二步：分析参考图】
${refCount === 1 ? 
`请仔细分析这张参考图的特点，包括：
- 整体风格（如：简约、复古、清新、高级感等）
- 色调和光影（如：暖色调、冷色调、柔光、硬光等）
- 构图方式（如：俯拍、平拍、45度角等）
- 场景布置（如：室内、户外、纯色背景等）
- 氛围感受（如：温馨、活力、专业、文艺等）` :
`请逐张分析这${refCount}张参考图的特点，每张都要描述：
- 整体风格（如：简约、复古、清新、高级感等）
- 色调和光影（如：暖色调、冷色调、柔光、硬光等）
- 构图方式（如：俯拍、平拍、45度角等）
- 场景布置（如：室内、户外、纯色背景等）
- 氛围感受（如：温馨、活力、专业、文艺等）

然后综合提取这些参考图的共同特点和精华元素。`}

【第三步：生成提示词】
基于产品图的商品，参考以上参考图的特点，帮我写一套提示词，用户要生成一组套图。

提示词要求如下：
- 用中文写，说人话
- 把商品放画面中间，好看就行
- 每段指令80到120个字
- 必须明确提到参考图的哪些特点被采用（如：参考图1的暖色调、参考图2的俯拍角度等）
- 必须包含用户选择的以下配置：
  【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】
${isMultiScene ? `
【套图要求 - 生成${count}张不同场景的图片】：
你需要写${count}段完全不一样的生成图片指令，每段必须是不同的场景！
每段都要结合参考图的不同特点来生成。
` : `
【单图要求】：
只需要写一段生成图片指令。
`}

【输出格式 - 必须严格按照这个格式】：

${isMultiScene ? `
第一张图片的要求是：[具体的生成图片指令，要明确提到参考了哪些参考图的什么特点]
【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】

第二张图片的要求是：[具体的生成图片指令，要明确提到参考了哪些参考图的什么特点]
【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】

...以此类推，直到第${count}张。
` : `
以下是对这张图片的生成要求：
[具体的生成图片指令，要明确提到参考了哪些参考图的什么特点]
【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】
`}

【最后必须加的一句话】：
确保图片的正确性，和用户上传的产品图保持一致。

【重要：输出格式要求】
请严格按照以下格式输出：
1. 先输出分析过程（产品识别和参考图分析）
2. 然后输出分隔符 ===ANALYSIS_END===
3. 然后输出分隔符 ===PROMPT_START===
4. 然后只输出用户要看到的提示词部分（总述+每张图片要求）
5. 然后输出分隔符 ===PROMPT_END===

用户看到的提示词部分格式：
一共要生成N张图片
第一张图片的要求是：...
【照片比例：xxx | 目标人群：xxx | 发布平台：xxx】
第二张图片的要求是：...
【照片比例：xxx | 目标人群：xxx | 发布平台：xxx】
...
确保图片的正确性，和用户上传的产品图保持一致。

别写别的，就写识别结果、参考图分析和提示词。`;
      } else {
        // 无参考图时的提示词规则（保持原有逻辑）
        userMessage = `请先识别这张图片中的商品或物品，告诉我这是什么商品，你自己识别清楚，不要识别错误。

识别清楚后，基于这个商品帮我写一套提示词，用户要生成一组套图。

提示词要求如下：
- 用中文写，说人话
- 把商品放画面中间，好看就行
- 每段指令80到120个字
- 必须包含用户选择的以下配置：
  【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】
${isMultiScene ? `
【套图要求 - 生成${count}张不同场景的图片】：
你需要写${count}段完全不一样的生成图片指令，每段必须是不同的场景！
场景你自己自由发挥，要符合商品的特征和用户的需求，以及最重要的，符合用户选的面向群众和发布平台。
` : `
【单图要求】：
只需要写一段生成图片指令。
`}

【输出格式 - 必须严格按照这个格式】：

${isMultiScene ? `
第一张图片的要求是：[具体的生成图片指令]
【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】

第二张图片的要求是：[具体的生成图片指令]
【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】

...以此类推，直到第${count}张。
` : `
以下是对这张图片的生成要求：
[具体的生成图片指令]
【照片比例：${ratio || '自由选择'} | 目标人群：${audience || '通用'} | 发布平台：${platform || '通用'}】
`}

【最后必须加的一句话】：
确保图片的正确性，和用户上传的图片保持一致。

【重要：输出格式要求】
请严格按照以下格式输出：
1. 先输出产品识别结果
2. 然后输出分隔符 ===ANALYSIS_END===
3. 然后输出分隔符 ===PROMPT_START===
4. 然后只输出用户要看到的提示词部分（总述+每张图片要求）
5. 然后输出分隔符 ===PROMPT_END===

用户看到的提示词部分格式：
一共要生成N张图片
第一张图片的要求是：...
【照片比例：xxx | 目标人群：xxx | 发布平台：xxx】
第二张图片的要求是：...
【照片比例：xxx | 目标人群：xxx | 发布平台：xxx】
...
确保图片的正确性，和用户上传的图片保持一致。

别写别的，就写识别结果和提示词。`;
      }

      // 构建 input 数组（图片+文字）
      const inputArray = [];
      
      // 添加图片
      for (const item of messageContent) {
        if (item.type === 'image_url') {
          inputArray.push({
            type: 'input_image',
            image_url: item.image_url.url
          });
        }
      }
      
      // 添加文字
      inputArray.push({
        type: 'input_text',
        text: userMessage
      });

      // 调用豆包大模型（使用 /responses 端点）
      wx.request({
        url: `${API_CONFIG.doubao.baseUrl}/responses`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_CONFIG.doubao.apiKey}`
        },
        data: {
          model: API_CONFIG.doubao.model,
          input: [
            {
              role: 'user',
              content: inputArray
            }
          ]
        },
        success: (res) => {
          console.log('豆包API响应:', JSON.stringify(res.data));
          if (res.statusCode === 200 && res.data.output) {
            // 从 output 中提取文本内容
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
              // 提取用户看到的提示词部分
              const prompt = extractPromptFromAIResult(fullContent);
              // 返回完整内容和提取的提示词
              resolve({ fullContent, prompt });
            } else {
              reject(new Error('AI生成失败: 未获取到文本内容'));
            }
          } else {
            console.log('响应数据:', JSON.stringify(res.data));
            reject(new Error(`AI生成失败: ${JSON.stringify(res.data)}`));
          }
        },
        fail: (err) => {
          reject(err);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// 调用豆包 Seedream 生成图片（图生图）
// imageSrc: 产品图路径
// referenceImages: 参考图路径数组（可选）
function generateImage(prompt, count, imageSrc, referenceImages) {
  return new Promise(async (resolve, reject) => {
    try {
      // 将产品图转换为 base64
      const base64ProductImage = await imageToBase64(imageSrc);
      
      // 构建图片数组（产品图 + 参考图）
      const imageArray = [`data:image/jpeg;base64,${base64ProductImage}`];
      
      // 添加参考图
      if (referenceImages && referenceImages.length > 0) {
        for (const refImage of referenceImages) {
          if (refImage) {
            const base64RefImage = await imageToBase64(refImage);
            imageArray.push(`data:image/jpeg;base64,${base64RefImage}`);
          }
        }
      }
      
      // 构建带图片说明的提示词
      let promptWithImageInfo = '';
      const hasReferenceImages = referenceImages && referenceImages.length > 0;
      
      if (hasReferenceImages) {
        // 有参考图时，明确告诉模型哪张是产品图，哪张是参考图
        promptWithImageInfo = `【图片说明】
第1张图片是产品图（需要生成的主体商品）
${referenceImages.map((_, i) => `第${i + 2}张图片是参考图（参考其风格、构图、场景等）`).join('\n')}

【生成要求】
${prompt}`;
      } else {
        promptWithImageInfo = prompt;
      }
      
      // 构建请求数据 - 使用豆包 Seedream 图生图 API
      const requestData = {
        model: API_CONFIG.seedream.model,
        prompt: promptWithImageInfo,
        image: imageArray.length === 1 ? imageArray[0] : imageArray, // 单张传字符串，多张传数组
        response_format: 'url',
        size: '2K',
        stream: false,
        watermark: true
      };

      // 如果需要生成多张图片，添加 sequential_image_generation 配置
      if (count && count >= 2) {
        requestData.sequential_image_generation = 'auto';
        requestData.sequential_image_generation_options = {
          max_images: count
        };
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

module.exports = {
  generateAIPrompt,
  generateImage,
  checkImageSecurity,
  checkTextSecurity,
  selectAndCheckImage
};
