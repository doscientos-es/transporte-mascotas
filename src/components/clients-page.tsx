import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Pencil, Phone, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Client, ClientInvoice, Letter } from '../lib/types'

type ClientInput = Omit<Client, 'id' | 'createdAt'>
const emptyClient: ClientInput = { fullName: '', nif: '', email: '', phone: '', address: '', city: '', postalCode: '' }
const currency = (value: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value)

export function ClientsPage({ clients, invoices, letters, onSave, onDelete }: {
  clients: Client[]; invoices: ClientInvoice[]; letters: Letter[]
  onSave: (client: Client | ClientInput) => Promise<void>; onDelete: (client: Client) => Promise<void>
}) {
  const [selectedId, setSelectedId] = useState<string | null>(clients[0]?.id ?? null)
  const [editing, setEditing] = useState<Client | null | undefined>(undefined)
  const selected = clients.find((client) => client.id === selectedId) ?? clients[0]
  const orders = useMemo(() => selected ? letters.filter((letter) => [letter.sender, letter.recipient].some((name) => name.trim().toLocaleLowerCase() === selected.fullName.trim().toLocaleLowerCase())) : [], [letters, selected])
  const clientInvoices = useMemo(() => selected ? invoices.filter((invoice) => invoice.clientId === selected.id) : [], [invoices, selected])

  async function remove(client: Client) {
    if (!window.confirm(`¿Eliminar a ${client.fullName}? Solo se permite si no tiene facturas asociadas.`)) return
    await onDelete(client)
    if (selectedId === client.id) setSelectedId(null)
  }

  return <>
    <div className="page-intro"><p>Ficha y actividad comercial de remitentes y destinatarios.</p><Button onClick={() => setEditing(null)}><Plus /> Nuevo cliente</Button></div>
    <div className="clients-layout">
      <Card className="clients-list"><CardContent><div className="clients-list-heading"><h3>Directorio</h3><span>{clients.length} clientes</span></div>{clients.length === 0 ? <p className="empty-copy">Aún no hay clientes. Crea uno o genera la primera factura.</p> : clients.map((client) => <button type="button" className={`client-row ${selected?.id === client.id ? 'is-selected' : ''}`} key={client.id} onClick={() => setSelectedId(client.id)}><span className="client-initials">{client.fullName.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span><strong>{client.fullName}</strong><small>{client.city || client.email || 'Sin datos de contacto'}</small></span></button>)}</CardContent></Card>
      {selected ? <div className="client-detail">
        <Card><CardContent><div className="client-profile-head"><div><p className="eyebrow">Ficha de cliente</p><h3>{selected.fullName}</h3><p>{selected.nif || 'NIF pendiente'}</p></div><div className="profile-actions"><button type="button" title="Editar cliente" onClick={() => setEditing(selected)}><Pencil size={16} /></button><button type="button" title="Eliminar cliente" className="danger-action" onClick={() => void remove(selected)}><Trash2 size={16} /></button></div></div><div className="client-contact-grid"><span><Phone size={15} /> {selected.phone || 'Teléfono pendiente'}</span><span><Mail size={15} /> {selected.email || 'Email pendiente'}</span><span>{[selected.address, selected.postalCode, selected.city].filter(Boolean).join(', ') || 'Dirección pendiente'}</span></div></CardContent></Card>
        <div className="client-history-grid">
          <Card><CardContent><div className="history-heading"><div><ReceiptText size={18} /><h3>Facturas</h3></div><b>{clientInvoices.length}</b></div>{clientInvoices.length ? <div className="history-list">{clientInvoices.map((invoice) => <div key={invoice.id}><span className="invoice-mark">F</span><span><strong>{invoice.letterId.replace('CARTA DE PORTE Nº ', '')}</strong><small>{new Date(invoice.createdAt).toLocaleDateString('es-ES')} · {invoice.payer}</small></span><b>{currency(invoice.total)}</b></div>)}</div> : <p className="empty-copy">Las facturas generadas desde cartas de porte aparecerán aquí.</p>}</CardContent></Card>
          <Card><CardContent><div className="history-heading"><div><ReceiptText size={18} /><h3>Órdenes</h3></div><b>{orders.length}</b></div>{orders.length ? <div className="history-list">{orders.map((letter) => <div key={letter.id}><span className="order-mark">O</span><span><strong>{letter.id.replace('CARTA DE PORTE Nº ', '')}</strong><small>{letter.origin} → {letter.destination} · {letter.serviceDate}</small></span><span className={`status status-${letter.status}`}>{letter.status}</span></div>)}</div> : <p className="empty-copy">No hay órdenes relacionadas todavía.</p>}</CardContent></Card>
        </div>
      </div> : <Card><CardContent><p className="empty-copy">Selecciona un cliente para consultar su historial.</p></CardContent></Card>}
    </div>
    {editing !== undefined && <ClientDialog client={editing ?? undefined} onClose={() => setEditing(undefined)} onSave={onSave} />}
  </>
}

function ClientDialog({ client, onClose, onSave }: { client?: Client; onClose: () => void; onSave: (client: Client | ClientInput) => Promise<void> }) {
  const [form, setForm] = useState<Client | ClientInput>(client ?? emptyClient)
  const [saving, setSaving] = useState(false)
  const update = (field: keyof ClientInput, value: string) => setForm((current) => ({ ...current, [field]: value }))
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true)
    try { await onSave(form); onClose() } finally { setSaving(false) }
  }
  return <div className="dialog-backdrop" role="presentation"><Card className="dialog-card client-dialog" role="dialog" aria-modal="true" aria-labelledby="client-dialog-title"><CardContent><button type="button" className="close-button" onClick={onClose} aria-label="Cerrar">×</button><h2 id="client-dialog-title">{client ? 'Editar cliente' : 'Nuevo cliente'}</h2><form className="client-form" onSubmit={submit}><label>Nombre completo<input value={form.fullName} onChange={(event) => update('fullName', event.target.value)} required /></label><label>NIF<input value={form.nif} onChange={(event) => update('nif', event.target.value)} /></label><label>Email<input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label><label>Teléfono<input value={form.phone} onChange={(event) => update('phone', event.target.value)} /></label><label className="form-span">Dirección<input value={form.address} onChange={(event) => update('address', event.target.value)} /></label><label>Código postal<input value={form.postalCode} onChange={(event) => update('postalCode', event.target.value)} /></label><label>Ciudad<input value={form.city} onChange={(event) => update('city', event.target.value)} /></label><Button type="submit" className="dialog-submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cliente'}</Button></form></CardContent></Card></div>
}
