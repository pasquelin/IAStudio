/**
 * How far off screen the host sits. Off the page rather than hidden: a host with
 * `display: none` — or one inside a zero-sized box — measures zero, and the viewport would size
 * its buffer to nothing and draw an empty frame.
 */
const OFF_SCREEN = '-20000px'

/**
 * A box of the caller's own size, appended to the document where nobody can see it or reach it
 * with a pointer: what a renderer needs before it can draw a picture nobody is watching, at the
 * resolution asked for rather than at the size of whatever panel happens to be on screen.
 *
 * The caller owns it from here, and removes it when it is done drawing.
 */
export function offScreenHost(width: number, height: number): HTMLDivElement {
  const host = document.createElement('div')
  host.style.position = 'fixed'
  host.style.left = OFF_SCREEN
  host.style.top = '0'
  host.style.width = `${width}px`
  host.style.height = `${height}px`
  host.style.pointerEvents = 'none'
  document.body.appendChild(host)
  return host
}
