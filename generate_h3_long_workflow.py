#!/usr/bin/env python3
"""
generate_h3_long_workflow.py

Hybrid dynamic MiniMax H3 long-video workflow generator.

Usage:
  python generate_h3_long_workflow.py --segments segments.json --output long_60s.json
  python generate_h3_long_workflow.py --prompts-file prompts.txt --duration 40 --output test.json
"""

import json
import argparse
import math
from pathlib import Path
from typing import List, Dict, Any, Optional

# ---------------------------------------------------------------------------
# Configuration defaults (edit these or pass via CLI)
# ---------------------------------------------------------------------------
DEFAULTS = {
    "unet_name": "minimax_h3_fl2va_pruned_int8_convrot.safetensors",
    "clip_name": "qwen3vl_32b_heretic_minimax_h3_nvfp4.safetensors",
    "video_vae": "minimax_h3_video_vae_fp16.safetensors",
    "audio_vae": "minimax_h3_audio_vae_fp32.safetensors",
    "start_image": "Krea2_00001_FHD.png",
    "width": 768,
    "height": 1344,
    "steps": 20,
    "sampler_name": "euler",
    "scheduler": "simple",
    "cfg": 1.0,
    "fps": 24,
    "target_segment_seconds": 10.0,
    "filename_prefix": "video/MiniMax_H3_Long",
    "seed_mode": "fixed",
    "base_seed": 144012845932748,
}

# ---------------------------------------------------------------------------
# H3 length helpers (17k + 5 grid at 24 fps)
# ---------------------------------------------------------------------------
def h3_valid_length(seconds: float, fps: int = 24) -> int:
    """Return nearest valid H3 frame count (17k+5) for the requested seconds."""
    raw = max(5, round(seconds * fps))
    k = math.ceil((raw - 5) / 17)
    return 17 * k + 5


def seconds_from_length(length: int, fps: int = 24) -> float:
    return length / fps


# ---------------------------------------------------------------------------
# Node / Link builders
# ---------------------------------------------------------------------------
class WorkflowBuilder:
    def __init__(self):
        self.nodes: List[Dict] = []
        self.links: List[List] = []
        self.next_id = 1
        self.next_link = 1
        self.node_map: Dict[str, int] = {}

    def add_node(self, type_: str, title: str, pos: List[float],
                 widgets_values: List[Any] = None,
                 widgets_values_named: Dict = None,
                 inputs: List[Dict] = None,
                 outputs: List[Dict] = None,
                 properties: Dict = None,
                 size: List[float] = None) -> int:
        nid = self.next_id
        self.next_id += 1

        node = {
            "id": nid,
            "type": type_,
            "pos": pos,
            "size": size or [300, 120],
            "flags": {},
            "order": 0,
            "mode": 0,
            "inputs": inputs or [],
            "outputs": outputs or [],
            "title": title,
            "properties": properties or {
                "cnr_id": "comfy-core",
                "ver": "0.33.0",
                "Node name for S&R": type_,
            },
        }
        if widgets_values is not None:
            node["widgets_values"] = widgets_values
        if widgets_values_named is not None:
            node["widgets_values_named"] = widgets_values_named

        self.nodes.append(node)
        self.node_map[title] = nid
        return nid

    def link(self, from_node: int, from_slot: int, to_node: int, to_slot: int, type_: str = "*"):
        """Create a link and also update the source output.links and target input.link fields.
        This is required for ComfyUI to display connections.
        """
        lid = self.next_link
        self.next_link += 1
        self.links.append([lid, from_node, from_slot, to_node, to_slot, type_])

        # Update source node output
        src = next((n for n in self.nodes if n["id"] == from_node), None)
        if src and from_slot < len(src["outputs"]):
            if src["outputs"][from_slot].get("links") is None:
                src["outputs"][from_slot]["links"] = []
            src["outputs"][from_slot]["links"].append(lid)

        # Update target node input
        dst = next((n for n in self.nodes if n["id"] == to_node), None)
        if dst and to_slot < len(dst["inputs"]):
            dst["inputs"][to_slot]["link"] = lid

        return lid

    def get(self, title: str) -> int:
        return self.node_map[title]


def build_workflow(
    segments: List[Dict[str, Any]],
    config: Dict[str, Any],
) -> Dict[str, Any]:
    b = WorkflowBuilder()
    N = len(segments)
    W = config["width"]
    H = config["height"]
    STEPS = config["steps"]
    FPS = config["fps"]

    # ------------------------------------------------------------------
    # Shared loaders
    # ------------------------------------------------------------------
    unet_id = b.add_node(
        "UNETLoader", "UNET",
        pos=[-2200, 100],
        widgets_values=[config["unet_name"], "default"],
        widgets_values_named={"unet_name": config["unet_name"], "weight_dtype": "default"},
        outputs=[{"name": "MODEL", "type": "MODEL", "links": []}],
    )

    clip_id = b.add_node(
        "CLIPLoader", "CLIP",
        pos=[-2200, 300],
        size=[420, 120],
        widgets_values=[config["clip_name"], "minimax", "default"],
        widgets_values_named={"clip_name": config["clip_name"], "type": "minimax", "device": "default"},
        outputs=[{"name": "CLIP", "type": "CLIP", "links": []}],
    )

    video_vae_id = b.add_node(
        "VAELoader", "Video VAE",
        pos=[-2200, 500],
        widgets_values=[config["video_vae"]],
        widgets_values_named={"vae_name": config["video_vae"]},
        outputs=[{"name": "VAE", "type": "VAE", "links": []}],
    )

    audio_vae_id = b.add_node(
        "VAELoader", "Audio VAE",
        pos=[-2200, 700],
        widgets_values=[config["audio_vae"]],
        widgets_values_named={"vae_name": config["audio_vae"]},
        outputs=[{"name": "VAE", "type": "VAE", "links": []}],
    )

    easy_id = b.add_node(
        "EasyCache", "EasyCache",
        pos=[-1700, -100],
        size=[320, 140],
        widgets_values=[0.3, 0.2, 0.9, False],
        widgets_values_named={
            "reuse_threshold": 0.3,
            "start_percent": 0.2,
            "end_percent": 0.9,
            "verbose": False,
        },
        inputs=[{"name": "model", "type": "MODEL", "link": None}],
        outputs=[{"name": "MODEL", "type": "MODEL", "links": []}],
        properties={"cnr_id": "comfy-core", "ver": "0.30.0", "Node name for S&R": "EasyCache"},
    )
    b.link(unet_id, 0, easy_id, 0, "MODEL")

    sage_id = b.add_node(
        "PathchSageAttentionKJ", "Sage Attention",
        pos=[-1300, -80],
        size=[280, 90],
        widgets_values=["auto", False],
        widgets_values_named={"sage_attention": "auto", "allow_compile": False},
        inputs=[{"name": "model", "type": "MODEL", "link": None}],
        outputs=[{"name": "MODEL", "type": "MODEL", "links": []}],
        properties={"cnr_id": "comfyui-workflow-encrypt", "ver": "1.0.0", "Node name for S&R": "PathchSageAttentionKJ"},
    )
    b.link(easy_id, 0, sage_id, 0, "MODEL")

    start_img_id = b.add_node(
        "LoadImage", "Start Image",
        pos=[-2200, -350],
        size=[300, 320],
        widgets_values=[config["start_image"], "image"],
        widgets_values_named={"image": config["start_image"], "upload": "image"},
        outputs=[
            {"name": "IMAGE", "type": "IMAGE", "links": []},
            {"name": "MASK", "type": "MASK", "links": []},
        ],
    )

    sampler_select_id = b.add_node(
        "KSamplerSelect", "Sampler",
        pos=[-1700, 100],
        widgets_values=[config["sampler_name"]],
        widgets_values_named={"sampler_name": config["sampler_name"]},
        outputs=[{"name": "SAMPLER", "type": "SAMPLER", "links": []}],
    )

    steps_id = b.add_node(
        "PrimitiveInt", "Steps",
        pos=[-1700, -250],
        widgets_values=[STEPS, "fixed"],
        widgets_values_named={"value": STEPS, "fixed": "fixed"},
        outputs=[{"name": "INT", "type": "INT", "links": []}],
        properties={"cnr_id": "comfy-core", "ver": "0.33.0", "Node name for S&R": "PrimitiveInt"},
    )

    # ------------------------------------------------------------------
    # Per-segment columns
    # ------------------------------------------------------------------
    last_frame_ids = []
    segment_video_ids = []
    segment_image_batch_ids = []
    segment_audio_ids = []

    col_width = 750
    base_x = -800

    for i, seg in enumerate(segments):
        x = base_x + i * col_width
        idx = i + 1
        prompt = seg["prompt"]
        approx_s = seg.get("approx_seconds", config["target_segment_seconds"])
        length = h3_valid_length(approx_s, FPS)

        seed = config["base_seed"] + i * 9973
        noise_id = b.add_node(
            "RandomNoise", f"Noise {idx}",
            pos=[x, 200],
            widgets_values=[seed, config["seed_mode"]],
            widgets_values_named={"noise_seed": seed, "control_after_generate": config["seed_mode"]},
            outputs=[{"name": "NOISE", "type": "NOISE", "links": []}],
        )

        if i == 0:
            first_frame_src = start_img_id
            first_frame_slot = 0
        else:
            first_frame_src = last_frame_ids[i-1]
            first_frame_slot = 0

        cond_id = b.add_node(
            "MiniMaxH3ImageToVideo", f"Segment {idx} Conditioning",
            pos=[x, -280],
            size=[400, 420],
            widgets_values=[prompt, W, H, length],
            widgets_values_named={
                "prompt": prompt,
                "width": W,
                "height": H,
                "length": length,
            },
            inputs=[
                {"name": "clip", "type": "CLIP", "link": None},
                {"name": "vae", "type": "VAE", "link": None},
                {"name": "first_frame", "shape": 7, "type": "IMAGE", "link": None},
                {"name": "last_frame", "shape": 7, "type": "IMAGE", "link": None},
                {"name": "width", "type": "INT", "widget": {"name": "width"}, "link": None},
                {"name": "height", "type": "INT", "widget": {"name": "height"}, "link": None},
                {"name": "length", "type": "INT", "widget": {"name": "length"}, "link": None},
            ],
            outputs=[
                {"name": "positive", "type": "CONDITIONING", "links": []},
                {"name": "LATENT", "type": "LATENT", "links": []},
            ],
        )
        b.link(clip_id, 0, cond_id, 0, "CLIP")
        b.link(video_vae_id, 0, cond_id, 1, "VAE")
        b.link(first_frame_src, first_frame_slot, cond_id, 2, "IMAGE")

        guider_id = b.add_node(
            "BasicGuider", f"Guider {idx}",
            pos=[x, 350],
            inputs=[
                {"name": "model", "type": "MODEL", "link": None},
                {"name": "conditioning", "type": "CONDITIONING", "link": None},
            ],
            outputs=[{"name": "GUIDER", "type": "GUIDER", "links": []}],
        )
        b.link(sage_id, 0, guider_id, 0, "MODEL")
        b.link(cond_id, 0, guider_id, 1, "CONDITIONING")

        sched_id = b.add_node(
            "BasicScheduler", f"Scheduler {idx}",
            pos=[x, 500],
            widgets_values=[config["scheduler"], STEPS, 1.0],
            widgets_values_named={"scheduler": config["scheduler"], "steps": STEPS, "denoise": 1.0},
            inputs=[
                {"name": "model", "type": "MODEL", "link": None},
                {"name": "steps", "type": "INT", "widget": {"name": "steps"}, "link": None},
            ],
            outputs=[{"name": "SIGMAS", "type": "SIGMAS", "links": []}],
        )
        b.link(sage_id, 0, sched_id, 0, "MODEL")
        b.link(steps_id, 0, sched_id, 1, "INT")

        sampler_id = b.add_node(
            "SamplerCustomAdvanced", f"Sampler {idx}",
            pos=[x, 650],
            inputs=[
                {"name": "noise", "type": "NOISE", "link": None},
                {"name": "guider", "type": "GUIDER", "link": None},
                {"name": "sampler", "type": "SAMPLER", "link": None},
                {"name": "sigmas", "type": "SIGMAS", "link": None},
                {"name": "latent_image", "type": "LATENT", "link": None},
            ],
            outputs=[
                {"name": "output", "type": "LATENT", "links": []},
                {"name": "denoised_output", "type": "LATENT", "links": []},
            ],
        )
        b.link(noise_id, 0, sampler_id, 0, "NOISE")
        b.link(guider_id, 0, sampler_id, 1, "GUIDER")
        b.link(sampler_select_id, 0, sampler_id, 2, "SAMPLER")
        b.link(sched_id, 0, sampler_id, 3, "SIGMAS")
        b.link(cond_id, 1, sampler_id, 4, "LATENT")

        vdec_id = b.add_node(
            "VAEDecode", f"Video Decode {idx}",
            pos=[x, 850],
            inputs=[
                {"name": "samples", "type": "LATENT", "link": None},
                {"name": "vae", "type": "VAE", "link": None},
            ],
            outputs=[{"name": "IMAGE", "type": "IMAGE", "links": []}],
        )
        b.link(sampler_id, 0, vdec_id, 0, "LATENT")
        b.link(video_vae_id, 0, vdec_id, 1, "VAE")

        adec_id = b.add_node(
            "VAEDecodeAudio", f"Audio Decode {idx}",
            pos=[x, 1000],
            inputs=[
                {"name": "samples", "type": "LATENT", "link": None},
                {"name": "vae", "type": "VAE", "link": None},
            ],
            outputs=[{"name": "AUDIO", "type": "AUDIO", "links": []}],
        )
        b.link(sampler_id, 0, adec_id, 0, "LATENT")
        b.link(audio_vae_id, 0, adec_id, 1, "VAE")

        create_id = b.add_node(
            "CreateVideo", f"Create Video {idx}",
            pos=[x, 1150],
            widgets_values=[FPS, 8],
            widgets_values_named={"fps": FPS, "bit_depth": 8},
            inputs=[
                {"name": "images", "type": "IMAGE", "link": None},
                {"name": "audio", "shape": 7, "type": "AUDIO", "link": None},
            ],
            outputs=[{"name": "VIDEO", "type": "VIDEO", "links": []}],
        )
        b.link(vdec_id, 0, create_id, 0, "IMAGE")
        b.link(adec_id, 0, create_id, 1, "AUDIO")
        segment_video_ids.append(create_id)

        comp_id = b.add_node(
            "GetVideoComponents", f"Segment {idx} Components",
            pos=[x, 1300],
            inputs=[{"name": "video", "type": "VIDEO", "link": None}],
            outputs=[
                {"name": "images", "type": "IMAGE", "links": []},
                {"name": "audio", "type": "AUDIO", "links": []},
                {"name": "fps", "type": "FLOAT", "links": []},
                {"name": "bit_depth", "type": "INT", "links": []},
            ],
        )
        b.link(create_id, 0, comp_id, 0, "VIDEO")

        last_id = b.add_node(
            "ImageFromBatch", f"Segment {idx} Last Frame",
            pos=[x, 1450],
            widgets_values=[-1, 1],
            widgets_values_named={"batch_index": -1, "length": 1},
            inputs=[{"name": "image", "type": "IMAGE", "link": None}],
            outputs=[{"name": "IMAGE", "type": "IMAGE", "links": []}],
        )
        b.link(comp_id, 0, last_id, 0, "IMAGE")
        last_frame_ids.append(last_id)

        if i == 0:
            segment_image_batch_ids.append(comp_id)
        else:
            trim_id = b.add_node(
                "ImageFromBatch", f"Trim Seg {idx} - Remove dup first frame",
                pos=[x, 1600],
                size=[380, 90],
                widgets_values=[1, length - 1],
                widgets_values_named={"batch_index": 1, "length": length - 1},
                inputs=[
                    {"name": "image", "type": "IMAGE", "link": None},
                    {"name": "length", "type": "INT", "widget": {"name": "length"}, "link": None},
                ],
                outputs=[{"name": "IMAGE", "type": "IMAGE", "links": []}],
            )
            b.link(comp_id, 0, trim_id, 0, "IMAGE")
            segment_image_batch_ids.append(trim_id)

        segment_audio_ids.append(comp_id)

        save_seg_id = b.add_node(
            "SaveVideo", f"Save Segment {idx}",
            pos=[x, 1750],
            size=[400, 200],
            widgets_values=[f"{config['filename_prefix']}_seg{idx:02d}", "auto", "auto"],
            widgets_values_named={
                "filename_prefix": f"{config['filename_prefix']}_seg{idx:02d}",
                "format": "auto",
                "codec": "auto",
            },
            inputs=[{"name": "video", "type": "VIDEO", "link": None}],
            outputs=[
                {"name": "video_url", "type": "VIDEO", "links": None},
                {"name": "video", "type": "VIDEO", "links": None},
            ],
            properties={"cnr_id": "comfy-core", "ver": "0.30.1", "Node name for S&R": "SaveVideo"},
        )
        b.link(create_id, 0, save_seg_id, 0, "VIDEO")

    # ------------------------------------------------------------------
    # Final join
    # ------------------------------------------------------------------
    join_x = base_x + N * col_width + 100

    prev_batch = None
    for i in range(N):
        if i == 0:
            prev_batch = segment_image_batch_ids[0]
            continue

        batch_id = b.add_node(
            "ImageBatch", f"Join Video 1..{i+1}",
            pos=[join_x, 400 + (i-1)*80],
            inputs=[
                {"name": "image1", "type": "IMAGE", "link": None},
                {"name": "image2", "type": "IMAGE", "link": None},
            ],
            outputs=[{"name": "IMAGE", "type": "IMAGE", "links": []}],
        )
        if i == 1:
            b.link(segment_image_batch_ids[0], 0, batch_id, 0, "IMAGE")
        else:
            b.link(prev_batch, 0, batch_id, 0, "IMAGE")
        b.link(segment_image_batch_ids[i], 0, batch_id, 1, "IMAGE")
        prev_batch = batch_id

    final_images = prev_batch if N > 1 else segment_image_batch_ids[0]

    prev_audio = None
    for i in range(N):
        if i == 0:
            prev_audio = segment_audio_ids[0]
            continue
        concat_id = b.add_node(
            "AudioConcat", f"Join Audio 1..{i+1}",
            pos=[join_x, 900 + (i-1)*80],
            widgets_values=["after"],
            widgets_values_named={"direction": "after"},
            inputs=[
                {"name": "audio1", "type": "AUDIO", "link": None},
                {"name": "audio2", "type": "AUDIO", "link": None},
            ],
            outputs=[{"name": "AUDIO", "type": "AUDIO", "links": []}],
        )
        if i == 1:
            b.link(segment_audio_ids[0], 1, concat_id, 0, "AUDIO")
        else:
            b.link(prev_audio, 0, concat_id, 0, "AUDIO")
        b.link(segment_audio_ids[i], 1, concat_id, 1, "AUDIO")
        prev_audio = concat_id

    final_audio = prev_audio if N > 1 else segment_audio_ids[0]

    final_create = b.add_node(
        "CreateVideo", "Create Final Long Video",
        pos=[join_x + 400, 700],
        widgets_values=[FPS, 8],
        widgets_values_named={"fps": FPS, "bit_depth": 8},
        inputs=[
            {"name": "images", "type": "IMAGE", "link": None},
            {"name": "audio", "shape": 7, "type": "AUDIO", "link": None},
            {"name": "fps", "type": "FLOAT", "widget": {"name": "fps"}, "link": None},
            {"name": "bit_depth", "shape": 7, "type": "INT", "widget": {"name": "bit_depth"}, "link": None},
        ],
        outputs=[{"name": "VIDEO", "type": "VIDEO", "links": []}],
    )
    b.link(final_images, 0, final_create, 0, "IMAGE")
    b.link(final_audio, 0 if N > 1 else 1, final_create, 1, "AUDIO")
    b.link(segment_audio_ids[0], 2, final_create, 2, "FLOAT")
    b.link(segment_audio_ids[0], 3, final_create, 3, "INT")

    final_save = b.add_node(
        "SaveVideo", "Save Final Long Video",
        pos=[join_x + 400, 900],
        size=[500, 300],
        widgets_values=[config["filename_prefix"], "auto", "auto"],
        widgets_values_named={
            "filename_prefix": config["filename_prefix"],
            "format": "auto",
            "codec": "auto",
        },
        inputs=[{"name": "video", "type": "VIDEO", "link": None}],
        outputs=[
            {"name": "video_url", "type": "VIDEO", "links": None},
            {"name": "video", "type": "VIDEO", "links": None},
        ],
        properties={"cnr_id": "comfy-core", "ver": "0.30.1", "Node name for S&R": "SaveVideo"},
    )
    b.link(final_create, 0, final_save, 0, "VIDEO")

    for i, n in enumerate(b.nodes):
        n["order"] = i

    doc = {
        "id": f"minimax-long-dynamic-{N}x",
        "revision": 0,
        "last_node_id": b.next_id - 1,
        "last_link_id": b.next_link - 1,
        "nodes": b.nodes,
        "links": b.links,
        "groups": [],
        "config": {},
        "extra": {
            "ds": {"scale": 0.6, "offset": [0, 0]},
            "frontendVersion": "1.49.6",
        },
        "version": 0.4,
    }
    return doc


def main():
    parser = argparse.ArgumentParser(description="Generate dynamic MiniMax H3 long-video ComfyUI workflow")
    parser.add_argument("--segments", type=str, help="JSON file from Grok planner")
    parser.add_argument("--prompts-file", type=str, help="Simple text file, one prompt per line")
    parser.add_argument("--duration", type=float, default=30.0, help="Total seconds (used with --prompts-file)")
    parser.add_argument("--output", type=str, default="h3_long_dynamic.json")
    parser.add_argument("--start-image", type=str, default=DEFAULTS["start_image"])
    parser.add_argument("--width", type=int, default=DEFAULTS["width"])
    parser.add_argument("--height", type=int, default=DEFAULTS["height"])
    parser.add_argument("--steps", type=int, default=DEFAULTS["steps"])
    parser.add_argument("--seed", type=int, default=DEFAULTS["base_seed"])
    args = parser.parse_args()

    config = DEFAULTS.copy()
    config["start_image"] = args.start_image
    config["width"] = args.width
    config["height"] = args.height
    config["steps"] = args.steps
    config["base_seed"] = args.seed

    segments = []
    if args.segments:
        with open(args.segments, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "segments" in data:
            segments = data["segments"]
        else:
            segments = data
    elif args.prompts_file:
        with open(args.prompts_file, "r", encoding="utf-8") as f:
            prompts = [line.strip() for line in f if line.strip()]
        n = len(prompts)
        seg_len = args.duration / max(n, 1)
        for i, p in enumerate(prompts):
            segments.append({
                "index": i + 1,
                "approx_seconds": seg_len,
                "prompt": p,
            })
    else:
        print("No --segments or --prompts-file given. Generating 3-segment demo.")
        segments = [
            {"index": 1, "approx_seconds": 10, "prompt": "Demo shot 1 – young woman on flying hoverboard..."},
            {"index": 2, "approx_seconds": 10, "prompt": "Continue seamlessly from the supplied first frame..."},
            {"index": 3, "approx_seconds": 10, "prompt": "Continue seamlessly from the supplied first frame..."},
        ]

    print(f"Building workflow with {len(segments)} segments...")
    doc = build_workflow(segments, config)

    out_path = Path(args.output)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)

    print(f"Wrote {out_path}  (last_node_id={doc['last_node_id']}, links={doc['last_link_id']})")
    print("Load this JSON into ComfyUI.")


if __name__ == "__main__":
    main()