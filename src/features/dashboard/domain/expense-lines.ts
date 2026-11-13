export type ExpenseLine = {
  description: string
  netAmount: number
  vatRate: number
}

export type ExpenseLineDraft = {
  id: number
  description: string
  netAmount: string
  vatRate: string
}

function decimal(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(normalized)) return null
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

export function parseExpenseLines(drafts: ExpenseLineDraft[]): ExpenseLine[] {
  if (!drafts.length) throw new Error('Añade al menos una partida.')
  if (drafts.length > 100) throw new Error('El gasto no puede tener más de 100 partidas.')
  const lines = drafts.map((draft, index) => {
    const netAmount = decimal(draft.netAmount)
    const vatRate = decimal(draft.vatRate)
    if (netAmount === null || netAmount > 9999999999.99)
      throw new Error(`La base imponible de la partida ${index + 1} no es válida.`)
    if (vatRate === null || vatRate > 100)
      throw new Error(`El IVA de la partida ${index + 1} debe estar entre 0 y 100.`)
    return { description: draft.description.trim(), netAmount, vatRate }
  })
  if (expenseLineTotals(lines).totalAmount > 9999999999.99)
    throw new Error('El total del gasto es demasiado grande.')
  return lines
}

export function expenseLineTotals(lines: ExpenseLine[]) {
  const totals = lines.reduce(
    (sum, line) => {
      const net = Math.round(line.netAmount * 100)
      const rate = Math.round(line.vatRate * 100)
      const vat = Number((BigInt(net) * BigInt(rate) + 5000n) / 10000n)
      return { net: sum.net + net, vat: sum.vat + vat }
    },
    { net: 0, vat: 0 },
  )
  return {
    netAmount: totals.net / 100,
    vatAmount: totals.vat / 100,
    totalAmount: (totals.net + totals.vat) / 100,
  }
}
