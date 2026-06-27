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
    this.resetState();
    this.init();
  }

  randomSleep(min, max) {
    return new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));
  }

  resetState() {
    this.board = Array(9).fill(null);
    this.mySign = 'X';
    this.botSign = 'O';
    this.isRestarting = false;
    this.isThinking = false;
    this.lastPlayedTurnCount = -1; // تتبع عدد المربعات المشغولة لمنع تكرار اللعب في نفس الدور
  }

  init() {
    this.service.on('message', (msg) => this.handleIncomingData(msg));
    this.service.on('messageUpdate', (msg) => this.handleIncomingData(msg));
    
    this.service.on('ready', async () => {
      console.log(`[حساب ${this.config.id}] متصل وجاهز.`);
      await this.randomSleep(3000, 6000);
      this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
    });
    
    this.service.login(this.config.email, this.config.pass);
  }

  handleIncomingData(message) {
    if (message.type !== 'text/html') return;
    const html = message.body;
    const lowerHtml = html.toLowerCase();

    // فحص نهاية اللعبة بشكل مرن وصارم جداً بناءً على الصور المرفقة
    const isGameOver = lowerHtml.includes('rematch') || 
                      lowerHtml.includes('expires in') || 
                      lowerHtml.includes('tie') || 
                      lowerHtml.includes('won!') || 
                      lowerHtml.includes('lost!');
    
    if (isGameOver) {
      this.handleGameEnd();
      return;
    }

    // تحديث اللوحة في كل تحديث يصل دون شروط حظر مسبقة
    this.parseBoard(html);

    // إذا كان دورنا
    if (lowerHtml.includes('your turn')) {
      this.mySign = html.includes('(❌)') ? 'X' : 'O';
      this.botSign = this.mySign === 'X' ? 'O' : 'X';
      
      // حساب المربعات المشغولة حالياً باللوحة
      const occupiedSpots = this.board.filter(c => c !== null).length;
      
      // نلعب فقط إذا لم نكن في حالة تفكير، ولم نقم باللعب في هذا الدور المليء مسبقاً
      if (!this.isThinking && occupiedSpots !== this.lastPlayedTurnCount) {
        this.triggerBotMove(occupiedSpots);
      }
    }
  }

  async handleGameEnd() {
    if (this.isRestarting) return;
    this.isRestarting = true;
    
    console.log(`[حساب ${this.config.id}] نهاية اللعبة مؤكدة. تنظيف وبدء جديد...`);
    
    // مؤقت أمان كلي لإعادة تصفير القفل تلقائياً بعد 30 ثانية مهما حدث
    const safetyTimer = setTimeout(() => { this.isRestarting = false; }, 30000);

    // وقت انتظار بشري عشوائي وممتاز قبل طلب مباراة جديدة (بين 5 إلى 8 ثوانٍ)
    await this.randomSleep(5000, 8000);
    
    this.resetState(); 
    
    try {
        await this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
        console.log(`[حساب ${this.config.id}] تم إرسال أمر البدء الجديد بنجاح.`);
    } catch (e) {
        console.error(`[حساب ${this.config.id}] خطأ أثناء محاولة البدء:`, e);
    }
    
    clearTimeout(safetyTimer);
    this.isRestarting = false;
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

  async triggerBotMove(occupiedSpots) {
    this.isThinking = true;
    this.lastPlayedTurnCount = occupiedSpots; 

    // محاكاة التفكير البشري الطبيعي (بين 1.5 إلى 3 ثوانٍ) قبل اختيار الحركة
    await this.randomSleep(1500, 3000); 
    
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
      console.log(`[حساب ${this.config.id}] جاري إرسال حركة: ${move + 1}`);
      try {
        await this.service.messaging.sendPrivateMessage(XO_BOT_ID, (move + 1).toString());
      } catch (e) {
        console.error(`[حساب ${this.config.id}] تعذر إرسال الحركة:`, e);
        this.lastPlayedTurnCount = -1; // تصفير القفل في حال حدوث خطأ شبكة للتعويض
      }
    }

    // انتظار بشري خفيف بعد الإرسال للتأكد من استقرار اللوحة
    await this.randomSleep(800, 1500);
    this.isThinking = false;
  }
}

(async () => {
  for (const acc of MY_ACCOUNTS) {
    if (acc.enabled) {
      new BotInstance(acc);
      await new Promise(resolve => setTimeout(resolve, 4000));
    }
  }
})();
