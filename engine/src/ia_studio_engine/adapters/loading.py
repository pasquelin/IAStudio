"""What a load produces, and what it refuses. Neutral: no adapter is named here."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any


class LoadRefusedError(Exception):
    """The request is malformed, or names weights no adapter can open. Not a policy."""


@dataclass
class LoadedModel:
    model_id: str
    device: str
    pipeline: Any
    bytes_resident: int | None
    tensor_bytes: int | None
    load_ms: float
    takes_step_callback: bool
    default_steps: int


def refuse_reason(folder: str) -> str | None:
    """
    Read BEFORE any import: a refusal must not cost the 8.7 s `import torch` costs cold, and a
    `.py` beside local weights RUNS — spec § I.2, `trust_remote_code=False` does not stop it.
    """
    path = Path(folder)
    if not path.is_dir():
        return f"not a folder: {folder}"

    stray = sorted(entry.name for entry in path.rglob("*.py"))
    return f"the weights carry python: {', '.join(stray[:3])}" if stray else None


NEEDS_PROMPT = "a generation needs a prompt"
NEEDS_PICTURE = "a generation needs a picture"


def generation_refusal(kwargs: dict[str, Any]) -> str | None:
    """A prompt, or a source the modality already turned into a pipeline argument."""
    if kwargs.get("prompt") or any(key in kwargs for key in ("image", "video", "src_audio")):
        return None
    return NEEDS_PROMPT
