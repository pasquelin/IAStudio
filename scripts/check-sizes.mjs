#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

export const LIMITS = Object.freeze({
  file: 500,
  class: 300,
  function: 50,
  complex: 30,
  component: 250,
  hook: 150,
})
export const COMPLEXITY_THRESHOLD = 10

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.py', '.css', '.html'])
const EXCLUDED_PREFIXES = [
  'vendor/', // Sources owned and versioned by upstream projects.
  'engine/src/ia_studio_engine/vendor/', // Python model implementations mirrored from upstream.
  'src/renderer/public/', // Draco/KTX2 distributions copied from three.js.
  'docs/', // Generated documentation output.
  'out/',
  'dist/',
  '_site/',
]

const lines = (source, start, end) => {
  const before = source.slice(0, start).split('\n').length
  return source.slice(0, end).split('\n').length - before + 1
}

function functionName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text
  let parent = node.parent
  while (parent && (ts.isCallExpression(parent) || ts.isParenthesizedExpression(parent)))
    parent = parent.parent
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name))
    return parent.name.text
  if (parent && ts.isPropertyAssignment(parent)) return parent.name.getText()
  return '<anonymous>'
}

function complexityOf(node) {
  let complexity = 1
  const visit = child => {
    if (
      ts.isIfStatement(child) ||
      ts.isForStatement(child) ||
      ts.isForInStatement(child) ||
      ts.isForOfStatement(child) ||
      ts.isWhileStatement(child) ||
      ts.isDoStatement(child) ||
      ts.isConditionalExpression(child) ||
      ts.isCatchClause(child) ||
      (ts.isCaseClause(child) && child.statements.length > 0) ||
      (ts.isBinaryExpression(child) && ['&&', '||', '??'].includes(child.operatorToken.getText()))
    )
      complexity += 1
    if (child !== node && isFunction(child)) return
    ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  return complexity
}

function ownFunctionLines(source, node, tree) {
  const first = source.slice(0, node.getStart(tree)).split('\n').length
  const last = source.slice(0, node.end).split('\n').length
  const nestedLines = new Set()
  const visit = child => {
    if (child !== node && isFunction(child)) {
      const nestedFirst = source.slice(0, child.getStart(tree)).split('\n').length
      const nestedLast = source.slice(0, child.end).split('\n').length
      for (let line = nestedFirst; line <= nestedLast; line += 1) nestedLines.add(line)
      return
    }
    ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  let own = 0
  for (let line = first; line <= last; line += 1) if (!nestedLines.has(line)) own += 1
  return own
}

const isFunction = node =>
  ts.isFunctionDeclaration(node) ||
  ts.isFunctionExpression(node) ||
  ts.isArrowFunction(node) ||
  ts.isMethodDeclaration(node) ||
  ts.isGetAccessor(node) ||
  ts.isSetAccessor(node) ||
  ts.isConstructorDeclaration(node)

function containsJsx(node) {
  let found = false
  const visit = child => {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child))
      found = true
    else if (!found && (!isFunction(child) || child === node)) ts.forEachChild(child, visit)
  }
  ts.forEachChild(node, visit)
  return found
}

export function analyseTypeScript(source, filename = 'fixture.tsx') {
  const kind = filename.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filename.endsWith('.ts')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, kind)
  const findings = []
  const visit = node => {
    if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
      findings.push({
        kind: 'class',
        name: node.name?.text ?? '<anonymous>',
        lines: lines(source, node.getStart(tree), node.end),
      })
    }
    if (isFunction(node)) {
      const name = functionName(node)
      const span = lines(source, node.getStart(tree), node.end)
      const complexity = complexityOf(node)
      let kind = complexity >= COMPLEXITY_THRESHOLD ? 'complex' : 'function'
      if (/^use[A-Z0-9]/.test(name)) kind = 'hook'
      else if (/^[A-Z]/.test(name) && containsJsx(node)) kind = 'component'
      const size =
        kind === 'function' || kind === 'complex' ? ownFunctionLines(source, node, tree) : span
      findings.push({ kind, name, lines: size, complexity })
    }
    ts.forEachChild(node, visit)
  }
  visit(tree)
  return findings
}

function pythonFindings(filename) {
  const helper = resolve(ROOT, 'scripts/check-python-sizes.py')
  return JSON.parse(execFileSync('python3', [helper, filename], { encoding: 'utf8' }))
}

export function violationsFor(filename, source = readFileSync(filename, 'utf8')) {
  const relativeName = relative(ROOT, filename)
  const findings = []
  const fileLines = source === '' ? 0 : source.split('\n').length - Number(source.endsWith('\n'))
  if (fileLines >= LIMITS.file)
    findings.push({ kind: 'file', name: relativeName, lines: fileLines })
  const extension = extname(filename)
  const structures =
    extension === '.py'
      ? pythonFindings(filename)
      : ['.ts', '.tsx', '.js', '.mjs'].includes(extension)
        ? analyseTypeScript(source, filename)
        : []
  for (const finding of structures) {
    if (finding.lines >= LIMITS[finding.kind]) findings.push(finding)
  }
  return findings
}

export function maintainedFiles() {
  return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
    .toString()
    .split('\0')
    .filter(Boolean)
    .filter(name => CODE_EXTENSIONS.has(extname(name)))
    .filter(name => !EXCLUDED_PREFIXES.some(prefix => name.startsWith(prefix)))
}

export function run() {
  const failures = []
  for (const name of maintainedFiles()) {
    for (const finding of violationsFor(resolve(ROOT, name)))
      failures.push({ file: name, ...finding })
  }
  if (failures.length === 0) {
    process.stdout.write(`Size guard: ${maintainedFiles().length} maintained files comply.\n`)
    return 0
  }
  process.stderr.write(`Size guard: ${failures.length} violation(s). Limits are strict (< N).\n`)
  for (const item of failures) {
    const detail = item.complexity ? `, complexity ${item.complexity}` : ''
    process.stderr.write(
      `${item.file}: ${item.kind} ${item.name} is ${item.lines} lines${detail}; expected < ${LIMITS[item.kind]}.\n`,
    )
  }
  return 1
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  process.exitCode = run()
