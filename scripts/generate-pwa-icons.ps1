param()

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$iconDirectory = Join-Path $PSScriptRoot '..\public\icons'
[System.IO.Directory]::CreateDirectory($iconDirectory) | Out-Null

function New-QrPayIcon([int]$Size, [string]$Path) {
  $bitmap = [System.Drawing.Bitmap]::new($Size, $Size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml('#075985'))

  $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $navy = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#075985'))
  $margin = [int]($Size * 0.18)
  $block = [int]($Size * 0.21)
  $inner = [int]($Size * 0.085)

  foreach ($point in @(
    @($margin, $margin),
    @(($Size - $margin - $block), $margin),
    @($margin, ($Size - $margin - $block))
  )) {
    $graphics.FillRectangle($white, $point[0], $point[1], $block, $block)
    $graphics.FillRectangle($navy, $point[0] + $inner, $point[1] + $inner, $block - (2 * $inner), $block - (2 * $inner))
  }

  $font = [System.Drawing.Font]::new('Malgun Gothic', [single]($Size * 0.16), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = [System.Drawing.StringFormat]::new()
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $textArea = [System.Drawing.RectangleF]::new([single]($Size * 0.36), [single]($Size * 0.42), [single]($Size * 0.48), [single]($Size * 0.36))
  $graphics.DrawString('송금', $font, $white, $textArea, $format)

  $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $format.Dispose()
  $font.Dispose()
  $navy.Dispose()
  $white.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-QrPayIcon 192 (Join-Path $iconDirectory 'qr-pay-192.png')
New-QrPayIcon 512 (Join-Path $iconDirectory 'qr-pay-512.png')
