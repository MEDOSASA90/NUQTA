import { cn } from '@/lib/utils'

/**
 * نسخة محلية من InteractionMarks تدعم حالة الفتح —
 * علامات «/» اليدوية تدور 90deg وتصبح «\» عند فتح الـ drill-down
 * (design.md §٦.٢.٥ وbalances.md §٥.٢). المكوّن المشترك لا يدعم
 * حالة الفتح، فأُنشئت هذه النسخة بدل تعديله.
 */
export interface OpenableMarksProps {
  count: number
  open: boolean
  onToggle: () => void
  className?: string
}

const MAX_MARKS = 5

/** شَرطة قلم يدوية — سماكة وانحراف طفيف يختلفان في كل مرة */
function SlashMark({ i }: { i: number }) {
  const wob = [0, 1.6, -1.2, 0.8, -0.4][i % 5]
  const sw = [2.6, 2.2, 2.9, 2.4, 2.7][i % 5]
  return (
    <svg width="9" height="20" viewBox="0 0 9 20" aria-hidden className="shrink-0">
      <path
        d={`M${6.5 + wob} 2.5 L${2.5 + wob * 0.5} 17.5`}
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

export default function OpenableMarks({ count, open, onToggle, className }: OpenableMarksProps) {
  if (count <= 0) return <span className="text-ink-400 text-[13px]">—</span>
  const shown = Math.min(count, MAX_MARKS)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      aria-expanded={open}
      title={`${count} مرات تفاعل — اضغط ${open ? 'للطي' : 'لعرض كل مرة'}`}
      className={cn(
        'inline-flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-primary-600',
        'hover:bg-primary-50 transition-colors duration-150',
        open && 'bg-primary-50',
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        <span
          className={cn('inline-flex items-end gap-[3px] transition-transform duration-300 ease-out', open && '-rotate-90')}
          aria-hidden
        >
          {Array.from({ length: shown }, (_, i) => (
            <SlashMark key={i} i={i} />
          ))}
        </span>
        {count > MAX_MARKS && <span className="num-ltr font-kufi font-bold text-[13px]">×{count}</span>}
        <span className="sr-only">{count} مرات تفاعل</span>
      </span>
      <span className="text-[10.5px] text-ink-400">{open ? 'اضغط للطي' : 'اضغط للتفاصيل'}</span>
    </button>
  )
}
