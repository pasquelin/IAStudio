import type { ReactNode } from 'react'
import { UiIcon } from '@/design/UiIcon'

export type EtatVideProps = {
  icone: string
  message: string
  action?: ReactNode
}

/** Message d'un panneau sans contenu. Un dock vide sans explication se lit comme un bug. */
export function EtatVide({ icone, message, action }: EtatVideProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <UiIcon chemin={icone} taille={32} className="text-texte-attenue/40" />
      <p className="text-texte-attenue max-w-56 text-[12px] leading-relaxed">{message}</p>
      {action}
    </div>
  )
}
