import numpy as np
import pytest

from ia_studio_engine.autorig.fps import farthest_point_indices
from ia_studio_engine.autorig.make_it_animatable import _skin_weights


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
