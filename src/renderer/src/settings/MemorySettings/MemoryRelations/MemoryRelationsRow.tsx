import type { MemoryNeighbour } from '@shared/domain/memoryGraph'

/**
 * One neighbour. A button only where there is somewhere to go: a reference names a file, and a
 * link whose memory is gone names an id — neither opens anything, and neither should look as if
 * it did.
 */
export function MemoryRelationsRow({
  row,
  onOpen,
}: {
  row: MemoryNeighbour
  onOpen: (memoryId: string) => void
}) {
  const held = row.memoryId

  if (held === null) return <span className="truncate text-xs">{row.label}</span>

  return (
    <button
      type="button"
      className="link link-hover truncate text-left text-xs"
      onClick={() => onOpen(held)}
    >
      {row.label}
    </button>
  )
}
