import type { ReactNode } from 'react'

export function PageIntro({ text, children }: { text: string; children?: ReactNode }) {
  return (
    <div className="page-intro">
      <p>{text}</p>
      {children}
    </div>
  )
}
