import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createLogFile } from './logFile'

const folder = (): string => mkdtempSync(join(tmpdir(), 'log-file-'))

describe('the main process log recorded to a rotating file', () => {
  it('writes a timestamped line naming the level and the scope', () => {
    const directory = folder()

    createLogFile(directory)({ level: 'error', scope: 'assets', message: 'nothing came back' })

    expect(readFileSync(join(directory, 'main.log'), 'utf8')).toMatch(
      /^\d{4}-\d{2}-\d{2}T[\d:.]+Z error \[assets\] nothing came back\n$/,
    )
  })

  it('creates the directory the first line needs', () => {
    const directory = join(folder(), 'logs')

    createLogFile(directory)({ level: 'info', scope: 'startup', message: 'up' })

    expect(existsSync(join(directory, 'main.log'))).toBe(true)
  })

  it('moves the full file aside and starts the next one on what came after', () => {
    const directory = folder()
    const record = createLogFile(directory, 80)

    record({ level: 'info', scope: 'first', message: 'a'.repeat(60) })
    record({ level: 'info', scope: 'second', message: 'the line that rotated it' })

    expect(readFileSync(join(directory, 'main.1.log'), 'utf8')).toContain('[first]')
    const current = readFileSync(join(directory, 'main.log'), 'utf8')
    expect(current).toContain('[second]')
    expect(current).not.toContain('[first]')
  })

  // A run that started over would otherwise append to a file already past its size and never
  // rotate it — the count has to come from the disk, not from this process alone.
  it('counts what an earlier run left in the file', () => {
    const directory = folder()
    writeFileSync(join(directory, 'main.log'), 'x'.repeat(90))

    createLogFile(directory, 80)({ level: 'info', scope: 'later', message: 'after a restart' })

    expect(readFileSync(join(directory, 'main.1.log'), 'utf8')).toBe('x'.repeat(90))
    expect(readFileSync(join(directory, 'main.log'), 'utf8')).toContain('[later]')
  })

  it('says so once and stops, rather than throwing, when the directory cannot be made', () => {
    const directory = folder()
    writeFileSync(join(directory, 'wall'), '')
    const complained = vi.spyOn(console, 'error').mockImplementation(() => {})
    const record = createLogFile(join(directory, 'wall', 'logs'))

    expect(() => record({ level: 'error', scope: 'assets', message: 'lost' })).not.toThrow()
    expect(() => record({ level: 'error', scope: 'assets', message: 'lost again' })).not.toThrow()

    expect(complained).toHaveBeenCalledTimes(1)
    complained.mockRestore()
  })
})
