import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
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
    this.isProcessingMove = false;
    this.init();
  }

  init() {
    this.service.on('message', (msg) => this.handleIncomingData(msg));
    this.service.on('ready', async () => {
      console.log(`[حساب ${this.config.id}] متصل!`);
      this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
    });
    this.service.login(this.config.email, this.config.pass);
  }

  handleIncomingData(message) {
    if (message.type !== 'text/html') return;
    const html = message.body;

    if (html.includes('Your Turn!')) {
      this.parseBoard(html);
      
      // ميزة التشخيص: طباعة اللوحة التي يراها البوت
      console.log(`[حساب ${this.config.id}] اللوحة الحالية التي يراها البوت:`);
      console.log(`| ${this.board[0]||1} | ${this.board[1]||2} | ${this.board[2]||3} |`);
      console.log(`| ${this.board[3]||4} | ${this.board[4]||5} | ${this.board[5]||6} |`);
      console.log(`| ${this.board[6]||7} | ${this.board[7]||8} | ${this.board[8]||9} |`);

      if (this.isProcessingMove) return;
      this.isProcessingMove = true;
      
      // تحديد الرموز
      this.mySign = html.includes('(❌)') ? 'X' : 'O';
      this.botSign = this.mySign === 'X' ? 'O' : 'X';
      
      this.triggerBotMove();
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

  async triggerBotMove() {
    const moveIndex = this.getBestMove();
    if (moveIndex !== undefined && moveIndex !== -1) {
      console.log(`[حساب ${this.config.id}] سألعب الرقم: ${moveIndex + 1}`);
      await this.service.messaging.sendPrivateMessage(XO_BOT_ID, (moveIndex + 1).toString());
    }
    this.isProcessingMove = false;
  }

  getBestMove() {
    const available = this.board.map((val, idx) => val === null ? idx : null).filter(val => val !== null);
    if (available.length === 0) return -1;
    
    // منطق فوز بسيط
    for (let combo of WINNING_COMBOS) {
        let empty = combo.filter(i => this.board[i] === null);
        let my = combo.filter(i => this.board[i] === this.mySign);
        if (my.length === 2 && empty.length === 1) return empty[0];
    }
    
    // الدفاع
    for (let combo of WINNING_COMBOS) {
        let empty = combo.filter(i => this.board[i] === null);
        let bot = combo.filter(i => this.board[i] === this.botSign);
        if (bot.length === 2 && empty.length === 1) return empty[0];
    }

    return available[Math.floor(Math.random() * available.length)];
  }
}

MY_ACCOUNTS.forEach((acc) => {
  if (acc.enabled) new BotInstance(acc);
});
