# إعداد مشروع موعد (Maw'ed)

المشروع موجود في مستودع واحد: `7hilal0/download-mp3`.

## الملفات
- `index.html`: واجهة الموقع على GitHub Pages.
- `cloudflare/mawed-auth-worker.js`: Worker للتحقق عبر رسائل Discord الخاصة.
- `cloudflare/mawed-auth-schema.sql`: مخطط قاعدة D1.
- `wrangler.toml`: إعداد نشر Worker وربط D1.
- `package.json`: أدوات النشر.

## النشر
- موقع الواجهة: GitHub Pages.
- خدمة API: Cloudflare Worker باسم `mawed-auth`.
- قاعدة البيانات: D1 باسم `mawed-auth-db` مع binding اسمه `AUTH_DB`.

لا تنشر الجذر كموقع Pages داخل Worker. إعداد Wrangler يستخدم الملف `cloudflare/mawed-auth-worker.js`.

## متغيرات Worker المطلوبة
Secrets (أضفها من Cloudflare Settings → Variables and Secrets، ولا تضعها في GitHub):
- `DISCORD_BOT_TOKEN`: توكن تطبيق Maw'ed فقط.
- `CODE_PEPPER`: سر عشوائي طويل.
- `RATE_LIMIT_SALT`: سر عشوائي طويل ومختلف عن CODE_PEPPER.

Plain-text variables:
- `DISCORD_GUILD_IDS`: معرّفات كل سيرفرات Discord التي تريد أن يعمل البوت فيها، مفصولة بفواصل، مثل `111111111111111111,222222222222222222`. استبدلها بمعرّفاتك الحقيقية؛ لا تستخدم المثال.
- `ALLOWED_ORIGIN`: `https://7hilal0.github.io` (origin فقط، بلا `/download-mp3`).

## دعم عدة سيرفرات
1. أضف تطبيق Maw'ed إلى كل سيرفر مستهدف.
2. امنح البوت الصلاحيات اللازمة لعرض/البحث عن الأعضاء وإرسال الرسائل الخاصة.
3. ضع معرّفات السيرفرات في `DISCORD_GUILD_IDS`، مفصولة بفواصل.
4. إذا كان اسم المستخدم يطابق أكثر من حساب، سيرفض النظام المطابقة بدل إرسال كود للحساب الخطأ.
5. إضافة السيرفرات إلى المتغير لا تدعو البوت تلقائيًا إليها؛ يجب إضافته يدويًا إلى كل سيرفر.

## قاعدة البيانات
نفّذ `cloudflare/mawed-auth-schema.sql` مرة واحدة في D1. لا تستخدم قاعدة DZCORE أو قاعدة أي مشروع آخر.

## حدود مهمة
- لا تضع أي توكن في `index.html` أو ملفات GitHub.
- تدفق التحقق يرسل رمزًا لمرة واحدة صالحًا لخمس دقائق.
- التحقق الحالي لا ينشئ جلسة دخول دائمة. يلزم تنفيذ جلسة موقعة آمنة قبل وصف الموقع بأنه يملك تسجيل دخول كاملًا.
- يجب ربط الواجهة بعنوان Worker الحقيقي واختبار الطلبات بعد النشر.
