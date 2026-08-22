"""
What the studio's fields become on the way to a pipeline.

**Blind spot, written rather than hidden**: only the image writer is exercised here. The other
three import diffusers or soundfile, and `pnpm engine:check` must never download 682 MB to be
green — what they write is proven by the end-to-end run.
"""

from typing import Any

import pytest

from ia_studio_engine.adapters.modalities import MODALITIES


def kwargs_of(modality: str, **params: Any) -> dict[str, Any]:
    return MODALITIES[modality].kwargs({"prompt": "a cat", **params})


def test_the_studio_field_names_reach_the_pipeline_as_its_own() -> None:
    asked = kwargs_of("image", steps=8, cfgScale=4.5, negativePrompt="blur")

    assert asked == {
        "prompt": "a cat",
        "num_inference_steps": 8,
        "guidance_scale": 4.5,
        "negative_prompt": "blur",
    }


@pytest.mark.parametrize("empty", [None, ""])
def test_a_knob_the_form_left_empty_is_not_sent_at_all(empty: object) -> None:
    """Sent as `None` it OVERWRITES the pipeline's own default with nothing."""
    assert "num_inference_steps" not in kwargs_of("image", steps=empty)


def test_a_size_reaches_the_pipeline_as_whole_pixels() -> None:
    assert kwargs_of("image", width="832", height=480)["width"] == 832


def test_a_video_counts_its_frames() -> None:
    assert kwargs_of("video", frames=81)["num_frames"] == 81


def test_a_sound_carries_how_long_it_runs() -> None:
    assert kwargs_of("audio", seconds=12)["audio_end_in_s"] == 12.0


def test_a_mesh_asks_for_geometry_rather_than_a_preview() -> None:
    """ShapE renders preview images unless asked, and a preview on the mesh shelf opens nowhere."""
    assert kwargs_of("mesh")["output_type"] == "mesh"


class StandInImage:
    def __init__(self) -> None:
        self.written: str | None = None

    def save(self, destination: str) -> None:
        self.written = destination


def test_an_image_is_written_where_the_main_process_said() -> None:
    image = StandInImage()
    result = type("Result", (), {"images": [image]})()

    MODALITIES["image"].write(result, "/tmp/out.png", {})

    assert image.written == "/tmp/out.png"
