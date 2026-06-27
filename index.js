import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

// ========================================================
// الجزء الأول: لوحة التحكم (Config)
// قم بتعديل البيانات هنا، وضع enabled: true للتشغيل أو false للإيقاف
// ========================================================
const MY_ACCOUNTS = [
  { id: 1, email: 'MAIL_1', pass: 'PASS_1', roomId: 22249609, enabled: true },
  { id: 2, email: 'MAIL_2', pass: 'PASS_2', roomId: 22249609, enabled: false },
  { id: 3, email: 'MAIL_3', pass: 'PASS_3', roomId: 22249609, enabled: false },
  { id: 4, email: 'MAIL_4', pass: 'PASS_4', roomId: 22249609, enabled: false },
  { id: 5, email: 'MAIL_5', pass: 'PASS_5', roomId: 22249609, enabled: false },
  { id: 6, email: 'MAIL_6', pass: 'PASS_6', roomId: 22249609, enabled: false },
  { id: 7, email: 'MAIL_7', pass: 'PASS_7', roomId: 22249609, enabled: false },
  { id: 8, email: 'MAIL_8', pass: 'PASS_8', roomId: 22249609, enabled: false },
  { id: 9, email: 'MAIL_9', pass: 'PASS_9', roomId: 22249609, enabled: false },
  { id: 10, email: 'MAIL_10', pass: 'PASS_10', roomId: 22249609, enabled: false },
  { id: 11, email: 'MAIL_11', pass: 'PASS_11', roomId: 22249609, enabled: false },
  { id: 12, email: 'MAIL_12', pass: 'PASS_12', roomId: 22249609, enabled: false }
];

const XO_BOT_ID = 82727814;      
const START_COMMAND = '!xo private ai 3';     
const WINNING_COMBOS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// ========================================================
// الجزء الثاني: قالب البوت (BotInstance)
// يحتوي على نفس منطقك بالضبط، مغلف داخل Class لكل حساب
// ========================================================
class BotInstance {
  constructor(config) {
    this.config = config;
    this.service = new WOLF();
    this.board = Array(9).fill(null); 
    this.mySign = 'X';     
    this.botSign = 'O';    
    this.botActionLock = false;       
    this.hasSentRestart = false;      
    this.gameInitiationInterval = null; 
    
    this.init();
  }

  init() {
    this.service.on('message', (msg) => this.handleIncomingData(msg));
    this.service.on('messageUpdate', (msg) => this.handleIncomingData(msg));

    this.service.on('ready', async () => {
      console.log(`[حساب ${this.config.id}] جاهز. بدء حلقة البدء.`);
      this.startInitiationLoop(); 
    });

    this.service.login(this.config.email, this.config.pass);
  }

  // --- دوال حلقة البدء التلقائي (نفس منطقك) ---
  startInitiationLoop() {
    if (this.gameInitiationInterval) return; 
    console.log(`[${this.config.id}] 🔄 تفعيل حلقة البدء...`);
    this.sendGroupMessageWithRetry(this.config.roomId, START_COMMAND);
    this.gameInitiationInterval = setInterval(() => {
        this.sendGroupMessageWithRetry(this.config.roomId, START_COMMAND);
    }, 5000);
  }

  stopInitiationLoop() {
    if (this.gameInitiationInterval) {
        clearInterval(this.gameInitiationInterval);
        this.gameInitiationInterval = null;
        console.log(`[${this.config.id}] ✅ تم إيقاف حلقة البدء.`);
    }
  }

  // --- المنطق الذكي (نفس منطقك) ---
  checkWinner(tempBoard, player) {
    for (let combo of WINNING_COMBOS) {
      if (tempBoard[combo[0]] === player && tempBoard[combo[1]] === player && tempBoard[combo[2]] === player) return true;
    }
    return false;
  }

  minimax(tempBoard, depth, isMaximizing) {
    if (this.checkWinner(tempBoard, this.mySign)) return 10 - depth;
    if (this.checkWinner(tempBoard, this.botSign)) return depth - 10;
    if (!tempBoard.includes(null)) return 0;
    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (tempBoard[i] === null) {
          tempBoard[i] = this.mySign;
          let score = this.minimax(tempBoard, depth + 1, false);
          tempBoard[i] = null;
          bestScore = Math.max(score, bestScore);
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (tempBoard[i] === null) {
          tempBoard[i] = this.botSign;
          let score = this.minimax(tempBoard, depth + 1, true);
          tempBoard[i] = null;
          bestScore = Math.min(score, bestScore);
        }
      }
      return bestScore;
    }
  }

  getBestMove() {
    const availableMoves = [];
    for (let i = 0; i < 9; i++) if (this.board[i] === null) availableMoves.push(i);
    if (availableMoves.length === 0) return undefined;
    
    for (let combo of WINNING_COMBOS) {
      let myCount = 0, emptyIdx = -1;
      for (let idx of combo) {
        if (this.board[idx] === this.mySign) myCount++;
        else if (this.board[idx] === null) emptyIdx = idx;
      }
      if (myCount === 2 && emptyIdx !== -1) return emptyIdx;
    }
    for (let combo of WINNING_COMBOS) {
      let botCount = 0, emptyIdx = -1;
      for (let idx of combo) {
        if (this.board[idx] === this.botSign) botCount++;
        else if (this.board[idx] === null) emptyIdx = idx;
      }
      if (botCount === 2 && emptyIdx !== -1) return emptyIdx;
    }

    let bestScore = -Infinity;
    let move = -1;
    for (let i = 0; i < availableMoves.length; i++) {
      let idx = availableMoves[i];
      this.board[idx] = this.mySign; 
      let score = this.minimax(this.board, 0, false); 
      this.board[idx] = null; 
      if (score > bestScore) { bestScore = score; move = idx; }
    }
    return move;
  }

  // --- معالجة البيانات (نفس منطقك) ---
  handleIncomingData(message) {
    if (message.type !== 'text/html') return;
    const html = message.body;
    const lowerHtml = html.toLowerCase(); 

    const isEndGame = lowerHtml.includes('rematch') || lowerHtml.includes('you won') || lowerHtml.includes('you lost') || lowerHtml.includes('tie');

    if (isEndGame) {
      if (!this.hasSentRestart) {
        this.hasSentRestart = true; 
        this.botActionLock = true; 
        console.log(`[${this.config.id}] 🏁 انتهت اللعبة!`);
        setTimeout(() => { this.startInitiationLoop(); this.hasSentRestart = false; }, 5000);
      }
      return;
    }

    if (html.includes('xobot-mp-private__content__middle__position')) {
      this.stopInitiationLoop(); 
    }

    if (html.includes('Your Turn!')) {
      this.hasSentRestart = false; 
      const blocks = html.split('xobot-mp-private__content__middle__position');
      if (blocks.length > 9) {
          for (let i = 0; i < 9; i++) {
              const block = blocks[i + 1];
              if (block.includes('❌') || block.includes('--x')) this.board[i] = 'X';
              else if (block.includes('⭕') || block.includes('--o')) this.board[i] = 'O';
              else this.board[i] = null; 
          }
          if (html.includes('(❌)')) { this.mySign = 'X'; this.botSign = 'O'; } 
          else if (html.includes('(⭕)')) { this.mySign = 'O'; this.botSign = 'X'; }
          this.triggerBotMove();
      }
    }
  }

  triggerBotMove() {
    const moveIndex = this.getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      const squareToPlay = (moveIndex + 1).toString();
      console.log(`[${this.config.id}] ⏳ دوري: إرسال المربع [ ${squareToPlay} ]`);
      this.sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
    }
  }

  // --- دوال الإرسال (نفس منطقك) ---
  async sendPrivateMessageWithRetry(targetId, text, attempt = 1) {
    try { await this.service.messaging.sendPrivateMessage(targetId, text); } 
    catch (err) { if (attempt < 3) setTimeout(() => this.sendPrivateMessageWithRetry(targetId, text, attempt + 1), 2000); }
  }

  async sendGroupMessageWithRetry(roomId, text, attempt = 1) {
    try { await this.service.messaging.sendGroupMessage(roomId, text); } 
    catch (err) { if (attempt < 3) setTimeout(() => this.sendGroupMessageWithRetry(roomId, text, attempt + 1), 2000); }
  }
}

// ========================================================
// الجزء الثالث: التشغيل (Execution)
// ========================================================
console.log("🚀 نظام تشغيل الحسابات المتعددة يعمل الآن...");

MY_ACCOUNTS.forEach(acc => {
  if (acc.enabled) {
    // تأخير عشوائي لعدم الضغط على السيرفر عند التشغيل
    setTimeout(() => {
      new BotInstance(acc);
      console.log(`[حساب ${acc.id}] تم التشغيل.`);
    }, Math.random() * 5000); 
  } else {
    console.log(`[حساب ${acc.id}] متوقف (تم ضبطه على false).`);
  }
});
