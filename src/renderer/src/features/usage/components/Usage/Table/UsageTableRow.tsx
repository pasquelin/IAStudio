import type { ReactNode } from 'react'

export function UsageTableRow({ children }: { children: ReactNode }) {
  return <tr className="border-base-300 border-b last:border-b-0">{children}</tr>
}
