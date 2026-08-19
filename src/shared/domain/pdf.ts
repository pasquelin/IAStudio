/**
 * A PDF of pictures, written by hand.
 *
 * No dependency, for the reason RGBE and WAV have none: what this needs of the format is the
 * object table, one font and JPEG frames passed through untouched. `pdf-lib` was installed for
 * it once and taken back out — knip was right, nothing was reading it.
 *
 * Pictures ride as `DCTDecode`, which means the JPEG bytes are the stream: no recompression, and
 * no need for zlib, which `shared/` could not import anyway.
 */

/** A picture as the file will hold it: JPEG bytes, and the size they decode to. */
export type PdfImage = { jpeg: Uint8Array; width: number; height: number }

/** Where one picture lands on a page, in points, with the origin at the BOTTOM left. */
export type PdfPlacement = {
  /** Index into the images handed to `pdfBytes`. */
  image: number
  x: number
  y: number
  width: number
  height: number
  /** Written under the picture, in the one font this file carries. */
  caption?: string
}

export type PdfPage = { width: number; height: number; places: readonly PdfPlacement[] }

/** A4 upright, in points — the size a contact sheet is looked at and printed on. */
export const A4_POINTS = { width: 595, height: 842 }

/** The caption's size and the room kept under each picture for it. */
export const CAPTION_POINTS = 8

/**
 * Latin-1, which is what `WinAnsiEncoding` shows. Anything past it becomes a question mark rather
 * than a stray byte: a `/Length` that disagrees with its stream is a file no reader opens.
 */
function pdfText(text: string): string {
  return [...text]
    .map(letter => {
      const code = letter.codePointAt(0) ?? 63
      if (letter === '(' || letter === ')' || letter === '\\') return `\\${letter}`
      return code >= 32 && code <= 255 ? letter : '?'
    })
    .join('')
}

/** What one page DRAWS, as the operators a viewer replays. */
function contentOf(page: PdfPage): string {
  return page.places
    .flatMap(place => {
      const picture = [
        'q',
        // The matrix IS the placement: scale then translate, which is what `cm` composes.
        `${place.width} 0 0 ${place.height} ${place.x} ${place.y} cm`,
        `/Im${place.image} Do`,
        'Q',
      ]

      if (!place.caption) return picture

      return [
        ...picture,
        'BT',
        `/F1 ${CAPTION_POINTS} Tf`,
        `${place.x} ${place.y - CAPTION_POINTS} Td`,
        `(${pdfText(place.caption)}) Tj`,
        'ET',
      ]
    })
    .join('\n')
}

/** Latin-1 bytes of an ASCII-and-accents string — `TextEncoder` would write UTF-8 and lie. */
function latin1(text: string): Uint8Array {
  return Uint8Array.from([...text].map(letter => (letter.codePointAt(0) ?? 63) & 0xff))
}

/**
 * The file. Objects are written in order and their BYTE offsets collected as they go: the cross
 * reference table is the one part a reader refuses outright when it is a byte off.
 */
export function pdfBytes(images: readonly PdfImage[], pages: readonly PdfPage[]): Uint8Array {
  const parts: Uint8Array[] = []
  const offsets: number[] = []
  let at = 0

  const push = (bytes: Uint8Array): void => {
    parts.push(bytes)
    at += bytes.length
  }

  const object = (body: string, stream?: Uint8Array): void => {
    offsets.push(at)
    push(latin1(`${offsets.length} 0 obj\n${body}\n`))
    if (stream) {
      push(latin1('stream\n'))
      push(stream)
      push(latin1('\nendstream\n'))
    }
    push(latin1('endobj\n'))
  }

  push(latin1('%PDF-1.4\n'))

  // Numbered before anything is written: a page names its content and its pictures, and every
  // one of those references has to be a number that will exist by the end.
  const FIRST_IMAGE = 4
  const firstPage = FIRST_IMAGE + images.length
  const firstContent = firstPage + pages.length

  object('<< /Type /Catalog /Pages 2 0 R >>')
  const kids = pages.map((_unused, index) => `${firstPage + index} 0 R`).join(' ')
  object(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`)
  object('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')

  for (const image of images) {
    object(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height}` +
        ` /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode` +
        ` /Length ${image.jpeg.length} >>`,
      image.jpeg,
    )
  }

  pages.forEach((page, index) => {
    // Every picture of the file is offered to every page. A page draws what it draws, and an
    // XObject nobody calls costs a reader nothing.
    const xobjects = images.map((_unused, one) => `/Im${one} ${FIRST_IMAGE + one} 0 R`).join(' ')
    object(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}]` +
        ` /Resources << /XObject << ${xobjects} >> /Font << /F1 3 0 R >> >>` +
        ` /Contents ${firstContent + index} 0 R >>`,
    )
  })

  for (const page of pages) {
    const drawn = latin1(contentOf(page))
    object(`<< /Length ${drawn.length} >>`, drawn)
  }

  const startxref = at
  const table = [
    `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`,
    ...offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`),
    `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${startxref}\n%%EOF\n`,
  ]
  push(latin1(table.join('')))

  const file = new Uint8Array(at)
  let written = 0
  for (const part of parts) {
    file.set(part, written)
    written += part.length
  }
  return file
}
