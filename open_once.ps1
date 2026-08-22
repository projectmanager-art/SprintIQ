param([string]$path)
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
$ppt = ComRetry { New-Object -ComObject PowerPoint.Application } 10 "new"
try { $ppt.Visible = 1 } catch {}
Start-Sleep -Seconds 5
$pres = ComRetry { $ppt.Presentations.Open($path, $true, $false, $true) } 20 "open"
Write-Output ("OPENED OK: " + $path + " slides=" + $pres.Slides.Count)
$pres.Close()
$ppt.Quit()
