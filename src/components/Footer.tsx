/**
 * تذييل التطبيق — فاصل زخرفي + سطر حقوق هادئ + توقيع رقعة احتفالي.
 */
export default function Footer() {
  return (
    <footer className="hidden md:block border-t border-line px-8 py-5">
      <div className="mx-auto flex max-w-[1440px] flex-col items-center gap-3">
        <img src="/ornament-divider.svg" alt="" className="h-4 opacity-60 select-none" draggable={false} />
        <div className="flex w-full items-center justify-between text-[12px] text-ink-500">
          <span>أفراح الجمعية — دفتر النقوط الرقمي · كل الحقوق محفوظة</span>
          <span className="font-ruqaa text-[15px] text-primary-600">مع تحيات أحمد عمر</span>
        </div>
      </div>
    </footer>
  )
}
