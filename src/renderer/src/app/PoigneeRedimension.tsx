import { useCallback, useRef } from 'react'
import { cn } from '@/design/cn'
import { estHorizontale, type ZoneOutils } from './outils'

export type PoigneeRedimensionProps = {
  zone: ZoneOutils
  taille: number
  surTaille: (taille: number, disponible: number) => void
}

/**
 * Poignée de redimensionnement d'une zone d'outils. Capture le pointeur pour que le geste
 * survive à un curseur qui sort de la poignée — sans capture, un déplacement rapide décroche.
 *
 * Elle mesure aussi le conteneur à chaque geste et transmet sa dimension : c'est elle qui
 * sait ce qui est « disponible », le store ne connaît pas le DOM.
 */
export function PoigneeRedimension({ zone, taille, surTaille }: PoigneeRedimensionProps) {
  const depart = useRef({ position: 0, taille: 0, disponible: 0 })
  const couche = estHorizontale(zone)

  const surDeplacement = useCallback(
    (evenement: React.PointerEvent<HTMLDivElement>) => {
      if (evenement.buttons === 0) return
      const position = couche ? evenement.clientY : evenement.clientX
      const delta = position - depart.current.position
      // Les zones « droite » et « bas » grandissent quand le pointeur recule.
      const sens = zone === 'droite' || zone === 'bas' ? -1 : 1
      surTaille(depart.current.taille + delta * sens, depart.current.disponible)
    },
    [couche, surTaille, zone],
  )

  return (
    <div
      role="separator"
      aria-orientation={couche ? 'horizontal' : 'vertical'}
      onPointerDown={evenement => {
        evenement.currentTarget.setPointerCapture(evenement.pointerId)
        const parent = evenement.currentTarget.parentElement
        depart.current = {
          position: couche ? evenement.clientY : evenement.clientX,
          taille,
          disponible: couche
            ? (parent?.clientHeight ?? window.innerHeight)
            : (parent?.clientWidth ?? window.innerWidth),
        }
      }}
      onPointerMove={surDeplacement}
      className={cn(
        'shrink-0 bg-transparent',
        couche
          ? 'h-(--sc-gouttiere) w-full cursor-row-resize'
          : 'h-full w-(--sc-gouttiere) cursor-col-resize',
      )}
    />
  )
}
