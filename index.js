import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// ================== الإعدادات الأساسية ==================
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

// 🛡️ منظومة الأقفال والمزامنة المستقرة
let botActionLock = false;       
let lastOpponentCount = -1;      
let hasSentRestart = false;      

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6]             
];

// ================== معالجة وتحديث استراتيجية اللعب الفائزة ==================

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

  // 1. الفوز الفوري
  for (let combo of WINNING_COMBOS) {
    let myCount = 0, emptyIdx = -1;
    for (let idx of combo) {
      if (board[idx] === mySign) myCount++;
      else if (board[idx] === null) emptyIdx = idx;
    }
    if (myCount === 2 && emptyIdx !== -1) {
      console.log(`🎯 فرصة فوز مؤكدة، اللعب في المربع [ ${emptyIdx + 1} ]`);
      return emptyIdx;
    }
  }

  // 2. الصد الفوري
  for (let combo of WINNING_COMBOS) {
    let botCount = 0, emptyIdx = -1;
    for (let idx of combo) {
      if (board[idx] === botSign) botCount++;
      else if (board[idx] === null) emptyIdx = idx;
    }
    if (botCount === 2 && emptyIdx !== -1) {
      console.log(`🛡️ صد هجوم فوز للخصم في المربع [ ${emptyIdx + 1} ]`);
      return emptyIdx;
    }
  }

  const myMovesCount = board.filter(v => v === mySign).length;
  const opponentMovesCount = board.filter(v => v === botSign).length;

  // --- تطبيق دليل الـ WikiHow التكتيكي ---
  
  // اللاعب الأول واللوحة فارغة
  if (myMovesCount === 0 && opponentMovesCount === 0) {
    console.log('📐 تكتيك أول: البدء في زاوية (المربع 1)');
    return 0;
  }

  // اللاعب الأول الحركة الثانية
  if (myMovesCount === 1 && opponentMovesCount === 1) {
    const firstCorner = board.indexOf(mySign);
    
    if (board[4] !== null) {
      console.log('♟️ الخصم احتل المركز، اللعب في الزاوية المقابلة تماماً لتأمين التعادل');
      if (firstCorner === 0) return 8;
      if (firstCorner === 2) return 6;
      if (firstCorner === 6) return 2;
      if (firstCorner === 8) return 0;
    } else {
      console.log('🔥 الخصم لم يلعب في المركز! بناء فخ مزدوج (Fork) للفوز الحتمي');
      if (firstCorner === 0) return board[2] === null ? 2 : 6;
      if (firstCorner === 2) return board[0] === null ? 0 : 8;
      if (firstCorner === 6) return board[0] === null ? 0 : 8;
      if (firstCorner === 8) return board[2] === null ? 2 : 6;
    }
  }

  // اللاعب الثاني
  if (myMovesCount === 0 && opponentMovesCount === 1) {
    const opponentMove = board.indexOf(botSign);
    const corners = [0, 2, 6, 8];
    
    if (corners.includes(opponentMove)) {
      console.log('🛡️ الخصم بدأ بزاوية، احتلال المركز فوراً (المربع 5)');
      return 4;
    }
    if (opponentMove === 4) {
      console.log('⚔️ الخصم بدأ بالمركز، احتلال زاوية استراتيجية (المربع 1)');
      return 0; 
    }
    if (board[4] === null) {
      return 4;
    }
  }

  // منظومة الـ Minimax للمراحل المتوسطة والمتقدمة
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
  if (message.type === 'text/plain') {
    const plainText = (message.body || '').toLowerCase();
    if (plainText.includes('already been used') || plainText.includes('used')) {
      console.log('⚠️ المربع مستخدم مسبقاً، إعادة فتح الأقفال للمحاولة...');
      botActionLock = false;
      lastOpponentCount = -1;
    }
    return;
  }

  if (message.type !== 'text/html') return;
  const html = message.body;
  const lowerHtml = html.toLowerCase(); 

  const isEndGame = lowerHtml.includes('rematch') || lowerHtml.includes('you won') || lowerHtml.includes('you lost') || lowerHtml.includes('tie');

  if (isEndGame) {
    if (!hasSentRestart) {
      hasSentRestart = true; 
      botActionLock = true; 
      
      const endDelay = Math.floor(Math.random() * (7000 - 5000 + 1)) + 5000;
      console.log(`🏁 انتهت اللعبة! سيتم إرسال الأمر الأساسي [ ${START_COMMAND} ] بعد تأخير [ ${endDelay}ms ]...`);
      
      board = Array(9).fill(null);
      lastOpponentCount = -1; 

      setTimeout(async () => {
        await sendGroupMessageWithRetry(ROOM_ID, START_COMMAND);
      }, endDelay);
    }
    return;
  }

  if (html.includes('Your Turn!') && !isEndGame) {
    hasSentRestart = false; 

    const blocks = html.split('xobot-mp-private__content__middle__position');
    if (blocks.length <= 9) return; 

    for (let i = 0; i < 9; i++) {
      const block = blocks[i + 1];
      if (block.includes('❌') || block.includes('--x')) board[i] = 'X';
      else if (block.includes('⭕') || block.includes('--o')) board[i] = 'O';
      else board[i] = null; 
    }

    if (html.includes('(❌)')) { mySign = 'X'; botSign = 'O'; } 
    else if (html.includes('(⭕)')) { mySign = 'O'; botSign = 'X'; }

    const currentOpponentCount = board.filter(v => v === botSign).length;

    if (currentOpponentCount > lastOpponentCount || lastOpponentCount === -1) {
      botActionLock = false;
    }

    if (botActionLock) return;

    triggerBotMove();
  }
}

// دالة وسيطة لتنفيذ الحركة وحسابها بدقة
function triggerBotMove() {
  const moveIndex = getBestMove();
  if (moveIndex !== undefined && moveIndex !== -1) {
    botActionLock = true; 

    const squareToPlay = (moveIndex + 1).toString();
    const secureDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000; 
    
    console.log(`✨ رمزي: [ ${mySign} ] | خصمي: [ ${botSign} ]`);
    console.log(`⏳ دوري المؤكد، إرسال المربع [ ${squareToPlay} ] بعد [ ${secureDelay}ms ]`);
    
    setTimeout(async () => {
      await sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
    }, secureDelay); 
  }
}

// ================== منظومة الإرسال الذكية المحصنة بالإنعاش التلقائي ==================

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
      // 🚨 [إنعاش ذاتي]: السيرفر علّق ورفض الحركة تماماً! نقوم بفك الأقفال وإعادة تشغيل الدور بعد 5 ثوانٍ لإنهاء التجمد
      console.log(`🚨 فك تعليق السيرفر تلقائياً: سيتم إعادة قراءة اللوحة ودفع الحركة مجدداً بعد 5 ثوانٍ...`);
      botActionLock = false;
      setTimeout(() => {
        if (!botActionLock) {
          triggerBotMove();
        }
      }, 5000);
    }
  }
}

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
      // 🚨 [إنعاش ذاتي]: السيرفر رفض إرسال أمر البدء/الـ rematch! نقوم بإعادة المحاولة بالكامل بعد 6 ثوانٍ لضمان استمرار دوران الألعاب
      console.log(`🚨 فك تعليق السيرفر في القناة: إعادة إرسال أمر جولة جديدة تلقائياً بعد 6 ثوانٍ...`);
      botActionLock = false;
      hasSentRestart = false;
      setTimeout(() => {
        if (!hasSentRestart) {
          hasSentRestart = true;
          botActionLock = true;
          sendGroupMessageWithRetry(roomId, text);
        }
      }, 6000);
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
    console.log('🚀 البوت جاهز ومحصن بالكامل بمنظومة الإنعاش الذاتي لفك تعليق السيرفر اللحظي.');
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
