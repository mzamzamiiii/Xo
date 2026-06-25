import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const service = new WOLF();

const XO_BOT_ID = 82727814; 

console.log('🔍 تشغيل كود الكشاف... بانتظار رسائل بوت XO');

// التنصت على الرسائل الجديدة
service.on('message', async (message) => {
  const senderId = Number(message.sourceSubscriberId);
  
  if (senderId === XO_BOT_ID) {
    console.log('\n\n📥 ======= [ رسالة جديدة من بوت XO ] =======');
    // طباعة الكائن بالكامل بتنسيق JSON مرتب
    console.log(JSON.stringify(message, null, 2));
    console.log('==============================================\n\n');
  }
});

// التنصت على تحديثات الرسائل (لأن بعض الألعاب تتحدث بنفس الرسالة)
service.on('messageUpdate', async (message) => {
  const senderId = Number(message.sourceSubscriberId);
  
  if (senderId === XO_BOT_ID) {
    console.log('\n\n🔄 ======= [ تحديث رسالة من بوت XO ] =======');
    console.log(JSON.stringify(message, null, 2));
    console.log('==============================================\n\n');
  }
});

service.on('ready', () => {
  console.log('✅ البوت متصل الآن. اذهب إلى تطبيق Wolf وابدأ لعبة XO مع البوت لتسجيل البيانات...');
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(err => {
  console.error('❌ خطأ في تسجيل الدخول:', err.message);
});
