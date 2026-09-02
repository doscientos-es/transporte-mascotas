import type { Session } from '@supabase/supabase-js'
import { CheckCircle2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import type { DashboardNavigation, UserProfile } from '@/shared/types'
import { DashboardLayout } from '@/shared/ui/dashboard-layout'
import { SectionBoundary } from '@/shared/ui/section-boundary'

import { useDashboard } from '../application/use-dashboard'
import { assignmentsForRoute } from '../application/van'
const ClientsPage = lazy(() =>
  import('./clients-page').then(({ ClientsPage: page }) => ({ default: page })),
)
const InvoicesPage = lazy(() =>
  import('./invoices-page').then(({ InvoicesPage: page }) => ({ default: page })),
)
const LettersPage = lazy(() =>
  import('./letters-page').then(({ LettersPage: page }) => ({ default: page })),
)
const RequestsPage = lazy(() =>
  import('./requests-page').then(({ RequestsPage: page }) => ({ default: page })),
)
const RoutesPage = lazy(() =>
  import('./routes-page').then(({ RoutesPage: page }) => ({ default: page })),
)
const SettingsPage = lazy(() =>
  import('./settings-page').then(({ SettingsPage: page }) => ({ default: page })),
)
const WhatsAppTestPage = lazy(() =>
  import('./whatsapp-test-page').then(({ WhatsAppTestPage: page }) => ({ default: page })),
)
const TemplatesPage = lazy(() =>
  import('./templates-page').then(({ TemplatesPage: page }) => ({ default: page })),
)
const VanPage = lazy(() => import('./van-page').then(({ VanPage: page }) => ({ default: page })))
const InvoiceDialog = lazy(() =>
  import('./operation-dialogs').then(({ InvoiceDialog: dialog }) => ({ default: dialog })),
)
const LetterFormDialog = lazy(() =>
  import('./operation-dialogs').then(({ LetterFormDialog: dialog }) => ({ default: dialog })),
)
const NewRouteDirectionDialog = lazy(() =>
  import('./operation-dialogs').then(({ NewRouteDirectionDialog: dialog }) => ({
    default: dialog,
  })),
)

export function AdminDashboardPage({
  session,
  profile,
  navigation,
}: {
  session: Session | null
  profile: UserProfile
  navigation: DashboardNavigation
}) {
  const dashboard = useDashboard(session, profile.role)
  const [printingManifest, setPrintingManifest] = useState(false)
  const navigate = useNavigate()
  const {
    section,
    routeId,
    navigateToSection,
    navigateToRoute,
    navigateToVan,
    replaceWithSection,
  } = navigation
  const isTransporter = profile.role === 'transportista'
  const ensureLetters = dashboard.ensureLetters
  const visibleRoutes =
    isTransporter && session
      ? dashboard.dailyRoutes.filter((route) => route.transporterId === session.user.id)
      : dashboard.dailyRoutes
  const selectedVisibleRoute = visibleRoutes.find(
    (route) => route.id === dashboard.selectedRoute?.id,
  )
  const routeFromUrl = routeId ? visibleRoutes.find((route) => route.id === routeId) : undefined
  const activeRoute = routeFromUrl ?? selectedVisibleRoute ?? visibleRoutes[0]
  const activeTemplate = activeRoute
    ? dashboard.routeTemplates.find((template) => template.id === activeRoute.templateId)
    : undefined
  const activeAssignments = activeRoute ? assignmentsForRoute(activeRoute) : []
  const editingRouteId = dashboard.editingLetter
    ? (dashboard.dailyRoutes.find((route) =>
        route.actions.some((action) => action.letterId === dashboard.editingLetter?.id),
      )?.id ??
      dashboard.dailyRoutes.find(
        (route) =>
          route.date === dashboard.editingLetter?.serviceDate &&
          dashboard.routeTemplates.find((template) => template.id === route.templateId)?.name ===
            dashboard.editingLetter?.route,
      )?.id)
    : undefined
  const pendingLetters = isTransporter
    ? 0
    : dashboard.letters.filter((letter) => letter.status === 'pendiente').length
  const sectionNeedsLetters =
    !isTransporter && ['cartas', 'clientes', 'rutas', 'furgoneta'].includes(section)

  useEffect(() => {
    if ((section !== 'rutas' && section !== 'furgoneta') || !routeId) return
    if (dashboard.routesLoading) return
    if (routeFromUrl) dashboard.setSelectedRoute(routeFromUrl)
    else replaceWithSection(section)
  }, [dashboard, replaceWithSection, routeFromUrl, routeId, section])

  useEffect(() => {
    if (sectionNeedsLetters) void ensureLetters()
  }, [ensureLetters, sectionNeedsLetters])

  async function createRouteAndNavigate(
    template: Parameters<typeof dashboard.createDailyRoute>[0],
    date: string,
    transporterId?: string,
    direction: Parameters<typeof dashboard.createDailyRoute>[3] = 'normal',
    selectedStopIds: Parameters<typeof dashboard.createDailyRoute>[4] = [],
  ) {
    const route = await dashboard.createDailyRoute(
      template,
      date,
      transporterId,
      direction,
      selectedStopIds,
    )
    if (route) navigateToRoute(route.id)
  }

  async function printVanManifest() {
    if (!activeRoute || printingManifest) return
    setPrintingManifest(true)
    try {
      const { downloadVanManifest } = await import('../application/van-manifest-pdf')
      await downloadVanManifest(
        activeAssignments,
        dashboard.routeTemplates.find((template) => template.id === activeRoute.templateId)?.name ??
          'ruta',
      )
    } catch {
      dashboard.toast('No se ha podido generar el PDF. Vuelve a intentarlo.')
    } finally {
      setPrintingManifest(false)
    }
  }

  function openInvoicesForLetter(letterId: string) {
    void navigate(`${navigation.hrefForSection('facturas')}?letter=${encodeURIComponent(letterId)}`)
  }

  function openClient(clientId: string) {
    void navigate(`${navigation.hrefForSection('clientes')}?client=${encodeURIComponent(clientId)}`)
  }

  function searchClient(clientName: string) {
    void navigate(`${navigation.hrefForSection('clientes')}?q=${encodeURIComponent(clientName)}`)
  }

  function openLetter(letterId: string) {
    void navigate(`${navigation.hrefForSection('cartas')}?carta=${encodeURIComponent(letterId)}`)
  }

  return (
    <>
      <DashboardLayout
        section={section}
        pendingLetters={pendingLetters}
        profileRole={profile.role}
        displayName={profile.displayName}
        title={section === 'whatsapp-test' ? 'Pruebas de WhatsApp' : undefined}
        onNavigate={navigateToSection}
        hrefForSection={navigation.hrefForSection}
        onSignOut={() => void dashboard.signOut()}
      >
        <SectionBoundary>
          <Suspense fallback={<PageLoading />}>
            {!isTransporter && section === 'cartas' && (
              <LettersPage
                letters={dashboard.letters}
                loading={dashboard.lettersLoading}
                error={dashboard.lettersError}
                onRetry={() => void dashboard.ensureLetters(true)}
                onImport={() => dashboard.setShowImport(true)}
                onEdit={dashboard.setEditingLetter}
                onInvoice={dashboard.setInvoiceLetter}
                onOpenClient={searchClient}
                onOpenInvoices={openInvoicesForLetter}
              />
            )}
            {!isTransporter && section === 'clientes' && (
              <ClientsPage
                letters={dashboard.letters}
                onSave={dashboard.saveClient}
                onDelete={dashboard.removeClient}
                onOpenInvoice={openInvoicesForLetter}
                onOpenLetter={openLetter}
              />
            )}
            {!isTransporter && section === 'plantillas' && (
              <TemplatesPage
                templates={dashboard.routeTemplates}
                selected={dashboard.selectedTemplate}
                onSelect={dashboard.setSelectedTemplate}
                onCreate={dashboard.createRouteTemplate}
                onUpdate={dashboard.editRouteTemplate}
                onDelete={dashboard.removeRouteTemplate}
                onAddStop={dashboard.addTemplateStop}
                onReorderStops={dashboard.reorderTemplateStops}
              />
            )}
            {section === 'rutas' &&
              (dashboard.routesLoading ? (
                <PageLoading />
              ) : activeRoute && activeTemplate ? (
                <RoutesPage
                  route={activeRoute}
                  template={activeTemplate}
                  templates={dashboard.routeTemplates}
                  routes={visibleRoutes}
                  letters={dashboard.letters}
                  onSelect={(route) => {
                    dashboard.setSelectedRoute(route)
                    navigateToRoute(route.id)
                  }}
                  onOpenVan={
                    isTransporter
                      ? undefined
                      : (route) => {
                          dashboard.setSelectedRoute(route)
                          navigateToVan(route.id)
                        }
                  }
                  onAction={dashboard.updateActions}
                  onUpdateStops={dashboard.updateRouteStops}
                  onSuggestStop={dashboard.suggestRouteStop}
                  onAddStop={dashboard.addRouteStop}
                  onRemoveStop={dashboard.removeRouteStop}
                  onUpdateService={dashboard.updateRouteService}
                  onRemoveService={dashboard.removeRouteService}
                  onCloseRoute={dashboard.closeRoute}
                  onCreate={() => dashboard.setShowNewRoute(true)}
                  canManage={!isTransporter}
                />
              ) : (
                <EmptyRoute />
              ))}
            {!isTransporter && section === 'furgoneta' && activeRoute && (
              <VanPage
                route={activeRoute}
                routes={visibleRoutes}
                templates={dashboard.routeTemplates}
                letters={dashboard.letters}
                assignments={activeAssignments}
                canManage={profile.role === 'admin'}
                onSelectRoute={(route) => {
                  dashboard.setSelectedRoute(route)
                  navigateToVan(route.id)
                }}
                onReassignBox={(letterId, box) =>
                  dashboard.reassignRouteBox(activeRoute.id, letterId, box)
                }
                onPrint={() => void printVanManifest()}
                printing={printingManifest}
              />
            )}
            {!isTransporter && section === 'solicitudes' && (
              <RequestsPage routes={visibleRoutes} onNotify={dashboard.toast} />
            )}
            {profile.role === 'admin' && section === 'ajustes' && (
              <SettingsPage
                transporters={dashboard.transporters}
                onPromote={dashboard.promoteTransporter}
              />
            )}
            {profile.role === 'admin' && section === 'whatsapp-test' && (
              <WhatsAppTestPage onBack={() => navigateToSection('ajustes')} />
            )}
            {section === 'facturas' && (
              <InvoicesPage
                transportista={isTransporter}
                onSend={dashboard.sendInvoiceNotification}
                onConfirmManualPayment={isTransporter ? undefined : dashboard.confirmManualPayment}
                onOpenClient={isTransporter ? undefined : openClient}
                onOpenLetter={isTransporter ? undefined : openLetter}
              />
            )}
          </Suspense>
        </SectionBoundary>
      </DashboardLayout>
      <SectionBoundary label="No hemos podido abrir esta ventana. Vuelve a intentarlo.">
        <Suspense fallback={null}>
          {!isTransporter && dashboard.showImport && (
            <LetterFormDialog
              routes={dashboard.dailyRoutes}
              templates={dashboard.routeTemplates}
              onClose={() => dashboard.setShowImport(false)}
              onCreate={dashboard.createLetter}
              onAddStop={dashboard.addLetterRouteStop}
            />
          )}
          {!isTransporter && dashboard.editingLetter && (
            <LetterFormDialog
              routes={dashboard.dailyRoutes}
              templates={dashboard.routeTemplates}
              letter={dashboard.editingLetter}
              routeId={editingRouteId}
              onClose={() => dashboard.setEditingLetter(null)}
              onCreate={dashboard.editLetter}
              onAddStop={dashboard.addLetterRouteStop}
            />
          )}
          {!isTransporter && dashboard.showNewRoute && (
            <NewRouteDirectionDialog
              templates={dashboard.routeTemplates}
              transporters={dashboard.transporters}
              onClose={() => dashboard.setShowNewRoute(false)}
              onCreate={createRouteAndNavigate}
            />
          )}
          {!isTransporter && dashboard.invoiceLetter && (
            <InvoiceDialog
              letter={dashboard.invoiceLetter}
              onClose={() => dashboard.setInvoiceLetter(null)}
              onGenerate={dashboard.generateInvoice}
            />
          )}
        </Suspense>
      </SectionBoundary>
      {dashboard.notice && (
        <output className="toast">
          <CheckCircle2 size={18} /> {dashboard.notice}
        </output>
      )}
    </>
  )
}

function EmptyRoute() {
  return <div className="page-loading">No tienes una ruta asignada para consultar.</div>
}

function PageLoading() {
  return <output className="page-loading">Cargando sección…</output>
}
