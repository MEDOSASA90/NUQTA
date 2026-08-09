import { motion } from 'framer-motion'

/**
 * صفحة مؤقتة (stub) — عنوان الصفحة فقط لحين تنفيذ وكيل الصفحة المختص.
 * PAGE-SLOT: تُستبدل بالتنفيذ الكامل حسب ملف التصميم الخاص بالصفحة.
 */
export default function PageStub({ title, note }: { title: string; note?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="surface-card flex flex-col items-center justify-center py-20 text-center"
    >
      <img src="/ornament-divider.svg" alt="" className="h-4 w-48 opacity-60 select-none" draggable={false} />
      <h2 className="mt-4 font-kufi font-bold text-[26px] leading-[34px] text-ink-900">{title}</h2>
      {note && <p className="mt-2 max-w-[420px] text-[13px] text-ink-500">{note}</p>}
    </motion.div>
  )
}
