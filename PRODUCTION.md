# تشغيل NUQTA في الإنتاج

## الحالة الحالية

- قاعدة TiDB الفعلية تم تجهيزها وإنشاء الجداول والبيانات التجريبية فيها.
- `npm run check` ناجح.
- `npm run lint` ناجح.
- اختبارات الوحدة موجودة وتُشغّل بواسطة `npm test -- --run`.
- صفحة الدخول تستخدم مصادقة محلية بدون عرض حسابات تجريبية.
- أُضيف endpoint للفحص: `GET /api/health`.
- أُضيف تسجيل أخطاء آمن بدون كلمات مرور أو بيانات جلسات.

## متغيرات Vercel المطلوبة

```text
DATABASE_URL
APP_SECRET
APP_ID
OWNER_UNION_ID
NODE_ENV=production
CRON_SECRET
```

لا تضع أيًا من هذه القيم في GitHub أو داخل ملفات المشروع.

## النسخ الاحتياطي

Workflow `Daily database backup` يحتاج Secrets التالية في GitHub:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`: بيانات اتصال TiDB منفصلة.
- `BACKUP_KEY`: قيمة عشوائية طويلة لتشفير النسخة.

النسخ تُحفظ كـ GitHub Actions artifact مشفّر لمدة 30 يومًا.

## اختبارات الخدمات الخارجية

اختبار TiDB يتم عبر `/api/health`. اختبار WhatsApp الحقيقي يحتاج `WHATSAPP_TOKEN` و`WHATSAPP_PHONE_ID` وWebhook عام من Meta. اختبار OTP الحقيقي يحتاج مزود SMS أو WhatsApp؛ بدون بيانات المزود يظل الاختبار محاكاة محلية.
