// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  globalThis.__PERUN_CORE_MODULES__ = {
    csv: 'csv.perun-core.js?v=1a2b',
    broken: 'data:text/javascript,throw new Error("broken")',
    answer: 'data:text/javascript,export const answer = 42'
  }
})

import { loadModule, moduleUrl } from '../../frontend/functions/modules'

describe('moduleUrl', () => {
  const files = { pdfmake: 'pdfmake.perun-core.js?v=9f8e' }

  it("puts the module's file beside the bundle", () => {
    expect(moduleUrl('pdfmake', 'https://aims.example/perun/perun-core.js', files)).toBe('https://aims.example/perun/pdfmake.perun-core.js?v=9f8e')
    expect(moduleUrl('pdfmake', 'https://aims.example/perun/perun-core.js?v=4.5.8', files)).toBe('https://aims.example/perun/pdfmake.perun-core.js?v=9f8e')
  })

  it('is null without a bundle URL or a file for the module', () => {
    expect(moduleUrl('pdfmake', null, files)).toBeNull()
    expect(moduleUrl('xlsx', 'https://aims.example/perun/perun-core.js', files)).toBeNull()
  })

  it('reads the files the build filled in', () => {
    expect(moduleUrl('csv', 'https://aims.example/perun/perun-core.js')).toBe('https://aims.example/perun/csv.perun-core.js?v=1a2b')
  })
})

describe('loadModule', () => {
  afterEach(() => document.querySelectorAll('script').forEach((script) => script.remove()))

  const addBundleScript = () => {
    const script = document.createElement('script')
    // Not a script type, so happy-dom does not try to fetch it.
    script.type = 'text/plain'
    script.setAttribute('src', 'https://aims.example/perun/perun-core.js?v=4.5.8')
    document.head.append(script)
  }

  it('fails, saying why, when the bundle has no script tag to be found by', async () => {
    await expect(loadModule('csv')).rejects.toThrow('cannot tell where the csv module is')
  })

  it('finds the bundle by its script tag, with the version in its URL, and shares one load among its callers', async () => {
    addBundleScript()
    const first = loadModule('answer')
    expect(loadModule('answer')).toBe(first)
    expect((await first).answer).toBe(42)
    expect(loadModule('answer')).toBe(first)
  })

  it('forgets a load that failed, so the next call tries again', async () => {
    addBundleScript()
    const first = loadModule('broken')
    await expect(first).rejects.toThrow('broken')
    expect(loadModule('broken')).not.toBe(first)
  })
})
