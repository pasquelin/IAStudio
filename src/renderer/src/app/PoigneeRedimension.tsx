import { useCallback, useRef } from 'react'
import { cn } from '@/design/cn'
import { estHorizontale, type ZoneOutils } from './outils'

export type PoigneeRedimensionProps = {
  zone: ZoneOutils
  taille: number
  surTaille: (taille: number) => void
}

/**
 * Poignée de redimensionnement d'une zone d'outils. Capture le pointeur pour que le geste
 * survive à un curseur qui sort de la poignée — sans capture, un déplacement rapide décroche.
 */
export function PoigneeRedimension({ zone, taille, surTaille }: PoigneeRedimensionProps) {
  const depart = useRef({ position: 0, taille: 0 })
  const couche = estHorizontale(zone)

  const surDeplacement = useCallback(
    (evenement: React.PointerEvent<HTMLDivElement>) => {
      if (evenement.buttons === 0) return
      const position = couche ? evenement.clientY : evenement.clientX
      const delta = position - depart.current.position
      // Les zones « droite » et « bas » grandissent quand le pointeur recule.
      const sens = zone === 'droite' || zone === 'bas' ? -1 : 1
      surTaille(depart.current.taille + delta * sens)
    },
    [couche, surTaille, zone],
  )

  return (
    <div
      role="separator"
      aria-orientation={couche ? 'horizontal' : 'vertical'}
      onPointerDown={evenement => {
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
        depart.current = {
          position: couche ? evenement.clientY : evenement.clientX,
          taille,
        }
      }}
      onPointerMove={surDeplacement}
      className={cn(
        'hover:bg-accent/40 shrink-0 bg-transparent transition-colors',
        couche
          ? 'h-(--sc-gouttiere) w-full cursor-row-resize'
          : 'h-full w-(--sc-gouttiere) cursor-col-resize',
      )}
    />
  )
}
