/**
 * AI API - Vercel Serverless Function
 * 调用豆包AI API
 */

const config = require('./config');

// 从AI返回结果中提取提示词部分
function extractPromptFromAIResult(fullContent) {
  const startMarker = '===PROMPT_START===';
  const endMarker = '===PROMPT_END===';

  const startIndex = fullContent.indexOf(startMarker);
  const endIndex = fullContent.indexOf(endMarker);

  if (startIndex !== -1 && endIndex !== -1) {
    return fullContent.substring(startIndex + startMarker.length, endIndex).trim();
  }

  return fullContent;
}

// ==================== 调用豆包AI API ====================
async function callDoubaoAPI(messages, model = config.doubao.model) {
  const response = await fetch(`${config.doubao.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.doubao.apiKey}`
    },
    body: JSON.stringify({
      model,
      input: messages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'AI请求失败');
  }

  // 提取回复文本
  let reply = '';
  if (data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text') {
            reply = content.text.trim();
            break;
          }
        }
      }
    }
  }

  if (!reply) {
    throw new Error('AI未返回内容');
  }

  return reply;
}

// ==================== 生成分镜提示词（图片识别） ====================
module.exports.generatePrompt = async (req, res) => {
  const { images, userPrompt, count } = req.body;
  const sceneCount = count || 4;

  try {
    // 构建消息内容
    const messageContent = [];

    // 添加图片（base64格式）
    if (images && images.length > 0) {
      images.forEach(base64 => {
        messageContent.push({
          type: 'input_image',
          image_url: `data:image/jpeg;base64,${base64}`
        });
      });
    }

    // 构建提示词
    const userMessage = `请根据以下图片生成一套${sceneCount}个分镜的视频画面提示词。

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

${userPrompt ? `用户的补充描述：${userPrompt}\n请将用户的描述融入分镜创意中。` : ''}

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

    messageContent.push({ type: 'input_text', text: userMessage });

    const fullContent = await callDoubaoAPI([{ role: 'user', content: messageContent }]);
    const prompt = extractPromptFromAIResult(fullContent);

    return res.json({
      success: true,
      fullContent,
      prompt
    });
  } catch (err) {
    console.error('[生成分镜提示词] 失败:', err);
    return res.status(500).json({ success: false, errMsg: err.message });
  }
};

// ==================== 纯文字生成分镜提示词 ====================
module.exports.generatePromptFromText = async (req, res) => {
  const { userPrompt, count } = req.body;
  const sceneCount = count || 4;

  try {
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

    const fullContent = await callDoubaoAPI([{
      role: 'user',
      content: [{ type: 'input_text', text: userMessage }]
    }]);

    const prompt = extractPromptFromAIResult(fullContent);

    return res.json({
      success: true,
      fullContent,
      prompt
    });
  } catch (err) {
    console.error('[纯文字生成分镜提示词] 失败:', err);
    return res.status(500).json({ success: false, errMsg: err.message });
  }
};

// ==================== 生成图片 ====================
module.exports.generateImage = async (req, res) => {
  const { prompt, count, images, referenceImages } = req.body;

  try {
    // 构建图片数组
    const imageArray = [];

    if (images && images.length > 0) {
      images.forEach(base64 => {
        imageArray.push(`data:image/jpeg;base64,${base64}`);
      });
    }

    const hasImages = imageArray.length > 0;

    // 清理提示词
    let cleanPrompt = String(prompt || '')
      .replace(/[【】]/g, '')
      .replace(/[🚨⚠️💡✨🎯🔥❤️⚡🌟💫🎭🎬📸🎨]/g, '')
      .replace(/\n+/g, '，')
      .replace(/，+/g, '，')
      .replace(/^[\d]+[个、]/, '')
      .trim();

    if (!cleanPrompt || cleanPrompt.length < 2) {
      cleanPrompt = prompt || '请生成一张图片';
    }

    // 构建请求数据
    const requestData = {
      model: config.seedream.model,
      prompt: cleanPrompt,
      response_format: 'url',
      size: '2K',
      watermark: true
    };

    // 有图片时使用图生图
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

    console.log('[生图] 调用豆包 Seedream API...');

    const response = await fetch(`${config.seedream.baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.seedream.apiKey}`
      },
      body: JSON.stringify(requestData)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || '图片生成失败');
    }

    // 提取图片URL
    const resultImages = [];
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(item => {
        if (item.url) {
          resultImages.push({ url: item.url });
        }
      });
    }

    if (resultImages.length > 0) {
      return res.json({
        success: true,
        images: resultImages
      });
    } else {
      throw new Error('未找到生成的图片');
    }
  } catch (err) {
    console.error('[生图] 失败:', err);
    return res.status(500).json({ success: false, errMsg: err.message });
  }
};

// ==================== 纯文字对话 ====================
module.exports.chat = async (req, res) => {
  const { messages, systemPrompt } = req.body;

  try {
    // 构建消息数组
    const inputArray = [];

    if (systemPrompt) {
      inputArray.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // 转换消息格式
    if (messages && Array.isArray(messages)) {
      messages.forEach(msg => {
        inputArray.push({
          role: msg.role === 'ai' ? 'assistant' : 'user',
          content: msg.text || ''
        });
      });
    }

    const reply = await callDoubaoAPI(inputArray);

    return res.json({
      success: true,
      reply
    });
  } catch (err) {
    console.error('[对话] 失败:', err);
    return res.status(500).json({ success: false, errMsg: err.message });
  }
};
