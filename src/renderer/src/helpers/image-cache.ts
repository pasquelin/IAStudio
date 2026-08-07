/**
 * Pictures a canvas draws, kept once per URL.
 *
 * Deliberately not a store: nothing renders these, a canvas paints them. Pushing them through
 * React would re-render a virtualized grid every time one of a hundred thumbnails decoded, to
 * change nothing anyone can see.
 */
type Entry = { image: HTMLImageElement; ready: boolean; failed: boolean }

const entries = new Map<string, Entry>()

/**
 * The picture at a URL if it is decoded, otherwise nothing — and `onReady` fires once it is.
 * Callers paint what they have and repaint when told, rather than awaiting inside a paint.
 */
export function cachedImage(url: string, onReady: () => void): HTMLImageElement | null {
  const existing = entries.get(url)
  if (existing) return existing.ready ? existing.image : null

  const image = new Image()
  const entry: Entry = { image, ready: false, failed: false }
  entries.set(url, entry)

  image.onload = () => {
    entry.ready = true
    image.onload = null
    onReady()
  }
  // Remembered as failed rather than dropped: retrying a missing file on every paint would
  // hammer the asset scheme sixty times a second.
  image.onerror = () => {
    entry.failed = true
  }
  image.src = url

  return null
}
