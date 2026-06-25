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

// 💡 بديل القفل الزمني: حفظ آخر حالة للوحة لتجنب التكرار وللرد بسرعة البرق
let lastPlayedBoardString = ""; 

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6]             
];

// ================== استراتيجية اللعب (Minimax) ==================

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

// ================== المعالجة الاحترافية ==================
function handleIncomingData(message) {
  // 1. معالجة الرسائل النصية
  if (message.type === 'text/plain') {
    const plainText = (message.body || '').toLowerCase();
    if (plainText.includes('already been used') || plainText.includes('used')) {
      console.log('⚠️ المربع مستخدم مسبقاً، تحرير اللوحة للمحاولة مرة أخرى...');
      lastPlayedBoardString = ""; 
    }
    return;
  }

  if (message.type !== 'text/html') return;
  const html = message.body;
  const lowerHtml = html.toLowerCase(); 

  // 2. رصد حالة اللعبة وإعادة التشغيل بتأخير بشري مناسب
  if (lowerHtml.includes('rematch') || lowerHtml.includes('you won') || lowerHtml.includes('you lost') || lowerHtml.includes('tie')) {
    if (!isGameEnding) {
      isGameEnding = true; 
      console.log('🏁 انتهت اللعبة! جاري بدء جولة جديدة (rematch) بعد 3 ثوانٍ...');
      board = Array(9).fill(null);
      lastPlayedBoardString = ""; 

      setTimeout(async () => {
        await sendPrivateMessageWithRetry(XO_BOT_ID, "rematch");
        isGameEnding = false; 
      }, 3000);
    }
    return;
  }

  // 3. تحديد رمزي ورمز الخصم بدقة
  if (html.includes('(❌)')) {
    mySign = 'X'; botSign = 'O';
  } else if (html.includes('(⭕)')) {
    mySign = 'O'; botSign = 'X';
  }

  // 4. استخراج وبناء اللوحة
  const blocks = html.split('xobot-mp-private__content__middle__position');
  if (blocks.length > 9) {
    for (let i = 0; i < 9; i++) {
      const block = blocks[i + 1];
      if (block.includes('❌') || block.includes('--x')) {
        board[i] = 'X';
      } else if (block.includes('⭕') || block.includes('--o')) {
        board[i] = 'O';
      } else {
        board[i] = null; 
      }
    }
  }

  console.log(`✨ رمزي: [ ${mySign} ] | رمز الخصم: [ ${botSign} ]`);
  console.log("🔍 اللوحة المستخرجة:", board.map((v, i) => v || (i + 1)));

  // 5. اللعب بالاعتماد على التحديث الفعلي للوحة
  if (html.includes('Your Turn!') && !isGameEnding) {
    const currentBoardString = board.join(',');

    if (currentBoardString === lastPlayedBoardString) {
      return; 
    }

    const moveIndex = getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      lastPlayedBoardString = currentBoardString; 
      const squareToPlay = (moveIndex + 1).toString();
      
      const secureDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000; 
      console.log(`⏳ دوري الآن! إرسال المربع [ ${squareToPlay} ] بعد تأخير بشري [ ${secureDelay}ms ]`);
      
      setTimeout(async () => {
        await sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
      }, secureDelay); 
    }
  }
}

// ================== نظام الإرسال المحسن مع التحقق الدقيق ==================
async function sendPrivateMessageWithRetry(targetId, text, attempt = 1) {
  if (!service || !isBotReady) return;

  try {
    const response = await service.messaging.sendPrivateMessage(targetId, text);
    
    // التحقق الفعلي من كود نجاح السيرفر (200 أو استجابة إيجابية)
    if (!response || (response.code && response.code !== 200) || response.isSuccess === false) {
      const errCode = response ? response.code : 'Unknown';
      throw new Error(`رفض السيرفر الإرسال بكود: ${errCode}`);
    }

    console.log(`✅ تم إرسال الرقم بنجاح ووصل للتطبيق: [ ${text} ]`);
  } catch (err) {
    console.log(`⚠️ فشل تأكيد إرسال [ ${text} ] محاولة [ ${attempt} ]: ${err.message}`);
    if (attempt < 3 && !isGameEnding) {
      // انتظار ثانيتين قبل إعادة المحاولة لمنح السيرفر فرصة للاستجابة
      setTimeout(() => {
        sendPrivateMessageWithRetry(targetId, text, attempt + 1);
      }, 2000);
    } else {
      // في حال الفشل النهائي يتم تصفير اللوحة للمحاولة لاحقاً وعدم تعليق البوت
      lastPlayedBoardString = "";
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
    console.log('🚀 البوت جاهز الآن! (تم تفعيل جدار التحقق الذكي من إرسال الرسائل)');
    isBotReady = true;
    reconnecting = false;
    await sleep(2000);
    await sendGroupMessage(ROOM_ID, START_COMMAND);
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
