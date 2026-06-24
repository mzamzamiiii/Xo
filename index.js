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

  // 3. خذ المنتصف إذا كان فارغاً
  if (board[4] === null && availableMoves.includes(4)) return 4;

  // 4. خذ الزوايا
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== تحليل كود الـ HTML المكتشف ==================
function parseAndPlay(message) {
  const text = (message.body || message.content || '').toLowerCase();

  // فحص تصفير جولة جديدة
  if (text.includes('game started') || text.includes('بدأت اللعبة') || text.includes('rematch')) {
    console.log('🎮 جولة جديدة رُصدت، إعادة تهيئة اللوحة...');
    board = Array(9).fill(null);
  }

  // تحديد الرموز والإشارات الحالية
  if (text.includes('(o)') || text.includes('⭕')) { 
    mySign = 'O'; 
    botSign = 'X'; 
  } else if (text.includes('(x)') || text.includes('❌')) { 
    mySign = 'X'; 
    botSign = 'O'; 
  }

  // تحديث حالة اللوحة بناءً على الأرقام المتبقية في الـ HTML
  for (let i = 0; i < 9; i++) {
    const squareNum = (i + 1).toString();
    
    // المربع الفارغ في كود وولف يحمل الرقم صراحة داخل الـ HTML
    const regex = new RegExp(`>${squareNum}<|"${squareNum}"|\\b${squareNum}\\b`);
    
    if (regex.test(text)) {
      board[i] = null; // المربع فارغ ومتاح للعب
    } else {
      // إذا اختفى الرقم، ولم نكن نحن من لعبنا فيه سابقاً، فهو للخصم بالتأكيد
      if (board[i] !== mySign) {
        board[i] = botSign;
      }
    }
  }

  console.log(`🤖 الرمز الحالي: [ ${mySign} ]`);
  console.log("🔍 مصفوفة اللوحة الحقيقية:", board.map((v, i) => v || (i + 1)));

  // فحص إذا كان الدور لنا الآن للعب بشكل صريح وفوري
  const isMyTurn = text.includes('your turn') || text.includes('turn') || text.includes('xobot-mp-private__content__top__turn');

  if (isMyTurn) {
    const moveIndex = getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      const squareToPlay = (moveIndex + 1).toString();
      
      // تحديث فوري ومحلي للوحة لتجنب التكرار
      board[moveIndex] = mySign;
      
      // إرسال الحركة فوراً
      setTimeout(async () => {
        await sendPrivateMessage(XO_BOT_ID, squareToPlay);
      }, 800); // تأخير بسيط جداً لمنع تعليق الرسائل المتتالية
    }
  }

  // إعادة التشغيل عند نهاية الجولة
  if (text.includes('won') || text.includes('lost') || text.includes('draw') || text.includes('تعادل') || text.includes('fanz')) {
    console.log('🏁 جولة منتهية! جاري بدء مباراة جديدة بعد 5 ثوانٍ...');
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
    console.log('❌ خطأ إرسال للغرفة:', err.message);
  }
}

async function sendPrivateMessage(targetId, text) {
  if (!service || !isBotReady) return;
  try {
    await service.messaging.sendPrivateMessage(targetId, text);
    console.log(`🕹️ تم إرسال الحركة للمربع رقم: [ ${text} ]`);
  } catch (err) {
    console.log('❌ خطأ إرسال خاص:', err.message);
  }
}

// ================== تشغيل وفحص اتصال البوت ==================
function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      
      if (!message.isGroup && senderId === XO_BOT_ID) {
        const text = (message.body || message.content || '').toLowerCase();
        
        // تصحيح فوري إذا كانت الخانة ممتلئة بالخطأ لفتح المسار مجدداً
        if (text.includes('already been used') || text.includes('used')) {
          console.log('⚠️ الخانة ممتلئة مسبقاً، إعادة الحساب تلقائياً...');
          const matched = text.match(/\d/);
          if (matched) {
            const usedSquare = parseInt(matched[0]) - 1;
            board[usedSquare] = botSign;
          }
          // نجبر البوت على إعادة فحص اللوحة الحالية واللعب مجدداً في مكان فارغ
          parseAndPlay(message);
        } else {
          parseAndPlay(message);
        }
      }
    } catch (err) {
      console.log('❌ خطأ في معالجة الرسالة:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('🤖 البوت جاهز تماماً ومتصل الآن!');
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
