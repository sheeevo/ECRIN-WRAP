param(
  [Parameter(Mandatory=$true)][string]$InPath,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [int]$OutW = 900,
  [int]$OutH = 700
)
Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile($InPath)

# cover-fit crop into OutW x OutH
$srcRatio = $src.Width / $src.Height
$dstRatio = $OutW / $OutH
if ($srcRatio -gt $dstRatio) {
  $cropH = $src.Height
  $cropW = [int]($src.Height * $dstRatio)
} else {
  $cropW = $src.Width
  $cropH = [int]($src.Width / $dstRatio)
}
$cropX = [int](($src.Width - $cropW) / 2)
$cropY = [int](($src.Height - $cropH) / 2)
$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)

$bmp = New-Object System.Drawing.Bitmap($OutW, $OutH)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$dstRect = New-Object System.Drawing.Rectangle(0, 0, $OutW, $OutH)
$g.DrawImage($src, $dstRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$src.Dispose()

# light uniform wash over the whole photo first, so a bright studio backdrop
# doesn't read as a pasted white rectangle next to the site's near-black page
# -- kept subtle so the car itself stays bright and clearly visible.
$washBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 5, 5, 5))
$g.FillRectangle($washBrush, 0, 0, $OutW, $OutH)

# soft vignette: barely-there in the center, fading to dark only at the very
# edges/corners. The gradient ellipse circumscribes the whole canvas (its
# boundary passes through the 4 corners) so corners land at the outermost,
# darkest stop -- no separate corner fill needed, no hard edge anywhere.
$cx = $OutW / 2.0
$cy = $OutH / 2.0
$maxR = [Math]::Sqrt($cx * $cx + $cy * $cy)
$path = New-Object System.Drawing.Drawing2D.GraphicsPath
$path.AddEllipse($cx - $maxR, $cy - $maxR, $maxR * 2, $maxR * 2)
$brush = New-Object System.Drawing.Drawing2D.PathGradientBrush($path)
$brush.CenterPoint = New-Object System.Drawing.PointF($cx, $cy)
$colorBlend = New-Object System.Drawing.Drawing2D.ColorBlend(4)
$colorBlend.Colors = @(
  [System.Drawing.Color]::FromArgb(0, 5, 5, 5),
  [System.Drawing.Color]::FromArgb(20, 5, 5, 5),
  [System.Drawing.Color]::FromArgb(80, 5, 5, 5),
  [System.Drawing.Color]::FromArgb(150, 5, 5, 5)
)
$colorBlend.Positions = @(0.0, 0.5, 0.75, 1.0)
$brush.InterpolationColors = $colorBlend
$g.FillRectangle($brush, 0, 0, $OutW, $OutH)

$g.Dispose()
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()
Write-Output "done: $OutPath"
