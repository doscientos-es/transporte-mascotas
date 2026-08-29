import { PageHeader, PageHeaderDescription } from '@doscientos/ui'
import type { ReactNode } from 'react'

export function PageIntro({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <PageHeader className="page-intro">
      <PageHeaderDescription>{text}</PageHeaderDescription>
      {children}
    </PageHeader>
  )
}
