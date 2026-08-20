/** What a laid-down banner measures — held so its empty stand-in reserves the same room. */
const BANNER_HEIGHT = 76

/**
 * The band before it knows what it holds. Silent, and exactly the height of the banner that
 * replaces it: a message appearing at the top of the page would push everything under it down,
 * which is the other half of what made the opening feel unsettled.
 */
export function SpotlightWaiting() {
  return (
    <div
      aria-hidden
      className="bg-surface rounded-(--radius-sc-lg)"
      style={{ height: BANNER_HEIGHT }}
    />
  )
}
