import { Children, type ReactNode } from 'react'
import { WelcomePanel } from './WelcomePanel'

export function WelcomeStage({ index, children }: { index: number; children: ReactNode }) {
  const slides = Children.toArray(children)

  const left = `${-index * 100}%`

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      <div
        className="absolute inset-0 flex"
        style={{
          transform: `translate3d(${left}, 0, 0)`,
          transition: 'transform 280ms ease',
        }}
      >
        {slides.map((slide, slideIndex) => (
          <section
            key={slideIndex}
            // `py-8` and not `py-4`: the rail clips, as a carousel must, and the sheet's floating shadow
            // reaches 24px past its own box — at four it was sliced off along the bottom edge.
            className="flex h-full w-full shrink-0 flex-col items-center justify-center px-14 py-8"
          >
            <WelcomePanel>{slide}</WelcomePanel>
          </section>
        ))}
      </div>
    </div>
  )
}
