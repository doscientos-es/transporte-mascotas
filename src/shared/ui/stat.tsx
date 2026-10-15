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
          ? '[--card-spacing:10px] border-0 shadow-none flex-row items-center gap-2.5 px-2.5 [&_[data-slot=card-header]]:contents [&_[data-slot=card-content]]:order-1 [&_[data-slot=card-content]]:w-auto [&_[data-slot=card-content]]:flex-none [&_[data-slot=card-content]]:p-0 [&_[data-slot=metric-card-label]]:order-2'
          : '[--card-spacing:18px] shadow-none',
        isClear
          ? 'bg-[#f1faf3] [&_[data-slot="metric-card-icon"]]:text-[#27834a] [&_[data-slot="metric-card-label"]]:text-[#356546] [&_[data-slot="metric-card-value"]]:text-[#176b38]'
          : accent === 'lime'
            ? 'bg-[#fffafa]'
            : 'bg-white',
        compact
          ? "[&_[data-slot='metric-card-label']]:m-0 [&_[data-slot='metric-card-label']]:text-[12px] [&_[data-slot='metric-card-label']]:text-[#686868]"
          : "[&_[data-slot='metric-card-label']]:m-0 [&_[data-slot='metric-card-label']]:text-[13px] [&_[data-slot='metric-card-label']]:text-[#686868]",
        compact
          ? "[&_[data-slot='metric-card-value']]:mt-0 [&_[data-slot='metric-card-value']]:text-[24px] [&_[data-slot='metric-card-value']]:tracking-[-0.06em] [&_[data-slot='metric-card-value']]:text-[#171717]"
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
