import numpy as np

from ia_studio_engine.autorig.fps import farthest_point_indices


def test_fps_is_deterministic_and_spreads_samples_without_a_compiled_extension():
    points = np.array(((0, 0, 0), (1, 0, 0), (2, 0, 0), (10, 0, 0)), dtype=np.float32)

    assert farthest_point_indices(points, 3).tolist() == [3, 0, 2]


def test_fps_keeps_indices_unique_when_positions_are_duplicates():
    points = np.zeros((4, 3), dtype=np.float32)

    assert len(set(farthest_point_indices(points, 4).tolist())) == 4
