# MiniMax Grok – Long Video Workflow Toolkit

**Python → Browser → Grok CLI / ComfyUI MCP**

A progressive toolkit for generating long, seamless MiniMax H3 (and LTX-2.5) videos in ComfyUI.

| Stage | What you get |
|-------|--------------|
| 1. Python | Core dynamic workflow generator (`generate_h3_long_workflow.py`) |
| 2. HTML | Zero-install browser frontends that plan segments + emit ready-to-queue ComfyUI JSON |
| 3. Grok CLI + MCP | `skills.zip` – agentic control of local ComfyUI for H3 video |

---

## Quick decision guide

| Goal | Use this |
|------|----------|
| Fastest path (idea → JSON) | Open any of the `*_Generator.html` / `*_Studio.html` files in a browser |
| Multishot memory bank (Joey Gambino style) | `MiniMax_H3_Multishot_Seamless_Workflow_Generator.html` |
| Multi-engine (H3 last-frame / Motion Context / LTX-2.5) | `Long_Video_Workflow_Studio.html` |
| Turn *any* existing ComfyUI workflow into a director UI | `ComfyUI_Template_Frontend_Builder.html` |
| Scripting / automation / CI | `generate_h3_long_workflow.py` |
| Talk to Grok and have it drive ComfyUI | Unzip + install `skills.zip` (see section 3) |

---

## How this compares

Most H3 “long video” tools are **custom nodes**. You load *their* example JSON and the node chains clips at runtime (Joey Multishot, Continuum, ChainDirector, FlowDirector).

This repo is the other half: **idea + duration in a browser (or Python) → a complete ComfyUI JSON** with segment prompts, last-frame (or multishot / motion-context) wiring, and concat already in the graph.

See **[COMPARISON.md](COMPARISON.md)** for the side-by-side matrix vs Continuum, Joey Multishot, ChainDirector, and FlowDirector — including when to use which.

---

## 1. Browser frontends (recommended for most users)

All HTML files are **single-file, zero-install**. Open in Chrome / Edge / Firefox.

### Core long-video generators

| File | Purpose |
|------|---------|
| [`MiniMax_H3_Long_Workflow_Generator.html`](MiniMax_H3_Long_Workflow_Generator.html) | Classic last-frame chaining + local/LLM segment planner + full graph emission |
| [`MiniMax_H3_Multishot_Seamless_Workflow_Generator.html`](MiniMax_H3_Multishot_Seamless_Workflow_Generator.html) | Builds Joey Gambino’s `minimaxH330SecondSeamless_v13` graph (H3MultishotMemorySampler + script slots) |
| [`MiniMax_H3_Local_VRAM_Workflow_Generator.html`](MiniMax_H3_Local_VRAM_Workflow_Generator.html) | Local GPU: probe Comfy VRAM → 0.2–0.4 MP canvas + clip length; step sweep 20/16/12/8 for quality tests |
| [`MiniMax_H3_PRO6000_Cinematic_Workflow_Generator.html`](MiniMax_H3_PRO6000_Cinematic_Workflow_Generator.html) | RunPod RTX PRO 6000 (96 GB): 1344×768, 25 steps, unpruned INT8 |
| [`Long_Video_Workflow_Studio.html`](Long_Video_Workflow_Studio.html) | All-in-one studio: H3 smooth / turbo / Motion Context + LTX-2.5 two-stage, HF model download helpers, research notes |
| [`LTX_2_5_Long_Workflow_Generator.html`](LTX_2_5_Long_Workflow_Generator.html) | Dedicated LTX-2.5 long-chain generator |
| [`ComfyUI_Template_Frontend_Builder.html`](ComfyUI_Template_Frontend_Builder.html) | Meta-tool: drop any ComfyUI workflow JSON → get a tailored HTML director UI with LLM planner |

### Typical browser flow
1. Open the HTML of choice.
2. Enter idea + total duration + target clip length.
3. Generate segments (local continuity-aware or via Grok / OpenAI / Ollama).
4. Choose T2V / I2V, steps, resolution.
5. Download the ready-to-queue `.json`.
6. Drag into ComfyUI → confirm start image (I2V) → Queue.

---

## 2. Python CLI (still fully supported)

```bash
python generate_h3_long_workflow.py \
  --segments segments.json \
  --output minimax_long_60s.json \
  --start-image start_frame.png \
  --width 768 --height 1344 \
  --steps 8
```

See the original planner system prompt in [`PromptGen.md`](PromptGen.md) and example [`segments.json`](segments.json).

The browser tools emit the **exact same node graph** that the Python script produces (shared loaders, EasyCache, PathchSageAttentionKJ, last-frame hand-off, duplicate-frame trim, final ImageBatch + AudioConcat).

---

## 3. Grok CLI + ComfyUI MCP (`skills.zip`)

This is the final stage of the progression.

`skills.zip` packages a **ComfyUI H3 video skill** for Grok CLI (and compatible agent runtimes):

- `skills/comfy-h3-video/SKILL.md` – operating manual
- Bootstrap scripts (PowerShell + bash)
- `.mcp.json` / `plugin.json` – MCP registration
- Slash-style commands for setup and video generation

**Install sketch (Windows / Grok CLI):**
```powershell
# 1. Unzip
Expand-Archive skills.zip -DestinationPath .

# 2. Follow the bootstrap script or drop the skill into your Grok skills directory
# 3. Register the MCP server if required by your Grok CLI / agent host
```

Once loaded, you can ask Grok to plan segments, generate the workflow JSON, or drive a local ComfyUI instance for MiniMax H3 video.

---

## Prerequisites (ComfyUI)

### Required custom nodes
- **KJNodes** (PathchSageAttentionKJ)
- For multishot path: `comfyui-h3-multishot` (+ Spectrum MiniMax H3 recommended)
- Optional but recommended: `ComfyUI-H3-Motion-Context` or `ComfyUI_MiniMax_H3_Extender` for true latent/motion continuity

### Models (place in the usual folders)
```
models/diffusion_models/
  minimax_h3_fl2va_pruned_int8_convrot.safetensors

models/text_encoders/
  qwen3vl_32b_heretic_minimax_h3_nvfp4.safetensors   # or the AWQ / INT4 variants used by multishot graphs

models/vae/
  minimax_h3_video_vae_fp16.safetensors
  minimax_h3_audio_vae_fp32.safetensors
```

Turbo LoRA (optional, 6–8 steps):
```
models/loras/
  minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors
```

### Start image (I2V)
Must already look like the first frame of segment 1 (same character, wardrobe, framing, lighting). Place in ComfyUI `input/`.

---

## Speed & seamless joining notes

| Lever | Typical gain | Notes |
|-------|--------------|-------|
| Turbo LoRA (v4 / EMA) | 3–5× | Drop steps to 6–8 |
| SageAttention / PathchSageAttentionKJ | 1.5–2× | Already wired in generated graphs |
| EasyCache | +10–30 % | Already present |
| Shorter draft res | Large | Iterate 480–640p → final 768×1344 |

**Continuity methods currently supported**
- Last-frame + aggressive continuity language (stock, works everywhere)
- H3 Multishot Memory Sampler (memory + anchor frames)
- H3 Motion Context / Extender (latent tail + audio context) – best seams when the custom nodes are installed

---

## File map

```
generate_h3_long_workflow.py          # Core Python generator
MiniMax_H3_Long_Workflow_Generator.html
MiniMax_H3_Multishot_Seamless_Workflow_Generator.html
MiniMax_H3_Local_VRAM_Workflow_Generator.html
MiniMax_H3_PRO6000_Cinematic_Workflow_Generator.html
Long_Video_Workflow_Studio.html
LTX_2_5_Long_Workflow_Generator.html
ComfyUI_Template_Frontend_Builder.html
COMPARISON.md                         # vs Continuum / Joey / ChainDirector / FlowDirector
PromptGen.md
segments.json
skills.zip                            # Grok CLI / MCP skill package
docs/                                 # UI screenshots
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Identity jump between clips | Weak continuity language or mismatched start frame | Use the local generators (they inject strong “Continue seamlessly…” language) |
| OOM | Segment too long / resolution too high | Shorten target clip or lower resolution |
| Model not found | Filename mismatch | Check exact names in your `models/` folders |
| Multishot subgraph ignores prompts | Script slots not filled | Use the Multishot generator or Template Frontend Builder – they write both outer `{"prompts":[]}` and the internal `---` scripts |

---

## Roadmap ideas

- Deeper automatic integration of Motion Context / Extender nodes
- Multi-GPU segment parallelization
- One-click “install required custom nodes” helper
- Example video gallery + join-quality comparisons
- Publish the skill to a public Grok / Comfy skills marketplace

---

**Start here:** open `Long_Video_Workflow_Studio.html` or `MiniMax_H3_Long_Workflow_Generator.html` in your browser and generate your first long H3 workflow in under a minute.

Questions, improvements, or new engine support? Open an issue or PR.
