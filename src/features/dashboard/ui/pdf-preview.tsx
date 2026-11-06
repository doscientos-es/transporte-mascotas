import type { PDFDocumentLoadingTask } from 'pdfjs-dist'
import { useEffect, useRef, useState, type ReactNode } from 'react'

export function PdfPreview({
  blob,
  fallback,
  className = 'invoice-preview-pdf',
  label = 'Vista previa del PDF',
  scale = 1.35,
}: {
  blob: Blob
  fallback: ReactNode
  className?: string
  label?: string
  scale?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [failedBlob, setFailedBlob] = useState<Blob | null>(null)

  useEffect(() => {
    let active = true
    let loadingTask: PDFDocumentLoadingTask | undefined
    void Promise.all([import('pdfjs-dist/legacy/build/pdf.mjs'), blob.arrayBuffer()])
      .then(([pdfjs, data]) => {
        if (!active) return null
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
          import.meta.url,
        ).toString()
        loadingTask = pdfjs.getDocument({ data })
        return loadingTask.promise
      })
      .then(async (pdf) => {
        if (!pdf) return
        const page = await pdf.getPage(1)
        if (!active || !canvasRef.current) return
        const viewport = page.getViewport({ scale })
        const canvas = canvasRef.current
        canvas.width = viewport.width
        canvas.height = viewport.height
        const canvasContext = canvas.getContext('2d')
        if (!canvasContext) throw new Error('No se ha podido preparar la vista previa.')
        await page.render({ canvas, canvasContext, viewport }).promise
      })
      .catch(() => {
        if (active) setFailedBlob(blob)
      })
    return () => {
      active = false
      void loadingTask?.destroy().catch(() => { })
    }
  }, [blob, scale])

  if (failedBlob === blob) return fallback
  return <canvas ref={canvasRef} className={className} aria-label={label} />
}