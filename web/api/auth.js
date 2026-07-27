/**
 * 认证API - Vercel Serverless Function
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');
const config = require('./config');

// JWT token生成
function generateToken(openid) {
  return jwt.sign({ openid }, config.jwtSecret, { expiresIn: '30d' });
}

// 验证token
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (err) {
    return null;
  }
}

// ==================== 登录 ====================
module.exports.login = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, errMsg: '账号和密码不能为空' });
  }

  try {
    const user = await db.findUserByUsername(username);
    if (!user) {
      return res.status(400).json({ success: false, errMsg: '账号不存在' });
    }

    if (user.password !== password) {
      return res.status(400).json({ success: false, errMsg: '密码错误' });
    }

    const now = new Date();
    const isMember = user.expireTime && new Date(user.expireTime) > now;

    return res.json({
      success: true,
      username: user.username,
      isMember,
      expireTime: user.expireTime,
      token: generateToken(user.openid)
    });
  } catch (err) {
    console.error('[登录] 异常:', err);
    return res.status(500).json({ success: false, errMsg: '登录失败' });
  }
};

// ==================== 注册 ====================
module.exports.register = async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, errMsg: '账号和密码不能为空' });
  }

  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ success: false, errMsg: '账号需2-20个字符' });
  }

  if (password.length < 6 || password.length > 20) {
    return res.status(400).json({ success: false, errMsg: '密码需6-20个字符' });
  }

  try {
    // 检查用户名是否已存在
    const existingUser = await db.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ success: false, errMsg: '该账号已被注册' });
    }

    const openid = 'web_' + uuidv4();
    const now = new Date();
    const expireTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000); // 新用户赠送1天会员

    const user = await db.createUser({
      openid,
      username,
      password,
      expireTime
    });

    return res.json({
      success: true,
      username: user.username,
      isMember: true,
      expireTime: user.expireTime,
      token: generateToken(openid)
    });
  } catch (err) {
    console.error('[注册] 异常:', err);
    return res.status(500).json({ success: false, errMsg: '注册失败' });
  }
};

// ==================== 检查会员状态 ====================
module.exports.checkMembership = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.json({ success: true, isMember: false, isNewUser: true });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.json({ success: true, isMember: false, isNewUser: true });
    }

    const user = await db.findUserByOpenid(decoded.openid);
    if (!user) {
      return res.json({ success: true, isMember: false, isNewUser: true });
    }

    const now = new Date();
    const isMember = user.expireTime && new Date(user.expireTime) > now;

    return res.json({
      success: true,
      isMember,
      isNewUser: false,
      expireTime: user.expireTime
    });
  } catch (err) {
    console.error('检查会员状态失败:', err);
    return res.status(500).json({ success: false, errMsg: err.message });
  }
};

// ==================== 卡密验证 ====================
module.exports.verifyCardKey = async (req, res) => {
  const { cardKey } = req.body;
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!cardKey || !cardKey.trim()) {
    return res.status(400).json({ success: false, errMsg: '请输入卡密' });
  }

  if (!token) {
    return res.status(400).json({ success: false, errMsg: '请先登录' });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, errMsg: '登录已过期' });
    }

    const cardRecord = await db.findCardKey(cardKey.trim().toUpperCase());
    if (!cardRecord || cardRecord.status !== 'unused') {
      return res.status(400).json({ success: false, errMsg: '卡密无效或已被使用' });
    }

    const now = new Date();

    // 更新卡密状态
    await db.updateCardKey(cardRecord.key, {
      status: 'used',
      usedBy: decoded.openid,
      usedTime: now
    });

    // 更新用户会员到期时间
    const user = await db.findUserByOpenid(decoded.openid);
    let expireTime;

    if (user) {
      const currentExpire = user.expireTime ? new Date(user.expireTime) : now;
      expireTime = currentExpire > now
        ? new Date(currentExpire.getTime() + 30 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      await db.updateUser(decoded.openid, { expireTime });
    } else {
      expireTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }

    return res.json({ success: true, expireTime });
  } catch (err) {
    console.error('卡密验证失败:', err);
    return res.status(500).json({ success: false, errMsg: '验证失败' });
  }
};
