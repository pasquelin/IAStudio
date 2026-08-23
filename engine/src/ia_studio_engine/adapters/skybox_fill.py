"""Turn a front view into the 2048x1024 canvas and mask a FluxFill panorama expects."""

from __future__ import annotations

from typing import Any

WIDTH, HEIGHT = 2048, 1024
#: The panorama is painted at twice the canvas and reduced, which is what softens the face seams.
SCALE = 2


def view_to_panorama(image: Any) -> tuple[Any, Any]:
    from PIL import Image

    side = min(image.size)
    left = (image.size[0] - side) // 2
    top = (image.size[1] - side) // 2
    front = image.crop((left, top, left + side, top + side)).resize((512, 512))
    white = Image.new("RGB", (512, 512), (255, 255, 255))
    black = Image.new("RGB", (512, 512), (0, 0, 0))
    around = {"back": white, "left": white, "right": white, "top": white, "bottom": white}

    rays = _rays(WIDTH * SCALE, HEIGHT * SCALE)
    panorama = _paint({"front": front, **around}, rays).resize((WIDTH, HEIGHT), Image.LANCZOS)
    # 🛑 Every OTHER ray of the same grid IS the grid of the smaller one — `theta` depends on
    # `x / out_w` alone, so the coarse angles are a subset of the fine ones. The mask is what
    # FluxFill must read exactly, so it is painted at its own size rather than resized into
    # a soft edge; what this saves is the trigonometry, not the painting.
    mask = _paint({"front": black, **around}, tuple(ray[::SCALE, ::SCALE] for ray in rays))
    return panorama, mask.convert("L")


def _rays(out_w: int, out_h: int) -> tuple[Any, Any, Any]:
    """Where each pixel of an equirectangular canvas looks — the only trigonometry here."""
    import numpy

    rx, ry, rz = numpy.deg2rad([90, -90, 180])
    rotation = (
        numpy.array(
            [[numpy.cos(rz), -numpy.sin(rz), 0], [numpy.sin(rz), numpy.cos(rz), 0], [0, 0, 1]]
        )
        @ numpy.array(
            [[numpy.cos(ry), 0, numpy.sin(ry)], [0, 1, 0], [-numpy.sin(ry), 0, numpy.cos(ry)]]
        )
        @ numpy.array(
            [[1, 0, 0], [0, numpy.cos(rx), -numpy.sin(rx)], [0, numpy.sin(rx), numpy.cos(rx)]]
        )
    )
    xv, yv = numpy.meshgrid(
        numpy.linspace(0, out_w - 1, out_w),
        numpy.linspace(0, out_h - 1, out_h),
    )
    theta = (xv / out_w) * 2 * numpy.pi - numpy.pi
    phi = (yv / out_h) * numpy.pi - (numpy.pi / 2)
    xs = numpy.cos(phi) * numpy.cos(theta)
    ys = numpy.cos(phi) * numpy.sin(theta)
    zs = numpy.sin(phi)
    stacked = rotation @ numpy.stack([xs.ravel(), ys.ravel(), zs.ravel()])
    return tuple(stacked[i].reshape(out_h, out_w) for i in range(3))


def _paint(faces: dict[str, Any], rays: tuple[Any, Any, Any]) -> Any:
    import numpy
    from PIL import Image

    xs, ys, zs = rays
    abs_x, abs_y, abs_z = numpy.abs(xs), numpy.abs(ys), numpy.abs(zs)
    face_index = numpy.argmax(numpy.stack([abs_x, abs_y, abs_z], axis=-1), axis=-1)
    pixels = numpy.zeros((*xs.shape, 3), dtype=numpy.uint8)
    samples = {
        "right": ((face_index == 0) & (xs > 0), -zs, abs_x, ys, abs_x),
        "left": ((face_index == 0) & (xs < 0), zs, abs_x, ys, abs_x),
        "bottom": ((face_index == 1) & (ys > 0), xs, abs_y, -zs, abs_y),
        "top": ((face_index == 1) & (ys < 0), xs, abs_y, zs, abs_y),
        "front": ((face_index == 2) & (zs > 0), xs, abs_z, ys, abs_z),
        "back": ((face_index == 2) & (zs < 0), -xs, abs_z, ys, abs_z),
    }
    for name, (covered, u_num, u_den, v_num, v_den) in samples.items():
        face = numpy.array(faces[name])
        flat = face.reshape(-1, face.shape[-1])
        # 🛑 `[M]` Five of the six faces are one colour — a panorama grown from a single view is
        # white all around, its mask black in front and white everywhere else. Sampling a texture
        # to read the same pixel back cost two divides and two clips over millions of rays.
        if bool(numpy.all(flat == flat[0])):
            pixels[covered] = flat[0]
            continue

        u = (u_num[covered] / u_den[covered] + 1) / 2
        v = (v_num[covered] / v_den[covered] + 1) / 2
        fh, fw = face.shape[:2]
        # Boolean indexing on both sides: the destinations are the covered pixels themselves, in
        # the same order, which is what a grid of coordinates was being carried to spell out.
        pixels[covered] = face[
            numpy.clip((v * fh).astype(int), 0, fh - 1),
            numpy.clip((u * fw).astype(int), 0, fw - 1),
        ]
    return Image.fromarray(pixels)
