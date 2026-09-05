import json

import numpy as np
import pytest

from ia_studio_engine.autorig.fps import farthest_point_indices
from ia_studio_engine.autorig.make_it_animatable import (
    JOINT_NAMES,
    PARENTS,
    _focus_surface_on_hands,
    _post_process_weights,
    _simplify_fingers,
    _skin_weights,
    _write_result,
)


def test_fps_is_deterministic_and_spreads_samples_without_a_compiled_extension():
    points = np.array(((0, 0, 0), (1, 0, 0), (2, 0, 0), (10, 0, 0)), dtype=np.float32)

    assert farthest_point_indices(points, 3).tolist() == [3, 0, 2]


def test_fps_keeps_indices_unique_when_positions_are_duplicates():
    points = np.zeros((4, 3), dtype=np.float32)

    assert len(set(farthest_point_indices(points, 4).tolist())) == 4


def test_skinning_stops_between_large_vertex_chunks():
    completed: list[object] = []

    class Tensor:
        def to(self, _device):
            return self

    chunks = [Tensor(), Tensor(), Tensor()]

    class Weight:
        def cpu(self):
            return self

    class Models:
        device = "cpu"

        def skin(self, _points, chunk):
            completed.append(chunk)
            return type("Result", (), {"bw": Weight()})()

    class Torch:
        @staticmethod
        def split(_tensor, _size, dim):
            assert dim == 1
            return chunks

        @staticmethod
        def cat(_chunks, dim):
            raise AssertionError(f"cancelled skinning must not concatenate on dimension {dim}")

    with pytest.raises(InterruptedError, match="CANCELLED"):
        _skin_weights(
            Models(),
            object(),
            Tensor(),
            lambda: len(completed) == 1,
            Torch(),
        )

    assert completed == [chunks[0]]


def test_second_pass_reserves_half_of_its_surface_samples_for_the_hands():
    vertices = np.array(
        (
            (-1.0, 0.0, 0.0),
            (-0.9, 0.0, 0.0),
            (-1.0, 0.1, 0.0),
            (1.0, 0.0, 0.0),
            (0.9, 0.0, 0.0),
            (1.0, 0.1, 0.0),
            (0.0, 2.0, 0.0),
            (0.1, 2.0, 0.0),
            (0.0, 2.1, 0.0),
        ),
        dtype=np.float32,
    )
    triangles = np.array(((0, 1, 2), (3, 4, 5), (6, 7, 8)), dtype=np.uint32)

    sampled = _focus_surface_on_hands(
        vertices,
        triangles,
        100,
        np.array(((-1.0, 0.0, 0.0), (1.0, 0.0, 0.0)), dtype=np.float32),
    )[0]

    near_a_hand = (
        np.minimum(
            np.linalg.norm(sampled - np.array((-1.0, 0.0, 0.0)), axis=1),
            np.linalg.norm(sampled - np.array((1.0, 0.0, 0.0)), axis=1),
        )
        < 0.2
    )
    assert sampled.shape == (100, 3)
    assert near_a_hand.sum() >= 50


def test_simplified_fingers_merge_their_weights_into_each_hand():
    heads = np.arange(len(JOINT_NAMES) * 3, dtype=np.float32).reshape(len(JOINT_NAMES), 3)
    tails = heads + 1
    weights = np.zeros((2, len(JOINT_NAMES)), dtype=np.float32)
    weights[0, JOINT_NAMES.index("LeftHandIndex1")] = 1
    weights[1, JOINT_NAMES.index("RightHandThumb1")] = 1

    names, parents, simple_heads, simple_tails, simple_weights = _simplify_fingers(
        JOINT_NAMES, PARENTS, heads, tails, weights
    )

    assert all("Thumb" not in name and "Index" not in name for name in names)
    assert simple_weights[0, names.index("LeftHand")] == 1
    assert simple_weights[1, names.index("RightHand")] == 1
    assert simple_heads.shape == simple_tails.shape == (len(names), 3)
    assert all(parent < index for index, parent in enumerate(parents) if parent >= 0)


def test_weight_cleanup_removes_conflicting_limbs_and_keeps_four_normalized_influences():
    weights = np.full((1, len(JOINT_NAMES)), 0.01, dtype=np.float32)
    weights[0, JOINT_NAMES.index("LeftHandIndex1")] = 0.5
    weights[0, JOINT_NAMES.index("RightHandIndex1")] = 0.4
    weights[0, JOINT_NAMES.index("LeftHandMiddle1")] = 0.3
    weights[0, JOINT_NAMES.index("LeftHand")] = 0.2

    cleaned = _post_process_weights(weights, JOINT_NAMES)

    assert cleaned[0, JOINT_NAMES.index("RightHandIndex1")] == 0
    assert cleaned[0, JOINT_NAMES.index("LeftHandMiddle1")] == 0
    assert np.count_nonzero(cleaned[0]) <= 4
    assert cleaned.sum(axis=1) == pytest.approx([1])


def test_result_manifest_only_lists_files_that_are_written(tmp_path):
    arrays = {
        "jointNames": ("Hips",),
        "parents": (-1,),
        "heads": np.zeros((1, 3), dtype=np.float32),
        "tails": np.ones((1, 3), dtype=np.float32),
        "weights": np.ones((2, 1), dtype=np.float32),
        "pose": np.zeros((1, 6), dtype=np.float32),
    }

    _write_result(tmp_path, arrays, 2)

    manifest = json.loads((tmp_path / "result.json").read_text())
    assert manifest["files"] == {
        "heads": "heads.bin",
        "tails": "tails.bin",
        "weights": "weights.bin",
        "pose": "pose.bin",
    }
