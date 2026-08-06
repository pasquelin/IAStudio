import type { ReactNode } from 'react'
import { cn } from './cn'

export type FloatingPanelProps = {
  titre?: string
  children: ReactNode
  className?: string
}

/**
 * Surface flottante : elle vient de s'ouvrir PAR-DESSUS et doit se détacher, d'où l'ombre
 * profonde là où les meubles (barres, docks) gardent l'ombre discrète. Le flou d'arrière-plan
 * n'est posé que sur les surfaces qui flottent au-dessus d'un canvas ou d'un viewport : dans
 * un dock opaque il ne ferait que coûter de la composition par frame.
 */
export function FloatingPanel({ titre, children, className }: FloatingPanelProps) {
  return (
    <div
      className={cn(
        'border-bordure bg-elevated rounded-(--radius-sc-md) border p-2',
        'shadow-(--sc-ombre-flottante)',
        className,
      )}
    >
      {titre !== undefined && (
        <div className="text-texte-attenue mb-1.5 px-1 text-[11px] font-medium tracking-wide uppercase">
          {titre}
        </div>
      )}
      {children}
    </div>
  )
}
