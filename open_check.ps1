param([string]$path, [int]$waitSec = 30)
Get-Process POWERPNT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process "C:\Program Files\Microsoft Office\Office16\POWERPNT.EXE" -ArgumentList "`"$path`""
Start-Sleep -Seconds $waitSec
$p = Get-Process POWERPNT -ErrorAction SilentlyContinue
if ($p) { Write-Output ("TITLE: " + ($p | Select-Object -First 1).MainWindowTitle) } else { Write-Output "TITLE: <not running>" }
