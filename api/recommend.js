// api/recommend.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { city, district, food, purpose, budget, people, filters, userTime, mrtStation } = requestData;
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "Vercel 環境變數中找不到 GEMINI_API_KEY" });
    }

    // 您堅持使用的模型名稱
    const model = "gemini-2.5-flash"; 
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    let timeNote = filters.includes("營業中") ? `【嚴格要求：現在是 ${userTime}。目前打烊中絕對禁止推薦。】` : "";
    let hiddenNote = filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
    
    let transNote = "";
    if (mrtStation) {
      transNote = `
      【核心交通與距離限制強化要求】
      1. 中心點權重：必須以「${mrtStation}」站為絕對優先搜尋中心。
      2. 步行距離限制：推薦的餐廳地點必須位於「${mrtStation}」站步行 5-10 分鐘（約 500 公尺）內。
      3. 行政區界線彈性：若餐廳鄰近「${mrtStation}」，即使其地址行政區與「${district}」不同，亦應視為符合條件並優先推薦。必須以「鄰近車站」為最高準則。
      4. 嚴格核對：必須核對餐廳真實地址，確保步行距離確實符合 500 公尺內的要求。
      `;
    }

    const prompt = `
      你是一位台灣美食專家。${timeNote} ${hiddenNote} ${transNote}
      請根據以下條件推薦 3-5 間真實存在的餐廳：
      地點：${city}${district} ${mrtStation ? '(鄰近'+mrtStation+')' : ''}
      種類：${food}
      目的：${purpose}
      預算等級：${budget}
      特殊篩選：${filters}

      請回傳純 JSON 格式（不要包含任何 Markdown 符號）：[{ "name":"", "rating":"", "hours":"", "price":"", "signature":"", "review_summary":"", "reason":"", "address":"" }]
    `;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();

    if (result.error) {
      // 這裡會抓到 Google 報錯 (如模型不存在或 Key 錯)
      return res.status(500).json({ error: `Google API 錯誤: ${result.error.message}` });
    }

    if (!result.candidates || !result.candidates[0].content) {
      return res.status(500).json({ error: "AI 回傳格式異常，可能該模型暫時無法使用" });
    }

    let text = result.candidates[0].content.parts[0].text;
    // 強力清理 JSON 格式
    text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    
    // 如果 AI 回傳的字串開頭不是 [，試圖擷取 JSON 部分
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']') + 1;
    if (jsonStart !== -1 && jsonEnd !== -1) {
      text = text.substring(jsonStart, jsonEnd);
    }

    const parsedData = JSON.parse(text);
    return res.status(200).json(parsedData);

  } catch (e) {
    console.error("Vercel Function Error:", e);
    return res.status(500).json({ error: `發生內部錯誤: ${e.message}` });
  }
}
