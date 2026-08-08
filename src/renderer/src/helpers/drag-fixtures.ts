/**
 * A `DataTransfer` for tests. jsdom builds none, and what is below is the whole contract every
 * drop in this codebase relies on.
 *
 * `types` matters as much as the two methods: it is the ONLY thing readable during a drag —
 * `getData` answers an empty string until the drop — so it is what every target reads to decide
 * whether it would accept what is flying over it.
 */
export function dragTransfer(): DataTransfer {
  const values = new Map<string, string>()
  // The double stands in for a DOM class jsdom does not implement; nothing reads the rest of it.
  return {
    setData: (format: string, value: string) => values.set(format, value),
    getData: (format: string) => values.get(format) ?? '',
    get types(): readonly string[] {
      return [...values.keys()]
    },
    effectAllowed: 'none',
  } as unknown as DataTransfer
}
