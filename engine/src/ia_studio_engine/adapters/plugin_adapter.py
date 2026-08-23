"""
Adapters for the families diffusers does not open. `plugin_ids.py` names them.

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
from ia_studio_engine.adapters.modalities import _number
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


def _forget_local_repos() -> None:
    """`_load_craftsman` writes a module global; a folder it names may be gone by the next load."""
    encoders = sys.modules.get("craftsman.models.conditional_encoders.cond_encoder")
    if encoders is not None:
        encoders.LOCAL_CONFIGS = {}


def _knob(params: dict[str, Any], key: str, cast: Any, default: Any) -> Any:
    """A form field the person may have left empty. One spelling is what keeps `0` a seed."""
    value = _number(params, key)
    return default if value is None else cast(value)


def _carve(handle: Any, picture: Any, mode: str) -> Any:
    """One `new_session()` per load, not per generation: it reads and initialises 176 MB."""
    session = handle.get("rembg") if isinstance(handle, dict) else None
    return _require("rembg", "plugin").remove(picture.convert(mode), session=session)


def _picture(params: dict[str, Any]) -> Any:
    image = params.get("image")
    if not image:
        raise LoadRefusedError(generation_refusal(params) or "a generation needs a picture")
    from PIL import Image

    return Image.open(str(image))


class PluginAdapter:
    """One family at a time. The door swaps this in when the model id is a plugin id."""

    def __init__(self) -> None:
        self.loaded: LoadedModel | None = None
        self._handle: Any = None
        self._run: Any = None

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
        self._run = None
        _forget_local_repos()
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
        # The runner travels with the handle: a family named in one chain and forgotten in another
        # used to fall through to MMAudio, which writes a WAV where a mesh was asked for.
        if model_id == "triposr":
            self._handle, self._run = _load_triposr(folder, device), _run_triposr
        elif model_id == "trellis-text-large":
            self._handle, self._run = _load_trellis(folder, "text"), _run_trellis_text
        elif model_id == "trellis-image-large":
            self._handle, self._run = _load_trellis(folder, "image"), _run_trellis_image
        elif model_id == "trellis2-4b":
            self._handle, self._run = _load_trellis2(folder), _run_trellis2
        elif model_id == "triposg":
            self._handle, self._run = _load_triposg(folder), _run_triposg
        elif model_id == "instantmesh":
            self._handle, self._run = _load_instantmesh(folder, device), _run_instantmesh
        elif model_id == "lgm":
            self._handle, self._run = _load_lgm(folder, device), _run_lgm
        elif model_id == "craftsman3d":
            self._handle, self._run = _load_craftsman(folder, device), _run_craftsman
        elif model_id in MMAUDIO_WEIGHTS:
            self._handle, self._run = _load_mmaudio(model_id, folder, device), _run_mmaudio
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
        if held is None or self._run is None:
            raise LoadRefusedError("no model is loaded")
        if stopping is not None and stopping():
            raise CancelledError("the generation was cancelled")
        if on_step is not None:
            on_step(1, 1)

        started = time.perf_counter_ns()
        self._run(self._handle, params, destination, held.device)

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
    picture = _picture(params).convert("RGB")
    with __import__("torch").no_grad():
        codes = model([picture], device=device)
        meshes = model.extract_mesh(codes, True, resolution=256)
    meshes[0].export(destination)


def _load_trellis(folder: str, kind: str) -> Any:
    pipelines = _require("trellis.pipelines", "plugin")
    cls = (
        pipelines.TrellisTextTo3DPipeline if kind == "text" else pipelines.TrellisImageTo3DPipeline
    )
    pipeline = cls.from_pretrained(folder)
    pipeline.cuda()
    return pipeline


def _run_trellis_text(pipeline: Any, params: dict[str, Any], destination: str, device: str) -> None:
    _run_trellis(pipeline, params, destination, text=True)


def _run_trellis_image(
    pipeline: Any, params: dict[str, Any], destination: str, device: str
) -> None:
    _run_trellis(pipeline, params, destination, text=False)


def _run_trellis(pipeline: Any, params: dict[str, Any], destination: str, text: bool) -> None:
    if text:
        prompt = params.get("prompt")
        if not isinstance(prompt, str) or not prompt:
            raise LoadRefusedError("a generation needs a prompt")
        outputs = pipeline.run(prompt, seed=_knob(params, "seed", int, 1))
    else:
        outputs = pipeline.run(
            _picture(params).convert("RGB"),
            seed=_knob(params, "seed", int, 1),
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
    pipeline = pipelines.Trellis2ImageTo3DPipeline.from_pretrained(folder)
    pipeline.cuda()
    return pipeline


def _run_trellis2(pipeline: Any, params: dict[str, Any], destination: str, device: str) -> None:
    result = pipeline.run(_picture(params).convert("RGB"))
    mesh = result[0] if isinstance(result, (list, tuple)) else result
    if hasattr(mesh, "export"):
        mesh.export(destination)
        return
    if hasattr(mesh, "save_ply"):
        mesh.save_ply(destination)
        return
    raise LoadRefusedError("TRELLIS.2 returned no mesh")


def _load_triposg(folder: str) -> Any:
    _require("triposg.pipelines.pipeline_triposg", "plugin")
    from triposg.pipelines.pipeline_triposg import TripoSGPipeline

    pipeline = TripoSGPipeline.from_pretrained(folder, local_files_only=True)
    pipeline.to("cuda")
    return {"pipeline": pipeline, "rembg": _require("rembg", "plugin").new_session()}


def _run_triposg(
    handle: dict[str, Any], params: dict[str, Any], destination: str, device: str
) -> None:
    import torch

    picture = _carve(handle, _picture(params), "RGB").convert("RGB")
    seed = _knob(params, "seed", int, 1)
    steps = _knob(params, "steps", int, 50)
    cfg = _knob(params, "cfgScale", float, 7.0)
    outputs = handle["pipeline"](
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


def _load_instantmesh(folder: str, device: str) -> Any:
    import torch

    _require("instantmesh.zero123plus", "plugin")
    from diffusers import EulerAncestralDiscreteScheduler
    from instantmesh.camera import get_zero123plus_input_cameras
    from instantmesh.models.lrm import InstantNeRF
    from instantmesh.zero123plus import Zero123PlusPipeline

    root = Path(folder)
    views = Zero123PlusPipeline.from_pretrained(
        folder, local_files_only=True, torch_dtype=torch.float16
    )
    views.scheduler = EulerAncestralDiscreteScheduler.from_config(
        views.scheduler.config, timestep_spacing="trailing"
    )
    views.to(device)

    shape = InstantNeRF(encoder_model_name=str(root / "dino"), **INSTANT_NERF_LARGE)
    weights = _torch_load(root / "lrm/instant_nerf_large.ckpt")
    lrm = "lrm_generator."
    shape.load_state_dict(
        {key[len(lrm) :]: value for key, value in weights.items() if key.startswith(lrm)},
        strict=True,
    )
    del weights
    shape.to(device).eval()
    return {
        "views": views,
        "shape": shape,
        "cameras": get_zero123plus_input_cameras(batch_size=1, radius=4.0).to(device),
        "rembg": _require("rembg", "plugin").new_session(),
    }


def _run_instantmesh(
    handle: dict[str, Any], params: dict[str, Any], destination: str, device: str
) -> None:
    import numpy as np
    import torch
    from einops import rearrange
    from instantmesh.framing import resize_foreground
    from torchvision.transforms import v2

    picture = resize_foreground(_carve(handle, _picture(params), "RGBA"), 0.85)
    seed = _knob(params, "seed", int, 1)
    steps = _knob(params, "steps", int, 75)
    cfg = _knob(params, "cfgScale", float, 4.0)

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
        planes = handle["shape"].forward_planes(views, handle["cameras"])
        vertices, faces, colours = handle["shape"].extract_mesh(planes)

    trimesh = _require("trimesh", "plugin")
    # The repository's own glTF convention, which is the one this studio's viewer reads.
    turned = vertices @ np.array([[-1, 0, 0], [0, 1, 0], [0, 0, -1]], dtype=np.float32)
    trimesh.Trimesh(turned, faces, vertex_colors=colours).export(destination)


# What LGM's own inference normalises its four views by, before the splatter reads them.
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_DEVIATION = (0.229, 0.224, 0.225)


def _load_lgm(folder: str, device: str) -> Any:
    import torch

    _require("lgm.models", "plugin")
    from diffusers import AutoencoderKL, DDIMScheduler
    from lgm.models import LGM
    from lgm.mvdream.mv_unet import MultiViewUNetModel
    from lgm.mvdream.pipeline_mvdream import MVDreamPipeline
    from lgm.options import config_defaults
    from safetensors.torch import load_file
    from transformers import (
        CLIPImageProcessor,
        CLIPTextModel,
        CLIPTokenizer,
        CLIPVisionModel,
    )

    root = Path(folder)
    # Component by component rather than through `from_pretrained`: the published pipeline names
    # its unet class in a `.py` beside the weights, which this studio never downloads.
    unet = MultiViewUNetModel.from_config(MultiViewUNetModel.load_config(str(root / "unet")))
    unet.load_state_dict(load_file(str(root / "unet/diffusion_pytorch_model.safetensors")))
    views = MVDreamPipeline(
        vae=AutoencoderKL.from_pretrained(str(root / "vae"), local_files_only=True),
        unet=unet,
        tokenizer=CLIPTokenizer.from_pretrained(str(root / "tokenizer"), local_files_only=True),
        text_encoder=CLIPTextModel.from_pretrained(
            str(root / "text_encoder"), local_files_only=True
        ),
        scheduler=DDIMScheduler.from_pretrained(str(root / "scheduler"), local_files_only=True),
        feature_extractor=CLIPImageProcessor.from_pretrained(
            str(root / "feature_extractor"), local_files_only=True
        ),
        image_encoder=CLIPVisionModel.from_pretrained(
            str(root / "image_encoder"), local_files_only=True
        ),
    )
    views.to(device, dtype=torch.float16)

    options = config_defaults["big"]
    splatter = LGM(options)
    splatter.load_state_dict(
        load_file(str(root / "lgm/model_fp16_fixrot.safetensors")), strict=False
    )
    splatter = splatter.half().to(device).eval()
    return {
        "views": views,
        "splatter": splatter,
        "rays": splatter.prepare_default_rays(device),
        "rembg": _require("rembg", "plugin").new_session(),
    }


def _run_lgm(handle: dict[str, Any], params: dict[str, Any], destination: str, device: str) -> None:
    import numpy as np
    import torch
    import torch.nn.functional as functional
    import torchvision.transforms.functional as pictures
    from kiui.op import recenter

    carved = np.asarray(_carve(handle, _picture(params), "RGBA"))
    carved = recenter(carved, carved[..., -1] > 0, border_ratio=0.2).astype(np.float32) / 255.0
    flat = carved[..., :3] * carved[..., 3:4] + (1 - carved[..., 3:4])

    cfg = _knob(params, "cfgScale", float, 5.0)
    steps = _knob(params, "steps", int, 30)
    quartet = handle["views"]("", flat, guidance_scale=cfg, num_inference_steps=steps, elevation=0)
    # The pipeline answers front, right, back, left; the splatter reads them in view order.
    ordered = np.stack([quartet[1], quartet[2], quartet[3], quartet[0]], axis=0)

    seen = torch.from_numpy(ordered).permute(0, 3, 1, 2).float().to(device)
    seen = functional.interpolate(seen, size=(256, 256), mode="bilinear", align_corners=False)
    seen = pictures.normalize(seen, IMAGENET_MEAN, IMAGENET_DEVIATION)
    seen = torch.cat([seen, handle["rays"]], dim=1).unsqueeze(0)

    with torch.no_grad(), torch.autocast(device_type=device, dtype=torch.float16):
        gaussians = handle["splatter"].forward_gaussians(seen)
    # Gaussians, not triangles: the rasterizer that would mesh them is non-commercial, and absent.
    handle["splatter"].gs.save_ply(gaussians, destination)


def _load_craftsman(folder: str, device: str) -> Any:
    import torch

    _require("craftsman", "plugin")
    from craftsman.models.conditional_encoders import cond_encoder
    from craftsman.pipeline import CraftsManPipeline

    root = Path(folder)
    # The encoder names two repositories to read a config shape from; the manifest fetched both,
    # and the checkpoint carries every tensor they would otherwise have pulled.
    cond_encoder.LOCAL_CONFIGS = {
        "openai/clip-vit-large-patch14": str(root / "clip"),
        "facebook/dinov2-base": str(root / "dinov2"),
    }
    return CraftsManPipeline.from_pretrained(folder, device=device, torch_dtype=torch.float32)


def _run_craftsman(pipeline: Any, params: dict[str, Any], destination: str, device: str) -> None:
    picture = _picture(params)
    steps = _knob(params, "steps", int, 50)
    cfg = _knob(params, "cfgScale", float, 7.5)
    seed = _knob(params, "seed", int, None)
    meshes = pipeline(picture, num_inference_steps=steps, guidance_scale=cfg, seed=seed).meshes
    if not meshes:
        raise LoadRefusedError("CraftsMan3D returned no mesh")
    meshes[0].export(destination)


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
    }


def _run_mmaudio(
    handle: dict[str, Any], params: dict[str, Any], destination: str, device: str
) -> None:
    import torch
    import torchaudio
    from mmaudio.eval_utils import generate, load_video
    from mmaudio.model.sequence_config import CONFIG_44K

    prompt = params.get("prompt") if isinstance(params.get("prompt"), str) else ""
    video = params.get("video")
    clip_frames = sync_frames = None
    duration = _knob(params, "seconds", float, 8.0)
    if video:
        info = load_video(str(video), duration)
        clip_frames = info.clip_frames.unsqueeze(0)
        sync_frames = info.sync_frames.unsqueeze(0)
        duration = info.duration_sec
    seq = CONFIG_44K
    seq.duration = duration
    handle["net"].update_seq_lengths(seq.latent_seq_len, seq.clip_seq_len, seq.sync_seq_len)
    rng = torch.Generator(device=device)
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
        cfg_strength=_knob(params, "cfgScale", float, 4.5),
    )
    torchaudio.save(destination, audios.float().cpu()[0], seq.sampling_rate)
