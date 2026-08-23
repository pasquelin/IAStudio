"""Turn a front view into the 2048x1024 canvas and mask a FluxFill panorama expects."""

from __future__ import annotations

from typing import Any


def view_to_panorama(image: Any) -> tuple[Any, Any]:
    from PIL import Image

    side = min(image.size)
    left = (image.size[0] - side) // 2
    top = (image.size[1] - side) // 2
    front = image.crop((left, top, left + side, top + side)).resize((512, 512))
    white = Image.new("RGB", (512, 512), (255, 255, 255))
    black = Image.new("RGB", (512, 512), (0, 0, 0))
    panorama = _cubemap_to_equirect(
        {
            "front": front,
            "back": white,
            "left": white,
            "right": white,
            "top": white,
            "bottom": white,
        },
        2048,
        1024,
        2,
    )
    mask = _cubemap_to_equirect(
        {
            "front": black,
            "back": white,
            "left": white,
            "right": white,
            "top": white,
            "bottom": white,
        },
        2048,
        1024,
        1,
    ).convert("L")
    return panorama, mask


def _cubemap_to_equirect(faces: dict[str, Any], width: int, height: int, scale: int) -> Any:
    import numpy
    from PIL import Image

    out_w, out_h = width * scale, height * scale
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
    xs, ys, zs = (stacked[i].reshape(out_h, out_w) for i in range(3))
    abs_x, abs_y, abs_z = numpy.abs(xs), numpy.abs(ys), numpy.abs(zs)
    face_index = numpy.argmax(numpy.stack([abs_x, abs_y, abs_z], axis=-1), axis=-1)
    pixels = numpy.zeros((out_h, out_w, 3), dtype=numpy.uint8)
    samples = {
        "right": ((face_index == 0) & (xs > 0), -zs, abs_x, ys, abs_x),
        "left": ((face_index == 0) & (xs < 0), zs, abs_x, ys, abs_x),
        "bottom": ((face_index == 1) & (ys > 0), xs, abs_y, -zs, abs_y),
        "top": ((face_index == 1) & (ys < 0), xs, abs_y, zs, abs_y),
        "front": ((face_index == 2) & (zs > 0), xs, abs_z, ys, abs_z),
        "back": ((face_index == 2) & (zs < 0), -xs, abs_z, ys, abs_z),
    }
    for name, (mask, u_num, u_den, v_num, v_den) in samples.items():
        face = numpy.array(faces[name])
        u = (u_num[mask] / u_den[mask] + 1) / 2
        v = (v_num[mask] / v_den[mask] + 1) / 2
        fh, fw = face.shape[:2]
        pixels[yv[mask].astype(int), xv[mask].astype(int)] = face[
            numpy.clip((v * fh).astype(int), 0, fh - 1),
            numpy.clip((u * fw).astype(int), 0, fw - 1),
        ]
    image = Image.fromarray(pixels)
    return image.resize((width, height), Image.LANCZOS) if scale > 1 else image
