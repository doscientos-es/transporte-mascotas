import { MetricCard } from '@doscientos/ui'
import { Check, ClipboardList } from 'lucide-react'

export function Stat({
  label,
  value,
  accent,
  loading = false,
  compact = false,
  successWhenZero = false,
}: {
  label: string
  value: number
  accent?: string
  loading?: boolean
  compact?: boolean
  successWhenZero?: boolean
}) {
  const isClear = successWhenZero && value === 0 && !loading

  return (
    <MetricCard
      className={[
        compact
          ? '[--card-spacing:10px] gap-0 shadow-none [&_[data-slot=card-content]]:items-center [&_[data-slot=card-content]]:gap-0 [&_.min-w-0]:grid [&_.min-w-0]:w-full [&_.min-w-0]:flex-1 [&_.min-w-0]:grid-cols-[auto_minmax(0,1fr)] [&_.min-w-0]:items-center [&_.min-w-0]:gap-x-2'
          : '[--card-spacing:18px] shadow-none',
        isClear
          ? 'border-t-[3px] border-[#27834a] bg-[#f1faf3] [&_[data-slot="metric-card-icon"]]:text-[#27834a] [&_[data-slot="metric-card-label"]]:text-[#356546] [&_[data-slot="metric-card-value"]]:text-[#176b38]'
          : accent === 'lime'
            ? 'border-t-[3px] border-[var(--accent)] bg-[#fffafa]'
            : 'bg-white',
        compact
          ? "[&_[data-slot='metric-card-label']]:col-start-2 [&_[data-slot='metric-card-label']]:row-start-1 [&_[data-slot='metric-card-label']]:m-0 [&_[data-slot='metric-card-label']]:text-[12px] [&_[data-slot='metric-card-label']]:text-[#686868]"
          : "[&_[data-slot='metric-card-label']]:m-0 [&_[data-slot='metric-card-label']]:text-[13px] [&_[data-slot='metric-card-label']]:text-[#686868]",
        compact
          ? "[&_[data-slot='metric-card-value']]:col-start-1 [&_[data-slot='metric-card-value']]:row-start-1 [&_[data-slot='metric-card-value']]:mt-0 [&_[data-slot='metric-card-value']]:text-[24px] [&_[data-slot='metric-card-value']]:tracking-[-0.06em] [&_[data-slot='metric-card-value']]:text-[#171717]"
          : "[&_[data-slot='metric-card-value']]:mt-2 [&_[data-slot='metric-card-value']]:text-[31px] [&_[data-slot='metric-card-value']]:tracking-[-0.06em] [&_[data-slot='metric-card-value']]:text-[#171717]",
      ].join(' ')}
      icon={
        isClear ? (
          <Check aria-hidden="true" size={15} />
        ) : compact ? undefined : (
          <ClipboardList aria-hidden="true" size={15} />
        )
      }
      label={label}
      tone={isClear ? 'success' : 'default'}
      value={loading ? '—' : value}
    />
  )
}
