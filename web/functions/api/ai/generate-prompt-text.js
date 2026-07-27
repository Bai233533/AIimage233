/**
 * POST /api/ai/generate-prompt-text
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

function extractPromptFromAIResult(fullContent) {
  const startMarker = '===PROMPT_START===';
  const endMarker = '===PROMPT_END===';
  const startIndex = fullContent.indexOf(startMarker);
  const endIndex = fullContent.indexOf(endMarker);
  if (startIndex !== -1 && endIndex !== -1) {
    return fullContent.substring(startIndex + startMarker.length, endIndex).trim();
  }
  return fullContent;
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
    const { userPrompt, count } = await request.json();
    const sceneCount = count || 4;
    const userMessage = `请根据以下文字描述生成一套${sceneCount}个分镜的视频画面提示词。

用户描述：${userPrompt}

【输出格式】
1. 先输出创意说明（2-3句话）
2. 然后输出 ===ANALYSIS_END===
3. 然后输出 ===PROMPT_START===
4. 然后输出分镜提示词
5. 然后输出 ===PROMPT_END===

分镜提示词格式：
共${sceneCount}个分镜画面
分镜1：[详细画面描述]
...
分镜${sceneCount}：[详细画面描述]`;
    const fullContent = await callDoubaoAPI([{ role: 'user', content: [{ type: 'input_text', text: userMessage }] }], env.DOUBAO_API_KEY, 'doubao-seed-2-0-pro-260215');
    const prompt = extractPromptFromAIResult(fullContent);
    return json({ success: true, fullContent, prompt });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
