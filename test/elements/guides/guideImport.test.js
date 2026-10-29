import { describe, expect, it } from 'vitest'
import { readGuideUpload } from '../../../frontend/elements/guides/guideImport'
import { zipBlob } from '../../../frontend/elements/guides/zip'

const MARKDOWN = '# Holdings\n\n![The map](map.png)\n\n![Legend](<legend 1.png>)\n\n![The map again](map.png)\n'
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])

const archive = async (name, entries) => new File([await zipBlob(entries)], name, { type: 'application/zip' })

describe('readGuideUpload', () => {
  it('reads a bare .md, every figure it names missing', async () => {
    const source = await readGuideUpload(new File([MARKDOWN], 'en_US_holdings.MD'))
    expect(source).toEqual({ name: 'en_US_holdings.MD', markdown: MARKDOWN, figures: [], missing: ['map.png', 'legend 1.png'] })
  })

  it('reads the document and the figures it names out of an archive', async () => {
    const source = await readGuideUpload(await archive('guide.zip', [
      { name: 'en_US_holdings.md', data: MARKDOWN },
      { name: 'map.png', data: PNG },
      { name: 'legend 1.png', data: PNG }
    ]))
    expect(source.name).toBe('en_US_holdings.md')
    expect(source.markdown).toBe(MARKDOWN)
    expect(source.missing).toEqual([])
    expect(source.figures.map(({ name, file }) => [name, file.name, file.type])).toEqual([
      ['map.png', 'map.png', 'image/png'],
      ['legend 1.png', 'legend 1.png', 'image/png']
    ])
    expect(new Uint8Array(await source.figures[0].file.arrayBuffer())).toEqual(PNG)
  })

  it('leaves behind an entry the document does not name, and reports one it names but lacks', async () => {
    const source = await readGuideUpload(await archive('guide.zip', [
      { name: 'en_US_holdings.md', data: MARKDOWN },
      { name: 'map.png', data: PNG },
      { name: 'unused.png', data: PNG }
    ]))
    expect(source.figures.map(({ name }) => name)).toEqual(['map.png'])
    expect(source.missing).toEqual(['legend 1.png'])
  })

  it('reads an archive made by zipping a folder, the folder taken off the names', async () => {
    const source = await readGuideUpload(await archive('guide.zip', [
      { name: 'guide/en_US_holdings.md', data: MARKDOWN },
      { name: 'guide/map.png', data: PNG },
      { name: 'guide/legend 1.png', data: PNG }
    ]))
    expect(source.name).toBe('en_US_holdings.md')
    expect(source.figures.map(({ name, file }) => [name, file.name])).toEqual([['map.png', 'map.png'], ['legend 1.png', 'legend 1.png']])
  })

  it('does not resolve a reference that carries a path of its own to an entry without it', async () => {
    const source = await readGuideUpload(await archive('guide.zip', [
      { name: 'en_US_holdings.md', data: '![The map](figures/map.png)' },
      { name: 'map.png', data: PNG }
    ]))
    expect(source.missing).toEqual(['figures/map.png'])
  })

  it('turns away an archive with no Markdown document', async () => {
    await expect(readGuideUpload(await archive('figures.zip', [{ name: 'map.png', data: PNG }]))).rejects.toThrow('no Markdown document')
  })
})
