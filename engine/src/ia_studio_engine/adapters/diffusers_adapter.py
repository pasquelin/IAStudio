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
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ia_studio_engine.adapters.modalities import MODALITIES, Modality
from ia_studio_engine.core.jobqueue import CancelledError


class LoadRefusedError(Exception):
    """The request is malformed, or names weights this adapter cannot open. Not a policy."""


def _device() -> str:
    """The device REALLY used: a silent CPU fallback is indistinguishable from a slow machine."""
    import torch

    if torch.backends.mps.is_available():
        return "mps"
    return "cuda" if torch.cuda.is_available() else "cpu"


def _tensor_bytes(device: str) -> int | None:
    """What the ALLOCATOR counts: live tensors. `None` where the backend does not answer."""
    import torch

    if device == "mps":
        return int(torch.mps.current_allocated_memory())
    if device == "cuda":
        return int(torch.cuda.memory_allocated())
    return None


def _held_bytes(device: str) -> int | None:
    """
    What was taken FROM THE POT, cache included — the number admission needs.

    Measured 2026-08-22: a generation moved the driver by 5.67 GB while the allocator did not move
    at all, so counting tensors alone under-reports a door mid-generation by two thirds.
    """
    import torch

    if device == "mps":
        return int(torch.mps.driver_allocated_memory())
    if device == "cuda":
        # `(free, total)`, in that order — the reverse reads negative, which no admission survives.
        free, total = torch.cuda.mem_get_info()
        return int(total - free)
    return None


def machine_memory(device: str) -> dict[str, int | None]:
    """
    The pot itself. `freeBytes` is `None` on `mps`, and that is the measurement rather than a gap.

    Measured 2026-08-22 with the studio running and a viewport open: `recommended_max_memory()`
    answered 83.49 GB unchanged while `vm_stat` showed **319 MB actually free** at the peak.
    Metal's ceiling is what THIS PROCESS may take, never what the machine has left — deriving
    `total - held` from it would have told admission 68 GB were free while the machine was at its
    knees. On `unified` the viewport draws from the same pot and no backend counter sees it, which
    is exactly what `MemorySnapshot.rendererReservedBytes` exists for.

    `unifiedBytes` MEASURES the domain: greater than zero on a SoC, zero on a dedicated card.
    """
    import torch

    if device == "mps":
        ceiling = int(torch.mps.recommended_max_memory())
        return {"totalBytes": ceiling, "freeBytes": None, "unifiedBytes": ceiling}
    if device == "cuda":
        # A dedicated card has its own pot, and `mem_get_info` answers for the DEVICE rather than
        # for this process — `[?]` never run here, no such machine.
        free, total = torch.cuda.mem_get_info()
        return {"totalBytes": int(total), "freeBytes": int(free), "unifiedBytes": 0}
    return {"totalBytes": None, "freeBytes": None, "unifiedBytes": None}


def _default_steps(pipeline: Any) -> int:
    """
    What the pipeline runs when the form left the field empty — StableAudio runs 100 where a
    literal 20 was assumed, and the reported ratio then climbs to five.
    """
    import inspect

    asked = inspect.signature(pipeline.__call__).parameters.get("num_inference_steps")
    return asked.default if asked is not None and isinstance(asked.default, int) else 20


def _takes_step_callback(pipeline: Any) -> bool:
    """
    🛑 A cancel lands on `callback_on_step_end` and nowhere else. Read, since `ShapEPipeline`
    does not take one and passing it raises `TypeError`.
    """
    import inspect

    return "callback_on_step_end" in inspect.signature(pipeline.__call__).parameters


#: Which pipeline reworks a sequence, by the one that was loaded — a table because diffusers
#: publishes no `AutoPipelineForVideoToVideo`. A model absent here simply serves no such
#: employment, and `_wanted_class` answers nothing rather than deriving something wrong.
VIDEO_TO_VIDEO = {
    "CogVideoXPipeline": "CogVideoXVideoToVideoPipeline",
    "WanPipeline": "WanVideoToVideoPipeline",
    "WanImageToVideoPipeline": "WanVideoToVideoPipeline",
    "MochiPipeline": "MochiVideoToVideoPipeline",
}


def accepted_kwargs(pipeline: Any, kwargs: dict[str, Any]) -> dict[str, Any]:
    """Drop arguments the resident class did not declare — a T2V still must not become TypeError."""
    import inspect

    try:
        parameters = inspect.signature(pipeline.__call__).parameters
    except (TypeError, ValueError):
        return kwargs
    if any(item.kind is inspect.Parameter.VAR_KEYWORD for item in parameters.values()):
        return kwargs
    return {key: value for key, value in kwargs.items() if key in parameters}


def generation_refusal(kwargs: dict[str, Any]) -> str | None:
    """A prompt, or a source the modality already turned into a pipeline argument."""
    if kwargs.get("prompt") or any(key in kwargs for key in ("image", "video", "src_audio")):
        return None
    return "a generation needs a prompt"


def tune_pipeline(pipeline: Any) -> None:
    """Slicing and tiling keep the peak in RAM. Slicing: +50 ms / 2 % on Sana 600M."""
    for knob in ("enable_attention_slicing", "enable_vae_slicing", "enable_vae_tiling"):
        enable = getattr(pipeline, knob, None)
        if callable(enable):
            enable()


def _attached(pipeline: Any, attachment: dict[str, Any], device: str) -> Any:
    """
    Weights grafted onto the pipeline that is already resident, never a second pipeline.

    A ControlNet is a network run BESIDE the pipeline's own, so it changes the class; an
    IP-Adapter is grafted onto the attention of the one already there, so it does not.
    """
    import torch
    from diffusers import AutoPipelineForText2Image, ControlNetModel

    if attachment["as"] == "ip-adapter":
        pipeline.load_ip_adapter(
            attachment["folder"],
            subfolder=attachment.get("subfolder") or "",
            weight_name=attachment.get("weight_name") or "",
        )
        return pipeline

    control = ControlNetModel.from_pretrained(
        attachment["folder"], use_safetensors=True, local_files_only=True, dtype=torch.float16
    ).to(device)
    return AutoPipelineForText2Image.from_pipe(pipeline, controlnet=control)


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


def memory_frame(device: str, backend: str, door: str) -> dict[str, Any]:
    """What a door answers for `memory.info`. Every number is READ, none is derived."""
    return {
        "door": door,
        "tensorBytes": _tensor_bytes(device),
        "heldBytes": _held_bytes(device),
        "device": device,
        "backend": backend,
        "machine": machine_memory(device),
    }


def pretrained_file_kwargs(torch_weights: bool) -> dict[str, bool | str]:
    """Which weight FILES to open. Shap-E's `.bin` renderer has no `fp16` sibling."""
    files: dict[str, bool | str] = {
        "use_safetensors": not torch_weights,
        "trust_remote_code": False,
        "local_files_only": True,
    }
    if not torch_weights:
        files["variant"] = "fp16"
    return files


class DiffusersAdapter:
    """Holds at most one pipeline. What it holds and what it costs are ANSWERED, never guessed."""

    def __init__(self, modality: Modality) -> None:
        # A door serves ONE modality, and it is handed in rather than read off a request: the
        # process that imports a video backend is not the one a release plan kills for an image.
        self.modality = modality
        self.loaded: LoadedModel | None = None
        # Pipelines derived from the loaded one by `from_pipe`. They SHARE its components, so
        # they cost no weights — dropped with it, or they would hold a model an unload freed.
        self._derived: dict[str, Any] = {}

    def backend(self) -> str:
        return "pytorch"

    def held_bytes(self) -> int | None:
        """What the door holds RIGHT NOW — read after an unload, never derived from one."""
        return _held_bytes(_device())

    def device(self) -> str:
        return _device()

    @staticmethod
    def refuse_reason(folder: str) -> str | None:
        """
        Read BEFORE any import: a refusal must not cost the 8.7 s `import torch` costs cold.
        A `.py` beside local weights runs without asking — spec § I.2,
        `trust_remote_code=False` does not stop it.
        """
        path = Path(folder)
        if not path.is_dir():
            return f"not a folder: {folder}"

        stray = sorted(entry.name for entry in path.rglob("*.py"))
        return f"the weights carry python: {', '.join(stray[:3])}" if stray else None

    def load(
        self,
        model_id: str,
        folder: str,
        torch_weights: bool = False,
        attachment: dict[str, Any] | None = None,
    ) -> LoadedModel:
        refusal = self.refuse_reason(folder)
        if refusal is not None:
            raise LoadRefusedError(refusal)

        from diffusers import DiffusionPipeline

        self.unload()
        device = _device()
        started = time.perf_counter_ns()
        import torch
        from diffusers.utils import logging as diffusers_logging

        # tqdm writes to stderr, and the studio journals a worker's stderr as an ERROR line. Left
        # on, a twenty-step denoise files twenty error lines for a job that went perfectly.
        # Progress belongs to `job.progress`, which the callback below pushes.
        diffusers_logging.disable_progress_bar()

        # `variant` picks which FILES are read; it does NOT set the compute dtype. Measured
        # 2026-08-22 on Sana 600M: with `variant="fp16"` alone the transformer and the VAE came
        # back `float32`, and only the text encoder was narrow. `dtype` is what makes it 3.21 Md
        # parameters at two bytes rather than four.
        pipeline = DiffusionPipeline.from_pretrained(
            folder,
            **pretrained_file_kwargs(torch_weights),
            dtype=torch.float16,
        ).to(device)

        if attachment is not None:
            pipeline = _attached(pipeline, attachment, device)

        tune_pipeline(pipeline)
        load_ms = (time.perf_counter_ns() - started) / 1e6

        self.loaded = LoadedModel(
            model_id=model_id,
            device=device,
            pipeline=pipeline,
            bytes_resident=_held_bytes(device),
            tensor_bytes=_tensor_bytes(device),
            load_ms=load_ms,
            takes_step_callback=_takes_step_callback(pipeline),
            default_steps=_default_steps(pipeline),
        )
        return self.loaded

    def unload(self) -> None:
        """Drops the pipeline object, then asks the cache. ADR-19: the figure is what we re-read."""
        held = self.loaded
        self.loaded = None
        self._derived.clear()
        if held is None:
            return

        pipeline = held.pipeline
        del held
        del pipeline
        import gc

        gc.collect()
        try:
            import torch
        except ImportError:
            return
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()

    def _wanted_class(self, kwargs: dict[str, Any]) -> Any:
        """
        Which pipeline the ARGUMENTS call for. Video goes through a TABLE: diffusers
        publishes no `AutoPipelineForVideoToVideo`, read on 2026-08-22.
        """
        if "video" in kwargs:
            import diffusers

            held = self.loaded
            assert held is not None
            wanted = VIDEO_TO_VIDEO.get(type(held.pipeline).__name__)
            return getattr(diffusers, wanted, None) if wanted else None

        # Image employments only. A mesh picture is Shap-E; a video picture is I2V — neither
        # is `AutoPipelineForImage2Image`. Import stays below: the gate has no diffusers.
        if "image" not in kwargs or self.modality is not MODALITIES["image"]:
            return None

        import diffusers

        return (
            diffusers.AutoPipelineForInpainting
            if "mask_image" in kwargs
            else diffusers.AutoPipelineForImage2Image
        )

    def _for(self, kwargs: dict[str, Any]) -> Any:
        """
        The pipeline the arguments call for, DERIVED from the one that is loaded.

        `from_pipe` reuses the components already resident rather than reading the weights again:
        one download, one residency, several employments.
        """
        held = self.loaded
        assert held is not None

        wanted = self._wanted_class(kwargs)
        if wanted is None:
            return held.pipeline

        derived = self._derived.get(wanted.__name__)
        if derived is None:
            derived = wanted.from_pipe(held.pipeline)
            self._derived[wanted.__name__] = derived
        return derived

    def generate(
        self,
        params: dict[str, Any],
        destination: str,
        door: str,
        on_step: Callable[[int, int], None] | None = None,
        stopping: Callable[[], bool] | None = None,
    ) -> dict[str, Any]:
        """Writes a file and answers its PATH: a control frame that grows cannot be replayed."""
        held = self.loaded
        if held is None:
            raise LoadRefusedError("no model is loaded")

        kwargs = self.modality.kwargs(params)
        refusal = generation_refusal(kwargs)
        if refusal is not None:
            raise LoadRefusedError(refusal)

        steps = int(kwargs.get("num_inference_steps", held.default_steps))

        def between_steps(_pipeline: Any, step: int, _timestep: Any, state: dict) -> dict:
            """The only place a cancel can land — a device call does not interrupt (Invariant 6)."""
            if stopping is not None and stopping():
                raise CancelledError("the generation was cancelled")
            if on_step is not None:
                on_step(step + 1, steps)
            return state

        pipeline = self._for(kwargs)
        if held.takes_step_callback:
            kwargs["callback_on_step_end"] = between_steps
        kwargs = accepted_kwargs(pipeline, kwargs)

        started = time.perf_counter_ns()
        result = pipeline(**kwargs)
        generate_ms = (time.perf_counter_ns() - started) / 1e6

        write_params = dict(params)
        sample_rate = getattr(pipeline, "sample_rate", None)
        if sample_rate is not None:
            write_params["samplingRate"] = int(sample_rate)
        self.modality.write(result, destination, write_params)
        return {
            "path": destination,
            "door": door,
            "device": held.device,
            "backend": self.backend(),
            "generateMs": round(generate_ms, 1),
            # `heldBytes` and `tensorBytes` are the names the ledger reads. A third spelling is
            # dropped in silence by a zod object that does not name it — measured, this one was.
            "heldBytes": _held_bytes(held.device),
            "tensorBytes": _tensor_bytes(held.device),
        }
