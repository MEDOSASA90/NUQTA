import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapPin, Search, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeArabic, toArabicDigits } from '@/lib/format'
import BalanceChip from '@/components/BalanceChip'
import type { Person } from '@/lib/seed-data'

/**
 * البحث الذكي عن شخص (design.md §٨.٥) — أهم مكوّن في النظام:
 * فلترة فورية (debounce 120ms)، تمييز الحروف المطابقة بخلفية ذهبية،
 * شارة منطقة + تليفون + رصيد مصغّر، توسّع تلقائي للمتشابهين بالاسم
 * مع شارة «ميّز بالمنطقة أو التليفون»، تنقّل كامل بلوحة المفاتيح،
 * وآخر سطر دائم «+ إضافة … كشخص جديد».
 * البيانات تصل عبر props — مصدرها (tRPC/seed) عند وكيل الصفحة.
 */

export interface PersonComboboxProps {
  people: Person[]
  globalPeople?: Person[]
  /** أرصدة الأشخاص الحالية مع صاحب الفرح إن وُجدت: personId → صافي المبلغ */
  balances?: Record<string, number>
  onSelect: (person: Person) => void
  onQueryChange?: (query: string) => void
  onAddNew?: (name: string) => void
  /** تخصيص نص سطر «إضافة جديد» الأخير (مثال: استخدام كنص حر بدل إنشاء شخص) */
  addNewLabel?: (name: string) => ReactNode
  placeholder?: string
  autoFocus?: boolean
  className?: string
}

/** تمييز الجزء المطابق من الاسم بخلفية ذهبية */
function HighlightedName({ name, query }: { name: string; query: string }) {
  const nq = normalizeArabic(query)
  if (!nq) return <>{name}</>
  const idx = normalizeArabic(name).indexOf(nq)
  if (idx < 0) return <>{name}</>
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-gold-100 text-inherit rounded-[3px] px-px">{name.slice(idx, idx + query.length)}</mark>
      {name.slice(idx + query.length)}
    </>
  )
}

export default function PersonCombobox({
  people,
  globalPeople = [],
  balances = {},
  onSelect,
  onQueryChange,
  onAddNew,
  addNewLabel,
  placeholder = 'اكتب الاسم… ربع الاسم يكفي',
  autoFocus,
  className,
}: PersonComboboxProps) {
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [lastSelected, setLastSelected] = useState<Person | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // debounce 120ms — فلترة تلقائية فورية
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 120)
    return () => clearTimeout(t)
  }, [query])

  const searchablePeople = useMemo(() => {
    const byIdentity = new Map<string, Person>()
    for (const person of [...people, ...globalPeople]) {
      const key = person.nuqtaId ?? `${person.name}|${person.phone}`
      if (!byIdentity.has(key)) byIdentity.set(key, person)
    }
    return [...byIdentity.values()]
  }, [people, globalPeople])

  const results = useMemo(() => {
    const nq = normalizeArabic(debounced)
    if (!nq) return []
    return searchablePeople.filter((p) => normalizeArabic(p.name).includes(nq) || p.phone.includes(debounced.trim()) || p.nuqtaId?.toLowerCase() === debounced.trim().toLowerCase())
  }, [searchablePeople, debounced])

  // المتشابهون بالاسم — توسّع تلقائي + شارة تمييز
  const dupCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of results) {
      const k = normalizeArabic(p.name)
      map.set(k, (map.get(k) ?? 0) + 1)
    }
    return map
  }, [results])
  const maxDup = Math.max(0, ...dupCounts.values())

  const showPinned = open && !debounced.trim() && lastSelected
  const totalItems = results.length + 1 // + سطر «إضافة شخص جديد»

  useEffect(() => setActive(0), [debounced, open])

  // إغلاق عند الضغط خارجًا
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // إبقاء العنصر النشط ظاهرًا أثناء التنقل
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (p: Person) => {
    setLastSelected(p)
    setQuery('')
    setOpen(false)
    onSelect(p)
  }

  const addNew = () => {
    const name = query.trim()
    if (!name) return
    setOpen(false)
    setQuery('')
    onAddNew?.(name)
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((a) => Math.min(a + 1, totalItems - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (!open) return
      if (active < results.length) pick(results[active])
      else addNew()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute start-4 top-1/2 -translate-y-1/2 size-5 text-ink-400 pointer-events-none" />
        <input
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="person-combobox-list"
          aria-activedescendant={`person-option-${active}`}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value)
            onQueryChange?.(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="h-[52px] w-full rounded-[10px] border border-line-strong bg-paper-surface ps-12 pe-4 text-[16px] text-ink-900 placeholder:text-ink-400 focus:border-primary-500 focus:outline-none transition-colors"
        />
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-40 mt-2 w-full rounded-xl border border-line bg-paper-surface shadow-pop overflow-hidden"
          >
            {maxDup > 1 && (
              <div className="px-4 py-2 bg-[#FDF6DC] text-[12px] text-partial-text border-b border-line">
                {toArabicDigits(maxDup)} بهذا الاسم — ميّز بالمنطقة أو التليفون
              </div>
            )}

            <ul
              id="person-combobox-list"
              role="listbox"
              ref={listRef}
              className="max-h-[320px] overflow-y-auto py-1"
            >
              {showPinned && (
                <li className="px-4 py-2 border-b border-line bg-primary-50/60">
                  <div className="text-[11px] text-ink-500 mb-1">آخر اختيار</div>
                  <button
                    type="button"
                    onClick={() => pick(lastSelected)}
                    className="w-full text-start font-kufi font-semibold text-[14px] text-ink-900 hover:text-primary-600"
                  >
                    {lastSelected.name}
                  </button>
                </li>
              )}

              {results.length === 0 && debounced.trim() && (
                <li className="px-4 py-6 text-center text-[13px] text-ink-400">
                  مفيش نتائج مطابقة — تقدر تضيفه كشخص جديد من السطر الأخير
                </li>
              )}
              {results.length === 0 && !debounced.trim() && !showPinned && (
                <li className="px-4 py-6 text-center text-[13px] text-ink-400">اكتب أي جزء من الاسم للبحث</li>
              )}

              {results.map((p, i) => {
                const dup = (dupCounts.get(normalizeArabic(p.name)) ?? 0) > 1
                const bal = balances[p.id]
                return (
                  <li key={p.id} id={`person-option-${i}`} data-index={i} role="option" aria-selected={active === i}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(p)}
                      className={cn(
                        'w-full text-start px-4 transition-colors duration-100',
                        dup ? 'py-3' : 'py-2.5',
                        active === i ? 'bg-primary-50' : 'bg-transparent',
                      )}
                    >
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className={cn('font-kufi font-semibold text-ink-900', dup ? 'text-[16px]' : 'text-[14.5px]')}>
                          <HighlightedName name={p.name} query={debounced} />
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-paper-sunken px-2 py-0.5 text-[11px] text-ink-700">
                          <MapPin className="size-3" />
                          {p.region}
                        </span>
                        {bal !== undefined && bal !== 0 && <BalanceChip amount={bal} size="sm" />}
                      </div>
                      <div className={cn('num-ltr text-ink-500 mt-0.5 text-start', dup ? 'text-[13.5px]' : 'text-[12px]')}>
                        {p.phone}
                        {p.nuqtaId && <span className="ms-3 text-primary-600">{p.nuqtaId}</span>}
                      </div>
                    </button>
                  </li>
                )
              })}

              {/* آخر سطر دائم: إضافة شخص جديد */}
              <li id={`person-option-${results.length}`} data-index={results.length}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(results.length)}
                  onClick={addNew}
                  disabled={!query.trim()}
                  className={cn(
                    'w-full text-start px-4 py-3 border-t border-line flex items-center gap-2 text-[13.5px] font-medium transition-colors',
                    active === results.length ? 'bg-primary-50' : '',
                    query.trim() ? 'text-primary-600' : 'text-ink-400 cursor-default',
                  )}
                >
                  <UserPlus className="size-4" />
                  {query.trim() ? (
                    (addNewLabel?.(query.trim()) ?? (
                      <>
                        إضافة «<span className="font-kufi font-semibold">{query.trim()}</span>» كشخص جديد
                      </>
                    ))
                  ) : (
                    'اكتب اسمًا لإضافته كشخص جديد'
                  )}
                </button>
              </li>
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
