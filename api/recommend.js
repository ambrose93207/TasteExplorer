export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // 1. 取得並解析資料
  let requestData;
  try {
    requestData = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: "請求格式錯誤" });
  }

  const { city, district, food, purpose, budget, people, filters, userTime, mrtStation } = requestData;
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

  // 2. 設定模型 (請確認此模型名稱是否存在，通常建議使用 gemini-2.0-flash)
  const modelName = "gemini-2.5-flash"; // 若官方確實開放 2.5，請改回 "gemini-2.5-flash"
  const url = `https://generativelanguage.googleapis.com/v1/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

  // 3. 組合 Prompt (100% 還原原本邏輯並強化距離)
  let timeNote = filters.includes("營業中") ? `【嚴格要求：現在是 ${userTime}。目前打烊中絕對禁止推薦。】` : "";
  let hiddenNote = filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
  
  let transNote = "";
  if (mrtStation) {
    transNote = `
      【核心交通要求：地理位置優先】
      1. 必須以「${mrtStation}」站為搜尋中心。
      2. 距離限制：推薦的餐廳必須位於「${mrtStation}」步行 5-10 分鐘（約 500 公尺）內。
      3. 行政區彈性：由於車站常位於行政區交界，若餐廳鄰近「${mrtStation}」，即使地址行政區與「${district}」不同，亦請優先推薦，以「鄰近車站」為最高準則。
      4. 請核對地址，確保其確實位於該車站出口附近。
    `;
  }

  const prompt = `
    你是一位台灣美食專家。${timeNote} ${hiddenNote} ${transNote}
    請根據條件推薦 3-5 間真實餐廳：
    地點：${city}${district} ${mrtStation ? '(鄰近'+mrtStation+')' : ''}
    種類：${food}
    目的：${purpose}
    預算等級：${budget}
    特殊篩選：${filters}

    請回傳 JSON 格式：[{ "name":"", "rating":"", "hours":"", "price":"", "signature":"", "review_summary":"", "reason":"", "address":"" }]
  `;

  // 4. 發送 API 請求
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const result = await response.json();

    // 如果 API 本身報錯 (例如 Key 錯或模型錯)
    if (result.error) {
      console.error("Gemini API Error:", result.error.message);
      return res.status(500).json({ error: `API 報錯: ${result.error.message}` });
    }

    // 檢查回傳內容結構
    if (!result.candidates || !result.candidates[0].content) {
      console.error("Unexpected API Response:", JSON.stringify(result));
      return res.status(500).json({ error: "AI 未回傳有效結果，請檢查 API Key 或模型權限" });
    }

    let text = result.candidates[0].content.parts[0].text;
    text = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    
    const parsedData = JSON.parse(text);
    return res.status(200).json(parsedData);

  } catch (e) {
    console.error("Vercel Runtime Error:", e.message);
    return res.status(500).json({ error: "AI 正在忙碌中 (請確認 Vercel 後台 Logs)" });
  }
}
