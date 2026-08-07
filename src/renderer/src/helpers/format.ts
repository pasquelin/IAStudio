/** Kibibytes, like every file manager on every desktop the studio runs on. */
export function formatBytes(bytes: number): string {
  const units = ['o', 'Kio', 'Mio', 'Gio']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 && unit > 0 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}
