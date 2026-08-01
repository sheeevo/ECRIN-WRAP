param(
  [string]$InPath = "c:\Users\hugob\Projects\ECRIN-WRAP\assets\ecrin-logo.png",
  [string]$OutPath = "c:\Users\hugob\Projects\ECRIN-WRAP\assets\w-order.png"
)
Add-Type -AssemblyName System.Drawing

# writing-path polyline for the W, in the source PNG's native 1254x1254
# coordinate space (from "Prompt animation logo.md")
$path = @(
  @{x=640; y=452}, @{x=613; y=482}, @{x=536; y=653}, @{x=814; y=395},
  @{x=782; y=650}, @{x=1015; y=420}, @{x=1055; y=396}
)

# bounding box containing just the W glyph (from ecrin-teaser-logo.jsx)
$X0 = 515; $X1 = 1035; $Y0 = 388; $Y1 = 668

# precompute segment vectors + cumulative lengths
$segCount = $path.Count - 1
$ax = New-Object double[] $segCount; $ay = New-Object double[] $segCount
$bx = New-Object double[] $segCount; $by = New-Object double[] $segCount
$dx = New-Object double[] $segCount; $dy = New-Object double[] $segCount
$segLen = New-Object double[] $segCount
$cumLen = New-Object double[] $segCount
$total = 0.0
for ($i = 0; $i -lt $segCount; $i++) {
  $ax[$i] = $path[$i].x; $ay[$i] = $path[$i].y
  $bx[$i] = $path[$i+1].x; $by[$i] = $path[$i+1].y
  $ddx = $bx[$i] - $ax[$i]; $ddy = $by[$i] - $ay[$i]
  $dx[$i] = $ddx; $dy[$i] = $ddy
  $len = [Math]::Sqrt($ddx*$ddx + $ddy*$ddy)
  $segLen[$i] = $len
  $cumLen[$i] = $total
  $total += $len
}

$src = [System.Drawing.Bitmap]::FromFile($InPath)
$w = $src.Width; $h = $src.Height
$rect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$data = $src.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $h)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$src.UnlockBits($data)
$src.Dispose()

$out = New-Object byte[] ($stride * $h)  # all zero = fully transparent black by default

for ($y = $Y0; $y -le $Y1; $y++) {
  for ($x = $X0; $x -le $X1; $x++) {
    $off = $y * $stride + $x * 4
    # source PNG has no real alpha (it's composited via mix-blend-mode:screen
    # against a solid black background), so pixel colour is the glyph mask
    # instead of the (always-255) alpha channel. Only near-white pixels count:
    # the W's bounding box also clips the red tail of the E's top bar, and
    # including it would make part of the E animate along with the W.
    $b0 = $bytes[$off]; $g0 = $bytes[$off+1]; $r0 = $bytes[$off+2]
    $minc = [Math]::Min($r0, [Math]::Min($g0, $b0))
    if ($minc -lt 60) { continue }
    $a = $minc

    $bestDist2 = [double]::MaxValue
    $bestT = 0.0
    for ($i = 0; $i -lt $segCount; $i++) {
      $pxv = $x - $ax[$i]; $pyv = $y - $ay[$i]
      $L2 = $dx[$i]*$dx[$i] + $dy[$i]*$dy[$i]
      $t = 0.0
      if ($L2 -gt 0) {
        $t = ($pxv * $dx[$i] + $pyv * $dy[$i]) / $L2
        if ($t -lt 0) { $t = 0 } elseif ($t -gt 1) { $t = 1 }
      }
      $cx = $ax[$i] + $t * $dx[$i]
      $cy = $ay[$i] + $t * $dy[$i]
      $ddx2 = $x - $cx; $ddy2 = $y - $cy
      $dist2 = $ddx2*$ddx2 + $ddy2*$ddy2
      if ($dist2 -lt $bestDist2) {
        $bestDist2 = $dist2
        $bestT = $cumLen[$i] + $t * $segLen[$i]
      }
    }

    $order = [Math]::Round(($bestT / $total) * 255)
    if ($order -lt 0) { $order = 0 }; if ($order -gt 255) { $order = 255 }
    $ob = [byte]$order
    $out[$off] = $ob        # B
    $out[$off+1] = $ob      # G
    $out[$off+2] = $ob      # R
    $out[$off+3] = $a       # A (same as source W alpha)
  }
}

$outBmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$outRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$outData = $outBmp.LockBits($outRect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
[System.Runtime.InteropServices.Marshal]::Copy($out, 0, $outData.Scan0, $out.Length)
$outBmp.UnlockBits($outData)
$outBmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$outBmp.Dispose()
Write-Output "done: $OutPath"
