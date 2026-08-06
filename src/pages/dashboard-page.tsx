import type { Session } from '@supabase/supabase-js'
import { CheckCircle2 } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard-layout'
import { ImportDialog, InvoiceDialog, NewRouteDialog } from '../components/operation-dialogs'
import { useDashboard } from '../hooks/use-dashboard'
import { useDashboardNavigation } from '../hooks/use-dashboard-navigation'
import { downloadVanManifest } from '../lib/pdf'
import { LettersPage } from './letters-page'
import { RoutesPage } from './routes-page'
import { TemplatesPage } from './templates-page'
import { VanPage } from './van-page'

const ClientsPage = lazy(() => import('../components/clients-page').then(({ ClientsPage: page }) => ({ default: page })))

export function DashboardPage({ session }: { session: Session | null }) {
  const dashboard = useDashboard(session)
  const { section, routeId, navigateToSection, navigateToRoute, replaceWithSection } = useDashboardNavigation()
  const pendingLetters = dashboard.letters.filter((letter) => letter.status === 'pendiente').length
  const routeFromUrl = routeId ? dashboard.dailyRoutes.find((route) => route.id === routeId) : undefined
  const activeRoute = routeFromUrl ?? dashboard.selectedRoute

  useEffect(() => {
    if (section !== 'rutas' || !routeId) return
    if (routeFromUrl) dashboard.setSelectedRoute(routeFromUrl)
    else replaceWithSection('rutas')
  }, [dashboard, replaceWithSection, routeFromUrl, routeId, section])

  async function createRouteAndNavigate(template: Parameters<typeof dashboard.createDailyRoute>[0], date: string) {
    const route = await dashboard.createDailyRoute(template, date)
    if (route) navigateToRoute(route.id)
  }

  return <>
    <DashboardLayout section={section} pendingLetters={pendingLetters} onNavigate={navigateToSection} onSignOut={dashboard.signOut}>
      {section === 'cartas' && <LettersPage letters={dashboard.filteredLetters} search={dashboard.search} onSearchChange={dashboard.setSearch} onImport={() => dashboard.setShowImport(true)} onInvoice={dashboard.setInvoiceLetter} />}
      {section === 'clientes' && <Suspense fallback={<PageLoading />}><ClientsPage clients={dashboard.clients} invoices={dashboard.invoices} letters={dashboard.letters} onSave={dashboard.saveClient} onDelete={dashboard.removeClient} /></Suspense>}
      {section === 'plantillas' && <TemplatesPage templates={dashboard.routeTemplates} selected={dashboard.selectedTemplate} onSelect={dashboard.setSelectedTemplate} />}
      {section === 'rutas' && <RoutesPage route={activeRoute} template={dashboard.routeTemplates.find((template) => template.id === activeRoute.templateId) ?? dashboard.activeTemplate} templates={dashboard.routeTemplates} routes={dashboard.dailyRoutes} onSelect={(route) => { dashboard.setSelectedRoute(route); navigateToRoute(route.id) }} onAction={dashboard.updateAction} onUpdateStops={dashboard.updateRouteStops} onUpdateService={dashboard.updateRouteService} onRemoveService={dashboard.removeRouteService} onCreate={() => dashboard.setShowNewRoute(true)} />}
      {section === 'furgoneta' && <VanPage route={activeRoute} assignments={dashboard.assignments} onPrint={() => downloadVanManifest(dashboard.assignments, dashboard.activeTemplate.name)} />}
    </DashboardLayout>
    {dashboard.showImport && <ImportDialog onClose={() => dashboard.setShowImport(false)} onPick={() => dashboard.fileInput.current?.click()} />}
    {dashboard.showNewRoute && <NewRouteDialog templates={dashboard.routeTemplates} onClose={() => dashboard.setShowNewRoute(false)} onCreate={createRouteAndNavigate} />}
    {dashboard.invoiceLetter && <InvoiceDialog letter={dashboard.invoiceLetter} onClose={() => dashboard.setInvoiceLetter(null)} onGenerate={dashboard.generateInvoice} />}
    <input ref={dashboard.fileInput} hidden type="file" accept="application/pdf" onChange={(event) => dashboard.importPdf(event.target.files?.[0])} />
    {dashboard.notice && <div className="toast" role="status"><CheckCircle2 size={18} /> {dashboard.notice}</div>}
  </>
}

function PageLoading() {
  return <div className="page-loading" role="status">Cargando sección…</div>
}
