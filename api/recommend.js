// api/recommend.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const requestData = JSON.parse(req.body);
    const { city, district, food, purpose, budget, people, filters, userTime, mrtStation } = requestData;
    
    // 從 Vercel 環境變數獲取 API Key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
    
    // 嚴格鎖定您要求的模型版本
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // --- 100% 原始邏輯組合 ---
    let timeNote = filters.includes("營業中") ? `【嚴格要求：現在是 ${userTime}。目前打烊中絕對禁止推薦。】` : "";
    let hiddenNote = filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
    
    // 強化距離與站點權重要求 (不刪除原本的 transNote 結構)
    let transNote = "";
    if (mrtStation) {
      transNote = `
      【核心交通與距離限制強化要求】
      1. 中心點權重：必須以「${mrtStation}」站為絕對優先搜尋中心。
      2. 步行距離限制：推薦的餐廳地點必須位於「${mrtStation}」站步行 5-10 分鐘（約 500 公尺）內。
      3. 行政區界線彈性：若餐廳鄰近「${mrtStation}」，即使其地址行政區與「${district}」不同，亦應視為符合條件並優先推薦，必須以「鄰近車站」為最高準則，避免因行政區界線漏掉美食。
      4. 嚴格核對：必須核對餐廳真實地址，確保步行距離確實符合上述限制。
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
    const parsedData = JSON.parse(text);
    
    return res.status(200).json(parsedData);
  } catch (e) {
    return res.status(500).json({ error: "AI 正在忙碌中，或 API 金鑰設定有誤" });
  }
}
