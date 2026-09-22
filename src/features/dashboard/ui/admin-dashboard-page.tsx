import { Button } from '@doscientos/ui'
import type { Session } from '@supabase/supabase-js'
import { CalendarDays, CheckCircle2, FilePlus2, Plus, Printer } from 'lucide-react'
import { lazy, Suspense, useEffect, useState, type ComponentType } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  createAdminTransportRequest,
  ClientRequestForm,
  type RequestFormValues,
} from '@/features/client-portal'
import type { ClientInvoice, DashboardNavigation, UpcomingRoute, UserProfile } from '@/shared/types'
import { DashboardLayout } from '@/shared/ui/dashboard-layout'
import { SectionBoundary } from '@/shared/ui/section-boundary'

import { useDashboard } from '../application/use-dashboard'
import { assignmentsForRoute } from '../application/van'
function lazyWithRetry<T extends Record<string, unknown>, P>(
  load: () => Promise<T>,
  select: (module: T) => ComponentType<P>,
) {
  return lazy(async () => {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const loaded = select(await load())
        sessionStorage.removeItem('kache:chunk-reload')
        return { default: loaded }
      } catch (error) {
        lastError = error
        if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 150))
      }
    }
    if (isStaleChunkError(lastError)) {
      const reloadKey = 'kache:chunk-reload'
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1')
        window.location.reload()
        throw new Error('Actualizando la aplicación…')
      }
      sessionStorage.removeItem(reloadKey)
    }
    throw lastError instanceof Error ? lastError : new Error('No se ha podido cargar la sección.')
  })
}

function isStaleChunkError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /dynamically imported module|importing a module script failed|loading chunk/i.test(message)
}

const ClientsPage = lazyWithRetry(
  () => import('./clients-page'),
  ({ ClientsPage: page }) => page,
)
const InvoicesPage = lazyWithRetry(
  () => import('./invoices-page'),
  ({ InvoicesPage: page }) => page,
)
const PaymentRequestsPage = lazyWithRetry(
  () => import('./payment-requests-page'),
  ({ PaymentRequestsPage: page }) => page,
)
const LettersPage = lazyWithRetry(
  () => import('./letters-page'),
  ({ LettersPage: page }) => page,
)
const RequestsPage = lazyWithRetry(
  () => import('./requests-page'),
  ({ RequestsPage: page }) => page,
)
const RoutesPage = lazyWithRetry(
  () => import('./routes-page'),
  ({ RoutesPage: page }) => page,
)
const RoutesCatalogPage = lazyWithRetry(
  () => import('./routes-page'),
  ({ RoutesCatalogPage: page }) => page,
)
const SettingsPage = lazyWithRetry(
  () => import('./settings-page'),
  ({ SettingsPage: page }) => page,
)
const WhatsAppTestPage = lazyWithRetry(
  () => import('./whatsapp-test-page'),
  ({ WhatsAppTestPage: page }) => page,
)
const TemplatesPage = lazyWithRetry(
  () => import('./templates-page'),
  ({ TemplatesPage: page }) => page,
)
const VanPage = lazyWithRetry(
  () => import('./van-page'),
  ({ VanPage: page }) => page,
)
const LetterFormDialog = lazyWithRetry(
  () => import('./operation-dialogs'),
  ({ LetterFormDialog: dialog }) => dialog,
)
const LetterCreatePage = lazyWithRetry(
  () => import('./letter-create-page'),
  ({ LetterCreatePage: page }) => page,
)
const NewRouteDirectionDialog = lazyWithRetry(
  () => import('./operation-dialogs'),
  ({ NewRouteDirectionDialog: dialog }) => dialog,
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
  const [clientCreateRequestId, setClientCreateRequestId] = useState(0)
  const [templateCreateRequestId, setTemplateCreateRequestId] = useState(0)
  const [creatingTransport, setCreatingTransport] = useState(false)
  const navigate = useNavigate()
  const {
    section,
    routeId,
    navigateToSection,
    navigateToLetterCreate,
    navigateToRoute,
    navigateToVan,
    replaceWithSection,
    isCreatingLetter,
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
  const routesLoading = dashboard.routesLoading
  const setSelectedRoute = dashboard.setSelectedRoute
  const requestRoutes: UpcomingRoute[] = visibleRoutes
    .filter(
      (route) => route.status === 'activa' && route.date >= new Date().toISOString().slice(0, 10),
    )
    .map((route) => {
      const template = dashboard.routeTemplates.find((item) => item.id === route.templateId)
      const stops = route.stops ?? []
      return {
        id: route.id,
        serviceDate: route.date,
        routeDirection: route.direction ?? 'normal',
        templateName: template?.name ?? 'Ruta programada',
        templateColor: template?.color ?? '',
        localities: stops.map((stop) => stop.locality),
        stops,
      }
    })

  useEffect(() => {
    if ((section !== 'rutas' && section !== 'furgoneta') || !routeId) return
    if (routesLoading) return
    if (routeFromUrl) setSelectedRoute(routeFromUrl)
    else replaceWithSection(section)
  }, [replaceWithSection, routeFromUrl, routeId, routesLoading, section, setSelectedRoute])

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

  function openPaymentRequestForLetter(letterId: string) {
    void navigate(
      `${navigation.hrefForSection('solicitudes')}?letter=${encodeURIComponent(letterId)}`,
    )
  }

  function openBillingDocument(invoice: ClientInvoice) {
    const section = invoice.status === 'solicitud_pago' ? 'solicitudes' : 'facturas'
    void navigate(`${navigation.hrefForSection(section)}?invoice=${encodeURIComponent(invoice.id)}`)
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

  async function createManualTransport(values: RequestFormValues) {
    await createAdminTransportRequest(values)
    setCreatingTransport(false)
    dashboard.toast('Solicitud creada sin cobro y pendiente de revisión.')
  }

  return (
    <>
      <DashboardLayout
        section={section}
        pendingLetters={pendingLetters}
        profileRole={profile.role}
        displayName={profile.displayName}
        title={
          isCreatingLetter
            ? 'Nueva carta de porte'
            : section === 'whatsapp-test'
              ? 'Pruebas de WhatsApp'
              : undefined
        }
        headerAction={
          !isTransporter && section === 'rutas' ? (
            <Button onClick={() => dashboard.setShowNewRoute(true)}>
              <CalendarDays /> Crear ruta
            </Button>
          ) : !isTransporter && section === 'furgoneta' && activeRoute ? (
            <Button disabled={printingManifest} onClick={() => void printVanManifest()}>
              <Printer /> {printingManifest ? 'Preparando PDF…' : 'Imprimir tramo'}
            </Button>
          ) : !isTransporter && !isCreatingLetter && section === 'cartas' ? (
            <Button onClick={navigateToLetterCreate}>
              <FilePlus2 /> Nueva carta
            </Button>
          ) : !isTransporter && section === 'clientes' ? (
            <Button onClick={() => setClientCreateRequestId((current) => current + 1)}>
              <Plus /> Nuevo cliente
            </Button>
          ) : !isTransporter && section === 'plantillas' ? (
            <Button onClick={() => setTemplateCreateRequestId((current) => current + 1)}>
              <Plus /> Nueva plantilla
            </Button>
          ) : !isTransporter && section === 'solicitudes' && !creatingTransport ? (
            <Button onClick={() => setCreatingTransport(true)}>
              <FilePlus2 /> Nuevo transporte
            </Button>
          ) : undefined
        }
        onNavigate={navigateToSection}
        hrefForSection={navigation.hrefForSection}
        onSignOut={() => void dashboard.signOut()}
      >
        <SectionBoundary>
          <Suspense fallback={<PageLoading />}>
            {isCreatingLetter ? (
              <LetterCreatePage
                routes={dashboard.dailyRoutes}
                templates={dashboard.routeTemplates}
                onClose={() => navigateToSection('cartas')}
                onCreate={async (draft) => {
                  await dashboard.createLetter(draft)
                  void navigate(navigation.hrefForSection('solicitudes'))
                }}
                onAddStop={dashboard.addLetterRouteStop}
              />
            ) : (
              !isTransporter &&
              section === 'cartas' && (
                <LettersPage
                  letters={dashboard.letters}
                  loading={dashboard.lettersLoading}
                  error={dashboard.lettersError}
                  onRetry={() => void dashboard.ensureLetters(true)}
                  onEdit={dashboard.setEditingLetter}
                  onOpenClient={searchClient}
                  onOpenPaymentRequests={openPaymentRequestForLetter}
                />
              )
            )}
            {!isTransporter && section === 'clientes' && (
              <ClientsPage
                letters={dashboard.letters}
                createRequestId={clientCreateRequestId}
                onSave={dashboard.saveClient}
                onDelete={dashboard.removeClient}
                onOpenDocument={openBillingDocument}
                onOpenLetter={openLetter}
              />
            )}
            {!isTransporter && section === 'plantillas' && (
              <TemplatesPage
                templates={dashboard.routeTemplates}
                selected={dashboard.selectedTemplate}
                createRequestId={templateCreateRequestId}
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
              ) : routeFromUrl && activeRoute && activeTemplate ? (
                <RoutesPage
                  route={activeRoute}
                  template={activeTemplate}
                  letters={dashboard.letters}
                  onBack={() => navigateToSection('rutas')}
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
                  canManage={!isTransporter}
                />
              ) : (
                <RoutesCatalogPage
                  routes={visibleRoutes}
                  templates={dashboard.routeTemplates}
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
                />
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
              />
            )}
            {!isTransporter && section === 'solicitudes' && creatingTransport && (
              <ClientRequestForm
                adminMode
                routes={requestRoutes}
                savedPets={[]}
                contactName=""
                contactPhone=""
                contactEmail=""
                onSubmit={createManualTransport}
                onCancel={() => setCreatingTransport(false)}
                onSavePets={async () => undefined}
                boxCatalog={dashboard.boxCatalog}
              />
            )}
            {!isTransporter && section === 'solicitudes' && !creatingTransport && (
              <>
                <PaymentRequestsPage
                  transportista={false}
                  onConfirmManualPayment={dashboard.confirmManualPayment}
                  onPaymentConfirmed={openBillingDocument}
                  onOpenClient={openClient}
                  onOpenLetter={openLetter}
                />
                <RequestsPage routes={visibleRoutes} onNotify={dashboard.toast} />
              </>
            )}
            {profile.role === 'admin' && section === 'ajustes' && (
              <SettingsPage
                transporters={dashboard.transporters}
                onPromote={dashboard.promoteTransporter}
                boxCatalog={dashboard.boxCatalog}
                onSaveBoxCatalog={dashboard.updateBoxCatalog}
              />
            )}
            {profile.role === 'admin' && section === 'whatsapp-test' && (
              <WhatsAppTestPage onBack={() => navigateToSection('ajustes')} />
            )}
            {section === 'facturas' && (
              <InvoicesPage
                transportista={isTransporter}
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
        </Suspense>
      </SectionBoundary>
      {dashboard.notice && (
        <output className="toast" aria-live="polite">
          <CheckCircle2 size={18} /> {dashboard.notice}
        </output>
      )}
    </>
  )
}

function PageLoading() {
  return <output className="page-loading">Cargando sección…</output>
}
