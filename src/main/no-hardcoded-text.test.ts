import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const MAIN = dirname(fileURLToPath(import.meta.url))

/** The calls that put words on screen without a window: OS dialogs and notifications. */
const SHOWS_TEXT = new Set([
  'showMessageBox',
  'showMessageBoxSync',
  'showErrorBox',
  'showOpenDialog',
  'showSaveDialog',
  'showOpenDialogSync',
  'showSaveDialogSync',
  'Notification',
])

/** The fields of those calls a user reads. `defaultPath` is a path, `filters[].extensions` a list. */
const READ_FIELDS = new Set([
  'body',
  'buttonLabel',
  'buttons',
  'checkboxLabel',
  'detail',
  'message',
  'name',
  'subtitle',
  'title',
])

/**
 * Test material is out, `-fixtures.ts` included: a fixture builds the data a suite asserts on and
 * never reaches a screen, so a job it names `Flux` is the label the API returns, not a word this
 * studio writes. Coverage draws the same line (`vitest.config.ts`), and the exclusion is a
 * DECISION, taken 11/08 — a fixture forced through a bundle key says nothing truer and reads worse.
 *
 * `.tsx` as well as `.ts`: the sweep was widened to components, and a fixture is a fixture on
 * either side.
 */
function sourceFiles(directory: string, into: string[] = []): string[] {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) sourceFiles(path, into)
    else if (/\.tsx?$/.test(path) && !/(\.(test|bench)|-fixtures)\.tsx?$/.test(path))
      into.push(path)
  }

  return into
}

/**
 * Fields a registry fills for something on screen to read out. `name` is absent on purpose: a
 * scene node carries one as document data — a scene whose contents are called `Groupe` in French
 * could not be shared with an English studio — and a store carries one as its storage id.
 * `message` is absent for the same kind of reason: it names a worker's failure, never a screen.
 */
const REGISTRY_FIELDS = new Set([
  'buttonLabel',
  'caption',
  'description',
  'emptyLabel',
  'heading',
  'hint',
  'label',
  'legend',
  'placeholder',
  'summary',
  'title',
  'tooltip',
])

/**
 * A key, not a word. Registries hand `label: 'skybox.exposure'` to a component that resolves it,
 * which is the pattern to encourage — flagging it would push people back to writing the word.
 */
function isKey(text: string): boolean {
  return /^[a-z][A-Za-z0-9]*(\.[A-Za-z0-9_]+)+$/.test(text)
}

/** A word, rather than a symbol or a number that reads the same in any language. */
function isWords(text: string): boolean {
  return /\p{Letter}{2}/u.test(text)
}

function registryFindingsIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
  const findings: string[] = []

  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      REGISTRY_FIELDS.has(node.name.getText(source)) &&
      ts.isStringLiteral(node.initializer) &&
      isWords(node.initializer.text) &&
      !isKey(node.initializer.text)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.initializer.getStart(source))
      findings.push(`${path}:${line + 1} ${node.name.getText(source)}="${node.initializer.text}"`)
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

/** What a call is named, whether it is `dialog.showMessageBox(…)` or `new Notification(…)`. */
function calledName(node: ts.CallExpression | ts.NewExpression, source: ts.SourceFile): string {
  const target = node.expression
  if (ts.isPropertyAccessExpression(target)) return target.name.getText(source)
  return target.getText(source)
}

function findingsIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
  const findings: string[] = []

  /** Literals right inside the options object — the shape someone writes when in a hurry. */
  const inspect = (node: ts.Node, call: string): void => {
    if (ts.isPropertyAssignment(node) && READ_FIELDS.has(node.name.getText(source))) {
      const written = [
        node.initializer,
        ...(ts.isArrayLiteralExpression(node.initializer) ? node.initializer.elements : []),
      ]

      for (const value of written) {
        if (!ts.isStringLiteral(value) || value.text.trim() === '') continue
        const { line } = source.getLineAndCharacterOfPosition(value.getStart(source))
        findings.push(`${path}:${line + 1} ${call} ${node.name.getText(source)}="${value.text}"`)
      }
    }

    ts.forEachChild(node, child => inspect(child, call))
  }

  const visit = (node: ts.Node): void => {
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments !== undefined) {
      const call = calledName(node, source)
      if (SHOWS_TEXT.has(call)) {
        for (const argument of node.arguments) inspect(argument, call)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

/**
 * What a menu item shows. `accelerator` is deliberately absent: `Shift+CmdOrCtrl+R` is a key
 * spec Electron parses, not a word — and it is the one literal the menu writes today.
 */
const MENU_FIELDS = new Set(['label', 'sublabel', 'toolTip'])

/**
 * A menu is built from plain objects rather than passed to a call, so the dialog check above
 * cannot see it. It is the other surface with no component and no `t` of its own.
 */
function menuFindingsIn(path: string, code: string): string[] {
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true)
  const findings: string[] = []

  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      MENU_FIELDS.has(node.name.getText(source)) &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text.trim() !== ''
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.initializer.getStart(source))
      findings.push(`${path}:${line + 1} ${node.name.getText(source)}="${node.initializer.text}"`)
    }

    ts.forEachChild(node, visit)
  }

  visit(source)
  return findings
}

/**
 * The main process draws the one surface the bundles could be forgotten on: a native dialog has
 * no component and no `t`, so its wording is written where the call is. Everything it shows is
 * read from `TRANSLATIONS[windowLanguage()]` today, and this is what keeps it that way.
 *
 * Only literals written into the call itself are seen — a string reaching it through a variable
 * is beyond a check that reads one file at a time. That is the shape worth catching: the one
 * somebody types in a hurry.
 */
describe('the main process', () => {
  it('never writes the words a dialog shows', () => {
    const findings = sourceFiles(MAIN).flatMap(path =>
      findingsIn(relative(MAIN, path), readFileSync(path, 'utf8')),
    )

    expect(findings).toEqual([])
  })

  it('would see a message typed into the call', () => {
    const found = findingsIn(
      'probe.ts',
      "dialog.showMessageBox(window, { message: 'Discard your work?', buttons: ['Cancel', 'Discard'] })",
    )

    expect(found).toHaveLength(3)
  })

  it('never writes the words the native menu shows', () => {
    const findings = sourceFiles(MAIN).flatMap(path =>
      menuFindingsIn(relative(MAIN, path), readFileSync(path, 'utf8')),
    )

    expect(findings).toEqual([])
  })

  it('would see a label typed into a menu item', () => {
    const found = menuFindingsIn(
      'probe.ts',
      "const item = { label: 'Undo', accelerator: 'CmdOrCtrl+Z' }",
    )

    expect(found).toHaveLength(1)
  })

  it('leaves alone what the caller reads from a bundle, and what is not a word', () => {
    const quiet = [
      'dialog.showMessageBox(window, { message: t.discardTitle, buttons: [t.cancel, t.discard] })',
      "dialog.showSaveDialog({ defaultPath: 'scene.glb' })",
      "log.warn('renderer', { message: 'a technical line nobody reads on screen' })",
    ]

    expect(quiet.flatMap((code, index) => findingsIn(`probe${index}.ts`, code))).toEqual([])
  })
})

/**
 * The third guard, and the one that watches where nobody looks: a registry. A field descriptor,
 * a tool definition, a settings row is neither a component nor a native dialog, so the renderer's
 * JSX check never sees it and the two above do not either — and it is exactly where a label lives.
 *
 * It runs from here, of all places, because it reads the tree off the disk: `src/shared` is
 * compiled for the web as well, where `node:fs` has no types and no business being imported.
 */
describe('the registries', () => {
  const trees = ['renderer', 'shared', 'preload'].map(tree => join(MAIN, '..', tree))

  it('name their words rather than writing them', () => {
    const findings = trees.flatMap(tree =>
      sourceFiles(tree).flatMap(path =>
        registryFindingsIn(relative(join(MAIN, '..'), path), readFileSync(path, 'utf8')),
      ),
    )

    expect(findings).toEqual([])
  })

  // The check above read no `.tsx` at all until now, so a registry written beside the component
  // that renders it was invisible to all three guards — the renderer's own check only walks JSX,
  // and an array of rows declared above the component is not JSX. An empty result proves nothing
  // unless the files were opened, so this counts them.
  //
  // The number guards the regression that matters — narrowing the scan back to `.ts` drops it to
  // zero. It is a floor, not a tally: it will not notice a handful of components going missing.
  it('reads the components too, not only the modules beside them', () => {
    const scanned = trees.flatMap(tree => sourceFiles(tree))

    expect(scanned.filter(path => path.endsWith('.tsx')).length).toBeGreaterThan(150)
  })

  // The shape the widened scan exists for: rows declared beside the component that renders them,
  // which is neither JSX nor a module of its own. Not a lock on how the file is parsed — the TS
  // parser recovers from JSX it was not told to expect and finds this either way, measured.
  it('sees a registry declared beside the component that renders it', () => {
    const found = registryFindingsIn(
      'probe.tsx',
      "const ROWS = [{ key: 'exposure', label: 'Exposure' }]\nconst A = () => <Row items={ROWS} />",
    )

    expect(found).toHaveLength(1)
  })

  it('would see a word written where a key belongs', () => {
    const found = registryFindingsIn(
      'probe.ts',
      "const field = { key: 'exposure', label: 'Exposure' }",
    )

    expect(found).toHaveLength(1)
  })

  it('leaves a key alone, and what carries no word', () => {
    const quiet = [
      "const a = { label: 'skybox.exposure' }",
      "const b = { label: t('skybox.exposure') }",
      "const c = { title: '—' }",
    ]

    expect(quiet.flatMap((code, index) => registryFindingsIn(`probe${index}.ts`, code))).toEqual([])
  })

  /**
   * The exclusion above is worth exactly what its edge is worth: dropping fixtures must not drop
   * anything a screen reads, and `stores/` holds both kinds side by side.
   */
  it('steps over the fixtures and over nothing else', () => {
    const stores = sourceFiles(join(MAIN, '..', 'renderer', 'src', 'stores'))

    expect(stores.filter(path => path.endsWith('-fixtures.ts'))).toEqual([])
    expect(stores.some(path => path.endsWith('jobs.ts'))).toBe(true)
  })

  /**
   * `sourceFiles` feeds the dialog and menu guards too, and the main tree has fixtures of its
   * own — the exemption reaches them, so it is measured where it reaches rather than where it
   * was written for.
   */
  it('steps over the fixtures of the main tree as well, and keeps the rest', () => {
    const main = sourceFiles(MAIN)

    expect(main.filter(path => path.endsWith('-fixtures.ts'))).toEqual([])
    expect(main.some(path => path.endsWith('job-manager.ts'))).toBe(true)
  })
})
