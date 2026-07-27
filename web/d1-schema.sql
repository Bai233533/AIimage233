-- ============================================================
-- AI漫剧大师 - Cloudflare D1 数据库初始化脚本
-- 在 Cloudflare 控制台 → 存储与数据库 → D1 SQL 数据库
-- 选择 "AI-戏剧-数据库" → Console 标签 → 粘贴本脚本 → 执行
-- ============================================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  expire_time TEXT,
  free_used INTEGER DEFAULT 0,
  create_time TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_openid ON users(openid);

-- 卡密表
CREATE TABLE IF NOT EXISTS card_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'unused',
  used_by TEXT,
  used_time TEXT,
  create_time TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_keys_key ON card_keys(key);
CREATE INDEX IF NOT EXISTS idx_card_keys_status ON card_keys(status);

-- 生成历史表
CREATE TABLE IF NOT EXISTS generation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT NOT NULL,
  group_id INTEGER NOT NULL,
  prompt TEXT,
  images TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_history_openid ON generation_history(openid);
CREATE INDEX IF NOT EXISTS idx_history_group ON generation_history(group_id);

-- ============================================================
-- 初始化测试卡密（可选）
-- ============================================================
INSERT OR IGNORE INTO card_keys (key, status) VALUES
  ('VIP-TEST-1234', 'unused'),
  ('VIP-DEMO-5678', 'unused');

-- ============================================================
-- 验证脚本（执行后应看到 2 张表 + 测试卡密）
-- ============================================================
SELECT 'users 表:' AS info;
SELECT name FROM sqlite_master WHERE type='table' AND name='users';

SELECT 'card_keys 表:' AS info;
SELECT name FROM sqlite_master WHERE type='table' AND name='card_keys';

SELECT '测试卡密:' AS info;
SELECT key, status FROM card_keys WHERE key IN ('VIP-TEST-1234', 'VIP-DEMO-5678');