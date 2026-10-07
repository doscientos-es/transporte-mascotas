import { describe, expect, it } from 'vitest'

import { mergedStopInstructions } from './stop-instructions'

describe('mergedStopInstructions', () => {
  it('combines the former site name and directions without duplicates', () => {
    expect(mergedStopInstructions(' Clínica Sol ', 'Entrada principal', 'Clínica Sol')).toBe(
      'Clínica Sol · Entrada principal',
    )
  })

  it('ignores missing and blank values', () => {
    expect(mergedStopInstructions(undefined, ' ', 'Esperar junto a la puerta')).toBe(
      'Esperar junto a la puerta',
    )
  })
})
