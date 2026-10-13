# إعداد تسجيل الدخول عبر Discord لموعد

تسجيل الدخول أصبح عبر **Discord OAuth2**، لذلك لا يحتاج البحث عن المستخدم في سيرفر محدد أو إدخال `DISCORD_GUILD_ID`. المستخدم يسجل الدخول بحسابه الرسمي، سواء كان في سيرفر واحد أو عدة سيرفرات.

## إعداد Cloudflare Worker

في Cloudflare افتح **Workers & Pages → mawed-auth → Settings → Variables and Secrets** وأضف القيم التالية:

- `DISCORD_CLIENT_ID` — OAuth2 Client ID من Discord Developer Portal.
- `DISCORD_CLIENT_SECRET` — OAuth2 Client Secret، كـ **Secret**.
- `SESSION_SECRET` — سر عشوائي طويل وفريد، كـ **Secret** (32 بايت عشوائية أو أكثر).
- `ALLOWED_ORIGIN` — `https://7hilal0.github.io`.

يجب أن يكون ربط D1 باسم `AUTH_DB` إلى قاعدة `mawed-auth-db` موجودًا بالفعل. لا تغيّر أسرار أي Worker آخر.

## إعداد Discord Developer Portal

1. افتح تطبيق البوت في Discord Developer Portal.
2. من **OAuth2 → General** أضف Redirect URL التالي بالضبط، مع استبدال اسم المضيف إذا كان عنوان Worker لديك مختلفًا:
   `https://mawed-auth.gggy6vvv.workers.dev/auth/callback`
3. احفظ التغييرات، واستخدم Client ID وClient Secret للتطبيق نفسه.

## الاختبار

- افتح `https://7hilal0.github.io/download-mp3/`.
- اضغط زر الدخول عبر Discord.
- بعد موافقة Discord يجب أن تعود للموقع وتظهر حالة الحساب.

نقطة البداية في Worker هي `GET /auth/login`، والعودة `GET /auth/callback`، والتحقق من الجلسة `GET /auth/me`.

## ملاحظات أمان وحالة المشروع

- لا تضع Client Secret أو Session Secret داخل `index.html` أو GitHub.
- رمز الجلسة صالح لمدة 7 أيام ويُحفظ محليًا في المتصفح؛ تسجيل الخروج من الزر يمسح الرمز من هذا المتصفح.
- OAuth2 يثبت هوية حساب Discord، لكنه لا يعني أن البوت انضم تلقائيًا لكل سيرفر. لكي تعمل أوامر البوت في سيرفر، يجب أن يدعوه مسؤول ذلك السيرفر. يجب أن تعتمد أوامر البوت على `guild_id` الخاص بكل تفاعل بدل تثبيت معرّف سيرفر واحد.
- قاعدة البيانات تستخدم جدول `auth_codes` الموجود لتخزين حالات OAuth مؤقتًا، وجدول `auth_rate` موجود للاستخدام المستقبلي. لا يلزم إضافة جدول جديد لهذه الخطوة.
- يلزم اختبار النشر الفعلي في Cloudflare بعد إضافة الأسرار؛ وجود التعديلات في GitHub وحده لا يثبت أن Worker نُشر بنجاح.
