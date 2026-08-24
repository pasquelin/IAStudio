"""
The one module every door runs. A modality `protocol/doors.py` names and `MODALITIES` does not is
a `KeyError` in a child process, read from the journal as a door that died at import.
"""

import pytest

from ia_studio_engine.adapters.modalities import MODALITIES
from ia_studio_engine.protocol.doors import DOORS
from ia_studio_engine.workers.door import main


def test_every_door_names_a_modality_that_exists() -> None:
    assert set(DOORS.values()) <= set(MODALITIES)


@pytest.mark.parametrize("argv", [["engine/video"], ["engine/nope", "3"]])
def test_a_door_refuses_to_start_on_anything_but_a_known_door_and_one_fd(argv: list[str]) -> None:
    """Refused BEFORE the socket: `socket(fileno=…)` on a descriptor nobody passed is a crash."""
    with pytest.raises(SystemExit, match="inherited fd"):
        main(argv)
