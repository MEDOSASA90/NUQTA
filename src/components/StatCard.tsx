import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { motion, useInView } from 'framer-motion'
import gsap from 'gsap'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * StatCard (design.md §٨.٣) — أيقونة في مربع 40px ملوّن حسب الدلالة،
 * الرقم Kufi 700 يُعدّ تصاعديًا (GSAP power3.out)، عنوان خافت،
 * وأسفله sparkline رفيع يرسم نفسه. hover ⇒ ارتفاع 2px + ظل أعمق.
 */

export type StatTone = 'primary' | 'olive' | 'brick' | 'gold'

const TONES: Record<StatTone, { box: string; stroke: string }> = {
  primary: { box: 'bg-primary-100 text-primary-600', stroke: '#A87438' },
  olive: { box: 'bg-laha-bg text-laha-solid', stroke: '#5F7A4C' },
  brick: { box: 'bg-aleh-bg text-aleh-solid', stroke: '#B26A4A' },
  gold: { box: 'bg-gold-100 text-gold-600', stroke: '#C29B3C' },
}

export interface StatCardProps {
  title: string
  value: number
  suffix?: string
  sub?: string
  trend?: string
  icon: LucideIcon
  tone?: StatTone
  /** قيم آخر ٦ شهور للـ sparkline */
  spark?: number[]
  href?: string
  /** ترتيب الدخول المتتابع */
  index?: number
  className?: string
}

function Sparkline({ values, stroke, delay }: { values: number[]; stroke: string; delay: number }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 100
    const y = 30 - ((v - min) / range) * 24
    return [x, y] as const
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L100 32 L0 32 Z`
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="h-8 w-full" aria-hidden>
      <path d={area} fill={stroke} opacity={0.12} />
      <motion.path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, delay, ease: 'easeOut' }}
      />
    </svg>
  )
}

export default function StatCard({
  title,
  value,
  suffix,
  sub,
  trend,
  icon: Icon,
  tone = 'primary',
  spark,
  href,
  index = 0,
  className,
}: StatCardProps) {
  const navigate = useNavigate()
  const numRef = useRef<HTMLSpanElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const inView = useInView(cardRef, { once: true, amount: 0.4 })
  const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

  // عدّاد GSAP تصاعدي — يبدأ عند دخول البطاقة نافذة العرض (design.md §٦.٢)
  useEffect(() => {
    const el = numRef.current
    if (!el || !inView) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt.format(value)
      return
    }
    const obj = { v: 0 }
    const tween = gsap.to(obj, {
      v: value,
      duration: 0.9,
      ease: 'power3.out',
      onUpdate: () => {
        el.textContent = fmt.format(Math.round(obj.v))
      },
    })
    return () => {
      tween.kill()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value])

  const t = TONES[tone]

  return (
    <motion.div
      ref={cardRef}
      role={href ? 'link' : undefined}
      tabIndex={href ? 0 : undefined}
      onClick={() => href && navigate(href)}
      onKeyDown={(e) => {
        if (href && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          navigate(href)
        }
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      whileHover={href ? { y: -2 } : undefined}
      className={cn(
        'surface-card p-5 flex flex-col gap-2.5 transition-shadow duration-200 hover:shadow-card-hover',
        href && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className={cn('flex size-10 items-center justify-center rounded-[10px]', t.box)}>
          <Icon className="size-5" strokeWidth={2.1} />
        </span>
        <span className="text-[13px] text-ink-500 font-medium">{title}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span ref={numRef} className="num-ltr font-kufi font-bold text-[30px] leading-[38px] text-ink-900">
          0
        </span>
        {suffix && <span className="text-[13px] text-ink-500">{suffix}</span>}
      </div>
      {(sub || trend) && (
        <div className="text-[12px] leading-[18px] text-ink-500">
          {sub}
          {trend && <span className="text-laha-text font-medium"> · {trend}</span>}
        </div>
      )}
      {spark && <Sparkline values={spark} stroke={t.stroke} delay={0.2 + index * 0.08} />}
    </motion.div>
  )
}
