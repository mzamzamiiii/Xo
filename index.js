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

// 🛡️ نظام الأقفال والمزامنة الذكي
let botActionLock = false;       // يمنع جدولة أكثر من حركة في نفس الدور
let lastOpponentCount = -1;      // يتتبع حركات الخصم بدقة
let hasSentRestart = false;      // يمنع تكرار إرسال أمر البدء عند نهاية الجولة

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6]             
];

// ================== استراتيجية اللعب (Minimax - دون أي تعديل) ==================
function checkWinner(tempBoard, player) {
  for (let combo of WINNING_COMBOS) {
    if (tempBoard[combo[0]] === player &&
        tempBoard[combo[1]] === player &&
        tempBoard[combo[2]] === player) {
      return true;
    }
  }
  return false;
}

function minimax(tempBoard, depth, isMaximizing) {
  if (checkWinner(tempBoard, mySign)) return 10 - depth;
  if (checkWinner(tempBoard, botSign)) return depth - 10;
  if (!tempBoard.includes(null)) return 0;

  if (isMaximizing) {
    let bestScore = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = mySign;
        let score = minimax(tempBoard, depth + 1, false);
        tempBoard[i] = null;
        bestScore = Math.max(score, bestScore);
      }
    }
    return bestScore;
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < 9; i++) {
      if (tempBoard[i] === null) {
        tempBoard[i] = botSign;
        let score = minimax(tempBoard, depth + 1, true);
        tempBoard[i] = null;
        bestScore = Math.min(score, bestScore);
      }
    }
    return bestScore;
  }
}

function getBestMove() {
  const availableMoves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) availableMoves.push(i);
  }
  
  if (availableMoves.length === 0) return undefined;
  if (availableMoves.length === 9) return 4; 
  if (availableMoves.length === 8) {
    if (board[4] === null) return 4; 
    return 0; 
  }

  let bestScore = -Infinity;
  let move = -1;

  for (let i = 0; i < availableMoves.length; i++) {
    let idx = availableMoves[i];
    board[idx] = mySign; 
    let score = minimax(board, 0, false); 
    board[idx] = null; 

    if (score > bestScore) {
      bestScore = score;
      move = idx;
    }
  }
  return move;
}

// ================== معالجة البيانات والتحكم بالجولات ==================
function handleIncomingData(message) {
  // 1. معالجة التحذيرات النصية وإعادة فتح الأقفال عند الحاجة
  if (message.type === 'text/plain') {
    const plainText = (message.body || '').toLowerCase();
    if (plainText.includes('already been used') || plainText.includes('used')) {
      console.log('⚠️ المربع مستخدم مسبقاً، إعادة فتح الأقفال للمحاولة...');
      botActionLock = false;
      lastOpponentCount = -1;
    }
    return;
  }

  // 2. التحقق من أن الرسالة القادمة هي لوحة اللعبة (HTML)
  if (message.type !== 'text/html') return;
  const html = message.body;
  const lowerHtml = html.toLowerCase(); 

  // 3. رصد نهاية اللعبة [تطبيق فكرتك: إرسال الأمر الأساسي في القناة بتأخير أكبر]
  const isEndGame = lowerHtml.includes('rematch') || lowerHtml.includes('you won') || lowerHtml.includes('you lost') || lowerHtml.includes('tie');

  if (isEndGame) {
    if (!hasSentRestart) {
      hasSentRestart = true; 
      botActionLock = true; // قفل حركات اللعب فوراً لمنع أي تداخل
      
      // حساب تأخير بشري عشوائي مريح بين 5 إلى 7 ثوانٍ لضمان إغلاق الجلسة القديمة في السيرفر
      const endDelay = Math.floor(Math.random() * (7000 - 5000 + 1)) + 5000;
      console.log(`🏁 انتهت اللعبة! سيتم إرسال الأمر الأساسي [ ${START_COMMAND} ] في القناة بعد تأخير بشري [ ${endDelay}ms ]...`);
      
      board = Array(9).fill(null);
      lastOpponentCount = -1; 

      setTimeout(async () => {
        await sendGroupMessageWithRetry(ROOM_ID, START_COMMAND);
      }, endDelay);
    }
    return;
  }

  // 4. معالجة دور اللعب الفعلي داخل المباراة
  if (html.includes('Your Turn!') && !isEndGame) {
    // جولة جديدة بدأت بالفعل، نُصفر قفل إعادة التشغيل
    hasSentRestart = false; 

    // تفكيك محتوى اللوحة لاستخراج حركات اللاعبين
    const blocks = html.split('xobot-mp-private__content__middle__position');
    if (blocks.length <= 9) return; 

    for (let i = 0; i < 9; i++) {
      const block = blocks[i + 1];
      if (block.includes('❌') || block.includes('--x')) board[i] = 'X';
      else if (block.includes('⭕') || block.includes('--o')) board[i] = 'O';
      else board[i] = null; 
    }

    // تحديد الرموز ديناميكياً
    if (html.includes('(❌)')) { mySign = 'X'; botSign = 'O'; } 
    else if (html.includes('(⭕)')) { mySign = 'O'; botSign = 'X'; }

    // حساب عدد حركات الخصم الحالية على اللوحة
    const currentOpponentCount = board.filter(v => v === botSign).length;

    // فتح القفل عند بداية جيم جديد أو عند قيام الخصم بحركته كاملة
    if (currentOpponentCount > lastOpponentCount || lastOpponentCount === -1) {
      botActionLock = false;
    }

    // إذا كان القفل نشطاً (تمت جدولة حركة مسبقاً)، نتجاهل التحديث لمنع أخطاء الإرسال المكرر
    if (botActionLock) return;

    const moveIndex = getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      botActionLock = true; 
      lastOpponentCount = currentOpponentCount; 

      const squareToPlay = (moveIndex + 1).toString();
      const secureDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000; 
      
      console.log(`✨ رمزي: [ ${mySign} ] | خصمي: [ ${botSign} ]`);
      console.log(`⏳ دوري المؤكد، إرسال المربع [ ${squareToPlay} ] بعد [ ${secureDelay}ms ]`);
      
      setTimeout(async () => {
        await sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
      }, secureDelay); 
    }
  }
}

// ================== منظومة الإرسال المحصنة والآمنة ==================

// إرسال الحركات في الخاص مع إعادة المحاولة عند الفشل
async function sendPrivateMessageWithRetry(targetId, text, attempt = 1) {
  if (!service || !isBotReady) return;

  try {
    const response = await service.messaging.sendPrivateMessage(targetId, text);
    if (!response || (response.code && response.code !== 200) || response.isSuccess === false) {
      const errCode = response ? response.code : 'Unknown';
      throw new Error(`كود الرفض: ${errCode}`);
    }
    console.log(`✅ تم إرسال الحركة بنجاح وتأكيدها: [ ${text} ]`);
  } catch (err) {
    console.log(`⚠️ فشل تأكيد إرسال الحركة [ ${text} ] محاولة [ ${attempt} ]: ${err.message}`);
    if (attempt < 3) {
      setTimeout(() => {
        sendPrivateMessageWithRetry(targetId, text, attempt + 1);
      }, 2000);
    } else {
      botActionLock = false;
    }
  }
}

// [جديد] إرسال الأمر الأساسي في القناة مع إعادة المحاولة التلقائية لضمان تخطي كود 400
async function sendGroupMessageWithRetry(roomId, text, attempt = 1) {
  if (!service || !isBotReady) return;

  try {
    const response = await service.messaging.sendGroupMessage(roomId, text);
    if (!response || (response.code && response.code !== 200) || response.isSuccess === false) {
      const errCode = response ? response.code : 'Unknown';
      throw new Error(`كود الرفض: ${errCode}`);
    }
    console.log(`✅ تم إرسال أمر بدء اللعبة في القناة بنجاح: [ ${text} ]`);
  } catch (err) {
    console.log(`⚠️ فشل إرسال أمر المجموعة [ ${text} ] محاولة [ ${attempt} ]: ${err.message}`);
    if (attempt < 3) {
      setTimeout(() => {
        sendGroupMessageWithRetry(roomId, text, attempt + 1);
      }, 2500);
    } else {
      // إعادة تصفير الأقفال بالكامل في حال الفشل النهائي لإعطاء فرصة للمحاولات القادمة
      botActionLock = false;
      hasSentRestart = false;
    }
  }
}

// ================== التشغيل والتنصت المستمر ==================
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
    console.log('🚀 البوت جاهز ومحصن بالكامل! اعتماد أمر القناة والتأخير البشري الموسع.');
    isBotReady = true;
    reconnecting = false;
    await sleep(2000);
    await sendGroupMessageWithRetry(ROOM_ID, START_COMMAND);
  });

  const restart = () => {
    if (reconnecting) return;
    reconnecting = true; isBotReady = false; 
    setTimeout(startBot, 5000);
  };

  service.on('error', restart);
  service.on('disconnected', restart);
  service.on('close', restart);

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
}

startBot();
