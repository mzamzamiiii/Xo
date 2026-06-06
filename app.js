import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL,
    secret: process.env.U_PASS,
    targetBotId: 39369782 , 
    actionWord: "!اسرق 5",
    delayBetweenHeists: 11000,      // 11 ثانية فاصل بين الصيد
    workDuration: 54 * 60 * 1000,   // 54 دقيقة عمل
    restDuration: 6 * 60 * 1000     // 6 دقائق راحة
};

const service = new WOLF();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let heistQueue = [];
let isProcessing = false;
let isResting = false;

// دالة معالجة الطابور مع نظام فحص التوافق التلقائي
const processQueue = async () => {
    if (isProcessing || heistQueue.length === 0 || isResting) return;

    isProcessing = true;

    while (heistQueue.length > 0 && !isResting) {
        const roomId = heistQueue.shift();
        
        console.log(`⏳ انتظار الاستراحة بين الصيد... الروم: ${roomId}`);
        await sleep(settings.delayBetweenHeists);

        if (isResting) {
            heistQueue.unshift(roomId); 
            break;
        }

        try {
            // نظام فحص إصدار المكتبة للانضمام للروم
            if (service.groups && typeof service.groups.join === 'function') {
                await service.groups.join(roomId).catch(() => {});
            } else if (service.group && typeof service.group.join === 'function') {
                await service.group.join(roomId).catch(() => {});
            } else if (typeof service.joinGroup === 'function') {
                await service.joinGroup(roomId).catch(() => {});
            }

            // إرسال رسالة الصيد
            await service.messaging.sendGroupMessage(roomId, settings.actionWord);
            console.log(`🚀 [${new Date().toLocaleTimeString('ar-SA')}] تم الصيد في [${roomId}]. المتبقي في الطابور: ${heistQueue.length}`);
        } catch (err) {
            console.error(`❌ فشل الصيد في الروم ${roomId}: ${err.message}`);
        }
    }

    isProcessing = false;
};

// نظام إدارة الوقت (54/6)
const manageWorkCycle = async () => {
    while (true) {
        console.log("🟢 [نظام الوقت] بدأت دورة الـ 54 دقيقة عمل.");
        isResting = false;
        processQueue(); 

        await sleep(settings.workDuration);

        console.log("🛑 [نظام الوقت] بدأت دورة الـ 6 دقائق راحة. يتوقف الصيد مؤقتاً.");
        isResting = true;
        
        await sleep(settings.restDuration);
    }
};

service.on('ready', () => {
    console.log(`✅ البوت متصل بنجاح: ${service.currentSubscriber.nickname}`);
    manageWorkCycle(); 
});

service.on('message', async (message) => {
    if (!message.isGroup &&
        (message.sourceSubscriberId === settings.targetBotId ||
         message.authorId === settings.targetBotId)) {

        const content =
            message.body ||
            message.content ||
            message.text ||
            message.message ||
            "";

        console.log("الرسالة المستلمة:", content);

        const matches = [...content.matchAll(/\(([^)]*)\)/g)];

        let roomId = null;

        for (const m of matches) {
            const digits = m[1].replace(/\D/g, '');

            // نفترض أن رقم القناة طويل بينما رقم المستخدم أقصر
            if (digits.length >= 6) {
                roomId = parseInt(digits, 10);
                break;
            }
        }

        if (roomId) {
            console.log(`📥 إضافة الروم ${roomId} إلى الطابور`);

            heistQueue.push(roomId);

            if (!isResting) {
                processQueue();
            } else {
                console.log(
                    `⏳ استراحة حالياً. سيتم معالجة الروم ${roomId} فور العودة للعمل.`
                );
            }
        } else {
            console.log("⚠️ لم يتم العثور على رقم قناة داخل الرسالة");
        }
    }
});

service.login(settings.identity, settings.secret);
