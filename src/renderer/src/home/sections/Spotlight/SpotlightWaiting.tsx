import { Reserve } from '@/design/Reserve'

/**
 * The band before it knows what it holds. Silent, and exactly the height of the banner that
 * replaces it: a message appearing at the top of the page would push everything under it down,
 * which is the other half of what made the opening feel unsettled.
 */
export function SpotlightWaiting() {
  return (
    <Reserve height="h-(--sc-spotlight-banner)" className="bg-surface rounded-(--radius-sc-lg)" />
  )
}
