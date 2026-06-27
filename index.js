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
    this.board = Array(9).fill(null);
    this.mySign = 'X';
    this.botSign = 'O';
    
    // إضافات النظام الجديد
    this.moveQueue = []; 
    this.lastSentMove = null; // لمراقبة نجاح الحركة
    this.isProcessingQueue = false;
    this.isRestarting = false;
    
    this.init();
  }

  async sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  init() {
    this.service.on('message', (msg) => this.handleIncomingData(msg));
    this.service.on('messageUpdate', (msg) => this.handleIncomingData(msg));
    this.service.on('ready', async () => {
      console.log(`[حساب ${this.config.id}] متصل!`);
      await this.sleep(3000);
      this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
    });
    this.service.login(this.config.email, this.config.pass);
  }

  // نظام الطابور (Queue System)
  addToQueue(moveIndex) {
    this.moveQueue.push(moveIndex);
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessingQueue || this.moveQueue.length === 0) return;
    
    this.isProcessingQueue = true;
    const moveIndex = this.moveQueue.shift();
    
    try {
      console.log(`[حساب ${this.config.id}] جاري إرسال الحركة: ${moveIndex + 1}`);
      await this.service.messaging.sendPrivateMessage(XO_BOT_ID, (moveIndex + 1).toString());
      this.lastSentMove = moveIndex; // تسجيل الحركة للمراقبة
      
      // الالتزام بـ 400ms كحد أدنى لضمان الاستقرار
      await this.sleep(400); 
    } catch (err) {
      console.error(`[حساب ${this.config.id}] خطأ في الإرسال:`, err);
    } finally {
      this.isProcessingQueue = false;
      // استدعاء المعالجة التالية إذا وجد شيء في الطابور
      if (this.moveQueue.length > 0) this.processQueue();
    }
  }

  handleIncomingData(message) {
    try {
      if (message.type !== 'text/html') return;
      const html = message.body;

      // تحديث حالة اللوحة
      this.parseBoard(html);

      // التحقق من وصول الحركة السابقة
      if (this.lastSentMove !== null && this.board[this.lastSentMove] !== null) {
        console.log(`[حساب ${this.config.id}] تم التحقق: الحركة ${this.lastSentMove + 1} وصلت للسيرفر.`);
        this.lastSentMove = null;
      }

      const isGameOver = html.includes('You Won!') || html.includes('You Lost!') || html.includes('Tie!') || html.includes('Rematch');
      if (isGameOver && !this.isRestarting) {
        this.isRestarting = true;
        setTimeout(async () => {
          this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
          this.isRestarting = false;
          this.board = Array(9).fill(null);
          this.lastSentMove = null;
        }, 5000); 
        return;
      }

      if (html.includes('Your Turn!')) {
        // نمنع إرسال حركة جديدة إذا كانت هناك حركة معلقة في التحقق
        if (this.lastSentMove !== null) return; 

        this.mySign = html.includes('(❌)') ? 'X' : 'O';
        this.botSign = this.mySign === 'X' ? 'O' : 'X';
        
        this.triggerBotMove();
      }
    } catch (error) {
      console.error(`[خطأ في حساب ${this.config.id}]:`, error);
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

  async triggerBotMove() {
    // زيادة عشوائية بسيطة لتجنب الأنماط المتكررة
    await this.sleep(Math.random() * 500); 
    
    let bestScore = -Infinity;
    let move = -1;

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

    if (move !== -1) {
      this.addToQueue(move);
    }
  }
}

(async () => {
  for (const acc of MY_ACCOUNTS) {
    if (acc.enabled) {
      new BotInstance(acc);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
})();
