import { describe, expect, it } from 'vitest'
import { sortBundlesByDependencies } from '../../frontend/routes/bundleOrder'

const ids = (bundles) => sortBundlesByDependencies(bundles).map(bundle => bundle.id)

describe('sortBundlesByDependencies', () => {
  it('puts each bundle after the ones it depends on', () => {
    expect(ids([
      { id: 'farm-registry', deps: '["perun-atlas"]' },
      { id: 'perun-atlas', deps: '["spatial"]' },
      { id: 'spatial' }
    ])).toEqual(['spatial', 'perun-atlas', 'farm-registry'])
  })

  it('keeps the given order where nothing constrains it, and lists a shared dependency once', () => {
    expect(ids([
      { id: 'epi', deps: '["spatial"]' },
      { id: 'lims' },
      { id: 'farm-registry', deps: '["spatial"]' },
      { id: 'spatial', deps: '' }
    ])).toEqual(['spatial', 'epi', 'lims', 'farm-registry'])
  })

  it('loads a bundle whose dependency is not in the list', () => {
    expect(ids([{ id: 'epi', deps: '["missing"]' }])).toEqual(['epi'])
  })

  it('refuses a cycle', () => {
    expect(() => ids([
      { id: 'a', deps: '["b"]' },
      { id: 'b', deps: '["a"]' }
    ])).toThrow('Circular dependency detected: a')
  })

  it('refuses dependencies that are not JSON', () => {
    expect(() => ids([{ id: 'a', deps: 'spatial' }])).toThrow(SyntaxError)
  })
})
