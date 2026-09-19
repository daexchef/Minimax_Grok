<#
.SYNOPSIS
  MiniMax H3 director helper: extract a start frame, drop it in ComfyUI/input,
  optionally launch LosslessCut, optionally concat finished clips.

.DESCRIPTION
  Optional disk helper for the ComfyUI Prompter HTML (Bro desktop or RunPod).
  In-page Capture frame is the portable path — this script is only needed when
  you want ffmpeg to write ComfyUI/input/h3_chain/next_start.png for you.

  ComfyRoot is optional and not Bro-specific. Pass whatever machine is running
  Comfy (C:\ComfyUI, /workspace/ComfyUI, a RunPod volume, …).

  Requires ffmpeg on PATH. LosslessCut is an optional Windows extra.

.EXAMPLE
  .\scripts\h3_capture_next_start.ps1 -Video "output\video\MiniMax_H3_seg01.mp4" -Time 9.42 -ComfyRoot "C:\ComfyUI"

.EXAMPLE
  .\scripts\h3_capture_next_start.ps1 -Video "D:\seg01.mp4" -LaunchLosslessCut

.EXAMPLE
  .\scripts\h3_capture_next_start.ps1 -ConcatClips "C:\ComfyUI\output\video\MiniMax_H3_PRO6000_seg01.mp4","C:\ComfyUI\output\video\MiniMax_H3_PRO6000_seg02.mp4" -ConcatOut "C:\ComfyUI\output\video\MiniMax_H3_PRO6000_final.mp4"
#>
[CmdletBinding()]
param(
  [string]$Video = "",
  [double]$Time = -1,
  [string]$ComfyRoot = "",
  [string]$OutRel = "h3_chain/next_start.png",
  [string]$AlsoRel = "",
  [switch]$LaunchLosslessCut,
  [string[]]$ConcatClips = @(),
  [string]$ConcatOut = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Find-Ffmpeg {
  $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  foreach ($p in @(
      "$env:LOCALAPPDATA\Microsoft\WinGet\Links\ffmpeg.exe",
      "C:\ffmpeg\bin\ffmpeg.exe"
    )) {
    if (Test-Path $p) { return $p }
  }
  throw "ffmpeg not found on PATH. Install with: winget install Gyan.FFmpeg"
}

function Find-LosslessCut {
  $cmd = Get-Command LosslessCut -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $cmd = Get-Command LosslessCut.exe -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $roots = @(
    "$env:LOCALAPPDATA\Programs\LosslessCut",
    "$env:LOCALAPPDATA\Microsoft\WinGet\Packages",
    "$env:ProgramFiles\LosslessCut",
    "${env:ProgramFiles(x86)}\LosslessCut"
  )
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $hit = Get-ChildItem -Path $root -Filter "LosslessCut.exe" -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1
    if ($hit) { return $hit.FullName }
  }
  return $null
}

function Resolve-ComfyInput([string]$Root, [string]$Rel) {
  $rel = ($Rel -replace '\\', '/').TrimStart('/')
  if ($Root) {
    return Join-Path (Join-Path $Root "input") ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
  }
  return Join-Path (Get-Location) ($rel -replace '/', [IO.Path]::DirectorySeparatorChar)
}

if ($ConcatClips.Count -gt 0) {
  if (-not $ConcatOut) { throw "-ConcatOut is required when using -ConcatClips" }
  $ff = Find-Ffmpeg
  $list = New-TemporaryFile
  try {
    $lines = foreach ($c in $ConcatClips) {
      $full = [IO.Path]::GetFullPath($c)
      if (-not (Test-Path $full)) { throw "Concat clip missing: $full" }
      "file '$($full -replace "'", "'\''")'"
    }
    Set-Content -Path $list -Value $lines -Encoding ascii
    $outDir = Split-Path -Parent $ConcatOut
    if ($outDir -and -not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
    & $ff -y -f concat -safe 0 -i $list.FullName -c copy $ConcatOut
    if ($LASTEXITCODE -ne 0) { throw "ffmpeg concat failed ($LASTEXITCODE)" }
    Write-Host "Wrote $ConcatOut"
  } finally {
    Remove-Item $list -ErrorAction SilentlyContinue
  }
}

if ($LaunchLosslessCut) {
  if (-not $Video) { throw "-Video is required for -LaunchLosslessCut" }
  if (-not (Test-Path $Video)) { throw "Video not found: $Video" }
  $lc = Find-LosslessCut
  if (-not $lc) {
    throw "LosslessCut.exe not found. Install with: winget install mifi.losslesscut"
  }
  Start-Process -FilePath $lc -ArgumentList @([IO.Path]::GetFullPath($Video))
  Write-Host "Launched LosslessCut on $Video"
  Write-Host "Export the current frame as PNG, then save to ComfyUI\input\h3_chain\next_start.png"
}

if ($Time -ge 0) {
  if (-not $Video) { throw "-Video is required when -Time is set" }
  if (-not (Test-Path $Video)) { throw "Video not found: $Video" }
  $ff = Find-Ffmpeg
  $dest = Resolve-ComfyInput $ComfyRoot $OutRel
  $destDir = Split-Path -Parent $dest
  if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
  & $ff -y -ss $Time -i ([IO.Path]::GetFullPath($Video)) -frames:v 1 -update 1 $dest
  if ($LASTEXITCODE -ne 0) { throw "ffmpeg frame extract failed ($LASTEXITCODE)" }
  if (-not (Test-Path $dest)) { throw "ffmpeg did not write $dest" }
  Write-Host "Wrote $dest  (LoadImage: $OutRel)"
  if ($AlsoRel) {
    $also = Resolve-ComfyInput $ComfyRoot $AlsoRel
    $alsoDir = Split-Path -Parent $also
    if (-not (Test-Path $alsoDir)) { New-Item -ItemType Directory -Path $alsoDir -Force | Out-Null }
    Copy-Item -Force $dest $also
    Write-Host "Also wrote $also"
  }
}

if ($Time -lt 0 -and -not $LaunchLosslessCut -and $ConcatClips.Count -eq 0) {
  Write-Host @"
Usage:
  Extract a frame into Comfy input:
    .\scripts\h3_capture_next_start.ps1 -Video <seg.mp4> -Time 9.42 -ComfyRoot C:\ComfyUI

  Open the clip in LosslessCut:
    .\scripts\h3_capture_next_start.ps1 -Video <seg.mp4> -LaunchLosslessCut

  Concat finished segments:
    .\scripts\h3_capture_next_start.ps1 -ConcatClips seg01.mp4,seg02.mp4 -ConcatOut final.mp4
"@
}
