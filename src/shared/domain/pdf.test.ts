import { describe, expect, it } from 'vitest'
import { A4_POINTS, pdfBytes, type PdfImage, type PdfPlacement } from './pdf'

/** Enough of a JPEG to be a stream: what this file does with the bytes is pass them through. */
const jpeg = (length = 8): PdfImage => ({
  jpeg: Uint8Array.from({ length }, (_unused, at) => at),
  width: 100,
  height: 50,
})

const read = (file: Uint8Array): string => String.fromCharCode(...file)

const onePage = (places: PdfPlacement[] = [{ image: 0, x: 0, y: 0, width: 10, height: 10 }]) => [
  { ...A4_POINTS, places },
]

describe('a PDF of pictures', () => {
  it('opens on the version marker every reader looks for, and ends on the trailer', () => {
    const file = read(pdfBytes([jpeg()], onePage()))

    expect(file.startsWith('%PDF-1.4')).toBe(true)
    expect(file.endsWith('%%EOF\n')).toBe(true)
  })

  /**
   * The one part a reader refuses outright when it is a byte off: every offset of the table has
   * to land exactly on its `N 0 obj`. Checked by READING the file at each offset, which is what
   * the reader does — an assertion on the count alone would pass on a table shifted by one.
   */
  it('points every cross-reference entry at the object it names', () => {
    const file = read(pdfBytes([jpeg(), jpeg()], onePage()))

    // `\nxref\n` and not `xref\n`: `startxref` ENDS in the shorter one, and a search for it lands
    // past the table it was meant to find — on a slice holding no entry at all.
    const table = file.slice(file.lastIndexOf('\nxref\n'))
    const offsets = [...table.matchAll(/^(\d{10}) 00000 n $/gm)].map(one => Number(one[1]))

    expect(offsets).not.toHaveLength(0)
    offsets.forEach((offset, index) => {
      expect(file.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`)
    })
  })

  /** `startxref` is where a reader begins: it opens the file at that byte and expects the table. */
  it('says where the table starts, in bytes from the head', () => {
    const file = read(pdfBytes([jpeg()], onePage()))

    const startxref = Number(/startxref\n(\d+)/.exec(file)?.[1])
    expect(file.slice(startxref, startxref + 4)).toBe('xref')
  })

  /** The bytes ARE the stream: a contact sheet that recompressed every frame would be a copy. */
  it('carries the JPEG through untouched, under the filter that says so', () => {
    const picture = jpeg(5)
    const file = read(pdfBytes([picture], onePage()))

    expect(file).toContain('/Filter /DCTDecode')
    expect(file).toContain(`/Length ${picture.jpeg.length}`)
    expect(file).toContain(`stream\n${String.fromCharCode(...picture.jpeg)}\nendstream`)
  })

  it('draws each picture where the placement puts it, scaled by the same matrix', () => {
    const file = read(
      pdfBytes(
        [jpeg()],
        [{ ...A4_POINTS, places: [{ image: 0, x: 20, y: 700, width: 80, height: 40 }] }],
      ),
    )

    expect(file).toContain('80 0 0 40 20 700 cm')
    expect(file).toContain('/Im0 Do')
  })

  /**
   * A caption is written inside a literal string, where an unescaped bracket ends it early and
   * makes every byte after it an operator — the classic way to write a file nothing opens.
   */
  it('escapes what a PDF string cannot hold raw', () => {
    const file = read(
      pdfBytes(
        [jpeg()],
        onePage([{ image: 0, x: 0, y: 0, width: 1, height: 1, caption: 'Plan (2) \\ fin' }]),
      ),
    )

    expect(file).toContain('(Plan \\(2\\) \\\\ fin) Tj')
  })

  /** `WinAnsiEncoding` shows latin-1 and no more; a byte past it would disagree with `/Length`. */
  it('writes a letter the font cannot show as a question mark rather than as itself', () => {
    const file = read(
      pdfBytes(
        [jpeg()],
        onePage([{ image: 0, x: 0, y: 0, width: 1, height: 1, caption: 'Ciel 空' }]),
      ),
    )

    expect(file).toContain('(Ciel ?) Tj')
    expect(file).toContain('/Encoding /WinAnsiEncoding')
  })

  it('counts its pages, so a reader knows how many to offer', () => {
    const file = read(pdfBytes([jpeg()], [...onePage(), ...onePage()]))

    expect(file).toContain('/Count 2')
  })
})
