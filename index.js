import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// ================== الإعدادات ==================
const ROOM_ID = 22249609;        // رقم الغرفة لإرسال أمر البدء
const XO_BOT_ID = 82727814;      // معرف بوت الـ XO
const START_COMMAND = '!xo private ai 3';     // الأمر المستخدم لبدء اللعبة في الغرفة

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let service = null;
let isBotReady = false;
let reconnecting = false;

// مصفوفة تمثل لوحة اللعب (9 خانات)، القيمة تكون 'X' أو 'O' أو فارغة
let board = Array(9).fill(null); 
let mySign = 'O';     // الرمز الخاص بك
let botSign = 'X';    // رمز الخصم
let isMyTurn = false;

// ================== خوارزمية الذكاء الاصطناعي لـ XO ==================
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // أفقي
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // عمودي
  [0, 4, 8], [2, 4, 6]             // قطري
];

function getBestMove() {
  // 0. تصفية الحركات المتاحة فعلياً (تأكيد أمان إضافي)
  const availableMoves = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
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

  // 2. هل يمكن للخصم الفوز؟ (قم بحشره/منعه)
  for (let combo of WINNING_COMBOS) {
    let botCount = combo.filter(i => board[i] === botSign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (botCount === 2 && emptyCount === 1) {
      const move = combo.find(i => board[i] === null);
      if (availableMoves.includes(move)) return move;
    }
  }

  // 3. خذ المنتصف إذا كان فارغاً
  if (board[4] === null && availableMoves.includes(4)) return 4;

  // 4. خذ الزوايا الفارغة
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  // 5. اختر أي مربع فارغ متبقي من المتاحة فعلياً
  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== تحليل لوحة اللعب من رسالة البوت ==================
function parseBoard(message) {
  const text = (message.body || message.content || '').toLowerCase();

  // إعادة تعيين اللوحة إذا كانت اللعبة جديدة
  if (text.includes('game started') || text.includes('بدأت اللعبة')) {
    console.log('🎮 تم رصد بداية مباراة جديدة، جاري تصفير اللوحة...');
    board = Array(9).fill(null);
  }

  // التحقق من الرمز الممنوح لك
  if (text.includes('(o)') || text.includes('⭕')) { mySign = 'O'; botSign = 'X'; }
  if (text.includes('(x)') || text.includes('❌')) { mySign = 'X'; botSign = 'O'; }
  
  // تحديث حالة اللوحة بدقة بناءً على الأرقام المختفية والموجودة
  for (let i = 0; i < 9; i++) {
    const squareNum = (i + 1).toString();
    
    if (text.includes(squareNum)) {
      // إذا كان رقم المربع موجود في الرسالة، فهو حتماً فارغ ومتاح
      board[i] = null;
    } else {
      // إذا اختفى الرقم، ولم نكن نحن من لعبنا فيه سابقاً، إذن الخصم هو من أخذه
      if (board[i] !== mySign) {
        board[i] = botSign;
      }
    }
  }
  
  // طباعة اللوحة الحالية في الكونسول لمتابعة ذكاء البوت وسير المباراة
  console.log("اللوحة الحالية:", board.map((v, i) => v || (i + 1)));
  
  // التحقق من من عليه الدور
  if (text.includes('your turn') || text.includes('دورك')) {
    isMyTurn = true;
  } else {
    isMyTurn = false;
  }
  
  // التحقق من انتهاء اللعبة (فوز، خسارة، أو تعادل)
  if (text.includes('won') || text.includes('فاز') || text.includes('lost') || text.includes('خسارة') || text.includes('draw') || text.includes('تعادل')) {
    console.log('🏁 انتهت المباراة! جاري بدء مباراة جديدة بعد 5 ثوانٍ...');
    isMyTurn = false;
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
    console.log(`💬 تم إرسال أمر للغرفة: ${text}`);
  } catch (err) {
    console.log('❌ فشل الإرسال للغرفة:', err.message);
  }
}

async function sendPrivateMessage(targetId, text) {
  if (!service || !isBotReady) return;
  try {
    await service.messaging.sendPrivateMessage(targetId, text);
    console.log(`🕹️ لعبت المربع رقم: ${text}`);
  } catch (err) {
    console.log('❌ فشل اللعب في الخاص:', err.message);
  }
}

// ================== تشغيل البوت ==================
function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      
      // التعامل مع رسائل الخاص القادمة من بوت اللعبة XO Bot
      if (!message.isGroup && senderId === XO_BOT_ID) {
        parseBoard(message);
        
        if (isMyTurn) {
          const moveIndex = getBestMove();
          if (moveIndex !== undefined && moveIndex !== -1) {
            const squareToPlay = (moveIndex + 1).toString();
            
            // تحديث اللوحة داخلياً بحركتك فوراً قبل الإرسال لمنع التكرار
            board[moveIndex] = mySign;
            isMyTurn = false;
            
            // تأخير بسيط طبيعي
            await sleep(600); 
            await sendPrivateMessage(XO_BOT_ID, squareToPlay);
          }
        }
      }
    } catch (err) {
      console.log('❌ Error:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('🤖 بوت الـ XO جاهز ومسجل الدخول!');
    isBotReady = true;
    reconnecting = false;

    await sleep(2000);
    await sendGroupMessage(ROOM_ID, START_COMMAND);
  });

  const restart = () => {
    if (reconnecting) return;
    reconnecting = true;
    isBotReady = false;
    console.log('🔄 جاري إعادة تشغيل البوت...');
    if (service) service.removeAllListeners();
    setTimeout(startBot, 5000);
  };

  service.on('error', restart);
  service.on('disconnected', restart);
  service.on('close', restart);

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
}

startBot();
