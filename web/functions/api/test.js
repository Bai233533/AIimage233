/**
 * GET /api/test
 */
export async function onRequestGet() {
  return new Response(JSON.stringify({ success: true, message: 'Functions is working!' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost(context) {
  const body = await context.request.json();
  return new Response(JSON.stringify({ success: true, data: body }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
