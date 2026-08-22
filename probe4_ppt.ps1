# Probe 4: native chart via AddChart2 + embedded workbook data
$ErrorActionPreference = "Continue"
function ComRetry([scriptblock]$sb, [int]$tries = 15, [string]$name = "call") {
    $lastErr = ""
    for ($i = 0; $i -lt $tries; $i++) {
        try { $r = & $sb; if ($null -ne $r) { return $r } } catch { $lastErr = $_.Exception.Message }
        Start-Sleep -Seconds 1
    }
    throw "COM call '$name' failed after $tries attempts. Last error: $lastErr"
}
Get-Process POWERPNT -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$ppt = ComRetry { New-Object -ComObject PowerPoint.Application } 10 "new ppt"
try { $ppt.Visible = 1 } catch {}
Start-Sleep -Seconds 5
$pres = ComRetry { $ppt.Presentations.Add() } 15 "presentations.add"
$pres.PageSetup.SlideWidth = 960
$pres.PageSetup.SlideHeight = 540
$slide = ComRetry { $pres.Slides.Add(1, 12) } 10 "slides.add"

$shape = ComRetry { $slide.Shapes.AddChart2(-1, 51, 40, 100, 500, 300) } 8 "addchart2"
$chart = $shape.Chart
ComRetry { $chart.ChartData.Activate(); return 1 } 8 "chartdata.activate" | Out-Null
$wb = ComRetry { $chart.ChartData.Workbook } 8 "workbook"
$ws = $wb.Worksheets.Item(1)
$ws.Range("A1").Value = "Year"
$ws.Range("B1").Value = "Invoiced"
$ws.Range("C1").Value = "Paid"
$ws.Range("A2").Value = "2024"
$ws.Range("B2").Value = 11338.8
$ws.Range("C2").Value = 11338.8
$ws.Range("A3").Value = "2025"
$ws.Range("B3").Value = 14566.8
$ws.Range("C3").Value = 14566.8
$ws.Range("A4:C5").Clear()
$chart.SetSourceData("='Sheet1'!`$A`$1:`$C`$3")
$wb.Saved = $true
try { $wb.Close() } catch { Write-Output ("wb close: " + $_.Exception.Message) }
Start-Sleep -Milliseconds 500
$chart.HasTitle = $true
$chart.ChartTitle.Text = "Invoiced vs Paid"
$chart.HasLegend = $true

$pres.SaveAs("C:\Users\Sandeep_fastranking\Desktop\Devin\probe4.pptx")
Write-Output "SAVED probe4.pptx"
$pres.Close()
$ppt.Quit()
Write-Output "done"
