import type { Session } from '@supabase/supabase-js'
import { CheckCircle2 } from 'lucide-react'
import { lazy, Suspense, useEffect } from 'react'
import { DashboardLayout } from '../components/dashboard-layout'
import { InvoiceDialog, LetterFormDialog, NewRouteDirectionDialog } from '../components/operation-dialogs'
import { useDashboard } from '../hooks/use-dashboard'
import { useDashboardNavigation } from '../hooks/use-dashboard-navigation'
import { clientSections } from '../lib/dashboard-navigation'
import { downloadVanManifest } from '../lib/van-manifest-pdf'
import type { UserProfile } from '../lib/types'
import { InvoicesPage } from './invoices-page'
import { LettersPage } from './letters-page'
import { RequestsPage } from './requests-page'
import { RoutesPage } from './routes-page'
import { TemplatesPage } from './templates-page'
import { VanPage } from './van-page'

const ClientsPage = lazy(() => import('../components/clients-page').then(({ ClientsPage: page }) => ({ default: page })))
const transporterSections = new Set(['rutas', 'facturas'])

export function AdminDashboardPage({ session, profile }: { session: Session | null; profile: UserProfile }) {
  const dashboard = useDashboard(session, profile.role)
  const { section, routeId, navigateToSection, navigateToRoute, replaceWithSection } = useDashboardNavigation()
  const isTransporter = profile.role === 'transportista'
  const visibleRoutes = isTransporter && session
    ? dashboard.dailyRoutes.filter((route) => route.transporterId === session.user.id)
    : dashboard.dailyRoutes
  const selectedVisibleRoute = visibleRoutes.find((route) => route.id === dashboard.selectedRoute.id)
  const routeFromUrl = routeId ? visibleRoutes.find((route) => route.id === routeId) : undefined
  const activeRoute = routeFromUrl ?? selectedVisibleRoute ?? visibleRoutes[0]
  const editingRouteId = dashboard.editingLetter
    ? dashboard.dailyRoutes.find((route) => route.actions.some((action) => action.letterId === dashboard.editingLetter?.id))?.id
    ?? dashboard.dailyRoutes.find((route) => route.date === dashboard.editingLetter?.serviceDate && dashboard.routeTemplates.find((template) => template.id === route.templateId)?.name === dashboard.editingLetter?.route)?.id
    : undefined
  const pendingLetters = isTransporter ? 0 : dashboard.letters.filter((letter) => letter.status === 'pendiente').length
  const routeLetterIds = new Set(visibleRoutes.flatMap((route) => route.actions.map((action) => action.letterId)))
  const visibleInvoices = isTransporter ? dashboard.invoices.filter((invoice) => routeLetterIds.has(invoice.letterId)) : dashboard.invoices

  useEffect(() => {
    if (isTransporter && !transporterSections.has(section)) replaceWithSection('rutas')
    else if (clientSections.has(section)) replaceWithSection('cartas')
  }, [isTransporter, replaceWithSection, section])

  useEffect(() => {
    if (section !== 'rutas' || !routeId) return
    if (routeFromUrl) dashboard.setSelectedRoute(routeFromUrl)
    else replaceWithSection('rutas')
  }, [dashboard, replaceWithSection, routeFromUrl, routeId, section])

  async function createRouteAndNavigate(template: Parameters<typeof dashboard.createDailyRoute>[0], date: string, transporterId?: string, direction: Parameters<typeof dashboard.createDailyRoute>[3] = 'normal') {
    const route = await dashboard.createDailyRoute(template, date, transporterId, direction)
    if (route) navigateToRoute(route.id)
  }

  return <>
    <DashboardLayout section={section} pendingLetters={pendingLetters} role={profile.role} displayName={profile.displayName} onNavigate={navigateToSection} onSignOut={dashboard.signOut}>
      {!isTransporter && section === 'cartas' && <LettersPage letters={dashboard.filteredLetters} search={dashboard.search} onSearchChange={dashboard.setSearch} onImport={() => dashboard.setShowImport(true)} onEdit={dashboard.setEditingLetter} onInvoice={dashboard.setInvoiceLetter} />}
      {!isTransporter && section === 'clientes' && <Suspense fallback={<PageLoading />}><ClientsPage clients={dashboard.clients} invoices={dashboard.invoices} letters={dashboard.letters} onSave={dashboard.saveClient} onDelete={dashboard.removeClient} /></Suspense>}
      {!isTransporter && section === 'plantillas' && <TemplatesPage templates={dashboard.routeTemplates} selected={dashboard.selectedTemplate} onSelect={dashboard.setSelectedTemplate} onCreate={dashboard.createRouteTemplate} onUpdate={dashboard.editRouteTemplate} onDelete={dashboard.removeRouteTemplate} onAddStop={dashboard.addTemplateStop} onReorderStops={dashboard.reorderTemplateStops} />}
      {section === 'rutas' && (activeRoute ? <RoutesPage route={activeRoute} template={dashboard.routeTemplates.find((template) => template.id === activeRoute.templateId) ?? dashboard.activeTemplate} templates={dashboard.routeTemplates} routes={visibleRoutes} letters={dashboard.letters} onSelect={(route) => { dashboard.setSelectedRoute(route); navigateToRoute(route.id) }} onAction={dashboard.updateActions} onUpdateStops={dashboard.updateRouteStops} onSuggestStop={dashboard.suggestRouteStop} onAddStop={dashboard.addRouteStop} onRemoveStop={dashboard.removeRouteStop} onUpdateService={dashboard.updateRouteService} onRemoveService={dashboard.removeRouteService} onCreate={() => dashboard.setShowNewRoute(true)} canManage={!isTransporter} /> : <EmptyRoute />)}
      {!isTransporter && section === 'furgoneta' && activeRoute && <VanPage route={activeRoute} assignments={dashboard.assignments} onPrint={() => downloadVanManifest(dashboard.assignments, dashboard.activeTemplate.name)} />}
      {!isTransporter && section === 'solicitudes' && <RequestsPage routes={visibleRoutes} onNotify={dashboard.toast} />}
      {section === 'facturas' && <InvoicesPage invoices={visibleInvoices} clients={dashboard.clients} transportista={isTransporter} onSend={dashboard.sendInvoiceNotification} onConfirmManualPayment={isTransporter ? undefined : dashboard.confirmManualPayment} />}
    </DashboardLayout>
    {!isTransporter && dashboard.showImport && <LetterFormDialog routes={dashboard.dailyRoutes} templates={dashboard.routeTemplates} onClose={() => dashboard.setShowImport(false)} onCreate={dashboard.createLetter} onAddStop={dashboard.addLetterRouteStop} />}
    {!isTransporter && dashboard.editingLetter && <LetterFormDialog routes={dashboard.dailyRoutes} templates={dashboard.routeTemplates} letter={dashboard.editingLetter} routeId={editingRouteId} onClose={() => dashboard.setEditingLetter(null)} onCreate={dashboard.editLetter} onAddStop={dashboard.addLetterRouteStop} />}
    {!isTransporter && dashboard.showNewRoute && <NewRouteDirectionDialog templates={dashboard.routeTemplates} transporters={dashboard.transporters} onClose={() => dashboard.setShowNewRoute(false)} onCreate={createRouteAndNavigate} />}
    {!isTransporter && dashboard.invoiceLetter && <InvoiceDialog letter={dashboard.invoiceLetter} onClose={() => dashboard.setInvoiceLetter(null)} onGenerate={dashboard.generateInvoice} />}
    {dashboard.notice && <div className="toast" role="status"><CheckCircle2 size={18} /> {dashboard.notice}</div>}
  </>
}

function EmptyRoute() {
  return <div className="page-loading">No tienes una ruta asignada para consultar.</div>
}

function PageLoading() {
  return <div className="page-loading" role="status">Cargando sección…</div>
}
