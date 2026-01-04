export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const requestData = JSON.parse(req.body);
  const { city, district, food, purpose, budget, people, filters, userTime, mrtStation } = requestData;
  
  // Vercel 環境變數獲取 API Key
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
  // 使用 Gemini 1.5 Flash (目前穩定版)
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

  let timeNote = filters.includes("營業中") ? `【嚴格要求：現在是 ${userTime}。目前打烊中絕對禁止推薦。】` : "";
  let hiddenNote = filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
  
  // 強化交通與距離限制要求
  let transNote = "";
  if (mrtStation) {
    transNote = `
      【核心交通與距離限制要求】
      1. 必須以「${mrtStation}」站為絕對搜尋中心。
      2. 距離限制：推薦的餐廳必須位於「${mrtStation}」步行 5-10 分鐘（約 500 公尺）內。
      3. 行政區彈性：某些車站位於行政區交界，應以「鄰近車站」為最高準則，若餐廳鄰近該站，即使地址行政區與「${district}」有些微落差，亦必須推薦。
      4. 請務必核對真實地址，確保步行距離準確。
    `;
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();
    if (result.error) return res.status(500).json({ error: result.error.message });
    
    let text = result.candidates[0].content.parts[0].text;
    text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const parsedData = JSON.parse(text);
    
    return res.status(200).json(parsedData);
  } catch (e) {
    return res.status(500).json({ error: "AI 正在忙碌中" });
  }
}
