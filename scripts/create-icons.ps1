# Recreate the code-native app monogram; no remote artwork or font downloads.
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
foreach ($spec in @(@('icon-192.png',192), @('icon-512.png',512), @('icon-maskable-512.png',512), @('apple-touch-icon.png',180))) {
  $size = [int]$spec[1]
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#f4ded5'))
  $color = [System.Drawing.ColorTranslator]::FromHtml('#995957')
  $pen = New-Object System.Drawing.Pen($color, ($size / 102))
  $margin = $size * 0.1875
  $diameter = $size * 0.625
  $graphics.DrawEllipse($pen, $margin, $margin, $diameter, $diameter)
  $brush = New-Object System.Drawing.SolidBrush($color)
  $font = New-Object System.Drawing.Font('Georgia', ($size * 0.40), ([System.Drawing.FontStyle]::Regular), ([System.Drawing.GraphicsUnit]::Pixel))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, (-$size * 0.035), $size, $size)
  $graphics.DrawString('r.', $font, $brush, $rect, $format)
  $bitmap.Save((Join-Path $projectRoot ('public/' + $spec[0])), [System.Drawing.Imaging.ImageFormat]::Png)
  $format.Dispose(); $font.Dispose(); $brush.Dispose(); $pen.Dispose(); $graphics.Dispose(); $bitmap.Dispose()
}
