"""Picks the adapter the loaded model actually needs. The door holds one of these."""

from __future__ import annotations

from typing import Any

from ia_studio_engine.adapters.diffusers_adapter import DiffusersAdapter
from ia_studio_engine.adapters.modalities import Modality
from ia_studio_engine.adapters.plugin_adapter import PluginAdapter
from ia_studio_engine.adapters.plugin_ids import is_plugin_model


class RoutingAdapter:
    """Diffusers by default; a plugin id swaps the inner adapter and unloads the previous."""

    def __init__(self, modality: Modality) -> None:
        self.modality = modality
        self._inner: DiffusersAdapter | PluginAdapter = DiffusersAdapter(modality)

    @property
    def loaded(self) -> Any:
        return self._inner.loaded

    def backend(self) -> str:
        return self._inner.backend()

    def device(self) -> str:
        return self._inner.device()

    def held_bytes(self) -> int | None:
        return self._inner.held_bytes()

    def load(
        self,
        model_id: str,
        folder: str,
        torch_weights: bool = False,
        attachment: dict[str, Any] | None = None,
    ) -> Any:
        plugin = is_plugin_model(model_id)
        inner_is_plugin = isinstance(self._inner, PluginAdapter)
        if plugin != inner_is_plugin:
            self._inner.unload()
            self._inner = PluginAdapter() if plugin else DiffusersAdapter(self.modality)
        return self._inner.load(
            model_id, folder, torch_weights=torch_weights, attachment=attachment
        )

    def unload(self) -> None:
        self._inner.unload()

    def generate(
        self,
        params: dict[str, Any],
        destination: str,
        door: str,
        on_step: Any = None,
        stopping: Any = None,
    ) -> dict[str, Any]:
        return self._inner.generate(params, destination, door, on_step, stopping)
