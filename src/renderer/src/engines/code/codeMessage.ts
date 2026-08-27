/** What crosses to the transpiler and back. Its own module, so the worker imports no engine. */
export type CodeRequest = { id: number; source: string }

export type CodeResponse =
  { id: number; code: string } | { id: number; trouble: string; line: number }
