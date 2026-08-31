import type { ReactNode } from 'react'

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
