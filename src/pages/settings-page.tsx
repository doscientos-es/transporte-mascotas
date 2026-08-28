import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowUpRight, Crown, Search, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageIntro } from '../components/page-intro'
import type { Transporter } from '../lib/types'

type Props = {
  transporters: Transporter[]
  onPromote: (transporterId: string) => Promise<void>
}

function initialsFor(name: string) {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'TR'
  )
}

export function SettingsPage({ transporters, onPromote }: Props) {
  const [query, setQuery] = useState('')
  const [candidate, setCandidate] = useState<Transporter | null>(null)
  const [promoting, setPromoting] = useState(false)
  const [error, setError] = useState('')
  const matchingTransporters = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    return transporters.filter((transporter) =>
      transporter.displayName.toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [query, transporters])

  async function promoteCandidate() {
    if (!candidate) return
    setPromoting(true)
    setError('')
    try {
      await onPromote(candidate.id)
      setCandidate(null)
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'No se ha podido promocionar al transportista.',
      )
    } finally {
      setPromoting(false)
    }
  }

  return (
    <>
      <PageIntro text="Gestiona el acceso del equipo. Promover un transportista le dará acceso completo a operaciones.">
        <span className="settings-admin-badge">
          <ShieldCheck size={16} /> Solo administradores
        </span>
      </PageIntro>
      <section className="team-overview">
        <Card>
          <CardContent>
            <span className="team-overview-icon">
              <UsersRound size={20} />
            </span>
            <div>
              <span>Transportistas activos</span>
              <strong>{transporters.length}</strong>
            </div>
            <p>Selecciona un perfil para ampliar sus permisos.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <span className="team-overview-icon team-overview-icon-admin">
              <Crown size={20} />
            </span>
            <div>
              <span>Acceso de administrador</span>
              <strong>Completo</strong>
            </div>
            <p>Incluye gestión de rutas, clientes, facturas y equipo.</p>
          </CardContent>
        </Card>
      </section>
      <section className="team-settings">
        <div className="team-settings-heading">
          <div>
            <span className="eyebrow">Equipo profesional</span>
            <h2>Transportistas</h2>
            <p>Los perfiles promovidos dejarán de aparecer en esta lista.</p>
          </div>
          <label className="team-search">
            <Search size={16} />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar transportista"
              aria-label="Buscar transportista"
            />
          </label>
        </div>
        <div className="team-member-grid">
          {matchingTransporters.map((transporter) => (
            <Card className="team-member-card" key={transporter.id}>
              <CardContent>
                <span className="team-member-avatar">{initialsFor(transporter.displayName)}</span>
                <div>
                  <strong>{transporter.displayName}</strong>
                  <span>
                    <UserRound size={14} /> Transportista activo
                  </span>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError('')
                    setCandidate(transporter)
                  }}
                >
                  <Crown size={16} /> Hacer administrador
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
        {!matchingTransporters.length && (
          <div className="team-empty">
            <UsersRound size={22} />
            <strong>
              {query ? 'No hay coincidencias' : 'No hay transportistas pendientes de promoción'}
            </strong>
            <p>
              {query
                ? 'Prueba con otro nombre.'
                : 'Los nuevos registros profesionales aparecerán aquí automáticamente.'}
            </p>
          </div>
        )}
      </section>
      <section className="settings-support">
        <div>
          <span className="eyebrow">Soporte</span>
          <h2>Ayuda y soporte</h2>
          <p>Accede al espacio de soporte para consultar o gestionar incidencias.</p>
        </div>
        <a href="https://app.doscientos.es/p/project/6660a4cc88ca3804cdcc1b1291376536aee83f74c028dd25">
          Abrir ayuda y soporte <ArrowUpRight size={16} />
        </a>
      </section>
      <AlertDialog
        open={candidate !== null}
        onOpenChange={(open) => {
          if (!open && !promoting) {
            setCandidate(null)
            setError('')
          }
        }}
      >
        <AlertDialogContent className="promote-role-dialog">
          <AlertDialogHeader>
            <span className="promote-role-icon">
              <Crown size={22} />
            </span>
            <AlertDialogTitle>Hacer administrador</AlertDialogTitle>
            <AlertDialogDescription>
              {candidate ? (
                <>
                  Vas a dar a <strong>{candidate.displayName}</strong> acceso completo a la gestión
                  operativa. Podrá modificar rutas, facturas, clientes y permisos del equipo.
                </>
              ) : (
                ''
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={promoting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={promoting} onClick={() => void promoteCandidate()}>
              <Crown size={16} /> {promoting ? 'Actualizando…' : 'Confirmar promoción'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
