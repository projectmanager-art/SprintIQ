# Smoke test: PowerPoint COM + native editable chart (robust retries)
$ErrorActionPreference = "Stop"
function ComRetry([scriptblock]$sb, [int]$tries = 12, [string]$name = "call") {
    for ($i = 0; $i -lt $tries; $i++) {
        try { $r = & $sb; if ($null -ne $r) { return $r } } catch { $lastErr = $_.Exception.Message }
        Start-Sleep -Milliseconds 800
    }
    throw "COM call '$name' failed after $tries attempts. Last error: $lastErr"
}

$ppt = ComRetry { New-Object -ComObject PowerPoint.Application } 15
try { $ppt.Visible = 1 } catch {}
Start-Sleep -Seconds 3
$null = ComRetry { $ppt.Presentations.Add() }
Start-Sleep -Milliseconds 500
while ($ppt.Presentations.Count -gt 1) { $ppt.Presentations.Item($ppt.Presentations.Count).Close() }
$pres = $ppt.Presentations.Item(1)
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540

$slide = ComRetry { $pres.Slides.Add(1, 12) } # ppLayoutBlank

$tb = $slide.Shapes.AddTextbox(1, 40, 30, 600, 50)
$tb.TextFrame.TextRange.Text = "Smoke Test Slide"
$tb.TextFrame.TextRange.Font.Size = 28
$tb.TextFrame.TextRange.Font.Name = "Segoe UI"

$shape = ComRetry { $slide.Shapes.AddChart2(-1, 51, 40, 100, 500, 300) } 3
$chart = $shape.Chart
$chart.ChartData.Activate()
$wb = $chart.ChartData.Workbook
$ws = $wb.Worksheets.Item(1)
$ws.Range("A1").Value = "Year"
$ws.Range("B1").Value = "Invoiced"
$ws.Range("A2").Value = "2024"
$ws.Range("B2").Value = 11338.8
$ws.Range("A3").Value = "2025"
$ws.Range("B3").Value = 14566.8
$ws.Range("A4:B5").Clear()
$chart.SetSourceData("='Sheet1'!`$A`$1:`$B`$3")
$wb.Saved = $true
try { $wb.Close() } catch {}
$chart.HasTitle = $true
$chart.ChartTitle.Text = "Test Chart"

$out = "C:\Users\Sandeep_fastranking\Desktop\Devin\smoke.pptx"
$pres.SaveAs($out)
$pres.Close()
$ppt.Quit()
Write-Output "Saved $out"

$ppt2 = ComRetry { New-Object -ComObject PowerPoint.Application } 15
$pres2 = ComRetry { $ppt2.Presentations.Open($out, $true, $false, $false) }
Write-Output ("Reopened OK. Slides: " + $pres2.Slides.Count + ", Shapes on s1: " + $pres2.Slides.Item(1).Shapes.Count)
$pres2.Close()
$ppt2.Quit()
