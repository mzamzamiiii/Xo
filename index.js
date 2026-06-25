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
let lastPlayedIndex = -1; 
let isGameEnding = false; 
let isSending = false; 

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], 
  [0, 3, 6], [1, 4, 7], [2, 5, 8], 
  [0, 4, 8], [2, 4, 6]             
];

// ================== استراتيجية الوزن الرقمي السريعة والمضمونة ==================
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
      return combo.find(i => board[i] === null);
    }
  }

  // 2. حظر الخصم ومنعه من الفوز فوراً
  for (let combo of WINNING_COMBOS) {
    let botCount = combo.filter(i => board[i] === botSign).length;
    let emptyCount = combo.filter(i => board[i] === null).length;
    if (botCount === 2 && emptyCount === 1) {
      return combo.find(i => board[i] === null);
    }
  }

  // 3. صناعة فخ مزدوج (Fork) إن أمكن
  for (let move of availableMoves) {
    board[move] = mySign;
    let winningLines = 0;
    for (let combo of WINNING_COMBOS) {
      let myCount = combo.filter(i => board[i] === mySign).length;
      let emptyCount = combo.filter(i => board[i] === null).length;
      if (myCount === 2 && emptyCount === 1) winningLines++;
    }
    board[move] = null;
    if (winningLines >= 2) return move;
  }

  // 4. احتلال المركز (5 وهو إندكس 4) لأنه يعطي أعلى أفضليات فوز
  if (board[4] === null && availableMoves.includes(4)) return 4;

  // 5. احتلال الزوايا الاستراتيجية
  const corners = [0, 2, 6, 8];
  const availableCorners = corners.filter(i => board[i] === null);
  if (availableCorners.length > 0) {
    return availableCorners[Math.floor(Math.random() * availableCorners.length)];
  }

  return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

// ================== معالجة وقراءة البيانات وتحديث الجولات تلقائياً ==================
function handleIncomingData(message) {
  const text = (message.body || message.content || '').toLowerCase();

  // 1. رصد النهاية وبدء جولة جديدة
  if (
    text.includes('won') || text.includes('lost') || text.includes('tie') || 
    text.includes('draw') || text.includes('تعادل') || text.includes('game over') || 
    text.includes('expires') || text.includes('انتهت') || text.includes('فاز')
  ) {
    if (!isGameEnding) {
      isGameEnding = true; 
      isSending = false;
      console.log('🏁 تم رصد نهاية المباراة. جاري بدء جولة جديدة خلال ثوانٍ...');
      board = Array(9).fill(null);

      setTimeout(async () => {
        await sendGroupMessage(ROOM_ID, START_COMMAND);
        isGameEnding = false; 
      }, 4000);
    }
    return;
  }

  if (text.includes('game started') || text.includes('بدأت اللعبة')) {
    console.log('🎮 جولة جديدة انطلقت!');
    board = Array(9).fill(null);
    isGameEnding = false;
    isSending = false;
  }

  // 2. التعرف على الرمز الحالي
  if (text.includes('your turn! (❌)') || text.includes('turn! (x)') || text.includes('دورك (❌)')) {
    mySign = 'X';
    botSign = 'O';
  } else if (text.includes('your turn! (⭕)') || text.includes('turn! (o)') || text.includes('دورك (⭕)')) {
    mySign = 'O';
    botSign = 'X';
  }

  // 3. قراءة اللوحة بذكاء عبر الإيموجيات بدلاً من الأكواد المعقدة
  const boardMatches = text.match(/(❌|⭕|⬜|⬛|🔲|🔳|[1-9])/g);
  
  if (boardMatches && boardMatches.length >= 9) {
    const grid = boardMatches.slice(-9);
    for (let i = 0; i < 9; i++) {
      if (grid[i] === '❌') {
        board[i] = 'X';
      } else if (grid[i] === '⭕') {
        board[i] = 'O';
      } else {
        board[i] = null; 
      }
    }
  }

  console.log(`✨ رمزي: [ ${mySign} ] | رمز الخصم: [ ${botSign} ]`);
  console.log("🔍 لوحة اللعبة الحالية:", board.map((v, i) => v || (i + 1)));

  // 4. تحديد الدور بشكل صارم جداً
  const isMyTurn = (text.includes('your turn') || text.includes('دورك'));
  const isOpponentTurn = (text.includes("opponent's turn") || text.includes('دور الخصم'));

  if (isMyTurn && !isOpponentTurn && !isGameEnding && !isSending) {
    const moveIndex = getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      const squareToPlay = (moveIndex + 1).toString();
      
      isSending = true; 
      
      const secureDelay = Math.floor(Math.random() * (1300 - 900 + 1)) + 900; 
      console.log(`⏳ دوري الآن! تأخير: [ ${secureDelay}ms ] لإرسال الرقم: [ ${squareToPlay} ]`);
      
      setTimeout(async () => {
        await sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
      }, secureDelay); 
    }
  }
}

// ================== نظام إرسال متوازن ومحمي بالتعديل الجديد ==================
async function sendPrivateMessageWithRetry(targetId, text, attempt = 1) {
  if (!service || !isBotReady) {
    isSending = false;
    return;
  }

  try {
    await service.messaging.sendPrivateMessage(targetId, text);
    console.log(`✅ تم إرسال الرقم بنجاح: [ ${text} ]`);

    lastPlayedIndex = -1;

    setTimeout(() => {
      isSending = false;
    }, 800);

  } catch (err) {
    console.log(`⚠️ فشل إرسال رقم [ ${text} ] محاولة [ ${attempt} ]: ${err.message}`);

    if (attempt < 3 && !isGameEnding) {
      setTimeout(() => {
        sendPrivateMessageWithRetry(targetId, text, attempt + 1);
      }, 500);
    } else {
      lastPlayedIndex = -1;
      isSending = false;
    }
  }
}

async function sendGroupMessage(roomId, text) {
  if (!service || !isBotReady) return;
  try { await service.messaging.sendGroupMessage(roomId, text); } catch (err) {}
}

// ================== بدء التشغيل والربط والتنصت ==================
function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    const senderId = Number(message.sourceSubscriberId);
    if (!message.isGroup && senderId === XO_BOT_ID) {
      const text = (message.body || message.content || '').toLowerCase();
      if (text.includes('already been used') || text.includes('used')) {
        lastPlayedIndex = -1;
        isSending = false; 
      }
      handleIncomingData(message);
    }
  });

  service.on('messageUpdate', async (message) => {
    const senderId = Number(message.sourceSubscriberId);

    if (!message.isGroup && senderId === XO_BOT_ID) {
      isSending = false;
      handleIncomingData(message);
    }
  });

  service.on('ready', async () => {
    console.log('🚀 تم تطبيق التعديلات بنجاح! البوت الآن أكثر مرونة وأسرع بفك الأقفال والتكرار.');
    isBotReady = true;
    reconnecting = false;
    await sleep(2000);
    await sendGroupMessage(ROOM_ID, START_COMMAND);
  });

  const restart = () => {
    if (reconnecting) return;
    reconnecting = true; isBotReady = false; isSending = false;
    setTimeout(startBot, 5000);
  };

  service.on('error', restart);
  service.on('disconnected', restart);
  service.on('close', restart);

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
}

startBot();
