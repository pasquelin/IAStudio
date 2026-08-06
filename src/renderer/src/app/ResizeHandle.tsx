import { useCallback, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '@/design/cn'
import { isHorizontal, type ToolZone } from './tools'

export type ResizeHandleProps = {
  zone: ToolZone
  size: number
  onSize: (size: number, available: number) => void
}

/**
 * Poignée de redimensionnement d'une zone d'outils. Capture le pointeur pour que le geste
 * survive à un curseur qui sort de la poignée — sans capture, un déplacement rapide décroche.
 *
 * Elle mesure aussi le conteneur au début du geste et transmet sa dimension : c'est elle qui
 * sait ce qui est disponible, le store ne connaît pas le DOM.
 */
export function ResizeHandle({ zone, size, onSize }: ResizeHandleProps) {
  const start = useRef({ position: 0, size: 0, available: 0 })
  const lying = isHorizontal(zone)

  const onMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.buttons === 0) return
      const position = lying ? event.clientY : event.clientX
      const delta = position - start.current.position
      // Les zones « right » et « bottom » grandissent quand le pointeur recule.
      const direction = zone === 'right' || zone === 'bottom' ? -1 : 1
      onSize(start.current.size + delta * direction, start.current.available)
    },
    [lying, onSize, zone],
  )

  return (
    <div
      role="separator"
      aria-orientation={lying ? 'horizontal' : 'vertical'}
      onPointerDown={event => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const parent = event.currentTarget.parentElement
        start.current = {
          position: lying ? event.clientY : event.clientX,
          size,
          available: lying
            ? (parent?.clientHeight ?? window.innerHeight)
            : (parent?.clientWidth ?? window.innerWidth),
        }
      }}
      onPointerMove={onMove}
      className={cn(
        'shrink-0 bg-transparent',
        lying
          ? 'h-(--sc-gutter) w-full cursor-row-resize'
          : 'h-full w-(--sc-gutter) cursor-col-resize',
      )}
    />
  )
}
