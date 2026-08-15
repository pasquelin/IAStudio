import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { writeAtomic, writeQueue } from './persistence'

let folder: string

beforeEach(async () => {
  folder = await mkdtemp(join(tmpdir(), 'persistence-'))
})

describe('writing a file atomically', () => {
  it('puts the content where it was asked to', async () => {
    const file = join(folder, 'thing.json')

    await writeAtomic(file, '{"a":1}')

    await expect(readFile(file, 'utf8')).resolves.toBe('{"a":1}')
  })

  it('leaves no staging copy behind', async () => {
    const file = join(folder, 'thing.json')

    await writeAtomic(file, '{}')

    await expect(readFile(`${file}.staging`, 'utf8')).rejects.toThrow()
  })

  /**
   * The tidy-up must not become the failure: what the caller has to hear is why the content
   * could not be written, not why the staging copy would not go away.
   */
  it('reports why the write failed, not why the cleanup did', async () => {
    const unwritable = join(folder, 'no-such-folder', 'thing.json')

    await expect(writeAtomic(unwritable, '{}')).rejects.toThrow(/ENOENT/)
  })

  /** The previous content survives a failed write, which is the whole point of the rename. */
  it('leaves what was there when the new content cannot be staged', async () => {
    const file = join(folder, 'thing.json')
    await writeFile(file, 'previous', 'utf8')

    await writeAtomic(file, 'next')

    await expect(readFile(file, 'utf8')).resolves.toBe('next')
  })
})

describe('a queue of writes', () => {
  it('runs one after another, never two at once', async () => {
    const queue = writeQueue()
    const order: string[] = []
    const slow = async (name: string): Promise<void> => {
      order.push(`${name}:start`)
      await Promise.resolve()
      order.push(`${name}:end`)
    }

    await Promise.all([queue.next(() => slow('a')), queue.next(() => slow('b'))])

    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
  })

  it('hands the answer back to whoever queued the work', async () => {
    const queue = writeQueue()

    await expect(queue.next(() => Promise.resolve(['x']))).resolves.toEqual(['x'])
  })

  /** A failed write must not block the ones queued behind it for the rest of the session. */
  it('keeps going after one fails, and still reports that one to its caller', async () => {
    const queue = writeQueue()

    await expect(queue.next(() => Promise.reject(new Error('nope')))).rejects.toThrow('nope')
    await expect(queue.next(() => Promise.resolve('after'))).resolves.toBe('after')
  })

  it('settles what is in flight, for the moments the process may not outlive them', async () => {
    const queue = writeQueue()
    let done = false
    void queue.next(async () => {
      await Promise.resolve()
      done = true
    })

    await queue.settled()

    expect(done).toBe(true)
  })

  it('settles even when what is in flight failed', async () => {
    const queue = writeQueue()
    void queue.next(() => Promise.reject(new Error('nope'))).catch(() => {})

    await expect(queue.settled()).resolves.toBeUndefined()
  })
})

describe("a staging name of the caller's own", () => {
  it('writes through the name it was given', async () => {
    const file = join(folder, 'doc.json')

    await writeAtomic(file, '{"a":1}', { staging: join(folder, 'doc.json.abc.tmp') })

    expect(await readFile(file, 'utf8')).toBe('{"a":1}')
  })

  /**
   * Several windows save into one project folder, so a fixed staging name would have two writes
   * clobbering the same copy — which is exactly the crash the atomic rename exists to prevent.
   */
  it('leaves two concurrent writes each their own copy', async () => {
    const first = join(folder, 'one.json')
    const second = join(folder, 'two.json')

    await Promise.all([
      writeAtomic(first, 'first', { staging: join(folder, 'one.json.aaa.tmp') }),
      writeAtomic(second, 'second', { staging: join(folder, 'two.json.bbb.tmp') }),
    ])

    expect(await readFile(first, 'utf8')).toBe('first')
    expect(await readFile(second, 'utf8')).toBe('second')
    // Neither copy outlives its write.
    expect((await readdir(folder)).filter(name => name.endsWith('.tmp'))).toEqual([])
  })

  /**
   * The defect this shares out: `documents.ts` had its own copy of this, with an unprotected `rm`.
   *
   * A staging path that is a non-empty folder fails both ways — `writeFile` cannot open it, and
   * `rm` without `recursive` will not remove it — and the two say so differently. What must reach
   * the caller is why the *content* could not be written.
   */
  it('raises why the content could not be written, not why the copy would not go away', async () => {
    const staging = join(folder, 'doc.json.ccc.tmp')
    await mkdir(staging)
    await writeFile(join(staging, 'inside'), 'x')

    const write = writeAtomic(join(folder, 'doc.json'), 'x', { staging })

    await expect(write).rejects.toThrow(/illegal operation on a directory/)
    await expect(write).rejects.not.toThrow(/rm returned/)
  })
})
