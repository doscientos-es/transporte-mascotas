import { Button } from '@doscientos/ui'
import { ArrowLeft, FilePlus2 } from 'lucide-react'

import { LetterForm, type LetterFormProps } from './operation-dialogs'

export function LetterCreatePage({ onClose, ...formProps }: LetterFormProps) {
  return (
    <section className="mx-auto max-w-190">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="dialog-icon" aria-hidden="true">
            <FilePlus2 size={24} />
          </div>
          <div>
            <h2 className="text-accent m-0 text-xl">Nueva carta de porte</h2>
            <p className="text-muted-foreground mt-1 mb-0 text-sm">
              Completa los datos, revísalos y firma la carta antes de guardarla.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={onClose}>
          <ArrowLeft /> Volver a cartas
        </Button>
      </header>
      <LetterForm {...formProps} onClose={onClose} fullPage />
    </section>
  )
}
