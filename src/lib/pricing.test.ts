import { describe, expect, it } from 'vitest'
import { allowedCategories, priceFor, recommendCategory } from './pricing'

describe('asignación comercial de boxes', () => {
  it('eleva la categoría cuando el peso supera el límite seguro', () => {
    expect(recommendCategory(18, 'pequeno')).toBe('grande')
  })

  it('conserva una categoría superior indicada por tamaño', () => {
    expect(recommendCategory(8, 'grande')).toBe('grande')
  })

  it('solo permite subir de categoría respecto a la recomendada', () => {
    expect(allowedCategories('mediano')).toEqual(['mediano', 'grande'])
  })

  it('aplica las tarifas configuradas por categoría', () => {
    expect(priceFor('pequeno')).toBe(100)
    expect(priceFor('mediano')).toBe(120)
    expect(priceFor('grande')).toBe(180)
  })
})
