---
title: CEL Utilities | Scenario Docs
description: Shared CEL (Common Expression Language) evaluation environment for workflow expressions.
---

The `@scenario-labs/sdk/tools/cel` subpath exports a shared CEL evaluation environment used by the Scenario backend, frontend, and MCP server to evaluate workflow transform expressions identically. Import from the dedicated subpath — it is not part of the default entry point.

```
import { evaluateCel, createCelEnvironment } from '@scenario-labs/sdk/tools/cel';
```

---

## `evaluateCel(expression, variables?, options?)`

Canonical CEL evaluation entry point. Registers `exists(name)` bound to `variables`, plus any per-call extra functions, then evaluates the expression.

**Signature**

```
evaluateCel<T = unknown>(
  expression: string,
  variables?: Record<string, unknown>,
  options?: EvaluateCelOptions,
): T
```

**Parameters**

| Name         | Type                      | Description                                                                |
| ------------ | ------------------------- | -------------------------------------------------------------------------- |
| `expression` | `string`                  | The CEL expression to evaluate.                                            |
| `variables?` | `Record<string, unknown>` | Variable bindings for the expression. Defaults to `{}`.                    |
| `options?`   | `EvaluateCelOptions`      | Extra per-call functions. See [`EvaluateCelOptions`](#evaluateceloptions). |

**Returns**

`T` — the evaluated result, cast to the type parameter. If a registered handler is async, cel-js returns a Promise — use `await evaluateCel<Promise<T>>(...)` in that case.

**Example**

```
import { evaluateCel } from '@scenario-labs/sdk/tools/cel';


const result = evaluateCel<number>('x + 1', { x: 41 });
console.log(result); // 42


// exists() is provided automatically, bound to the variables object:
const hasX = evaluateCel<boolean>('exists("x")', { x: 41 });
console.log(hasX); // true
```

Note

`options.functions` must not redeclare a base function (`trim`, `slice`, `random`, `randomSample`) or `exists` — cel-js throws on overlapping signatures rather than overriding.

---

## `createCelEnvironment()`

Returns a fresh, extensible clone of the shared base CEL environment with `trim`, `slice`, `random`, and `randomSample` pre-registered. Consumers may register additional functions on it.

`exists()` is NOT available through this API — it must be bound per evaluation to a specific variables object. Use [`evaluateCel`](#evaluatecelexpression-variables-options) if you need `exists()`.

**Signature**

```
createCelEnvironment(): Environment
```

**Returns**

`Environment` (from `@marcbachmann/cel-js`) — a cloned environment with base functions registered.

**Example**

```
import { createCelEnvironment } from '@scenario-labs/sdk/tools/cel';


const env = createCelEnvironment();


env.registerFunction('greet(string): string', (name: string) => `Hello, ${name}!`);


const result = env.evaluate('greet(name)', { name: 'world' });
console.log(result); // 'Hello, world!'
```

---

## Base functions

The following functions are always available in every environment created by this module.

### `trim(value)`

Trim leading and trailing whitespace. Null-safe: `null` becomes `""`.

**CEL signature:** `trim(dyn): string`

---

### `slice(list, start, end)`

Return `list[start:end]` with JavaScript `Array.prototype.slice` semantics.

**CEL signature:** `slice(dyn, int, int): list`

---

### `random(digits)`

Random integer with exactly `digits` digits (e.g. `random(5)` → `48574`). Unseeded; not deterministic. Semantics are ported verbatim from the backend for back-compat with deployed workflows.

**CEL signature:** `random(int): int`

---

### `randomSample(list, count[, seed][, withReplacement])`

Sample items from a list. An integer `seed` makes the result reproducible — the same seed produces the same sample across all Scenario runtimes (backend, frontend, MCP server). Without replacement, `count` is clamped to the list size rather than throwing.

Four overloads are registered:

```
randomSample(list, int): list
randomSample(list, int, int): list        — with seed
randomSample(list, int, bool): list       — with withReplacement
randomSample(list, int, int, bool): list  — with seed and withReplacement
```

**Example**

```
import { evaluateCel } from '@scenario-labs/sdk/tools/cel';


const items = ['a', 'b', 'c', 'd', 'e'];


// Reproducible 3-item sample with seed 42:
const sample = evaluateCel<string[]>('randomSample(items, 3, 42)', { items });
// The backend will return the same 3 items for the same seed.
```

---

### `exists(name)` — via `evaluateCel` only

Returns `true` when the named variable was provided and is not `null`. Registered by `evaluateCel` bound to the current `variables` object — not available on environments created with `createCelEnvironment`.

**CEL signature:** `exists(string): bool`

---

## `EvaluateCelOptions`

```
interface EvaluateCelOptions {
  /** Extra functions registered for this evaluation only. */
  functions?: CelFunctionRegistration[];
}
```

---

## `CelFunctionRegistration`

Descriptor for a function to register in a CEL environment.

```
interface CelFunctionRegistration {
  /** cel-js signature string, e.g. 'assetJson(string): dyn' */
  signature: string;
  handler: (...args: never[]) => unknown;
  description?: string;
  params?: CelFunctionParam[];
}
```

| Name           | Type                            | Description                                                     |
| -------------- | ------------------------------- | --------------------------------------------------------------- |
| `signature`    | `string`                        | cel-js signature string, e.g. `'assetJson(string): dyn'`.       |
| `handler`      | `(...args: never[]) => unknown` | The function implementation.                                    |
| `description?` | `string`                        | Human-readable description surfaced by `env.getDefinitions()`.  |
| `params?`      | `CelFunctionParam[]`            | Parameter metadata for UI tooling (e.g. autocomplete palettes). |

---

## `CelFunctionParam`

```
interface CelFunctionParam {
  name: string;
  description?: string;
}
```
