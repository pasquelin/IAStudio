/**
 * Pictures a canvas draws, kept once per URL.
 *
 * Deliberately not a store: nothing renders these, a canvas paints them. Pushing them through
 * React would re-render a virtualized grid every time one of a hundred thumbnails decoded, to
 * change nothing anyone can see.
 */
type Entry = { image: HTMLImageElement; ready: boolean; bytes: number }

const entries = new Map<string, Entry>()
let held = 0

/**
 * How much decoded picture to keep at once.
 *
 * Counted in bytes rather than in entries: decoded, a picture costs width × height × 4
 * whatever its file weighs, so a budget of "four hundred images" bounds a wall of thumbnails
 * and a wall of posters at two wildly different amounts of memory. Left unbounded, browsing a
 * project of ten thousand assets kept every one of them decoded for the life of the window.
 *
 * Ninety-six megabytes holds a few thousand thumbnails, or a screen of posters several times
 * over — comfortably more than any one panel shows, which is what stops eviction from
 * thrashing against scrolling.
 */
const BUDGET_BYTES = 96 * 1024 * 1024

/** Frees least-recently-used entries until the budget is met, never the one just asked for. */
function evictUnder(keep: string): void {
  for (const [url, entry] of entries) {
    if (held <= BUDGET_BYTES) return
    if (url === keep) continue
    // A picture still decoding costs nothing yet, and dropping it would only fetch it again.
    if (!entry.ready) continue
    entries.delete(url)
    held -= entry.bytes
  }
}

/**
 * The picture at a URL if it is decoded, otherwise nothing — and `onReady` fires once it is.
 * Callers paint what they have and repaint when told, rather than awaiting inside a paint.
 */
export function cachedImage(url: string, onReady: () => void): HTMLImageElement | null {
  const existing = entries.get(url)
  if (existing) {
    // Re-inserted so it moves to the young end: `Map` keeps insertion order, which is what
    // makes the eviction above least-recently-used rather than first-in.
    entries.delete(url)
    entries.set(url, existing)
    return existing.ready ? existing.image : null
  }

  const image = new Image()
  const entry: Entry = { image, ready: false, bytes: 0 }
  entries.set(url, entry)

  image.onload = () => {
    entry.ready = true
    entry.bytes = image.naturalWidth * image.naturalHeight * 4
    held += entry.bytes
    image.onload = null
    evictUnder(url)
    onReady()
  }
  // Remembered as failed rather than dropped: retrying a missing file on every paint would
  // hammer the asset scheme sixty times a second. It costs no memory, so it is never evicted.
  image.onerror = () => {
    image.onerror = null
  }
  image.src = url

  return null
}

/** What the cache is holding, in bytes. Written for the test that pins the budget. */
export function cachedBytes(): number {
  return held
}

/** Drops everything. A project closing takes its pictures with it. */
export function forgetImages(): void {
  entries.clear()
  held = 0
}
