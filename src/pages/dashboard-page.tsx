import type { Session } from '@supabase/supabase-js'
import { CheckCircle2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { DashboardLayout } from '../components/dashboard-layout'
import { InvoiceDialog, NewRouteDialog } from '../components/operation-dialogs'
import { useDashboard } from '../hooks/use-dashboard'
import { downloadVanManifest } from '../lib/pdf'
import { LettersPage } from './letters-page'
import { RoutesPage } from './routes-page'
import { TemplatesPage } from './templates-page'
import { VanPage } from './van-page'
import { ReservationsPage } from '../components/reservations-page'
import { LetterEditorDialog } from '../components/letter-editor-dialog'

const ClientsPage = lazy(() => import('../components/clients-page').then(({ ClientsPage: page }) => ({ default: page })))

export function DashboardPage({ session }: { session: Session | null }) {
  const dashboard = useDashboard(session)
  const pendingLetters = dashboard.letters.filter((letter) => letter.status === 'pendiente').length

  return <><DashboardLayout section={dashboard.section} pendingLetters={pendingLetters} onSectionChange={dashboard.setSection} onSignOut={dashboard.signOut}>{dashboard.section === 'cartas' && <LettersPage letters={dashboard.filteredLetters} search={dashboard.search} onSearchChange={dashboard.setSearch} onCreate={() => dashboard.setShowLetterEditor(true)} onInvoice={dashboard.setInvoiceLetter} />}{dashboard.section === 'reservas' && <ReservationsPage reservations={dashboard.reservations} onConfirm={dashboard.markReservationPaid} />}{dashboard.section === 'clientes' && <Suspense fallback={<PageLoading />}><ClientsPage clients={dashboard.clients} invoices={dashboard.invoices} letters={dashboard.letters} onSave={dashboard.saveClient} onDelete={dashboard.removeClient} /></Suspense>}{dashboard.section === 'plantillas' && <TemplatesPage templates={dashboard.routeTemplates} selected={dashboard.selectedTemplate} onSelect={dashboard.setSelectedTemplate} />}{dashboard.section === 'rutas' && <RoutesPage route={dashboard.selectedRoute} template={dashboard.activeTemplate} templates={dashboard.routeTemplates} routes={dashboard.dailyRoutes} onSelect={dashboard.setSelectedRoute} onAction={dashboard.updateAction} onCreate={() => dashboard.setShowNewRoute(true)} onPublish={dashboard.setRoutePublished} />}{dashboard.section === 'furgoneta' && <VanPage route={dashboard.selectedRoute} assignments={dashboard.assignments} onPrint={() => downloadVanManifest(dashboard.assignments, dashboard.activeTemplate.name)} />}</DashboardLayout>{dashboard.showLetterEditor && <LetterEditorDialog onClose={() => dashboard.setShowLetterEditor(false)} onSave={dashboard.saveManualLetter} />}{dashboard.showNewRoute && <NewRouteDialog templates={dashboard.routeTemplates} onClose={() => dashboard.setShowNewRoute(false)} onCreate={dashboard.createDailyRoute} />}{dashboard.invoiceLetter && <InvoiceDialog letter={dashboard.invoiceLetter} onClose={() => dashboard.setInvoiceLetter(null)} onGenerate={dashboard.generateInvoice} />}{dashboard.notice && <div className="toast" role="status"><CheckCircle2 size={18} /> {dashboard.notice}</div>}</>
}

function PageLoading() {
  return <div className="page-loading" role="status">Cargando sección…</div>
}
