import { PageHeader, PageHeaderActions, PageHeaderDescription } from '@doscientos/ui'
import type { ReactNode } from 'react'

export function PageIntro({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <PageHeader className="mb-6 flex-row items-end justify-between gap-[18px] max-[850px]:items-start">
      <PageHeaderDescription className="mt-0 text-sm text-[#686868] max-[850px]:max-w-[310px]">
        {text}
      </PageHeaderDescription>
      {children && (
        <PageHeaderActions className="[&>button]:min-h-[42px]">{children}</PageHeaderActions>
      )}
    </PageHeader>
  )
}
