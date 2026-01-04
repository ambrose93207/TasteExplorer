export default async function handler(req, res) {
  // 檢查是否為 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = JSON.parse(req.body);
  const API_KEY = process.env.GEMINI_API_KEY;
  
  // 請注意：目前穩定版為 gemini-1.5-flash (2.5目前並不存在)
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  const prompt = `
    你是一位台灣美食專家。
    地點：${body.city}${body.district}，鄰近${body.mrtStation || '該區'}。
    要求：推薦 3-5 間真實餐廳，步行 5-10 分鐘（500公尺）內。
    JSON格式回傳：[{ "name":"", "rating":"", "hours":"", "price":"", "signature":"", "review_summary":"", "reason":"", "address":"" }]
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();
    let text = result.candidates[0].content.parts[0].text;
    text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    
    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "AI 探索失敗，請檢查 API Key 設定" });
  }
}
