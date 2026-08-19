import {
  A4_POINTS,
  CAPTION_POINTS,
  pdfBytes,
  type PdfImage,
  type PdfPage,
  type PdfPlacement,
} from './pdf'

/**
 * Pictures laid out in a grid, page after page — a contact sheet, which is what a studio hands
 * somebody who has to choose between forty generations.
 *
 * Pure arithmetic, so where a cell lands is testable without a canvas or a reader.
 */

/** Room around the grid, in points. Wide enough that a printer's own margin never eats a cell. */
const MARGIN = 36
const GAP = 12

/** A picture and what to write under it. The bytes are the window's business. */
export type SheetPicture = PdfImage & { caption: string }

export type SheetLayout = { columns: number; rows: number }

/**
 * Fits within a cell rather than filling it: a generation is any shape, and cropping one to a
 * square on a sheet whose whole point is choosing would hide what is being chosen.
 */
function fitted(picture: PdfImage, cell: { width: number; height: number }): [number, number] {
  const scale = Math.min(cell.width / picture.width, cell.height / picture.height)
  return [picture.width * scale, picture.height * scale]
}

/** What one cell measures across, which is also what a row measures down. */
const cellWidth = (across: number, page: typeof A4_POINTS): number =>
  (page.width - 2 * MARGIN - (across - 1) * GAP) / across

/** How many fit across and down, given the paper and the cell size asked for. */
export function sheetLayout(columns: number, page = A4_POINTS): SheetLayout {
  const across = Math.max(1, Math.floor(columns))
  // The caption rides UNDER the picture, inside the cell: a row counted without it walks the
  // last line of each page off the bottom.
  return {
    columns: across,
    rows: Math.max(1, Math.floor((page.height - 2 * MARGIN) / (cellWidth(across, page) + GAP))),
  }
}

/**
 * The pages a set of pictures makes. Empty for no pictures — a sheet of nothing is a file whose
 * only content is a blank page, which is worse than no file at all.
 */
export function contactSheetPages(
  pictures: readonly SheetPicture[],
  columns: number,
  page = A4_POINTS,
): PdfPage[] {
  if (pictures.length === 0) return []

  const { columns: across, rows } = sheetLayout(columns, page)
  const width = cellWidth(across, page)
  const perPage = across * rows

  const pages: PdfPage[] = []
  for (let from = 0; from < pictures.length; from += perPage) {
    const places: PdfPlacement[] = []

    pictures.slice(from, from + perPage).forEach((picture, index) => {
      const column = index % across
      const row = Math.floor(index / across)
      const cell = { width, height: width - CAPTION_POINTS - 2 }
      const [drawn, tall] = fitted(picture, cell)

      places.push({
        image: from + index,
        // Centred in its cell across, and measured from the TOP down — PDF counts from the
        // bottom, and a sheet read in reading order has its first row highest.
        x: MARGIN + column * (width + GAP) + (width - drawn) / 2,
        y: page.height - MARGIN - row * (width + GAP) - tall,
        width: drawn,
        height: tall,
        caption: picture.caption,
      })
    })

    pages.push({ width: page.width, height: page.height, places })
  }

  return pages
}

/** The sheet as a file. */
export function contactSheetPdf(pictures: readonly SheetPicture[], columns: number): Uint8Array {
  return pdfBytes(pictures, contactSheetPages(pictures, columns))
}
