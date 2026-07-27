/**
 * POST /api/auth/login
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

    const { results } = await env.DB.prepare('SELECT * FROM users WHERE username = ?').bind(username).all();

    if (results.length === 0) {
      return json({ success: false, errMsg: '账号不存在' });
    }

    const user = results[0];
    if (user.password !== password) {
      return json({ success: false, errMsg: '密码错误' });
    }

    const now = new Date();
    const isMember = user.expire_time && new Date(user.expire_time) > now;

    return json({
      success: true,
      username: user.username,
      isMember,
      expireTime: user.expire_time,
      token: generateToken(user.openid)
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
