import { describe, it, expect } from 'vitest'

describe('Example Unit Test', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle string operations', () => {
    const str = 'nanopore-tracking-app'
    expect(str.includes('nanopore')).toBe(true)
    expect(str.length).toBeGreaterThan(0)
  })

  it('should handle array operations', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(arr.length).toBe(5)
    expect(arr.includes(3)).toBe(true)
  })
}) 