param([string]$slides, [string]$out, [switch]$noCharts)
Get-Process POWERPNT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$args = @("-ExecutionPolicy", "Bypass", "-File", "C:\Users\Sandeep_fastranking\Desktop\Devin\build_pptx.ps1", "-OutName", $out)
if ($noCharts) { $args += "-NoCharts" }
if ($slides) { $args += @("-OnlySlides", $slides) }
& powershell @args
Start-Sleep -Seconds 1
powershell -ExecutionPolicy Bypass -File "C:\Users\Sandeep_fastranking\Desktop\Devin\open_check.ps1" -path "C:\Users\Sandeep_fastranking\Desktop\Devin\$out"
