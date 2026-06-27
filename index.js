import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const { WOLF: _WOLF } = wolfjs;

const MY_ACCOUNTS = [
  { id: 1, email: process.env.U_MAIL_1, pass: process.env.U_PASS_1, roomId: 22249609, enabled: true } 
  // أضف بقية الحسابات بنفس الطريقة
];

const XO_BOT_ID = 82727814;
const START_COMMAND = '!xo private ai 3';

class BotInstance {
  constructor(config) {
    this.config = config;
    this.service = new _WOLF();
    this.board = Array(9).fill(null);
    this.isProcessing = false;
    this.gameEnded = false;
    this.init();
  }

  init() {
    this.service.on('message', (msg) => this.handleIncomingData(msg));
    this.service.on('messageUpdate', (msg) => this.handleIncomingData(msg));
    this.service.on('ready', async () => {
      console.log(`[حساب ${this.config.id}] متصل. بدء اللعب...`);
      this.sendStartCommand();
    });
    this.service.login(this.config.email, this.config.pass);
  }

  // دالة إرسال أمر البدء مع تأخير بشري
  async sendStartCommand() {
    this.gameEnded = false;
    console.log(`[حساب ${this.config.id}] جاري إرسال طلب بدء لعبة جديدة...`);
    await this.service.messaging.sendGroupMessage(this.config.roomId, START_COMMAND);
  }

  // دالة توليد تأخير عشوائي (لمحاكاة البشر)
  async humanDelay(min = 3000, max = 7000) {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    console.log(`[حساب ${this.config.id}] أنتظر ${delay}ms قبل الحركة (تأخير بشري)...`);
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  async handleIncomingData(message) {
    if (message.type !== 'text/html') return;
    const html = message.body;

    // 1. اكتشاف نهاية اللعبة
    if ((html.includes('You Won!') || html.includes('You Lost!') || html.includes('Tie!') || html.includes('Rematch')) && !this.gameEnded) {
      this.gameEnded = true;
      console.log(`[حساب ${this.config.id}] اللعبة انتهت. استراحة قصيرة ثم البدء...`);
      setTimeout(() => this.sendStartCommand(), 5000); // انتظر 5 ثواني بعد نهاية اللعبة
      return;
    }

    // 2. معالجة الدور
    if (html.includes('Your Turn!')) {
      if (this.isProcessing) return;
      this.isProcessing = true;
      this.gameEnded = false;

      // استخراج الخانات المتاحة
      const availableMoves = [];
      const blocks = html.split('xobot-mp-private__content__middle__position');
      for (let i = 0; i < 9; i++) {
        const block = blocks[i + 1];
        if (block && !block.includes('❌') && !block.includes('⭕')) {
          availableMoves.push(i + 1);
        }
      }

      if (availableMoves.length > 0) {
        await this.humanDelay(); // التأخير البشري هنا
        const move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
        console.log(`[حساب ${this.config.id}] سألعب الرقم: ${move}`);
        await this.service.messaging.sendPrivateMessage(XO_BOT_ID, move.toString());
      }
      
      this.isProcessing = false;
    }
  }
}

MY_ACCOUNTS.forEach((acc) => {
  if (acc.enabled) new BotInstance(acc);
});
