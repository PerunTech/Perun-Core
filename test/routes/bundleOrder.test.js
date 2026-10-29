import { describe, expect, it, vi } from 'vitest'
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

  it('leaves out a bundle whose dependency is not in the list, and the bundles that depend on it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(ids([
      { id: 'epi', deps: '["farm-registry"]' },
      { id: 'farm-registry', deps: '["perun-atlas"]' },
      { id: 'lims' }
    ])).toEqual(['lims'])
    expect(warn.mock.calls).toEqual([
      ['Skipping plugin farm-registry: its dependency perun-atlas is not available.'],
      ['Skipping plugin epi: its dependency farm-registry is not available.']
    ])
    warn.mockRestore()
  })

  it('counts perun-core as there when the list does not name it', () => {
    expect(ids([{ id: 'epi', deps: '["perun-core"]' }])).toEqual(['epi'])
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
