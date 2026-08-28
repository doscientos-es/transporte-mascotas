import { ClipboardList } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card className={`stat ${accent ? `stat-${accent}` : ''}`}>
      <CardContent>
        <p>{label}</p>
        <strong>{value}</strong>
        <span>
          <ClipboardList size={15} /> actualizado ahora
        </span>
      </CardContent>
    </Card>
  )
}
