import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// ================== الإعدادات ==================
const ROOM_ID = 22249609;        
const XO_BOT_ID = 82727814;      
const START_COMMAND = '!xo private ai 3';     

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let service = null;
let isBotReady = false;
let reconnecting = false;

let board = Array(9).fill(null); 
let mySign = 'X';     
let botSign = 'O';    
let isGameEnding = false; 
let isSending = false; 

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6]             
];

// ================== استراتيجية اللعب ==================
function getBestMove() {
  const availableMoves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) availableMoves.push(i);
  }
  
  if (availableMoves.length === 0) return undefined;

  for (let combo of WINNING_COMBOS) {
    let myCount = combo.filter(i => board[i] === mySign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (myCount === 2 && emptyCount === 1) return combo.find(i => board[i] === null);
  }

  for (let combo of WINNING_COMBOS) {
    let botCount = combo.filter(i => board[i] === botSign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (botCount === 2 && emptyCount === 1) return combo.find(i => board[i] === null);
  }

  for (let move of availableMoves) {
    board[move] = mySign;
    let winningLines = 0;
    for (let combo of WINNING_COMBOS) {
      let myCount = combo.filter(i => board[i] === mySign).length;
      let emptyCount = combo.filter(i => board[i] === null).length;
      if (myCount === 2 && emptyCount === 1) winningLines++;
    }
    board[move] = null;
    if (winningLines >= 2) return move;
  }

  if (board[4] === null && availableMoves.includes(4)) return 4;

  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== المعالجة الاحترافية لرسائل HTML ==================
function handleIncomingData(message) {
  // 1. معالجة الرسائل النصية العادية (مثل رسائل الخطأ)
  if (message.type === 'text/plain') {
    const plainText = (message.body || '').toLowerCase();
    if (plainText.includes('already been used') || plainText.includes('used')) {
      console.log('⚠️ المربع مستخدم مسبقاً، تحرير قفل الإرسال...');
      isSending = false;
    }
    return;
  }

  // التأكد من أن الرسالة هي واجهة اللعبة (HTML)
  if (message.type !== 'text/html') return;
  const html = message.body;

  // 2. رصد حالة اللعبة من كود الـ HTML
  if (html.includes('>Tie<') || html.includes('>Won<') || html.includes('>Lost<') || html.includes('game over')) {
    if (!isGameEnding) {
      isGameEnding = true; 
      isSending = false;
      console.log('🏁 انتهت اللعبة! جاري إرسال طلب جولة جديدة خلال ثوانٍ...');
      board = Array(9).fill(null);

      setTimeout(async () => {
        await sendGroupMessage(ROOM_ID, START_COMMAND);
        isGameEnding = false; 
      }, 4000);
    }
    return;
  }

  // 3. تحديد رمزي ورمز الخصم بدقة
  if (html.includes('(❌)')) {
    mySign = 'X'; botSign = 'O';
  } else if (html.includes('(⭕)')) {
    mySign = 'O'; botSign = 'X';
  }

  // 4. استخراج وبناء اللوحة من مربعات الـ HTML
  const blocks = html.split('xobot-mp-private__content__middle__position');
  if (blocks.length > 9) {
    for (let i = 0; i < 9; i++) {
      const block = blocks[i + 1];
      // فحص محتوى المربع بدقة
      if (block.includes('❌') || block.includes('--x')) {
        board[i] = 'X';
      } else if (block.includes('⭕') || block.includes('--o')) {
        board[i] = 'O';
      } else {
        board[i] = null; // المربع يحتوي على رقم (فارغ ومتاح للعب)
      }
    }
  }

  console.log(`✨ رمزي: [ ${mySign} ] | رمز الخصم: [ ${botSign} ]`);
  console.log("🔍 اللوحة المستخرجة:", board.map((v, i) => v || (i + 1)));

  // 5. اللعب فقط إذا كان دوري
  if (html.includes('Your Turn!') && !isGameEnding && !isSending) {
    const moveIndex = getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      const squareToPlay = (moveIndex + 1).toString();
      
      isSending = true; 
      const secureDelay = Math.floor(Math.random() * (1300 - 900 + 1)) + 900; 
      console.log(`⏳ دوري الآن! إرسال المربع [ ${squareToPlay} ] بعد تأخير [ ${secureDelay}ms ]`);
      
      setTimeout(async () => {
        await sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
      }, secureDelay); 
    }
  }
}

// ================== نظام الإرسال ==================
async function sendPrivateMessageWithRetry(targetId, text, attempt = 1) {
  if (!service || !isBotReady) {
    isSending = false;
    return;
  }

  try {
    await service.messaging.sendPrivateMessage(targetId, text);
    console.log(`✅ تم إرسال الرقم بنجاح: [ ${text} ]`);

    setTimeout(() => {
      isSending = false;
    }, 800);

  } catch (err) {
    console.log(`⚠️ فشل إرسال رقم [ ${text} ] محاولة [ ${attempt} ]: ${err.message}`);
    if (attempt < 3 && !isGameEnding) {
      setTimeout(() => {
        sendPrivateMessageWithRetry(targetId, text, attempt + 1);
      }, 500);
    } else {
      isSending = false;
    }
  }
}

async function sendGroupMessage(roomId, text) {
  if (!service || !isBotReady) return;
  try { await service.messaging.sendGroupMessage(roomId, text); } catch (err) {}
}

// ================== التشغيل والتنصت ==================
function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    const senderId = Number(message.sourceSubscriberId);
    if (!message.isGroup && senderId === XO_BOT_ID) {
      handleIncomingData(message);
    }
  });

  service.on('messageUpdate', async (message) => {
    const senderId = Number(message.sourceSubscriberId);
    if (!message.isGroup && senderId === XO_BOT_ID) {
      handleIncomingData(message);
    }
  });

  service.on('ready', async () => {
    console.log('🚀 البوت الذكي جاهز الآن! تم حل مشكلة القراءة بنجاح.');
    isBotReady = true;
    reconnecting = false;
    await sleep(2000);
    await sendGroupMessage(ROOM_ID, START_COMMAND);
  });

  const restart = () => {
    if (reconnecting) return;
    reconnecting = true; isBotReady = false; isSending = false;
    setTimeout(startBot, 5000);
  };

  service.on('error', restart);
  service.on('disconnected', restart);
  service.on('close', restart);

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
}

startBot();
