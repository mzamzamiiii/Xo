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
let mySign = 'O';     
let botSign = 'X';    
let lastPlayedIndex = -1; 

// ================== خوارزمية الذكاء الاصطناعي لـ XO ==================
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6]             
];

function getBestMove() {
  const availableMoves = [];
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) availableMoves.push(i);
  }
  
  if (availableMoves.length === 0) return undefined;

  for (let combo of WINNING_COMBOS) {
    let myCount = combo.filter(i => board[i] === mySign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (myCount === 2 && emptyCount === 1) {
      const move = combo.find(i => board[i] === null);
      if (availableMoves.includes(move)) return move;
    }
  }

  for (let combo of WINNING_COMBOS) {
    let botCount = combo.filter(i => board[i] === botSign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (botCount === 2 && emptyCount === 1) {
      const move = combo.find(i => board[i] === null);
      if (availableMoves.includes(move)) return move;
    }
  }

  if (board[4] === null && availableMoves.includes(4)) return 4;

  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== معالجة وتحليل الـ HTML عند التحديث ==================
function handleIncomingData(message) {
  const text = (message.body || message.content || '').toLowerCase();

  // تصفير اللوحة عند رصد كلمة تحديث جديدة أو إعادة تحدي
  if (text.includes('game started') || text.includes('بدأت اللعبة') || text.includes('rematch') || text.includes('enter \'rematch\'')) {
    console.log('🔄 تم رصد بداية/تحديث مباراة جديدة، تصفير اللوحة...');
    board = Array(9).fill(null);
    lastPlayedIndex = -1;
  }

  // تحديد الرموز والإشارات الحالية من الـ HTML
  if (text.includes('(o)') || text.includes('⭕') || text.includes('filter: hue-rotate(210deg)')) { 
    mySign = 'O'; 
    botSign = 'X'; 
  } else if (text.includes('(x)') || text.includes('❌')) { 
    mySign = 'X'; 
    botSign = 'O'; 
  }

  // قراءة المربعات المحدثة برمجياً
  const positions = text.split('xobot-mp-private__content__middle__position');
  if (positions.length > 1) {
    for (let i = 0; i < 9; i++) {
      const block = positions[i + 1] || '';
      if (block.includes('--x') || block.includes('❌') || block.includes('position--x')) {
        board[i] = 'X';
      } else if (block.includes('--o') || block.includes('⭕') || block.includes('position--o')) {
        board[i] = 'O';
      } else {
        board[i] = null; 
      }
    }
  } else {
    for (let i = 0; i < 9; i++) {
      const squareNum = (i + 1).toString();
      const regex = new RegExp(`>${squareNum}<|"${squareNum}"|\\b${squareNum}\\b`);
      if (regex.test(text)) {
        board[i] = null;
      } else if (board[i] === null) {
        board[i] = botSign; 
      }
    }
  }

  console.log(`🤖 الرمز الحالي: [ ${mySign} ]`);
  console.log("🔍 اللوحة المحدثة لحظياً:", board.map((v, i) => v || (i + 1)));

  // فحص الدور
  const isMyTurn = text.includes('your turn') || text.includes('turn') || text.includes('xobot-mp-private__content__top__turn');

  if (isMyTurn) {
    const moveIndex = getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1 && moveIndex !== lastPlayedIndex) {
      const squareToPlay = (moveIndex + 1).toString();
      
      board[moveIndex] = mySign;
      lastPlayedIndex = moveIndex; 
      
      setTimeout(async () => {
        await sendPrivateMessage(XO_BOT_ID, squareToPlay);
      }, 1000); 
    }
  }

  // إعادة التشغيل عند الانتهاء
  if (text.includes('won') || text.includes('lost') || text.includes('draw') || text.includes('تعادل') || text.includes('you lost')) {
    console.log('🏁 انتهت الجولة الحالية! جاري بدء مباراة جديدة بعد 6 ثوانٍ...');
    board = Array(9).fill(null);
    lastPlayedIndex = -1;
    setTimeout(() => {
      sendGroupMessage(ROOM_ID, START_COMMAND);
    }, 6000);
  }
}

// ================== إرسال الرسائل ==================
async function sendGroupMessage(roomId, text) {
  if (!service || !isBotReady) return;
  try {
    await service.messaging.sendGroupMessage(roomId, text);
    console.log(`💬 تم إرسال أمر للغرفة: ${text}`);
  } catch (err) {
    console.log('❌ خطأ غرفة:', err.message);
  }
}

async function sendPrivateMessage(targetId, text) {
  if (!service || !isBotReady) return;
  try {
    await service.messaging.sendPrivateMessage(targetId, text);
    console.log(`🕹️ تم إرسال الحركة للمربع رقم: [ ${text} ]`);
  } catch (err) {
    console.log('❌ خطأ خاص:', err.message);
  }
}

// ================== تشغيل البوت والتنصت المزدوج ==================
function startBot() {
  service = new WOLF();

  // 1. التنصت على الرسائل الجديدة (لبداية اللعبة أو رسائل الخطأ)
  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      if (!message.isGroup && senderId === XO_BOT_ID) {
        const text = (message.body || message.content || '').toLowerCase();
        
        if (text.includes('already been used') || text.includes('used')) {
          console.log('⚠️ الخانة ممتلئة، إلغاء القفل مؤقتاً...');
          lastPlayedIndex = -1;
          return;
        }
        handleIncomingData(message);
      }
    } catch (err) {
      console.log('❌ خطأ Message:', err.message);
    }
  });

  // 2. 🔥 الحل السحري: التنصت على تحديث الرسائل اللحظي (Message Update)
  service.on('messageUpdate', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      if (!message.isGroup && senderId === XO_BOT_ID) {
        console.log('⚡ تم رصد تحديث للوحة اللعبة (Message Updated) من البوت!');
        handleIncomingData(message);
      }
    } catch (err) {
      console.log('❌ خطأ Update:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('🤖 البوت جاهز تماماً ويتنصت على التحديثات اللحظية الآن!');
    isBotReady = true;
    reconnecting = false;
    await sleep(2000);
    await sendGroupMessage(ROOM_ID, START_COMMAND);
  });

  const restart = () => {
    if (reconnecting) return;
    reconnecting = true;
    isBotReady = false;
    setTimeout(startBot, 5000);
  };

  service.on('error', restart);
  service.on('disconnected', restart);
  service.on('close', restart);

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
}

startBot();
