"""Inference-only Make-It-Animatable backend, without Blender or torch-cluster."""

from __future__ import annotations

import json
import resource
import sys
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from ia_studio_engine.adapters.loading import LoadRefusedError
from ia_studio_engine.autorig.support import Joint

JOINT_NAMES = (
    "Hips",
    "Spine",
    "Spine1",
    "Spine2",
    "Neck",
    "Head",
    "LeftShoulder",
    "LeftArm",
    "LeftForeArm",
    "LeftHand",
    "LeftHandThumb1",
    "LeftHandThumb2",
    "LeftHandThumb3",
    "LeftHandIndex1",
    "LeftHandIndex2",
    "LeftHandIndex3",
    "LeftHandMiddle1",
    "LeftHandMiddle2",
    "LeftHandMiddle3",
    "LeftHandRing1",
    "LeftHandRing2",
    "LeftHandRing3",
    "LeftHandPinky1",
    "LeftHandPinky2",
    "LeftHandPinky3",
    "RightShoulder",
    "RightArm",
    "RightForeArm",
    "RightHand",
    "RightHandThumb1",
    "RightHandThumb2",
    "RightHandThumb3",
    "RightHandIndex1",
    "RightHandIndex2",
    "RightHandIndex3",
    "RightHandMiddle1",
    "RightHandMiddle2",
    "RightHandMiddle3",
    "RightHandRing1",
    "RightHandRing2",
    "RightHandRing3",
    "RightHandPinky1",
    "RightHandPinky2",
    "RightHandPinky3",
    "LeftUpLeg",
    "LeftLeg",
    "LeftFoot",
    "LeftToeBase",
    "RightUpLeg",
    "RightLeg",
    "RightFoot",
    "RightToeBase",
)
PARENTS = (
    -1,
    0,
    1,
    2,
    3,
    4,
    3,
    6,
    7,
    8,
    9,
    10,
    11,
    9,
    13,
    14,
    9,
    16,
    17,
    9,
    19,
    20,
    9,
    22,
    23,
    3,
    25,
    26,
    27,
    28,
    29,
    30,
    28,
    32,
    33,
    28,
    35,
    36,
    28,
    38,
    39,
    28,
    41,
    42,
    0,
    44,
    45,
    46,
    0,
    48,
    49,
    50,
)


class KinematicTree:
    def __init__(self) -> None:
        self.nodes = [Joint(index) for index in range(len(PARENTS))]
        for index, parent in enumerate(PARENTS):
            self.nodes[index].parent = None if parent < 0 else self.nodes[parent]
        remaining = set(range(len(PARENTS)))
        self.tree_levels_mask: list[list[bool]] = []
        while remaining:
            level = [
                index
                for index in remaining
                if PARENTS[index] < 0 or PARENTS[index] not in remaining
            ]
            self.tree_levels_mask.append([index in level for index in range(len(PARENTS))])
            remaining.difference_update(level)

    def __iter__(self):
        return iter(self.nodes)

    def __len__(self) -> int:
        return len(self.nodes)


@dataclass
class Models:
    skin: Any
    joints: Any
    coarse: Any
    pose: Any
    tree: KinematicTree
    device: str


def load(folder: str, device: str) -> Models:
    import ia_studio_engine.vendor.make_it_animatable.model as upstream_model

    root = Path(folder)
    required = ("bw.pth", "joints.pth", "joints_coarse.pth", "pose.pth")
    missing = [name for name in required if not (root / name).is_file()]
    if missing:
        raise LoadRefusedError(f"missing model files: {', '.join(missing)}")
    tree = KinematicTree()
    common = {
        "N": 32768,
        "input_normal": False,
        "deterministic": True,
        "hierarchical_ratio": 0.5,
        "output_dim": 52,
    }
    skin, joints, coarse, pose = _load_networks(upstream_model.PCAE, root, device, tree, common)
    return Models(skin, joints, coarse, pose, tree, device)


def _load_networks(pcae, root: Path, device: str, tree: KinematicTree, common: dict):
    skin = pcae(**common).load(str(root / "bw.pth")).to(device).eval()
    joints = (
        pcae(
            **common,
            kinematic_tree=tree,
            predict_bw=False,
            predict_joints=True,
            predict_joints_tail=True,
            joints_attn_causal=True,
        )
        .load(str(root / "joints.pth"))
        .to(device)
        .eval()
    )
    coarse = (
        pcae(
            N=32768,
            input_normal=False,
            deterministic=True,
            output_dim=52,
            predict_bw=False,
            predict_joints=True,
            predict_joints_tail=True,
        )
        .load(str(root / "joints_coarse.pth"))
        .to(device)
        .eval()
    )
    pose = (
        pcae(
            **common,
            kinematic_tree=tree,
            predict_bw=False,
            predict_pose_trans=True,
            pose_mode="ortho6d",
            pose_input_joints=True,
            pose_attn_causal=True,
        )
        .load(str(root / "pose.pth"))
        .to(device)
        .eval()
    )
    return skin, joints, coarse, pose


def _transform(points, matrix):
    import torch

    ones = torch.ones((*points.shape[:-1], 1), dtype=points.dtype)
    return torch.einsum("bij,bnj->bni", matrix, torch.cat((points, ones), dim=-1))[..., :3]


def _normalise(points):
    minimum = points.amin(dim=1, keepdim=True)
    maximum = points.amax(dim=1, keepdim=True)
    center = (minimum + maximum) / 2
    scale = 2 / (maximum - minimum).amax(dim=-1, keepdim=True)
    return (points - center) * scale, center, scale


def _hips_transform(joints):
    import torch
    import torch.nn.functional as functional

    hips, right, left = joints[:, 0, :3], joints[:, 48, :3], joints[:, 44, :3]
    normal = functional.normalize(torch.cross(right - hips, left - hips, dim=-1), dim=-1)
    target = torch.tensor([[0.0, 0.0, 1.0]])
    cross = torch.cross(normal, target, dim=-1)
    dot = torch.sum(normal * target, dim=-1, keepdim=True)
    skew = torch.zeros((1, 3, 3))
    skew[:, 0, 1], skew[:, 0, 2] = -cross[:, 2], cross[:, 1]
    skew[:, 1, 0], skew[:, 1, 2] = cross[:, 2], -cross[:, 0]
    skew[:, 2, 0], skew[:, 2, 1] = -cross[:, 1], cross[:, 0]
    denominator = torch.sum(cross * cross, dim=-1, keepdim=True).clamp_min(1e-8)
    rotation = (
        torch.eye(3).unsqueeze(0) + skew + skew @ skew * ((1 - dot) / denominator).unsqueeze(-1)
    )
    matrix = torch.eye(4).unsqueeze(0)
    matrix[:, :3, :3] = rotation
    matrix[:, :3, 3] = torch.einsum("bij,bj->bi", rotation, -hips)
    tangent = _transform(torch.stack((right, left), dim=1), matrix)
    direction = tangent[:, 1] - tangent[:, 0]
    angle = -torch.atan2(direction[:, 1], direction[:, 0])
    around = torch.eye(4).unsqueeze(0)
    around[:, 0, 0], around[:, 0, 1] = torch.cos(angle), -torch.sin(angle)
    around[:, 1, 0], around[:, 1, 1] = torch.sin(angle), torch.cos(angle)
    return around @ matrix


def _surface(vertices: np.ndarray, triangles: np.ndarray, count: int):
    import torch

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
    return torch.from_numpy(points.astype(np.float32)).unsqueeze(0)


def run(
    models: Models,
    params: dict[str, Any],
    destination: str,
    report: Callable[[int, int, str], None],
    stopping: Callable[[], bool],
) -> dict[str, Any]:
    source = Path(str(params["source"]))
    manifest = json.loads(source.read_text())
    vertices = np.fromfile(source.parent / manifest["positions"], dtype="<f4").reshape(-1, 3)
    triangles = np.fromfile(source.parent / manifest["triangles"], dtype="<u4").reshape(-1, 3)
    if len(vertices) < 3 or len(triangles) < 1 or triangles.max(initial=0) >= len(vertices):
        raise ValueError("INVALID_MESH: invalid geometry")
    arrays = _infer(models, vertices, triangles, report, stopping)
    _write_result(Path(destination), arrays, len(vertices))
    report(6, 6, "write")
    peak = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
    return {"peakRssBytes": peak if sys.platform == "darwin" else peak * 1024}


def _infer(models, vertices, triangles, report, stopping):
    import torch

    report(1, 6, "prepare")
    sampled = _surface(vertices, triangles, 32768)
    points, center, scale = _normalise(sampled)
    if stopping():
        raise InterruptedError("CANCELLED")
    report(2, 6, "analyse")
    with torch.inference_mode():
        coarse = models.coarse(points.to(models.device)).joints.cpu()
        orientation = _hips_transform(coarse)
        all_vertices = torch.from_numpy(vertices.astype(np.float32)).unsqueeze(0)
        transformed = _transform((all_vertices - center) * scale, orientation)
        report(3, 6, "skeleton")
        detailed_points = _surface(transformed[0].numpy(), triangles, 32768)
        second_scale = 1 / detailed_points.abs().amax(dim=1, keepdim=True).amax(
            dim=-1, keepdim=True
        )
        detailed_points *= second_scale
        transformed *= second_scale
        device_points = detailed_points.to(models.device)
        joints = models.joints(device_points).joints.cpu()
        report(4, 6, "pose")
        pose = models.pose(device_points, joints=joints.to(models.device).clone()).pose_trans.cpu()
        if stopping():
            raise InterruptedError("CANCELLED")
        weight_chunks = [
            models.skin(device_points, chunk.to(models.device)).bw.cpu()
            for chunk in torch.split(transformed, 100000, dim=1)
        ]
        weights = torch.cat(weight_chunks, dim=1)
    report(5, 6, "skinning")
    inverse = torch.linalg.inv(orientation)
    heads = _transform(joints[..., :3] / second_scale, inverse) / scale + center
    tails = _transform(joints[..., 3:] / second_scale, inverse) / scale + center
    return {
        "heads": heads[0].numpy().astype("<f4"),
        "tails": tails[0].numpy().astype("<f4"),
        "weights": weights[0].numpy().astype("<f4"),
        "pose": pose[0].numpy().astype("<f4"),
    }


def _write_result(output: Path, arrays: dict[str, np.ndarray], vertices: int) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for name, values in arrays.items():
        values.tofile(output / f"{name}.bin")
    (output / "result.json").write_text(
        json.dumps(
            {
                "backendId": "make-it-animatable",
                "jointNames": JOINT_NAMES,
                "parents": PARENTS,
                "vertices": vertices,
                "files": {name: f"{name}.bin" for name in arrays},
            }
        )
    )
