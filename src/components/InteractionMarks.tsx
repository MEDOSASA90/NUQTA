import { cn } from '@/lib/utils'

/**
 * علامات التفاعل (design.md §٨.٦) — علامات «/» بعدد مرات التفاعل،
 * مرسومة بخط «يدوي» مائل قليلًا (SVG strokes بسمك متفاوت) لمحاكاة قلم الدفتر.
 * بحد أقصى 5 علامات ثم «× 8». الضغط يفتح drill-down بكل مرة.
 */
export interface InteractionMarksProps {
  count: number
  onOpen?: () => void
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

export default function InteractionMarks({ count, onOpen, className }: InteractionMarksProps) {
  if (count <= 0) return <span className="text-ink-400 text-[13px]">—</span>
  const shown = Math.min(count, MAX_MARKS)

  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${count} مرات تفاعل — اضغط لعرض كل مرة`}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-primary-600',
        'hover:bg-primary-50 transition-colors duration-150',
        onOpen ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
    >
      <span className="inline-flex items-end gap-[3px]" aria-hidden>
        {Array.from({ length: shown }, (_, i) => (
          <SlashMark key={i} i={i} />
        ))}
      </span>
      {count > MAX_MARKS && (
        <span className="num-ltr font-kufi font-bold text-[13px]">×{count}</span>
      )}
      <span className="sr-only">{count} مرات تفاعل</span>
    </button>
  )
}
