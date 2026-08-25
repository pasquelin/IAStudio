import { describe, expect, it } from 'vitest'
import { boundsOf } from '@shared/domain/settingsRegistry'
import { FLY_SPEEDS } from '@shared/domain/snap'
import { formatDecimal } from '@/helpers/format'

/**
 * How long the speed reads, which is what decides whether the bar sits still.
 *
 * The bar holds open the room of its longest reading; a reading LONGER than the one it was
 * measured on makes the box grow, and every control after it shuffles sideways. The first
 * attempt measured the rungs — and the slider reaches 14,5, which no rung is as long as.
 */
const reading = (value: number): string =>
  `${formatDecimal(value, 'fr', { digits: 1, least: 1 })} m/s`

/** Every value the slider can land on: it steps by half a metre per second between the bounds. */
const reachable = (): number[] => {
  const { min, max } = boundsOf('three.flySpeed')
  const values: number[] = []
  for (let value = min; value <= max; value += 0.5) values.push(value)
  return values
}

describe('what the speed reads as', () => {
  it('is never longer than the reading taken from the bound', () => {
    const held = reading(boundsOf('three.flySpeed').max).length
    const longer = reachable().filter(value => reading(value).length > held)

    expect(longer).toEqual([])
  })

  /**
   * The defect, kept as a case. Without a forced decimal a rung reads « 20 m/s » and the slider
   * reads « 14,5 m/s » — one character more than ANY rung, so a box held open by the rungs grew
   * mid-drag. The fixed decimal is what makes the whole part alone decide the length.
   */
  it('was not, before the decimal was fixed', () => {
    const loose = (value: number) => `${formatDecimal(value, 'fr', { digits: 1 })} m/s`
    const byRungs = Math.max(...FLY_SPEEDS.map(rung => loose(rung).length))

    expect(loose(14.5).length).toBeGreaterThan(byRungs)
  })
})
