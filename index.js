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
let isGameEnding = false; 

// ================== خوارزمية الذكاء الاصطناعي الهجومية الذكية ==================
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

  // 1. اقتناص الفوز الفوري
  for (let combo of WINNING_COMBOS) {
    let myCount = combo.filter(i => board[i] === mySign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (myCount === 2 && emptyCount === 1) {
      const move = combo.find(i => board[i] === null);
      if (availableMoves.includes(move)) return move;
    }
  }

  // 2. حظر الخصم ومنعه من الفوز
  for (let combo of WINNING_COMBOS) {
    let botCount = combo.filter(i => board[i] === botSign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (botCount === 2 && emptyCount === 1) {
      const move = combo.find(i => board[i] === null);
      if (availableMoves.includes(move)) return move;
    }
  }

  // 3. استراتيجية الهجوم المتقدم (صناعة فخ Fork)
  for (let move of availableMoves) {
    board[move] = mySign;
    let winningLines = 0;
    for (let combo of WINNING_COMBOS) {
      let myCount = combo.filter(i => board[i] === mySign).length;
      let emptyCount = combo.filter(i => board[i] === null).length;
      if (myCount === 2 && emptyCount === 1) {
        winningLines++;
      }
    }
    board[move] = null; 
    if (winningLines >= 2) return move; 
  }

  // 4. إحباط خطط الـ Fork للخصم
  for (let move of availableMoves) {
    board[move] = botSign;
    let botWinningLines = 0;
    for (let combo of WINNING_COMBOS) {
      let botCount = combo.filter(i => board[i] === botSign).length;
      let emptyCount = combo.filter(i => board[i] === null).length;
      if (botCount === 2 && emptyCount === 1) {
        botWinningLines++;
      }
    }
    board[move] = null;
    if (botWinningLines >= 2) return move; 
  }

  // 5. السيطرة على مركز اللوحة
  if (board[4] === null && availableMoves.includes(4)) return 4;

  // 6. استراتيجية اللعب في الزوايا لبناء الفخ الهجومي
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

  if (
    text.includes('lost') || 
    text.includes('won') || 
    text.includes('tie') || 
    text.includes('draw') || 
    text.includes('تعادل') || 
    text.includes('rematch') ||
    text.includes('expires in')
  ) {
    if (!isGameEnding) {
      isGameEnding = true; 
      console.log('🏁 جولة منتهية. جاري طلب مباراة جديدة بعد 6 ثوانٍ...');
      board = Array(9).fill(null);
      lastPlayedIndex = -1;

      setTimeout(async () => {
        await sendGroupMessage(ROOM_ID, START_COMMAND);
        isGameEnding = false; 
      }, 6000);
    }
    return;
  }

  if (text.includes('game started') || text.includes('بدأت اللعبة')) {
    console.log('🎮 بدأت الجولة، تصفير اللوحة...');
    board = Array(9).fill(null);
    lastPlayedIndex = -1;
    isGameEnding = false;
  }

  if (text.includes('(o)') || text.includes('⭕') || text.includes('filter: hue-rotate(210deg)') || text.includes('turn! (⭕)')) { 
    mySign = 'O'; 
    botSign = 'X'; 
  } else if (text.includes('(x)') || text.includes('❌') || text.includes('turn! (❌)')) { 
    mySign = 'X'; 
    botSign = 'O'; 
  }

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
      if (text.includes(`>${squareNum}<`) || text.includes(`"${squareNum}"`) || text.includes(` ${squareNum} `)) {
        board[i] = null;
      } else if (board[i] === null) {
        board[i] = botSign; 
      }
    }
  }

  console.log(`🤖 الرمز الحالي للبوت: [ ${mySign} ] | رمز الخصم: [ ${botSign} ]`);
  console.log("🔍 مصفوفة اللوحة الحقيقية:", board.map((v, i) => v || (i + 1)));

  const isMyTurn = text.includes('your turn') || text.includes('turn') || text.includes('xobot-mp-private__content__top__turn');

  if (isMyTurn && !isGameEnding) {
    const moveIndex = getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1 && moveIndex !== lastPlayedIndex) {
      const squareToPlay = (moveIndex + 1).toString();
      
      board[moveIndex] = mySign;
      lastPlayedIndex = moveIndex; 

      const secureDelay = Math.floor(Math.random() * (2200 - 1500 + 1)) + 1500;
      console.log(`⏳ تأخير أمان آمن: [ ${secureDelay}ms ] ثم إرسال الحركة للمربع: [ ${squareToPlay} ]`);
      
      setTimeout(async () => {
        await sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
      }, secureDelay); 
    }
  }
}

// ================== نظام الإرسال المطور مع التحقق وإعادة المحاولة ==================
async function sendPrivateMessageWithRetry(targetId, text, attempt = 1) {
  if (!service || !isBotReady) return;
  try {
    // ننتظر استجابة السيرفر الفعلية للتأكد من وصولها
    const response = await service.messaging.sendPrivateMessage(targetId, text);
    
    // إذا رجعت الاستجابة بنجاح
    console.log(`✅ [سيرفر وولف استقبلها]: تم تسجيل الحركة بنجاح للمربع رقم: [ ${text} ]`);
  } catch (err) {
    console.log(`⚠️ فشل إرسال الحركة للمربع [ ${text} ] في المحاولة رقم [ ${attempt} ]. السبب: ${err.message}`);
    
    if (attempt < 3 && !isGameEnding) {
      console.log(`🔄 جاري إعادة المحاولة الإجبارية بعد 800ms لضمان الإرسال...`);
      setTimeout(() => {
        sendPrivateMessageWithRetry(targetId, text, attempt + 1);
      }, 800);
    } else {
      console.log(`❌ تم إلغاء الحركة [ ${text} ] بعد 3 محاولات فاشلة لتجنب التعليق.`);
      lastPlayedIndex = -1; // تصفير المؤشر ليعيد المحاولة بحركة جديدة عند التحديث القادم
    }
  }
}

async function sendGroupMessage(roomId, text) {
  if (!service || !isBotReady) return;
  try {
    await service.messaging.sendGroupMessage(roomId, text);
    console.log(`💬 تم إرسال أمر للغرفة لبدء لعبة جديدة: ${text}`);
  } catch (err) {
    console.log('❌ خطأ غرفة:', err.message);
  }
}

// ================== تشغيل البوت والتنصت ==================
function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      if (!message.isGroup && senderId === XO_BOT_ID) {
        const text = (message.body || message.content || '').toLowerCase();
        
        if (text.includes('already been used') || text.includes('used')) {
          console.log('⚠️ الخانة مستخدمة، مسح القفل لإعادة قراءة اللوحة...');
          lastPlayedIndex = -1;
          return;
        }
        handleIncomingData(message);
      }
    } catch (err) {
      console.log('❌ خطأ Message:', err.message);
    }
  });

  service.on('messageUpdate', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      if (!message.isGroup && senderId === XO_BOT_ID) {
        handleIncomingData(message);
      }
    } catch (err) {
      console.log('❌ خطأ Update:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('🛡️ وضع التأكيد المطور نشط الآن! لن تضيع أي حركة بعد اليوم.');
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
