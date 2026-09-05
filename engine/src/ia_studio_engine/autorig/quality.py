"""Sampling and skin-weight quality helpers for the Make-It-Animatable backend."""

from __future__ import annotations

import numpy as np

FINGER_PARTS = ("Thumb", "Index", "Middle", "Ring", "Pinky")
WEIGHT_CONFLICT_GROUPS = (
    (
        ("Neck", "Head"),
        ("LeftUpLeg", "LeftLeg", "LeftFoot", "LeftToeBase"),
        ("RightUpLeg", "RightLeg", "RightFoot", "RightToeBase"),
        ("LeftArm", "LeftForeArm", "LeftHand"),
        ("RightArm", "RightForeArm", "RightHand"),
    ),
    (
        (
            "Hips",
            "Spine",
            "Neck",
            "Head",
            "Shoulder",
            "UpLeg",
            "Leg",
            "Foot",
            "ToeBase",
        ),
        ("LeftForeArm", "LeftHand"),
        ("RightForeArm", "RightHand"),
    ),
)


def sample_surface_points(vertices: np.ndarray, triangles: np.ndarray, count: int) -> np.ndarray:
    corner = vertices[triangles]
    areas = np.linalg.norm(
        np.cross(corner[:, 1] - corner[:, 0], corner[:, 2] - corner[:, 0]), axis=1
    )
    if not np.isfinite(areas).all() or areas.sum() <= 0:
        raise ValueError("INVALID_MESH: mesh has no finite triangle surface")
    picked = np.random.default_rng(0).choice(len(triangles), count, p=areas / areas.sum())
    uv = np.random.default_rng(1).random((count, 2), dtype=np.float32)
    reflected = uv.sum(axis=1) > 1
    uv[reflected] = 1 - uv[reflected]
    face = corner[picked]
    points = (
        face[:, 0] + uv[:, :1] * (face[:, 1] - face[:, 0]) + uv[:, 1:] * (face[:, 2] - face[:, 0])
    )
    return points.astype(np.float32)


def focus_surface_on_hands(
    vertices: np.ndarray,
    triangles: np.ndarray,
    count: int,
    centers: np.ndarray,
) -> np.ndarray:
    """Mirror MIA's inference default: half the detailed cloud is sampled around the hands."""
    focus_count = count // 2
    batches = [sample_surface_points(vertices, triangles, count - focus_count)]
    radius = 0.15 * float(vertices.max() - vertices.min())
    corners = vertices[triangles]
    focused = []
    remaining = focus_count
    for index, center in enumerate(centers):
        wanted = remaining if index == len(centers) - 1 else focus_count // len(centers)
        remaining -= wanted
        lower = center - radius
        upper = center + radius
        intersects = np.all(corners.max(axis=1) >= lower, axis=1) & np.all(
            corners.min(axis=1) <= upper, axis=1
        )
        nearby = triangles[intersects]
        if len(nearby) > 0 and wanted > 0:
            focused.append(sample_surface_points(vertices, nearby, wanted))
    batches.extend(focused)
    sampled = np.concatenate(batches, axis=0)
    missing = count - len(sampled)
    if missing:
        sampled = np.concatenate(
            (sampled, sample_surface_points(vertices, triangles, missing)), axis=0
        )
    return sampled[np.newaxis]


def post_process_weights(weights: np.ndarray, names: tuple[str, ...]) -> np.ndarray:
    """Drop mutually exclusive limb/finger influences and retain four normalized weights."""
    cleaned = weights.copy()
    dominant = cleaned.argmax(axis=1)
    for group in WEIGHT_CONFLICT_GROUPS:
        masks = [
            np.array([any(part in name for part in parts) for name in names]) for parts in group
        ]
        for index, own in enumerate(masks):
            rows = np.flatnonzero(own[dominant])
            other = np.logical_or.reduce(
                [mask for other_index, mask in enumerate(masks) if other_index != index]
            )
            cleaned[np.ix_(rows, np.flatnonzero(other))] = 0
    for side in ("Left", "Right"):
        for finger in FINGER_PARTS:
            belongs = np.array([side in name and finger in name for name in names])
            other_fingers = np.array(
                [
                    side in name and any(part in name for part in FINGER_PARTS if part != finger)
                    for name in names
                ]
            )
            rows = np.flatnonzero(belongs[dominant])
            cleaned[np.ix_(rows, np.flatnonzero(other_fingers))] = 0
    if cleaned.shape[1] > 4:
        strongest = np.argpartition(cleaned, -4, axis=1)[:, -4:]
        keep = np.zeros_like(cleaned, dtype=bool)
        np.put_along_axis(keep, strongest, True, axis=1)
        cleaned[~keep] = 0
    total = cleaned.sum(axis=1, keepdims=True)
    return np.divide(cleaned, total, out=np.zeros_like(cleaned), where=total > 0)


def simplify_fingers(names, parents, heads, tails, weights):
    """Remove unstable finger chains and merge their influence into the matching hand."""
    finger = [any(part in name for part in FINGER_PARTS) for name in names]
    merged = weights.copy()
    for side in ("Left", "Right"):
        hand = names.index(f"{side}Hand")
        indices = [
            index
            for index, name in enumerate(names)
            if side in name and any(part in name for part in FINGER_PARTS)
        ]
        merged[:, hand] += merged[:, indices].sum(axis=1)
    kept = [index for index, is_finger in enumerate(finger) if not is_finger]
    remap = {old: new for new, old in enumerate(kept)}
    kept_parents = []
    for old in kept:
        parent = parents[old]
        while parent >= 0 and parent not in remap:
            parent = parents[parent]
        kept_parents.append(-1 if parent < 0 else remap[parent])
    return (
        tuple(names[index] for index in kept),
        tuple(kept_parents),
        heads[kept],
        tails[kept],
        merged[:, kept],
    )
