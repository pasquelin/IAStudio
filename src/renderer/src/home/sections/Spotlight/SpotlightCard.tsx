import { Button } from '@/design/Button'
import { UiIcon } from '@/design/UiIcon'
import { cn } from '@/helpers/cn'
import { HINT_TOP } from '@/helpers/tooltip'

export type Slide = {
  id: string
  icon: string
  title: string
  body: string
  /** Absent on a card that only reports — the section under it is already the way there. */
  action?: { label: string; hint: string; onClick: () => void }
  /** The one card the eye should land on first. Set once, on the first card that acts. */
  leading?: boolean
}

/**
 * One card of the band. Laid on its side when it is alone and takes the width, stacked when it
 * shares a rail — the same four things either way, which is why it is one component.
 *
 * The leading card carries the studio's create colour, and nothing else on the home does: one
 * accent, on the one thing worth doing first.
 */
export function SpotlightCard({ slide, layout }: { slide: Slide; layout: 'banner' | 'stacked' }) {
  const banner = layout === 'banner'

  return (
    <article
      className={cn(
        'flex overflow-hidden rounded-(--radius-sc-lg) p-4',
        banner ? 'items-center gap-4' : 'size-full flex-col items-start gap-2',
        slide.leading ? 'bg-create/15 border-create/40 border' : 'bg-surface',
      )}
    >
      <div className={cn('flex min-w-0 flex-1 flex-col gap-2', !banner && 'w-full')}>
        {/* The icon reads as the heading's mark, not as a stamp above the card: on one line with
            the title it says what the card is about where the eye already is. */}
        <span className="flex items-center gap-2">
          <UiIcon
            path={slide.icon}
            size={banner ? 20 : 16}
            className={cn('shrink-0', slide.leading ? 'text-create' : 'text-muted')}
          />
          <h3 className="text-text text-body m-0 font-semibold">{slide.title}</h3>
        </span>

        {/* Bounded, and the button is not: a body long enough to push the action out of the card
            would leave the one thing to click off screen. The clamp is for what this file cannot
            shorten — a project or document name a person chose — and it ends on an ellipsis. */}
        <p
          className={cn(
            'text-muted text-tiny m-0 overflow-hidden leading-relaxed',
            banner ? 'max-w-[80ch]' : 'line-clamp-4 max-w-[64ch] flex-1',
          )}
        >
          {slide.body}
        </p>
      </div>

      {slide.action && (
        <span className="shrink-0">
          <Button
            variant={slide.leading ? 'primary' : 'neutral'}
            {...HINT_TOP(slide.action.hint)}
            onClick={slide.action.onClick}
          >
            {slide.action.label}
          </Button>
        </span>
      )}
    </article>
  )
}
