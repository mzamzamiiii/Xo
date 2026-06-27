import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF: _WOLF } = wolfjs;

const MY_ACCOUNTS = [
  { id: 1, email: process.env.U_MAIL_1, pass: process.env.U_PASS_1, roomId: 22249609, enabled: false },
  { id: 2, email: process.env.U_MAIL_2, pass: process.env.U_PASS_2, roomId: 22249609, enabled: false },
  { id: 3, email: process.env.U_MAIL_3, pass: process.env.U_PASS_3, roomId: 22249609, enabled: false },
  { id: 4, email: process.env.U_MAIL_4, pass: process.env.U_PASS_4, roomId: 22249609, enabled: false },
  { id: 5, email: process.env.U_MAIL_5, pass: process.env.U_PASS_5, roomId: 22249609, enabled: false },
  { id: 6, email: process.env.U_MAIL_6, pass: process.env.U_PASS_6, roomId: 22249609, enabled: false },
  { id: 7, email: process.env.U_MAIL_7, pass: process.env.U_PASS_7, roomId: 22249609, enabled: false },
  { id: 8, email: process.env.U_MAIL_8, pass: process.env.U_PASS_8, roomId: 22249609, enabled: false },
  { id: 9, email: process.env.U_MAIL_9, pass: process.env.U_PASS_9, roomId: 22249609, enabled: false },
  { id: 10, email: process.env.U_MAIL_10, pass: process.env.U_PASS_10, roomId: 22249609, enabled: true },
  { id: 11, email: process.env.U_MAIL_11, pass: process.env.U_PASS_11, roomId: 22249609, enabled: false },
  { id: 12, email: process.env.U_MAIL_12, pass: process.env.U_PASS_12, roomId: 22249609, enabled: false }
];

const XO_BOT_ID = 82727814;
const START_COMMAND = '!xo private ai 3';
const WINNING_COMBOS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

class BotInstance {
  constructor(config) {
    this.config = config;
    this.service = new _WOLF();
    this.lastGameOverTime = 0;
    this.resetState();
    this.init();
  }

  // استخدام تأخير ثابت 400ms للحفاظ على السرعة والاستقرار
  sleep400() {
    return new Promise(resolve => setTimeout(resolve, 400));
  }

  resetState() {
    this.board = Array(9).fill(null);
    this.mySign = 'X';
    this.botSign = 'O';
    this.isProcessing = false;
    this.lastPlayedBoard = null; 
    this.gameActive = false;
  }

  init() {
    this.service.on('message', (msg) => this.handleIncomingData(msg));
    this.service.on('messageUpdate', (msg) => this.handleIncomingData(msg));
    
    this.service.on('ready', async () => {
      console.log(`[حساب ${this.config.id}] متصل وجاهز.`);
      await this.sleep400();
      this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
    });
    
    this.service.login(this.config.email, this.config.pass);
  }

  async handleIncomingData(message) {
    // معالجة الرسائل النصية من البوت (مثل: "1 has already been used")
    if (message.sourceSubscriberId === XO_BOT_ID && message.type === 'text/plain') {
      const body = message.body.toLowerCase();
      if (body.includes('already been used') || body.includes('not your turn')) {
        console.log(`[حساب ${this.config.id}] تنبيه: حركة متعارضة. جاري فك القفل لإعادة المحاولة...`);
        this.lastPlayedBoard = null; // فك القفل لكي يعيد قراءة اللوحة ويلعب من جديد
        return;
      }
    }

    if (message.type !== 'text/html') return;
    const html = message.body;
    const lowerHtml = html.toLowerCase();

    const isGameOver = lowerHtml.includes('rematch') || 
                       lowerHtml.includes('expires in') || 
                       lowerHtml.includes('tie') || 
                       lowerHtml.includes('won!') || 
                       lowerHtml.includes('lost!');
    
    if (isGameOver) {
      this.handleGameEnd();
      return;
    }

    if (lowerHtml.includes('your turn')) {
      this.gameActive = true;
      this.mySign = html.includes('(❌)') ? 'X' : 'O';
      this.botSign = this.mySign === 'X' ? 'O' : 'X';
      
      this.parseBoard(html);
      
      // تحويل حالة اللوحة الحالية إلى نص لمقارنتها
      const currentBoardStr = JSON.stringify(this.board);
      
      // نلعب فقط إذا كانت اللوحة مختلفة عن آخر مرة لعبنا فيها، وإذا لم نكن نلعب حالياً
      if (this.lastPlayedBoard !== currentBoardStr && !this.isProcessing) {
        this.triggerBotMove(currentBoardStr);
      }
    }
  }

  async handleGameEnd() {
    const now = Date.now();
    // نظام حماية: تجاهل أي رسائل نهاية لعبة مكررة تصل خلال 5 ثوانٍ من انتهاء اللعبة فعلياً
    if (now - this.lastGameOverTime < 5000) return;
    this.lastGameOverTime = now;
    
    // إيقاف أي حركات قيد الانتظار فوراً
    this.gameActive = false;
    
    console.log(`[حساب ${this.config.id}] نهاية اللعبة مؤكدة. تنظيف وبدء من جديد...`);
    
    await this.sleep400(); 
    this.resetState(); 
    
    try {
        await this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
    } catch (e) {
        console.error(`[حساب ${this.config.id}] خطأ في إرسال أمر البدء:`, e);
    }
  }

  parseBoard(html) {
    const blocks = html.split('xobot-mp-private__content__middle__position');
    if (blocks.length > 9) {
      for (let i = 0; i < 9; i++) {
        const block = blocks[i + 1];
        if (block.includes('❌') || block.includes('--x')) this.board[i] = 'X';
        else if (block.includes('⭕') || block.includes('--o')) this.board[i] = 'O';
        else this.board[i] = null;
      }
    }
  }

  minimax(board, depth, isMaximizing) {
    const winner = this.checkWinner(board);
    if (winner === this.mySign) return 10 - depth;
    if (winner === this.botSign) return depth - 10;
    if (!board.includes(null)) return 0;
    
    if (isMaximizing) {
      let bestScore = -Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = this.mySign;
          bestScore = Math.max(bestScore, this.minimax(board, depth + 1, false));
          board[i] = null;
        }
      }
      return bestScore;
    } else {
      let bestScore = Infinity;
      for (let i = 0; i < 9; i++) {
        if (board[i] === null) {
          board[i] = this.botSign;
          bestScore = Math.min(bestScore, this.minimax(board, depth + 1, true));
          board[i] = null;
        }
      }
      return bestScore;
    }
  }

  checkWinner(board) {
    for (let combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return null;
  }

  async triggerBotMove(currentBoardStr) {
    this.isProcessing = true;
    this.lastPlayedBoard = currentBoardStr; // قفل اللوحة الحالية لمنع اللعب عليها مرة أخرى

    await this.sleep400(); 
    
    // فحص مصيري: إذا انتهت اللعبة أثناء تأخير الـ 400ms، نلغي إرسال الحركة تماماً
    if (!this.gameActive) {
      this.isProcessing = false;
      return; 
    }
    
    let bestScore = -Infinity;
    let move = -1;
    
    // تحسين الأداء: إذا كانت اللوحة فارغة تماماً، العب في المنتصف فوراً دون حسابات معقدة
    const emptyCount = this.board.filter(c => c === null).length;
    if (emptyCount === 9) {
      move = 4;
    } else {
      for (let i = 0; i < 9; i++) {
        if (this.board[i] === null) {
          this.board[i] = this.mySign;
          let score = this.minimax(this.board, 0, false);
          this.board[i] = null;
          if (score > bestScore) {
            bestScore = score;
            move = i;
          }
        }
      }
    }
    
    if (move !== -1) {
      console.log(`[حساب ${this.config.id}] يرسل حركة: ${move + 1}`);
      try {
        await this.service.messaging.sendPrivateMessage(XO_BOT_ID, (move + 1).toString());
      } catch (e) {
        // في حال فشل الإرسال الشبكي، نفك القفل ليحاول البوت اللعب مجدداً
        this.lastPlayedBoard = null;
      }
    }

    await this.sleep400();
    this.isProcessing = false;
  }
}

(async () => {
  for (const acc of MY_ACCOUNTS) {
    if (acc.enabled) {
      new BotInstance(acc);
      await new Promise(resolve => setTimeout(resolve, 400));
    }
  }
})();
