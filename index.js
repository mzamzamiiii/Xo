import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// ================== الإعدادات ==================
const ROOM_ID = 22249609;        // رقم الغرفة لإرسال أمر البدء
const XO_BOT_ID = 82727814;      // معرف بوت الـ XO (تأكد من مطابقته لحساب XO Bot)
const START_COMMAND = '!xo private ai 3';     // الأمر المستخدم لبدء اللعبة في الغرفة

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let service = null;
let isBotReady = false;
let reconnecting = false;

// مصفوفة تمثل لوحة اللعب (9 خانات)، القيمة تكون 'X' أو 'O' أو فارغة
let board = Array(9).fill(null); 
let mySign = 'O';     // الرمز الخاص بك (حسب الصورة "Your Turn (O)" في لقطة الشاشة)
let botSign = 'X';    // رمز الخصم
let isMyTurn = false;

// ================== خوارزمية الذكاء الاصطناعي لـ XO ==================
// تحديد الحركات الفائزة
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // أفقي
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // عمودي
  [0, 4, 8], [2, 4, 6]             // قطري
];

function getBestMove() {
  // 1. هل يمكنني الفوز في هذه الخطوة؟
  for (let combo of WINNING_COMBOS) {
    let myCount = combo.filter(i => board[i] === mySign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (myCount === 2 && emptyCount === 1) {
      return combo.find(i => board[i] === null);
    }
  }

  // 2. هل يمكن للخصم الفوز؟ (قم بحشره/منعه)
  for (let combo of WINNING_COMBOS) {
    let botCount = combo.filter(i => board[i] === botSign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (botCount === 2 && emptyCount === 1) {
      return combo.find(i => board[i] === null);
    }
  }

  // 3. خذ المنتصف إذا كان فارغاً (مربع رقم 5، ترتيبه في المصفوفة 4)
  if (board[4] === null) return 4;

  // 4. خذ الزوايا الفارغة
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  // 5. اختر أي مربع فارغ متبقي
  const availableMoves = board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== تحليل لوحة اللعب من رسالة البوت ==================
// دالة تقوم بتحديث حالة اللوحة بناءً على نص الرسالة أو أزرار الـ Embed القادمة من XO Bot
function parseBoard(message) {
  const text = (message.body || message.content || '').toLowerCase();

  // إعادة تعيين اللوحة إذا كانت الرسالة تفيد ببدء لعبة جديدة
  if (text.includes('game started') || text.includes('بدأت اللعبة') || text.includes('your turn')) {
    // التحقق من الرمز الممنوح لك
    if (text.includes('(o)')) { mySign = 'O'; botSign = 'X'; }
    if (text.includes('(x)')) { mySign = 'X'; botSign = 'O'; }
    
    // إذا أرسل البوت لوحة نصية أو أزرار، نقوم بتحديث الـ board هنا
    // سنعتمد على الأرقام الموجودة بالرسالة لمعرفة المربعات المتاحة
    for (let i = 0; i < 9; i++) {
      const squareNum = (i + 1).toString();
      // إذا كان رقم المربع موجود في الرسالة (يعني أنه لا يزال فارغاً ومتاحاً للضغط)
      if (text.includes(squareNum)) {
        board[i] = null;
      } else {
        // إذا اختفى الرقم، يعني أن هناك رمزاً تم وضعه (سنفترض مبدئياً الحركات بناءً على التحديثات المستمرة)
      }
    }
    
    // محاكاة سريعة لقراءة لقطة الشاشة الأولى: المربع 5 تم لعبه، والمربعات المتبقية تظهر أرقامها
    // الأفضل في بوتات وولف الحديثة الاعتماد على الأزرار (Group/Private Inline Buttons) إذا كانت متوفرة في كود المطورين
    
    if (text.includes('your turn') || text.includes('دورك')) {
      isMyTurn = true;
    } else {
      isMyTurn = false;
    }
  }
  
  // التحقق من انتهاء اللعبة
  if (text.includes('won') || text.includes('فاز') || text.includes('draw') || text.includes('تعادل')) {
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

  // الاستماع للرسائل (عام وخاص)
  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      
      // التعامل مع رسائل الخاص القادمة من بوت اللعبة XO Bot
      if (!message.isGroup && senderId === XO_BOT_ID) {
        parseBoard(message);
        
        if (isMyTurn) {
          const moveIndex = getBestMove();
          if (moveIndex !== undefined && moveIndex !== -1) {
            // المربعات في اللعبة من 1 إلى 9، والمصفوفة من 0 إلى 8، لذلك نزيد 1
            const squareToPlay = (moveIndex + 1).toString();
            
            // تحديث اللوحة داخلياً بحركتك
            board[moveIndex] = mySign;
            isMyTurn = false;
            
            // تأخير بسيط (نصف ثانية) حتى يبدو اللعب طبيعياً ولا يحظر الحساب
            await sleep(500); 
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
    // إرسال الأمر للغرفة عند التشغيل لأول مرة لبدء السلسلة
    await sendGroupMessage(ROOM_ID, START_COMMAND);
  });

  // إعادة الاتصال التلقائي
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
