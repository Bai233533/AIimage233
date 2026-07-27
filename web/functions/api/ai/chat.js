/**
 * POST /api/ai/chat
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

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { messages, systemPrompt } = await request.json();
    const inputArray = [];
    if (systemPrompt) inputArray.push({ role: 'system', content: systemPrompt });
    if (messages && Array.isArray(messages)) {
      messages.forEach(msg => {
        inputArray.push({ role: msg.role === 'ai' ? 'assistant' : 'user', content: msg.text || '' });
      });
    }
    const reply = await callDoubaoAPI(inputArray, env.DOUBAO_API_KEY, 'doubao-seed-2-0-pro-260215');
    return json({ success: true, reply });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
