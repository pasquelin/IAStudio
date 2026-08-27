import ts from 'typescript'
import type { JsonValue } from '@shared/domain/component'
import type { ActionField } from '@shared/domain/assistantAction'

/** One setting a script declares, and what the inspector should show for it. */
export type ScriptProp = { field: ActionField; fallback: JsonValue }

/**
 * The settings a script declares, read off its `props`.
 *
 * 🛑 Read from the SOURCE and never from the sandbox: a script has to be inspectable before it
 * has ever run, and running one to find out what it exposes is how an editor freezes.
 *
 * The kind comes from the DEFAULT's own type, which is why a default is required: `speed: 3` is a
 * number field, `friendly: true` a switch, and `name: 'Bob'` a text one. Anything else — an
 * expression, a call, an object — is left out rather than guessed at.
 */
export function scriptProps(source: string): readonly ScriptProp[] {
  const file = ts.createSourceFile('script.ts', source, ts.ScriptTarget.ES2020, true)
  const declared = propsObject(file)
  if (!declared) return []

  const held: ScriptProp[] = []
  for (const member of declared.properties) {
    if (!ts.isPropertyAssignment(member)) continue
    const key = nameOf(member.name)
    const fallback = literal(member.initializer)
    if (key === null || fallback === null) continue
    held.push({ field: fieldOf(key, fallback), fallback })
  }
  return held
}

/** The `props: { … }` of the object handed to `defineScript`, wherever the call sits. */
function propsObject(file: ts.SourceFile): ts.ObjectLiteralExpression | null {
  let found: ts.ObjectLiteralExpression | null = null

  const visit = (node: ts.Node): void => {
    if (
      found === null &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'defineScript'
    ) {
      const argument = node.arguments[0]
      if (argument && ts.isObjectLiteralExpression(argument)) {
        for (const member of argument.properties) {
          if (
            ts.isPropertyAssignment(member) &&
            nameOf(member.name) === 'props' &&
            ts.isObjectLiteralExpression(member.initializer)
          ) {
            found = member.initializer
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(file)
  return found
}

const nameOf = (name: ts.PropertyName): string | null =>
  ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : null

/** A literal the studio can store, or nothing at all — an expression is not a default. */
function literal(node: ts.Expression): JsonValue | null {
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  // A negative number is a prefix expression, which is what `-1` parses to.
  if (
    ts.isPrefixUnaryExpression(node) &&
    node.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(node.operand)
  ) {
    return -Number(node.operand.text)
  }
  return null
}

const fieldOf = (key: string, fallback: JsonValue): ActionField => ({
  key,
  kind:
    typeof fallback === 'boolean' ? 'boolean' : typeof fallback === 'number' ? 'number' : 'text',
  // The author's own word, shown as written: nothing translates what somebody named in their file.
  labelKey: key,
  required: false,
})
