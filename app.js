import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const client = new WOLF();

// ================== CONFIG ==================
const ROOM_ID = 215022;
const TARGET_USER_ID = 26491704;

let waitingForImage = false;

// ================== LOGIN ==================
client.on('ready', async () => {
  try {
    console.log('✅ Logged in');

    await client.messaging.sendGroupMessage(
      ROOM_ID,
      '!ج'
    );

    console.log('📤 Sent !ج');

    waitingForImage = true;

  } catch (err) {
    console.error('❌ ready error:', err);
  }
});

// ================== OPENAI VISION ==================
async function analyzeImage(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Give only 1 or 2 words describing the object in the image. No explanation."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`
                }
              }
            ]
          }
        ],
        max_tokens: 10
      })
    });

    const data = await res.json();

    let text = data?.choices?.[0]?.message?.content?.trim() || "Unknown";

    // تنظيف إلى كلمتين فقط
    text = text.split(" ").slice(0, 2).join(" ");

    return text;

  } catch (err) {
    console.log("AI ERROR:", err);
    return "Unknown";
  }
}

// ================== GET IMAGE ==================
function getImageUrl(message) {
  return (
    message.imageUrl ||
    message.url ||
    message?.attachment?.url ||
    (typeof message.body === "string" && message.body.startsWith("http")
      ? message.body
      : null)
  );
}

// ================== LISTENER ==================
client.on('groupMessage', async (message) => {
  try {

    if (
      message.sourceSubscriberId !== TARGET_USER_ID ||
      message.targetGroupId !== ROOM_ID
    ) return;

    if (!waitingForImage) return;

    const imageUrl = getImageUrl(message);

    if (!imageUrl) return;

    console.log("🖼️ Image received");

    const result = await analyzeImage(imageUrl);

    console.log("RESULT =", result);

    await client.messaging.sendGroupMessage(
      ROOM_ID,
      result
    );

    waitingForImage = false;

  } catch (err) {
    console.error('❌ error:', err);
  }
});

// ================== START ==================
(async () => {
  try {
    await client.login(
      process.env.U_MAIL_1,
      process.env.U_PASS_1
    );

    console.log('🚀 Bot started');
  } catch (err) {
    console.error('❌ login error:', err);
  }
})();
