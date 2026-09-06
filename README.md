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

## Official H3 planner grammar (QA)

Planner output now includes a **cast bible** plus official MiniMax H3 field order inside each `segment.prompt`:

`subject_definitions` → `summary` → `retention_analysis` → `action` → `overall_soundscape` → `non_diegetic_music` → `tracking/camera notes`

Subjects stay locked with `<Subject N>`. Spoken lines (only if needed) use:

`<Subject N> (SN) [emotion] says: <d>[Language] "..."</d>`

The ComfyUI graph builder is unchanged. It still reads `segments[].prompt` and `approx_seconds`.

See [`PLANNER_SCHEMA.md`](PLANNER_SCHEMA.md) and [`PromptGen.md`](PromptGen.md).

---

## 1. Browser frontends (recommended for most users)

All HTML files are **single-file, zero-install**. Open in Chrome / Edge / Firefox.

### Core long-video generators

| File | Purpose |
|------|---------|
| [`MiniMax_H3_Long_Workflow_Generator.html`](MiniMax_H3_Long_Workflow_Generator.html) | Classic last-frame chaining + official H3 planner grammar + full graph emission |
| [`MiniMax_H3_Multishot_Seamless_Workflow_Generator.html`](MiniMax_H3_Multishot_Seamless_Workflow_Generator.html) | Builds Joey Gambino’s `minimaxH330SecondSeamless_v13` graph (H3MultishotMemorySampler + script slots) |
| [`MiniMax_H3_Local_VRAM_Workflow_Generator.html`](MiniMax_H3_Local_VRAM_Workflow_Generator.html) | Local GPU: probe Comfy VRAM → 0.2–0.4 MP canvas + clip length; step sweep 20/16/12/8 for quality tests |
| [`MiniMax_H3_PRO6000_Cinematic_Workflow_Generator.html`](MiniMax_H3_PRO6000_Cinematic_Workflow_Generator.html) | RunPod RTX PRO 6000 (96 GB): 1344×768, 25 steps, unpruned INT8 |
| [`Long_Video_Workflow_Studio.html`](Long_Video_Workflow_Studio.html) | All-in-one studio: H3 smooth / turbo / **SLA turbo** / Motion Context + LTX-2.5 two-stage, HF model download helpers, research notes |
| [`LTX_2_5_Long_Workflow_Generator.html`](LTX_2_5_Long_Workflow_Generator.html) | Dedicated LTX-2.5 long-chain generator |
| [`ComfyUI_Template_Frontend_Builder.html`](ComfyUI_Template_Frontend_Builder.html) | Meta-tool: drop any ComfyUI workflow JSON → get a tailored HTML director UI with LLM planner |

### Typical browser flow
1. Open the HTML of choice.
2. Enter idea + total duration + target clip length.
3. Generate segments (local official-H3 grammar or via Grok / OpenAI / Ollama).
4. Choose T2V / I2V, steps, resolution. For the LightX2V SLA draft path, pick **SLA turbo** (Studio engine or Speed path). Leave the Sage / EasyCache path selected for previous behavior.
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

# Alternate SLA turbo path (no EasyCache / PathchSage):
python generate_h3_long_workflow.py \
  --segments segments.json \
  --sla \
  --output minimax_long_60s_sla.json
```

See the planner system prompt in [`PromptGen.md`](PromptGen.md), the JSON contract in [`PLANNER_SCHEMA.md`](PLANNER_SCHEMA.md), and example [`segments.json`](segments.json).

The browser tools emit the **same last-frame join graph** as the Python script (shared loaders, last-frame hand-off, duplicate-frame trim, final ImageBatch + AudioConcat). The default speed stack is EasyCache → PathchSageAttentionKJ. **SLA turbo** is an alternate MODEL line (UNET → SLA LoRA → H3SLAAttention) and is not stacked with Sage Pathch, EasyCache, or PDD Acc.

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
- **KJNodes** (PathchSageAttentionKJ) — default Sage speed path
- For **SLA turbo**: [ComfyUI-PlagueKind-Nodes](https://github.com/PlagueKind/ComfyUI-PlagueKind-Nodes) (`ComfyUI-H3-SLA-Attention` folder). Node class `H3SLAAttention` / display **H3 SLA Attention**.
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

Turbo LoRA (optional, 6–8 steps, Sage path):
```
models/loras/
  minimax_h3_fl2v_turbo_8step_v1.0_comfyui_bf16.safetensors
```

SLA turbo LoRA (optional, 4–6 steps, SLA path only — [LightX2V MiniMax-H3 Turbo-SLA](https://huggingface.co/lightx2v/Minimax-h3-Turbo-SLA)):
```
models/loras/
  minimax_h3_fl2v_turbo_4step_v0.1_768p_sla_comfyui_bf16.safetensors
```

### Start image (I2V)
Must already look like the first frame of segment 1 (same character, wardrobe, framing, lighting). Place in ComfyUI `input/`.

---

## Speed & seamless joining notes

| Lever | Typical gain | Notes |
|-------|--------------|-------|
| Turbo LoRA (v4 / EMA) | 3–5× | Drop steps to 6–8 on the Sage path |
| SageAttention / PathchSageAttentionKJ | 1.5–2× | Default emitted graphs (off when SLA is on) |
| EasyCache | +10–30 % | Default emitted graphs (off when SLA is on) |
| **SLA turbo** (alternate) | LightX2V reports ~2.5× on RTX 5090 in their LightX2V setup; PlagueKind measured 1.4–1.75× e2e on a 5090 at 768p/15s | UNET → SLA 4-step LoRA → H3SLAAttention. **Not stacked** with Sage Pathch, EasyCache, or PDD Acc. Defaults: 6 steps (4 matches distill; 6 is better for speech), sparsity 0.85, `block_size` 64, `protect_audio` on, `dense_backend` `comfy_kitchen`. |
| Shorter draft res | Large | Iterate 480–640p → final 768×1344 |

**How to enable SLA turbo**
- Studio: Engine → **MiniMax H3 · SLA turbo**
- Long / Local VRAM / Multishot / PRO 6000 generators: Speed path → **SLA turbo**
- Python: `--sla` (optional `--sla-sparsity`, `--sla-block-size`, `--sla-lora`)

The LoRA only teaches the model to tolerate sparse attention. Without the PlagueKind `H3SLAAttention` node, the SLA LoRA does not speed anything up.

Joey / Multishot / Local VRAM / PRO 6000 templates keep Spectrum after the attention node (it already sat after Sage). SLA replaces PathchSage on that wire; it does not add or remove Spectrum.

**Continuity methods currently supported**
- Last-frame + official H3 grammar / cast bible (stock, works everywhere)
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
PLANNER_SCHEMA.md                     # Official H3 planner JSON contract
PromptGen.md
segments.json
skills.zip                            # Grok CLI / MCP skill package
docs/                                 # UI screenshots
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Identity jump between clips | Weak continuity language or mismatched start frame | Use the local generators (they inject official H3 fields + Continue seamlessly…) |
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
