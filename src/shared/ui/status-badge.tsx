import type { ReactNode } from 'react'

import { statusLabels } from '@/shared/lib/status-labels'

const statusStyles: Record<string, string> = {
  pendiente: 'bg-[#fff3d2] text-[#936b00]',
  pago_pendiente: 'bg-[#fff3d2] text-[#936b00]',
  por_verificar: 'bg-[#fff3d2] text-[#936b00]',
  borrador: 'bg-[#fff3d2] text-[#936b00]',
  revisada: 'bg-[#e8f1ff] text-[#1d62ae]',
  incidencia: 'bg-[#fee2e2] text-[#b42318]',
  rechazada: 'bg-[#fee2e2] text-[#b42318]',
  cancelada: 'bg-[#fee2e2] text-[#b42318]',
  en_ruta: 'bg-[#f1f1f1] text-[#292929]',
  activa: 'bg-[#f1f1f1] text-[#292929]',
  cerrada: 'bg-[#f1f1f1] text-[#292929]',
  entregada: 'bg-[#f1f1f1] text-[#292929]',
  completada: 'bg-[#f1f1f1] text-[#292929]',
  confirmada: 'bg-[#f1f1f1] text-[#292929]',
}

export function StatusBadge({
  status,
  children,
  className,
}: {
  status: string
  children?: ReactNode
  className?: string
}) {
  return (
    <span
      data-status={status}
      className={[
        'inline-flex w-max items-center rounded-full px-2 py-1 text-[11px] font-bold max-[850px]:text-[10px]',
        statusStyles[status] ?? 'bg-[#eff1ee] text-[#5c665a]',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children ?? statusLabels[status] ?? status}
    </span>
  )
}
