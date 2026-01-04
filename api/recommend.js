export default async function handler(req, res) {
  // 僅允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 解析前端傳來的資料，架構與原本 Code.gs 的 getAiRecommendation(requestData) 完全一致
    const requestData = JSON.parse(req.body);
    const { city, district, food, purpose, budget, people, filters, userTime, mrtStation } = requestData;

    // 從 Vercel 環境變數獲取 API KEY
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    // 嚴格使用您要求的模型版本：gemini-2.5-flash
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    // --- 提示詞邏輯：100% 完整保留並依要求強化 ---
    let timeNote = filters.includes("營業中") ? `【嚴格要求：現在是 ${userTime}。目前打烊中絕對禁止推薦。】` : "";
    let hiddenNote = filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
    
    // 強化交通要求：加入距離限制、站點優先、跨區彈性
    let transNote = "";
    if (mrtStation) {
      transNote = `
      【核心交通與距離嚴格要求】
      1. 中心點權重：必須以「${mrtStation}」站為最高優先搜尋中心。
      2. 距離限制：推薦的餐廳地點必須位於「${mrtStation}」站步行 5-10 分鐘（約 500 公尺）內。
      3. 行政區跨區彈性：由於車站可能位於行政區交界，若餐廳鄰近「${mrtStation}」，即使其地址所屬行政區與「${district}」不同，亦應視為符合條件並優先推薦，必須以「鄰近車站」為最高準則，避免因行政區界線漏掉美食。
      4. 真實地址核對：必須核對餐廳的真實地址，確保其與車站出口的步行距離符合上述要求。
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

    // 執行請求
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();

    // 錯誤處理邏輯 (與 GAS 相同)
    if (result.error) {
      return res.status(500).json({ error: result.error.message });
    }

    // 內容解析與清洗
    let text = result.candidates[0].content.parts[0].text;
    text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    const parsedData = JSON.parse(text);

    // 回傳結果
    return res.status(200).json(parsedData);

  } catch (e) {
    console.error("API Error:", e);
    return res.status(500).json({ error: "AI 正在忙碌中" });
  }
}
