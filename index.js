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
let isMyTurn = false;
let isProcessingMove = false; 

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

  // 1. هل يمكنني الفوز في هذه الخطوة؟
  for (let combo of WINNING_COMBOS) {
    let myCount = combo.filter(i => board[i] === mySign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (myCount === 2 && emptyCount === 1) {
      const move = combo.find(i => board[i] === null);
      if (availableMoves.includes(move)) return move;
    }
  }

  // 2. منع الخصم من الفوز
  for (let combo of WINNING_COMBOS) {
    let botCount = combo.filter(i => board[i] === botSign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (botCount === 2 && emptyCount === 1) {
      const move = combo.find(i => board[i] === null);
      if (availableMoves.includes(move)) return move;
    }
  }

  // 3. خذ المنتصف
  if (board[4] === null && availableMoves.includes(4)) return 4;

  // 4. الزوايا
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== تحليل لوحة اللعب ==================
function parseBoard(message) {
  const text = (message.body || message.content || '').toLowerCase();

  if (text.includes('game started') || text.includes('بدأت اللعبة')) {
    console.log('🎮 بداية جولة جديدة وتصفير اللوحة...');
    board = Array(9).fill(null);
    isProcessingMove = false;
  }

  // تثبيت الإشارات بشكل صحيح وصارم بدون عكسها
  if (text.includes('(o)') || text.includes('⭕')) { 
    mySign = 'O'; 
    botSign = 'X'; 
  } else if (text.includes('(x)') || text.includes('❌')) { 
    mySign = 'X'; 
    botSign = 'O'; 
  }

  // تحديث اللوحة بناءً على الأرقام الصريحة فقط المحاطة بحدود نصية لعدم تداخل الوقت
  for (let i = 0; i < 9; i++) {
    const squareNum = (i + 1).toString();
    
    // إذا قمنا بنحن بلعبها مسبقاً، لا نغيرها
    if (board[i] === mySign) continue;

    const regex = new RegExp(`\\b${squareNum}\\b`);
    if (regex.test(text)) {
      board[i] = null; // فارغ
    } else {
      board[i] = botSign; // الخصم لعب هنا
    }
  }

  console.log(`🤖 رمزي الحالي: [ ${mySign} ] | رمز الخصم: [ ${botSign} ]`);
  console.log("🔍 مصفوفة اللوحة:", board.map((v, i) => v || (i + 1)));

  if (text.includes('your turn') || text.includes('دورك')) {
    isMyTurn = true;
  } else {
    isMyTurn = false;
  }

  if (text.includes('won') || text.includes('فاز') || text.includes('lost') || text.includes('خسارة') || text.includes('draw') || text.includes('تعادل')) {
    console.log('🏁 انتهت اللعبة!');
    isMyTurn = false;
    isProcessingMove = false;
    board = Array(9).fill(null);
    setTimeout(() => {
      sendGroupMessage(ROOM_ID, START_COMMAND);
    }, 5000);
  }
}

// ================== إرسال الرسائل ==================
async function sendGroupMessage(roomId, text) {
  if (!service || !isBotReady) return;
  try {
    await service.messaging.sendGroupMessage(roomId, text);
  } catch (err) {
    console.log('❌ خطأ إرسال للغرفة:', err.message);
  }
}

async function sendPrivateMessage(targetId, text) {
  if (!service || !isBotReady) return;
  try {
    await service.messaging.sendPrivateMessage(targetId, text);
    console.log(`🕹️ لعبت المربع: [ ${text} ]`);
  } catch (err) {
    console.log('❌ خطأ إرسال خاص:', err.message);
  }
}

// ================== تشغيل البوت ==================
function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      
      if (!message.isGroup && senderId === XO_BOT_ID) {
        parseBoard(message);
        
        if (isMyTurn && !isProcessingMove) {
          const moveIndex = getBestMove();
          if (moveIndex !== undefined && moveIndex !== -1) {
            const squareToPlay = (moveIndex + 1).toString();
            
            isProcessingMove = true; 
            board[moveIndex] = mySign; // نضع رمزنا الصحيح (mySign) وليس العكس!
            isMyTurn = false; 
            
            await sleep(1000); 
            await sendPrivateMessage(XO_BOT_ID, squareToPlay);
          }
        }
      }
    } catch (err) {
      console.log('❌ Error:', err.message);
      isProcessingMove = false;
    }
  });

  service.on('ready', async () => {
    console.log('🤖 البوت جاهز!');
    isBotReady = true;
    reconnecting = false;
    await sleep(2000);
    await sendGroupMessage(ROOM_ID, START_COMMAND);
  });

  const restart = () => {
    if (reconnecting) return;
    reconnecting = true;
    isBotReady = false;
    isProcessingMove = false;
    setTimeout(startBot, 5000);
  };

  service.on('error', restart);
  service.on('disconnected', restart);
  service.on('close', restart);

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
}

startBot();
