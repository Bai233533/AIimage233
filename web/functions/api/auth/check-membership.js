/**
 * POST /api/auth/check-membership
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
    const authHeader = request.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return json({ success: true, isMember: false, isNewUser: true });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return json({ success: true, isMember: false, isNewUser: true });
    }

    const { results } = await env.DB.prepare('SELECT * FROM users WHERE openid = ?').bind(decoded.openid).all();

    if (results.length === 0) {
      return json({ success: true, isMember: false, isNewUser: true });
    }

    const user = results[0];
    const now = new Date();
    const isMember = user.expire_time && new Date(user.expire_time) > now;

    return json({
      success: true,
      isMember,
      isNewUser: false,
      expireTime: user.expire_time
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
