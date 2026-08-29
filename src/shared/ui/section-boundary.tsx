import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; label?: string }
type State = { hasError: boolean }

/** Preserves the dashboard shell when an independently loaded section fails. */
export class SectionBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <section className="page-loading app-state" role="alert">
        <div>
          <h2>Vamos a solucionarlo</h2>
          <p>
            {this.props.label ??
              'Esta sección no se ha podido abrir. Recarga la página para volver a intentarlo.'}
          </p>
          <button type="button" onClick={() => window.location.reload()}>
            Recargar página
          </button>
        </div>
      </section>
    )
  }
}
