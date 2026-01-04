export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const body = JSON.parse(req.body);
  const API_KEY = process.env.GEMINI_API_KEY;
  // 使用目前穩定版本 1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

  let timeNote = body.filters.includes("營業中") ? `【嚴格要求：現在是 ${body.userTime}。目前打烊中絕對禁止推薦。】` : "";
  let hiddenNote = body.filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
  
  let transNote = "";
  if (body.mrtStation) {
    transNote = `
      【交通與距離嚴格要求】
      1. 中心點：必須以「${body.mrtStation}」站為中心進行搜尋。
      2. 距離限制：餐廳必須位於「${body.mrtStation}」步行 5-10 分鐘（約 500 公尺）內。
      3. 行政區彈性：若餐廳鄰近該站，即使地址行政區與「${body.district}」有出入，也請以「鄰近車站」為準進行推薦。
      4. 請核對地址，確保走路真的會到。
    `;
  }

  const prompt = `
    你是一位台灣美食專家。${timeNote} ${hiddenNote} ${transNote}
    請根據條件推薦 3-5 間真實存在的餐廳：
    地點：${body.city}${body.district} ${body.mrtStation ? '(鄰近'+body.mrtStation+')' : ''}
    種類：${body.food} | 目的：${body.purpose} | 預算：${body.budget} | 人數：${body.people}
    特殊篩選：${body.filters}

    請回傳純 JSON 格式（不要 Markdown 標籤）：[{ "name":"", "rating":"", "hours":"", "price":"", "signature":"", "review_summary":"", "reason":"", "address":"" }]
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
    res.status(500).json({ error: "AI 正在忙碌中，請稍後再試" });
  }
}
