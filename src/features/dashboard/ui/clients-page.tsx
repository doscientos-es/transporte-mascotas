import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Pagination,
} from '@doscientos/ui'
import { Mail, Pencil, Phone, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { readPageParam } from '@/shared/lib/search-params'
import type { Client, ClientInvoice, InvoicePayer, Letter } from '@/shared/types'
import { useUrlParams } from '@/shared/ui/use-url-params'

type ClientInput = Omit<Client, 'id' | 'createdAt'>
const emptyClient: ClientInput = {
  fullName: '',
  nif: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  postalCode: '',
}
const currency = (value: number) =>
  new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)
const payerLabels: Record<InvoicePayer, string> = {
  remitente: 'Remitente',
  destinatario: 'Destinatario',
  manual: 'Empresa u otro',
}

export function ClientsPage({
  clients,
  invoices,
  letters,
  onSave,
  onDelete,
  onOpenInvoice,
  onOpenLetter,
}: {
  clients: Client[]
  invoices: ClientInvoice[]
  letters: Letter[]
  onSave: (client: Client | ClientInput) => Promise<void>
  onDelete: (client: Client) => Promise<void>
  onOpenInvoice: (invoiceId: string) => void
  onOpenLetter: (letterId: string) => void
}) {
  const [editing, setEditing] = useState<Client | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const { searchParams, updateParams } = useUrlParams()
  const requestedClientId = searchParams.get('client')
  const requestedPage = readPageParam(searchParams.get('pagina'))
  const pageSize = 12
  const pageCount = Math.max(1, Math.ceil(clients.length / pageSize))
  const page = Math.min(requestedPage, pageCount)
  const visibleClients = clients.slice((page - 1) * pageSize, page * pageSize)
  const firstRecord = clients.length === 0 ? 0 : (page - 1) * pageSize + 1
  const lastRecord = Math.min(page * pageSize, clients.length)
  const selected = clients.find((client) => client.id === requestedClientId) ?? clients[0]
  const orders = useMemo(
    () =>
      selected
        ? letters.filter((letter) =>
            [letter.sender, letter.recipient].some(
              (name) =>
                name.trim().toLocaleLowerCase() === selected.fullName.trim().toLocaleLowerCase(),
            ),
          )
        : [],
    [letters, selected],
  )
  const clientInvoices = useMemo(
    () => (selected ? invoices.filter((invoice) => invoice.clientId === selected.id) : []),
    [invoices, selected],
  )

  useEffect(() => {
    if (selected?.id !== requestedClientId)
      updateParams({ client: selected?.id, pagina: undefined })
  }, [requestedClientId, selected?.id, updateParams])

  async function remove(client: Client) {
    setDeletingClient(true)
    setDeleteError('')
    try {
      await onDelete(client)
      if (selected?.id === client.id) updateParams({ client: undefined, pagina: undefined })
      setDeleting(null)
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : 'No se ha podido eliminar el cliente.',
      )
    } finally {
      setDeletingClient(false)
    }
  }

  return (
    <>
      <div className="page-intro">
        <p>Ficha y actividad comercial de remitentes y destinatarios.</p>
        <Button onClick={() => setEditing(null)}>
          <Plus /> Nuevo cliente
        </Button>
      </div>
      <div className="clients-layout">
        <Card className="clients-list">
          <CardContent>
            <div className="clients-list-heading">
              <h3>Directorio</h3>
              <span>{clients.length} clientes</span>
            </div>
            {clients.length === 0 ? (
              <p className="empty-copy">
                Aún no hay clientes. Crea uno o genera la primera factura.
              </p>
            ) : (
              <>
                <div className="client-rows">
                  {visibleClients.map((client) => (
                    <button
                      type="button"
                      className={`client-row ${selected?.id === client.id ? 'is-selected' : ''}`}
                      key={client.id}
                      onClick={() => updateParams({ client: client.id, pagina: undefined }, false)}
                    >
                      <span className="client-initials">
                        {client.fullName
                          .split(' ')
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join('')
                          .toUpperCase()}
                      </span>
                      <span>
                        <strong>{client.fullName}</strong>
                        <small>{client.city || client.email || 'Sin datos de contacto'}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  ariaLabel="Paginación de clientes"
                  onPageChange={(nextPage) =>
                    updateParams({ pagina: nextPage === 1 ? undefined : nextPage })
                  }
                  summary={`Mostrando ${firstRecord}–${lastRecord} de ${clients.length}`}
                />
              </>
            )}
          </CardContent>
        </Card>
        {selected ? (
          <div className="client-detail">
            <Card>
              <CardContent>
                <div className="client-profile-head">
                  <div>
                    <p className="eyebrow">Ficha de cliente</p>
                    <h3>{selected.fullName}</h3>
                    <p>{selected.nif || 'NIF pendiente'}</p>
                  </div>
                  <div className="profile-actions">
                    <button
                      type="button"
                      title="Editar cliente"
                      onClick={() => setEditing(selected)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      title="Eliminar cliente"
                      className="danger-action"
                      onClick={() => setDeleting(selected)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="client-contact-grid">
                  <span>
                    <Phone size={15} /> {selected.phone || 'Teléfono pendiente'}
                  </span>
                  <span>
                    <Mail size={15} /> {selected.email || 'Email pendiente'}
                  </span>
                  <span>
                    {[selected.address, selected.postalCode, selected.city]
                      .filter(Boolean)
                      .join(', ') || 'Dirección pendiente'}
                  </span>
                </div>
              </CardContent>
            </Card>
            <div className="client-history-grid">
              <Card>
                <CardContent>
                  <div className="history-heading">
                    <div>
                      <ReceiptText size={18} />
                      <h3>Facturas</h3>
                    </div>
                    <b>{clientInvoices.length}</b>
                  </div>
                  {clientInvoices.length ? (
                    <div className="history-list">
                      {clientInvoices.map((invoice) => (
                        <button
                          key={invoice.id}
                          type="button"
                          className="history-link"
                          onClick={() => onOpenInvoice(invoice.id)}
                        >
                          <span className="invoice-mark">F</span>
                          <span>
                            <strong>{invoice.letterId.replace('CARTA DE PORTE Nº ', '')}</strong>
                            <small>
                              {new Date(invoice.createdAt).toLocaleDateString('es-ES')} ·{' '}
                              {payerLabels[invoice.payer]}
                            </small>
                          </span>
                          <b>{currency(invoice.total)}</b>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">
                      Las facturas generadas desde cartas de porte aparecerán aquí.
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <div className="history-heading">
                    <div>
                      <ReceiptText size={18} />
                      <h3>Órdenes</h3>
                    </div>
                    <b>{orders.length}</b>
                  </div>
                  {orders.length ? (
                    <div className="history-list">
                      {orders.map((letter) => (
                        <button
                          key={letter.id}
                          type="button"
                          className="history-link"
                          onClick={() => onOpenLetter(letter.id)}
                        >
                          <span className="order-mark">O</span>
                          <span>
                            <strong>{letter.id.replace('CARTA DE PORTE Nº ', '')}</strong>
                            <small>
                              {letter.origin} → {letter.destination} · {letter.serviceDate}
                            </small>
                          </span>
                          <span className={`status status-${letter.status}`}>{letter.status}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">No hay órdenes relacionadas todavía.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent>
              <p className="empty-copy">Selecciona un cliente para consultar su historial.</p>
            </CardContent>
          </Card>
        )}
      </div>
      {editing !== undefined && (
        <ClientDialog
          client={editing ?? undefined}
          onClose={() => setEditing(undefined)}
          onSave={onSave}
        />
      )}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
            setDeleteError('')
          }
        }}
      >
        <AlertDialogContent className="delete-client-dialog !w-[calc(100%-2.5rem)] !max-w-[460px] !p-[26px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar cliente</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting
                ? `¿Eliminar a ${deleting.fullName}? Solo se permite si no tiene facturas asociadas.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && (
            <p className="form-error" role="alert">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingClient}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deletingClient}
              onClick={() => deleting && void remove(deleting)}
            >
              {deletingClient ? 'Eliminando…' : 'Eliminar cliente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function ClientDialog({
  client,
  onClose,
  onSave,
}: {
  client?: Client
  onClose: () => void
  onSave: (client: Client | ClientInput) => Promise<void>
}) {
  const [form, setForm] = useState<Client | ClientInput>(client ?? emptyClient)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const update = (field: keyof ClientInput, value: string) =>
    setForm((current) => ({ ...current, [field]: value }))
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSave(form)
      onClose()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'No se ha podido guardar el cliente.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="dialog-card client-dialog !w-[calc(100%-2.5rem)] !max-w-[590px] !p-[26px]">
        <DialogHeader className="gap-0">
          <DialogTitle>{client ? 'Editar cliente' : 'Nuevo cliente'}</DialogTitle>
          <DialogDescription>
            {client
              ? 'Actualiza los datos de contacto y facturación del cliente.'
              : 'Añade los datos de contacto y facturación del nuevo cliente.'}
          </DialogDescription>
        </DialogHeader>
        <form className="client-form" onSubmit={(event) => void submit(event)}>
          <Label>
            Nombre completo
            <Input
              value={form.fullName}
              onChange={(event) => update('fullName', event.target.value)}
              required
            />
          </Label>
          <Label>
            NIF
            <Input value={form.nif} onChange={(event) => update('nif', event.target.value)} />
          </Label>
          <Label>
            Email
            <Input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </Label>
          <Label>
            Teléfono
            <Input value={form.phone} onChange={(event) => update('phone', event.target.value)} />
          </Label>
          <Label className="form-span">
            Dirección
            <Input
              value={form.address}
              onChange={(event) => update('address', event.target.value)}
            />
          </Label>
          <Label>
            Código postal
            <Input
              value={form.postalCode}
              onChange={(event) => update('postalCode', event.target.value)}
            />
          </Label>
          <Label>
            Ciudad
            <Input value={form.city} onChange={(event) => update('city', event.target.value)} />
          </Label>
          {error && (
            <p className="form-error form-span" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="dialog-submit" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar cliente'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
