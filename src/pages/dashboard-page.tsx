import type { Session } from '@supabase/supabase-js'
import { CheckCircle2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { DashboardLayout } from '../components/dashboard-layout'
import { ImportDialog, InvoiceDialog, NewRouteDialog } from '../components/operation-dialogs'
import { useDashboard } from '../hooks/use-dashboard'
import { useDashboardNavigation } from '../hooks/use-dashboard-navigation'
import { downloadVanManifest } from '../lib/pdf'
import type { UserProfile } from '../lib/types'
import { InvoicesPage } from './invoices-page'
import { LettersPage } from './letters-page'
import { RoutesPage } from './routes-page'
import { TemplatesPage } from './templates-page'
import { VanPage } from './van-page'

const ClientsPage = lazy(() => import('../components/clients-page').then(({ ClientsPage: page }) => ({ default: page })))
const transporterSections = new Set(['rutas', 'facturas'])

export function DashboardPage({ session, profile }: { session: Session | null; profile: UserProfile }) {
  const dashboard = useDashboard(session, profile.role)
  const { section, routeId, navigateToSection, navigateToRoute, replaceWithSection } = useDashboardNavigation()
  const isTransporter = profile.role === 'transportista'
  const [pendingImport, setPendingImport] = useState<File | null>(null)
  const visibleRoutes = isTransporter && session
    ? dashboard.dailyRoutes.filter((route) => route.transporterId === session.user.id)
    : dashboard.dailyRoutes
  const selectedVisibleRoute = visibleRoutes.find((route) => route.id === dashboard.selectedRoute.id)
  const routeFromUrl = routeId ? visibleRoutes.find((route) => route.id === routeId) : undefined
  const activeRoute = routeFromUrl ?? selectedVisibleRoute ?? visibleRoutes[0]
  const pendingLetters = isTransporter ? 0 : dashboard.letters.filter((letter) => letter.status === 'pendiente').length
  const routeLetterIds = new Set(visibleRoutes.flatMap((route) => route.actions.map((action) => action.letterId)))
  const visibleInvoices = isTransporter ? dashboard.invoices.filter((invoice) => routeLetterIds.has(invoice.letterId)) : dashboard.invoices

  useEffect(() => {
    if (isTransporter && !transporterSections.has(section)) replaceWithSection('rutas')
  }, [isTransporter, replaceWithSection, section])

  useEffect(() => {
    if (section !== 'rutas' || !routeId) return
    if (routeFromUrl) dashboard.setSelectedRoute(routeFromUrl)
    else replaceWithSection('rutas')
  }, [dashboard, replaceWithSection, routeFromUrl, routeId, section])

  async function createRouteAndNavigate(template: Parameters<typeof dashboard.createDailyRoute>[0], date: string, transporterId?: string) {
    const route = await dashboard.createDailyRoute(template, date, transporterId)
    if (route) navigateToRoute(route.id)
  }

  return <>
    <DashboardLayout section={section} pendingLetters={pendingLetters} role={profile.role} displayName={profile.displayName} onNavigate={navigateToSection} onSignOut={dashboard.signOut}>
      {!isTransporter && section === 'cartas' && <LettersPage letters={dashboard.filteredLetters} search={dashboard.search} onSearchChange={dashboard.setSearch} onImport={() => { setPendingImport(null); dashboard.setShowImport(true) }} onInvoice={dashboard.setInvoiceLetter} />}
      {!isTransporter && section === 'clientes' && <Suspense fallback={<PageLoading />}><ClientsPage clients={dashboard.clients} invoices={dashboard.invoices} letters={dashboard.letters} onSave={dashboard.saveClient} onDelete={dashboard.removeClient} /></Suspense>}
      {!isTransporter && section === 'plantillas' && <TemplatesPage templates={dashboard.routeTemplates} selected={dashboard.selectedTemplate} onSelect={dashboard.setSelectedTemplate} />}
      {section === 'rutas' && (activeRoute ? <RoutesPage route={activeRoute} template={dashboard.routeTemplates.find((template) => template.id === activeRoute.templateId) ?? dashboard.activeTemplate} templates={dashboard.routeTemplates} routes={visibleRoutes} letters={dashboard.letters} onSelect={(route) => { dashboard.setSelectedRoute(route); navigateToRoute(route.id) }} onAction={dashboard.updateActions} onUpdateStops={dashboard.updateRouteStops} onUpdateService={dashboard.updateRouteService} onRemoveService={dashboard.removeRouteService} onCreate={() => dashboard.setShowNewRoute(true)} canManage={!isTransporter} /> : <EmptyRoute />)}
      {!isTransporter && section === 'furgoneta' && activeRoute && <VanPage route={activeRoute} assignments={dashboard.assignments} onPrint={() => downloadVanManifest(dashboard.assignments, dashboard.activeTemplate.name)} />}
      {section === 'facturas' && <InvoicesPage invoices={visibleInvoices} transportista={isTransporter} onSend={dashboard.sendInvoiceNotification} />}
    </DashboardLayout>
    {!isTransporter && dashboard.showImport && <ImportDialog file={pendingImport} routes={dashboard.dailyRoutes} templates={dashboard.routeTemplates} onClose={() => { setPendingImport(null); dashboard.setShowImport(false) }} onPick={() => dashboard.fileInput.current?.click()} onFile={(file) => setPendingImport(file ?? null)} onImport={dashboard.importPdf} />}
    {!isTransporter && dashboard.showNewRoute && <NewRouteDialog templates={dashboard.routeTemplates} transporters={dashboard.transporters} onClose={() => dashboard.setShowNewRoute(false)} onCreate={createRouteAndNavigate} />}
    {!isTransporter && dashboard.invoiceLetter && <InvoiceDialog letter={dashboard.invoiceLetter} onClose={() => dashboard.setInvoiceLetter(null)} onGenerate={dashboard.generateInvoice} />}
    {!isTransporter && <input ref={dashboard.fileInput} hidden type="file" accept="application/pdf" onChange={(event) => { setPendingImport(event.target.files?.[0] ?? null); event.target.value = '' }} />}
    {dashboard.notice && <div className="toast" role="status"><CheckCircle2 size={18} /> {dashboard.notice}</div>}
  </>
}

function EmptyRoute() {
  return <div className="page-loading">No tienes una ruta asignada para consultar.</div>
}

function PageLoading() {
  return <div className="page-loading" role="status">Cargando sección…</div>
}
