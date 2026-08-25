Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $projectRoot 'front/assets/splash/mydish-wordmark-chef.png'
$foregroundPath = Join-Path $projectRoot 'front/assets/app-icon-foreground.png'
$iconPath = Join-Path $projectRoot 'front/assets/app-icon.png'

$source = [System.Drawing.Bitmap]::FromFile($sourcePath)

# Locate the warm-colored D mark in the wordmark.
$minX = $source.Width
$minY = $source.Height
$maxX = 0
$maxY = 0
for ($y = 0; $y -lt $source.Height; $y++) {
  for ($x = 0; $x -lt $source.Width; $x++) {
    $pixel = $source.GetPixel($x, $y)
    if ($pixel.R -gt 130 -and $pixel.R -gt ($pixel.G + 35) -and $pixel.G -gt ($pixel.B + 5)) {
      $minX = [Math]::Min($minX, $x)
      $minY = [Math]::Min($minY, $y)
      $maxX = [Math]::Max($maxX, $x)
      $maxY = [Math]::Max($maxY, $y)
    }
  }
}

$markWidth = $maxX - $minX + 1
$markHeight = $maxY - $minY + 1
$crop = New-Object System.Drawing.Bitmap($markWidth, $markHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

# Pixels outside the D are transparent. White regions enclosed by the D are
# the chef hat and its original underline, so they remain opaque white.
$outside = New-Object 'bool[,]' $markWidth, $markHeight
$queue = New-Object 'System.Collections.Generic.Queue[System.Drawing.Point]'
for ($x = 0; $x -lt $markWidth; $x++) {
  $queue.Enqueue([System.Drawing.Point]::new($x, 0))
  $queue.Enqueue([System.Drawing.Point]::new($x, $markHeight - 1))
}
for ($y = 0; $y -lt $markHeight; $y++) {
  $queue.Enqueue([System.Drawing.Point]::new(0, $y))
  $queue.Enqueue([System.Drawing.Point]::new($markWidth - 1, $y))
}

while ($queue.Count -gt 0) {
  $point = $queue.Dequeue()
  if ($point.X -lt 0 -or $point.X -ge $markWidth -or $point.Y -lt 0 -or $point.Y -ge $markHeight) { continue }
  if ($outside[$point.X, $point.Y]) { continue }
  $pixel = $source.GetPixel($minX + $point.X, $minY + $point.Y)
  $isMark = $pixel.R -gt 130 -and $pixel.R -gt ($pixel.G + 35) -and $pixel.G -gt ($pixel.B + 5)
  if ($isMark) { continue }
  $outside[$point.X, $point.Y] = $true
  $queue.Enqueue([System.Drawing.Point]::new($point.X - 1, $point.Y))
  $queue.Enqueue([System.Drawing.Point]::new($point.X + 1, $point.Y))
  $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y - 1))
  $queue.Enqueue([System.Drawing.Point]::new($point.X, $point.Y + 1))
}

for ($y = 0; $y -lt $markHeight; $y++) {
  for ($x = 0; $x -lt $markWidth; $x++) {
    if ($outside[$x, $y]) {
      $crop.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
    } else {
      $pixel = $source.GetPixel($minX + $x, $minY + $y)
      $crop.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $pixel.R, $pixel.G, $pixel.B))
    }
  }
}
$source.Dispose()

$canvasSize = 1254
$markSize = 504
# The D silhouette is right-heavy. Shift it slightly so the chef hat—not the
# outer silhouette—is visually centered in the launcher icon.
$destinationX = [int](($canvasSize - $markSize) / 2) + 22
$destinationY = [int](($canvasSize - $markSize) / 2)
$foreground = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($foreground)
$graphics.Clear([System.Drawing.Color]::Transparent)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$graphics.DrawImage($crop, [System.Drawing.Rectangle]::new($destinationX, $destinationY, $markSize, $markSize))
$graphics.Dispose()
$crop.Dispose()
$foreground.Save($foregroundPath, [System.Drawing.Imaging.ImageFormat]::Png)

$icon = New-Object System.Drawing.Bitmap($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($icon)
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#FFF8EE'))
$graphics.DrawImageUnscaled($foreground, 0, 0)
$graphics.Dispose()
$foreground.Dispose()
$icon.Save($iconPath, [System.Drawing.Imaging.ImageFormat]::Png)
$icon.Dispose()
