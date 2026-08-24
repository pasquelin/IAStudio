import { NEWS_PAGE_SIZE } from '@shared/domain/news'
import { NEWS_ROW } from './newsStyles'
import { cn } from '@/helpers/cn'

/**
 * The band's height while it waits, drawn from the same rows it is about to hold.
 *
 * A one-line « reading… » under a band that then grew to forty-four rows is what made the page
 * jump; it made it jump at eight rows too. Reserving the room from `NEWS_ROW` rather than from a
 * number is what keeps the reservation right the day a row changes height — and at compact
 * density, where the gauge is four pixels shorter.
 */
export function NewsSkeleton() {
  return (
    <div aria-hidden className="flex flex-col">
      {Array.from({ length: NEWS_PAGE_SIZE }, (_unused, rank) => (
        <span key={rank} className={cn(NEWS_ROW, 'block')} />
      ))}
    </div>
  )
}
