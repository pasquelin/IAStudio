"""
The engine's own loop: connect, greet, then answer one request at a time.

The engine speaks FIRST. Reading a Python stack can fail, and it has to fail at the opening rather
than at the first generation — the same handshake `sttProtocol.ts` waits on.
"""

from __future__ import annotations

import argparse
import platform
import socket
import sys
from collections.abc import Callable, Iterable, Mapping, Sequence
from typing import Any

from ia_studio_engine import PROTOCOL_VERSION, __version__
from ia_studio_engine.hardware.probe import hardware_info
from ia_studio_engine.protocol.envelope import (
    EnvelopeError,
    Request,
    decode_request,
    encode_error,
    encode_event,
    encode_ok,
    frames,
)

Handler = Callable[[dict[str, Any]], Any]

CANCEL_OP = "engine.cancel"

HANDLERS: Mapping[str, Handler] = {"hardware.info": lambda _params: hardware_info()}


def hello() -> str:
    return encode_event(
        "engine.hello",
        engine=__version__,
        protocol=PROTOCOL_VERSION,
        python=platform.python_version(),
        platform=sys.platform,
    )


def _answer(request: Request, handlers: Mapping[str, Handler]) -> str:
    handler = handlers.get(request.op)
    if handler is None:
        return encode_error(request.id, "unknown-op", f"no such op: {request.op}")

    try:
        return encode_ok(request.id, handler(request.params))
    except Exception as error:
        return encode_error(request.id, "failed", str(error))


def serve(
    chunks: Iterable[bytes],
    send: Callable[[str], None],
    handlers: Mapping[str, Handler] = HANDLERS,
) -> None:
    """Greets, then answers until the stream ends. The end of the stream IS the shutdown."""
    send(hello())

    for line in frames(chunks):
        try:
            request = decode_request(line)
        except EnvelopeError as error:
            # An unreadable frame names no run, so there is no id to answer under.
            send(encode_event("runtime.error", message=str(error)))
            continue

        # Cancelling is about the envelope, not about a capability: it drops a request this engine
        # is holding. It holds none while every op answers in the same turn, so it drops nothing.
        if request.op == CANCEL_OP:
            continue

        send(_answer(request, handlers))


Stream = tuple[Iterable[bytes], Callable[[str], None], Callable[[], None]]


def _open_stream(path: str) -> Stream:
    if sys.platform == "win32":
        # `[?]` Never run: no Windows machine has measured this. Node serves a named pipe as a byte
        # stream and Python opens it as a file — the spec keeps § L.4 open on exactly this line.
        pipe = open(path, "r+b", buffering=0)  # noqa: SIM115 — it lives as long as the process

        def write_pipe(line: str) -> None:
            pipe.write(line.encode("utf-8"))

        return iter(lambda: pipe.read(65536), b""), write_pipe, pipe.close

    connection = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    connection.connect(path)

    def write_socket(line: str) -> None:
        connection.sendall(line.encode("utf-8"))

    return iter(lambda: connection.recv(65536), b""), write_socket, connection.close


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="ia-studio-engine")
    parser.add_argument("--socket", required=True, help="the socket or named pipe the main serves")
    options = parser.parse_args(argv)

    chunks, send, close = _open_stream(options.socket)
    try:
        serve(chunks, send)
    finally:
        close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
