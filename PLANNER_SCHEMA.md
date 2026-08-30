# Planner schema (QA)

The long-form generator still only *needs* `segments[].prompt` and `segments[].approx_seconds`.
The extra fields lock identity and match official MiniMax H3 prompt grammar.

This is **prompt grammar inside our planner**, not a vendored copy of ComfyUI-MiniMax-H3-Promptor nodes.

## JSON contract

```json
{
  "enhanced_overall": "one-paragraph cleaned high-level description",
  "total_seconds": 60,
  "target_clip_seconds": 6,
  "cast": {
    "subjects": [
      { "id": 1, "name": "Chef", "look": "short salt-and-pepper hair, white jacket, black apron" }
    ],
    "setting": "warm professional kitchen, marble counters, copper pots",
    "lighting": "warm practical overhead and window light",
    "audio_palette": "knife on wood, butter sizzle, quiet kitchen hum, low acoustic guitar"
  },
  "segments": [
    {
      "index": 1,
      "approx_seconds": 6,
      "mode": "t2v",
      "prompt": "subject_definitions: ...\nsummary: ...\nretention_analysis: ...\naction: ...\noverall_soundscape: ...\nnon_diegetic_music: ...\ntracking/camera notes: ..."
    }
  ]
}
```

## Segment count

`N = ceil(total_seconds / target_clip_seconds)`

Examples:
- 60 s / 10 s → 6 segments
- 60 s / 6 s → 10 segments
- 60 s / 4 s → 15 segments

## What we took from Promptor

- Official field order (subjects, summary, retention, action, sound, camera)
- `<Subject N>` identity lock across shots
- Optional official dialogue syntax
- First-frame continuity language for chained clips

## What we did not take

- Their ComfyUI custom nodes
- Their 15-second single-clip cap
- Auto I2VA / Ref2VA / V2V mode soup

The graph builder is unchanged: last-frame chaining + trim + concat.
