# إعداد تسجيل الدخول عبر Discord لموعد

تسجيل الدخول عبر Discord OAuth2؛ لا يحتاج المستخدم إلى أن يكون في سيرفر Discord محدد.

## إعداد Cloudflare Worker

في Cloudflare افتح **Workers & Pages → mawed-auth → Settings → Variables and Secrets** وتأكد من وجود:

- `DISCORD_CLIENT_ID` — OAuth2 Client ID.
- `DISCORD_CLIENT_SECRET` — OAuth2 Client Secret، كـ **Secret**.
- `SESSION_SECRET` — سر عشوائي طويل وفريد، كـ **Secret** (32 بايت عشوائية أو أكثر).
- `ALLOWED_ORIGIN` — `https://7hilal0.github.io`.

يجب أن يكون ربط D1 باسم `AUTH_DB` إلى قاعدة `mawed-auth-db` موجودًا. لا تغيّر أسرار أي Worker آخر.

## Discord OAuth2

في Discord Developer Portal → OAuth2 أضف Redirect URL:
`https://mawed-auth.gggy6vvv.workers.dev/auth/callback`

## نشر Worker من GitHub

يوجد سير عمل منفصل في `.github/workflows/worker.yml`. لا يعمل عند تعديل `index.html` فقط. بعد نشر الكود، يعيد تثبيت `SESSION_SECRET` من GitHub Actions Secrets.

أضف هذين السرّين فقط في المستودع `7hilal0/download-mp3` ضمن **Settings → Secrets and variables → Actions**:

- `CLOUDFLARE_API_TOKEN` — رمز Cloudflare بصلاحية **Workers Scripts: Edit** للحساب الصحيح.
- `MAWED_SESSION_SECRET` — نفس قيمة `SESSION_SECRET` التي تريد أن تبقى مستخدمة. احفظ قيمة عشوائية طويلة وفريدة في مدير كلمات مرور، وضعها في السرّين دون إرسالها في المحادثة.

معرّف الحساب موجود بالفعل في `wrangler.toml`. لا تضع أي سر في ملفات المشروع أو `wrangler.toml`.

بعد إضافة السرّين، افتح **Actions → Deploy Maw'ed Auth Worker → Run workflow**. سيُنشر Worker ثم يعاد تثبيت `SESSION_SECRET`. لا يعيد هذا السير كتابة `DISCORD_CLIENT_SECRET`، ولا يغيّر قاعدة D1.

تأكد من أن Worker لا يُنشر أيضًا من مسار آخر يغيّر إعداداته. اجعل سير العمل هذا هو مسار النشر الوحيد للـ Worker.
