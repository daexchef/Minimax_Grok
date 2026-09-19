#!/usr/bin/env bash
# POSIX twin of h3_capture_next_start.ps1 for Linux pods / CI.
# Extract a frame at timestamp T into ComfyUI/input, or concat clips.
set -euo pipefail

VIDEO=""
TIME=""
COMFY_ROOT=""
OUT_REL="h3_chain/next_start.png"
ALSO_REL=""
CONCAT_OUT=""
CONCAT_CLIPS=()

usage() {
  cat <<'EOF'
Usage:
  scripts/h3_capture_next_start.sh --video seg.mp4 --time 9.42 --comfy-root /path/to/ComfyUI
  scripts/h3_capture_next_start.sh --concat-out final.mp4 --concat seg01.mp4 --concat seg02.mp4
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --video) VIDEO="$2"; shift 2 ;;
    --time) TIME="$2"; shift 2 ;;
    --comfy-root) COMFY_ROOT="$2"; shift 2 ;;
    --out-rel) OUT_REL="$2"; shift 2 ;;
    --also-rel) ALSO_REL="$2"; shift 2 ;;
    --concat-out) CONCAT_OUT="$2"; shift 2 ;;
    --concat) CONCAT_CLIPS+=("$2"); shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; usage; exit 2 ;;
  esac
done

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found on PATH" >&2
  exit 1
fi

if [[ ${#CONCAT_CLIPS[@]} -gt 0 ]]; then
  [[ -n "$CONCAT_OUT" ]] || { echo "--concat-out is required" >&2; exit 1; }
  list="$(mktemp)"
  trap 'rm -f "$list"' EXIT
  for c in "${CONCAT_CLIPS[@]}"; do
    [[ -f "$c" ]] || { echo "Concat clip missing: $c" >&2; exit 1; }
    printf "file '%s'\n" "$(cd "$(dirname "$c")" && pwd)/$(basename "$c")" >> "$list"
  done
  mkdir -p "$(dirname "$CONCAT_OUT")"
  ffmpeg -y -f concat -safe 0 -i "$list" -c copy "$CONCAT_OUT"
  echo "Wrote $CONCAT_OUT"
fi

if [[ -n "$TIME" ]]; then
  [[ -n "$VIDEO" && -f "$VIDEO" ]] || { echo "--video missing or not found" >&2; exit 1; }
  if [[ -n "$COMFY_ROOT" ]]; then
    dest="$COMFY_ROOT/input/$OUT_REL"
  else
    dest="$OUT_REL"
  fi
  mkdir -p "$(dirname "$dest")"
  ffmpeg -y -ss "$TIME" -i "$VIDEO" -frames:v 1 -update 1 "$dest"
  echo "Wrote $dest  (LoadImage: $OUT_REL)"
  if [[ -n "$ALSO_REL" ]]; then
    if [[ -n "$COMFY_ROOT" ]]; then
      also="$COMFY_ROOT/input/$ALSO_REL"
    else
      also="$ALSO_REL"
    fi
    mkdir -p "$(dirname "$also")"
    cp -f "$dest" "$also"
    echo "Also wrote $also"
  fi
fi

if [[ -z "$TIME" && ${#CONCAT_CLIPS[@]} -eq 0 ]]; then
  usage
  exit 1
fi
