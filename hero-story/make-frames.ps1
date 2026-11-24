# Turns a video clip into the WebP frame sequence the hero story scrubs through.
#
#   powershell -ExecutionPolicy Bypass -File hero-story\make-frames.ps1 -Clip "C:\clips\pose.mp4" -Chapter pose
#   powershell -ExecutionPolicy Bypass -File hero-story\make-frames.ps1 -Clip "C:\clips\pose-9x16.mp4" -Chapter pose -Mobile
#
# Writes assets/hero-story/<chapter>[-mobile]/0001.webp … and prints the line to
# paste into CHAPTERS in hero-story.js. Needs ffmpeg (winget install ffmpeg),
# or pass -Ffmpeg with the path to ffmpeg.exe.
param(
  [Parameter(Mandatory=$true)][string]$Clip,
  [Parameter(Mandatory=$true)][ValidateSet('studio','pose','teintes','ppf')][string]$Chapter,
  [int]$Frames = 90,          # frames kept across the whole clip (more = smoother, heavier)
  [int]$Width = 1600,         # output width (mobile: height is used instead)
  [int]$Quality = 72,
  [switch]$Mobile,
  [string]$Ffmpeg = 'ffmpeg'
)
$ErrorActionPreference = 'Stop'
$ffprobe = Join-Path (Split-Path $Ffmpeg) 'ffprobe.exe'
if (-not (Test-Path $ffprobe)) { $ffprobe = 'ffprobe' }

$name = if ($Mobile) { "$Chapter-mobile" } else { $Chapter }
$out = Join-Path $PSScriptRoot "..\assets\hero-story\$name"
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
New-Item -ItemType Directory -Force $out | Out-Null

$duration = [double](& $ffprobe -v error -show_entries format=duration -of csv=p=0 $Clip)
$fps = [Math]::Round($Frames / $duration, 4)
$scale = if ($Mobile) { "scale=-2:$Width" } else { "scale=${Width}:-2" }

& $Ffmpeg -v error -y -i $Clip -vf "fps=$fps,$scale" -frames:v $Frames -c:v libwebp -quality $Quality "$out\%04d.webp"
$count = (Get-ChildItem $out -Filter *.webp).Count
$size = [Math]::Round(((Get-ChildItem $out | Measure-Object Length -Sum).Sum / 1MB), 1)

$key = if ($Mobile) { 'seqMobile' } else { 'seq' }
Write-Host "$count frames, $size Mo -> assets/hero-story/$name/"
Write-Host "In hero-story.js, chapter '$Chapter':  ${key}:{ dir:'assets/hero-story/$name/', count:$count, ext:'webp', pad:4 }"
