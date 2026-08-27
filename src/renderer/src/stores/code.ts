import { create } from 'zustand'
import { SCRIPT_EXTENSION } from '@shared/domain/game'
import { refFromString, refToString } from '@shared/domain/ref'
import { byCodeUnit } from '@shared/text'
import type { CodeProblem } from '@/engines/code/CodeEditor'
import { getBridge } from '@/services/bridge'

/** One script of the project, as the editor holds it. */
export type CodeFile = {
  /** `script:<path>` — the same reference a `Script` component carries and a fault names. */
  script: string
  /** What the disk last answered, so a change is told from a re-read. */
  saved: string
  source: string
}

export type CodeStoreState = {
  files: Record<string, CodeFile>
  /** Open tabs, in the order they were opened. */
  open: readonly string[]
  active: string | null
  problems: readonly CodeProblem[]
  /**
   * Where the cursor is wanted next, put there by whoever names a place — a problems row, or a
   * runtime error of a game that just ran. Cleared by the editor once it has moved.
   */
  goto: { script: string; line: number; column: number } | null
  /** Every script of the project, read whole. What a Play compiles is the same list. */
  reload: () => Promise<void>
  /** Opens a tab on that script, reading it if the project has not been walked yet. */
  show: (script: string) => void
  close: (script: string) => void
  edited: (script: string, source: string) => void
  noted: (problems: readonly CodeProblem[]) => void
  /** Opens that script and puts the cursor there — what a fault of a Play is clicked into. */
  openAt: (script: string, line: number, column: number) => void
  /** Said by the editor once the cursor moved, so the same place is not jumped to twice. */
  arrived: () => void
  /** Writes it into the project. Answers whether the main process took it. */
  save: (script: string) => Promise<boolean>
}

export const useCode = create<CodeStoreState>()((set, get) => ({
  files: {},
  open: [],
  active: null,
  problems: [],
  goto: null,

  reload: async () => {
    const held = (await getBridge()?.game.scripts()) ?? []
    const files: Record<string, CodeFile> = {}
    for (const file of held) {
      const script = refToString({ kind: 'script', path: file.path })
      // What is being TYPED wins over what the disk answered: a Play re-reads every script, and
      // an author who has not saved must not watch their work replaced under the cursor.
      const editing = get().files[script]
      files[script] = {
        script,
        saved: file.source,
        source: editing && editing.source !== editing.saved ? editing.source : file.source,
      }
    }
    set(state => ({ files, open: state.open.filter(script => script in files) }))
    set(state => ({ active: state.active && state.active in files ? state.active : null }))
  },

  show: script => {
    set(state => ({
      open: state.open.includes(script) ? state.open : [...state.open, script],
      active: script,
    }))
  },

  close: script => {
    set(state => {
      const open = state.open.filter(one => one !== script)
      return { open, active: state.active === script ? (open.at(-1) ?? null) : state.active }
    })
  },

  edited: (script, source) => {
    set(state => {
      const held = state.files[script]
      if (!held || held.source === source) return state
      return { files: { ...state.files, [script]: { ...held, source } } }
    })
  },

  noted: problems => set({ problems }),

  openAt: (script, line, column) => {
    set(state => ({
      open: state.open.includes(script) ? state.open : [...state.open, script],
      active: script,
      goto: { script, line, column },
    }))
  },

  arrived: () => set({ goto: null }),

  save: async script => {
    const held = get().files[script]
    const ref = refFromString(script)
    if (!held || ref?.kind !== 'script') return false

    const written = (await getBridge()?.game.writeScript(ref.path, held.source)) ?? false
    if (written) {
      set(state => {
        const now = state.files[script]
        return now ? { files: { ...state.files, [script]: { ...now, saved: now.source } } } : state
      })
    }
    return written
  },
}))

/** The scripts of the project, in one order — what the tab bar and the empty state read. */
export function codeFilesOf(state: CodeStoreState): readonly CodeFile[] {
  return Object.values(state.files).sort((one, other) => byCodeUnit(one.script, other.script))
}

/** Whether that file holds something the disk does not. Takes the FILE, so a memo can hold it. */
export function isCodeDirty(file: CodeFile | undefined): boolean {
  return file !== undefined && file.source !== file.saved
}

/** A path a new script can take, never one the project already holds. */
export function freeScriptPath(state: CodeStoreState, stem: string): string {
  for (let index = 0; ; index++) {
    const path = index === 0 ? `${stem}${SCRIPT_EXTENSION}` : `${stem}${index}${SCRIPT_EXTENSION}`
    const script = refToString({ kind: 'script', path })
    if (!(script in state.files)) return script
  }
}
