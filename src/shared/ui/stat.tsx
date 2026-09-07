import { MetricCard } from '@doscientos/ui'
import { ClipboardList } from 'lucide-react'

export function Stat({
  label,
  value,
  accent,
  loading = false,
}: {
  label: string
  value: number
  accent?: string
  loading?: boolean
}) {
  return (
    <MetricCard
      className={[
        '[--card-spacing:18px] shadow-none',
        accent === 'lime' ? 'border-t-[3px] border-[var(--accent)] bg-[#fffafa]' : 'bg-white',
        "[&_[data-slot='metric-card-label']]:m-0 [&_[data-slot='metric-card-label']]:text-[13px] [&_[data-slot='metric-card-label']]:text-[#686868]",
        "[&_[data-slot='metric-card-value']]:mt-2 [&_[data-slot='metric-card-value']]:text-[31px] [&_[data-slot='metric-card-value']]:tracking-[-0.06em] [&_[data-slot='metric-card-value']]:text-[#171717]",
        "[&_[data-slot='metric-card-description']]:mt-2.5 [&_[data-slot='metric-card-description']]:text-[11px] [&_[data-slot='metric-card-description']]:text-[#686868]",
      ].join(' ')}
      description={loading ? 'Actualizando…' : 'Actualizado ahora'}
      icon={<ClipboardList aria-hidden="true" size={15} />}
      label={label}
      value={loading ? '—' : value}
    />
  )
}
