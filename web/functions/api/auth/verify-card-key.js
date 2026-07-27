/**
 * POST /api/auth/verify-card-key
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
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

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { cardKey } = await request.json();
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!cardKey) return json({ success: false, errMsg: '请输入卡密' });
    if (!token) return json({ success: false, errMsg: '请先登录' });

    const decoded = verifyToken(token);
    if (!decoded) return json({ success: false, errMsg: '登录已过期' });

    const { results } = await env.DB.prepare(
      'SELECT * FROM card_keys WHERE key = ? AND status = ?'
    ).bind(cardKey.trim().toUpperCase(), 'unused').all();

    if (results.length === 0) {
      return json({ success: false, errMsg: '卡密无效或已被使用' });
    }

    const cardRecord = results[0];
    const now = new Date();

    await env.DB.prepare(
      'UPDATE card_keys SET status = ?, used_by = ?, used_time = ? WHERE id = ?'
    ).bind('used', decoded.openid, now.toISOString(), cardRecord.id).run();

    const { results: userResults } = await env.DB.prepare(
      'SELECT * FROM users WHERE openid = ?'
    ).bind(decoded.openid).all();

    let expireTime;
    if (userResults.length > 0) {
      const user = userResults[0];
      const currentExpire = user.expire_time ? new Date(user.expire_time) : now;
      expireTime = currentExpire > now
        ? new Date(currentExpire.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare('UPDATE users SET expire_time = ? WHERE openid = ?').bind(expireTime, decoded.openid).run();
    } else {
      expireTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    return json({ success: true, expireTime });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
