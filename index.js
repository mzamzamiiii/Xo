// 1. استيراد المكتبات الأساسية لعمل البوت
import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF: _WOLF } = wolfjs;

// 2. قائمة الحسابات: تم ضبط enabled: false للجميع ما عدا الحساب رقم 10
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
  { id: 10, email: process.env.U_MAIL_10, pass: process.env.U_PASS_10, roomId: 22249609, enabled: true }, // الحساب الوحيد المفعل
  { id: 11, email: process.env.U_MAIL_11, pass: process.env.U_PASS_11, roomId: 22249609, enabled: false },
  { id: 12, email: process.env.U_MAIL_12, pass: process.env.U_PASS_12, roomId: 22249609, enabled: false }
];

const XO_BOT_ID = 82727814;
const START_COMMAND = '!xo private ai 3';
const WINNING_COMBOS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

// 3. فئة (Class) البوت: تحتوي على كل منطق اللعب
class BotInstance {
  constructor(config) {
    this.config = config;
    this.service = new _WOLF();
    this.board = Array(9).fill(null);
    this.mySign = 'X';
    this.botSign = 'O';
    this.isProcessingMove = false;
    this.isRestarting = false; 
    this.init();
  }

  // دالة مساعدة لتأخير الحركة (لمنع كشف البوت)
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 4. دالة التهيئة والاتصال
  init() {
    this.service.on('message', (msg) => this.handleIncomingData(msg));
    this.service.on('messageUpdate', (msg) => this.handleIncomingData(msg));
    this.service.on('ready', async () => {
      console.log(`[حساب ${this.config.id}] متصل!`);
      await this.sleep(Math.random() * 3000 + 2000); 
      this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
    });
    this.service.login(this.config.email, this.config.pass);
  }

  // 5. استقبال البيانات وتحليلها
  handleIncomingData(message) {
    if (message.type !== 'text/html') return;
    const html = message.body;

    // اكتشاف نهاية اللعبة وإعادة التشغيل تلقائياً
    const isGameOver = html.includes('You Won!') || html.includes('You Lost!') || html.includes('Tie!') || html.includes('Rematch');
    if (isGameOver && !this.isRestarting) {
      console.log(`[حساب ${this.config.id}] انتهت اللعبة. جاري البدء من جديد...`);
      this.isRestarting = true;
      setTimeout(async () => {
        this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
        this.isRestarting = false;
        this.board = Array(9).fill(null);
      }, 5000);
      return;
    }

    // معالجة الدور عندما يكون الدور علي
    if (html.includes('Your Turn!')) {
      this.isRestarting = false;
      this.parseBoard(html);
      
      if (this.isProcessingMove) return;
      this.isProcessingMove = true;
      
      this.mySign = html.includes('(❌)') ? 'X' : 'O';
      this.botSign = this.mySign === 'X' ? 'O' : 'X';
      
      this.triggerBotMove();
    }
  }

  // 6. قراءة اللوحة من الـ HTML الخاص باللعبة
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

  // 7. تنفيذ الحركة المختارة
  async triggerBotMove() {
    await this.sleep(Math.random() * 3000 + 3000); // تأخير بشري
    const moveIndex = this.getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      console.log(`[حساب ${this.config.id}] سألعب الرقم: ${moveIndex + 1}`);
      await this.service.messaging.sendPrivateMessage(XO_BOT_ID, (moveIndex + 1).toString());
    }
    this.isProcessingMove = false;
  }

  // 8. الذكاء الاصطناعي (منطق اللعب)
  getBestMove() {
    const empty = this.board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
    if (empty.length === 0) return -1;
    
    // منطق الهجوم (البحث عن فوز)
    for (let combo of WINNING_COMBOS) {
        let e = combo.filter(i => this.board[i] === null);
        let m = combo.filter(i => this.board[i] === this.mySign);
        if (m.length === 2 && e.length === 1) return e[0];
    }
    
    // منطق الدفاع (سد طريق الخصم)
    for (let combo of WINNING_COMBOS) {
        let e = combo.filter(i => this.board[i] === null);
        let b = combo.filter(i => this.board[i] === this.botSign);
        if (b.length === 2 && e.length === 1) return e[0];
    }

    // الاستراتيجية: المركز ثم الزوايا
    if (this.board[4] === null) return 4;
    const corners = [0, 2, 6, 8];
    const availableCorners = corners.filter(c => empty.includes(c));
    if (availableCorners.length > 0) return availableCorners[0];

    return empty[0];
  }
}

// 9. تشغيل الحسابات المفعلة فقط
MY_ACCOUNTS.forEach((acc) => {
  if (acc.enabled) new BotInstance(acc);
});
