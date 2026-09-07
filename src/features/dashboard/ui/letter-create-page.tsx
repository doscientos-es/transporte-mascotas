import { Button } from '@doscientos/ui'
import { ArrowLeft } from 'lucide-react'

import { LetterForm, type LetterFormProps } from './operation-dialogs'

export function LetterCreatePage({ onClose, ...formProps }: LetterFormProps) {
  return (
    <section className="mx-auto max-w-190">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3"> </div>
        <Button type="button" variant="outline" onClick={onClose}>
          <ArrowLeft /> Volver a cartas
        </Button>
      </header>
      <LetterForm {...formProps} onClose={onClose} fullPage />
    </section>
  )
}
