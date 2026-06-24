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
let mySign = 'O';     
let botSign = 'X';    
let isMyTurn = false;

// ================== خوارزمية الذكاء الاصطناعي لـ XO ==================
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // أفقي
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // عمودي
  [0, 4, 8], [2, 4, 6]             // قطري
];

function getBestMove() {
  // تصفية الحركات المتاحة فعلياً بناءً على مربعات الـ null فقط
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

  // 2. هل يمكن للخصم الفوز؟ حشره
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

  // 5. حركة عشوائية من المتاح
  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== تحليل لوحة اللعب الذكي ==================
function parseBoard(message) {
  const text = (message.body || message.content || '').toLowerCase();

  // تصفير عند البداية
  if (text.includes('game started') || text.includes('بدأت اللعبة')) {
    console.log('🎮 بداية مباراة جديدة...');
    board = Array(9).fill(null);
  }

  // تحديد العلامات بدقة
  if (text.includes('(o)') || text.includes('⭕')) { mySign = 'O'; botSign = 'X'; }
  if (text.includes('(x)') || text.includes('❌')) { mySign = 'X'; botSign = 'O'; }

  // طريقة مبتكرة: نعتمد أولاً على فحص النص المباشر للمربعات محاطة بمسافات لضمان عدم التداخل مع التوقيت
  for (let i = 0; i < 9; i++) {
    const squareNum = (i + 1).toString();
    
    // إذا كان المربع يحتوي على علامتي أنا (التي لعبتها مسبقاً)، نثبتها
    if (board[i] === mySign) continue;

    // فحص دقيق: هل الرقم موجود بشكل صريح كأزرار أو نص منفصل؟
    // إذا وجدنا الرقم 1-9 محاطاً بحدود نصية أو كان البوت يعرض اللوحة بشكل شبكة
    const regex = new RegExp(`\\b${squareNum}\\b`);
    
    if (regex.test(text)) {
      board[i] = null; // المربع فارغ ومتاح
    } else {
      board[i] = botSign; // الرقم اختفى تماماً ولم نلعبه نحن، إذن هو للخصم
    }
  }

  console.log("🔍 حالة اللوحة الحقيقية:", board.map((v, i) => v || (i + 1)));

  // من عليه الدور؟
  if (text.includes('your turn') || text.includes('دورك')) {
    isMyTurn = true;
  } else {
    isMyTurn = false;
  }

  // انتهاء اللعبة
  if (text.includes('won') || text.includes('فاز') || text.includes('lost') || text.includes('خسارة') || text.includes('draw') || text.includes('تعادل')) {
    console.log('🏁 انتهت المباراة! إعادة تشغيل بعد 5 ثوانٍ...');
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
    console.log(`🕹️ تم إرسال الحركة: المربع رقم [ ${text} ]`);
  } catch (err) {
    console.log('❌ فشل اللعب:', err.message);
  }
}

// ================== تشغيل البوت ==================
function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      
      if (!message.isGroup && senderId === XO_BOT_ID) {
        const text = (message.body || message.content || '').toLowerCase();
        
        // إذا واجهنا خطأ التكرار، نقوم فوراً بتحديث الخانة وتصحيحها ذكياً
        if (text.includes('already been used') || text.includes('مستخدم مسبقاً')) {
          // استخراج الرقم المرفوض لتسجيله للخصم فوراً
          const matched = text.match(/\d/);
          if (matched) {
            const usedSquare = parseInt(matched[0]) - 1;
            if (board[usedSquare] !== mySign) {
              board[usedSquare] = botSign;
            }
          }
          isMyTurn = true; // نمنحه فرصة اللعب فوراً بدون انتظار
        } else {
          parseBoard(message);
        }
        
        if (isMyTurn) {
          const moveIndex = getBestMove();
          if (moveIndex !== undefined && moveIndex !== -1) {
            const squareToPlay = (moveIndex + 1).toString();
            
            // قفل الحركة داخلياً قبل الإرسال لمنع التكرار المتزامن (Race Condition)
            board[moveIndex] = mySign;
            isMyTurn = false; 
            
            // زيادة التأخير لـ 900ms لضمان وصول تحديث اللعبة من سيرفرات وولف قبل الحركة التالية
            await sleep(900); 
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
