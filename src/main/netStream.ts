/**
 * Reading a `fetch` body by hand. `Response.body` is a web stream, async-iterable in Node but not
 * in the DOM types Electron's renderer half pulls in — so the reader is driven manually, once.
 */
export async function* chunksOf(
  body: ReadableStream<Uint8Array> | null,
): AsyncIterable<Uint8Array> {
  if (!body) return

  const reader = body.getReader()
  let drained = false
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        drained = true
        return
      }
      if (value) yield value
    }
  } finally {
    // Abandoned mid-stream — a `break`, or a throw downstream: releasing the lock alone leaves the
    // HTTP body open until the collector runs. Cancelling is what closes it, and it is refused on
    // a stream that already failed, which is the one case there is nothing left to close.
    if (!drained) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

/** The same bytes as text. Streaming, so a character split across two chunks is held, not mangled. */
export async function* decodedText(chunks: AsyncIterable<Uint8Array>): AsyncIterable<string> {
  const decoder = new TextDecoder()

  for await (const chunk of chunks) yield decoder.decode(chunk, { stream: true })

  const tail = decoder.decode()
  if (tail !== '') yield tail
}
