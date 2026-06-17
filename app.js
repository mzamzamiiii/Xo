import 'dotenv/config';
import wolfjs from 'wolf.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

const ROOM_ID = 215022;
const ALLOWED_USER_ID = 26491704;

let waiting = false;

async function analyzeImage(imageUrl) {
  // 🔥 AI بسيط (بديل جاهز)
  const res = await fetch("https://api-inference.huggingface.co/models/google/vit-base-patch16-224", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ inputs: imageUrl })
  });

  const data = await res.json();
  return data;
}

// 🔐 login
(async () => {
  await client.login({
    email: process.env.U_MAIL_1,
    password: process.env.U_PASS_1
  });
})();

// 🚀 ready
client.on('ready', async () => {
  console.log('✅ Ready');

  await client.messaging.sendGroupMessage(ROOM_ID, '!ج');

  waiting = true;
});

// 📩 استقبال الصور
client.on('message', async (msg) => {
  try {
    const senderId =
      msg.sender?.id || msg.sender || msg.from || msg.user;

    if (senderId !== ALLOWED_USER_ID) return;
    if (!waiting) return;

    const imageUrl =
      msg.image?.url ||
      msg.file?.url ||
      msg.attachment?.url ||
      msg.media?.url;

    if (!imageUrl) return;

    console.log('🖼️ Image received');

    const result = await analyzeImage(imageUrl);

    console.log('🤖 AI RESULT:', result);

    await client.messaging.sendGroupMessage(
      ROOM_ID,
      `🧠 تحليل الصورة: ${JSON.stringify(result[0]?.label || result)}`
    );

    waiting = false;

  } catch (err) {
    console.error(err);
  }
});
