import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 22249609;        
const XO_BOT_ID = 82727814;      
const START_COMMAND = '!xo private ai 3';     

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let service = null;
let isBotReady = false;
let reconnecting = false;

// كود الفحص لمعرفة هيكلة رسالة اللعبة
service = new WOLF();

service.on('message', async (message) => {
  try {
    const senderId = Number(message.sourceSubscriberId);
    
    // فحص الرسائل القادمة من بوت الـ XO فقط
    if (!message.isGroup && senderId === XO_BOT_ID) {
      console.log('\n=================== 📥 رسالة جديدة من بوت اللعبة ===================');
      
      // 1. طباعة النص العادي المصاحب للرسالة
      console.log('📄 النص المستلم (body):', JSON.stringify(message.body || message.content));
      
      // 2. فحص الأزرار التفاعلية (Forms)
      if (message.form) {
        console.log('🔘 تم رصد أزرار تفاعلية (Form)! تفاصيل الأسطر والأزرار:');
        console.dir(message.form, { depth: null, colors: true });
      } else {
        console.log('🔘 لا توجد أزرار تفاعلية (Form) مباشرة في الرسالة.');
      }

      // 3. فحص الإضافات المدمجة الأخرى (Embeds / Metadata)
      if (message.embeds || message.attachments) {
        console.log('📦 ممتلكات إضافية مدمجة:');
        console.log('Embeds:', JSON.stringify(message.embeds));
        console.log('Attachments:', JSON.stringify(message.attachments));
      }

      console.log('==================================================================\n');

      // حركة تلقائية سريعة للحفاظ على استمرار الجولة أثناء الفحص
      const text = (message.body || message.content || '').toLowerCase();
      if (text.includes('your turn') || text.includes('دورك')) {
        // نلعب حركة عشوائية مؤقتاً لتستمر اللعبة ونلتقط الرسالة التالية
        const randomMove = (Math.floor(Math.random() * 9) + 1).toString();
        await sleep(1000);
        await service.messaging.sendPrivateMessage(XO_BOT_ID, randomMove);
        console.log(`🕹️ حركة تجريبية عشوائية للحفاظ على الجولة: [ ${randomMove} ]`);
      }

      if (text.includes('won') || text.includes('فاز') || text.includes('lost') || text.includes('خسارة') || text.includes('draw') || text.includes('تعادل')) {
        console.log('🏁 انتهت جولة الفحص، إعادة التشغيل بعد 5 ثوانٍ للاستمرار...');
        setTimeout(() => {
          service.messaging.sendGroupMessage(ROOM_ID, START_COMMAND);
        }, 5000);
      }
    }
  } catch (err) {
    console.log('❌ خطأ أثناء الفحص:', err.message);
  }
});

service.on('ready', async () => {
  console.log('🤖 كود التجسس والفحص جاهز ومتصل الآن!');
  isBotReady = true;
  reconnecting = false;
  await sleep(2000);
  await service.messaging.sendGroupMessage(ROOM_ID, START_COMMAND);
});

const restart = () => {
  if (reconnecting) return;
  reconnecting = true;
  setTimeout(() => {
    reconnecting = false;
    service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
  }, 5000);
};

service.on('error', restart);
service.on('disconnected', restart);
service.on('close', restart);

service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(restart);
