export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  const data = JSON.parse(req.body);
  const API_KEY = process.env.GEMINI_API_KEY;
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  const prompt = `
    你是一位台灣美食專家。
    【核心交通與距離要求】
    1. 中心點：必須以「${data.mrtStation || '該區域'}」為絕對搜尋中心。
    2. 步行距離：必須位於該站點出口「步行 5-10 分鐘（約 500 公尺）內」。
    3. 行政區彈性：若餐廳鄰近站點，地址行政區跨越了「${data.district}」也請優先推薦。
    4. 嚴格核對真實地址。
    
    條件：${data.city}${data.district}，想吃${data.food}，目的${data.purpose}，預算${data.budget}，篩選條件：${data.filters}
    請回傳純 JSON：[{ "name":"", "rating":"", "hours":"", "price":"", "signature":"", "review_summary":"", "reason":"", "address":"" }]
  `;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    const result = await response.json();
    let text = result.candidates[0].content.parts[0].text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "AI 忙碌中" });
  }
}
