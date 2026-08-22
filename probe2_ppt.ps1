# Probe 2: start PowerPoint, dismiss any modal dialog via keystrokes, then automate
$ppt = New-Object -ComObject PowerPoint.Application
try { $ppt.Visible = 1 } catch {}
Start-Sleep -Seconds 4

# enumerate top-level windows of POWERPNT
$proc = Get-Process POWERPNT -ErrorAction SilentlyContinue | Select-Object -First 1
Write-Output ("Main window: '" + $proc.MainWindowTitle + "'")

$shell = New-Object -ComObject WScript.Shell
$null = $shell.AppActivate($proc.Id)
Start-Sleep -Milliseconds 500
$shell.SendKeys("{ESC}")
Start-Sleep -Milliseconds 400
$shell.SendKeys("{ESC}")
Start-Sleep -Milliseconds 800

$pres = $null
try { $pres = $ppt.Presentations.Add() } catch { Write-Output ("add err: " + $_.Exception.Message) }
Write-Output ("pres null? " + ($null -eq $pres))
if ($pres) {
    $slide = $null
    try { $slide = $pres.Slides.Add(1, 12) } catch { Write-Output ("slide err: " + $_.Exception.Message) }
    Write-Output ("slide null? " + ($null -eq $slide))
    if ($slide) {
        $tb = $slide.Shapes.AddTextbox(1, 40, 30, 600, 50)
        $tb.TextFrame.TextRange.Text = "probe2"
        $out = "C:\Users\Sandeep_fastranking\Desktop\Devin\probe2.pptx"
        $pres.SaveAs($out)
        Write-Output "saved probe2.pptx"
        $pres.Close()
    }
}
$ppt.Quit()
Write-Output "done"
