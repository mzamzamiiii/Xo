import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

// ================== الجزء الأول: لوحة التحكم (Config) ==================
// هنا تضع حساباتك. غيّر enabled إلى true لتشغيل الحساب أو false لإيقافه.
const MY_ACCOUNTS = [
  { id: 1, email: process.env.U_MAIL_1, pass: process.env.U_PASS_1, roomId: 22249609, enabled: true },
  { id: 2, email: process.env.U_MAIL_2, pass: process.env.U_PASS_2, roomId: 22249609, enabled: false },
  { id: 3, email: process.env.U_MAIL_3, pass: process.env.U_PASS_3, roomId: 22249609, enabled: false },
  { id: 4, email: process.env.U_MAIL_4, pass: process.env.U_PASS_4, roomId: 22249609, enabled: false },
  { id: 5, email: process.env.U_MAIL_5, pass: process.env.U_PASS_5, roomId: 22249609, enabled: false },
  { id: 6, email: process.env.U_MAIL_6, pass: process.env.U_PASS_6, roomId: 22249609, enabled: false },
  { id: 7, email: process.env.U_MAIL_7, pass: process.env.U_PASS_7, roomId: 22249609, enabled: false },
  { id: 8, email: process.env.U_MAIL_8, pass: process.env.U_PASS_8, roomId: 22249609, enabled: false },
  { id: 9, email: process.env.U_MAIL_9, pass: process.env.U_PASS_9, roomId: 22249609, enabled: false },
  { id: 10, email: process.env.U_MAIL_10, pass: process.env.U_PASS_10, roomId: 22249609, enabled: false },
  { id: 11, email: process.env.U_MAIL_11, pass: process.env.U_PASS_11, roomId: 22249609, enabled: false },
  { id: 12, email: process.env.U_MAIL_12, pass: process.env.U_PASS_12, roomId: 22249609, enabled: false }
];

const XO_BOT_ID = 82727814;
const START_COMMAND = '!xo private ai 3';
const WINNING_COMBOS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// ================== الجزء الثاني: قالب البوت (Class) ==================
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
      console.log(`[حساب ${this.config.id}] متصل وجاهز!`);
      this.startInitiationLoop();
    });
    this.service.login(this.config.email, this.config.pass);
  }

  // --- دوال حلقة البدء ---
  startInitiationLoop() {
    if (this.gameInitiationInterval) return;
    this.sendGroupMessageWithRetry(this.config.roomId, START_COMMAND);
    this.gameInitiationInterval = setInterval(() => {
      this.sendGroupMessageWithRetry(this.config.roomId, START_COMMAND);
    }, 5000);
  }

  stopInitiationLoop() {
    if (this.gameInitiationInterval) {
      clearInterval(this.gameInitiationInterval);
      this.gameInitiationInterval = null;
    }
  }

  // --- المنطق الذكي (نفس منطقك الأصلي) ---
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

  // --- المعالجة والإرسال ---
  handleIncomingData(message) {
    if (message.type !== 'text/html') return;
    const html = message.body;
    const lowerHtml = html.toLowerCase();
    const isEndGame = lowerHtml.includes('rematch') || lowerHtml.includes('you won') || lowerHtml.includes('you lost') || lowerHtml.includes('tie');

    if (isEndGame) {
      if (!this.hasSentRestart) {
        this.hasSentRestart = true;
        this.botActionLock = true;
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
      this.sendPrivateMessageWithRetry(XO_BOT_ID, squareToPlay);
    }
  }

  async sendPrivateMessageWithRetry(targetId, text, attempt = 1) {
    try { await this.service.messaging.sendPrivateMessage(targetId, text); }
    catch (err) { if (attempt < 3) setTimeout(() => this.sendPrivateMessageWithRetry(targetId, text, attempt + 1), 2000); }
  }

  async sendGroupMessageWithRetry(roomId, text, attempt = 1) {
    try { await this.service.messaging.sendGroupMessage(roomId, text); }
    catch (err) { if (attempt < 3) setTimeout(() => this.sendGroupMessageWithRetry(roomId, text, attempt + 1), 2000); }
  }
}

// ================== الجزء الثالث: التشغيل ==================
console.log("🚀 نظام تشغيل الحسابات يعمل الآن...");

MY_ACCOUNTS.forEach((acc) => {
  if (acc.enabled) {
    // إضافة تأخير بسيط (Random Delay) لمنع حظر السيرفر أثناء تسجيل الدخول الجماعي
    setTimeout(() => {
      new BotInstance(acc);
      console.log(`[حساب ${acc.id}] تم التشغيل بنجاح.`);
    }, Math.random() * 5000);
  } else {
    console.log(`[حساب ${acc.id}] متوقف (مضبوط على false).`);
  }
});
