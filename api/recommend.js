export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const requestData = JSON.parse(req.body);
    const { city, district, food, purpose, budget, people, filters, userTime, mrtStation } = requestData;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // 嚴格遵守要求：模型名稱 gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    let timeNote = filters.includes("營業中") ? `【嚴格要求：現在是 ${userTime}。目前打烊中絕對禁止推薦。】` : "";
    let hiddenNote = filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
    
    // 強化距離限制與站點權重邏輯
    let transNote = "";
    if (mrtStation) {
      transNote = `
      【核心交通要求：地理位置優先】
      1. 中心點權重：必須以「${mrtStation}」站為搜尋中心。
      2. 距離限制：推薦的餐廳必須位於「${mrtStation}」步行 5-10 分鐘（約 500 公尺）內。
      3. 行政區彈性：由於車站可能位於行政區交界，應以「鄰近車站」為最高準則，若餐廳鄰近「${mrtStation}」，即使地址行政區與「${district}」不同，亦優先推薦。
      4. 嚴格要求：地址必須位於該車站周邊 500 公尺內。
      `;
    } else {
      transNote = mrtStation ? `【交通要求：地點必須位於「${mrtStation}」站附近。】` : "";
    }

    const prompt = `
    你是一位台灣美食專家。${timeNote} ${hiddenNote} ${transNote}
    請根據以下條件推薦真實存在的餐廳：
    地點：${city}${district} ${mrtStation ? '(鄰近'+mrtStation+')' : ''}
    種類：${food}
    目的：${purpose}
    預算等級：${budget}
    特殊篩選：${filters}

    請回傳 JSON 格式：[{ "name":"", "rating":"", "hours":"", "price":"", "signature":"", "review_summary":"", "reason":"", "address":"" }]
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();
    if (result.error) return res.status(500).json({ error: result.error.message });
    
    let text = result.candidates[0].content.parts[0].text;
    text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    res.status(200).json(JSON.parse(text));
  } catch (e) {
    res.status(500).json({ error: "AI 正在忙碌中，請檢查 Vercel 後台 Logs 或 API Key 設定" });
  }
}
