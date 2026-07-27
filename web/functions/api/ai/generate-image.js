/**
 * POST /api/ai/generate-image
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

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { prompt, count, images } = await request.json();
    const imageArray = [];
    if (images && images.length > 0) {
      images.forEach(base64 => { imageArray.push(`data:image/jpeg;base64,${base64}`); });
    }
    const hasImages = imageArray.length > 0;
    let cleanPrompt = String(prompt || '')
      .replace(/[【】]/g, '').replace(/[🚨⚠️💡✨🎯🔥❤️⚡🌟💫🎭🎬📸🎨]/g, '')
      .replace(/\n+/g, '，').replace(/，+/g, '，').replace(/^[\d]+[个、]/, '').trim();
    if (!cleanPrompt || cleanPrompt.length < 2) cleanPrompt = prompt || '请生成一张图片';
    const requestData = {
      model: 'doubao-seedream-5-0-260128',
      prompt: cleanPrompt,
      response_format: 'url',
      size: '2K',
      watermark: true
    };
    if (hasImages) requestData.image = imageArray.length === 1 ? imageArray[0] : imageArray;
    if (count && count >= 2) {
      requestData.sequential_image_generation = 'auto';
      requestData.sequential_image_generation_options = { max_images: count };
      requestData.stream = true;
    } else {
      requestData.sequential_image_generation = 'disabled';
      requestData.stream = false;
    }
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${env.SEEDREAM_API_KEY}`
      },
      body: JSON.stringify(requestData)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || '图片生成失败');
    const resultImages = [];
    if (data.data && Array.isArray(data.data)) {
      data.data.forEach(item => { if (item.url) resultImages.push({ url: item.url }); });
    }
    if (resultImages.length > 0) {
      return json({ success: true, images: resultImages });
    } else {
      throw new Error('未找到生成的图片');
    }
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { headers: corsHeaders });
}
