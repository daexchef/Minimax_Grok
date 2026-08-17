# MiniMax H3 Long Video – Hybrid Dynamic Workflow

This system generates long MiniMax H3 videos by:

1. Using an LLM (Grok recommended) to clean a user prompt and break it into sequential ~10-second shot prompts with strong continuity language.
2. Feeding those segments into a Python generator that builds a complete ComfyUI workflow JSON with the correct number of chained segments.
3. Loading the generated JSON into ComfyUI.

The approach uses last-frame chaining with aggressive continuity prompting. It is a solid, working foundation. True latent/motion-context continuity (H3 Project Suite / Extender nodes) can be added later.

---

## Files

| File | Purpose |
|------|---------|
| `generate_h3_long_workflow.py` | Core generator. Takes a segments list and emits a full ComfyUI workflow JSON with proper node connections. |
| `run_h3_long_from_prompt.py` | Optional helper. Calls the Grok API, saves `segments.json`, then runs the generator. |
| `segments.json` | Example / working planner output (structured list of shot prompts). |

---

## Prerequisites

### ComfyUI
- Recent ComfyUI (0.30+ recommended for native MiniMax H3 support)
- Required custom nodes:
  - **KJNodes** (for `PathchSageAttentionKJ`)
  - Core nodes already include EasyCache, MiniMaxH3ImageToVideo, etc.

### Models (place in the usual ComfyUI folders)
```
models/diffusion_models/
  minimax_h3_fl2va_pruned_int8_convrot.safetensors

models/text_encoders/   (or clip/)
  qwen3vl_32b_heretic_minimax_h3_nvfp4.safetensors

models/vae/
  minimax_h3_video_vae_fp16.safetensors
  minimax_h3_audio_vae_fp32.safetensors
```

### Python
```bash
pip install openai   # only needed for the Grok helper script
```

### Start image
Prepare a starting frame that matches the first segment (same character, clothing, environment, framing). Name it something simple (e.g. `start_frame.png`) and put it in ComfyUI’s input folder.

---

## Quick Start (Manual – recommended first)

### 1. Create or obtain `segments.json`

You can:

- Use the example `segments.json` provided, or
- Ask Grok (or any strong LLM) with the planner system prompt below, or
- Write the segments by hand.

**Planner system prompt** (paste into Grok / Claude / etc.):

```text
You are an expert MiniMax H3 video director and prompt engineer. Your job is to turn a user's rough idea into a production-ready, shot-by-shot plan for continuous long-form video generation.

Input you will receive:
- raw_user_prompt: the user's original idea
- total_duration_seconds: desired total length

Rules:
1. First, clean and enhance the overall concept for cinematic quality, consistency of character/appearance/environment, and native audio.
2. Break the total duration into sequential segments of approximately 10 seconds each (aim for 9–11 s). The final segment may be shorter if needed.
3. For every segment write an explicit, self-contained prompt that:
   - Starts with strong continuity language when it is not the first segment ("Continue seamlessly from the supplied first frame. Preserve the same [character, clothing, environment, lighting and audio continuity]. No reset, no cut, no fade.")
   - Uses the structured style H3 responds well to (integrated_multimodal_description, overall_soundscape, non_diegetic_music, tracking/camera notes).
   - Keeps identity, wardrobe, environment, and camera language consistent across all shots.
   - Describes only what happens in that ~10 s window, advancing the action naturally.
4. Output ONLY valid JSON in this exact schema (no markdown, no commentary):

{
  "enhanced_overall": "one-paragraph cleaned high-level description",
  "total_seconds": 60,
  "segments": [
    {
      "index": 1,
      "approx_seconds": 10,
      "prompt": "full H3-style prompt text for this shot..."
    }
  ]
}

Calculate the number of segments as ceil(total_seconds / 10). Make the action progress logically from one shot to the next.
```

Example call:
```
raw_user_prompt: A skilled middle-aged chef preparing classic French onion soup from start to finish in a professional kitchen
total_duration_seconds: 60
```

Save the pure JSON output as `segments.json`.

### 2. Generate the ComfyUI workflow

```bash
python generate_h3_long_workflow.py \
  --segments segments.json \
  --output minimax_long_60s.json \
  --start-image start_frame.png \
  --width 768 \
  --height 1344 \
  --steps 20
```

Key options:

| Flag | Default | Description |
|------|---------|-------------|
| `--segments` | — | Path to planner JSON |
| `--output` | `h3_long_dynamic.json` | Output workflow filename |
| `--start-image` | `Krea2_00001_FHD.png` | Filename of the first frame (must exist in ComfyUI input) |
| `--width` / `--height` | 768 / 1344 | Resolution (multiple of 32) |
| `--steps` | 20 | Sampling steps |
| `--seed` | fixed base | Base seed (increments per segment) |

### 3. Load into ComfyUI

1. Open ComfyUI.
2. Load the generated `.json` (Drag & drop or Load button).
3. Confirm the Start Image node points to your actual start frame.
4. Queue the prompt.

The workflow will:
- Generate each ~10 s segment sequentially
- Feed the last frame of segment N into the first frame of segment N+1
- Trim the duplicate first frame on later segments
- Concatenate video + audio
- Save individual segments and a final long video

---

## Automated Path (Grok API helper)

If you have an xAI API key:

```bash
export XAI_API_KEY="your-key-here"

python run_h3_long_from_prompt.py \
  --prompt "A skilled middle-aged chef preparing classic French onion soup from start to finish" \
  --duration 60 \
  --start-image start_frame.png \
  --width 768 --height 1344 \
  --output minimax_long_60s.json
```

This will:
1. Call Grok with the planner system prompt
2. Save `segments.json`
3. Immediately generate the ComfyUI workflow JSON

You can also skip the API call and reuse an existing segments file:

```bash
python run_h3_long_from_prompt.py --skip-api --segments-out segments.json --output minimax_long_60s.json
```

---

## Important Notes

### Start image matching
The first segment is conditioned on the start image. For best results the start image should already look like the beginning of the first prompt (same person, clothing, environment, camera angle). A mismatch forces the model to reconcile conflicting signals.

### Continuity quality
The current system uses classic last-frame → first-frame chaining plus strong continuity language in the prompts. This works, but motion and audio can still soft-reset at joins. For significantly better continuity, the next upgrade is to emit nodes from:

- ComfyUI-H3-Project-Suite (latent-mode handoff)
- or ComfyUI_MiniMax_H3_Extender

The generator is structured so that swap is relatively straightforward.

### Frame length
MiniMax H3 snaps duration to the `17k + 5` grid at 24 fps. The generator automatically computes valid lengths (e.g. ~10 s → 243 frames).

### VRAM
Each segment is generated sequentially, so peak VRAM is roughly that of a single ~10–12 s clip. Longer individual segments increase VRAM; more segments increase total time but not peak memory.

### Seeds
By default seeds are fixed and offset per segment (`base + i * 9973`). Change `--seed` or edit the script if you want full randomization.

---

## Configuration Defaults (inside the script)

```python
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
    "fps": 24,
    "target_segment_seconds": 10.0,
    "filename_prefix": "video/MiniMax_H3_Long",
    "seed_mode": "fixed",
    "base_seed": 144012845932748,
}
```

Edit these in `generate_h3_long_workflow.py` if you use different model filenames.

---

## Typical Workflow

1. Write or generate a good `segments.json` (planner prompt above).
2. Make sure your start frame matches the first segment.
3. Run the generator → get a `.json` workflow.
4. Load into ComfyUI, verify the Start Image node, queue.
5. Review individual segment saves if a join looks weak, then re-generate only the problem segment if needed (advanced).

---

## Optional: Browser Version

A fully browser-based version also exists (single HTML file). It supports:

- Optional LLM calls (Grok / OpenAI / Anthropic / Ollama)
- Manual segment editing
- Same workflow generation logic
- No Python required

Ask for the HTML version if you prefer a pure front-end tool.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| No wires visible in ComfyUI | Old generator version | Use the fixed `generate_h3_long_workflow.py` (link fields are now populated) |
| Identity changes between segments | Weak continuity language or mismatched start image | Strengthen the “Continue seamlessly…” prefix and match the start frame |
| OOM | Segment too long / resolution too high | Lower duration per segment or resolution |
| Audio cuts at joins | Expected with last-frame method | Acceptable for now; latent continuity packs improve this |
| Model not found | Filename mismatch | Check the exact filenames in your models folders and update DEFAULTS |

---

## Next Upgrades (optional)

- Swap the conditioning/sampling section to use H3 Project Suite latent context nodes for true motion + audio continuity.
- Add Turbo LoRA support for fewer steps / faster generation.
- Multi-GPU segment parallelization (advanced).

---

Generated for the hybrid dynamic MiniMax H3 pipeline.  
Load the resulting JSON into ComfyUI and queue.
