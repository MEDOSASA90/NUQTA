import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * جدول الدفتر (design.md §٨.٣) — رأس لاصق #F1EADA، صفوف 48px بفواصل ناعمة،
 * hover #FAF5EA، صف محدد primary-50 + شريط يمين 3px، فرز للأعمدة الرقمية.
 * عام بالكامل — يستقبل الأعمدة والصفوف عبر props (مصدر البيانات عند وكيل الصفحة).
 */

export interface Column<T> {
  key: string
  header: ReactNode
  render: (row: T, index: number) => ReactNode
  numeric?: boolean
  sortable?: boolean
  sortValue?: (row: T) => number | string
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  selectedKey?: string
  empty?: ReactNode
  dense?: boolean
  className?: string
  /** عرض بديل كبطاقات مكدسة على الموبايل (< 768px) — الجدول يظهر من md فأعلى */
  renderCard?: (row: T, index: number) => ReactNode
}

export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  dense = false,
  className,
  renderCard,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null)

  const sorted = useMemo(() => {
    if (!sort) return rows
    const col = columns.find((c) => c.key === sort.key)
    if (!col?.sortValue) return rows
    const sv = col.sortValue
    return [...rows].sort((a, b) => {
      const va = sv(a)
      const vb = sv(b)
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'ar')
      return sort.dir === 'asc' ? cmp : -cmp
    })
  }, [rows, sort, columns])

  const toggleSort = (key: string) => {
    setSort((s) => (s?.key === key ? (s.dir === 'desc' ? { key, dir: 'asc' } : null) : { key, dir: 'desc' }))
  }

  // نسخة البطاقات للموبايل: كل صف = بطاقة رأسية، بلا أي قصّ أفقي
  if (renderCard) {
    return (
      <>
        <div className={cn('hidden overflow-x-auto md:block', className)}>
          <DataTableInner columns={columns} sorted={sorted} rowKey={rowKey} onRowClick={onRowClick} selectedKey={selectedKey} empty={empty} dense={dense} sort={sort} onToggleSort={toggleSort} />
        </div>
        <ul className="md:hidden">
          {sorted.length === 0 && (
            <li>{empty ?? <div className="py-10 text-center text-ink-400 text-[13px]">لا توجد بيانات</div>}</li>
          )}
          {sorted.map((row, i) => (
            <li key={rowKey(row)} className="border-t border-line first:border-t-0">
              {renderCard(row, i)}
            </li>
          ))}
        </ul>
      </>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <DataTableInner columns={columns} sorted={sorted} rowKey={rowKey} onRowClick={onRowClick} selectedKey={selectedKey} empty={empty} dense={dense} sort={sort} onToggleSort={toggleSort} />
    </div>
  )
}

/** الجدول نفسه (سطح المكتب) — يُستخدم مباشرة أو داخل تبديل البطاقات */
function DataTableInner<T>({
  columns,
  sorted,
  rowKey,
  onRowClick,
  selectedKey,
  empty,
  dense,
  sort,
  onToggleSort,
}: {
  columns: Column<T>[]
  sorted: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  selectedKey?: string
  empty?: ReactNode
  dense: boolean
  sort: { key: string; dir: 'asc' | 'desc' } | null
  onToggleSort: (key: string) => void
}) {
  return (
    <table className="w-full border-collapse text-[13.5px] leading-[22px]">
      <thead>
        <tr className="bg-[#F1EADA] sticky top-0 z-10">
          {columns.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={cn(
                'px-4 py-3 text-[12px] font-semibold text-ink-700 text-start whitespace-nowrap',
                c.numeric && 'text-end',
                c.className,
              )}
            >
              {c.sortable && c.sortValue ? (
                <button
                  type="button"
                  onClick={() => onToggleSort(c.key)}
                  className="inline-flex items-center gap-1 hover:text-primary-600 transition-colors"
                >
                  {c.header}
                  {sort?.key === c.key ? (
                    sort.dir === 'desc' ? (
                      <ArrowDown className="size-3.5" />
                    ) : (
                      <ArrowUp className="size-3.5" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3.5 opacity-50" />
                  )}
                </button>
              ) : (
                c.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="p-0">
              {empty ?? <div className="py-10 text-center text-ink-400 text-[13px]">لا توجد بيانات</div>}
            </td>
          </tr>
        )}
        {sorted.map((row, i) => {
          const key = rowKey(row)
          const selected = key === selectedKey
          return (
            <tr
              key={key}
              onClick={() => onRowClick?.(row)}
              className={cn(
                'border-t border-line transition-colors duration-150',
                dense ? 'h-11' : 'h-12',
                onRowClick && 'cursor-pointer',
                selected
                  ? 'bg-primary-50 shadow-[inset_-3px_0_0_0_#A87438]'
                  : 'hover:bg-[#FAF5EA]',
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn('px-4 py-3 text-ink-700', c.numeric && 'text-end num-ltr', c.className)}
                >
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
