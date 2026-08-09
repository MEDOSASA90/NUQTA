/**
 * فتح تقارير PDF بثقة على الموبايل.
 *
 * المشكلة: متصفحات الموبايل (Chrome/Safari) تحجب window.open إذا لم يحدث
 * «متزامنًا» داخل معالج ضغطة المستخدم — والفتح بعد await لاستجابة الخادم
 * يُعتبر غير مرتبط بالضغطة فيُحجب التبويب بصمت.
 *
 * الحل: نفتح تبويب الانتظار في نفس معالج الضغط (قبل أي await) ونكتب فيه
 * صفحة «جاري تجهيز التقرير…» بهوية التطبيق، وبعد اكتمال التوليد نوجّهه
 * إلى رابط الملف. ولو رجع window.open بـ null (محجوب أصلًا) تعرض الصفحات
 * واجهة احتياطية دائمة برابط فتح/تحميل يضغطه المستخدم بنفسه.
 */

/** صفحة انتظار خفيفة بهوية التطبيق — تُكتب في التبويب الجديد فور فتحه */
const WAITING_PAGE_HTML = `<!doctype html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>جاري تجهيز التقرير… — أفراح الجمعية</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #F6F1E7; color: #3B3226; padding: 24px;
    font-family: "Segoe UI", Tahoma, "Noto Kufi Arabic", sans-serif;
  }
  .card {
    width: 100%; max-width: 360px; text-align: center;
    background: #FBF5E6; border: 1.5px solid #C29B3C; border-radius: 14px;
    padding: 36px 24px; box-shadow: 0 10px 30px rgba(59, 50, 38, .12);
  }
  .brand { font-size: 13px; font-weight: 600; color: #A8842C; letter-spacing: .3px; }
  .spinner {
    width: 44px; height: 44px; margin: 22px auto 18px;
    border: 4px solid #F5EBCE; border-top-color: #C29B3C; border-radius: 50%;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  h1 { font-size: 17px; font-weight: 700; }
  p { margin-top: 8px; font-size: 12.5px; line-height: 1.9; color: #75695A; }
</style>
</head>
<body>
  <div class="card">
    <div class="brand">أفراح الجمعية — دفتر النقوط الرقمي</div>
    <div class="spinner" role="progressbar" aria-label="جاري التجهيز"></div>
    <h1>جاري تجهيز التقرير…</h1>
    <p>بنجهّز كشف حساب PDF الرسمي — لحظات ويظهر هنا في نفس التبويب.<br>لو طالت كتير ارجع للتطبيق وجرّب تاني.</p>
  </div>
</body>
</html>`

export type ReportTabHandle = Window | null

/**
 * يفتح تبويب انتظار — يجب استدعاؤه متزامنًا من معالج الضغط نفسه (قبل أي await)
 * حتى لا تحجبه متصفحات الموبايل. يرجع null لو التبويب محجوب.
 */
export function openReportWaitingTab(): ReportTabHandle {
  let win: Window | null = null
  try {
    win = window.open('', '_blank')
  } catch {
    win = null
  }
  if (win) {
    try {
      win.document.open()
      win.document.write(WAITING_PAGE_HTML)
      win.document.close()
    } catch {
      /* بعض المتصفحات تمنع الكتابة — التوجيه اللاحق يكفي */
    }
  }
  return win
}

/** رابط مطلق لملف التقرير — آمن للتوجيه من تبويب about:blank */
export function absoluteReportUrl(fileUrl: string): string {
  return new URL(fileUrl, window.location.origin).href
}

/**
 * توجيه تبويب الانتظار إلى ملف التقرير بعد نجاح التوليد.
 * يرجع false لو التبويب محجوب/أُغلق — عندها تُعرض الواجهة الاحتياطية.
 */
export function deliverReportToTab(win: ReportTabHandle, fileUrl: string): boolean {
  if (!win) return false
  try {
    if (win.closed) return false
    win.location.href = absoluteReportUrl(fileUrl)
    return true
  } catch {
    return false
  }
}

/** يغلق تبويب الانتظار عند فشل التوليد حتى لا يبقى معلقًا على صفحة الانتظار */
export function abortReportTab(win: ReportTabHandle): void {
  try {
    if (win && !win.closed) win.close()
  } catch {
    /* تجاهل */
  }
}

/** اسم ملف عربي منطقي للتحميل عبر سمة download */
export function reportDownloadName(hostName: string | null | undefined, reportId: number): string {
  const host = (hostName ?? '').trim().replace(/[\\/:*?"<>|]/g, '')
  return host ? `كشف-حساب-فرحة-${host}.pdf` : `تقرير-${reportId}.pdf`
}
