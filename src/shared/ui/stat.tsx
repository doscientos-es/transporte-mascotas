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
      className={`stat ${accent ? `stat-${accent}` : ''}`}
      description={loading ? 'Actualizando…' : 'Actualizado ahora'}
      icon={<ClipboardList aria-hidden="true" size={15} />}
      label={label}
      value={loading ? '—' : value}
    />
  )
}
