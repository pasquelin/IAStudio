import { describe, expect, it } from 'vitest'
import source from './SceneRenderer.ts?raw'

/**
 * Which buttons arm the flight, and what arming it must not cost them.
 *
 * Read as text for the reason `sceneRendererRedraw.test.ts` gives: the engine cannot be built
 * without a WebGL context, so its pointer paths have no other witness. What matters here is that
 * the left button KEEPS what it already did — orbiting through `OrbitControls`, picking on
 * release, driving the gizmos — and only gains the keys the right one already answered.
 */
describe('SceneRenderer and the buttons that fly', () => {
  const handler = (name: string, args: string): string =>
    source.match(new RegExp(`${name} = \\(${args}\\): void => \\{[\\s\\S]*?\\n {2}\\}`))?.[0] ?? ''

  const pointerDown = handler('onPointerDown', 'event: PointerEvent')
  const pointerUp = handler('onPointerUp', 'event: PointerEvent')
  const draggingChanged = handler('onDraggingChanged', '')

  // A regex that matched nothing would make every assertion below vacuously true.
  it('finds the three handlers the rest of this file reads', () => {
    expect([pointerDown, pointerUp, draggingChanged].map(found => found.length > 0)).toEqual([
      true,
      true,
      true,
    ])
  })

  it('arms the flight from either button', () => {
    expect(pointerDown.match(/this\.startFlight\(/g)).toHaveLength(2)
  })

  it('ends it on either release', () => {
    expect(pointerUp.match(/this\.endFlight\(/g)).toHaveLength(2)
  })

  /**
   * The whole point of the left button arming a flight: it is ADDED. `pressed` is what the
   * release picks from, and the view helper still takes the click before the scene does — both
   * settled before the flight is armed, so neither can be lost to it.
   */
  it('leaves the left button the gesture it already had', () => {
    expect(pointerDown).toContain('this.turnToViewHelper(event)')
    expect(pointerDown.indexOf('this.pressed = ')).toBeLessThan(
      pointerDown.lastIndexOf('this.startFlight('),
    )
  })

  // Letting go of `W` before the button leaves a release that never moved a pixel, which is what
  // a click looks like — the right button already reads `flew` before raising its menu.
  it('picks nothing on a release that flew', () => {
    expect(pointerUp).toMatch(/if \(flew \|\| !wasClick\(/)
  })

  it('drops the flight the left button armed once a gizmo takes the handle', () => {
    expect(draggingChanged).toContain('this.flownWith === 0')
    expect(draggingChanged).toContain('this.flownWith = null')
  })

  // `flownFrom` is where the button went down, which a second press would overwrite; only the
  // button that armed the flight says whether one is under way.
  it('reads the flight from the button that armed it', () => {
    expect(source).toContain('return this.flownWith !== null')
  })

  /**
   * The defect this file exists for. `freezePanes` ends in `armOrbits(null)`, which writes
   * `controls.enabled = false` on the MAIN orbit in every layout — so freezing under the left
   * button takes away the very rotation that button is held down for. Both places that freeze
   * must therefore name the right button, never `flying`.
   */
  it('never freezes the panes under the left button, which would cost it its rotation', () => {
    const startFlight =
      source.match(/private startFlight\(event: PointerEvent\): void \{[\s\S]*?\n {2}\}/)?.[0] ?? ''
    const syncPaneFreeze =
      source.match(/private syncPaneFreeze\(\): void \{[\s\S]*?\n {2}\}/)?.[0] ?? ''

    expect(startFlight).toMatch(/if \(event\.button === 2\) this\.viewport\.freezePanes\(true\)/)
    expect(syncPaneFreeze).toContain('this.flownWith === 2')
    expect(syncPaneFreeze).not.toMatch(/\bthis\.flying\b/)
  })
})
