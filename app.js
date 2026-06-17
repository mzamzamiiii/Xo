import 'dotenv/config';
import wolfjs from 'wolf.js';
import fs from 'fs';

const { WOLF } = wolfjs;
const client = new WOLF();

const ROOM_ID = 11194358;
const TARGET_USER_ID = 26491704;

client.on('ready', async () => {
  console.log('✅ Logged In');

  try {
    await client.messaging.sendGroupMessage(
      ROOM_ID,
      '!ج'
    );

    console.log('📤 Sent !ج');

  } catch (err) {
    console.error('❌ SEND ERROR');
    console.error(err);
  }
});

client.on('message', async (message) => {

  try {

    // تجاهل أي شيء ليس من الروم المطلوب
    if (!message.isGroup) return;
    if (message.groupId !== ROOM_ID) return;

    // تجاهل أي شخص غير العضوية المحددة
    if (message.senderId !== TARGET_USER_ID) return;

    console.log('\n========================');
    console.log('📩 MESSAGE FROM TARGET');
    console.log('========================');

    console.log('TYPE:', message.type);
    console.log('SENDER:', message.senderId);

    if (message.body) {
      console.log('BODY:', message.body);
    }

    if (message.image) {
      console.log('📷 IMAGE:');
      console.dir(message.image, { depth: 5 });
    }

    if (message.media) {
      console.log('🎞 MEDIA:');
      console.dir(message.media, { depth: 5 });
    }

    if (message.attachments) {
      console.log('📎 ATTACHMENTS:');
      console.dir(message.attachments, { depth: 5 });
    }

    // حفظ الرسالة في ملف
    fs.writeFileSync(
      'message.json',
      JSON.stringify(
        message,
        (key, value) => {
          if (key === 'client') return undefined;
          return value;
        },
        2
      )
    );

    console.log('✅ Saved message.json');

  } catch (err) {
    console.error('❌ MESSAGE ERROR');
    console.error(err);
  }

});

client.login(
  process.env.U_MAIL_1,
  process.env.U_PASS_1
);
