/**
 * POST /api/auth/register
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function generateToken(openid) {
  return btoa(openid + ':' + Date.now());
}

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return json({ success: false, errMsg: '账号和密码不能为空' });
    }
    if (username.length < 2 || username.length > 20) {
      return json({ success: false, errMsg: '账号需2-20个字符' });
    }
    if (password.length < 6 || password.length > 20) {
      return json({ success: false, errMsg: '密码需6-20个字符' });
    }

    const { results } = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).all();

    if (results.length > 0) {
      return json({ success: false, errMsg: '该账号已被注册' });
    }

    const openid = 'web_' + crypto.randomUUID();
    const now = new Date();
    const expireTime = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString();

    await env.DB.prepare(
      'INSERT INTO users (openid, username, password, expire_time, free_used) VALUES (?, ?, ?, ?, 0)'
    ).bind(openid, username, password, expireTime).run();

    return json({
      success: true,
      username,
      isMember: true,
      expireTime,
      token: generateToken(openid)
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
