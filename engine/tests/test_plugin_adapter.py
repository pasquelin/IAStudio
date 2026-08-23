"""Plugin family routing, without torch."""

import json
from pathlib import Path

import pytest

from ia_studio_engine.adapters.diffusers_adapter import LoadRefusedError
from ia_studio_engine.adapters.modalities import MODALITIES
from ia_studio_engine.adapters.plugin_adapter import PluginAdapter
from ia_studio_engine.adapters.plugin_ids import CUDA_ONLY, PLUGIN_IDS, is_plugin_model
from ia_studio_engine.adapters.routing_adapter import RoutingAdapter


def test_the_eleven_plugin_ids_are_named() -> None:
    assert {
        "triposr",
        "trellis-text-large",
        "trellis-image-large",
        "trellis2-4b",
        "triposg",
        "instantmesh",
        "lgm",
        "craftsman3d",
        "mmaudio-small-44k",
        "mmaudio-medium-44k",
        "mmaudio-large-44k",
    } == PLUGIN_IDS
    assert not is_plugin_model("sana-600m-1024")


def test_plugin_ids_match_the_wired_catalogue() -> None:
    root = Path(__file__).resolve().parents[2]
    catalogue = json.loads((root / "src/shared/domain/localModels.json").read_text())
    listed = {
        model["id"]
        for models in catalogue.values()
        for model in models
        if model.get("loader") == "plugin"
        and model.get("runtimeStatus", "supported") == "supported"
    }
    assert listed == set(PLUGIN_IDS)


def test_unsupported_plugins_have_no_adapter() -> None:
    root = Path(__file__).resolve().parents[2]
    catalogue = json.loads((root / "src/shared/domain/localModels.json").read_text())
    unwired = {
        model["id"]
        for models in catalogue.values()
        for model in models
        if model.get("loader") == "plugin" and model.get("runtimeStatus") == "unsupported"
    }
    assert unwired.isdisjoint(PLUGIN_IDS)


def test_trellis_is_cuda_only() -> None:
    assert "trellis-image-large" in CUDA_ONLY
    assert "triposg" in CUDA_ONLY
    assert "instantmesh" in CUDA_ONLY
    assert "lgm" in CUDA_ONLY
    assert "craftsman3d" in CUDA_ONLY
    assert "triposr" not in CUDA_ONLY
    assert "mmaudio-small-44k" not in CUDA_ONLY


def test_trellis_refuses_to_load_on_mps(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    import ia_studio_engine.adapters.plugin_adapter as plugin_adapter

    monkeypatch.setattr(plugin_adapter, "_device", lambda: "mps")
    with pytest.raises(LoadRefusedError, match="CUDA"):
        PluginAdapter().load("trellis-image-large", str(tmp_path))


def test_instantmesh_refuses_to_load_on_mps(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    import ia_studio_engine.adapters.plugin_adapter as plugin_adapter

    monkeypatch.setattr(plugin_adapter, "_device", lambda: "mps")
    with pytest.raises(LoadRefusedError, match="CUDA"):
        PluginAdapter().load("instantmesh", str(tmp_path))


def test_an_unknown_id_is_not_a_plugin_adapter(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    import ia_studio_engine.adapters.plugin_adapter as plugin_adapter

    monkeypatch.setattr(plugin_adapter, "_device", lambda: "cpu")
    with pytest.raises(LoadRefusedError, match="no plugin adapter"):
        PluginAdapter().load("ssd-1b", str(tmp_path))


def test_the_door_starts_on_diffusers() -> None:
    adapter = RoutingAdapter(MODALITIES["mesh"])

    assert type(adapter._inner).__name__ == "DiffusersAdapter"


def test_plugin_load_refuses_weights_that_carry_python(tmp_path: Path) -> None:
    (tmp_path / "custom_model.py").write_text("import os")
    adapter = PluginAdapter()

    with pytest.raises(LoadRefusedError, match=r"custom_model\.py"):
        adapter.load("triposr", str(tmp_path))


def test_a_second_plugin_load_unloads_the_first(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    import ia_studio_engine.adapters.plugin_adapter as plugin_adapter

    monkeypatch.setattr(plugin_adapter, "_device", lambda: "cpu")
    monkeypatch.setattr(plugin_adapter, "_held_bytes", lambda _device: 0)
    monkeypatch.setattr(plugin_adapter, "_tensor_bytes", lambda _device: 0)
    monkeypatch.setattr(plugin_adapter, "_load_triposr", lambda _folder, _device: "handle")
    (tmp_path / "config.yaml").write_text("{}")

    adapter = PluginAdapter()
    calls: list[str] = []
    original = adapter.unload

    def tracking_unload() -> None:
        calls.append("unload")
        original()

    monkeypatch.setattr(adapter, "unload", tracking_unload)
    adapter.load("triposr", str(tmp_path))

    assert calls == ["unload"]
    assert adapter._handle == "handle"
