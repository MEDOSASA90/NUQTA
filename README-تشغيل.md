# نظام «أفراح الجمعية» — دليل التشغيل والرفع على السيرفر

PWA عربي RTL بالكامل (React 19 + Vite + tRPC + Hono + Drizzle + MySQL) — multi-tenant SaaS لإدارة نقوط الأفراح.

## التشغيل محليًا
```bash
npm install
cp .env.example .env   # أو استخدم .env المرفق في بيئة التطوير
npm run db:push        # إنشاء الجداول في MySQL
npx tsx db/seed.ts     # بيانات تجريبية (اختياري)
npm run dev            # http://localhost:3000
```

## الرفع للإنتاج
```bash
npm run build          # يبني الواجهة + الخادم في dist/
npm start              # يشغّل خادم الإنتاج على المنفذ 3000
```

### متغيرات البيئة المطلوبة (.env)
| المتغير | الوصف |
|---|---|
| `DATABASE_URL` | رابط MySQL (مطلوب) |
| `APP_ID`, `APP_SECRET`, `KIMI_AUTH_URL`, `KIMI_OPEN_URL`, `OWNER_UNION_ID`, `VITE_APP_ID`, `VITE_KIMI_AUTH_URL` | تسجيل الدخول (Kimi OAuth) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID` | (اختياري) WhatsApp Cloud API — بدونهما يعمل النظام في وضع «محاكاة» ويسجل الرسائل داخليًا |
| `CRON_SECRET` | (اختياري) حماية نقطة التذكيرات اليومية |

## نقاط النهاية الخاصة
- `GET /api/cron/daily-reminders` — التذكيرات اليومية (النظام أ، 3 أيام قبل الفرح). اربطها بـ cron يومي: `curl -H "x-cron-secret: $CRON_SECRET" https://your-domain/api/cron/daily-reminders`
- `GET/POST /api/whatsapp/webhook` — Webhook بوت الاستعلام الذاتي (النظام ج). اضبطه في لوحة Meta للواتساب. الصوتيات تُعالج عبر التفريغ النصي المرفق.
- `GET /api/reports/file/:id` — تحميل تقارير PDF (يتطلب تسجيل دخول).
- `/w/:token` — صفحة كشف حساب صاحب الفرح العامة (read-only، بدون تسجيل دخول).

## ما تم تسليمه
- 10 صفحات كاملة: لوحة التحكم، تسجيل نقطة (بحث ذكي + معاينة سداد حية)، الأفراح وتفاصيلها، الأشخاص وبطاقاتهم، الأرصدة الثنائية (علامات / + drill-down + حالات صفا/جزئي/زيادة)، واتساب (سجل + إعدادات + محاكاة بوت + صوتيات)، سجل التدقيق (حبر أحمر لما بعد الفرح)، التقارير (PDF بغلاف + فهرس مناطق بروابط داخلية + صفحة لكل منطقة، عربي مشكّل بخط Amiri)، صفحة صاحب الفرح العامة، الإعدادات.
- Backend كامل: 8 جداول، 9 tRPC routers، منطق أرصدة/سداد مختبَر (41 اختبار unit ناجح)، خدمة واتساب بطبقة Cloud API + محاكاة، بوت عامية مصرية (أوامر + كتابة حرة)، توليد PDF عربي.
- PWA: manifest عربي + service worker + أيقونات.
