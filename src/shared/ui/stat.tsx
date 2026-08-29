import { MetricCard } from '@doscientos/ui'
import { ClipboardList } from 'lucide-react'

export function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <MetricCard
      className={`stat ${accent ? `stat-${accent}` : ''}`}
      description="Actualizado ahora"
      icon={<ClipboardList aria-hidden="true" size={15} />}
      label={label}
      value={value}
    />
  )
}
