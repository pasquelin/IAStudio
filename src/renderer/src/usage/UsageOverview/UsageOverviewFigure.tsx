import type { ReactNode } from 'react'

export function UsageOverviewFigure({
  label,
  value,
  children,
}: {
  label: string
  value: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-base-content/70 text-tiny uppercase">{label}</span>
      <span className="text-lg font-semibold">{value}</span>
      {children}
    </div>
  )
}
