"""
Our code, translating the studio's contract into a Diffusers pipeline. It is not the deserialisation
path — that is `loader`, one level below — and it applies no admission policy: the request it is
given was already admitted by the main process, and it refuses anything else as malformed.

Three refusals are wired here rather than trusted to a default, and each was measured on
2026-08-22 (spec § I.2): `use_safetensors=True` refuses instead of falling back to a pickle ·
`torch.load` has refused pickles by default since PyTorch 2.6 · and `trust_remote_code` does NOT
guard a local folder whose architecture Transformers knows, so passing `False` is necessary and
never sufficient — what protects is the manifest listing every file that reaches the disk.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


class LoadRefusedError(Exception):
    """The request is malformed, or names weights this adapter cannot open. Not a policy."""


def _device() -> str:
    """The device REALLY used: a silent CPU fallback is indistinguishable from a slow machine."""
    import torch

    if torch.backends.mps.is_available():
        return "mps"
    return "cuda" if torch.cuda.is_available() else "cpu"


def _resident_bytes(device: str) -> int | None:
    """`None` where the backend does not answer — an unread reading is never given a value."""
    import torch

    if device == "mps":
        return int(torch.mps.current_allocated_memory())
    if device == "cuda":
        total, free = torch.cuda.mem_get_info()
        return int(free - total)
    return None


@dataclass
class LoadedModel:
    model_id: str
    device: str
    pipeline: Any
    bytes_resident: int | None
    load_ms: float


class DiffusersAdapter:
    """Holds at most one pipeline. What it holds and what it costs are ANSWERED, never guessed."""

    def __init__(self) -> None:
        self.loaded: LoadedModel | None = None

    def backend(self) -> str:
        return "pytorch"

    def device(self) -> str:
        return _device()

    @staticmethod
    def refuse_reason(folder: str) -> str | None:
        """
        Read BEFORE any import: a refusal must not cost the 8.7 s `import torch` costs cold.

        A `.py` beside the weights is executed by `from_pretrained` on a LOCAL folder without
        asking — measured, spec § I.2, where `trust_remote_code=False` does NOT stop it. The
        manifest is what keeps one off the disk; this names the file rather than trusting a flag.
        """
        path = Path(folder)
        if not path.is_dir():
            return f"not a folder: {folder}"

        stray = sorted(entry.name for entry in path.rglob("*.py"))
        return f"the weights carry python: {', '.join(stray[:3])}" if stray else None

    def load(self, model_id: str, folder: str) -> LoadedModel:
        refusal = self.refuse_reason(folder)
        if refusal is not None:
            raise LoadRefusedError(refusal)

        from diffusers import DiffusionPipeline

        self.unload()
        device = _device()
        started = time.perf_counter_ns()
        pipeline = DiffusionPipeline.from_pretrained(
            folder,
            # Refuses rather than falling back to a pickle — measured, not assumed.
            use_safetensors=True,
            trust_remote_code=False,
            local_files_only=True,
            variant="fp16",
        ).to(device)
        load_ms = (time.perf_counter_ns() - started) / 1e6

        self.loaded = LoadedModel(
            model_id=model_id,
            device=device,
            pipeline=pipeline,
            bytes_resident=_resident_bytes(device),
            load_ms=load_ms,
        )
        return self.loaded

    def unload(self) -> None:
        """Answering does not prove the bytes came back — ADR-19. § L.1 is what will measure it."""
        import torch

        self.loaded = None
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()

    def generate(self, params: dict[str, Any], destination: str) -> dict[str, Any]:
        """Writes a file and answers its PATH: a control frame that grows cannot be replayed."""
        held = self.loaded
        if held is None:
            raise LoadRefusedError("no model is loaded")

        prompt = params.get("prompt")
        if not isinstance(prompt, str) or not prompt:
            raise LoadRefusedError("a generation needs a prompt")

        started = time.perf_counter_ns()
        image = held.pipeline(
            prompt=prompt,
            num_inference_steps=int(params.get("steps", 20)),
            height=int(params.get("height", 512)),
            width=int(params.get("width", 512)),
        ).images[0]
        generate_ms = (time.perf_counter_ns() - started) / 1e6

        image.save(destination)
        return {
            "path": destination,
            "device": held.device,
            "backend": self.backend(),
            "generateMs": round(generate_ms, 1),
            "bytesResident": _resident_bytes(held.device),
        }
