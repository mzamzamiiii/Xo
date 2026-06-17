import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const client = new WOLF();

// 🔧 إعداداتك
const ROOM_ID = 215022;
const ALLOWED_USER_ID = 26491704;

let waitForImage = false;

// =========================
// 🔐 LOGIN
// =========================
(async () => {
  try {
    console.log('🚀 Logging in...');

    await client.login({
      email: process.env.U_MAIL_1,
      password: process.env.U_PASS_1
    });

    console.log('🔐 Logged in');

  } catch (err) {
    console.error('❌ Login error:', err);
  }
})();

// =========================
// 📤 READY → إرسال !ج
// =========================
client.on('ready', async () => {
  try {
    console.log('✅ Ready');

    await client.messaging.sendGroupMessage(
      ROOM_ID,
      '!ج'
    );

    console.log('📤 Sent !ج');

    waitForImage = true;

  } catch (err) {
    console.error('❌ Send error:', err);
  }
});

// =========================
// 🧠 تحليل الصورة (اسم فقط)
// =========================
async function analyzeImage(imageUrl) {
  try {
    const res = await fetch(
      "https://api-inference.huggingface.co/models/google/vit-base-patch16-224",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: imageUrl })
      }
    );

    const data = await res.json();

    return data?.[0]?.label || "Unknown";

  } catch (err) {
    return "Error";
  }
}

// =========================
// 📩 استقبال الرسائل
// =========================
client.on('message', async (msg) => {
  try {
    const senderId =
      msg?.sender?.id || msg?.sender || msg?.from || msg?.user;

    if (senderId !== ALLOWED_USER_ID) return;
    if (!waitForImage) return;

    const imageUrl =
      msg?.image?.url ||
      msg?.file?.url ||
      msg?.attachment?.url ||
      msg?.media?.url;

    if (!imageUrl) return;

    console.log('🖼️ Image received');

    const result = await analyzeImage(imageUrl);

    console.log('🤖 Result:', result);

    await client.messaging.sendGroupMessage(
      ROOM_ID,
      `🧠 ${result}`
    );

    waitForImage = false;

  } catch (err) {
    console.error('❌ Error:', err);
  }
});
