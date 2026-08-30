# How MiniMax Grok compares to other long-form H3 tools

H3 generates about **5–15 seconds per pass**. Anything longer is a chain. The tools below all attack that limit. They are **not** the same product.

**One-line version:** those four tools *run* a long H3 video *inside Comfy*. This repo *writes the graph* (and a zero-install director UI) so you can queue it yourself.

Most H3 “long video” tools are **custom nodes**. You load *their* example JSON and the node chains clips at runtime (Joey Multishot, Continuum, ChainDirector, FlowDirector).

This repo is the other half: **idea + duration in a browser (or Python) → a complete ComfyUI JSON** with segment prompts, last-frame (or multishot / motion-context) wiring, and concat already in the graph. Open an HTML file, download JSON, drag onto the canvas, Queue.

Use the node packs when you want resume, a timeline UI, or the tightest latent joins. Use this repo when you want the graph itself.

## Feature matrix

| | **This repo (Minimax_Grok)** | **Joey Gambino Multishot** | **H3 Continuum v3.7** | **ChainDirector** | **FlowDirector** |
|---|---|---|---|---|---|
| **Product shape** | Browser HTML + Python **emit a complete ComfyUI JSON**. Optional Grok/MCP skill. | Custom nodes + frozen example JSONs (`AIO`, `MEMORY`, `Keyframes`) | Custom node + Standard/Turbo sample workflows | One custom node + example API JSON | Custom node + timeline example JSON |
| **What you download** | A **new graph** built for *this* idea, duration, engine, and continuity mode | Their nodes + one of their templates; you edit on the canvas | Their node; you fill prompts/refs on the node | Their node; you set duration/split | Their node; you lay out a timeline |
| **Spits out complete JSON from an idea?** | **Yes** (HTML or `generate_h3_long_workflow.py`) | No | No | No | No |
| **Runs the GPU job for you?** | No — you drag JSON into Comfy and Queue | Yes, inside Comfy | Yes, inside Comfy | Yes, inside Comfy | Yes, inside Comfy |
| **Zero-install frontend** | Yes — open the `.html` in a browser | No | No | No | No |
| **Works on any existing workflow** | Yes — `ComfyUI_Template_Frontend_Builder.html` | No | No | No | No |
| **LTX-2.5 long chain** | Yes (`LTX_2_5_Long_Workflow_Generator.html` + Studio) | No | No | No | No |
| **Agent / CLI** | `skills.zip` for Grok CLI + Comfy MCP | No | No | No | No |
| **Primary continuity** | Last-frame + continuity language (always). Optional Multishot Memory and Motion Context / Extender if those nodes are installed | `first_frame` (last frame → next I2V) or `context_pin` (last **22 latent frames**, no VAE round-trip) | **Video + audio latent** handoff per chunk; overlap trimmed on assemble | Shot 1 = **R2V** (up to 9 refs); later shots = **I2V** locked to previous last frame; then `torch.cat` + audio concat | Decoded **last frame → next first frame**; optional target stills; constant VRAM blocks |
| **Typical chunk** | You choose (HTML planner aims ~9–11 s) | Per-shot length on the sampler | 5–15 s recommended (4–30 s allowed) | 5 / 10 / 15 s presets; total duration must divide evenly | 5–10 s per flow; chain to minutes |
| **Prompt model** | Planner writes **per-segment self-contained prompts** with “Continue seamlessly…” language | Script slots / quoted shot list inside the multishot node | Fixed **or** `---` list **or** `[0-5s]` timeline; auto-detect | Prompts on the director node (CN/EN UI) | Per-flow prompts on the timeline |
| **Audio** | Native H3 A/V graph + AudioConcat across segments | Picture + audio in one take; per-subject voice refs on recent versions | Native A/V latent continuation; optional ref / driving audio | Segments padded/looped and aligned; `shift_audio` ~3.0 | Timeline waveforms, trim, stereo mix, native decode |
| **Resume / re-roll one shot** | Re-generate JSON and re-queue (no run cache) | Re-queue the graph; MEMORY path is the long-identity tool | **Yes** — disk-backed chunk store, auto-resume, partial regen from chunk N | Re-run the node | Re-run flows; designed not to OOM |
| **Turbo LoRA** | Wired into generated graphs (6–8 step path) | Supported in their Turbo/AIO variants | Official Turbo sample (8-step, Spectrum off) | Example graph uses LightX2V turbo ~4 step @ 0.75 | Ultra Turbo example workflow |
| **VRAM story** | Whatever the emitted graph needs; Studio documents 12GB-class settings | MEMORY/`context_pin` is heavier; `first_frame` is the light path | 0.4 MP mode; tested ~16 GB; long 2× hi-res is heavy | Split so 8 GB class can run | **Constant** VRAM vs length |
| **Seam quality (honest)** | Strong continuity *language* + last-frame. Best seams only if you install Multishot / Motion Context nodes | **Tightest join** when `context_pin` + Motion Context are installed | Latent continuation is strong; flicker still possible on big lighting/prompt jumps | Last-frame lock; first shot can use refs the later shots cannot fully re-cite | Last-frame + optional target still; decoded-frame path (VAE round-trip) |
| **Install surface** | None for HTML. Python 3 for CLI. Comfy + H3 models + optional custom nodes to *run* the JSON | `ComfyUI-H3-Multishot` (+ Motion Context for `context_pin`) | Continuum node pack + sample-graph extras (rgthree, Easy-Use, KJNodes, optional Spectrum/RTX) | ChainDirector custom node | FlowDirector custom node |
| **Where to get it** | This repo | [Civitai 2833322](https://civitai.com/models/2833322) | [Civitai 2860061](https://civitai.com/models/2860061) | [luxu1999/ComfyUI-MiniMaxH3-ChainDirector](https://github.com/luxu1999/ComfyUI-MiniMaxH3-ChainDirector) | [AlonAshken/ComfyUI-MiniMaxH3-FlowDirector](https://github.com/AlonAshken/ComfyUI-MiniMaxH3-FlowDirector) |

## Use this when

| Goal | Use |
|---|---|
| Idea → duration → **download a queue-ready JSON** without building a graph | **This repo** (any `*_Generator.html` / `*_Studio.html`) |
| Tightest H3 joins, voice that survives the chain, you already live in Comfy | **Joey Multishot** (`context_pin` if you have Motion Context; `first_frame` if you do not) |
| Long run with **resume**, re-roll chunk 4, timeline prompts, latent A/V continuity | **Continuum** |
| One node: first shot R2V with refs, the rest I2V last-frame, auto stitch | **ChainDirector** |
| Visual timeline, minutes-long, **VRAM stays flat**, last-frame blocks | **FlowDirector** |
| Same director UX on a workflow that is *not* H3 | **This repo** → `ComfyUI_Template_Frontend_Builder.html` |
| LTX-2.5 two-stage / long chain JSON | **This repo** (the others are H3-only) |
| An agent should plan segments and emit/drive the graph | **This repo** → `skills.zip` |

## What this repo does *not* replace

- It does not sample video. No GPU work happens in the HTML.
- It does not keep a Continuum-style chunk cache. If shot 3 fails, you fix the JSON and queue again.
- It cannot beat Joey’s `context_pin` join **unless** the emitted graph actually includes those nodes and you have them installed.
- Official Comfy templates and [minimax3.org](https://minimax3.org/minimax-h3-workflow) still win for a single 5–15 s T2V/I2V/R2V clip. Do not use a long-form generator for that.

## Suggested stack (they compose)

A common production path:

1. **This repo** — plan shots and emit JSON (or wrap Joey’s graph in the Multishot HTML).
2. **Joey nodes** — if the JSON targets `H3MultishotMemorySampler`.
3. **Continuum / Extender / FlowDirector** — if you would rather keep one small graph and let a node own the loop, skip the emitter and use their sample JSON instead.

Those are complementary, not competitors, once you separate “who writes the graph” from “who runs the chain.”
