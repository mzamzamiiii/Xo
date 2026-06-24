import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let service = null;
let queue = [];
let isProcessing = false;
let reconnecting = false;
let isBotReady = false;
let lastQuestionTime = Date.now();

function getMessageText(message) {
  return (message.body || message.content || message.text || message.message || '').trim();
}

function getRoomId(message) {
  return Number(
    message.targetGroupId || message.groupId || message.channelId || message.recipientGroupId || message.group?.id || 0
  );
}

function extractWord(text) {
  const match = text.match(/\|-->\s*(.*?)\s*<--\|/);
  return match ? match[1].trim() : null;
}

function reverseText(text) {
  return [...text].reverse().join('');
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Send timeout')), ms))
  ]);
}

async function send(roomId, text) {
  try {
    if (!service || !isBotReady) return false;

    // تم ضبط المهلة على 400ms ثابتة بناءً على طلبك لزيادة السرعة وحصد النقاط
    const fixedDelay = 300;
    await sleep(fixedDelay);

    await withTimeout(
      service.messaging.sendGroupMessage(roomId, text),
      5000
    );

    console.log(`🚀 تم الإرسال السريع [ ${text} ] بعد ${fixedDelay}ms`);
    return true;

  } catch (err) {
    console.log('❌ فشل الإرسال السريع:', err.message);
    return false;
  }
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    console.log('--------------------');
    console.log('الكلمة المستلمة:', item.word);
    console.log('الإجابة المعكوسة:', item.answer);

    const success = await send(item.roomId, item.answer);
    await sleep(success ? 500 : 2000); // مهلة سريعة بين العناصر في الطابور
  }

  isProcessing = false;
}

async function restartBot(reason) {
  if (reconnecting) return;
  reconnecting = true;
  isBotReady = false;
  console.log('🔄 إعادة تشغيل البوت بسبب:', reason);

  try {
    if (service) {
      service.removeAllListeners();
      await service.logout().catch(() => {}); 
    }
  } catch {}

  await sleep(5000);
  startBot();
}

function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      const roomId = getRoomId(message);
      const text = getMessageText(message);

      if (!text || !message.isGroup || roomId !== ROOM_ID) return;

      if (senderId === TARGET_USER_ID) {
        lastQuestionTime = Date.now(); 
      }

      if (senderId !== TARGET_USER_ID) return;

      const word = extractWord(text);
      if (!word) return;

      const answer = reverseText(word);

      queue.push({ roomId, word, answer });
      console.log('📥 كلمة جديدة دخلت الطابور:', word);

      processQueue();

    } catch (err) {
      console.log('❌ Message Error:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('✅ الحساب جاهز ومستقر الآن للسرعة القصوى');
    isBotReady = true;
    reconnecting = false; 
    lastQuestionTime = Date.now();

    await sleep(2000);
    await send(ROOM_ID, '!عكس');
  });

  service.on('error', () => restartBot('service error'));
  service.on('disconnected', () => restartBot('disconnected'));
  service.on('close', () => restartBot('close'));

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(() => {
    reconnecting = false;
    restartBot('login failed');
  });
}

// مراقب التنشيط والتخطي التلقائي عند تعليق الأسئلة
setInterval(async () => {
  if (service && isBotReady && !isProcessing && queue.length === 0) {
    const timeSinceLastQuestion = Date.now() - lastQuestionTime;
    
    if (timeSinceLastQuestion > 15000) { 
      console.log('⚠️ اللعبة معلقة. جاري تنشيط الغرفة بتنزيل سؤال جديد...');
      lastQuestionTime = Date.now();
      await send(ROOM_ID, '!عكس');
    }
  }
}, 5000);

startBot();
