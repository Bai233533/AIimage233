/**
 * 数据库层 - 内存存储（开发/测试用）
 * 生产环境建议使用 Turso (SQLite) 或其他数据库
 */

// 内存存储
const users = new Map();
const cardKeys = new Map();

// 初始化一些测试卡密
const initTestCardKeys = () => {
  const testKeys = ['VIP-TEST-1234', 'VIP-DEMO-5678'];
  testKeys.forEach(key => {
    cardKeys.set(key, {
      key,
      status: 'unused',
      createTime: new Date()
    });
  });
};

// 启动时初始化
initTestCardKeys();

const db = {
  // ==================== 用户操作 ====================

  // 根据用户名查找用户
  async findUserByUsername(username) {
    for (const [_, user] of users) {
      if (user.username === username) {
        return user;
      }
    }
    return null;
  },

  // 根据openid查找用户
  async findUserByOpenid(openid) {
    return users.get(openid) || null;
  },

  // 创建用户
  async createUser(userData) {
    const { openid, username, password, expireTime } = userData;
    const user = {
      openid,
      username,
      password, // 生产环境应使用 bcrypt 加密
      expireTime,
      createTime: new Date(),
      freeUsed: 0
    };
    users.set(openid, user);
    return user;
  },

  // 更新用户
  async updateUser(openid, updates) {
    const user = users.get(openid);
    if (user) {
      Object.assign(user, updates);
      return user;
    }
    return null;
  },

  // ==================== 卡密操作 ====================

  // 查找卡密
  async findCardKey(key) {
    return cardKeys.get(key) || null;
  },

  // 更新卡密状态
  async updateCardKey(key, updates) {
    const cardKey = cardKeys.get(key);
    if (cardKey) {
      Object.assign(cardKey, updates);
      return cardKey;
    }
    return null;
  },

  // 批量创建卡密
  async createCardKeys(keys) {
    keys.forEach(key => {
      cardKeys.set(key, {
        key,
        status: 'unused',
        createTime: new Date()
      });
    });
    return keys;
  },

  // 列出所有卡密
  async listCardKeys(limit = 100) {
    const result = [];
    for (const [_, cardKey] of cardKeys) {
      result.push(cardKey);
      if (result.length >= limit) break;
    }
    return result.sort((a, b) => b.createTime - a.createTime);
  }
};

module.exports = db;
