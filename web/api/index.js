/**
 * API路由入口 - Vercel Serverless Function
 */

const auth = require('./auth');
const ai = require('./ai');

// 简单的路由匹配
module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { url, method } = req;

  try {
    // 解析请求体（POST请求）
    if (method === 'POST') {
      const chunks = [];
      for await (const chunk of req) {
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks).toString();
      req.body = JSON.parse(body || '{}');
    }

    // 路由匹配
    if (url === '/api/auth/login' && method === 'POST') {
      return await auth.login(req, res);
    }

    if (url === '/api/auth/register' && method === 'POST') {
      return await auth.register(req, res);
    }

    if (url === '/api/auth/check-membership' && method === 'POST') {
      return await auth.checkMembership(req, res);
    }

    if (url === '/api/auth/verify-card-key' && method === 'POST') {
      return await auth.verifyCardKey(req, res);
    }

    if (url === '/api/ai/generate-prompt' && method === 'POST') {
      return await ai.generatePrompt(req, res);
    }

    if (url === '/api/ai/generate-prompt-text' && method === 'POST') {
      return await ai.generatePromptFromText(req, res);
    }

    if (url === '/api/ai/generate-image' && method === 'POST') {
      return await ai.generateImage(req, res);
    }

    if (url === '/api/ai/chat' && method === 'POST') {
      return await ai.chat(req, res);
    }

    // 404
    return res.status(404).json({ error: 'API not found' });
  } catch (err) {
    console.error('API错误:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
