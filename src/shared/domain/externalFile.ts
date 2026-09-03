/** Files handed to the studio by the operating system or a desktop drop. */
export type ExternalFileRequest = {
  paths: readonly string[]
  folder?: string
}
