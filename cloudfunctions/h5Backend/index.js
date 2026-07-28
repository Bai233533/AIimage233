/**
 * h5Backend - H5 网页版后端云函数
 * 
 * 功能：
 * 1. AI 代理（generatePrompt / generateImage / chat）—— API Key 安全存储在云函数内
 * 2. 用户管理（login / register / checkMembership / verifyCardKey）—— 基于 username 查询，不依赖 openid
 * 3. 文本安全检查（textSecurityCheck）
 * 
 * 部署后，在云开发控制台设置环境变量 DOUBAO_API_KEY 以覆盖默认 Key
 */

const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

// ==================== API 配置 ====================
const DOUBAO_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
// 优先使用环境变量，回退到硬编码（部署后建议在云控制台设置环境变量覆盖）
const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || 'ark-f93f0cb1-d06a-4bf5-af7b-00787df51ebc-672cd';
const DOUBAO_MODEL = 'doubao-seed-2-1-turbo-260628';
const SEEDREAM_MODEL = 'doubao-seedream-5-0-pro-260628';

// ==================== HTTP 请求工具 ====================

function httpsRequest(url, postData, timeoutMs) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const bodyStr = postData ? JSON.stringify(postData) : null;

    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DOUBAO_API_KEY
      },
      timeout: timeoutMs || 55000
    };
    if (bodyStr) {
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let chunks = [];
      res.on('data', (chunk) => { chunks.push(chunk); });
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('请求超时')); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ==================== 提示词提取工具 ====================

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

// ==================== AI: 生成分镜提示词（图片识别） ====================

async function generatePrompt(event) {
  const { images, userPrompt, count } = event;
  // images: base64 字符串数组（不含 data:image 前缀）
  // images[0] = 内容主体图, images[1:] = 风格参考图

  if (!images || images.length === 0) {
    return { success: false, errMsg: '请上传至少一张图片' };
  }

  const sceneCount = count || 4;
  const hasReferenceImages = images.length > 1;
  const refCount = hasReferenceImages ? images.length - 1 : 0;

  const messageContent = [];
  // 添加所有图片
  for (let i = 0; i < images.length; i++) {
    messageContent.push({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,' + images[i] }
    });
  }

  const userMessage = buildPromptGenerationMessage(sceneCount, hasReferenceImages, refCount, userPrompt);
  messageContent.push({ type: 'text', text: userMessage });

  const requestData = {
    model: DOUBAO_MODEL,
    messages: [{ role: 'user', content: messageContent }]
  };

  const res = await httpsRequest(DOUBAO_BASE_URL + '/chat/completions', requestData, 55000);

  if (res.statusCode === 200 && res.data.choices) {
    const fullContent = res.data.choices[0]?.message?.content?.trim();
    if (fullContent) {
      const prompt = extractPromptFromAIResult(fullContent);
      return { success: true, fullContent, prompt };
    }
    return { success: false, errMsg: 'AI 未返回内容' };
  }
  const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
  return { success: false, errMsg: '分镜生成失败: ' + errMsg };
}

function buildPromptGenerationMessage(sceneCount, hasRef, refCount, userPrompt) {
  return `请根据以下图片生成一套${sceneCount}个分镜的视频画面提示词。

═══════════════════════════════════════
图片分工（非常重要！）：
- 第1张是「内容主体图」：你要识别这张图的内容，作为分镜的主角
- ${hasRef ? `第2张起是「风格参考图」：你只能学习它的画风、色调、光影，绝对不能复制它的画面内容` : '没有额外参考图，风格由你根据内容自动匹配'}
═══════════════════════════════════════

【第一步：识别内容主体图】
仔细识别第1张图片，回答：
- 这是什么？（产品/人物/食物/动物/场景等）
- 主体有什么特征？（颜色、形状、材质、造型）
- 背景是什么？（室内/室外/纯色/虚化）
- 整体什么氛围？（高级/可爱/科技/自然）

【第二步：提取风格基因】
${hasRef ? (refCount === 1 ?
`分析这张风格参考图，只提取以下风格要素：
- 画风类型（如：水墨风、赛博朋克、吉卜力、像素风、扁平插画、写实摄影等）
- 色调特征（如：暖黄调、冷蓝调、霓虹色、莫兰迪色等）
- 光影效果（如：逆光剪影、柔光漫射、硬光投影、霓虹光效等）
- 画面质感（如：厚涂质感、线稿感、磨砂质感、胶片颗粒等）
- 情感调性（如：热血燃、治愈暖、暗黑酷、梦幻柔等）

只提取风格DNA，不要描述参考图中的具体内容！` :
`逐张分析这${refCount}张风格参考图，每张都提取：
- 画风类型
- 色调特征
- 光影效果
- 画面质感
- 情感调性
然后综合所有参考图，提炼出一套统一的风格基因。`) :
 '根据内容主体的特征，自动匹配最合适的视觉风格。'}

【第三步：创作全新分镜提示词】
现在你要用「内容主体图」的内容 + 提取的「风格基因」，创作一套全新的${sceneCount}个分镜。

核心规则（必须遵守）：
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
}

// ==================== AI: 纯文字生成分镜提示词 ====================

async function generatePromptFromText(event) {
  const { userPrompt, count } = event;
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

  const requestData = {
    model: DOUBAO_MODEL,
    messages: [{ role: 'user', content: [{ type: 'text', text: userMessage }] }]
  };

  const res = await httpsRequest(DOUBAO_BASE_URL + '/chat/completions', requestData, 55000);

  if (res.statusCode === 200 && res.data.choices) {
    const fullContent = res.data.choices[0]?.message?.content?.trim();
    if (fullContent) {
      const prompt = extractPromptFromAIResult(fullContent);
      return { success: true, fullContent, prompt };
    }
    return { success: false, errMsg: 'AI 未返回内容' };
  }
  const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
  return { success: false, errMsg: '分镜生成失败: ' + errMsg };
}

// ==================== AI: 生成图片（文生图 / 图生图） ====================

async function generateImage(event) {
  const { prompt, count, images, referenceImages } = event;
  // prompt: 提示词字符串
  // count: 生成数量
  // images: base64 数组（产品图 + 参考图，合并）
  // referenceImages: 参考图数量（images 中最后 N 张是参考图）

  if (!prompt) {
    return { success: false, errMsg: '提示词不能为空' };
  }

  const imageCount = count || 1;
  const hasImages = images && images.length > 0;
  const refCount = referenceImages || 0;

  // 构建提示词
  let promptWithImageInfo = '';
  if (refCount > 0) {
    promptWithImageInfo = `【图片说明】
第1张图片是产品/主题图（需要展示的主体对象）
${Array.from({ length: refCount }, (_, i) => `第${i + 2}张图片是风格参考（仅借鉴其画风、色调、光影，禁止复制其内容）`).join('\n')}

【生成规则】
严禁复制参考图的画面内容！必须根据以下提示词全新创作：
- 参考图只用来学习画风和色调
- 画面内容必须100%根据提示词描述来生成
- 生成的图片中不要出现参考图中的人物、场景、动作

【提示词】
${prompt}`;
  } else {
    promptWithImageInfo = prompt;
  }

  // 清理提示词
  let cleanPromptText = '';
  const promptStr = String(prompt || '');
  if (refCount > 0) {
    const promptSectionMatch = promptWithImageInfo.match(/【提示词】\s*([\s\S]*)$/);
    cleanPromptText = promptSectionMatch ? String(promptSectionMatch[1]).trim() : promptStr;
  } else {
    cleanPromptText = promptStr;
  }

  cleanPromptText = cleanPromptText
    .replace(/[【】]/g, '')
    .replace(/[🚨⚠️💡✨🎯🔥❤️⚡🌟💫🎭🎬📸🎨]/g, '')
    .replace(/\n+/g, '，')
    .replace(/，+/g, '，')
    .replace(/^[\d]+[个、]/, '')
    .trim();

  if (!cleanPromptText || cleanPromptText.length < 2) {
    cleanPromptText = promptStr || '请生成一张图片';
  }

  // 构建请求数据
  const requestData = {
    model: SEEDREAM_MODEL,
    prompt: cleanPromptText,
    response_format: 'url',
    size: '2K',
    watermark: true,
    stream: false,
    sequential_image_generation: 'disabled'
  };

  // 添加图片（图生图）
  if (hasImages) {
    const imageArray = images.map(b64 => 'data:image/jpeg;base64,' + b64);
    requestData.image = imageArray.length === 1 ? imageArray[0] : imageArray;
  }

  // 多图生成
  if (imageCount >= 2) {
    requestData.sequential_image_generation = 'auto';
    requestData.sequential_image_generation_options = { max_images: imageCount };
  }

  const res = await httpsRequest(DOUBAO_BASE_URL + '/images/generations', requestData, 55000);

  if (res.statusCode === 200 && res.data.data) {
    const resultImages = [];
    const data = res.data.data;
    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.url) {
          resultImages.push({ url: item.url, b64_json: null });
        }
      }
    }
    if (resultImages.length > 0) {
      return { success: true, images: resultImages };
    }
    return { success: false, errMsg: '未找到生成的图片: ' + JSON.stringify(data) };
  }

  const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
  return { success: false, errMsg: '图片生成失败: ' + errMsg };
}

// ==================== AI: 纯文字对话 ====================

async function chat(event) {
  const { messages, systemPrompt } = event;

  const inputArray = [];
  if (systemPrompt) {
    inputArray.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of (messages || [])) {
    inputArray.push({
      role: msg.role === 'ai' ? 'assistant' : 'user',
      content: msg.text || ''
    });
  }

  const requestData = {
    model: DOUBAO_MODEL,
    messages: inputArray
  };

  const res = await httpsRequest(DOUBAO_BASE_URL + '/chat/completions', requestData, 55000);

  if (res.statusCode === 200 && res.data.choices) {
    const reply = res.data.choices[0]?.message?.content?.trim();
    if (reply) {
      return { success: true, reply };
    }
    return { success: false, errMsg: 'AI 未返回回复' };
  }
  const errMsg = res.data && res.data.error ? res.data.error.message : JSON.stringify(res.data);
  return { success: false, errMsg: '对话失败: ' + errMsg };
}

// ==================== 用户管理: 登录 ====================

async function userLogin(event) {
  const { username, password } = event;
  if (!username || !password) {
    return { success: false, errMsg: '账号和密码不能为空' };
  }

  try {
    const userRes = await db.collection('users').where({ username }).get();
    if (userRes.data.length === 0) {
      return { success: false, errMsg: '账号不存在' };
    }
    const user = userRes.data[0];
    if (user.password !== password) {
      return { success: false, errMsg: '密码错误' };
    }
    const now = new Date();
    const isMember = user.expireTime && new Date(user.expireTime) > now;
    return {
      success: true,
      username: user.username,
      isMember,
      expireTime: user.expireTime,
      token: 'h5_' + user.username + '_' + Date.now()
    };
  } catch (err) {
    console.error('[H5登录] 异常:', err);
    return { success: false, errMsg: '登录失败：' + (err.message || '请检查users集合') };
  }
}

// ==================== 用户管理: 注册 ====================

async function userRegister(event) {
  const { username, password } = event;
  if (!username || !password) {
    return { success: false, errMsg: '账号和密码不能为空' };
  }
  if (username.length < 2 || username.length > 20) {
    return { success: false, errMsg: '账号需2-20个字符' };
  }
  if (password.length < 6 || password.length > 20) {
    return { success: false, errMsg: '密码需6-20个字符' };
  }

  try {
    const userRes = await db.collection('users').where({ username }).get();
    if (userRes.data.length > 0) {
      return { success: false, errMsg: '该账号已被注册' };
    }

    const now = new Date();
    const expireTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 新用户赠送1天会员

    await db.collection('users').add({
      data: {
        openid: 'h5_' + username,
        username,
        password,
        expireTime,
        createTime: now,
        freeUsed: 0
      }
    });

    return {
      success: true,
      username,
      isMember: true,
      expireTime,
      token: 'h5_' + username + '_' + Date.now()
    };
  } catch (err) {
    console.error('[H5注册] 异常:', err);
    return { success: false, errMsg: '注册失败：' + (err.message || '请检查users集合') };
  }
}

// ==================== 用户管理: 检查会员状态 ====================

async function checkMembership(event) {
  const { username } = event;
  if (!username) {
    return { success: true, isMember: false, isNewUser: true };
  }

  try {
    const userRes = await db.collection('users').where({ username }).get();
    if (userRes.data.length === 0) {
      return { success: true, isMember: false, isNewUser: true };
    }
    const user = userRes.data[0];
    const now = new Date();
    const isMember = user.expireTime && new Date(user.expireTime) > now;
    return {
      success: true,
      isMember,
      isNewUser: false,
      expireTime: user.expireTime
    };
  } catch (err) {
    console.error('[H5检查会员] 失败:', err);
    return { success: false, errMsg: err.message };
  }
}

// ==================== 用户管理: 卡密兑换 ====================

async function verifyCardKey(event) {
  const { username, cardKey } = event;
  if (!cardKey || !cardKey.trim()) {
    return { success: false, errMsg: '请输入卡密' };
  }
  if (!username) {
    return { success: false, errMsg: '请先登录' };
  }

  try {
    const keyRes = await db.collection('card_keys').where({
      key: cardKey.trim().toUpperCase(),
      status: 'unused'
    }).get();

    if (keyRes.data.length === 0) {
      return { success: false, errMsg: '卡密无效或已被使用' };
    }

    const cardRecord = keyRes.data[0];
    const now = new Date();

    // 更新卡密状态
    await db.collection('card_keys').where({ _id: cardRecord._id }).update({
      data: {
        status: 'used',
        usedBy: 'h5_' + username,
        usedTime: now
      }
    });

    // 更新用户会员到期时间
    const userRes = await db.collection('users').where({ username }).get();
    let expireTime;

    if (userRes.data.length > 0) {
      const user = userRes.data[0];
      const currentExpire = user.expireTime ? new Date(user.expireTime) : now;
      expireTime = currentExpire > now
        ? new Date(currentExpire.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db.collection('users').where({ username }).update({
        data: { expireTime }
      });
    } else {
      expireTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      await db.collection('users').add({
        data: {
          openid: 'h5_' + username,
          username,
          password: '',
          expireTime,
          createTime: now,
          freeUsed: 0
        }
      });
    }

    return { success: true, expireTime };
  } catch (err) {
    console.error('[H5卡密验证] 失败:', err);
    return { success: false, errMsg: '验证失败: ' + err.message };
  }
}

// ==================== 文本安全检查 ====================

async function textSecurityCheck(event) {
  const { content } = event;
  if (!content) {
    return { safe: true, errMsg: '内容为空' };
  }
  try {
    // 使用微信云开发的内容安全 API
    const result = await cloud.openapi.security.msgSecCheck({
      content: content.substring(0, 500)
    });
    return { safe: true, result };
  } catch (err) {
    // 安全检查失败时放行（fail-open），避免阻塞正常使用
    console.log('[文本安全检查] 跳过:', err.errMsg || err.message);
    return { safe: true, errMsg: '检查跳过' };
  }
}

// ==================== 入口分发 ====================

exports.main = async (event, context) => {
  const action = event.action;
  console.log('[h5Backend] action:', action);

  try {
    switch (action) {
      // AI 相关
      case 'generatePrompt':
        return await generatePrompt(event);
      case 'generatePromptFromText':
        return await generatePromptFromText(event);
      case 'generateImage':
        return await generateImage(event);
      case 'chat':
        return await chat(event);

      // 用户管理
      case 'login':
        return await userLogin(event);
      case 'register':
        return await userRegister(event);
      case 'checkMembership':
        return await checkMembership(event);
      case 'verifyCardKey':
        return await verifyCardKey(event);

      // 安全检查
      case 'textSecurityCheck':
        return await textSecurityCheck(event);

      default:
        return { success: false, errMsg: '未知操作: ' + action };
    }
  } catch (err) {
    console.error('[h5Backend] 异常:', err);
    return { success: false, errMsg: '服务器错误: ' + (err.message || '未知错误') };
  }
};
