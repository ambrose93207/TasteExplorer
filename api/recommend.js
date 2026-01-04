// api/recommend.js
export default async function handler(req, res) {
  // 1. 確保只接受 POST
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // 2. 取得環境變數
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(200).json({ error: "【Vercel 錯誤】: 找不到 GEMINI_API_KEY 環境變數，請檢查 Vercel 後台設定。" });
  }

  try {
    const data = JSON.parse(req.body);
    const { city, district, food, purpose, budget, people, filters, userTime, mrtStation } = data;

    // 3. 模型設定（嚴格遵守 gemini-2.5-flash）
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    // 4. Prompt 100% 完整平移 + 強化
    let timeNote = filters.includes("營業中") ? `【嚴格要求：現在是 ${userTime}。目前打烊中絕對禁止推薦。】` : "";
    let hiddenNote = filters.includes("隱藏版") ? `【隱藏版要求：嚴格避開 Google 評論數過高（如 >2000 則）的名店。優先尋找巷弄私房店。】` : "";
    let transNote = mrtStation ? `【交通中心要求：地點必須位於「${mrtStation}」站附近 500 公尺內。若鄰近車站，行政區邊界可彈性。】` : "";

    const prompt = `你是一位台灣美食專家。${timeNote} ${hiddenNote} ${transNote}
      條件：地點${city}${district}，想吃${food}，目的${purpose}，預算${budget}，特殊篩選：${filters}。
      請回傳純 JSON 格式：[{ "name":"", "rating":"", "hours":"", "price":"", "signature":"", "review_summary":"", "reason":"", "address":"" }]`;

    // 5. 執行請求並設定 8 秒超時限制（防止 Vercel 免費版 10秒強制切斷）
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8500);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const result = await response.json();

    // 6. 如果 Google 報錯，直接傳回具體訊息
    if (result.error) {
      return res.status(200).json({ error: `【Google API 報錯】: ${result.error.message}` });
    }

    if (!result.candidates) {
      return res.status(200).json({ error: "【AI 錯誤】: 未產生任何結果，可能是模型名稱不支援。" });
    }

    let text = result.candidates[0].content.parts[0].text.replace(/```json/gi, "").replace(/```/gi, "").trim();
    res.status(200).json(JSON.parse(text));

  } catch (e) {
    // 這裡會抓到所有 Vercel 內部的報錯
    return res.status(200).json({ error: `【系統錯誤】: ${e.message}` });
  }
}
