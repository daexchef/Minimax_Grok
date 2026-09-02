# Master Bot Briefing — MiniMax H3 on RTX PRO 6000

**From:** Grok chat with Adam B (@DaExChef), 2026-09-01
**Audience:** Master Grok Bot / any H3 video agent using this repo
**Status:** Standing orders until superseded
**Hardware assumed:** 1× NVIDIA RTX PRO 6000 Blackwell, 96 GB GDDR7

Treat this file as current operating doctrine for 30-second MiniMax H3 work. Do not invent a native 30 s single-pass H3 sample. Do not default hero settings for draft loops.

---

## 1. Job to be done

Produce usable 30-second H3 video (picture + native audio) on a single PRO 6000 with predictable time and quality.

H3 native window is ~5–15 s (frame grid 17k+5 at 24 fps, ~362 frame cap). Thirty seconds is a **chain**, not a longer sampler.

---

## 2. Timing reality (PRO 6000, community ComfyUI / MiniMax H3)

These are order-of-magnitude ranges, not SLAs. Resolution, steps, turbo, attention, cache, and refs dominate more than raw TFLOPS.

### Low res (~480p / ~0.4 MP, e.g. 864×480)

| Duration | Typical wall time |
|---|---|
| ~5 s | 23–40 s (turbo 6-step ~23 s; Sage 20-step ~40 s) |
| 10 s | ~68–106 s (68 s cold 480p reported; Sage+EasyCache ~71 s) |
| 15 s | ~3 min (video refs can jump toward ~8 min) |

### ~1 MP native (e.g. 1344×768 / 1696×736, 20 steps, no turbo)

| Duration | Reported |
|---|---|
| 2–5 s | ~3 min 5 s |
| 10 s | ~9 min |
| 15 s | ~12 min 45 s |

### 15 s at ~1 MP with optimizations

| Stack | Time |
|---|---|
| Stock | 23–30 min |
| Sage only | 15–17 min |
| Sage + Sol-Attn | ~10 min |
| Sage + Sol-Attn + fused modulation + latent upscale | ~4 min 16 s |

### 30 s planning

- 480p stitched: often **3–8+ min** if each 10 s piece is 70–120 s.
- ~1 MP stitched: **8–25+ min** depending on draft vs hero path.
- Time is **superlinear** with tokens/frames. Do not budget 2× a 15 s job as if it were linear.
- Video references are expensive. Still + audio refs are cheap by comparison.
- PRO 6000 vs 5090 is often only ~10–15% faster when both fit. The 96 GB win is not OOMing at 15 s / 1 MP / multi-ref.

Sol-Super 4-step GB200 recipes are **not** a safe default on this card yet.

---

## 3. Recommended stack (do not use one graph for everything)

| Job | Start here | Why |
|---|---|---|
| First successful run / schema source of truth | Official ComfyUI templates: Video → MiniMax H3 (T2V / I2V / R2V) | Correct models, frame grid, official turbo wiring |
| Fast 5–15 s drafts | Civitai Sage + Turbo + AGSoft H3 Cache v2.2 | Clean speed stack |
| Packaged 5–15 s quality kitchen | Civitai Minimax H3 EZ V4.1 (Turbo / Optimal / RTX upscale / LTX 2.5 refine) | Sol-Attn, cache, H3 latent upscale, RTX upscale, LTX 2.5 |
| Actual 30 s continuous take | Civitai MiniMax-H3 Multishot — Seamless Chain v2.7 **or this repo’s** `MiniMax_H3_Multishot_Seamless_Workflow_Generator.html` | Purpose-built chain; picture + audio continuity |

### This repo — which generator to use

| Path | File | When |
|---|---|---|
| Draft / iterate | `MiniMax_H3_Local_VRAM_Workflow_Generator.html` | 0.2–0.4 MP, step sweep |
| 30 s continuity | `MiniMax_H3_Multishot_Seamless_Workflow_Generator.html` | Joey-style multishot memory |
| Hero 15 s / 1 MP | `MiniMax_H3_PRO6000_Cinematic_Workflow_Generator.html` | 1344×768, higher steps — **not** the draft default |
| Mixed engines | `Long_Video_Workflow_Studio.html` | H3 + LTX-2.5 two-stage |

**Standing rule:** `PRO6000_Cinematic` is the **hero** path. Do not run prompt iteration at 1344×768 / 25 steps.

---

## 4. Production recipe (preferred over any single all-in-one JSON)

1. **Lock look at 5 s, ~0.4 MP** (864×480 or 768 short-edge).
   - I2V / FL2VA if a still exists; T2V only for exploration.
   - Turbo LoRA: larryvrh `v4_step600_ema` at **6–8 steps**, strength **0.8–1.0** (start 0.85 if faces look plastic).
   - Attention: Sage `auto` + conservative Sol-Attn.
   - Cache: AGSoft H3 Cache on (not aggressive EasyCache thresholds).
   - Target: keepable motion/audio in ~30–90 s on the 6000.

2. **Extend to 30 s at the same 0.4 MP** with Seamless Chain / this repo’s Multishot generator.
   - Three ~10 s shots or 2×15 s.
   - Last frame of shot N = first frame of shot N+1.
   - One continuous-take prompt: same subject, light, wardrobe, camera energy. Separate shots with `---`.
   - End each shot on settled motion.
   - Keep turbo + Sage. Leave LTX refine **off**.

3. **Promote only the keeper.**
   - H3 latent upscale 0.4 MP → ~1 MP, then RTX Video Super Resolution if delivery needs 1080p/4K.
   - Optional LTX 2.5 refine **once** on the final clip.
   - If faces smear, re-run **one section** at 8 steps / no cache. Do not regenerate the whole 30 s.

---

## 5. Model and node defaults

Prefer pruned INT8 ConvRot DiT + NVFP4/AWQ or INT8 text encoder for drafts. BF16 is allowed on 96 GB; do not use it for iteration.

Official / Comfy-Org names to prefer when wiring new graphs:

```
minimax_h3_fl2va_pruned_int8_convrot.safetensors
minimax_h3_ref2va_pruned_int8_convrot.safetensors
qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors
minimax_h3_video_vae_fp16.safetensors
minimax_h3_audio_vae_fp32.safetensors
```

Turbo:
- FL2V / T2V / I2V: official 8-step FL2V turbo **or** larryvrh v4 step-600 EMA (preferred quality/speed balance).
- Ref2V: official ref2v 4-step turbo. LightX / ckpt850 4-step is faster and weaker on faces and small motion.

Nodes that stack if kept conservative: Sage (KJNodes) → Turbo LoRA → Sol-Attn → H3 cache.
Disable cache first if lipsync, hands, or joins look cheap; then raise Sol-Attn density; then add steps. Do not use LTX refine to hide a bad chain.

Kitchen / low-VRAM patches are usually unnecessary on a 6000 unless LTX 2.5 + refs + upscalers are all resident.

---

## 6. Prompting rules for the Master bot

Follow `PromptGen.md` plus:

- Describe scene, timed shots, camera, and audio in one block.
- R2V: tag refs (`<Picture 1>`, `<Audio 1>`) and assign a job (identity / motion / voice).
- One strong reference image often beats three competing ones in FL2VA/I2V hybrids.
- Chain language must preserve identity, wardrobe, light, and audio. No reset, no cut, no fade unless the user asked for a cut.
- Fast camera + talking across a join is the hard case. End on a hold or a cut-friendly head turn.

---

## 7. Validation protocol (run before changing defaults)

1. Official T2V template, 5 s, 864×480, 20 steps, no turbo — record wall time (baseline).
2. Same prompt with Sage + v4 turbo at 6 steps + cache. Expect ~2–4× faster; reject if faces/audio collapse.
3. Seamless Chain, `take_seconds=30`, 0.4 MP, three shots, same subject. Inspect both joins at 100%.
4. Upscale only the best take. Compare 0.4 MP chain + upscale vs one 15 s 1 MP native.

---

## 8. What Master should tell the user

- Default plan: draft 0.4 MP → 30 s multishot → upscale keeper.
- Quote time bands from section 2, labeled as community measurements.
- If the user asks for “cinematic 30 s at 1344×768 in one click,” warn that native 1 MP 30 s is the slow/fragile path and offer the three-stage recipe instead.
- If a Civitai graph goes red, fall back to official Comfy templates and re-add Sage → Turbo → Cache in that order.

---

## 9. Sources (snapshot date 2026-09-01)

- Official Comfy MiniMax H3 docs (modes, frame grid, turbo, Sage).
- Community PRO 6000 / ComfyUI timings (HN MiniMax H3 day-0 thread; @el_mejnun 6000 Pro benches; Sage/Sol-Attn/latent-upscale YouTube + Reddit).
- Civitai: Sage+Turbo+Cache v2.2; EZ V4.1; Multishot Seamless Chain v2.7.
- This repo generators and `PromptGen.md`.

Do not treat third-party Civitai graphs as version-stable. Pack updates break canvases.
