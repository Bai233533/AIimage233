/**
 * Cloudflare Workers - AI漫剧大师 后端API
 */

// 内存存储（开发用，生产建议用KV或D1）
const users = new Map();
const cardKeys = new Map();

// 初始化测试卡密
const initTestCardKeys = () => {
  const testKeys = ['VIP-TEST-1234', 'VIP-DEMO-5678'];
  testKeys.forEach(key => {
    cardKeys.set(key, { key, status: 'unused', createTime: new Date() });
  });
};
initTestCardKeys();

// CORS 头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// 工具函数
function generateToken(openid) {
  // 简单的token生成（生产环境建议用JWT）
  return btoa(openid + ':' + Date.now());
}

function verifyToken(token) {
  try {
    const decoded = atob(token);
    const [openid] = decoded.split(':');
    return { openid };
  } catch {
    return null;
  }
}

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

// 调用豆包AI API
async function callDoubaoAPI(messages, apiKey, model) {
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, input: messages })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || 'AI请求失败');
  let reply = '';
  if (data.output) {
    for (const item of data.output) {
      if (item.type === 'message' && item.content) {
        for (const content of item.content) {
          if (content.type === 'output_text') { reply = content.text.trim(); break; }
        }
      }
    }
  }
  if (!reply) throw new Error('AI未返回内容');
  return reply;
}

// 主处理函数
export default {
  async fetch(request, env) {
    // 处理 CORS 预检请求
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      // 解析请求体
      let body = {};
      if (method === 'POST') {
        body = await request.json();
      }

      // ==================== 认证API ====================

      // 登录
      if (path === '/api/auth/login' && method === 'POST') {
        const { username, password } = body;
        if (!username || !password) {
          return Response.json({ success: false, errMsg: '账号和密码不能为空' }, { headers: corsHeaders });
        }
        let user = null;
        for (const [_, u] of users) {
          if (u.username === username) { user = u; break; }
        }
        if (!user) {
          return Response.json({ success: false, errMsg: '账号不存在' }, { headers: corsHeaders });
        }
        if (user.password !== password) {
          return Response.json({ success: false, errMsg: '密码错误' }, { headers: corsHeaders });
        }
        const now = new Date();
        const isMember = user.expireTime && new Date(user.expireTime) > now;
        return Response.json({
          success: true,
          username: user.username,
          isMember,
          expireTime: user.expireTime,
          token: generateToken(user.openid)
        }, { headers: corsHeaders });
      }

      // 注册
      if (path === '/api/auth/register' && method === 'POST') {
        const { username, password } = body;
        if (!username || !password) {
          return Response.json({ success: false, errMsg: '账号和密码不能为空' }, { headers: corsHeaders });
        }
        let exists = false;
        for (const [_, u] of users) {
          if (u.username === username) { exists = true; break; }
        }
        if (exists) {
          return Response.json({ success: false, errMsg: '该账号已被注册' }, { headers: corsHeaders });
        }
        const openid = 'web_' + crypto.randomUUID();
        const now = new Date();
        const expireTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);
        users.set(openid, { openid, username, password, expireTime, createTime: now, freeUsed: 0 });
        return Response.json({
          success: true,
          username,
          isMember: true,
          expireTime,
          token: generateToken(openid)
        }, { headers: corsHeaders });
      }

      // 检查会员状态
      if (path === '/api/auth/check-membership' && method === 'POST') {
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        if (!token) {
          return Response.json({ success: true, isMember: false, isNewUser: true }, { headers: corsHeaders });
        }
        const decoded = verifyToken(token);
        if (!decoded) {
          return Response.json({ success: true, isMember: false, isNewUser: true }, { headers: corsHeaders });
        }
        const user = users.get(decoded.openid);
        if (!user) {
          return Response.json({ success: true, isMember: false, isNewUser: true }, { headers: corsHeaders });
        }
        const now = new Date();
        const isMember = user.expireTime && new Date(user.expireTime) > now;
        return Response.json({ success: true, isMember, isNewUser: false, expireTime: user.expireTime }, { headers: corsHeaders });
      }

      // 卡密验证
      if (path === '/api/auth/verify-card-key' && method === 'POST') {
        const { cardKey } = body;
        const authHeader = request.headers.get('Authorization');
        const token = authHeader?.replace('Bearer ', '');
        if (!cardKey) {
          return Response.json({ success: false, errMsg: '请输入卡密' }, { headers: corsHeaders });
        }
        if (!token) {
          return Response.json({ success: false, errMsg: '请先登录' }, { headers: corsHeaders });
        }
        const decoded = verifyToken(token);
        if (!decoded) {
          return Response.json({ success: false, errMsg: '登录已过期' }, { headers: corsHeaders });
        }
        const cardRecord = cardKeys.get(cardKey.trim().toUpperCase());
        if (!cardRecord || cardRecord.status !== 'unused') {
          return Response.json({ success: false, errMsg: '卡密无效或已被使用' }, { headers: corsHeaders });
        }
        const now = new Date();
        cardRecord.status = 'used';
        cardRecord.usedBy = decoded.openid;
        cardRecord.usedTime = now;
        const user = users.get(decoded.openid);
        let expireTime;
        if (user) {
          const currentExpire = user.expireTime ? new Date(user.expireTime) : now;
          expireTime = currentExpire > now
            ? new Date(currentExpire.getTime() + 30 * 24 * 60 * 60 * 1000)
            : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          user.expireTime = expireTime;
        } else {
          expireTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        }
        return Response.json({ success: true, expireTime }, { headers: corsHeaders });
      }

      // ==================== AI API ====================

      // 生成分镜提示词（图片识别）
      if (path === '/api/ai/generate-prompt' && method === 'POST') {
        const { images, userPrompt, count } = body;
        const sceneCount = count || 4;
        const messageContent = [];
        if (images && images.length > 0) {
          images.forEach(base64 => {
            messageContent.push({ type: 'input_image', image_url: `data:image/jpeg;base64,${base64}` });
          });
        }
        const userMessage = `请根据以下图片生成一套${sceneCount}个分镜的视频画面提示词。

【分镜要求】
- 共${sceneCount}个分镜，构成一段完整的短视频叙事
- 每个分镜是一段完整的画面描述，用中文写，语言生动有画面感
- 每段描述80到120个字
- 适合竖屏短视频比例（9:16）

【输出格式】
1. 先输出创意说明（2-3句话）
2. 然后输出 ===ANALYSIS_END===
3. 然后输出 ===PROMPT_START===
4. 然后输出分镜提示词
5. 然后输出 ===PROMPT_END===

分镜提示词格式：
共${sceneCount}个分镜画面
分镜1：[详细画面描述]
...
分镜${sceneCount}：[详细画面描述]

${userPrompt ? `用户补充描述：${userPrompt}` : ''}`;
        messageContent.push({ type: 'input_text', text: userMessage });
        const fullContent = await callDoubaoAPI([{ role: 'user', content: messageContent }], env.DOUBAO_API_KEY, 'doubao-seed-2-0-pro-260215');
        const prompt = extractPromptFromAIResult(fullContent);
        return Response.json({ success: true, fullContent, prompt }, { headers: corsHeaders });
      }

      // 纯文字生成分镜提示词
      if (path === '/api/ai/generate-prompt-text' && method === 'POST') {
        const { userPrompt, count } = body;
        const sceneCount = count || 4;
        const userMessage = `请根据以下文字描述生成一套${sceneCount}个分镜的视频画面提示词。

用户描述：${userPrompt}

【输出格式】
1. 先输出创意说明（2-3句话）
2. 然后输出 ===ANALYSIS_END===
3. 然后输出 ===PROMPT_START===
4. 然后输出分镜提示词
5. 然后输出 ===PROMPT_END===

分镜提示词格式：
共${sceneCount}个分镜画面
分镜1：[详细画面描述]
...
分镜${sceneCount}：[详细画面描述]`;
        const fullContent = await callDoubaoAPI([{ role: 'user', content: [{ type: 'input_text', text: userMessage }] }], env.DOUBAO_API_KEY, 'doubao-seed-2-0-pro-260215');
        const prompt = extractPromptFromAIResult(fullContent);
        return Response.json({ success: true, fullContent, prompt }, { headers: corsHeaders });
      }

      // 生成图片
      if (path === '/api/ai/generate-image' && method === 'POST') {
        const { prompt, count, images } = body;
        const imageArray = [];
        if (images && images.length > 0) {
          images.forEach(base64 => { imageArray.push(`data:image/jpeg;base64,${base64}`); });
        }
        const hasImages = imageArray.length > 0;
        let cleanPrompt = String(prompt || '')
          .replace(/[【】]/g, '').replace(/[🚨⚠️💡✨🎯🔥❤️⚡🌟💫🎭🎬📸🎨]/g, '')
          .replace(/\n+/g, '，').replace(/，+/g, '，').replace(/^[\d]+[个、]/, '').trim();
        if (!cleanPrompt || cleanPrompt.length < 2) cleanPrompt = prompt || '请生成一张图片';
        const requestData = {
          model: 'doubao-seedream-5-0-260128',
          prompt: cleanPrompt,
          response_format: 'url',
          size: '2K',
          watermark: true
        };
        if (hasImages) requestData.image = imageArray.length === 1 ? imageArray[0] : imageArray;
        if (count && count >= 2) {
          requestData.sequential_image_generation = 'auto';
          requestData.sequential_image_generation_options = { max_images: count };
          requestData.stream = true;
        } else {
          requestData.sequential_image_generation = 'disabled';
          requestData.stream = false;
        }
        const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.SEEDREAM_API_KEY}`
          },
          body: JSON.stringify(requestData)
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || '图片生成失败');
        const resultImages = [];
        if (data.data && Array.isArray(data.data)) {
          data.data.forEach(item => { if (item.url) resultImages.push({ url: item.url }); });
        }
        if (resultImages.length > 0) {
          return Response.json({ success: true, images: resultImages }, { headers: corsHeaders });
        } else {
          throw new Error('未找到生成的图片');
        }
      }

      // 纯文字对话
      if (path === '/api/ai/chat' && method === 'POST') {
        const { messages, systemPrompt } = body;
        const inputArray = [];
        if (systemPrompt) inputArray.push({ role: 'system', content: systemPrompt });
        if (messages && Array.isArray(messages)) {
          messages.forEach(msg => {
            inputArray.push({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.text || '' });
          });
        }
        const reply = await callDoubaoAPI(inputArray, env.DOUBAO_API_KEY, 'doubao-seed-2-0-pro-260215');
        return Response.json({ success: true, reply }, { headers: corsHeaders });
      }

      // 404
      return Response.json({ error: 'API not found' }, { status: 404, headers: corsHeaders });

    } catch (err) {
      console.error('API错误:', err);
      return Response.json({ error: err.message || 'Internal server error' }, { status: 500, headers: corsHeaders });
    }
  }
};
