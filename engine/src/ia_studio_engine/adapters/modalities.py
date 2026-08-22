"""
What a modality asks a pipeline for, and how what comes back is written to a file.

The field names are the studio's, from `localFields.ts`. Which door serves which modality is
spelled here — in the four modules of `workers/` — and in `DOORS_BY_LOADER` of `localRuntimes.ts`,
which is the side that names the door on every request.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

#: What a diffusers pipeline is asked, whatever the modality. The studio's own names on the left.
COMMON_KEYS = {
    "negativePrompt": "negative_prompt",
    "steps": "num_inference_steps",
    "cfgScale": "guidance_scale",
}


def _number(params: dict[str, Any], key: str) -> Any:
    """A field the form may have left empty. Absent beats a default written twice."""
    value = params.get(key)
    return None if value is None or value == "" else value


def _generator(params: dict[str, Any]) -> Any:
    """The seed on the CPU whatever the device: `torch.Generator("mps")` does not exist."""
    seed = _number(params, "seed")
    if seed is None:
        return None

    import torch

    return torch.Generator("cpu").manual_seed(int(seed))


def _shared_kwargs(params: dict[str, Any]) -> dict[str, Any]:
    kwargs: dict[str, Any] = {"prompt": params["prompt"]}
    for ours, theirs in COMMON_KEYS.items():
        value = _number(params, ours)
        if value is not None:
            kwargs[theirs] = value

    generator = _generator(params)
    if generator is not None:
        kwargs["generator"] = generator
    return kwargs


def _sized_kwargs(params: dict[str, Any]) -> dict[str, Any]:
    kwargs = _shared_kwargs(params)
    for side in ("width", "height"):
        value = _number(params, side)
        if value is not None:
            kwargs[side] = int(value)
    return kwargs


def _image_kwargs(params: dict[str, Any]) -> dict[str, Any]:
    """
    The same knobs, plus the picture a generation edits — the main process resolved it to a PATH.

    A size is dropped once a picture is there: the pipeline reads the dimensions off it, and
    passing both makes it resize to something nobody asked for.
    """
    kwargs = _sized_kwargs(params)
    source = _number(params, "image")
    if source is None:
        return kwargs

    from diffusers.utils import load_image

    kwargs.pop("width", None)
    kwargs.pop("height", None)
    kwargs["image"] = load_image(str(source))

    mask = _number(params, "mask")
    if mask is not None:
        kwargs["mask_image"] = load_image(str(mask))

    strength = _number(params, "strength")
    # Refused by an inpainting pipeline that was handed no mask, and meaningless without a source.
    if strength is not None and mask is None:
        kwargs["strength"] = float(strength)
    return kwargs


def _video_kwargs(params: dict[str, Any]) -> dict[str, Any]:
    """`[?]` **Never run**: no video model is admitted — the lightest weighs 28.9 GB."""
    kwargs = _sized_kwargs(params)
    frames = _number(params, "frames")
    if frames is not None:
        kwargs["num_frames"] = int(frames)
    return kwargs


def _audio_kwargs(params: dict[str, Any]) -> dict[str, Any]:
    kwargs = _shared_kwargs(params)
    seconds = _number(params, "seconds")
    if seconds is not None:
        kwargs["audio_end_in_s"] = float(seconds)
    return kwargs


def _mesh_kwargs(params: dict[str, Any]) -> dict[str, Any]:
    """
    `[?]` **Never run**: Shap-E publishes its renderer as a pickle alone, which ADR-20 refuses.

    `mesh` and not the default `pil`: ShapE renders preview images unless asked for geometry.
    """
    return {**_shared_kwargs(params), "output_type": "mesh"}


def _write_image(result: Any, destination: str, _params: dict[str, Any]) -> None:
    result.images[0].save(destination)


def _write_video(result: Any, destination: str, params: dict[str, Any]) -> None:
    """
    `[?]` **Never run, and it would fail today**: `export_to_video` writes through `imageio` and
    `imageio-ffmpeg`, which the `diffusion` group does not declare — read in its source on
    2026-08-22. It raises a named `ImportError` rather than a nude one, so the day a video model
    is admitted the message says what to add.
    """
    from diffusers.utils import export_to_video

    fps = _number(params, "fps")
    export_to_video(result.frames[0], destination, fps=int(fps) if fps is not None else 16)


def _write_audio(result: Any, destination: str, _params: dict[str, Any]) -> None:
    """
    16-bit PCM through the standard library: `soundfile` would add a dependency, a licence line
    and a bundled libsndfile for a header that is written here in ten lines.

    `[?]` **Never run.** No audio model is admitted to the catalogue — ACE-Step has no pipeline in
    diffusers 0.40, and what does have one is non-commercial or gated (measured 2026-08-22).
    """
    import wave

    import numpy

    audio = numpy.asarray(result.audios[0])
    # `(channels, samples)` is what a pipeline hands back, and a wave file takes the transpose.
    frames = audio if audio.ndim == 1 else audio.T
    with wave.open(destination, "wb") as file:
        file.setnchannels(1 if frames.ndim == 1 else frames.shape[1])
        file.setsampwidth(2)
        # The PIPELINE's rate, never ours: 44 100 written for a model that sampled at 16 000 plays
        # back at three times the speed, with nothing to say it went wrong.
        file.setframerate(int(result.sampling_rate))
        file.writeframes((numpy.clip(frames, -1.0, 1.0) * 32767).astype("<i2").tobytes())


def _write_mesh(result: Any, destination: str, _params: dict[str, Any]) -> None:
    from diffusers.utils import export_to_ply

    export_to_ply(result.images[0], destination)


@dataclass(frozen=True)
class Modality:
    """One modality, as a door practises it: what it asks for, and what it writes."""

    kwargs: Callable[[dict[str, Any]], dict[str, Any]]
    write: Callable[[Any, str, dict[str, Any]], None]


MODALITIES: dict[str, Modality] = {
    "image": Modality(_image_kwargs, _write_image),
    "video": Modality(_video_kwargs, _write_video),
    "audio": Modality(_audio_kwargs, _write_audio),
    "mesh": Modality(_mesh_kwargs, _write_mesh),
}
