import type { ReactNode } from 'react'
import { cn } from '@/helpers/cn'

/** The one table the window draws — models, tallies and the log all wear it. */
export function UsageTable({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <table className="w-full text-xs">
      <thead className="text-base-content/70">
        <tr className="border-base-300 border-b text-left">{head}</tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  )
}

/** Numbers align right so their digits line up; everything else reads from the left. */
export function HeadCell({ label, numeric = false }: { label: string; numeric?: boolean }) {
  return <th className={cn('py-1.5 font-medium', numeric && 'text-right')}>{label}</th>
}

export function Row({ children }: { children: ReactNode }) {
  return <tr className="border-base-300 border-b last:border-b-0">{children}</tr>
}
