/**
 * A `DataTransfer` for tests. jsdom builds none, and the two methods below are the whole
 * contract every drop in this codebase relies on.
 */
export function dragTransfer(): DataTransfer {
  const values = new Map<string, string>()
  // The double stands in for a DOM class jsdom does not implement; nothing reads the rest of it.
  return {
    setData: (format: string, value: string) => values.set(format, value),
    getData: (format: string) => values.get(format) ?? '',
    effectAllowed: 'none',
  } as unknown as DataTransfer
}
