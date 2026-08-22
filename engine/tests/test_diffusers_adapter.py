"""
What the adapter refuses BEFORE it imports anything.

Everything below runs without torch, and that is deliberate: `pnpm engine:check` must not have to
download 682 MB to be green. What loading a real pipeline does is proven by the end-to-end run.
"""

from pathlib import Path

from ia_studio_engine.adapters.diffusers_adapter import DiffusersAdapter, LoadedModel


def test_refuses_a_folder_that_is_not_one(tmp_path: Path) -> None:
    assert "not a folder" in (DiffusersAdapter.refuse_reason(str(tmp_path / "nowhere")) or "")


def test_admits_a_folder_of_weights(tmp_path: Path) -> None:
    (tmp_path / "model_index.json").write_text("{}")
    (tmp_path / "model.safetensors").write_bytes(b"")

    assert DiffusersAdapter.refuse_reason(str(tmp_path)) is None


def test_refuses_weights_that_carry_python(tmp_path: Path) -> None:
    (tmp_path / "model_index.json").write_text("{}")
    (tmp_path / "custom_model.py").write_text("import os")

    assert "custom_model.py" in (DiffusersAdapter.refuse_reason(str(tmp_path)) or "")


def test_sees_python_hidden_a_folder_down(tmp_path: Path) -> None:
    (tmp_path / "transformer").mkdir()
    (tmp_path / "transformer" / "modeling.py").write_text("import os")

    assert "modeling.py" in (DiffusersAdapter.refuse_reason(str(tmp_path)) or "")


def test_unload_drops_the_pipeline_it_held() -> None:
    """`loaded = None` alone leaves the nn.Module cycle alive; the adapter must drop the object."""
    adapter = DiffusersAdapter()
    adapter.loaded = LoadedModel(
        model_id="sana",
        device="cpu",
        pipeline=object(),
        bytes_resident=1,
        tensor_bytes=1,
        load_ms=1,
    )

    adapter.unload()

    assert adapter.loaded is None
