"""Model ids the plugin adapter opens. A name not in this set is a diffusers pipeline."""

PLUGIN_IDS: frozenset[str] = frozenset(
    {
        "triposr",
        "trellis-text-large",
        "trellis-image-large",
        "trellis2-4b",
        "triposg",
        "instantmesh",
        "lgm",
        "craftsman3d",
        "mmaudio-small-44k",
        "mmaudio-medium-44k",
        "mmaudio-large-44k",
    }
)

CUDA_ONLY: frozenset[str] = frozenset(
    {
        "trellis-text-large",
        "trellis-image-large",
        "trellis2-4b",
        "triposg",
        "instantmesh",
        "lgm",
        "craftsman3d",
    }
)

MMAUDIO_WEIGHTS = {
    "mmaudio-small-44k": "weights/mmaudio_small_44k.pth",
    "mmaudio-medium-44k": "weights/mmaudio_medium_44k.pth",
    "mmaudio-large-44k": "weights/mmaudio_large_44k.pth",
}


def is_plugin_model(model_id: str) -> bool:
    return model_id in PLUGIN_IDS
