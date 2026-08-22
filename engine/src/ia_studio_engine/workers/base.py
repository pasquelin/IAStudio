"""
What every worker is, whatever it holds: a process that answers the engine's loop over a socket
it inherited, and pays the import cost of its backend ONCE.

The core stays at the 10 ms of a bare interpreter — measured, `import torch` costs 620 ms warm and
8.7 s cold — which is the whole reason a worker is a process rather than a module.
"""

from __future__ import annotations

import socket
from collections.abc import Callable, Mapping
from typing import Any

from ia_studio_engine import PROTOCOL_VERSION, __version__
from ia_studio_engine.core.supervisor import serve
from ia_studio_engine.protocol.envelope import encode_event

Handler = Callable[[dict[str, Any]], Any]


def worker_hello(door: str, backend: str, device: str) -> str:
    """A worker names its DOOR, not its runtime: that is what keys `MemorySnapshot.runtimeBytes`."""
    return encode_event(
        "worker.hello",
        door=door,
        engine=__version__,
        protocol=PROTOCOL_VERSION,
        backend=backend,
        device=device,
    )


def run_worker(connection: socket.socket, greeting: str, handlers: Mapping[str, Handler]) -> None:
    """Answers on an inherited socket until the engine closes it."""

    def send(line: str) -> None:
        connection.sendall(line.encode("utf-8"))

    try:
        serve(iter(lambda: connection.recv(65536), b""), send, handlers, greeting=greeting)
    finally:
        connection.close()
