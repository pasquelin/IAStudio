"""What an over-trimmed vendor tree costs: an ImportError nothing here would otherwise reach.

The plugin extra is never installed by the gate, so no test imports these packages — reading their
import statements is what remains. Relative imports are the ones that matter: three of the five
trees write nothing else, so skipping them left this guard green over an empty set.
"""

import ast
from pathlib import Path

import pytest

VENDOR = Path(__file__).resolve().parents[1] / "src/ia_studio_engine/vendor"

# The folder a package sits in, and the licence file that travels with it — TripoSR is vendored
# as `tsr`, the name its own imports use, so the pair cannot be derived from either half.
LICENCE_OF = {
    "craftsman": "CRAFTSMAN-LICENSE",
    "instantmesh": "INSTANTMESH-LICENSE",
    "lgm": "LGM-LICENSE",
    "triposg": "TRIPOSG-LICENSE",
    "tsr": "TRIPOSR-LICENSE",
}

VENDORED = sorted(LICENCE_OF)


def _targets(file: Path, package: str, node: ast.AST) -> list[Path]:
    if isinstance(node, ast.Import):
        return [
            VENDOR.joinpath(*alias.name.split("."))
            for alias in node.names
            if alias.name.split(".")[0] == package
        ]
    if not isinstance(node, ast.ImportFrom):
        return []
    if node.level == 0:
        if not node.module or node.module.split(".")[0] != package:
            return []
        return [VENDOR.joinpath(*node.module.split("."))]

    home = file.parents[node.level - 1]
    if node.module:
        return [home.joinpath(*node.module.split("."))]
    # `from . import a, b` names its modules on the right rather than in `module`.
    return [home / alias.name for alias in node.names]


def _imports(package: str) -> list[tuple[Path, Path]]:
    found: list[tuple[Path, Path]] = []
    for file in sorted((VENDOR / package).rglob("*.py")):
        tree = ast.parse(file.read_text(errors="ignore"), filename=str(file))
        for node in ast.walk(tree):
            found += [(file, target) for target in _targets(file, package, node)]
    return found


@pytest.mark.parametrize("package", VENDORED)
def test_every_internal_import_resolves(package: str) -> None:
    missing = [
        f"{file.relative_to(VENDOR)} -> {target.relative_to(VENDOR)}"
        for file, target in _imports(package)
        if not target.with_suffix(".py").exists() and not (target / "__init__.py").exists()
    ]

    assert missing == []


@pytest.mark.parametrize("package", VENDORED)
def test_a_tree_states_imports_this_guard_can_read(package: str) -> None:
    assert _imports(package) != []


def test_the_licence_of_each_vendored_tree_travels_with_it() -> None:
    assert [name for name in LICENCE_OF.values() if not (VENDOR / name).is_file()] == []


def test_no_vendored_tree_is_left_without_a_licence() -> None:
    trees = {path.name for path in VENDOR.iterdir() if path.is_dir() and path.name != "__pycache__"}

    assert trees == set(LICENCE_OF)
