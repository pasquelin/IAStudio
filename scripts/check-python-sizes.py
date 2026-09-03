"""Emit Python class/function spans and cyclomatic complexity as JSON."""

import ast
import json
import sys

COMPLEXITY_THRESHOLD = 10


def complexity(node: ast.AST) -> int:
    score = 1
    branches = (ast.If, ast.For, ast.AsyncFor, ast.While, ast.IfExp, ast.ExceptHandler)

    class Counter(ast.NodeVisitor):
        def visit(self, child: ast.AST) -> None:
            nonlocal score
            nested_scopes = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)
            if child is not node and isinstance(child, nested_scopes):
                return
            if isinstance(child, branches):
                score += 1
            elif isinstance(child, ast.BoolOp):
                score += max(1, len(child.values) - 1)
            elif isinstance(child, ast.Match):
                score += len(child.cases)
            super().visit(child)

    Counter().visit(node)
    return score


def inspect(path: str) -> list[dict[str, object]]:
    source = open(path, encoding="utf-8").read()
    tree = ast.parse(source, filename=path)
    findings: list[dict[str, object]] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            start = min([node.lineno, *(item.lineno for item in node.decorator_list)])
            size = node.end_lineno - start + 1
            findings.append({"kind": "class", "name": node.name, "lines": size})
        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start = min([node.lineno, *(item.lineno for item in node.decorator_list)])
            size = node.end_lineno - start + 1
            score = complexity(node)
            kind = "complex" if score >= COMPLEXITY_THRESHOLD else "function"
            findings.append({"kind": kind, "name": node.name, "lines": size, "complexity": score})
    return findings


print(json.dumps(inspect(sys.argv[1])))
