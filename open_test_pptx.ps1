# Open-test the generated pptx in PowerPoint; export slides as PNGs for visual QC
$ErrorActionPreference = "Continue"
function ComRetry([scriptblock]$sb, [int]$tries = 20, [string]$name = "call") {
    $lastErr = ""
    for ($i = 0; $i -lt $tries; $i++) {
        try { $r = & $sb; if ($null -ne $r) { return $r } } catch { $lastErr = $_.Exception.Message }
        Start-Sleep -Seconds 1
    }
    throw "COM call '$name' failed after $tries attempts. Last error: $lastErr"
}
Get-Process POWERPNT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$path = "C:\Users\Sandeep_fastranking\Desktop\Devin\Management_Invoice_Project_Analysis.pptx"
$ppt = ComRetry { New-Object -ComObject PowerPoint.Application } 10 "new"
try { $ppt.Visible = 1 } catch {}
Start-Sleep -Seconds 5
$pres = ComRetry { $ppt.Presentations.Open($path, $true, $false, $true) } 25 "open"
Write-Output ("OPENED OK. Slides: " + $pres.Slides.Count + " size: " + $pres.PageSetup.SlideWidth + "x" + $pres.PageSetup.SlideHeight)
for ($i = 1; $i -le $pres.Slides.Count; $i++) {
    $shapes = $pres.Slides.Item($i).Shapes.Count
    Write-Output ("slide $i shapes=$shapes")
}
$pngDir = "C:\Users\Sandeep_fastranking\Desktop\Devin\ppt_png"
if (Test-Path $pngDir) { Remove-Item $pngDir -Recurse -Force }
New-Item -ItemType Directory -Path $pngDir | Out-Null
$pres.SaveAs($pngDir, 18)  # 18 = ppSaveAsPNG
Write-Output "exported PNGs"
$pres.Close()
$ppt.Quit()
Write-Output "done"
