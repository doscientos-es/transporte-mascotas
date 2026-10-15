import { Button, Input } from '@doscientos/ui'
import { ShieldCheck, ShieldOff } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import type { UserRoleEntry } from '@/shared/types'

import { loadUserRoles, updateUserRole } from '../application/user-roles'

type Props = {
  currentUserId?: string
  onNotify: (message: string) => void
}

export function UserRolesSettings({ currentUserId, onNotify }: Props) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserRoleEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [changingId, setChangingId] = useState<string | null>(null)

  const refresh = useCallback(async (search: string) => {
    setLoading(true)
    setError('')
    try {
      setUsers(await loadUserRoles(search))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se han podido cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(query), 250)
    return () => window.clearTimeout(timer)
  }, [query, refresh])

  async function changeRole(user: UserRoleEntry) {
    const role = user.role === 'admin' ? 'user' : 'admin'
    setChangingId(user.id)
    try {
      await updateUserRole(user.id, role)
      setUsers((current) => current.map((item) => (item.id === user.id ? { ...item, role } : item)))
      onNotify(
        role === 'admin'
          ? `${user.email} ahora es administrador.`
          : `${user.email} ya no es administrador.`,
      )
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : 'No se ha podido cambiar el rol.')
    } finally {
      setChangingId(null)
    }
  }

  // Sin búsqueda solo se muestran los administradores (para quitarlos con facilidad);
  // el resto de cuentas se encuentran buscando por nombre o correo.
  const searching = query.trim().length > 0
  const visibleUsers = searching ? users : users.filter((user) => user.role === 'admin')

  return (
    <section className="settings-support settings-invitations">
      <div>
        <h2>Usuarios y roles</h2>
        <p>
          Aquí ves los administradores actuales. Para hacer administrador a otra cuenta, búscala por
          nombre o correo. Los trabajadores solo tienen que crear su cuenta como cualquier cliente.
        </p>
      </div>
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nombre o correo"
        aria-label="Buscar usuarios"
        autoComplete="off"
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!error && !loading && visibleUsers.length === 0 && (
        <p>{searching ? 'No hay usuarios que coincidan.' : 'Todavía no hay administradores.'}</p>
      )}
      {visibleUsers.length > 0 && (
        <ul
          className="team-invitation-list"
          aria-label={searching ? 'Resultados de la búsqueda' : 'Administradores'}
        >
          {visibleUsers.map((user) => (
            <li key={user.id}>
              <span>
                {user.displayName ? <strong>{user.displayName} · </strong> : null}
                {user.email}
                {user.role === 'admin' ? ' (administrador)' : ''}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={changingId === user.id || user.id === currentUserId}
                onClick={() => void changeRole(user)}
              >
                {user.role === 'admin' ? (
                  <>
                    <ShieldOff size={14} /> Quitar admin
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} /> Hacer admin
                  </>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
