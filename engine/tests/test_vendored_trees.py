"""What an over-trimmed vendor tree costs: an ImportError nothing here would otherwise reach.

The plugin extra is never installed by the gate, so no test imports these packages. Reading the
import statements is what remains — and it is what catches a module left behind when a training
half is dropped.
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


def _internal_imports(package: str) -> list[tuple[Path, str]]:
    found: list[tuple[Path, str]] = []
    for file in sorted((VENDOR / package).rglob("*.py")):
        for node in ast.walk(ast.parse(file.read_text(errors="ignore"))):
            if isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
                if node.module.split(".")[0] == package:
                    found.append((file, node.module))
            elif isinstance(node, ast.Import):
                found += [
                    (file, alias.name)
                    for alias in node.names
                    if alias.name.split(".")[0] == package
                ]
    return found


@pytest.mark.parametrize("package", VENDORED)
def test_every_internal_import_resolves(package: str) -> None:
    missing = [
        f"{file.relative_to(VENDOR)} -> {module}"
        for file, module in _internal_imports(package)
        if not VENDOR.joinpath(*module.split(".")).with_suffix(".py").exists()
        and not (VENDOR.joinpath(*module.split(".")) / "__init__.py").exists()
    ]

    assert missing == []


@pytest.mark.parametrize("package", VENDORED)
def test_every_vendored_file_parses(package: str) -> None:
    for file in (VENDOR / package).rglob("*.py"):
        ast.parse(file.read_text(errors="ignore"), filename=str(file))


def test_the_licence_of_each_vendored_tree_travels_with_it() -> None:
    assert [name for name in LICENCE_OF.values() if not (VENDOR / name).is_file()] == []


def test_no_vendored_tree_is_left_without_a_licence() -> None:
    trees = {path.name for path in VENDOR.iterdir() if path.is_dir() and path.name != "__pycache__"}

    assert trees == set(LICENCE_OF)
