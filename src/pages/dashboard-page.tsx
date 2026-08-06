import type { Session } from '@supabase/supabase-js'
import { CheckCircle2 } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { DashboardLayout } from '../components/dashboard-layout'
import { ImportDialog, InvoiceDialog, NewRouteDialog } from '../components/operation-dialogs'
import { useDashboard } from '../hooks/use-dashboard'
import { downloadVanManifest } from '../lib/pdf'
import { LettersPage } from './letters-page'
import { RoutesPage } from './routes-page'
import { TemplatesPage } from './templates-page'
import { VanPage } from './van-page'

const ClientsPage = lazy(() => import('../components/clients-page').then(({ ClientsPage: page }) => ({ default: page })))

export function DashboardPage({ session }: { session: Session | null }) {
  const dashboard = useDashboard(session)
  const pendingLetters = dashboard.letters.filter((letter) => letter.status === 'pendiente').length

  return <><DashboardLayout section={dashboard.section} pendingLetters={pendingLetters} onSectionChange={dashboard.setSection} onSignOut={dashboard.signOut}>{dashboard.section === 'cartas' && <LettersPage letters={dashboard.filteredLetters} search={dashboard.search} onSearchChange={dashboard.setSearch} onImport={() => dashboard.setShowImport(true)} onInvoice={dashboard.setInvoiceLetter} />}{dashboard.section === 'clientes' && <Suspense fallback={<PageLoading />}><ClientsPage clients={dashboard.clients} invoices={dashboard.invoices} letters={dashboard.letters} onSave={dashboard.saveClient} onDelete={dashboard.removeClient} /></Suspense>}{dashboard.section === 'plantillas' && <TemplatesPage templates={dashboard.routeTemplates} selected={dashboard.selectedTemplate} onSelect={dashboard.setSelectedTemplate} />}{dashboard.section === 'rutas' && <RoutesPage route={dashboard.selectedRoute} template={dashboard.activeTemplate} templates={dashboard.routeTemplates} routes={dashboard.dailyRoutes} onSelect={dashboard.setSelectedRoute} onAction={dashboard.updateAction} onCreate={() => dashboard.setShowNewRoute(true)} />}{dashboard.section === 'furgoneta' && <VanPage route={dashboard.selectedRoute} assignments={dashboard.assignments} onPrint={() => downloadVanManifest(dashboard.assignments, dashboard.activeTemplate.name)} />}</DashboardLayout>{dashboard.showImport && <ImportDialog onClose={() => dashboard.setShowImport(false)} onPick={() => dashboard.fileInput.current?.click()} />}{dashboard.showNewRoute && <NewRouteDialog templates={dashboard.routeTemplates} onClose={() => dashboard.setShowNewRoute(false)} onCreate={dashboard.createDailyRoute} />}{dashboard.invoiceLetter && <InvoiceDialog letter={dashboard.invoiceLetter} onClose={() => dashboard.setInvoiceLetter(null)} onGenerate={dashboard.generateInvoice} />}<input ref={dashboard.fileInput} hidden type="file" accept="application/pdf" onChange={(event) => dashboard.importPdf(event.target.files?.[0])} />{dashboard.notice && <div className="toast" role="status"><CheckCircle2 size={18} /> {dashboard.notice}</div>}</>
}

function PageLoading() {
  return <div className="page-loading" role="status">Cargando sección…</div>
}
