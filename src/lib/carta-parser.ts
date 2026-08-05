import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { AnimalSize, Letter } from './types'

GlobalWorkerOptions.workerSrc = workerUrl

const sizeByBreed: Record<string, AnimalSize> = {
  teckel: 'mediano', podenco: 'grande', yorkshire: 'pequeno', chihuahua: 'pequeno',
  pomerania: 'pequeno', caniche: 'pequeno', labrador: 'grande', pastor: 'grande',
  rottweiler: 'grande', husky: 'grande', bulldog: 'mediano', beagle: 'mediano',
}

function clean(value: string | undefined) { return value?.replace(/\s+/g, ' ').trim() ?? '' }
function fieldAfter(text: string, labels: string[]) {
  const label = labels.join('|')
  const result = text.match(new RegExp(`(?:${label})\\s*[:\\-]?\\s*([^\\n]{2,80})`, 'i'))
  return clean(result?.[1])
}

export async function parseCartaPdf(file: File): Promise<Partial<Letter>> {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('Selecciona un archivo PDF.')
  if (file.size > 10 * 1024 * 1024) throw new Error('El PDF supera el límite de 10 MB.')
  const source = await file.arrayBuffer()
  const pdf = await getDocument({ data: source }).promise
  const pages = await Promise.all(Array.from({ length: pdf.numPages }, async (_, pageIndex) => {
    const content = await (await pdf.getPage(pageIndex + 1)).getTextContent()
    return content.items.map((item) => 'str' in item ? item.str : '').join('\n')
  }))
  const text = clean(pages.join('\n'))
  if (!text) throw new Error('No se ha encontrado texto digital en el PDF. Sube una carta de porte con texto seleccionable.')
  const number = text.match(/CARTA\s+DE\s+PORTE\s*(?:N[º°O.]*)?\s*([A-Z0-9\-/]+)/i)?.[1]
  const id = number ? `CARTA DE PORTE Nº ${number}` : ''
  const breed = fieldAfter(text, ['Raza', 'Raza\/es']) || 'Sin clasificar'
  const normalizedBreed = breed.toLocaleLowerCase('es-ES')
  const origin = fieldAfter(text, ['Origen', 'Punto de origen']) || 'Sin asignar'
  const destination = fieldAfter(text, ['Destino', 'Punto de destino']) || 'Sin asignar'
  const sender = fieldAfter(text, ['Remitente', 'Nombre remitente']) || 'Pendiente de revisar'
  const recipient = fieldAfter(text, ['Destinatario', 'Nombre destinatario']) || 'Pendiente de revisar'
  const phones = text.match(/(?:\+34\s?)?(?:6|7|8|9)\d(?:[\s.-]?\d){7,8}/g) ?? []
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? ''
  const species = /felina/i.test(text) ? 'Felina' : /ave/i.test(text) ? 'Ave' : /canina/i.test(text) ? 'Canina' : 'Otro'
  return {
    id,
    sender,
    senderPhone: clean(phones[0]),
    recipient,
    recipientPhone: clean(phones[1]),
    origin,
    destination,
    route: 'Sin asignar',
    animals: [{ id: crypto.randomUUID(), species, breed, size: sizeByBreed[normalizedBreed] ?? 'pequeno' }],
    importedAt: new Date().toLocaleString('es-ES'),
    extractionEmail: email,
  } as Partial<Letter>
}
