"""
Adapters for families diffusers does not open: TripoSR, TRELLIS, TRELLIS.2, TripoSG,
InstantMesh, MMAudio.

The Python is ours (vendored or an extra). Weights stay in the digested folder, with no `.py`.
`torch.load(..., weights_only=True)` is the pickle path — PyTorch 2.6 refuses reducers.
"""

from __future__ import annotations

import sys
import time
from pathlib import Path
from typing import Any

from ia_studio_engine.adapters.diffusers_adapter import (
    DiffusersAdapter,
    LoadedModel,
    LoadRefusedError,
    _device,
    _held_bytes,
    _tensor_bytes,
    generation_refusal,
)
from ia_studio_engine.adapters.plugin_ids import CUDA_ONLY, MMAUDIO_WEIGHTS
from ia_studio_engine.core.jobqueue import CancelledError

_VENDOR = Path(__file__).resolve().parent.parent / "vendor"
if str(_VENDOR) not in sys.path:
    sys.path.insert(0, str(_VENDOR))


def _torch_load(path: Path) -> Any:
    import torch

    payload = torch.load(path, map_location="cpu", weights_only=True)
    if isinstance(payload, dict) and "state_dict" in payload:
        return payload["state_dict"]
    return payload


class PluginAdapter:
    """One family at a time. The door swaps this in when the model id is a plugin id."""

    def __init__(self) -> None:
        self.loaded: LoadedModel | None = None
        self._handle: Any = None
        self._kind: str | None = None

    def backend(self) -> str:
        return "pytorch"

    def device(self) -> str:
        return _device()

    def held_bytes(self) -> int | None:
        return _held_bytes(_device())

    def unload(self) -> None:
        handle = self._handle
        self.loaded = None
        self._handle = None
        self._kind = None
        del handle
        try:
            import gc

            import torch

            gc.collect()
            if torch.backends.mps.is_available():
                torch.mps.empty_cache()
            elif torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            return

    def load(
        self,
        model_id: str,
        folder: str,
        torch_weights: bool = False,
        attachment: dict[str, Any] | None = None,
    ) -> LoadedModel:
        del torch_weights, attachment
        refusal = DiffusersAdapter.refuse_reason(folder)
        if refusal is not None:
            raise LoadRefusedError(refusal)

        device = _device()
        if model_id in CUDA_ONLY and device != "cuda":
            raise LoadRefusedError(f"{model_id} needs CUDA, this machine is {device}")

        self.unload()
        started = time.perf_counter_ns()
        if model_id == "triposr":
            self._handle = _load_triposr(folder, device)
            self._kind = "triposr"
        elif model_id == "trellis-text-large":
            self._handle = _load_trellis(folder, "text")
            self._kind = "trellis-text"
        elif model_id == "trellis-image-large":
            self._handle = _load_trellis(folder, "image")
            self._kind = "trellis-image"
        elif model_id == "trellis2-4b":
            self._handle = _load_trellis2(folder)
            self._kind = "trellis2"
        elif model_id == "triposg":
            self._handle = _load_triposg(folder)
            self._kind = "triposg"
        elif model_id == "instantmesh":
            self._handle = _load_instantmesh(folder)
            self._kind = "instantmesh"
        elif model_id in MMAUDIO_WEIGHTS:
            self._handle = _load_mmaudio(model_id, folder, device)
            self._kind = "mmaudio"
        else:
            raise LoadRefusedError(f"no plugin adapter for {model_id}")

        load_ms = (time.perf_counter_ns() - started) / 1e6
        self.loaded = LoadedModel(
            model_id=model_id,
            device=device,
            pipeline=self._handle,
            bytes_resident=_held_bytes(device),
            tensor_bytes=_tensor_bytes(device),
            load_ms=load_ms,
            takes_step_callback=False,
            default_steps=25,
        )
        return self.loaded

    def generate(
        self,
        params: dict[str, Any],
        destination: str,
        door: str,
        on_step: Any = None,
        stopping: Any = None,
    ) -> dict[str, Any]:
        held = self.loaded
        if held is None or self._handle is None or self._kind is None:
            raise LoadRefusedError("no model is loaded")
        if stopping is not None and stopping():
            raise CancelledError("the generation was cancelled")
        if on_step is not None:
            on_step(1, 1)

        started = time.perf_counter_ns()
        if self._kind == "triposr":
            _run_triposr(self._handle, params, destination, held.device)
        elif self._kind == "trellis-text":
            _run_trellis(self._handle, params, destination, text=True)
        elif self._kind == "trellis-image":
            _run_trellis(self._handle, params, destination, text=False)
        elif self._kind == "trellis2":
            _run_trellis2(self._handle, params, destination)
        elif self._kind == "triposg":
            _run_triposg(self._handle, params, destination, held.device)
        elif self._kind == "instantmesh":
            _run_instantmesh(self._handle, params, destination, held.device)
        else:
            _run_mmaudio(self._handle, params, destination)

        generate_ms = (time.perf_counter_ns() - started) / 1e6
        return {
            "path": destination,
            "door": door,
            "device": held.device,
            "backend": self.backend(),
            "generateMs": round(generate_ms, 1),
            "heldBytes": _held_bytes(held.device),
            "tensorBytes": _tensor_bytes(held.device),
        }


def _require(module: str, extra: str) -> Any:
    try:
        return __import__(module, fromlist=["*"])
    except ImportError as error:
        raise LoadRefusedError(f"{module} is not installed (extra {extra})") from error


def _load_triposr(folder: str, device: str) -> Any:
    tsr_system = _require("tsr.system", "plugin")
    from omegaconf import OmegaConf

    cfg = OmegaConf.load(str(Path(folder) / "config.yaml"))
    model = tsr_system.TSR(cfg)
    model.load_state_dict(_torch_load(Path(folder) / "model.ckpt"))
    model.to(device)
    model.eval()
    return model


def _run_triposr(model: Any, params: dict[str, Any], destination: str, device: str) -> None:
    image = params.get("image")
    if not image:
        raise LoadRefusedError(generation_refusal(params) or "a generation needs a picture")
    from PIL import Image

    picture = Image.open(str(image)).convert("RGB")
    with __import__("torch").no_grad():
        codes = model([picture], device=device)
        meshes = model.extract_mesh(codes, True, resolution=256)
    meshes[0].export(destination)


def _load_trellis(folder: str, kind: str) -> Any:
    pipelines = _require("trellis.pipelines", "plugin")
    import torch

    if not torch.cuda.is_available():
        raise LoadRefusedError("TRELLIS needs CUDA")
    cls = (
        pipelines.TrellisTextTo3DPipeline if kind == "text" else pipelines.TrellisImageTo3DPipeline
    )
    pipeline = cls.from_pretrained(folder)
    pipeline.cuda()
    return pipeline


def _run_trellis(pipeline: Any, params: dict[str, Any], destination: str, text: bool) -> None:
    if text:
        prompt = params.get("prompt")
        if not isinstance(prompt, str) or not prompt:
            raise LoadRefusedError("a generation needs a prompt")
        outputs = pipeline.run(prompt, seed=int(params["seed"]) if params.get("seed") else 1)
    else:
        image = params.get("image")
        if not image:
            raise LoadRefusedError("a generation needs a picture")
        from PIL import Image

        outputs = pipeline.run(
            Image.open(str(image)).convert("RGB"),
            seed=int(params["seed"]) if params.get("seed") else 1,
        )
    gaussians = outputs.get("gaussian") if isinstance(outputs, dict) else None
    if gaussians:
        gaussians[0].save_ply(destination)
        return
    meshes = outputs.get("mesh") if isinstance(outputs, dict) else None
    if meshes:
        meshes[0].export(destination)
        return
    raise LoadRefusedError("TRELLIS returned no mesh")


def _load_trellis2(folder: str) -> Any:
    pipelines = _require("trellis2.pipelines", "plugin")
    import torch

    if not torch.cuda.is_available():
        raise LoadRefusedError("TRELLIS.2 needs CUDA")
    pipeline = pipelines.Trellis2ImageTo3DPipeline.from_pretrained(folder)
    pipeline.cuda()
    return pipeline


def _run_trellis2(pipeline: Any, params: dict[str, Any], destination: str) -> None:
    image = params.get("image")
    if not image:
        raise LoadRefusedError("a generation needs a picture")
    from PIL import Image

    result = pipeline.run(Image.open(str(image)).convert("RGB"))
    mesh = result[0] if isinstance(result, (list, tuple)) else result
    if hasattr(mesh, "export"):
        mesh.export(destination)
        return
    if hasattr(mesh, "save_ply"):
        mesh.save_ply(destination)
        return
    raise LoadRefusedError("TRELLIS.2 returned no mesh")


def _load_triposg(folder: str) -> Any:
    import torch

    if not torch.cuda.is_available():
        raise LoadRefusedError("TripoSG needs CUDA")
    _require("triposg.pipelines.pipeline_triposg", "plugin")
    from triposg.pipelines.pipeline_triposg import TripoSGPipeline

    pipeline = TripoSGPipeline.from_pretrained(folder, local_files_only=True)
    pipeline.to("cuda")
    return pipeline


def _run_triposg(pipeline: Any, params: dict[str, Any], destination: str, device: str) -> None:
    image = params.get("image")
    if not image:
        raise LoadRefusedError("a generation needs a picture")
    import torch
    from PIL import Image

    rembg = _require("rembg", "plugin")
    picture = rembg.remove(Image.open(str(image)).convert("RGB")).convert("RGB")
    seed = int(params["seed"]) if params.get("seed") not in (None, "") else 1
    steps = int(params["steps"]) if params.get("steps") not in (None, "") else 50
    cfg = float(params["cfgScale"]) if params.get("cfgScale") not in (None, "") else 7.0
    outputs = pipeline(
        image=picture,
        generator=torch.Generator(device=device).manual_seed(seed),
        num_inference_steps=steps,
        guidance_scale=cfg,
    ).samples[0]
    trimesh = _require("trimesh", "plugin")
    mesh = trimesh.Trimesh(outputs[0].astype("float32"), outputs[1])
    mesh.export(destination)


# `configs/instant-nerf-large.yaml` of the InstantMesh repository. The checkpoint is loaded with
# strict=True, so a figure that drifts refuses the load rather than opening a wrong model.
INSTANT_NERF_LARGE = {
    "encoder_feat_dim": 768,
    "encoder_freeze": False,
    "transformer_dim": 1024,
    "transformer_layers": 16,
    "transformer_heads": 16,
    "triplane_low_res": 32,
    "triplane_high_res": 64,
    "triplane_dim": 80,
    "rendering_samples_per_ray": 128,
}


def _load_instantmesh(folder: str) -> Any:
    import torch

    if not torch.cuda.is_available():
        raise LoadRefusedError("InstantMesh needs CUDA")
    _require("instantmesh.zero123plus", "plugin")
    from diffusers import EulerAncestralDiscreteScheduler
    from instantmesh.models.lrm import InstantNeRF
    from instantmesh.zero123plus import Zero123PlusPipeline

    root = Path(folder)
    views = Zero123PlusPipeline.from_pretrained(
        folder, local_files_only=True, torch_dtype=torch.float16
    )
    views.scheduler = EulerAncestralDiscreteScheduler.from_config(
        views.scheduler.config, timestep_spacing="trailing"
    )
    views.to("cuda")

    shape = InstantNeRF(encoder_model_name=str(root / "dino"), **INSTANT_NERF_LARGE)
    weights = _torch_load(root / "lrm/instant_nerf_large.ckpt")
    lrm = "lrm_generator."
    shape.load_state_dict(
        {key[len(lrm) :]: value for key, value in weights.items() if key.startswith(lrm)},
        strict=True,
    )
    shape.to("cuda").eval()
    return {"views": views, "shape": shape}


def _run_instantmesh(
    handle: dict[str, Any], params: dict[str, Any], destination: str, device: str
) -> None:
    image = params.get("image")
    if not image:
        raise LoadRefusedError(generation_refusal(params) or "a generation needs a picture")
    import numpy as np
    import torch
    from einops import rearrange
    from instantmesh.camera import get_zero123plus_input_cameras
    from PIL import Image
    from torchvision.transforms import v2

    rembg = _require("rembg", "plugin")
    picture = rembg.remove(Image.open(str(image)).convert("RGB"))
    seed = int(params["seed"]) if params.get("seed") not in (None, "") else 1
    steps = int(params["steps"]) if params.get("steps") not in (None, "") else 75
    cfg = float(params["cfgScale"]) if params.get("cfgScale") not in (None, "") else 4.0

    # One 640x960 sheet of six views, which the reconstruction reads as a batch of six.
    sheet = handle["views"](
        picture,
        num_inference_steps=steps,
        guidance_scale=cfg,
        generator=torch.Generator(device=device).manual_seed(seed),
    ).images[0]
    views = torch.from_numpy(np.asarray(sheet, dtype=np.float32) / 255.0)
    views = rearrange(views.permute(2, 0, 1).contiguous(), "c (n h) (m w) -> (n m) c h w", n=3, m=2)
    views = v2.functional.resize(views.unsqueeze(0).to(device), 320, antialias=True).clamp(0, 1)

    with torch.no_grad():
        planes = handle["shape"].forward_planes(
            views, get_zero123plus_input_cameras(batch_size=1, radius=4.0).to(device)
        )
        vertices, faces, colours = handle["shape"].extract_mesh(planes)

    trimesh = _require("trimesh", "plugin")
    # The repository's own glTF convention, which is the one this studio's viewer reads.
    turned = vertices @ np.array([[-1, 0, 0], [0, 1, 0], [0, 0, -1]])
    trimesh.Trimesh(turned, faces, vertex_colors=colours).export(destination)


def _load_mmaudio(model_id: str, folder: str, device: str) -> Any:
    _require("mmaudio", "plugin")
    from mmaudio.model.flow_matching import FlowMatching
    from mmaudio.model.networks import get_my_mmaudio
    from mmaudio.model.utils.features_utils import FeaturesUtils

    root = Path(folder)
    name = {
        "mmaudio-small-44k": "small_44k",
        "mmaudio-medium-44k": "medium_44k",
        "mmaudio-large-44k": "large_44k",
    }[model_id]
    net = get_my_mmaudio(name).to(device).eval()
    net.load_weights(_torch_load(root / MMAUDIO_WEIGHTS[model_id]))
    features = FeaturesUtils(
        tod_vae_ckpt=str(root / "ext_weights/v1-44.pth"),
        synchformer_ckpt=str(root / "ext_weights/synchformer_state_dict.pth"),
        enable_conditions=True,
        mode="44k",
        bigvgan_vocoder_ckpt=str(root / "ext_weights/best_netG.pt"),
        need_vae_encoder=False,
    )
    features = features.to(device).eval()
    return {
        "net": net,
        "features": features,
        "fm": FlowMatching(min_sigma=0, inference_mode="euler", num_steps=25),
        "device": device,
    }


def _run_mmaudio(handle: dict[str, Any], params: dict[str, Any], destination: str) -> None:
    import torch
    import torchaudio
    from mmaudio.eval_utils import generate, load_video
    from mmaudio.model.sequence_config import CONFIG_44K

    prompt = params.get("prompt") if isinstance(params.get("prompt"), str) else ""
    video = params.get("video")
    clip_frames = sync_frames = None
    duration = float(params["seconds"]) if params.get("seconds") not in (None, "") else 8.0
    if video:
        info = load_video(str(video), duration)
        clip_frames = info.clip_frames.unsqueeze(0)
        sync_frames = info.sync_frames.unsqueeze(0)
        duration = info.duration_sec
    seq = CONFIG_44K
    seq.duration = duration
    handle["net"].update_seq_lengths(seq.latent_seq_len, seq.clip_seq_len, seq.sync_seq_len)
    rng = torch.Generator(device=handle["device"])
    seed = params.get("seed")
    if seed not in (None, ""):
        rng.manual_seed(int(seed))
    audios = generate(
        clip_frames,
        sync_frames,
        [prompt],
        negative_text=[""],
        feature_utils=handle["features"],
        net=handle["net"],
        fm=handle["fm"],
        rng=rng,
        cfg_strength=float(params["cfgScale"]) if params.get("cfgScale") not in (None, "") else 4.5,
    )
    torchaudio.save(destination, audios.float().cpu()[0], seq.sampling_rate)
